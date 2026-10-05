import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";
import { chavesVapid, enviarPush } from "../lib/webpush.js";

// /api/push — notificações no celular (Web Push).
//  GET            → { publicKey }  (chave pública VAPID para o navegador se inscrever)
//  POST           → { subscription }  guarda a inscrição deste aparelho
//  POST {teste}   → manda uma notificação de teste para os meus aparelhos
//  DELETE         → { endpoint }  desliga este aparelho
const MAX_APARELHOS = 10;

export default async function pushHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

  if (req.method === "GET") {
    const v = await chavesVapid(sql);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM push_inscricoes WHERE usuario_id = ${usuario.id}`;
    return jsonResponse({ ok: true, publicKey: v.publica, aparelhos: n });
  }

  let body = {};
  try { body = await req.json(); } catch {}

  if (req.method === "POST" && body.teste) {
    const subs = await sql`SELECT id, endpoint, p256dh, auth FROM push_inscricoes WHERE usuario_id = ${usuario.id}`;
    if (!subs.length) return jsonResponse({ ok: false, error: "Nenhum aparelho com notificações ativadas." }, 400);
    const v = await chavesVapid(sql);
    const jwts = new Map();
    let enviados = 0;
    for (const s of subs) {
      const st = await enviarPush(v, s, { title: "G&C", body: "✅ Notificações ativadas neste aparelho!", url: "/", tag: "teste" }, jwts).catch(() => 0);
      if (st >= 200 && st < 300) enviados++;
      if (st === 404 || st === 410) await sql`DELETE FROM push_inscricoes WHERE id = ${s.id}`;
    }
    return jsonResponse({ ok: true, enviados });
  }

  if (req.method === "POST") {
    const s = body.subscription || {};
    const endpoint = String(s.endpoint || "");
    const p256dh = String(s.keys?.p256dh || "");
    const auth = String(s.keys?.auth || "");
    let url;
    try { url = new URL(endpoint); } catch { url = null; }
    if (!url || url.protocol !== "https:" || endpoint.length > 1000 || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) {
      return jsonResponse({ ok: false, error: "inscrição inválida" }, 400);
    }
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM push_inscricoes WHERE usuario_id = ${usuario.id} AND endpoint <> ${endpoint}`;
    if (n >= MAX_APARELHOS) await sql`DELETE FROM push_inscricoes WHERE id = (SELECT id FROM push_inscricoes WHERE usuario_id = ${usuario.id} ORDER BY criado_em LIMIT 1)`;
    await sql`
      INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth) VALUES (${usuario.id}, ${endpoint}, ${p256dh}, ${auth})
      ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, criado_em = now()
    `;
    return jsonResponse({ ok: true });
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM push_inscricoes WHERE usuario_id = ${usuario.id} AND endpoint = ${String(body.endpoint || "")}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
