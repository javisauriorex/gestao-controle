import { getSql } from "../lib/db.js";
import { registrarEvento } from "../lib/eventos.js";
import { getUsuario, jsonResponse, podeCrear } from "../lib/auth.js";
import { veTodasAsObras } from "../lib/acesso.js";
import { apagarDoKV } from "../lib/arquivos.js";

export default async function obrasHandler(req, env, ctx) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

  if (req.method === "GET") {
    // Dono, Eng. Chefe e Eng. Estagiário (rank 1-3) veem todas as obras da empresa;
    // do Mestre para baixo, só as obras em que estão na equipe.
    const obras =
      veTodasAsObras(usuario)
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
    // Criar obra: Dono, Eng. Chefe e Mestre de Obra (o Estagiário só acompanha).
    if (![1, 2, 4].includes(usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const { cliente, endereco, tipo, dataInicio, responsavelId } = await req.json();
    if (!cliente) return jsonResponse({ ok: false, error: "cliente é obrigatório" }, 400);
    if (responsavelId && !(await ativoNaEmpresa(sql, responsavelId, usuario.empresa_id))) {
      return jsonResponse({ ok: false, error: "responsável inválido" }, 400);
    }
    // Uma consulta só (C1): a obra nasce já com quem criou e o responsável na equipe
    // (senão deixariam de ver a obra) — ou não nasce.
    const membros = [...new Set([usuario.id, Number(responsavelId || usuario.id)])];
    const rows = await sql`
      WITH o AS (
        INSERT INTO obras (empresa_id, cliente, endereco, tipo, data_inicio, estado, criado_por, responsavel_id)
        VALUES (${usuario.empresa_id}, ${cliente}, ${endereco || ""}, ${tipo || ""}, ${dataInicio || null}, 'ativa', ${usuario.id}, ${responsavelId || usuario.id})
        RETURNING *
      ), e AS (
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        SELECT o.id, m, '', ${usuario.id} FROM o, unnest(${membros}::int[]) AS m
        ON CONFLICT (obra_id, usuario_id) DO NOTHING
      )
      SELECT * FROM o
    `;
    const obra = rows[0];
    return jsonResponse({ ok: true, obra });
  }

  if (req.method === "PATCH") {
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = new URL(req.url).searchParams.get("id");
    const {
      estado = null,
      novoResponsavelId = null,
      cliente = null,
      endereco = null,
      tipo = null,
    } = await req.json();
    if (novoResponsavelId && !(await ativoNaEmpresa(sql, novoResponsavelId, usuario.empresa_id))) {
      return jsonResponse({ ok: false, error: "responsável inválido" }, 400);
    }
    // COALESCE: só atualiza os campos que vieram preenchidos, deixa o resto como estava.
    const rows = await sql`
      UPDATE obras SET
        estado = COALESCE(${estado}, estado),
        responsavel_id = COALESCE(${novoResponsavelId}, responsavel_id),
        cliente = COALESCE(${cliente}, cliente),
        endereco = COALESCE(${endereco}, endereco),
        tipo = COALESCE(${tipo}, tipo)
      WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}
      RETURNING *
    `;
    if (rows.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    if (estado) {
      const NOME = { ativa: "ATIVA", pausada: "PAUSADA", concluida: "CONCLUÍDA" };
      await registrarEvento(sql, usuario, { env, ctx }, { obraId: Number(id), categoria: "obra", acao: "estado", alvoId: Number(id), texto: `mudou a obra para ${NOME[estado] || estado}` });
    }
    if (novoResponsavelId) {
      // O novo responsável entra na equipe da obra, se ainda não estiver.
      await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${rows[0].id}, ${novoResponsavelId}, ${""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO NOTHING
      `;
    }
    return jsonResponse({ ok: true, obra: rows[0] });
  }

  if (req.method === "DELETE") {
    // Apagar uma obra inteira (etapas, fotos, documentos...) é só para Dono e Eng. Chefe.
    if (!podeCrear(2, usuario.rank)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    const doEmpresa = await sql`SELECT id FROM obras WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}`;
    if (doEmpresa.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    // Arquivos (documentos e fotos) da obra também saem do armazenamento.
    const arquivos = await sql`
      SELECT arquivo_id FROM documentos WHERE obra_id = ${id}
      UNION SELECT f.arquivo_id FROM etapa_fotos f JOIN etapas e ON e.id = f.etapa_id WHERE e.obra_id = ${id}
      UNION SELECT foto_conclusao_id FROM etapas WHERE obra_id = ${id} AND foto_conclusao_id IS NOT NULL
    `;
    await sql`DELETE FROM obras WHERE id = ${id} AND empresa_id = ${usuario.empresa_id}`;
    await apagarDoKV(env, arquivos.map((r) => r.arquivo_id));
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}

async function ativoNaEmpresa(sql, usuarioId, empresaId) {
  const r = await sql`SELECT id FROM usuarios WHERE id = ${usuarioId} AND empresa_id = ${empresaId} AND removido_em IS NULL`;
  return r.length > 0;
}
