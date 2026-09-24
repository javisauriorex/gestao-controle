import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, hashSenha } from "../lib/auth.js";

export default async function usuariosMeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    return jsonResponse({ ok: true, usuario });
  }

  // Define ou troca a senha. Útil sobretudo pra quem entrou via Google e
  // ainda não tem senha própria — assim consegue entrar mesmo sem o Google
  // (ex: se perder acesso à conta Google), e o navegador oferece salvar
  // a senha no Google Password Manager.
  if (req.method === "PATCH") {
    const { novaSenha } = await req.json();
    if (!novaSenha || novaSenha.length < 6) {
      return jsonResponse({ ok: false, error: "a senha precisa ter ao menos 6 caracteres" }, 400);
    }
    const sql = getSql(env);
    const senhaHash = await hashSenha(novaSenha);
    await sql`UPDATE usuarios SET senha_hash = ${senhaHash} WHERE id = ${usuario.id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
