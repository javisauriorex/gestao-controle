import { jsonResponse } from "../lib/auth.js";

export default async function arquivoDeleteHandler(req, env) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${env.APP_TOKEN}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    await env.ARQUIVOS.delete(id);
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
}
