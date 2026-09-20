import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeModificar } from "../lib/auth.js";

// Galeria de fotos de avanço por etapa — livre, várias fotos, independente do check "concluída".
export default async function etapaFotosHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const etapaId = url.searchParams.get("etapa_id");
    if (!etapaId) return jsonResponse({ ok: false, error: "etapa_id é obrigatório" }, 400);
    const fotos = await sql`SELECT * FROM etapa_fotos WHERE etapa_id = ${etapaId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, fotos });
  }

  if (req.method === "POST") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { etapaId, arquivoId } = await req.json();
    if (!etapaId || !arquivoId) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const rows = await sql`
      INSERT INTO etapa_fotos (etapa_id, arquivo_id, criado_por) VALUES (${etapaId}, ${arquivoId}, ${usuario.id}) RETURNING *
    `;
    return jsonResponse({ ok: true, foto: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    const alvos = await sql`
      SELECT f.*, u.rank as rank_criador FROM etapa_fotos f JOIN usuarios u ON u.id = f.criado_por WHERE f.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "não pode apagar o que um escalão superior enviou" }, 403);
    }
    await sql`DELETE FROM etapa_fotos WHERE id = ${id}`;
    return jsonResponse({ ok: true, arquivoId: alvos[0].arquivo_id });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
