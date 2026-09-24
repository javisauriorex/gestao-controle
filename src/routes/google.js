import { loginOuCriarComGoogle } from "../lib/auth.js";

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

// GET /api/auth/google — arranca el flujo, redirige a la pantalla de Google.
export async function googleStart(req, env) {
  const redirectUri = `${new URL(req.url).origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
}

// GET /api/auth/google/callback — Google vuelve acá con ?code=...
// Cambiamos ese code por los datos del usuario, creamos/logueamos, y le
// devolvemos al navegador una paginita que guarda la sesión y redirige a "/".
export async function googleCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const erroGoogle = url.searchParams.get("error");

  if (erroGoogle || !code) {
    return paginaHtml(paginaErro(erroGoogle || "Google não retornou um código de autorização."));
  }

  try {
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      return paginaHtml(paginaErro(tokenData.error_description || "Não foi possível validar com o Google."));
    }

    const payloadJson = b64urlDecode(tokenData.id_token.split(".")[1]);
    const payload = JSON.parse(payloadJson);
    if (!payload.email) return paginaHtml(paginaErro("O Google não retornou um e-mail."));

    const { token, usuario } = await loginOuCriarComGoogle(payload.email, payload.name || "", env);
    return paginaHtml(paginaSucesso(token, usuario));
  } catch (e) {
    return paginaHtml(paginaErro(String(e && e.message || e)));
  }
}

function paginaHtml(body) {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function paginaSucesso(token, usuario) {
  const sessao = JSON.stringify({ token, usuario });
  return `<!doctype html><html><body style="font-family:sans-serif;background:#EDEAE1;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <p>Entrando...</p>
    <script>
      try {
        localStorage.setItem("gc-session", ${JSON.stringify(sessao)});
      } catch (e) {}
      location.href = "/";
    </script>
  </body></html>`;
}

function paginaErro(msg) {
  return `<!doctype html><html><body style="font-family:sans-serif;background:#EDEAE1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;">
    <h2>Não foi possível entrar com Google</h2>
    <p>${String(msg).replace(/</g, "&lt;")}</p>
    <a href="/" style="margin-top:16px;color:#D98E04;">‹ Voltar</a>
  </body></html>`;
}
