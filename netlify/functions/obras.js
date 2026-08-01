import { sql } from "./lib/db.js";
import { getUsuario, jsonResponse, podeCrear, podeModificar } from "./lib/auth.js";

export default async (req) => {
  const usuario = await getUsuario(req);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    // Só o Dono (rank 1) vê todas as obras da empresa por padrão; os demais precisam
    // estar em Equipe de cada obra específica para vê-la.
    const obras =
      usuario.rank === 1
        ? await sql`SELECT * FROM obras WHERE empresa_id = ${usuario.empresa_id} ORDER BY id DESC`
        : await sql`
            SELECT o.* FROM obras o
            JOIN equipe e ON e.obra_id = o.id
            WHERE o.empresa_id = ${usuario.empresa_id} AND e.usuario_id = ${usuario.id}
            ORDER BY o.id DESC
          `;
    return jsonResponse({ ok: true, obras });
  }

  if (req.method === "POST") {
    // Quem pode criar obra: Dono, Engenheiro Chefe de Obra, Engenheiro Estagiário (ranks 1-3).
    if (!podeCrear(3, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { cliente, endereco, tipo, dataInicio } = await req.json();
    if (!cliente) return jsonResponse({ ok: false, error: "cliente é obrigatório" }, 400);
    const rows = await sql`
      INSERT INTO obras (empresa_id, cliente, endereco, tipo, data_inicio, estado, criado_por, responsavel_id)
      VALUES (${usuario.empresa_id}, ${cliente}, ${endereco || ""}, ${tipo || ""}, ${dataInicio || null}, 'ativa', ${usuario.id}, ${usuario.id})
      RETURNING *
    `;
    return jsonResponse({ ok: true, obra: rows[0] });
  }

  if (req.method === "PATCH") {
    const id = new URL(req.url).searchParams.get("id");
    const body = await req.json();

    if (body.novoResponsavelId !== undefined) {
      const atuais = await sql`
        SELECT o.*, u.rank as rank_responsavel FROM obras o
        JOIN usuarios u ON u.id = o.responsavel_id
        WHERE o.id = ${id} AND o.empresa_id = ${usuario.empresa_id}
      `;
      if (atuais.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      if (!podeModificar(usuario, atuais[0].rank_responsavel, atuais[0].responsavel_id)) {
        return jsonResponse({ ok: false, error: "não pode transferir — só quem tem rank igual (mais antigo) ou superior ao responsável atual" }, 403);
      }
      const novos = await sql`SELECT * FROM usuarios WHERE id = ${body.novoResponsavelId} AND empresa_id = ${usuario.empresa_id}`;
      if (novos.length === 0) return jsonResponse({ ok: false, error: "usuário não pertence a esta empresa" }, 400);
      const rows = await sql`UPDATE obras SET responsavel_id = ${body.novoResponsavelId} WHERE id = ${id} RETURNING *`;
      return jsonResponse({ ok: true, obra: rows[0] });
    }

    // Cambiar estado: cualquiera que tenga nível "editar" en Etapas puede (mismo criterio operativo).
    if (!podeCrear(5, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const rows = await sql`
      UPDATE obras SET estado = ${body.estado} WHERE id = ${id} AND empresa_id = ${usuario.empresa_id} RETURNING *
    `;
    if (rows.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    return jsonResponse({ ok: true, obra: rows[0] });
  }

  if (req.method === "DELETE") {
    if (!podeCrear(3, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    await sql`DELETE FROM obras WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
};

export const config = { path: "/api/obras" };
