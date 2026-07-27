import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse } from "./lib/auth.js";

// Nota: crear un convite se hace desde equipe.js (POST) cuando el email
// todavía no tiene cuenta. Esta Function es solo para listarlos/cancelarlos.
export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const convites = await sql`
      SELECT * FROM convites WHERE empresa_id = ${usuario.empresa_id} AND aceito = false ORDER BY id DESC
    `;
    return jsonResponse({ ok: true, convites });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const alvos = await sql`SELECT * FROM convites WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (usuario.rank < 2) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    await sql`DELETE FROM convites WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/convites" };
