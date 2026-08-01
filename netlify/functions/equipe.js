import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, getNivel, podeAsignarRank, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const nivel = await getNivel(usuario.empresa_id, usuario.rank, "equipe");

  if (req.method === "GET") {
    if (nivel === "nenhum") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank FROM equipe e
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
    // Marcar/desmarcar presença de hoje.
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const { data } = await req.json();
    const alvos = await sql`SELECT * FROM equipe WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const atual = alvos[0];
    const asistencias = Array.isArray(atual.asistencias) ?
