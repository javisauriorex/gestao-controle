import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeModificar } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeEditar, semAcesso, soVisualizar, obraDoRegistro } from "../lib/acesso.js";

// Etapas:
//  - Ver / criar / marcar concluída: nível do módulo (tela de Permissões + bloqueio por obra).
//  - Marcar concluída NÃO exige ser o autor: quem executa a etapa costuma ser de rank abaixo de quem a criou.
//  - Mudar o texto ou apagar: só o autor ou um superior dele.
export default async function etapasHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeVer(nivel)) return jsonResponse({ ok: true, etapas: [] });
    const etapas = await sql`
      SELECT e.*, u.nome AS concluida_por_nome FROM etapas e
      LEFT JOIN usuarios u ON u.id = e.concluida_por
      WHERE e.obra_id = ${obraId} ORDER BY e.id
    `;
    return jsonResponse({ ok: true, etapas });
  }

  if (req.method === "POST") {
    const { obraId, parentId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const rows = await sql`
      INSERT INTO etapas (obra_id, parent_id, texto, criado_por)
      VALUES (${obraId}, ${parentId || null}, ${texto}, ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, etapa: rows[0] });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    const body = await req.json();
    const obraId = await obraDoRegistro(sql, "etapas", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const atuais = await sql`
      SELECT e.*, u.rank as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;

    if (body.texto !== undefined) {
      if (!podeModificar(usuario, atuais[0].rank_criador, atuais[0].criado_por)) {
        return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode mudar o texto" }, 403);
      }
      const rows = await sql`UPDATE etapas SET texto = ${body.texto} WHERE id = ${id} RETURNING *`;
      return jsonResponse({ ok: true, etapa: rows[0] });
    }

    // Concluída é um check simples, independente das fotos (que vivem em etapa_fotos).
    const rows = await sql`
      UPDATE etapas SET
        concluida = ${!!body.concluida},
        concluida_por = ${body.concluida ? usuario.id : null},
        concluida_em = ${body.concluida ? new Date().toISOString() : null}
      WHERE id = ${id}
      RETURNING *
    `;
    return jsonResponse({ ok: true, etapa: { ...rows[0], concluida_por_nome: body.concluida ? usuario.nome : null } });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const obraId = await obraDoRegistro(sql, "etapas", id);
    if (!obraId) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const { nivel, obra } = await nivelNaObra(sql, usuario, obraId, "etapas", env);
    if (!obra) return semAcesso();
    if (!podeEditar(nivel)) return soVisualizar();
    const alvos = await sql`
      SELECT e.*, u.rank as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "só o autor ou um superior dele pode apagar" }, 403);
    }
    await sql`DELETE FROM etapas WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
