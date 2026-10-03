import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeAsignarRank, podeModificar } from "../lib/auth.js";
import { nivelNaObra, podeVer } from "../lib/acesso.js";

// Data de hoje no Brasil (AAAA-MM-DD), para a presença marcada pela própria pessoa.
function diaBR(deslocDias = 0) {
  return new Date(Date.now() + deslocDias * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Equipe de uma obra.
//  - Adicionar/convidar: Dono até Encarregado (rank 1-5), só para ranks abaixo do próprio.
//  - Rank (vale para todas as obras): só Dono/Eng. Chefe, para quem está abaixo — e Eng. Chefe também edita outro Eng. Chefe.
//  - Função (desta obra): Dono/Eng. Chefe ou o responsável da obra.
//  - Bloqueio de módulos NESTA obra (⚙): SÓ o responsável da obra, e só para quem está abaixo dele.
//  - Quem teve a conta excluída aparece como "ausente" (removido_em preenchido).

async function obraDaEmpresa(sql, obraId, empresaId) {
  const r = await sql`SELECT id, responsavel_id FROM obras WHERE id = ${obraId} AND empresa_id = ${empresaId}`;
  return r[0] || null;
}

async function acessoAObra(sql, usuario, obraId) {
  const obra = await obraDaEmpresa(sql, obraId, usuario.empresa_id);
  if (!obra) return null;
  if (usuario.rank <= 2) return obra;
  const m = await sql`SELECT 1 FROM equipe WHERE obra_id = ${obraId} AND usuario_id = ${usuario.id}`;
  return m.length ? obra : null;
}


export default async function equipeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) {
      // Sem obra_id: todo mundo ATIVO da empresa (pra escolher responsável ou "Da empresa").
      const todos = await sql`
        SELECT id as usuario_id, email, nome, rank FROM usuarios
        WHERE empresa_id = ${usuario.empresa_id} AND removido_em IS NULL
        ORDER BY nome
      `;
      // E-mails da empresa toda só para quem convida/gerencia (rank 1-5).
      if (usuario.rank > 5) todos.forEach((p) => { p.email = null; });
      return jsonResponse({ ok: true, equipe: todos });
    }
    if (!(await acessoAObra(sql, usuario, obraId))) return jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank, u.removido_em FROM equipe e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.obra_id = ${obraId}
      ORDER BY u.removido_em NULLS FIRST, e.id
    `;
    // Sem acesso ao módulo Equipe (ex.: Almoxarife, Profissional): a lista vem (precisa dela para pedidos),
    // mas sem e-mails, presença e bloqueios dos outros (S10).
    const { nivel } = await nivelNaObra(sql, usuario, obraId, "equipe", env);
    if (!podeVer(nivel)) {
      equipe.forEach((m) => {
        if (m.usuario_id === usuario.id) return;
        m.email = null; m.asistencias = []; m.excecao_modulos = null;
      });
    }
    return jsonResponse({ ok: true, equipe });
  }

  if (req.method === "POST") {
    if (!podeCrear(5, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, email, rank, funcao, usuarioId } = await req.json();
    if (obraId && !(await acessoAObra(sql, usuario, obraId))) {
      return jsonResponse({ ok: false, error: "obra não encontrada ou você não está na equipe" }, 404);
    }

    // Adicionar alguém que JÁ é da empresa (inclusive quem entra com CPF, sem email)
    if (obraId && usuarioId) {
      const pessoas = await sql`
        SELECT * FROM usuarios WHERE id = ${usuarioId} AND empresa_id = ${usuario.empresa_id} AND removido_em IS NULL
      `;
      if (pessoas.length === 0) return jsonResponse({ ok: false, error: "pessoa não encontrada na empresa" }, 404);
      const p = pessoas[0];
      if (usuario.rank > 2 && p.rank <= usuario.rank) {
        return jsonResponse({ ok: false, error: "só pode adicionar pessoas de rank abaixo do seu" }, 403);
      }
      const rows = await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${obraId}, ${p.id}, ${funcao || ""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO UPDATE SET funcao = ${funcao || ""}
        RETURNING *
      `;
      return jsonResponse({ ok: true, equipe: { ...rows[0], email: p.email, nome: p.nome, rank: p.rank }, convite: false });
    }

    if (!obraId || !email) return jsonResponse({ ok: false, error: "faltam dados" }, 400);

    const emailNorm = email.toLowerCase();
    const existentes = await sql`SELECT * FROM usuarios WHERE email = ${emailNorm}`;

    if (existentes.length > 0) {
      const membro = existentes[0];
      if (membro.empresa_id !== usuario.empresa_id || membro.removido_em) {
        return jsonResponse({ ok: false, error: "este email já pertence a outra empresa" }, 409);
      }
      if (usuario.rank > 2 && membro.rank <= usuario.rank) {
        return jsonResponse({ ok: false, error: "só pode adicionar pessoas de rank abaixo do seu" }, 403);
      }
      const rows = await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${obraId}, ${membro.id}, ${funcao || ""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO UPDATE SET funcao = ${funcao || ""}
        RETURNING *
      `;
      return jsonResponse({ ok: true, equipe: { ...rows[0], email: membro.email, nome: membro.nome, rank: membro.rank }, convite: false });
    }

    if (!rank) return jsonResponse({ ok: false, error: "rank é obrigatório para convidar alguém novo" }, 400);
    if (!podeAsignarRank(usuario.rank, rank)) {
      return jsonResponse({ ok: false, error: "só pode convidar para um rank abaixo do seu" }, 403);
    }
    // Todo convite por email também ganha um link (token), pra poder mandar por WhatsApp.
    const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const token = [...tokenBytes].map((x) => x.toString(16).padStart(2, "0")).join("");
    const expira = new Date(Date.now() + 7 * 86400000).toISOString();
    const rows = await sql`
      INSERT INTO convites (empresa_id, email, nome, rank, funcao, obra_id, criado_por, token, expira_em)
      VALUES (${usuario.empresa_id}, ${emailNorm}, ${emailNorm.split("@")[0]}, ${rank}, ${funcao || ""}, ${obraId}, ${usuario.id}, ${token}, ${expira})
      RETURNING *
    `;
    return jsonResponse({ ok: true, convite: rows[0], token });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    const body = await req.json();
    const { data } = body;
    const alvos = await sql`SELECT * FROM equipe WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const atual = alvos[0];
    const obra = await acessoAObra(sql, usuario, atual.obra_id);
    if (!obra) return jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);

    // Editar integrante
    if (data === undefined) {
      const pessoas = await sql`SELECT * FROM usuarios WHERE id = ${atual.usuario_id} AND empresa_id = ${usuario.empresa_id}`;
      if (pessoas.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      const alvo = pessoas[0];
      const souResponsavel = obra.responsavel_id === usuario.id;
      const alvoAbaixo = alvo.id !== usuario.id && alvo.rank > usuario.rank;
      // Eng. Chefe também edita outro Eng. Chefe (par), mas nunca a si mesmo nem o Dono.
      const parChefe = usuario.rank === 2 && alvo.rank === 2 && alvo.id !== usuario.id;

      if (body.rank !== undefined) {
        if (usuario.rank > 2 || !(alvoAbaixo || parChefe)) return jsonResponse({ ok: false, error: "só Dono/Eng. Chefe mudam o rank, e só de quem está abaixo (ou outro Eng. Chefe)" }, 403);
        const novo = Number(body.rank);
        // Ninguém promove alguém ao próprio rank; o par Eng. Chefe só pode ser mantido em 2 ou rebaixado.
        const minimo = parChefe ? 2 : usuario.rank + 1;
        if (!(novo >= minimo && novo <= 8)) {
          return jsonResponse({ ok: false, error: "rank inválido" }, 400);
        }
      }
      if (body.excecaoModulos !== undefined && (!souResponsavel || !alvoAbaixo)) {
        return jsonResponse({ ok: false, error: "só o responsável da obra bloqueia módulos, e só de quem está abaixo dele" }, 403);
      }
      if (body.funcao !== undefined && usuario.rank > 2 && !souResponsavel) {
        return jsonResponse({ ok: false, error: "só Dono/Eng. Chefe ou o responsável da obra mudam a função" }, 403);
      }

      if (body.rank !== undefined) await sql`UPDATE usuarios SET rank = ${Number(body.rank)} WHERE id = ${alvo.id}`;
      if (body.excecaoModulos !== undefined) {
        await sql`UPDATE equipe SET excecao_modulos = ${body.excecaoModulos ? JSON.stringify(body.excecaoModulos) : null} WHERE id = ${id}`;
      }
      if (body.funcao !== undefined) await sql`UPDATE equipe SET funcao = ${String(body.funcao || "").trim()} WHERE id = ${id}`;

      const membros = await sql`
        SELECT e.*, u.email, u.nome, u.rank, u.removido_em FROM equipe e
        JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ${id}
      `;
      return jsonResponse({ ok: true, membro: membros[0] });
    }

    // Marcar presença do dia (S10):
    //  - a própria pessoa marca a SUA presença, só do dia (hoje, com 1 dia de folga por fuso horário);
    //  - os superiores com nível "editar" em Equipe marcam a de quem está abaixo deles, qualquer dia.
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return jsonResponse({ ok: false, error: "data inválida" }, 400);
    }
    if (atual.usuario_id === usuario.id) {
      if (![diaBR(-1), diaBR(0), diaBR(1)].includes(data)) {
        return jsonResponse({ ok: false, error: "você só marca a sua presença do dia de hoje" }, 403);
      }
    } else {
      const { nivel } = await nivelNaObra(sql, usuario, atual.obra_id, "equipe", env);
      const alvos2 = await sql`SELECT rank FROM usuarios WHERE id = ${atual.usuario_id}`;
      if (nivel !== "editar" || !alvos2.length || !(alvos2[0].rank > usuario.rank)) {
        return jsonResponse({ ok: false, error: "só um superior com acesso de edição à Equipe marca a presença de outra pessoa" }, 403);
      }
    }
    const asistencias = Array.isArray(atual.asistencias) ? atual.asistencias : [];
    const tem = asistencias.includes(data);
    const novas = tem ? asistencias.filter((d) => d !== data) : [...asistencias, data];
    const rows = await sql`UPDATE equipe SET asistencias = ${JSON.stringify(novas)} WHERE id = ${id} RETURNING *`;
    return jsonResponse({ ok: true, equipe: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    const alvos = await sql`
      SELECT e.*, u.rank as rank_membro FROM equipe e JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!(await acessoAObra(sql, usuario, alvos[0].obra_id))) return jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);
    if (!podeModificar(usuario, alvos[0].rank_membro, alvos[0].usuario_id)) {
      return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    }
    await sql`DELETE FROM equipe WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
