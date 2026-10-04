import { getSql } from "../lib/db.js";
import { jsonResponse, hashSenha } from "../lib/auth.js";
import { enviarConfirmacao, enviarRedefinicao, consumirToken, tokenExiste, tokenValido } from "../lib/email.js";

// ============================================================
// Conta por e-mail:
//   POST /api/auth/reenviar-confirmacao { email }   → manda de novo o link de confirmação
//   POST /api/auth/esqueci-senha        { email }   → manda o link para criar nova senha
//   POST /api/auth/redefinir-senha      { token, senha }
//   GET  /confirmar-email?token=        (página)    → confirma o e-mail
//   GET  /redefinir-senha?token=        (página)    → formulário de nova senha
// As respostas de "reenviar" e "esqueci" são SEMPRE iguais, exista ou não a conta
// (assim ninguém descobre quais e-mails têm cadastro).
// ============================================================

const RESPOSTA_GENERICA = { ok: true, mensagem: "Se este e-mail tiver uma conta, enviamos o link. Olhe também a caixa de spam." };

async function lerEmail(req) {
  try { const b = await req.json(); return String(b.email || "").trim().toLowerCase(); } catch { return ""; }
}

export async function reenviarConfirmacao(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const email = await lerEmail(req);
  if (!email) return jsonResponse({ ok: false, error: "Informe o e-mail." }, 400);
  const sql = getSql(env);
  const rows = await sql`SELECT id, nome, email, email_verificado FROM usuarios WHERE email = ${email} AND removido_em IS NULL`;
  if (rows.length && !rows[0].email_verificado) await enviarConfirmacao(sql, env, rows[0]);
  return jsonResponse(RESPOSTA_GENERICA);
}

export async function esqueciSenha(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const email = await lerEmail(req);
  if (!email) return jsonResponse({ ok: false, error: "Informe o e-mail." }, 400);
  const sql = getSql(env);
  const rows = await sql`SELECT id, nome, email FROM usuarios WHERE email = ${email} AND removido_em IS NULL`;
  if (rows.length) await enviarRedefinicao(sql, env, rows[0]);
  return jsonResponse(RESPOSTA_GENERICA);
}

export async function redefinirSenha(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  let body = {};
  try { body = await req.json(); } catch {}
  const senha = String(body.senha || "");
  if (senha.length < 8) return jsonResponse({ ok: false, error: "A senha precisa ter ao menos 8 caracteres." }, 400);
  const sql = getSql(env);
  const usuarioId = await consumirToken(sql, body.token, "senha");
  if (!usuarioId) return jsonResponse({ ok: false, error: "Este link venceu ou já foi usado. Peça um novo em \"Esqueci a senha\"." }, 400);
  // Quem recebeu o link no e-mail provou que o e-mail é dele: conta confirmada, sessões antigas caem.
  const rows = await sql`
    UPDATE usuarios SET senha_hash = ${await hashSenha(senha)}, email_verificado = true,
      login_tentativas = 0, login_rodadas = 0, login_bloqueado_ate = NULL, sessao_versao = sessao_versao + 1
    WHERE id = ${usuarioId} AND removido_em IS NULL RETURNING id
  `;
  if (!rows.length) return jsonResponse({ ok: false, error: "Conta não encontrada." }, 404);
  await sql`UPDATE tokens_email SET usado_em = now() WHERE usuario_id = ${usuarioId} AND usado_em IS NULL`;
  return jsonResponse({ ok: true });
}

// ---------------- Páginas ----------------

