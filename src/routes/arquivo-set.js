import { jsonResponse } from "../lib/auth.js";

export default async function arquivoSetHandler(req, env) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${env.APP_TOKEN}`) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  try {
    const { id, payload } = await req.json();
    if (!id || !payload) return jsonResponse({ ok: false, error: "id e payload são obrigatórios" }, 400);
    // O frontend já manda `payload` como string JSON pronta (JSON.stringify feito lá).
    // Gravamos ela tal qual, sem stringify de novo — senão fica JSON dentro de JSON
    // e a leitura depois vem corrompida.
    await env.ARQUIVOS.put(id, payload);
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message || e) }, 500);
  }
}
