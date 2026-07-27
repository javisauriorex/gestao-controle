import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) return jsonResponse({ ok: false, error: "obra_id é obrigatório" }, 400);
    const etapas = await sql`SELECT * FROM etapas WHERE obra_id = ${obraId} ORDER BY id`;
    return jsonResponse({ ok: true, etapas });
  }

  if (req.method === "POST") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
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
    // Puede venir { texto } para renombrar, o { concluida, fotoConclusaoId } para marcar concluída.
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const body = await req.json();
    const atuais = await sql`
      SELECT e.*, u.rank as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;
    if (atuais.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario.rank, atuais[0].rank_criador)) {
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

  if (req.method === "DELETE") {
    if (!podeCrear(3, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = url.searchParams.get("id");
    const alvos = await sql`
      SELECT e.*, u.rank as rank_criador FROM etapas e JOIN usuarios u ON u.id = e.criado_por WHERE e.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (!podeModificar(usuario.rank, alvos[0].rank_criador)) {
      return jsonResponse({ ok: false, error: "não pode apagar o que um escalão superior criou" }, 403);
    }
    await sql`DELETE FROM etapas WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/etapas" };
