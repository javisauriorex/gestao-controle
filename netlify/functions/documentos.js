import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const documentos = await sql`SELECT * FROM documentos WHERE obra_id = ${obraId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, documentos });
  }

  if (req.method === "POST") {
    // Todos menos Profissional pueden subir/editar documentos.
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, nome, tipo, arquivoId } = await req.json();
    if (!obraId || !nome || !arquivoId) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const rows = await sql`
      INSERT INTO documentos (obra_id, nome, tipo, arquivo_id, criado_por)
      VALUES (${obraId}, ${nome}, ${tipo || ""}, ${arquivoId}, ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, documento: rows[0] });
  }

  if (req.method === "DELETE") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT d.*, u.rank as rank_criador FROM documentos d JOIN usuarios u ON u.id = d.criado_por WHERE d.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario.rank, alvos[0].rank_criador)) {
      return jsonResponse({ ok: false, error: "não pode apagar o que um escalão superior carregou" }, 403);
    }
    await sql`DELETE FROM documentos WHERE id = ${id}`;
    // Nota: el archivo real en Blobs se borra aparte, llamando a arquivo-delete con ese arquivo_id.
    return jsonResponse({ ok: true, arquivoId: alvos[0].arquivo_id });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/documentos" };
