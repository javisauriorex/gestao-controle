import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, emitirToken, reservarIds } from "../lib/auth.js";
import { cpfHash, camposCpf, temCpf, cpfConfere, hashPin, conferirPin } from "../lib/cpf.js";
import { TERMOS_VERSAO, registrarAcesso, duracaoBloqueioMin, textoEspera } from "../lib/legal.js";
import { falhasDoIp, LIMITE_FALHAS_IP_HORA, registrarFalha, MSG_IP_BLOQUEADO } from "../lib/limites.js";
import { turnstileOk, MSG_TURNSTILE, FALHAS_PARA_PEDIR_TURNSTILE } from "../lib/turnstile.js";

// ============================================================
// Convite por link (WhatsApp) + login com CPF e PIN.
//   POST /api/convite-link          (logado)  cria link de convite ou de "Novo PIN"
//   GET  /api/convite-info?token=   (público) dados mínimos pra tela do convite
//   POST /api/auth/aceitar-convite  (público) { token, cpf, pin } → cria conta / troca PIN
//   POST /api/auth/login-cpf        (público) { cpf, pin }
// ============================================================

const VALIDADE_DIAS = 7;
const MAX_TENTATIVAS = 5; // depois: bloqueio progressivo (15 min → 1 h → 24 h), ver lib/legal.js

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
  const token = await emitirToken(usuario, env);
  return { ok: true, token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } };
}

