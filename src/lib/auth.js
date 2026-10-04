import { getSql } from "./db.js";
import { TERMOS_VERSAO, registrarAcesso, MAX_TENTATIVAS, duracaoBloqueioMin, textoEspera } from "./legal.js";
import { enviarConfirmacao } from "./email.js";

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

// Sessão de 30 dias. "sv" = versão da sessão da pessoa (S8): trocar senha/PIN, "Sair de todos os
// aparelhos" ou o Google assumir uma conta não verificada sobe usuarios.sessao_versao, e todos os
// tokens antigos deixam de valer na hora.
export async function emitirToken(usuario, env) {
  return signJWT({ usuarioId: usuario.id, sv: usuario.sessao_versao || 0, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, env.JWT_SECRET);
}

// Derruba todas as sessões da pessoa e devolve um token novo (para o aparelho atual seguir logado).
export async function renovarSessoes(sql, usuarioId, env) {
  const rows = await sql`UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE id = ${usuarioId} RETURNING *`;
  return emitirToken(rows[0], env);
}

// ============================================================
// Password hashing (PBKDF2 con Web Crypto) — guardado como "salt:hash" en hex.
// ============================================================

export async function hashSenha(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(senha, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}
export async function verificarSenha(senha, senhaHash) {
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
  7: "visualizar", // Chefe de Turma
  8: "nenhum", // Profissional (especializado abaixo)
};
function nivelDefault(rank, modulo) {
       if (modulo === "observacoes") return "editar"; // "livro de obra": aberto a todos por padrão
  if (rank === 6) {
    // Almoxarife: forte em materiais/ferramentas, visualiza o resto, sem acesso a equipe.
    if (modulo === "materiais" || modulo === "ferramentas") return "editar";
    if (modulo === "equipe") return "nenhum";
    return "visualizar";
  }
  if (rank === 8) return modulo === "etapas" || modulo === "documentos" ? "visualizar" : "nenhum";
  return NIVEL_DEFAULT_POR_RANK[rank] || "nenhum";
}

// UMA consulta só para as 48 linhas (8 ranks × 6 módulos). Antes eram 48 consultas separadas:
// somadas ao resto do cadastro passavam de 50 "subrequests", o limite do plano grátis do
// Cloudflare Workers, e o cadastro de empresa nova (e-mail ou Google) falhava em produção.
async function semearPermissoesDefault(sql, empresaId) {
  const ranks = [], modulos = [], niveis = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (const modulo of MODULOS) { ranks.push(rank); modulos.push(modulo); niveis.push(nivelDefault(rank, modulo)); }
  }
  await sql`
    INSERT INTO permissoes (empresa_id, rank, modulo, nivel)
    SELECT ${empresaId}, r, m, n FROM unnest(${ranks}::int[], ${modulos}::text[], ${niveis}::text[]) AS t(r, m, n)
    ON CONFLICT (empresa_id, rank, modulo) DO NOTHING
  `;
}

// ============================================================
// Signup / Login — reemplazan el flujo de Netlify Identity.
// Se llaman desde el router (worker.js) en /api/auth/signup y /api/auth/login.
// ============================================================

// POST /api/auth/signup  { email, senha, nome }
// Misma lógica de "primeiro a entrar": si hay convite pendiente, se une a esa empresa;
// si no, crea empresa nueva y queda como Dono (rank 1).
export async function signup(req, env) {
  const sql = getSql(env);
  const { email: rawEmail, senha, nome, aceitouTermos } = await req.json();
  if (!rawEmail || !senha) return jsonResponse({ ok: false, error: "email e senha são obrigatórios" }, 400);
  if (!aceitouTermos) return jsonResponse({ ok: false, error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }, 400);
  if (String(senha).length < 8) return jsonResponse({ ok: false, error: "A senha precisa ter ao menos 8 caracteres." }, 400);
  const email = rawEmail.toLowerCase();

  const existentes = await sql`SELECT id FROM usuarios WHERE email = ${email}`;
  if (existentes.length > 0) return jsonResponse({ ok: false, error: "e-mail já cadastrado" }, 409);

  const senhaHash = await hashSenha(senha);
  const convites = await sql`
    SELECT * FROM convites WHERE email = ${email} AND aceito = false ORDER BY id DESC LIMIT 1
  `;
       // Segurança: um convite por email NÃO pode ser reclamado só digitando o email.
     // Tem que usar o link do convite (WhatsApp) ou "Continuar com Google".
     if (convites.length > 0) {
       return jsonResponse({ ok: false, error: "Este email tem um convite pendente. Use o link do convite que você recebeu, ou toque em \"Entrar com Google\"." }, 409);
     }

  let novoUsuario;
  if (convites.length > 0) {
    const convite = convites[0];
    const novos = await sql`
      INSERT INTO usuarios (email, nome, empresa_id, rank, senha_hash)
      VALUES (${email}, ${nome || email}, ${convite.empresa_id}, ${convite.rank}, ${senhaHash})
      RETURNING *
    `;
    await sql`DELETE FROM convites WHERE id = ${convite.id}`;
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

  await sql`UPDATE usuarios SET termos_versao = ${TERMOS_VERSAO}, termos_aceito_em = now() WHERE id = ${novoUsuario.id}`;
  await registrarAcesso(sql, req, novoUsuario.id, "cadastro");
  // A conta só entra depois de confirmar o e-mail (decisão 04/10): aqui NÃO devolvemos sessão.
  const enviado = await enviarConfirmacao(sql, env, novoUsuario);
  return jsonResponse({ ok: true, confirmarEmail: true, email: novoUsuario.email, enviado });
}

// POST /api/auth/login  { email, senha }
export async function login(req, env) {
  const sql = getSql(env);
  const { email: rawEmail, senha } = await req.json();
  if (!rawEmail || !senha) return jsonResponse({ ok: false, error: "email e senha são obrigatórios" }, 400);
  const email = rawEmail.toLowerCase();

  const rows = await sql`SELECT * FROM usuarios WHERE email = ${email} AND removido_em IS NULL`;
  if (rows.length === 0 || !rows[0].senha_hash) return jsonResponse({ ok: false, error: "credenciais inválidas" }, 401);
  const usuario = rows[0];
  if (usuario.login_bloqueado_ate && new Date(usuario.login_bloqueado_ate) > new Date()) {
    return jsonResponse({ ok: false, error: `Muitas tentativas erradas. Tente de novo em ${textoEspera(usuario.login_bloqueado_ate)}.` }, 429);
  }
  const ok = await verificarSenha(senha, usuario.senha_hash);
  if (!ok) {
    // Bloqueio progressivo: 5 erros → 15 min, depois 1 h, depois 24 h.
    const tent = (usuario.login_tentativas || 0) + 1;
    if (tent >= MAX_TENTATIVAS) {
      const rodadas = usuario.login_rodadas || 0;
      const min = duracaoBloqueioMin(rodadas);
      await sql`UPDATE usuarios SET login_tentativas = 0, login_rodadas = ${rodadas + 1},
        login_bloqueado_ate = now() + (${min} * interval '1 minute') WHERE id = ${usuario.id}`;
      return jsonResponse({ ok: false, error: `Muitas tentativas erradas. Bloqueado por ${min >= 60 ? min / 60 + " h" : min + " min"}.` }, 429);
    }
    await sql`UPDATE usuarios SET login_tentativas = ${tent} WHERE id = ${usuario.id}`;
    return jsonResponse({ ok: false, error: "credenciais inválidas" }, 401);
  }
  await sql`UPDATE usuarios SET login_tentativas = 0, login_rodadas = 0, login_bloqueado_ate = NULL WHERE id = ${usuario.id}`;
  // Senha certa, mas e-mail ainda não confirmado → não entra (só depois de conferir a senha, para não revelar contas).
  if (!usuario.email_verificado) {
    return jsonResponse({ ok: false, codigo: "email_nao_confirmado", error: "Falta confirmar seu e-mail. Abra o link que enviamos (olhe também o spam)." }, 403);
  }
  await registrarAcesso(sql, req, usuario.id, "senha");

  const token = await emitirToken(usuario, env);
  return jsonResponse({ ok: true, token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } });
}

// ============================================================
// Login com Google — mesma lógica de "primeira vez" do signup (convite
// pendente → junta na empresa; senão → cria empresa nova como Dono),
// só que sem senha, porque a identidade já vem confirmada pelo Google.
// ============================================================

// Obs.: quem entra pela primeira vez (ou com Termos desatualizados) vê a tela de aceite antes de usar o app,
// com o nome da empresa em que está entrando — inclusive quando veio de um convite por email (L9).
export async function loginOuCriarComGoogle(email, nome, env, req) {
  const sql = getSql(env);
  const emailNorm = email.toLowerCase();

  const existentes = await sql`SELECT * FROM usuarios WHERE email = ${emailNorm}`;
  let usuario;

  if (existentes.length > 0) {
    usuario = existentes[0];
    // S3: conta criada com e-mail+senha e nunca comprovada. O Google prova que o e-mail é desta pessoa:
    // a conta passa a verificada, a senha antiga (que pode ter sido criada por outra pessoa) é apagada
    // e todas as sessões abertas caem.
    if (!usuario.email_verificado) {
      const rows = await sql`
        UPDATE usuarios SET email_verificado = true, senha_hash = NULL, login_tentativas = 0, login_rodadas = 0,
          login_bloqueado_ate = NULL, sessao_versao = sessao_versao + 1
        WHERE id = ${usuario.id} RETURNING *
      `;
      usuario = rows[0];
    }
  } else {
    const convites = await sql`
      SELECT * FROM convites WHERE email = ${emailNorm} AND aceito = false ORDER BY id DESC LIMIT 1
    `;
    if (convites.length > 0) {
      const convite = convites[0];
      const novos = await sql`
        INSERT INTO usuarios (email, nome, empresa_id, rank, email_verificado)
        VALUES (${emailNorm}, ${nome || emailNorm}, ${convite.empresa_id}, ${convite.rank}, true)
        RETURNING *
      `;
      await sql`DELETE FROM convites WHERE id = ${convite.id}`;
      usuario = novos[0];
      if (convite.obra_id) {
        await sql`
          INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
          VALUES (${convite.obra_id}, ${usuario.id}, ${convite.funcao || ""}, ${convite.criado_por})
          ON CONFLICT (obra_id, usuario_id) DO NOTHING
        `;
      }
    } else {
      const empresas = await sql`INSERT INTO empresas (nome) VALUES (${(nome || emailNorm) + " — empresa"}) RETURNING *`;
      const empresa = empresas[0];
      const novos = await sql`
        INSERT INTO usuarios (email, nome, empresa_id, rank, email_verificado)
        VALUES (${emailNorm}, ${nome || emailNorm}, ${empresa.id}, 1, true)
        RETURNING *
      `;
      usuario = novos[0];
      await sql`UPDATE empresas SET dono_usuario_id = ${usuario.id} WHERE id = ${empresa.id}`;
      await semearPermissoesDefault(sql, empresa.id);
    }
  }

  if (req) await registrarAcesso(sql, req, usuario.id, "google");
  const token = await emitirToken(usuario, env);
  return { token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } };
}

