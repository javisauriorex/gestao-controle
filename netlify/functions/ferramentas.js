import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, getNivel, nivelEfetivo, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const nivel = nivelEfetivo(await getNivel(usuario.empresa_id, usuario.rank, "ferramentas"), usuario.excecao_modulos, "ferramentas");

  if (req.method === "GET") {
    if (nivel === "nenhum") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const itens = await sql`SELECT * FROM ferramentas WHERE obra_id = ${obraId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, ferramentas: itens });
  }

  if (req.method === "POST") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const rows = await sql`
      INSERT INTO ferramentas (obra_id, texto, criado_por) VALUES (${obraId}, ${texto}, ${usuario.id}) RETURNING *
    `;
    return jsonResponse({ ok: true, item: rows[0] });
  }

  if (req.method === "DELETE") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT f.
