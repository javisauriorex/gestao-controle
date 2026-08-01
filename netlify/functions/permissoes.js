import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    const permissoes = await sql`
      SELECT * FROM permissoes WHERE empresa_id = ${usuario.empresa_id} ORDER BY rank, modulo
    `;
    return jsonResponse({ ok: true, permissoes });
  }

  if (req.method === "PATCH") {
    // Acesso fixo por código (rank 1-4), NUNCA consultado na própria tabela —
    // assim é impossível alguém se autobloquear editando a matriz.
    if (usuario.rank > 4) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { rank, modulo, nivel } = await req.json();
    if (!rank || !modulo || !nivel) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    if (!["nenhum", "visualizar", "editar"].includes(nivel)) {
      return jsonResponse({ ok: false, error: "nível inválido" }, 400);
    }
    const rows = await sql`
      INSERT INTO permissoes (empresa_id, rank, modulo, nivel)
      VALUES (${usuario.empresa_id}, ${rank}, ${modulo}, ${nivel})
      ON CONFLICT (empresa_id, rank, modulo) DO UPDATE SET nivel = ${nivel}
      RETURNING *
    `;
    return jsonResponse({ ok: true, permissao: rows[0] });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/permissoes" };
