import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";
import { podeLerArquivo } from "../lib/arquivos.js";

export default async function arquivoGetHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
  const sql = getSql(env);
  // Devolve como texto cru — o frontend faz o próprio JSON.parse(data.payload).
  const { value, metadata } = await env.ARQUIVOS.getWithMetadata(id, "text");
  // Sem acesso responde igual a "não existe", para não revelar que o arquivo existe.
  if (value === null || !(await podeLerArquivo(sql, usuario, id, metadata, env))) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }
  return jsonResponse({ ok: true, payload: value });
}
