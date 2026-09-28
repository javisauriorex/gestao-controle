import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";

export default async function permissoesHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

  if (req.method === "GET") {
    const permissoes = await sql`
      SELECT * FROM permissoes WHERE empresa_id = ${usuario.empresa_id} ORDER BY rank, modulo
    `;
    return jsonResponse({ ok: true, permissoes });
  }

  if (req.method === "PATCH") {
    // Só Dono, Eng. Chefe e Eng. Estagiário (rank 1-3) mexem na tabela de permissões,
    // e cada um só altera as linhas dos ranks ABAIXO do seu (nunca a de um superior nem a própria).
    if (usuario.rank > 3) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { rank, modulo, nivel } = await req.json();
    if (!rank || !modulo || !nivel) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    if (Number(rank) <= usuario.rank) {
      return jsonResponse({ ok: false, error: "só pode alterar permissões de ranks abaixo do seu" }, 403);
    }
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
}
