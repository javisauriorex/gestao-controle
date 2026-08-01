import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, getNivel, nivelEfetivo, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const nivel = nivelEfetivo(await getNivel(usuario.empresa_id, usuario.rank, "etapas"), usuario.excecao_modulos, "etapas");

  if (req.method === "GET") {
    if (nivel === "nenhum") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const etapas = await sql`SELECT * FROM etapas WHERE obra_id = ${obraId} ORDER BY id`;
    return jsonResponse({ ok: true, etapas });
  }

  if (req.method === "POST") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { obraId, parentId, texto } = await req.json();
    if (!obraId || !texto) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const rows = await sql`
      INSERT INTO etapas (obra_id, parent_id, texto, criado_por)
      VALUES (${obraId}, ${parentId || null}, ${texto}, ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, etapa: rows[0] });
  }

  if (req.method === "PATCH") {
    if (nivel !== "editar") return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const body = await req.json();
    const atuais = await sql`
      SELECT e.*, u.rank as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;
    if (atuais.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario, atuais[0].rank_criador, atuais[0].criado_por)) {
      return jsonResponse({ ok: false, error: "não pode modificar o que um escalão superior criou" }, 403);
    }

    if (body.texto !== undefined) {
      const rows = await sql`UPDATE etapas SET texto = ${body.texto} WHERE id = ${id} RETURNING *`;
      return jsonResponse({ ok: true, etapa: rows[0] });
    }

    const rows = await sql`
      UPDATE etapas SET
        concluida = ${!!body.concluida},
        foto_conclusao_id = ${body.fotoConclusaoId || null},
        concluida_por = ${body.concluida ? usuario.id : null},
        concluida_em = ${body.concluida ? new Date().toISOString() : null}
      WHERE id = ${id}
      RETURNING *
    `;
    return jsonResponse({ ok: true, etapa: rows[0] });
  }

  if
