import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";

export default async function convitesHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    // S2: o link (token) NUNCA sai daqui — ele só aparece uma vez, para quem cria o convite.
    // Dono e Eng. Chefe veem todos os convites pendentes; os demais, só os que eles mesmos criaram.
    const convites = await sql`
      SELECT id, email, nome, rank, funcao, obra_id, criado_por, criado_em, expira_em,
             (usuario_id IS NOT NULL) AS novo_pin
      FROM convites
      WHERE empresa_id = ${usuario.empresa_id} AND aceito = false
        AND (${usuario.rank <= 2} OR criado_por = ${usuario.id})
      ORDER BY id DESC
    `;
    return jsonResponse({ ok: true, convites });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const alvos = await sql`SELECT * FROM convites WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (usuario.rank > 2) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    await sql`DELETE FROM convites WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
