import { getSql } from "../lib/db.js";
import { registrarEvento } from "../lib/eventos.js";
import { getUsuario, jsonResponse, ehSuperior } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeEditar, semAcesso, soVisualizar, obraDoRegistro } from "../lib/acesso.js";

// Observações = "livro de obra".
//  - Criar: todo mundo que tem acesso ao módulo (a empresa pode bloquear em Permissões).
//  - Editar: só o próprio autor. A versão anterior vai pro histórico.
//  - Apagar: só quem está ACIMA do autor (pelo rank que ele tinha ao escrever). O autor não apaga: é o livro de obra.
//  - Histórico de edições: visível só pro autor e pros superiores dele.

// Superior estrito do autor, pelo rank que ele tinha ao escrever (o Dono principal fica acima de um co-Dono).
async function podeVerHistoricoOuApagar(usuario, autor) {
  return ehSuperior(usuario, autor.rank, autor.id);
}

export default async function observacoesHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    // Histórico de uma observação
    const historicoId = url.searchParams.get("historico");
    if (historicoId) {
      const obs = await sql`
        SELECT o.criado_por, o.obra_id, COALESCE(o.rank_autor, u.rank) AS rank FROM observacoes o JOIN usuarios u ON u.id = o.criado_por WHERE o.id = ${historicoId}
      `;
      if (obs.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      // Tem que ter acesso a ESSA obra (antes, um Dono de outra empresa conseguia ler).
      const acessoHist = await nivelNaObra(sql, usuario, obs[0].obra_id, "observacoes", env);
      if (!acessoHist.obra || !podeVer(acessoHist.nivel)) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      const autor = { id: obs[0].criado_por, rank: obs[0].rank };
      if (autor.id !== usuario.id && !(await podeVerHistoricoOuApagar(usuario, autor))) {
        return jsonResponse({ ok: false, error: "só o autor e seus superiores veem o histórico" }, 403);
      }
      const versoes = await sql`
        SELECT texto, substituido_em FROM observacoes_historico WHERE observacao_id = ${historicoId} ORDER BY id ASC
      `;
      return jsonResponse({ ok: true, versoes });
    }

    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const acesso = await nivelNaObra(sql, usuario, obraId, "observacoes", env);
    if (!acesso.obra) return semAcesso();
    if (!podeVer(acesso.nivel)) return jsonResponse({ ok: true, observacoes: [] });
    const itens = await sql`
      SELECT o.*, u.nome AS autor_nome, u.rank AS autor_rank_atual, u.removido_em AS autor_removido,
             (SELECT COUNT(*)::int FROM observacoes_historico h WHERE h.observacao_id = o.id) AS n_edicoes
      FROM observacoes o
      LEFT JOIN usuarios u ON u.id = o.criado_por
      WHERE o.obra_id = ${obraId}
      ORDER BY o.id DESC
    `;
    return jsonResponse({ ok: true, observacoes: itens });
  }

  if (req.method === "POST") {
    const { obraId, texto } = await req.json();
    if (!obraId || !String(texto || "").trim()) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const acesso = await nivelNaObra(sql, usuario, obraId, "observacoes", env);
    if (!acesso.obra) return semAcesso();
    if (!podeEditar(acesso.nivel)) return soVisualizar();
    const rows = await sql`
      INSERT INTO observacoes (obra_id, texto, criado_por, rank_autor)
      VALUES (${obraId}, ${String(texto).trim()}, ${usuario.id}, ${usuario.rank})
      RETURNING *
    `;
    const t = String(texto).trim();
    await registrarEvento(sql, usuario, { obraId: Number(obraId), categoria: "observacoes", acao: "criou", alvoId: rows[0].id, texto: `escreveu no livro de obra: "${t.slice(0, 80)}${t.length > 80 ? "…" : ""}"` });
    return jsonResponse({ ok: true, item: { ...rows[0], autor_nome: usuario.nome, autor_rank_atual: usuario.rank, n_edicoes: 0 } });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    const { texto } = await req.json();
    if (!String(texto || "").trim()) return jsonResponse({ ok: false, error: "texto vazio" }, 400);
    const alvos = await sql`SELECT * FROM observacoes WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const atual = alvos[0];
    const acessoP = await nivelNaObra(sql, usuario, atual.obra_id, "observacoes", env);
    if (!acessoP.obra) return semAcesso();
    if (!podeEditar(acessoP.nivel)) return soVisualizar(); // H5
    if (atual.criado_por !== usuario.id) return jsonResponse({ ok: false, error: "só o autor pode editar" }, 403);
    if (atual.texto === String(texto).trim()) return jsonResponse({ ok: true, item: atual });
    await sql`INSERT INTO observacoes_historico (observacao_id, texto, editado_por) VALUES (${id}, ${atual.texto}, ${usuario.id})`;
    await sql`UPDATE observacoes SET texto = ${String(texto).trim()}, editado_em = now() WHERE id = ${id}`;
    await registrarEvento(sql, usuario, { obraId: atual.obra_id, categoria: "observacoes", acao: "editou", alvoId: Number(id), texto: "editou uma observação do livro de obra" });
    const rows = await sql`
      SELECT o.*, u.nome AS autor_nome, u.rank AS autor_rank_atual, u.removido_em AS autor_removido,
             (SELECT COUNT(*)::int FROM observacoes_historico h WHERE h.observacao_id = o.id) AS n_edicoes
      FROM observacoes o LEFT JOIN usuarios u ON u.id = o.criado_por WHERE o.id = ${id}
    `;
    return jsonResponse({ ok: true, item: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT o.*, COALESCE(o.rank_autor, u.rank) AS rank_criador FROM observacoes o JOIN usuarios u ON u.id = o.criado_por WHERE o.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const acessoD = await nivelNaObra(sql, usuario, alvos[0].obra_id, "observacoes", env);
    if (!acessoD.obra) return semAcesso();
    if (!podeEditar(acessoD.nivel)) return soVisualizar(); // H5
    const autor = { id: alvos[0].criado_por, rank: alvos[0].rank_criador };
    if (!(await podeVerHistoricoOuApagar(usuario, autor))) {
      return jsonResponse({ ok: false, error: "só um superior do autor pode apagar esta observação" }, 403);
    }
    await sql`DELETE FROM observacoes WHERE id = ${id}`;
    await registrarEvento(sql, usuario, { obraId: alvos[0].obra_id, categoria: "observacoes", acao: "apagou", alvoId: Number(id), texto: `apagou uma observação: "${String(alvos[0].texto).slice(0, 60)}"`, afetadoId: alvos[0].criado_por });
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
