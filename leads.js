import { sql } from "./lib/db.js";

// Endpoint público (sin login) para el formulario de captación de leads (QR de la expo).
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "dados inválidos" }), { status: 400 });
  }

  const { nome, empresa, contato } = body;
  if (!nome || !nome.trim() || !contato || !contato.trim()) {
    return new Response(JSON.stringify({ ok: false, error: "nome e contato são obrigatórios" }), { status: 400 });
  }

  await sql`
    INSERT INTO leads (nome, empresa, contato)
    VALUES (${nome.trim()}, ${(empresa || "").trim()}, ${contato.trim()})
  `;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/leads" };
