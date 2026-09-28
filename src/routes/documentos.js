import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeModificar } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeEditar, semAcesso, soVisualizar, obraDoRegistro } from "../lib/acesso.js";

export default async function documentosHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "documentos", env);
    if (!obra) return semAcesso();
    if (!podeVer(nivel)) return jsonResponse({ ok: true, documentos: [] });
    const documentos = await sql`SELECT * FROM documentos WHERE obra_id = ${obraId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, documentos });
  }

  if (req.method === "POST") {
    const { obraId, nome, tipo, arquivoId } = await req.json();
    if (!obraId || !nome || !arquivoId) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "documentos", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const rows = await sql`
      INSERT INTO documentos (obra_id, nome, tipo, arquivo_id, criado_por)
      VALUES (${obraId}, ${nome}, ${tipo || ""}, ${arquivoId}, ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, documento: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const obraId = await obraDoRegistro(sql, "documentos", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "documentos", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const alvos = await sql`
      SELECT d.*, u.rank as rank_criador FROM documentos d JOIN usuarios u ON u.id = d.criado_por WHERE d.id = ${id}
    `;
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode apagar" }, 403);
    }
    await sql`DELETE FROM documentos WHERE id = ${id}`;
    return jsonResponse({ ok: true, arquivoId: alvos[0].arquivo_id });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
