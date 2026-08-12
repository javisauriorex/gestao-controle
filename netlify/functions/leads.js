import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse } from "./lib/auth.js";

export default async (req) => {
  // POST: público (sin login) — es lo que usa o formulário do QR code na expo.
  if (req.method === "POST") {
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
  }

  // GET: protegido — só quem tem esse e-mail específico pode ver a lista de leads.
  if (req.method === "GET") {
    const usuario = await getUsuario(req);
    if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    // OJO: "rank 1" existe em CADA empresa (é multiempresa por design) — checar só o rank
    // deixaria qualquer tester que se cadastre sozinho (vira Dono da própria empresa) ver
    // os leads reais da expo. Por isso amarra ao seu e-mail específico, não ao rank.
    const EMAIL_DONO_DO_NEGOCIO = "marcelojavierbonet@gmail.com";
    if (usuario.email !== EMAIL_DONO_DO_NEGOCIO) return jsonResponse({ ok: false, error: "sem permissão" }, 403);

    const leads = await sql`SELECT * FROM leads ORDER BY criado_em DESC`;
    return jsonResponse({ ok: true, leads });
  }

  return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405 });
};

export const config = { path: "/api/leads" };
