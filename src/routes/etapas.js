import { getSql } from "../lib/db.js";
import { registrarEvento } from "../lib/eventos.js";
import { getUsuario, jsonResponse, podeModificar, ehSuperior } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeEditar, semAcesso, soVisualizar, obraDoRegistro } from "../lib/acesso.js";
import { apagarDoKV } from "../lib/arquivos.js";

// Etapas:
//  - Ver / criar / marcar concluída: nível do módulo (tela de Permissões + bloqueio por obra).
//  - Marcar concluída NÃO exige ser o autor: quem executa a etapa costuma ser de rank abaixo de quem a criou.
//  - Desmarcar: só quem concluiu ou um superior dele. Apagar: não leva junto o que é de um igual/superior.
//  - Mudar o texto ou apagar: só o autor ou um superior dele.
export default async function etapasHandler(req, env, ctx) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeVer(nivel)) return jsonResponse({ ok: true, etapas: [] });
    const etapas = await sql`
      SELECT e.*, u.nome AS concluida_por_nome FROM etapas e
      LEFT JOIN usuarios u ON u.id = e.concluida_por
      WHERE e.obra_id = ${obraId} ORDER BY e.id
    `;
    return jsonResponse({ ok: true, etapas });
  }

  if (req.method === "POST") {
    const { obraId, parentId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    // S12: a etapa-mãe tem que ser desta mesma obra (antes dava para pendurar sub-etapa em obra alheia).
    if (parentId && (await obraDoRegistro(sql, "etapas", parentId)) !== Number(obraId)) {
      return jsonResponse({ ok: false, error: "etapa-mãe inválida" }, 400);
    }
    const rows = await sql`
      INSERT INTO etapas (obra_id, parent_id, texto, criado_por, rank_autor)
      VALUES (${obraId}, ${parentId || null}, ${texto}, ${usuario.id}, ${usuario.rank})
      RETURNING *
    `;
    await registrarEvento(sql, usuario, { env, ctx }, { obraId: Number(obraId), categoria: "etapas", acao: "criou", alvoId: rows[0].id, texto: `criou a etapa "${String(texto).slice(0, 80)}"` });
    return jsonResponse({ ok: true, etapa: rows[0] });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    const body = await req.json();
    const obraId = await obraDoRegistro(sql, "etapas", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const atuais = await sql`
      SELECT e.*, COALESCE(e.rank_autor, u.rank) as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;

    if (body.texto !== undefined) {
      if (!podeModificar(usuario, atuais[0].rank_criador, atuais[0].criado_por)) {
        return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode mudar o texto" }, 403);
      }
      const rows = await sql`UPDATE etapas SET texto = ${body.texto} WHERE id = ${id} RETURNING *`;
      await registrarEvento(sql, usuario, { env, ctx }, { obraId, categoria: "etapas", acao: "editou", alvoId: Number(id), texto: `renomeou a etapa "${String(atuais[0].texto).slice(0, 60)}" para "${String(body.texto).slice(0, 60)}"`, afetadoId: atuais[0].criado_por });
      return jsonResponse({ ok: true, etapa: rows[0] });
    }

    // Concluída é um check simples, independente das fotos (que vivem em etapa_fotos).
    // H2: DESmarcar só quem concluiu ou um superior de quem concluiu (o Profissional não desfaz o "✓" do Mestre).
    if (!body.concluida && atuais[0].concluida && atuais[0].concluida_por && atuais[0].concluida_por !== usuario.id) {
      const quem = await sql`SELECT rank FROM usuarios WHERE id = ${atuais[0].concluida_por}`;
      if (quem.length && !ehSuperior(usuario, quem[0].rank, atuais[0].concluida_por)) {
        return jsonResponse({ ok: false, error: "só quem concluiu esta etapa (ou um superior dele) pode desmarcar" }, 403);
      }
    }
    const rows = await sql`
      UPDATE etapas SET
        concluida = ${!!body.concluida},
        concluida_por = ${body.concluida ? usuario.id : null},
        concluida_em = ${body.concluida ? new Date().toISOString() : null}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!!body.concluida !== !!atuais[0].concluida) {
      await registrarEvento(sql, usuario, { env, ctx }, body.concluida
        ? { obraId, categoria: "etapas", acao: "concluiu", alvoId: Number(id), texto: `concluiu a etapa "${String(atuais[0].texto).slice(0, 80)}"`, afetadoId: atuais[0].criado_por }
        : { obraId, categoria: "etapas", acao: "desmarcou", alvoId: Number(id), texto: `desmarcou a conclusão de "${String(atuais[0].texto).slice(0, 80)}"`, afetadoId: atuais[0].concluida_por });
    }
    return jsonResponse({ ok: true, etapa: { ...rows[0], concluida_por_nome: body.concluida ? usuario.nome : null } });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const obraId = await obraDoRegistro(sql, "etapas", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const alvos = await sql`
      SELECT e.*, COALESCE(e.rank_autor, u.rank) as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode apagar" }, 403);
    }
    // H3: apagar a etapa leva junto sub-etapas e fotos. Se alguma delas é de um igual ou superior
    // (que não seja você), não apaga: essa pessoa (ou um superior dela) tem que apagar antes.
    const protegidos = await sql`
      WITH RECURSIVE arvore AS (
        SELECT id FROM etapas WHERE id = ${id}
        UNION ALL SELECT e.id FROM etapas e JOIN arvore a ON e.parent_id = a.id
      )
      SELECT e.criado_por, COALESCE(e.rank_autor, u.rank) AS rank_autor FROM etapas e JOIN arvore a ON a.id = e.id JOIN usuarios u ON u.id = e.criado_por WHERE e.id <> ${id}
      UNION ALL
      SELECT f.criado_por, COALESCE(f.rank_autor, u.rank) FROM etapa_fotos f JOIN arvore a ON a.id = f.etapa_id JOIN usuarios u ON u.id = f.criado_por
    `;
    if (protegidos.some((p) => p.criado_por !== usuario.id && !ehSuperior(usuario, p.rank_autor, p.criado_por))) {
      return jsonResponse({ ok: false, error: "esta etapa tem sub-etapas ou fotos de alguém do seu nível ou acima: peça para essa pessoa apagar primeiro" }, 403);
    }
    // Fotos da etapa e das sub-etapas (que o banco apaga em cascata) também saem do armazenamento.
    const arquivos = await sql`
      WITH RECURSIVE arvore AS (
        SELECT id, foto_conclusao_id FROM etapas WHERE id = ${id}
        UNION ALL SELECT e.id, e.foto_conclusao_id FROM etapas e JOIN arvore a ON e.parent_id = a.id
      )
      SELECT f.arquivo_id FROM etapa_fotos f JOIN arvore a ON a.id = f.etapa_id
      UNION SELECT foto_conclusao_id FROM arvore WHERE foto_conclusao_id IS NOT NULL
    `;
    await sql`DELETE FROM etapas WHERE id = ${id}`;
    await registrarEvento(sql, usuario, { env, ctx }, { obraId, categoria: "etapas", acao: "apagou", alvoId: Number(id), texto: `apagou a etapa "${String(alvos[0].texto).slice(0, 80)}"`, afetadoId: alvos[0].criado_por });
    await apagarDoKV(env, arquivos.map((r) => r.arquivo_id));
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
