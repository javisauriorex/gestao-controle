import { jsonResponse } from "../lib/auth.js";

export default async function arquivoGetHandler(req, env) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${env.APP_TOKEN}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    // Devolve como texto cru — o frontend faz o próprio JSON.parse(data.payload).
    // Se a gente parseia aqui também, o frontend recebe um objeto e quebra ao
    // tentar fazer JSON.parse em cima de um objeto (não uma string).
    const payload = await env.ARQUIVOS.get(id, "text");
    if (payload === null) return jsonResponse({ ok: false, error: "not_found" }, 404);
    return jsonResponse({ ok: true, payload });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e) }, 500);
  }
}