function pagina(titulo, corpo) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — G&amp;C</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#EDEAE1;color:#1A1815;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}
  .card{background:#fff;border-radius:10px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 12px} p{line-height:1.5;margin:0 0 14px}
  label{display:block;font-size:13px;color:#555;margin:12px 0 4px}
  input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:16px}
  .btn{display:block;width:100%;box-sizing:border-box;text-align:center;background:#D98E04;color:#fff;border:0;border-radius:6px;padding:12px;font-size:15px;font-weight:700;margin-top:18px;text-decoration:none;cursor:pointer}
  .erro{color:#B4432B;font-size:14px;min-height:1em;margin-top:10px} .ok{color:#2E7D4F}
</style></head><body><div class="card">${corpo}</div></body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-frame-options": "DENY" },
  });
}

export async function paginaConfirmarEmail(req, env) {
  const token = new URL(req.url).searchParams.get("token");
  const sql = getSql(env);
  const usuarioId = await consumirToken(sql, token, "confirmar");
  if (!usuarioId) {
    return pagina("Link inválido", `<h1>Link inválido ou vencido</h1>
      <p>Este link de confirmação já foi usado ou passou do prazo (24 horas).</p>
      <p>Se você já confirmou, é só entrar. Se não, na tela de entrada tente entrar com seu e-mail e senha e toque em <b>"Reenviar e-mail de confirmação"</b>.</p>
      <a class="btn" href="/">Ir para o G&amp;C</a>`);
  }
  await sql`UPDATE usuarios SET email_verificado = true WHERE id = ${usuarioId}`;
  return pagina("E-mail confirmado", `<h1 class="ok">✓ E-mail confirmado!</h1>
    <p>Sua conta está ativa. Agora é só entrar com seu e-mail e senha.</p>
    <a class="btn" href="/">Entrar no G&amp;C</a>`);
}

export async function paginaRedefinirSenha(req, env) {
  const token = new URL(req.url).searchParams.get("token");
  if (!(await tokenExiste(getSql(env), token, "senha"))) {
    return pagina("Link inválido", `<h1>Link inválido ou vencido</h1>
      <p>Este link já foi usado ou passou do prazo (1 hora).</p>
      <p>Peça outro na tela de entrada, em <b>"Esqueci a senha"</b>.</p>
      <a class="btn" href="/">Ir para o G&amp;C</a>`);
  }
  // token já validado (64 caracteres hexadecimais): seguro de colocar na página.
  return pagina("Nova senha", `<h1>Criar nova senha</h1>
    <p>Escolha uma senha nova, com pelo menos 8 caracteres.</p>
    <form id="f">
      <label for="s1">Nova senha</label><input id="s1" type="password" autocomplete="new-password" required minlength="8">
      <label for="s2">Repita a nova senha</label><input id="s2" type="password" autocomplete="new-password" required minlength="8">
      <div class="erro" id="e"></div>
      <button class="btn" id="b" type="submit">Salvar nova senha</button>
    </form>
    <script>
      var T = ${JSON.stringify(tokenValido(token) ? token : "")};
      document.getElementById("f").onsubmit = async function (ev) {
        ev.preventDefault();
        var s1 = document.getElementById("s1").value, s2 = document.getElementById("s2").value, e = document.getElementById("e"), b = document.getElementById("b");
        e.textContent = "";
        if (s1.length < 8) { e.textContent = "A senha precisa ter ao menos 8 caracteres."; return; }
        if (s1 !== s2) { e.textContent = "As duas senhas não são iguais."; return; }
        b.disabled = true; b.textContent = "Salvando...";
        try {
          var r = await fetch("/api/auth/redefinir-senha", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: T, senha: s1 }) });
          var d = await r.json();
          if (d.ok) { document.querySelector(".card").innerHTML = '<h1 class="ok">✓ Senha nova salva!</h1><p>Você saiu da conta nos outros aparelhos. Agora entre com seu e-mail e a senha nova.</p><a class="btn" href="/">Entrar no G&amp;C</a>'; return; }
          e.textContent = d.error || "Não foi possível salvar.";
        } catch (x) { e.textContent = "Sem conexão. Tente de novo."; }
        b.disabled = false; b.textContent = "Salvar nova senha";
      };
    </script>`);
}
