// ============================================================
// WEB PUSH (RFC 8291 "aes128gcm" + RFC 8292 VAPID) só com Web Crypto — sem bibliotecas.
//
// As chaves VAPID são criadas pelo próprio Worker na primeira vez e guardadas no banco
// (tabela config_app). Ninguém precisa copiar segredo nenhum.
// ============================================================

const enc = new TextEncoder();
const CONTATO = "mailto:suporte@gestaoecontrole.app.br";

export function b64url(bytes) {
  let s = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deB64url(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function juntar(...partes) {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt, ikm, info, bytes) {
  const chave = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, chave, bytes * 8));
}

// --- Chaves VAPID (criadas uma vez, guardadas no banco) ---
let cacheVapid = null;
export async function chavesVapid(sql) {
  if (cacheVapid) return cacheVapid;
  const rows = await sql`SELECT valor FROM config_app WHERE chave = 'vapid'`;
  let v = rows[0]?.valor;
  if (!v) {
    const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const publica = b64url(await crypto.subtle.exportKey("raw", par.publicKey));
    const privadaJwk = await crypto.subtle.exportKey("jwk", par.privateKey);
    v = { publica, privadaJwk };
    // Se dois pedidos criarem ao mesmo tempo, vale o primeiro que gravou.
    await sql`INSERT INTO config_app (chave, valor) VALUES ('vapid', ${JSON.stringify(v)}) ON CONFLICT (chave) DO NOTHING`;
    const de_novo = await sql`SELECT valor FROM config_app WHERE chave = 'vapid'`;
    v = de_novo[0].valor;
  }
  if (typeof v === "string") v = JSON.parse(v);
  const privada = await crypto.subtle.importKey("jwk", v.privadaJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  cacheVapid = { publica: v.publica, privada };
  return cacheVapid;
}

async function jwtVapid(vapid, audiencia) {
  const cab = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64url(enc.encode(JSON.stringify({ aud: audiencia, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATO })));
  const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapid.privada, enc.encode(`${cab}.${corpo}`));
  return `${cab}.${corpo}.${b64url(assinatura)}`;
}

// Cifra a mensagem para UMA inscrição (RFC 8291).
export async function cifrar(texto, p256dhB64, authB64) {
  const uaPublica = deB64url(p256dhB64);
  const segredo = deB64url(authB64);
  const efemera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", efemera.publicKey));
  const uaChave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave }, efemera.privateKey, 256));
  const ikm = await hkdf(segredo, compartilhado, juntar(enc.encode("WebPush: info\0"), uaPublica, asPublica), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const chaveAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const claro = juntar(enc.encode(texto), new Uint8Array([2])); // 0x02 = último registro
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chaveAes, claro));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return juntar(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

// Manda UMA notificação. Devolve o status HTTP (404/410 = inscrição morta → apagar).
export async function enviarPush(vapid, inscricao, mensagem, jwtCache = new Map()) {
  const url = new URL(inscricao.endpoint);
  const aud = url.origin;
  if (!jwtCache.has(aud)) jwtCache.set(aud, await jwtVapid(vapid, aud));
  const corpo = await cifrar(JSON.stringify(mensagem), inscricao.p256dh, inscricao.auth);
  const r = await fetch(inscricao.endpoint, {
    method: "POST",
    headers: {
      authorization: `vapid t=${jwtCache.get(aud)}, k=${vapid.publica}`,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "86400",
      urgency: "normal",
    },
    body: corpo,
  });
  return r.status;
}
