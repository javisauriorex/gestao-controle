import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const itens = await sql`SELECT * FROM materiais WHERE obra_id = ${obraId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, materiais: itens });
  }

  if (req.method === "POST") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const rows = await sql`
      INSERT INTO materiais (obra_id, texto, criado_por) VALUES (${obraId}, ${texto}, ${usuario.id}) RETURNING *
    `;
    return jsonResponse({ ok: true, item: rows[0] });
  }

  if (req.method === "DELETE") {
    if (!podeCrear(3, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT m.*, u.rank as rank_criador FROM materiais m JOIN usuarios u ON u.id = m.criado_por WHERE m.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario.rank, alvos[0].rank_criador)) {
      return jsonResponse({ ok: false, error: "não pode apagar o que um escalão superior criou" }, 403);
    }
    await sql`DELETE FROM materiais WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/materiais" };
