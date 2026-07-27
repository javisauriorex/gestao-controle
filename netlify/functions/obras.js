import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, podeCrear } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    const obras =
      usuario.rank >= 5
        ? await sql`SELECT * FROM obras WHERE empresa_id = ${usuario.empresa_id} ORDER BY id DESC`
        : await sql`
            SELECT o.* FROM obras o
            JOIN equipe e ON e.obra_id = o.id
            WHERE o.empresa_id = ${usuario.empresa_id} AND e.usuario_id = ${usuario.id}
            ORDER BY o.id DESC
          `;
    return jsonResponse({ ok: true, obras });
  }

  if (req.method === "POST") {
    if (!podeCrear(4, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { cliente, endereco, tipo, dataInicio } = await req.json();
    if (!cliente) return jsonResponse({ ok: false, error: "cliente é obrigatório" }, 400);
    const rows = await sql`
      INSERT INTO obras (empresa_id, cliente, endereco, tipo, data_inicio, estado, criado_por)
      VALUES (${usuario.empresa_id}, ${cliente}, ${endereco || ""}, ${tipo || ""}, ${dataInicio || null}, 'ativa', ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, obra: rows[0] });
  }

  if (req.method === "DELETE") {
    if (!podeCrear(4, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    await sql`DELETE FROM obras WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/obras" };
