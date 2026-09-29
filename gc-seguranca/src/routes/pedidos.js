import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";
import { nivelNaObra, podeVer, semAcesso } from "../lib/acesso.js";

// Pedidos: solicitações e entregas diretas de materiais/ferramentas/documentos
// entre duas pessoas da obra. remetente = quem fornece, destinatario = quem recebe.
// Acesso: só quem tem acesso à obra; cada tipo segue o nível do módulo correspondente.
const MODULO_DO_TIPO = { material: "materiais", ferramenta: "ferramentas", documento: "documentos" };

async function pessoaNaObra(sql, usuarioId, obraId, empresaId) {
  const r = await sql`
    SELECT u.id FROM usuarios u
    WHERE u.id = ${usuarioId} AND u.empresa_id = ${empresaId} AND u.removido_em IS NULL
      AND (u.rank <= 2 OR EXISTS (SELECT 1 FROM equipe e WHERE e.obra_id = ${obraId} AND e.usuario_id = u.id))
  `;
  return r.length > 0;
}

export default async function pedidosHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const tiposVisiveis = [];
    for (const [tipo, modulo] of Object.entries(MODULO_DO_TIPO)) {
      const acesso = await nivelNaObra(sql, usuario, obraId, modulo, env);
      if (!acesso.obra) return semAcesso();
      if (podeVer(acesso.nivel)) tiposVisiveis.push(tipo);
    }
    if (!tiposVisiveis.length) return jsonResponse({ ok: true, pedidos: [] });
    const pedidos = await sql`
      SELECT p.*, ur.nome as remetente_nome, ud.nome as destinatario_nome
      FROM pedidos p
      JOIN usuarios ur ON ur.id = p.remetente_id
      JOIN usuarios ud ON ud.id = p.destinatario_id
      WHERE p.obra_id = ${obraId} AND p.tipo = ANY(${tiposVisiveis})
      ORDER BY p.id DESC
    `;
    return jsonResponse({ ok: true, pedidos });
  }

  if (req.method === "POST") {
    const { obraId, tipo, descricao, quantidade, remetenteId, destinatarioId } = await req.json();
    if (!obraId || !tipo || !descricao || !remetenteId || !destinatarioId) {
      return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    }
    if (!MODULO_DO_TIPO[tipo]) return jsonResponse({ ok: false, error: "tipo inválido" }, 400);
    const acesso = await nivelNaObra(sql, usuario, obraId, MODULO_DO_TIPO[tipo], env);
    if (!acesso.obra) return semAcesso();
    if (!podeVer(acesso.nivel)) return jsonResponse({ ok: false, error: "sem acesso a este módulo" }, 403);
    // Quem registra tem que ser uma das partes, e as duas partes têm que ser da obra.
    if (Number(remetenteId) !== usuario.id && Number(destinatarioId) !== usuario.id) {
      return jsonResponse({ ok: false, error: "você só registra pedidos em que é uma das partes" }, 403);
    }
    if (Number(remetenteId) === Number(destinatarioId)) return jsonResponse({ ok: false, error: "remetente e destinatário iguais" }, 400);
    if (!(await pessoaNaObra(sql, remetenteId, obraId, usuario.empresa_id)) || !(await pessoaNaObra(sql, destinatarioId, obraId, usuario.empresa_id))) {
      return jsonResponse({ ok: false, error: "as duas pessoas precisam estar na obra" }, 400);
    }
    // Se quem cria é o próprio remetente, é entrega direta (atendido na hora); senão, pedido pendente.
    const ehEntregaDireta = Number(remetenteId) === usuario.id;
    const status = ehEntregaDireta ? "atendido" : "pendente";
    const atendidoEm = ehEntregaDireta ? new Date().toISOString() : null;
    const rows = await sql`
      INSERT INTO pedidos (obra_id, tipo, descricao, quantidade, remetente_id, destinatario_id, status, criado_por, atendido_em)
      VALUES (${obraId}, ${tipo}, ${descricao}, ${quantidade || null}, ${remetenteId}, ${destinatarioId}, ${status}, ${usuario.id}, ${atendidoEm})
      RETURNING *
    `;
    return jsonResponse({ ok: true, pedido: rows[0] });
  }

  if (req.method === "PATCH") {
    // Só quem recebeu o pedido (o remetente designado) pode marcar como atendido/recusado.
    const id = url.searchParams.get("id");
    const { status } = await req.json();
    if (!["atendido", "recusado"].includes(status)) return jsonResponse({ ok: false, error: "status inválido" }, 400);
    const alvos = await sql`SELECT * FROM pedidos WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!(await nivelNaObra(sql, usuario, alvos[0].obra_id, MODULO_DO_TIPO[alvos[0].tipo], env)).obra) return semAcesso();
    if (alvos[0].remetente_id !== usuario.id) {
      return jsonResponse({ ok: false, error: "só quem recebeu o pedido pode atendê-lo" }, 403);
    }
    const rows = await sql`
      UPDATE pedidos SET status = ${status}, atendido_em = ${status === "atendido" ? new Date().toISOString() : null}
      WHERE id = ${id} RETURNING *
    `;
    return jsonResponse({ ok: true, pedido: rows[0] });
  }

  if (req.method === "DELETE") {
    // Cancelar: quem criou o pedido, ou rank 1-2 (Dono/Eng. Chefe) da MESMA empresa.
    const id = url.searchParams.get("id");
    const alvos = await sql`SELECT * FROM pedidos WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!(await nivelNaObra(sql, usuario, alvos[0].obra_id, MODULO_DO_TIPO[alvos[0].tipo], env)).obra) return semAcesso();
    if (alvos[0].criado_por !== usuario.id && usuario.rank > 2) {
      return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    }
    await sql`DELETE FROM pedidos WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
