import { getSql } from "../lib/db.js";
import { jsonResponse } from "../lib/auth.js";
import { turnstileOk, MSG_TURNSTILE } from "../lib/turnstile.js";

// Endpoint público (sin login) para el formulario de captación de leads (QR de la expo).
export default async function leadsHandler(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "dados inválidos" }, 400);
  }

  const { nome, empresa, contato, turnstile } = body;
  if (!(await turnstileOk(env, req, turnstile))) return jsonResponse({ ok: false, codigo: "turnstile", error: MSG_TURNSTILE }, 403);
  if (typeof nome !== "string" || typeof contato !== "string" || nome.length > 120 || contato.length > 120 || String(empresa || "").length > 120) {
    return jsonResponse({ ok: false, error: "dados inválidos" }, 400);
  }
  if (!nome || !nome.trim() || !contato || !contato.trim()) {
    return jsonResponse({ ok: false, error: "nome e contato são obrigatórios" }, 400);
  }

  const sql = getSql(env);
  await sql`
    INSERT INTO leads (nome, empresa, contato)
    VALUES (${nome.trim()}, ${(empresa || "").trim()}, ${contato.trim()})
  `;

  return jsonResponse({ ok: true });
}
