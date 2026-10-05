import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, nivelDefault, NIVEL_ORDEM } from "../lib/auth.js";
import { veTodasAsObras } from "../lib/acesso.js";
import { eventoVisivel, CATEGORIAS, PROFUNDIDADE_MAX } from "../lib/eventos.js";

// /api/avisos — bandeja 🔔 (claude/permisos-y-flujos.md §4).
//  GET   → { avisos: [...], naoLidos, prefs: {profundidade, modulos}, silenciadas: [obraId] }
//  PATCH → { visto: true }                       marca tudo como lido
//          { profundidade, modulos }             "Quero saber o que acontece até..."
//          { obraId, silenciar: true|false }     🔕 silenciar uma obra
const DIAS = 30;
const MAX_AVISOS = 60;

export default async function avisosHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

  if (req.method === "GET") {
    const todas = veTodasAsObras(usuario);
    const obras = await sql`
      SELECT o.id, e.criado_em AS entrou, e.excecao_modulos
      FROM obras o LEFT JOIN equipe e ON e.obra_id = o.id AND e.usuario_id = ${usuario.id}
      WHERE o.empresa_id = ${usuario.empresa_id} AND (${todas} OR e.id IS NOT NULL)
    `;
    const ids = obras.map((o) => o.id);
    const [perms, ranks, silenc, eventos] = await Promise.all([
      sql`SELECT modulo, nivel FROM permissoes WHERE empresa_id = ${usuario.empresa_id} AND rank = ${usuario.rank}`,
      ids.length ? sql`SELECT e.obra_id, u.rank FROM equipe e JOIN usuarios u ON u.id = e.usuario_id WHERE e.obra_id = ANY(${ids}) AND u.removido_em IS NULL` : [],
      sql`SELECT obra_id FROM obras_silenciadas WHERE usuario_id = ${usuario.id}`,
      sql`
        SELECT ev.*, u.nome AS autor_nome, o.cliente AS obra_nome
        FROM eventos ev
        JOIN usuarios u ON u.id = ev.autor_id
        LEFT JOIN obras o ON o.id = ev.obra_id
        WHERE ev.empresa_id = ${usuario.empresa_id}
          AND ev.criado_em > now() - (${DIAS} * interval '1 day')
          AND ev.autor_id <> ${usuario.id}
          AND (ev.obra_id = ANY(${ids.length ? ids : [0]}) OR ev.afetado_id = ${usuario.id})
        ORDER BY ev.id DESC LIMIT 300
      `,
    ]);
    const base = Object.fromEntries(perms.map((p) => [p.modulo, p.nivel]));
    const obraInfo = new Map(obras.map((o) => [o.id, o]));
    const ranksPorObra = new Map();
    for (const r of ranks) { if (!ranksPorObra.has(r.obra_id)) ranksPorObra.set(r.obra_id, new Set()); ranksPorObra.get(r.obra_id).add(r.rank); }
    const silenciadas = new Set(silenc.map((s) => s.obra_id));
    const prefs = { profundidade: usuario.avisos_profundidade || 1, modulos: usuario.avisos_modulos || null };
    const ctx = {
      eu: usuario, prefs, silenciadas,
      nivelEm: (obraId, modulo) => {
        const n = base[modulo] || nivelDefault(usuario.rank, modulo);
        const exc = obraInfo.get(obraId)?.excecao_modulos?.[modulo];
        return exc && NIVEL_ORDEM[exc] < NIVEL_ORDEM[n] ? exc : n;
      },
      ranksNaObra: (obraId) => ranksPorObra.get(obraId) || new Set(),
      entrouEm: (obraId) => { const o = obraInfo.get(obraId); return o && o.entrou && !todas ? new Date(o.entrou) : null; },
    };
    const visto = usuario.avisos_visto_ate ? new Date(usuario.avisos_visto_ate) : new Date(0);
    const avisos = eventos.filter((ev) => eventoVisivel(ev, ctx)).slice(0, MAX_AVISOS).map((ev) => ({
      id: ev.id, obra_id: ev.obra_id, obra_nome: ev.obra_nome, categoria: ev.categoria, acao: ev.acao,
      texto: ev.texto, autor_nome: ev.autor_nome, rank_autor: ev.rank_autor, criado_em: ev.criado_em,
      paraVoce: ev.afetado_id === usuario.id, lido: new Date(ev.criado_em) <= visto,
    }));
    return jsonResponse({ ok: true, avisos, naoLidos: avisos.filter((a) => !a.lido).length, prefs, silenciadas: [...silenciadas] });
  }

  if (req.method === "PATCH") {
    let body = {};
    try { body = await req.json(); } catch {}
    if (body.visto) {
      await sql`UPDATE usuarios SET avisos_visto_ate = now() WHERE id = ${usuario.id}`;
      return jsonResponse({ ok: true });
    }
    if (body.obraId !== undefined) {
      const o = await sql`SELECT id FROM obras WHERE id = ${body.obraId} AND empresa_id = ${usuario.empresa_id}`;
      if (!o.length) return jsonResponse({ ok: false, error: "obra não encontrada" }, 404);
      if (body.silenciar) await sql`INSERT INTO obras_silenciadas (usuario_id, obra_id) VALUES (${usuario.id}, ${body.obraId}) ON CONFLICT DO NOTHING`;
      else await sql`DELETE FROM obras_silenciadas WHERE usuario_id = ${usuario.id} AND obra_id = ${body.obraId}`;
      return jsonResponse({ ok: true });
    }
    const prof = Number(body.profundidade);
    if (!Number.isInteger(prof) || prof < 1 || prof > PROFUNDIDADE_MAX) return jsonResponse({ ok: false, error: "profundidade inválida" }, 400);
    const modulos = {};
    for (const c of CATEGORIAS) if (body.modulos && body.modulos[c] === false) modulos[c] = false;
    await sql`UPDATE usuarios SET avisos_profundidade = ${prof}, avisos_modulos = ${Object.keys(modulos).length ? JSON.stringify(modulos) : null} WHERE id = ${usuario.id}`;
    return jsonResponse({ ok: true, prefs: { profundidade: prof, modulos: Object.keys(modulos).length ? modulos : null } });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