// ============================================================
// getUsuario — ahora recibe (req, env) porque necesita env.JWT_SECRET y env.DATABASE_URL.
// Todas las functions que ya tenías cambian UNA línea: getUsuario(req) → getUsuario(req, env).
// ============================================================

export async function getUsuario(req, env) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.usuarioId) return null;

  const sql = getSql(env);
  const rows = await sql`SELECT * FROM usuarios WHERE id = ${payload.usuarioId} AND removido_em IS NULL`;
  if (rows.length === 0) return null;
  // S8: token de uma "versão" anterior (senha trocada, sair de todos, etc.) não vale mais.
  if ((payload.sv || 0) !== (rows[0].sessao_versao || 0)) return null;
  return rows[0];
}

// --- Reglas de permiso (idénticas a las que ya tenías, no se tocan) ---

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

// Modificar/apagar o que outro criou: só o próprio autor ou alguém de rank ESTRITAMENTE acima.
// (Antes, entre pares de mesmo rank ganhava o usuário mais antigo — resto da escala invertida.)
export function podeModificar(ator, rankCriador, idCriador) {
  if (ator.id === idCriador) return true;
  return ator.rank < rankCriador;
}

// Só se atribui rank ABAIXO do próprio (ninguém cria outro Dono nem um par).
export function podeAsignarRank(rankAtor, rankAAsignar) {
  return Number(rankAAsignar) > rankAtor;
}
