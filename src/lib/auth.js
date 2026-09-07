import { getSql } from "./db.js";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ============================================================
// JWT propio (HMAC-SHA256) con Web Crypto — sin librerías externas,
// corre nativo en el runtime de Workers.
// ============================================================

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

// payload: objeto plano (ej. { usuarioId, exp }). exp en segundos-epoch.
export async function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

// Devuelve el payload si es válido y no expiró, o null.
export async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC", key, b64urlDecode(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ============================================================
// Password hashing (PBKDF2 con Web Crypto) — guardado como "salt:hash" en hex.
// ============================================================

async function hashSenha(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(senha, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}
async function verificarSenha(senha, senhaHash) {
  const [saltHex, hashHex] = senhaHash.split(":");
  const salt = fromHex(saltHex);
  const hash = await pbkdf2(senha, salt);
  return toHex(hash) === hashHex;
}
async function pbkdf2(senha, salt) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256
  );
  return new Uint8Array(bits);
}
function toHex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function fromHex(hex) { return new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16))); }

// ============================================================
// Matriz de permissões default (idéntico a lo que ya tenías)
// ============================================================

const MODULOS = ["etapas", "equipe", "documentos", "ferramentas", "materiais", "observacoes"];
const NIVEL_DEFAULT_POR_RANK = {
  1: "editar", 2: "editar", 3: "editar", 4: "editar", 5: "editar",
  6: "visualizar",
  7: "nenhum",
};
function nivelDefault(rank, modulo) {
  if (rank === 7) return modulo === "etapas" || modulo === "documentos" ? "visualizar" : "nenhum";
  return NIVEL_DEFAULT_POR_RANK[rank] || "nenhum";
}

async function semearPermissoesDefault(sql, empresaId) {
  for (let rank = 1; rank <= 7; rank++) {
    for (const modulo of MODULOS) {
      await sql`
        INSERT INTO permissoes (empresa_id, rank, modulo, nivel)
        VALUES (${empresaId}, ${rank}, ${modulo}, ${nivelDefault(rank, modulo)})
        ON CONFLICT (empresa_id, rank, modulo) DO NOTHING
      `;
    }
  }
}

// ============================================================
// Signup / Login — reemplazan el flujo de Netlify Identity.
// ============================================================

export async function signup(req, env) {
  const sql = getSql(env);
  const { email: rawEmail, senha, nome } = await req.json();
  if (!rawEmail || !senha) return jsonResponse({ ok: false, error: "email e senha são obrigatórios" }, 400);
  const email = rawEmail.toLowerCase();

  const existentes = await sql`SELECT id FROM usuarios WHERE email = ${email}`;
  if (existentes.length > 0) return jsonResponse({ ok: false, error: "e-mail já cadastrado" }, 409);

  const senhaHash = await hashSenha(senha);
  const convites = await sql`
    SELECT * FROM convites WHERE email = ${email} AND aceito = false ORDER BY id DESC LIMIT 1
  `;

  let novoUsuario;
  if (convites.length > 0) {
    const convite = convites[0];
    const novos = await sql`
      INSERT INTO usuarios (email, nome, empresa_id, rank, senha_hash)
      VALUES (${email}, ${nome || email}, ${convite.empresa_id}, ${convite.rank}, ${senhaHash})
      RETURNING *
    `;
    await sql`UPDATE convites SET aceito = true WHERE id = ${convite.id}`;
    novoUsuario = novos[0];
    if (convite.obra_id) {
      await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${convite.obra_id}, ${novoUsuario.id}, ${convite.funcao || ""}, ${convite.criado_por})
        ON CONFLICT (obra_id, usuario_id) DO NOTHING
      `;
    }
  } else {
    const empresas = await sql`INSERT INTO empresas (nome) VALUES (${(nome || email) + " — empresa"}) RETURNING *`;
    const empresa = empresas[0];
    const novos = await sql`
      INSERT INTO usuarios (email, nome, empresa_id, rank, senha_hash)
      VALUES (${email}, ${nome || email}, ${empresa.id}, 1, ${senhaHash})
      RETURNING *
    `;
    novoUsuario = novos[0];
    await sql`UPDATE empresas SET dono_usuario_id = ${novoUsuario.id} WHERE id = ${empresa.id}`;
    await semearPermissoesDefault(sql, empresa.id);
  }

  const token = await signJWT({ usuarioId: novoUsuario.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, env.JWT_SECRET);
  return jsonResponse({ ok: true, token, usuario: { id: novoUsuario.id, email: novoUsuario.email, nome: novoUsuario.nome } });
}

export async function login(req, env) {
  const sql = getSql(env);
  const { email: rawEmail, senha } = await req.json();
  if (!rawEmail || !senha) return jsonResponse({ ok: false, error: "email e senha são obrigatórios" }, 400);
  const email = rawEmail.toLowerCase();

  const rows = await sql`SELECT * FROM usuarios WHERE email = ${email}`;
  if (rows.length === 0) return jsonResponse({ ok: false, error: "credenciais inválidas" }, 401);
  const usuario = rows[0];
  const ok = await verificarSenha(senha, usuario.senha_hash);
  if (!ok) return jsonResponse({ ok: false, error: "credenciais inválidas" }, 401);

  const token = await signJWT({ usuarioId: usuario.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, env.JWT_SECRET);
  return jsonResponse({ ok: true, token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } });
}

// ============================================================
// getUsuario — ahora recibe (req, env)
// ============================================================

export async function getUsuario(req, env) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.usuarioId) return null;

  const sql = getSql(env);
  const rows = await sql`SELECT * FROM usuarios WHERE id = ${payload.usuarioId}`;
  return rows.length > 0 ? rows[0] : null;
}

// --- Reglas de permiso (idénticas a las que ya tenías) ---

export async function getNivel(empresaId, rank, modulo, env) {
  const sql = getSql(env);
  const rows = await sql`
    SELECT nivel FROM permissoes WHERE empresa_id = ${empresaId} AND rank = ${rank} AND modulo = ${modulo}
  `;
  return rows.length > 0 ? rows[0].nivel : nivelDefault(rank, modulo);
}

const NIVEL_ORDEM = { nenhum: 0, visualizar: 1, editar: 2 };
export function nivelEfetivo(nivelDoRank, excecaoModulos, modulo) {
  if (!excecaoModulos || excecaoModulos[modulo] === undefined) return nivelDoRank;
  const excecao = excecaoModulos[modulo];
  return NIVEL_ORDEM[excecao] < NIVEL_ORDEM[nivelDoRank] ? excecao : nivelDoRank;
}

export function podeCrear(rankMaximoPermitido, rankAtor) {
  return rankAtor <= rankMaximoPermitido;
}

export function podeModificar(ator, rankCriador, idCriador) {
  if (ator.id === idCriador) return true;
  if (ator.rank < rankCriador) return true;
  if (ator.rank > rankCriador) return false;
  return ator.id < idCriador;
}

export function podeAsignarRank(rankAtor, rankAAsignar) {
  return rankAAsignar >= rankAtor;
}
