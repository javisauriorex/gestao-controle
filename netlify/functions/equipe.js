import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, getNivel, nivelEfetivo, podeAsignarRank, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const nivel = nivelEfetivo(await getNivel(usuario.empresa_id, usuario.rank, "equipe"), usuario.excecao_modulos, "equipe");

  if (req.method === "GET") {
    if (nivel === "nenhum") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank, u.excecao_modulos FROM equipe e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.obra_id = ${obraId}
      ORDER BY e.id
    `;
    return jsonResponse({ ok: true, equipe });
  }

  if (req.method === "POST") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, email, rank, funcao } = await req.json();
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
      return jsonResponse({ ok: false, error: "não pode atribuir um rank melhor (número menor) que o próprio" }, 403);
    }
    const rows = await sql`
      INSERT INTO convites (empresa_id, email, rank, funcao, obra_id, criado_por)
      VALUES (${usuario.empresa_id}, ${emailNorm}, ${rank}, ${funcao || ""}, ${obraId}, ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, convite: rows[0] });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    const body = await req.json();

    if (body.excecaoModulos !== undefined) {
      if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
      const alvos = await sql`
        SELECT e.*, u.rank as rank_membro FROM equipe e JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ${id}
      `;
      if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      if (!podeModificar(usuario, alvos[0].rank_membro, alvos[0].usuario_id)) {
        return jsonResponse({ ok: false, error: "sem permissão" }, 403);
      }
      const rows = await sql`
        UPDATE usuarios SET excecao_modulos = ${JSON.stringify(body.excecaoModulos)}
        WHERE id = ${alvos[0].usuario_id}
        RETURNING *
      `;
      return jsonResponse({ ok: true, usuario: rows[0] });
    }

    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { data } = body;
    const alvos = await sql`SELECT * FROM equipe WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const atual = alvos[0];
    const asistencias = Array.isArray(atual.asistencias) ? atual.asistencias : [];
    const tem = asistencias.includes(data);
    const novas = tem ? asistencias.filter((d) => d !== data) : [...asistencias, data];
    const rows = await sql`UPDATE equipe SET asistencias = ${JSON.stringify(novas)} WHERE id = ${id} RETURNING *`;
    return jsonResponse({ ok: true, equipe: rows[0] });
  }

  if (req.method === "DELETE") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
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
};

export const config = { path: "/api/equipe" };
