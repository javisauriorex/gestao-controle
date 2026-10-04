import { jsonResponse } from "../lib/auth.js";

// GET /api/google-config — o "Client ID" do Google é público (aparece em qualquer tela de login do Google).
// O navegador usa para o "Drive Backup" do Dono. O segredo (GOOGLE_CLIENT_SECRET) nunca sai do servidor.
export default async function googleConfig(req, env) {
  if (req.method !== "GET") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  return jsonResponse({ ok: true, clientId: env.GOOGLE_CLIENT_ID || null });
}
