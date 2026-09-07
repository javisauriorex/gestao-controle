import { getUsuario, jsonResponse } from "../lib/auth.js";

export default async function usuariosMeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  return jsonResponse({ ok: true, usuario });
}
