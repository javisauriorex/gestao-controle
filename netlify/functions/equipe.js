import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, getNivel, nivelEfetivo, podeAsignarRank, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const nivel = nivelEfetivo(await getNivel(usuario.empresa_id, usuario.rank, "equipe"), usuario.excecao_modulos, "equipe");

  if (req.method === "GET") {
    if (nivel === "nenhum") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank, u.excecao_modulos FROM equipe e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.obra_id = ${obraId}
      ORDER BY e.id
    `;
    return jsonResponse({ ok: true, equipe });
  }

  if (req.method === "POST") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, email, rank, funcao } = await req.json();
    if (!obraId || !email) return jsonResponse({ ok: false, error: "faltam dados" }, 400);

    const emailNorm = email.toLowerCase();
    const existentes = await sql`SELECT * FROM usuarios WHERE email = ${emailNorm}`;

    if (existentes.length > 0) {
      const membro = existentes[0];
      if (membro.empresa_id !== usuario.empresa_id) {
        return jsonResponse({ ok: false, error: "este email já pertence a outra empresa" }, 409);
      }
      const rows = await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${obraId}, ${membro.id}, ${funcao || ""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO UPDATE SET
