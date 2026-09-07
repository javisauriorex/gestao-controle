import { jsonResponse } from "../lib/auth.js";

export default async function arquivoGetHandler(req, env) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${env.APP_TOKEN}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    // KV devuelve el valor ya parseado directamente (a diferencia de R2, que devuelve un objeto).
    const payload = await env.ARQUIVOS.get(id, "json");
    if (payload === null) return jsonResponse({ ok: false, error: "not_found" }, 404);
    return jsonResponse({ ok: true, payload });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
}
