import { jsonResponse } from "../lib/auth.js";

export default async function arquivoSetHandler(req, env) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${env.APP_TOKEN}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  try {
    const { id, payload } = await req.json();
    if (!id || !payload) return jsonResponse({ ok: false, error: "id e payload são obrigatórios" }, 400);
    await env.ARQUIVOS.put(id, JSON.stringify(payload));
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
}
