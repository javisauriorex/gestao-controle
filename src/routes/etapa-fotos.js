import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeModificar } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeEditar, semAcesso, soVisualizar, obraDoRegistro } from "../lib/acesso.js";
import { apagarDoKV } from "../lib/arquivos.js";

// Galeria de fotos de avanço por etapa — livre, várias fotos, independente do check "concluída".
// Usa o nível do módulo "etapas".
export default async function etapaFotosHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const etapaId = url.searchParams.get("etapa_id");
    let obraId = url.searchParams.get("obra_id");
    if (!obraId && etapaId) obraId = await obraDoRegistro(sql, "etapa", etapaId);
    if (!obraId) return jsonResponse({ ok: false, error: "etapa_id ou obra_id é obrigatório" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeVer(nivel)) return jsonResponse({ ok: true, fotos: [] });
    if (!etapaId) {
      // Todas as fotos de todas as etapas da obra de uma vez — usado pelo polling de notificações.
      const fotos = await sql`
        SELECT ef.* FROM etapa_fotos ef
        JOIN etapas e ON e.id = ef.etapa_id
        WHERE e.obra_id = ${obraId}
        ORDER BY ef.id DESC
      `;
      return jsonResponse({ ok: true, fotos });
    }
    const fotos = await sql`SELECT * FROM etapa_fotos WHERE etapa_id = ${etapaId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, fotos });
  }

  if (req.method === "POST") {
    const { etapaId, arquivoId } = await req.json();
    if (!etapaId || !arquivoId) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const obraId = await obraDoRegistro(sql, "etapa", etapaId);
    if (!obraId) return jsonResponse({ ok: false, error: "etapa não encontrada" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    // Só dá para vincular um arquivo que VOCÊ acabou de enviar (impede anexar arquivo alheio para lê-lo).
    const meta = (await env.ARQUIVOS.getWithMetadata(arquivoId, "text")).metadata;
    if (!meta || meta.por !== usuario.id) return jsonResponse({ ok: false, error: "arquivo inválido" }, 400);
    const rows = await sql`
      INSERT INTO etapa_fotos (etapa_id, arquivo_id, criado_por, rank_autor) VALUES (${etapaId}, ${arquivoId}, ${usuario.id}, ${usuario.rank}) RETURNING *
    `;
    return jsonResponse({ ok: true, foto: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    const obraId = await obraDoRegistro(sql, "etapa_fotos", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const alvos = await sql`
      SELECT f.*, COALESCE(f.rank_autor, u.rank) as rank_criador FROM etapa_fotos f JOIN usuarios u ON u.id = f.criado_por WHERE f.id = ${id}
    `;
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode apagar" }, 403);
    }
    await sql`DELETE FROM etapa_fotos WHERE id = ${id}`;
    await apagarDoKV(env, [alvos[0].arquivo_id]);
    return jsonResponse({ ok: true, arquivoId: alvos[0].arquivo_id });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
