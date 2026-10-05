import { getSql } from "../lib/db.js";
import { registrarEvento } from "../lib/eventos.js";
import { getUsuario, jsonResponse, podeModificar } from "../lib/auth.js";
import { nivelNaObra, podeVer, podeReceber, semAcesso, veTodasAsObras } from "../lib/acesso.js";

// Pedidos e entregas de materiais/ferramentas/documentos entre duas pessoas da obra.
// remetente = quem fornece (ex.: Almoxarife), destinatario = quem recebe.
//
// Fluxo (05/10/2026 — o Almoxarife é o nexo entre pedidos e entregas):
//   pendente   → alguém PEDIU; espera quem fornece.            (o remetente: "entregue" ou "recusado")
//   aguardando → foi ENTREGUE; espera quem recebe confirmar.   (o destinatário: "atendido" = recebi, ou "contestar")
//   atendido   → quem recebeu confirmou.
//   recusado   → quem fornece recusou.
// Uma entrega direta (quem fornece registra) já nasce "aguardando": só fecha quando quem recebe confirma.
//
// Quem vê: as duas partes, os superiores de alguma das partes e quem vê todas as obras (rank 1-3).
// Criar pedido e confirmar recebimento: nível "receber" ou "editar" no módulo do tipo.
// Cancelar: o autor ou um superior dele (regra geral).
const MODULO_DO_TIPO = { material: "materiais", ferramenta: "ferramentas", documento: "documentos" };
const MAX_PENDENTES_POR_PESSOA = 20;

// H8: as duas partes têm que estar na equipe da obra (ou ser o responsável dela).
async function pessoaNaObra(sql, usuarioId, obraId, empresaId) {
  const r = await sql`
    SELECT u.id FROM usuarios u
    WHERE u.id = ${usuarioId} AND u.empresa_id = ${empresaId} AND u.removido_em IS NULL
      AND (EXISTS (SELECT 1 FROM equipe e WHERE e.obra_id = ${obraId} AND e.usuario_id = u.id)
           OR EXISTS (SELECT 1 FROM obras o WHERE o.id = ${obraId} AND o.responsavel_id = u.id))
  `;
  return r.length > 0;
}

