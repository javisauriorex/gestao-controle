import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeModificar } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeEditar, semAcesso, soVisualizar, obraDoRegistro } from "../lib/acesso.js";

// Permissões: vale o que a tela de Permissões define para o rank (+ bloqueio por obra).
// Apagar: além de "editar", tem que ser o autor ou alguém de rank acima dele.
export default async function ferramentasHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "ferramentas", env);
    if (!obra) return semAcesso();
    if (!podeVer(nivel)) return jsonResponse({ ok: true, ferramentas: [] }); // sem acesso ao módulo: lista vazia (não quebra a abertura da obra)
    const itens = await sql`SELECT * FROM ferramentas WHERE obra_id = ${obraId} ORDER BY id DESC`;
    return jsonResponse({ ok: true, ferramentas: itens });
  }

  if (req.method === "POST") {
    const { obraId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "ferramentas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const rows = await sql`
      INSERT INTO ferramentas (obra_id, texto, criado_por, rank_autor) VALUES (${obraId}, ${texto}, ${usuario.id}, ${usuario.rank}) RETURNING *
    `;
    return jsonResponse({ ok: true, item: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const obraId = await obraDoRegistro(sql, "ferramentas", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "ferramentas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const alvos = await sql`
      SELECT f.*, COALESCE(f.rank_autor, u.rank) as rank_criador FROM ferramentas f JOIN usuarios u ON u.id = f.criado_por WHERE f.id = ${id}
    `;
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode apagar" }, 403);
    }
    await sql`DELETE FROM ferramentas WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
