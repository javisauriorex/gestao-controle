import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, hashSenha, verificarSenha, signJWT } from "../lib/auth.js";

// ============================================================
// Convite por link (WhatsApp) + login com CPF e PIN.
//   POST /api/convite-link          (logado)  cria link de convite ou de "Novo PIN"
//   GET  /api/convite-info?token=   (público) dados mínimos pra tela do convite
//   POST /api/auth/aceitar-convite  (público) { token, cpf, pin } → cria conta / troca PIN
//   POST /api/auth/login-cpf        (público) { cpf, pin }
// ============================================================

const VALIDADE_DIAS = 7;
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;

export function limparCpf(cpf) {
  return String(cpf || "").replace(/\D/g, "");
}

export function cpfValido(cpf) {
  const c = limparCpf(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dig = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(c[9]) && dig(10) === Number(c[10]);
}

// Devolve mensagem de erro, ou null se o PIN serve.
export function problemaPin(pin, cpf) {
  const p = String(pin || "");
  if (!/^\d{4}$/.test(p)) return "O PIN precisa ter exatamente 4 números.";
  if (/^(\d)\1{3}$/.test(p)) return "PIN muito fácil (números repetidos). Escolha outro.";
  const seq = "0123456789012", inv = "9876543210987";
  if (seq.includes(p) || inv.includes(p)) return "PIN muito fácil (sequência). Escolha outro.";
  const c = limparCpf(cpf);
  if (c && (c.endsWith(p) || c.startsWith(p))) return "O PIN não pode ser parte do seu CPF — qualquer um que tenha seu CPF saberia.";
  return null;
}

function gerarToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function emitirSessao(usuario, env) {
  const token = await signJWT({ usuarioId: usuario.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, env.JWT_SECRET);
  return { ok: true, token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } };
}

// POST /api/convite-link
//  Convite novo: { obraId, nome, telefone?, email?, rank, funcao? }
//  Novo PIN:     { usuarioId }
export async function criarConviteLink(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  if (usuario.rank > 2) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
  const sql = getSql(env);
  const body = await req.json();
  const token = gerarToken();
  const expira = new Date(Date.now() + VALIDADE_DIAS * 86400000).toISOString();

  if (body.usuarioId) {
    const alvos = await sql`SELECT * FROM usuarios WHERE id = ${body.usuarioId} AND empresa_id = ${usuario.empresa_id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const alvo = alvos[0];
    if (alvo.id !== usuario.id && alvo.rank <= usuario.rank) {
      return jsonResponse({ ok: false, error: "só pode gerar Novo PIN para ranks abaixo do seu" }, 403);
    }
    // Invalida links de Novo PIN anteriores dessa pessoa
    await sql`UPDATE convites SET aceito = true WHERE usuario_id = ${alvo.id} AND aceito = false`;
    const rows = await sql`
      INSERT INTO convites (empresa_id, email, nome, telefone, rank, funcao, obra_id, criado_por, token, expira_em, usuario_id)
      VALUES (${usuario.empresa_id}, ${null}, ${alvo.nome}, ${alvo.telefone}, ${alvo.rank}, ${""}, ${null}, ${usuario.id}, ${token}, ${expira}, ${alvo.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, convite: rows[0], token });
  }

  const { obraId, nome, telefone, email, rank, funcao } = body;
  if (!obraId || !String(nome || "").trim() || !rank) return jsonResponse({ ok: false, error: "faltam dados (nome e rank)" }, 400);
  if (Number(rank) < usuario.rank) return jsonResponse({ ok: false, error: "não pode atribuir um rank maior que o próprio" }, 403);
  const obras = await sql`SELECT id FROM obras WHERE id = ${obraId} AND empresa_id = ${usuario.empresa_id}`;
  if (obras.length === 0) return jsonResponse({ ok: false, error: "obra não encontrada" }, 404);
  const tel = String(telefone || "").replace(/\D/g, "") || null;
  const emailNorm = email ? String(email).trim().toLowerCase() : null;
  const rows = await sql`
    INSERT INTO convites (empresa_id, email, nome, telefone, rank, funcao, obra_id, criado_por, token, expira_em)
    VALUES (${usuario.empresa_id}, ${emailNorm}, ${String(nome).trim()}, ${tel}, ${Number(rank)}, ${funcao || ""}, ${obraId}, ${usuario.id}, ${token}, ${expira})
    RETURNING *
  `;
  return jsonResponse({ ok: true, convite: rows[0], token });
}

async function buscarConviteValido(sql, token) {
  if (!token) return { erro: "Link inválido." };
  const rows = await sql`SELECT * FROM convites WHERE token = ${token}`;
  if (rows.length === 0) return { erro: "Link inválido." };
  const c = rows[0];
  if (c.aceito) return { erro: "Este link já foi usado. Peça um novo a quem te convidou." };
  if (c.expira_em && new Date(c.expira_em) < new Date()) return { erro: "Este link venceu. Peça um novo a quem te convidou." };
  return { convite: c };
}

// GET /api/convite-info?token=...
export async function conviteInfo(req, env) {
  const sql = getSql(env);
  const token = new URL(req.url).searchParams.get("token");
  const { convite, erro } = await buscarConviteValido(sql, token);
  if (erro) return jsonResponse({ ok: false, error: erro }, 404);
  let obra = null;
  if (convite.obra_id) {
    const o = await sql`SELECT cliente, endereco FROM obras WHERE id = ${convite.obra_id}`;
    obra = o[0] || null;
  }
  let temCpf = false;
  if (convite.usuario_id) {
    const u = await sql`SELECT cpf FROM usuarios WHERE id = ${convite.usuario_id}`;
    temCpf = !!(u[0] && u[0].cpf);
  }
  return jsonResponse({
    ok: true,
    tipo: convite.usuario_id ? "novo-pin" : "convite",
    nome: convite.nome,
    rank: convite.rank,
    funcao: convite.funcao,
    obra,
    temCpf,
  });
}

// POST /api/auth/aceitar-convite  { token, cpf, pin }
export async function aceitarConvite(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const sql = getSql(env);
  const { token, cpf: cpfBruto, pin } = await req.json();
  const { convite, erro } = await buscarConviteValido(sql, token);
  if (erro) return jsonResponse({ ok: false, error: erro }, 404);

  const cpf = limparCpf(cpfBruto);
  if (!cpfValido(cpf)) return jsonResponse({ ok: false, error: "CPF inválido. Confira os números." }, 400);
  const probPin = problemaPin(pin, cpf);
  if (probPin) return jsonResponse({ ok: false, error: probPin }, 400);
  const pinHash = await hashSenha(String(pin));

  // --- Novo PIN para quem já tem conta ---
  if (convite.usuario_id) {
    const us = await sql`SELECT * FROM usuarios WHERE id = ${convite.usuario_id}`;
    if (us.length === 0) return jsonResponse({ ok: false, error: "Conta não encontrada." }, 404);
    const u = us[0];
    if (u.cpf && u.cpf !== cpf) return jsonResponse({ ok: false, error: "Este CPF não é o cadastrado nesta conta." }, 400);
    if (!u.cpf) {
      const dono = await sql`SELECT id FROM usuarios WHERE cpf = ${cpf} AND id <> ${u.id}`;
      if (dono.length > 0) return jsonResponse({ ok: false, error: "Este CPF já está em outra conta." }, 409);
    }
    const rows = await sql`
      UPDATE usuarios SET cpf = ${cpf}, pin_hash = ${pinHash}, pin_tentativas = 0, pin_bloqueado_ate = NULL
      WHERE id = ${u.id} RETURNING *
    `;
    await sql`UPDATE convites SET aceito = true WHERE id = ${convite.id}`;
    return jsonResponse(await emitirSessao(rows[0], env));
  }

  // --- Convite novo ---
  const jaExiste = await sql`SELECT id FROM usuarios WHERE cpf = ${cpf}`;
  if (jaExiste.length > 0) {
    return jsonResponse({ ok: false, error: "Este CPF já tem conta. Entre com CPF e PIN, ou peça um 'Novo PIN' ao seu chefe." }, 409);
  }
  if (convite.email) {
    const porEmail = await sql`SELECT id FROM usuarios WHERE email = ${convite.email}`;
    if (porEmail.length > 0) return jsonResponse({ ok: false, error: "Este email já tem conta. Entre normalmente." }, 409);
  }
  const novos = await sql`
    INSERT INTO usuarios (email, nome, empresa_id, rank, cpf, pin_hash, telefone)
    VALUES (${convite.email}, ${convite.nome || "Sem nome"}, ${convite.empresa_id}, ${convite.rank}, ${cpf}, ${pinHash}, ${convite.telefone})
    RETURNING *
  `;
  const novo = novos[0];
  await sql`UPDATE convites SET aceito = true WHERE id = ${convite.id}`;
  if (convite.obra_id) {
    await sql`
      INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
      VALUES (${convite.obra_id}, ${novo.id}, ${convite.funcao || ""}, ${convite.criado_por})
      ON CONFLICT (obra_id, usuario_id) DO NOTHING
    `;
  }
  return jsonResponse(await emitirSessao(novo, env));
}

// POST /api/auth/login-cpf  { cpf, pin }
export async function loginCpf(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const sql = getSql(env);
  const { cpf: cpfBruto, pin } = await req.json();
  const cpf = limparCpf(cpfBruto);
  const erroGenerico = jsonResponse({ ok: false, error: "CPF ou PIN incorretos." }, 401);
  if (cpf.length !== 11 || !pin) return erroGenerico;

  const rows = await sql`SELECT * FROM usuarios WHERE cpf = ${cpf}`;
  if (rows.length === 0 || !rows[0].pin_hash) return erroGenerico;
  const u = rows[0];

  if (u.pin_bloqueado_ate && new Date(u.pin_bloqueado_ate) > new Date()) {
    const min = Math.ceil((new Date(u.pin_bloqueado_ate) - new Date()) / 60000);
    return jsonResponse({ ok: false, error: `Muitas tentativas erradas. Tente de novo em ${min} min, ou peça um Novo PIN ao seu chefe.` }, 429);
  }

  const ok = await verificarSenha(String(pin), u.pin_hash);
  if (!ok) {
    const tent = (u.pin_tentativas || 0) + 1;
    if (tent >= MAX_TENTATIVAS) {
      const ate = new Date(Date.now() + BLOQUEIO_MIN * 60000).toISOString();
      await sql`UPDATE usuarios SET pin_tentativas = 0, pin_bloqueado_ate = ${ate} WHERE id = ${u.id}`;
      return jsonResponse({ ok: false, error: `Muitas tentativas erradas. Bloqueado por ${BLOQUEIO_MIN} min.` }, 429);
    }
    await sql`UPDATE usuarios SET pin_tentativas = ${tent} WHERE id = ${u.id}`;
    return erroGenerico;
  }

  await sql`UPDATE usuarios SET pin_tentativas = 0, pin_bloqueado_ate = NULL WHERE id = ${u.id}`;
  return jsonResponse(await emitirSessao(u, env));
}
