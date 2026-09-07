import { getSql } from "../lib/db.js";
import { jsonResponse } from "../lib/auth.js";

// Endpoint público (sin login) para el formulario de captación de leads (QR de la expo).
export default async function leadsHandler(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "dados inválidos" }, 400);
  }

  const { nome, empresa, contato } = body;
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