export default async function pedidosHandler(req, env, ctx) {
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
        AND (${veTodasAsObras(usuario)} OR p.remetente_id = ${usuario.id} OR p.destinatario_id = ${usuario.id}
             OR ${usuario.rank} < GREATEST(ur.rank, ud.rank))
      ORDER BY p.id DESC
    `;
    return jsonResponse({ ok: true, pedidos });
  }

  if (req.method === "POST") {
    const { obraId, tipo, descricao, quantidade, remetenteId, destinatarioId } = await req.json();
    if (!obraId || !tipo || !String(descricao || "").trim() || !remetenteId || !destinatarioId) {
      return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    }
    if (!MODULO_DO_TIPO[tipo]) return jsonResponse({ ok: false, error: "tipo inválido" }, 400);
    const acesso = await nivelNaObra(sql, usuario, obraId, MODULO_DO_TIPO[tipo], env);
    if (!acesso.obra) return semAcesso();
    if (!podeReceber(acesso.nivel)) return jsonResponse({ ok: false, error: "seu acesso a este módulo é só visualizar" }, 403);
    // Quem registra tem que ser uma das partes, e as duas partes têm que ser da obra.
    if (Number(remetenteId) !== usuario.id && Number(destinatarioId) !== usuario.id) {
      return jsonResponse({ ok: false, error: "você só registra pedidos em que é uma das partes" }, 403);
    }
    if (Number(remetenteId) === Number(destinatarioId)) return jsonResponse({ ok: false, error: "remetente e destinatário iguais" }, 400);
    if (!(await pessoaNaObra(sql, remetenteId, obraId, usuario.empresa_id)) || !(await pessoaNaObra(sql, destinatarioId, obraId, usuario.empresa_id))) {
      return jsonResponse({ ok: false, error: "as duas pessoas precisam estar na equipe da obra" }, 400);
    }
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM pedidos WHERE criado_por = ${usuario.id} AND obra_id = ${obraId} AND status IN ('pendente', 'aguardando')
    `;
    if (n >= MAX_PENDENTES_POR_PESSOA) return jsonResponse({ ok: false, error: `você já tem ${n} pedidos em aberto nesta obra: feche alguns antes` }, 429);
    // Entrega direta (quem fornece registra): nasce "aguardando" a confirmação de quem recebe.
    const ehEntregaDireta = Number(remetenteId) === usuario.id;
    const rows = await sql`
      INSERT INTO pedidos (obra_id, tipo, descricao, quantidade, remetente_id, destinatario_id, status, criado_por, rank_autor, entregue_em)
      VALUES (${obraId}, ${tipo}, ${String(descricao).trim().slice(0, 300)}, ${quantidade ? String(quantidade).slice(0, 60) : null}, ${remetenteId}, ${destinatarioId},
              ${ehEntregaDireta ? "aguardando" : "pendente"}, ${usuario.id}, ${usuario.rank}, ${ehEntregaDireta ? new Date().toISOString() : null})
      RETURNING *
    `;
    const oQue = `"${String(descricao).trim().slice(0, 60)}${quantidade ? ` (${String(quantidade).slice(0, 20)})` : ""}"`;
    await registrarEvento(sql, usuario, { env, ctx }, ehEntregaDireta
      ? { obraId: Number(obraId), categoria: "pedidos", acao: "entregou", alvoId: rows[0].id, texto: `entregou ${oQue} para você — confirme se recebeu`, afetadoId: Number(destinatarioId) }
      : { obraId: Number(obraId), categoria: "pedidos", acao: "pediu", alvoId: rows[0].id, texto: `pediu ${oQue} a você`, afetadoId: Number(remetenteId) });
    return jsonResponse({ ok: true, pedido: rows[0] });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    let { status } = await req.json();
    const alvos = await sql`SELECT * FROM pedidos WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const p = alvos[0];
    const acesso = await nivelNaObra(sql, usuario, p.obra_id, MODULO_DO_TIPO[p.tipo], env);
    if (!acesso.obra) return semAcesso();
    const agora = new Date().toISOString();
    const oQue = `"${String(p.descricao).slice(0, 60)}${p.quantidade ? ` (${p.quantidade})` : ""}"`;
    const avisar = (acao, texto, afetadoId) => registrarEvento(sql, usuario, { env, ctx }, { obraId: p.obra_id, categoria: "pedidos", acao, alvoId: p.id, texto, afetadoId });

    if (p.remetente_id === usuario.id && p.status === "pendente") {
      if (status === "atendido") status = "entregue"; // compatibilidade com a tela antiga
      if (status === "entregue") {
        const rows = await sql`UPDATE pedidos SET status = 'aguardando', entregue_em = ${agora} WHERE id = ${id} RETURNING *`;
        await avisar("entregou", `entregou ${oQue} — confirme se recebeu`, p.destinatario_id);
        return jsonResponse({ ok: true, pedido: rows[0] });
      }
      if (status === "recusado") {
        const rows = await sql`UPDATE pedidos SET status = 'recusado' WHERE id = ${id} RETURNING *`;
        await avisar("recusou", `recusou seu pedido ${oQue}`, p.destinatario_id);
        return jsonResponse({ ok: true, pedido: rows[0] });
      }
    }
    if (p.destinatario_id === usuario.id && p.status === "aguardando") {
      if (!podeReceber(acesso.nivel)) return jsonResponse({ ok: false, error: "seu acesso a este módulo é só visualizar" }, 403);
      if (status === "atendido") {
        const rows = await sql`UPDATE pedidos SET status = 'atendido', atendido_em = ${agora} WHERE id = ${id} RETURNING *`;
        await avisar("recebeu", `confirmou que recebeu ${oQue}`, p.remetente_id);
        return jsonResponse({ ok: true, pedido: rows[0] });
      }
      if (status === "contestar") {
        const rows = await sql`UPDATE pedidos SET status = 'pendente', entregue_em = NULL WHERE id = ${id} RETURNING *`;
        await avisar("contestou", `disse que NÃO recebeu ${oQue}`, p.remetente_id);
        return jsonResponse({ ok: true, pedido: rows[0] });
      }
    }
    return jsonResponse({ ok: false, error: "ação não permitida para este pedido" }, 403);
  }

  if (req.method === "DELETE") {
    // Cancelar: quem criou o pedido ou um superior dele (regra geral da hierarquia).
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT p.*, COALESCE(p.rank_autor, u.rank) AS rank_criador FROM pedidos p JOIN usuarios u ON u.id = p.criado_por WHERE p.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!(await nivelNaObra(sql, usuario, alvos[0].obra_id, MODULO_DO_TIPO[alvos[0].tipo], env)).obra) return semAcesso();
    if (!podeModificar(usuario, alvos[0].rank_criador, alvos[0].criado_por)) {
      return jsonResponse({ ok: false, error: "só quem criou o pedido ou um superior dele pode cancelar" }, 403);
    }
    await sql`DELETE FROM pedidos WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
