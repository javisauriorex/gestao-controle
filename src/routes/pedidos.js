import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";

// Pedidos: solicitações e entregas diretas de materiais/ferramentas/documentos
// entre duas pessoas da obra. remetente = quem fornece, destinatario = quem recebe.
export default async function pedidosHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const pedidos = await sql`
      SELECT p.*, ur.nome as remetente_nome, ud.nome as destinatario_nome
      FROM pedidos p
      JOIN usuarios ur ON ur.id = p.remetente_id
      JOIN usuarios ud ON ud.id = p.destinatario_id
      WHERE p.obra_id = ${obraId}
      ORDER BY p.id DESC
    `;
    return jsonResponse({ ok: true, pedidos });
  }

  if (req.method === "POST") {
    const { obraId, tipo, descricao, quantidade, remetenteId, destinatarioId } = await req.json();
    if (!obraId || !tipo || !descricao || !remetenteId || !destinatarioId) {
      return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    }
    if (!["material", "ferramenta", "documento"].includes(tipo)) {
      return jsonResponse({ ok: false, error: "tipo inválido" }, 400);
    }
    // Se quem está criando o registro é o próprio remetente, já é uma entrega
    // direta (sem pedido prévio) — fica "atendido" na hora. Senão, é um pedido
    // de verdade e fica "pendente" até o remetente confirmar.
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
    // Cancelar: quem criou o pedido, ou rank 1-2 (Dono/Eng. Chefe) por qualquer um.
    const id = url.searchParams.get("id");
    const alvos = await sql`SELECT * FROM pedidos WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (alvos[0].criado_por !== usuario.id && usuario.rank > 2) {
      return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    }
    await sql`DELETE FROM pedidos WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
