import { getUsuario, jsonResponse } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  return jsonResponse({ ok: true, usuario });
};

export const config = { path: "/api/usuarios-me" };
