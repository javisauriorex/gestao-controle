import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeCrear } from "../lib/auth.js";

export default async function obrasHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

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
    const { cliente, endereco, tipo, dataInicio, responsavelId } = await req.json();
    if (!cliente) return jsonResponse({ ok: false, error: "cliente é obrigatório" }, 400);
    const rows = await sql`
      INSERT INTO obras (empresa_id, cliente, endereco, tipo, data_inicio, estado, criado_por, responsavel_id)
      VALUES (${usuario.empresa_id}, ${cliente}, ${endereco || ""}, ${tipo || ""}, ${dataInicio || null}, 'ativa', ${usuario.id}, ${responsavelId || usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, obra: rows[0] });
  }

  if (req.method === "PATCH") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = new URL(req.url).searchParams.get("id");
    const {
      estado = null,
      novoResponsavelId = null,
      cliente = null,
      endereco = null,
      tipo = null,
    } = await req.json();
    // COALESCE: só atualiza os campos que vieram preenchidos, deixa o resto como estava.
    const rows = await sql`
      UPDATE obras SET
        estado = COALESCE(${estado}, estado),
        responsavel_id = COALESCE(${novoResponsavelId}, responsavel_id),
        cliente = COALESCE(${cliente}, cliente),
        endereco = COALESCE(${endereco}, endereco),
        tipo = COALESCE(${tipo}, tipo)
      WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}
      RETURNING *
    `;
    if (rows.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
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
}
