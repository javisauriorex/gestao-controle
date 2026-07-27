import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeAsignarRank, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank FROM equipe e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.obra_id = ${obraId}
      ORDER BY e.id
    `;
    return jsonResponse({ ok: true, equipe });
  }

  if (req.method === "POST") {
    // Gestionar equipe: cualquiera con rank >= 2 (encarregado y arriba).
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, email, rank, funcao } = await req.json();
    if (!obraId || !email) return jsonResponse({ ok: false, error: "faltam dados" }, 400);

    const emailNorm = email.toLowerCase();
    const existentes = await sql`SELECT * FROM usuarios WHERE email = ${emailNorm}`;

    if (existentes.length > 0) {
      // Ya es usuario de la empresa: su rank ya está fijado, acá solo lo sumamos a esta obra.
      const membro = existentes[0];
      if (membro.empresa_id !==
