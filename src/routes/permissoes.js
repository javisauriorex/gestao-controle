import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, MODULOS_PERMISSAO, NIVEIS } from "../lib/auth.js";

export default async function permissoesHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

  if (req.method === "GET") {
    const permissoes = await sql`
      SELECT * FROM permissoes WHERE empresa_id = ${usuario.empresa_id} ORDER BY rank, modulo
    `;
    return jsonResponse({ ok: true, permissoes });
  }

  if (req.method === "PATCH") {
    // Só Dono e Eng. Chefe (rank 1-2) mexem na tabela de permissões (o Estagiário não — decisão 04/10),
    // e cada um só altera as linhas dos ranks ABAIXO do seu (nunca a de um superior nem a própria).
    if (usuario.rank > 2) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { rank, modulo, nivel } = await req.json();
    const r = Number(rank);
    // H9: valida tudo antes de gravar.
    if (!Number.isInteger(r) || r < 1 || r > 8) return jsonResponse({ ok: false, error: "rank inválido" }, 400);
    if (!MODULOS_PERMISSAO.includes(modulo)) return jsonResponse({ ok: false, error: "módulo inválido" }, 400);
    if (!NIVEIS.includes(nivel)) return jsonResponse({ ok: false, error: "nível inválido" }, 400);
    if (nivel === "receber" && !["ferramentas", "materiais"].includes(modulo)) {
      return jsonResponse({ ok: false, error: "\"receber\" só existe em Ferramentas e Materiais" }, 400);
    }
    if (r <= usuario.rank) {
      return jsonResponse({ ok: false, error: "só pode alterar permissões de ranks abaixo do seu" }, 403);
    }
    const rows = await sql`
      INSERT INTO permissoes (empresa_id, rank, modulo, nivel)
      VALUES (${usuario.empresa_id}, ${r}, ${modulo}, ${nivel})
      ON CONFLICT (empresa_id, rank, modulo) DO UPDATE SET nivel = ${nivel}
      RETURNING *
    `;
    return jsonResponse({ ok: true, permissao: rows[0] });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
