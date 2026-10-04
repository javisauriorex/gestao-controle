// ============================================================
// E-mails automáticos para os usuários (confirmação de e-mail e "Esqueci a senha").
// Envio pelo Resend (https://resend.com) — plano grátis: 3.000/mês, 100/dia.
// A chave fica no Cloudflare como segredo RESEND_API_KEY (nunca no código).
// ============================================================

const REMETENTE = "G&C <nao-responda@gestaoecontrole.app.br>";
const SUPORTE = "suporte@gestaoecontrole.app.br";
// Endereço fixo nos links (não usamos o "Host" do pedido: evita links falsos apontando para outro site).
export const BASE_URL = "https://gestaoecontrole.app.br";

const VALIDADE_MIN = { confirmar: 24 * 60, senha: 60 };
const MAX_POR_HORA = 3; // por pessoa e por tipo — protege a cota diária e a caixa de entrada de quem recebe

function hex(bytes) { return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(texto) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))); }
export const tokenValido = (t) => typeof t === "string" && /^[0-9a-f]{64}$/.test(t);

// Cria um link novo (os anteriores do mesmo tipo deixam de valer). Guardamos só o hash do token.
// Devolve null se a pessoa já pediu demais na última hora.
export async function criarToken(sql, usuarioId, tipo) {
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM tokens_email
    WHERE usuario_id = ${usuarioId} AND tipo = ${tipo} AND criado_em > now() - interval '1 hour'
  `;
  if (n >= MAX_POR_HORA) return null;
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  // Links anteriores deixam de valer (marcados como usados; ficam contando para o limite por hora).
  await sql`UPDATE tokens_email SET usado_em = now() WHERE usuario_id = ${usuarioId} AND tipo = ${tipo} AND usado_em IS NULL`;
  await sql`
    INSERT INTO tokens_email (usuario_id, tipo, token_hash, expira_em)
    VALUES (${usuarioId}, ${tipo}, ${await sha256(token)}, now() + (${VALIDADE_MIN[tipo]} * interval '1 minute'))
  `;
  return token;
}

// Usa o link (uma vez só). Devolve o id da pessoa, ou null se o link é inválido, vencido ou já usado.
export async function consumirToken(sql, token, tipo) {
  if (!tokenValido(token)) return null;
  const rows = await sql`
    UPDATE tokens_email SET usado_em = now()
    WHERE token_hash = ${await sha256(token)} AND tipo = ${tipo} AND usado_em IS NULL AND expira_em > now()
    RETURNING usuario_id
  `;
  return rows.length ? rows[0].usuario_id : null;
}

// Só confere (sem gastar) — para mostrar a tela de nova senha.
export async function tokenExiste(sql, token, tipo) {
  if (!tokenValido(token)) return false;
  const rows = await sql`
    SELECT 1 FROM tokens_email WHERE token_hash = ${await sha256(token)} AND tipo = ${tipo} AND usado_em IS NULL AND expira_em > now()
  `;
  return rows.length > 0;
}

export async function enviarEmail(env, { para, assunto, texto }) {
  if (!env.RESEND_API_KEY) { console.error("RESEND_API_KEY não configurada"); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: REMETENTE, to: [para], reply_to: SUPORTE, subject: assunto, text: texto }),
    });
    if (!r.ok) { console.error("Resend recusou", r.status, (await r.text().catch(() => "")).slice(0, 300)); return false; }
    return true;
  } catch (e) {
    console.error("Resend falhou", e);
    return false;
  }
}

const RODAPE = `\n\nSe não foi você, ignore este e-mail: nada muda na sua conta.\nDúvidas: ${SUPORTE}\n\nO G&C nunca pede sua senha ou PIN por e-mail, WhatsApp ou telefone.\nGestão & Controle — ${BASE_URL}`;

export async function enviarConfirmacao(sql, env, usuario) {
  const token = await criarToken(sql, usuario.id, "confirmar");
  if (!token) return false;
  return enviarEmail(env, {
    para: usuario.email,
    assunto: "Confirme seu e-mail no G&C",
    texto: `Olá, ${usuario.nome || ""}!\n\nPara ativar sua conta no Gestão & Controle, toque no link abaixo (vale 24 horas):\n\n${BASE_URL}/confirmar-email?token=${token}${RODAPE}`,
  });
}

export async function enviarRedefinicao(sql, env, usuario) {
  const token = await criarToken(sql, usuario.id, "senha");
  if (!token) return false;
  return enviarEmail(env, {
    para: usuario.email,
    assunto: "Criar uma nova senha no G&C",
    texto: `Olá, ${usuario.nome || ""}!\n\nRecebemos um pedido para criar uma nova senha. Toque no link abaixo (vale 1 hora e só funciona uma vez):\n\n${BASE_URL}/redefinir-senha?token=${token}\n\nAo criar a nova senha, você sai da conta em todos os outros aparelhos.${RODAPE}`,
  });
}
