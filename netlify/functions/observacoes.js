import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, getNivel, nivelEfetivo, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const nivel = nivelEfetivo(await getNivel(usuario.empresa_id, usuario.rank, "observacoes"), usuario.excecao_modulos, "observacoes");

  if (req.method === "GET") {
    if (nivel === "nenhum") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const itens = await sql`SELECT * FROM observacoes WHERE obra_id = ${obraId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, observacoes: itens });
  }

  if (req.method === "POST") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const rows = await sql`
      INSERT INTO observacoes (obra_id, texto, criado_por) VALUES (${obraId}, ${texto}, ${usuario.id}) RETURNING *
    `;
    return jsonResponse({ ok: true, item: rows[0] });
  }

  if (req.method === "DELETE") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT o.*, u.rank as rank_criador FROM observacoes o JOIN usuarios u ON u.id = o.criado_por WHERE o.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "não pode apagar o que um escalão superior criou" }, 403);
    }
    await sql`DELETE FROM observacoes WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/observacoes" };
