import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";
import { vinculoDoArquivo } from "../lib/arquivos.js";

// Apagar direto só vale para arquivo ainda NÃO vinculado e enviado por você
// (ex.: upload que falhou no meio). Arquivos de fotos/documentos são apagados
// pelo servidor junto com o registro (DELETE de documentos / etapa-fotos / etapas / obras).
export default async function arquivoDeleteHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
  const sql = getSql(env);
  const { value, metadata } = await env.ARQUIVOS.getWithMetadata(id, "text");
  if (value === null) return jsonResponse({ ok: true }); // já não existe (normalmente o servidor já apagou)
  if (await vinculoDoArquivo(sql, id)) return jsonResponse({ ok: false, error: "arquivo vinculado: apague pelo registro" }, 403);
  if (!metadata || metadata.por !== usuario.id) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
  await env.ARQUIVOS.delete(id);
  return jsonResponse({ ok: true });
}
