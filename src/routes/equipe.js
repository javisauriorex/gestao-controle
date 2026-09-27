import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeAsignarRank, podeModificar } from "../lib/auth.js";

export default async function equipeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) {
      // Sem obra_id: devolve todo mundo da empresa (usado pra escolher responsável
      // em qualquer obra, mesmo que a pessoa ainda não esteja na equipe dessa obra específica).
      const todos = await sql`
        SELECT id as usuario_id, email, nome, rank FROM usuarios WHERE empresa_id = ${usuario.empresa_id} ORDER BY nome
      `;
      return jsonResponse({ ok: true, equipe: todos });
    }
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank, u.excecao_modulos FROM equipe e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.obra_id = ${obraId}
      ORDER BY e.id
    `;
    return jsonResponse({ ok: true, equipe });
  }

  if (req.method === "POST") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, email, rank, funcao, usuarioId } = await req.json();

    // Adicionar alguém que JÁ é da empresa (inclusive quem entra com CPF, sem email)
    if (obraId && usuarioId) {
      const pessoas = await sql`SELECT * FROM usuarios WHERE id = ${usuarioId} AND empresa_id = ${usuario.empresa_id}`;
      if (pessoas.length === 0) return jsonResponse({ ok: false, error: "pessoa não encontrada na empresa" }, 404);
      const p = pessoas[0];
      const rows = await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${obraId}, ${p.id}, ${funcao || ""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO UPDATE SET funcao = ${funcao || ""}
        RETURNING *
      `;
      return jsonResponse({ ok: true, equipe: { ...rows[0], email: p.email, nome: p.nome, rank: p.rank, excecao_modulos: p.excecao_modulos }, convite: false });
    }

    if (!obraId || !email) return jsonResponse({ ok: false, error: "faltam dados" }, 400);

    const emailNorm = email.toLowerCase();
    const existentes = await sql`SELECT * FROM usuarios WHERE email = ${emailNorm}`;

    if (existentes.length > 0) {
      const membro = existentes[0];
      if (membro.empresa_id !== usuario.empresa_id) {
        return jsonResponse({ ok: false, error: "este email já pertence a outra empresa" }, 409);
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
      return jsonResponse({ ok: false, error: "não pode atribuir um rank maior que o próprio" }, 403);
    }
    // Todo convite por email também ganha um link (token), pra poder mandar por WhatsApp.
    // Sem o link (ou o Google), ninguém consegue reclamar o convite só digitando o email.
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

    // Editar integrante: rank (vale para todas as obras), função (desta obra) e bloqueio de módulos
    if (data === undefined) {
      if (usuario.rank > 2) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
      const pessoas = await sql`SELECT * FROM usuarios WHERE id = ${atual.usuario_id} AND empresa_id = ${usuario.empresa_id}`;
      if (pessoas.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      const alvo = pessoas[0];
      const mexeNaPessoa = body.rank !== undefined || body.excecaoModulos !== undefined;
      if (mexeNaPessoa && (alvo.id === usuario.id || alvo.rank <= usuario.rank)) {
        return jsonResponse({ ok: false, error: "só pode alterar quem está abaixo do seu rank" }, 403);
      }
      if (body.rank !== undefined) {
        const novo = Number(body.rank);
        if (!(novo >= 2 && novo <= 8) || novo <= usuario.rank) {
          return jsonResponse({ ok: false, error: "rank inválido: tem que ser abaixo do seu" }, 400);
        }
        await sql`UPDATE usuarios SET rank = ${novo} WHERE id = ${alvo.id}`;
      }
      if (body.excecaoModulos !== undefined) {
        await sql`UPDATE usuarios SET excecao_modulos = ${body.excecaoModulos ? JSON.stringify(body.excecaoModulos) : null} WHERE id = ${alvo.id}`;
      }
      if (body.funcao !== undefined) {
        await sql`UPDATE equipe SET funcao = ${String(body.funcao || "").trim()} WHERE id = ${id}`;
      }
      const membros = await sql`
        SELECT e.*, u.email, u.nome, u.rank, u.excecao_modulos FROM equipe e
        JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ${id}
      `;
      return jsonResponse({ ok: true, membro: membros[0], usuario: { excecao_modulos: membros[0].excecao_modulos } });
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
    if (!podeModificar(usuario, alvos[0].rank_membro, alvos[0].usuario_id)) {
      return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    }
    await sql`DELETE FROM equipe WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