// POST /api/convite-link
//  Convite novo: { obraId, nome, telefone?, email?, rank, funcao? }
//  Novo PIN:     { usuarioId, cpf? }  (cpf obrigatório se a pessoa ainda não tem CPF na conta)
export async function criarConviteLink(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  // Convidar: Dono até Encarregado (rank 1-5). Novo PIN: só Dono e Eng. Chefe.
  if (usuario.rank > 5) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
  const sql = getSql(env);
  const body = await req.json();
  if (body.usuarioId && usuario.rank > 2) return jsonResponse({ ok: false, error: "só Dono e Eng. Chefe geram Novo PIN" }, 403);
  const token = gerarToken();
  const expira = new Date(Date.now() + VALIDADE_DIAS * 86400000).toISOString();

  if (body.usuarioId) {
    const alvos = await sql`SELECT * FROM usuarios WHERE id = ${body.usuarioId} AND empresa_id = ${usuario.empresa_id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const alvo = alvos[0];
    if (alvo.id !== usuario.id && alvo.rank <= usuario.rank) {
      return jsonResponse({ ok: false, error: "só pode gerar Novo PIN para ranks abaixo do seu" }, 403);
    }
    if (alvo.removido_em) return jsonResponse({ ok: false, error: "conta excluída" }, 404);
    // S2: sem CPF na conta, o link só serve para o CPF que o chefe informar agora.
    // (Antes, quem pegasse o link podia cadastrar qualquer CPF e entrar na conta dessa pessoa.)
    let cpfFixo = null, cpfFixoHash = null;
    if (!temCpf(alvo)) {
      cpfFixo = limparCpf(body.cpf);
      if (!cpfFixo) return jsonResponse({ ok: false, codigo: "precisa_cpf", error: "Esta pessoa ainda não tem CPF cadastrado. Informe o CPF dela para gerar o link." }, 400);
      if (!cpfValido(cpfFixo)) return jsonResponse({ ok: false, codigo: "precisa_cpf", error: "CPF inválido. Confira os números." }, 400);
      cpfFixoHash = await cpfHash(env, cpfFixo);
      const outro = await sql`SELECT id FROM usuarios WHERE (cpf_hash = ${cpfFixoHash} OR cpf = ${cpfFixo}) AND id <> ${alvo.id}`;
      if (outro.length > 0) return jsonResponse({ ok: false, error: "Este CPF já está em outra conta." }, 409);
    }
    // Invalida links de Novo PIN anteriores dessa pessoa
    await sql`DELETE FROM convites WHERE usuario_id = ${alvo.id}`;
    const rows = await sql`
      INSERT INTO convites (empresa_id, email, nome, telefone, rank, funcao, obra_id, criado_por, token, expira_em, usuario_id, cpf, cpf_hash)
      VALUES (${usuario.empresa_id}, ${null}, ${alvo.nome}, ${alvo.telefone}, ${alvo.rank}, ${""}, ${null}, ${usuario.id}, ${token}, ${expira}, ${alvo.id}, ${cpfFixoHash ? null : cpfFixo}, ${cpfFixoHash})
      RETURNING id, nome, telefone, rank, expira_em, usuario_id
    `;
    return jsonResponse({ ok: true, convite: rows[0], token });
  }

  const { obraId, nome, telefone, email, rank, funcao } = body;
  if (!obraId || !String(nome || "").trim() || !rank) return jsonResponse({ ok: false, error: "faltam dados (nome e rank)" }, 400);
  if (Number(rank) <= usuario.rank) return jsonResponse({ ok: false, error: "só pode convidar para um rank abaixo do seu" }, 403);
  const obras = await sql`SELECT id FROM obras WHERE id = ${obraId} AND empresa_id = ${usuario.empresa_id}`;
  if (obras.length === 0) return jsonResponse({ ok: false, error: "obra não encontrada" }, 404);
  if (usuario.rank > 2) {
    const m = await sql`SELECT 1 FROM equipe WHERE obra_id = ${obraId} AND usuario_id = ${usuario.id}`;
    if (m.length === 0) return jsonResponse({ ok: false, error: "você não está na equipe desta obra" }, 403);
  }
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
    const o = await sql`SELECT cliente FROM obras WHERE id = ${convite.obra_id}`; // só o necessário (sem endereço)
    obra = o[0] || null;
  }
  let jaTemCpf = !!(convite.cpf || convite.cpf_hash);
  if (convite.usuario_id && !jaTemCpf) {
    const u = await sql`SELECT cpf, cpf_hash FROM usuarios WHERE id = ${convite.usuario_id}`;
    jaTemCpf = temCpf(u[0]);
  }
  return jsonResponse({
    ok: true,
    tipo: convite.usuario_id ? "novo-pin" : "convite",
    nome: convite.nome,
    rank: convite.rank,
    funcao: convite.funcao,
    obra,
    temCpf: jaTemCpf,
  });
}

// POST /api/auth/aceitar-convite  { token, cpf, pin }
export async function aceitarConvite(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const sql = getSql(env);
  const { token, cpf: cpfBruto, pin, aceitouTermos } = await req.json();
  const { convite, erro } = await buscarConviteValido(sql, token);
  if (erro) return jsonResponse({ ok: false, error: erro }, 404);
  if (!aceitouTermos) return jsonResponse({ ok: false, error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }, 400);

  const cpf = limparCpf(cpfBruto);
  if (!cpfValido(cpf)) return jsonResponse({ ok: false, error: "CPF inválido. Confira os números." }, 400);
  const probPin = problemaPin(pin, cpf);
  if (probPin) return jsonResponse({ ok: false, error: probPin }, 400);
  const pinHash = await hashPin(env, pin);
  const campos = await camposCpf(env, cpf);

  // --- Novo PIN para quem já tem conta ---
  if (convite.usuario_id) {
    const us = await sql`SELECT * FROM usuarios WHERE id = ${convite.usuario_id}`;
    if (us.length === 0) return jsonResponse({ ok: false, error: "Conta não encontrada." }, 404);
    const u = us[0];
    if (u.removido_em) return jsonResponse({ ok: false, error: "Conta não encontrada." }, 404);
    // O CPF tem que ser o da conta, ou o que o chefe fixou ao gerar o link. Link sem nenhum dos dois não serve (S2).
    const fixoNoLink = { cpf: convite.cpf, cpf_hash: convite.cpf_hash };
    const referencia = temCpf(u) ? u : temCpf(fixoNoLink) ? fixoNoLink : null;
    if (!referencia) return jsonResponse({ ok: false, error: "Este link é antigo. Peça um Novo PIN ao seu chefe." }, 400);
    if (!(await cpfConfere(env, referencia, cpf))) return jsonResponse({ ok: false, error: "Este CPF não é o cadastrado nesta conta." }, 400);
    if (!temCpf(u)) {
      const dono = await sql`SELECT id FROM usuarios WHERE (cpf_hash = ${campos.cpf_hash} OR cpf = ${cpf}) AND id <> ${u.id}`;
      if (dono.length > 0) return jsonResponse({ ok: false, error: "Este CPF já está em outra conta." }, 409);
    }
    // Novo PIN = recuperação de acesso: as sessões antigas (ex.: celular perdido) caem (S8).
    const [rows] = await sql.transaction([
      sql`
        UPDATE usuarios SET cpf = ${campos.cpf}, cpf_hash = ${campos.cpf_hash}, cpf_mascarado = ${campos.cpf_mascarado}, pin_hash = ${pinHash}, pin_tentativas = 0, pin_rodadas = 0, pin_bloqueado_ate = NULL,
          termos_versao = ${TERMOS_VERSAO}, termos_aceito_em = now(), sessao_versao = sessao_versao + 1
        WHERE id = ${u.id} RETURNING *
      `,
      sql`DELETE FROM convites WHERE id = ${convite.id}`,
    ]);
    await registrarAcesso(sql, req, u.id, "convite");
    return jsonResponse(await emitirSessao(rows[0], env));
  }

  // --- Convite novo ---
  const jaExiste = await sql`SELECT id FROM usuarios WHERE cpf_hash = ${campos.cpf_hash} OR cpf = ${cpf}`;
  if (jaExiste.length > 0) {
    return jsonResponse({ ok: false, error: "Este CPF já tem conta. Entre com CPF e PIN, ou peça um 'Novo PIN' ao seu chefe." }, 409);
  }
  if (convite.email) {
    const porEmail = await sql`SELECT id FROM usuarios WHERE email = ${convite.email}`;
    if (porEmail.length > 0) return jsonResponse({ ok: false, error: "Este email já tem conta. Entre normalmente." }, 409);
  }
  // Tudo ou nada (C1): conta nova + entrada na equipe + convite apagado (guardava nome/telefone/email).
  const [uid] = await reservarIds(sql, "usuarios");
  const q = [
    sql`
      INSERT INTO usuarios (id, email, nome, empresa_id, rank, cpf, cpf_hash, cpf_mascarado, pin_hash, telefone, termos_versao, termos_aceito_em)
      VALUES (${uid}, ${convite.email}, ${convite.nome || "Sem nome"}, ${convite.empresa_id}, ${convite.rank}, ${campos.cpf}, ${campos.cpf_hash}, ${campos.cpf_mascarado}, ${pinHash}, ${convite.telefone}, ${TERMOS_VERSAO}, now())
      RETURNING *
    `,
    sql`DELETE FROM convites WHERE id = ${convite.id}`,
  ];
  if (convite.obra_id) {
    q.push(sql`
      INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
      VALUES (${convite.obra_id}, ${uid}, ${convite.funcao || ""}, ${convite.criado_por})
      ON CONFLICT (obra_id, usuario_id) DO NOTHING
    `);
  }
  let novo;
  try {
    novo = (await sql.transaction(q))[0][0];
  } catch (e) {
    // Dois toques ao mesmo tempo no mesmo link: o segundo esbarra no CPF/e-mail único e não cria conta duplicada.
    if (String(e.code || e.message).includes("23505") || /duplicate key/i.test(String(e.message))) {
      return jsonResponse({ ok: false, error: "Esta conta já foi criada. Entre com CPF e PIN." }, 409);
    }
    throw e;
  }
  await registrarAcesso(sql, req, novo.id, "convite");
  return jsonResponse(await emitirSessao(novo, env));
}

// POST /api/auth/login-cpf  { cpf, pin }
export async function loginCpf(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const sql = getSql(env);
  const { cpf: cpfBruto, pin, turnstile } = await req.json();
  const cpf = limparCpf(cpfBruto);
  const erroGenerico = jsonResponse({ ok: false, error: "CPF ou PIN incorretos." }, 401);
  if (cpf.length !== 11 || !pin) return erroGenerico;
  const falhas = await falhasDoIp(sql, req);
  if (falhas >= LIMITE_FALHAS_IP_HORA) return jsonResponse({ ok: false, error: MSG_IP_BLOQUEADO }, 429);
  if (falhas >= FALHAS_PARA_PEDIR_TURNSTILE && !(await turnstileOk(env, req, turnstile))) {
    return jsonResponse({ ok: false, codigo: "turnstile", error: MSG_TURNSTILE }, 403);
  }

  const h = await cpfHash(env, cpf);
  const rows = await sql`SELECT * FROM usuarios WHERE (cpf_hash = ${h} OR cpf = ${cpf}) AND removido_em IS NULL`;
  if (rows.length === 0 || !rows[0].pin_hash) { await registrarFalha(sql, req); return erroGenerico; }
  const u = rows[0];

  if (u.pin_bloqueado_ate && new Date(u.pin_bloqueado_ate) > new Date()) {
    return jsonResponse({ ok: false, error: `Muitas tentativas erradas. Tente de novo em ${textoEspera(u.pin_bloqueado_ate)}, ou peça um Novo PIN ao seu chefe.` }, 429);
  }

  const { ok, atualizar } = await conferirPin(env, pin, u.pin_hash);
  if (!ok) {
    await registrarFalha(sql, req);
    const tent = (u.pin_tentativas || 0) + 1;
    if (tent >= MAX_TENTATIVAS) {
      // Bloqueio progressivo: 15 min → 1 h → 24 h (zera ao acertar ou com Novo PIN).
      const rodadas = u.pin_rodadas || 0;
      const min = duracaoBloqueioMin(rodadas);
      await sql`UPDATE usuarios SET pin_tentativas = 0, pin_rodadas = ${rodadas + 1},
        pin_bloqueado_ate = now() + (${min} * interval '1 minute') WHERE id = ${u.id}`;
      return jsonResponse({ ok: false, error: `Muitas tentativas erradas. Bloqueado por ${min >= 60 ? min / 60 + " h" : min + " min"}.` }, 429);
    }
    await sql`UPDATE usuarios SET pin_tentativas = ${tent} WHERE id = ${u.id}`;
    return erroGenerico;
  }

  // Login certo: aproveita para converter PIN antigo e CPF em claro para o formato novo (C4).
  const novoPin = atualizar ? await hashPin(env, pin) : u.pin_hash;
  const c = u.cpf && env.PIN_PEPPER ? await camposCpf(env, u.cpf) : { cpf: u.cpf, cpf_hash: u.cpf_hash, cpf_mascarado: u.cpf_mascarado };
  await sql`UPDATE usuarios SET pin_tentativas = 0, pin_rodadas = 0, pin_bloqueado_ate = NULL, pin_hash = ${novoPin},
    cpf = ${c.cpf}, cpf_hash = ${c.cpf_hash}, cpf_mascarado = ${c.cpf_mascarado} WHERE id = ${u.id}`;
  await registrarAcesso(sql, req, u.id, "cpf");
  return jsonResponse(await emitirSessao(u, env));
}
