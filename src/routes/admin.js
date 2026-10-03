import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";
import { apagarDoKV } from "../lib/arquivos.js";

// Painel do administrador do G&C (página /admin). Só para os e-mails em ADMIN_EMAILS.
//   GET    /api/admin                         → empresas com números de uso + leads da feira
//   DELETE /api/admin?empresa_id=N  {confirmar} → encerra a empresa: obras, pessoas, arquivos do KV
// O registro de acessos (Marco Civil, 6 meses) fica: o vínculo com a pessoa vira NULL.

const ADMIN_PADRAO = "marcelojavierbonet@gmail.com";

function ehAdmin(usuario, env) {
  const lista = String(env.ADMIN_EMAILS || ADMIN_PADRAO).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  // S3: e-mail tem que estar comprovado (Google). Senão, bastaria cadastrar o e-mail do admin com uma senha qualquer.
  return !!usuario?.email && usuario.email_verificado === true && lista.includes(usuario.email.toLowerCase());
}

export default async function adminHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (!ehAdmin(usuario, env)) return jsonResponse({ ok: false, error: "sem permissão" }, 403);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const empresas = await sql`
      SELECT
        e.id, e.nome, e.criado_em,
        d.nome AS dono_nome, d.email AS dono_email,
        (SELECT count(*)::int FROM usuarios u WHERE u.empresa_id = e.id AND u.removido_em IS NULL) AS pessoas,
        (SELECT count(*)::int FROM usuarios u WHERE u.empresa_id = e.id AND u.removido_em IS NULL AND u.rank <= 5) AS chefes,
        (SELECT count(*)::int FROM convites c WHERE c.empresa_id = e.id AND NOT coalesce(c.aceito, false) AND (c.expira_em IS NULL OR c.expira_em > now())) AS convites_pendentes,
        (SELECT count(*)::int FROM obras o WHERE o.empresa_id = e.id) AS obras,
        (SELECT count(*)::int FROM obras o WHERE o.empresa_id = e.id AND coalesce(o.estado, 'ativa') = 'ativa') AS obras_ativas,
        (SELECT count(*)::int FROM etapas t JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = e.id) AS etapas,
        (SELECT count(*)::int FROM etapas t JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = e.id AND t.concluida) AS etapas_concluidas,
        (SELECT count(*)::int FROM etapa_fotos f JOIN etapas t ON t.id = f.etapa_id JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = e.id) AS fotos,
        (SELECT count(*)::int FROM documentos x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id) AS documentos,
        (SELECT count(*)::int FROM observacoes x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id) AS observacoes,
        (SELECT count(*)::int FROM pedidos x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id) AS pedidos,
        (SELECT count(*)::int FROM acessos a JOIN usuarios u ON u.id = a.usuario_id WHERE u.empresa_id = e.id AND a.criado_em > now() - interval '7 days') AS logins_7d,
        (SELECT count(*)::int FROM acessos a JOIN usuarios u ON u.id = a.usuario_id WHERE u.empresa_id = e.id AND a.criado_em > now() - interval '30 days') AS logins_30d,
        (SELECT count(DISTINCT a.usuario_id)::int FROM acessos a JOIN usuarios u ON u.id = a.usuario_id WHERE u.empresa_id = e.id AND a.criado_em > now() - interval '30 days') AS pessoas_ativas_30d,
        (SELECT max(a.criado_em) FROM acessos a JOIN usuarios u ON u.id = a.usuario_id WHERE u.empresa_id = e.id) AS ultimo_login,
        GREATEST(
          (SELECT max(o.criado_em) FROM obras o WHERE o.empresa_id = e.id),
          (SELECT max(greatest(t.criado_em, t.concluida_em)) FROM etapas t JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = e.id),
          (SELECT max(f.criado_em) FROM etapa_fotos f JOIN etapas t ON t.id = f.etapa_id JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = e.id),
          (SELECT max(x.criado_em) FROM documentos x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id),
          (SELECT max(greatest(x.criado_em, x.editado_em)) FROM observacoes x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id),
          (SELECT max(x.criado_em) FROM materiais x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id),
          (SELECT max(x.criado_em) FROM ferramentas x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id),
          (SELECT max(greatest(x.criado_em, x.atendido_em)) FROM pedidos x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = e.id)
        ) AS ultima_atividade
      FROM empresas e
      LEFT JOIN LATERAL (
        SELECT nome, email FROM usuarios u WHERE u.empresa_id = e.id AND u.rank = 1 AND u.removido_em IS NULL ORDER BY u.id LIMIT 1
      ) d ON true
      ORDER BY e.criado_em DESC
    `;
    const leads = await sql`SELECT id, nome, empresa, contato, origem, criado_em FROM leads ORDER BY criado_em DESC`;
    return jsonResponse({ ok: true, empresas, leads, minhaEmpresa: usuario.empresa_id, agora: new Date().toISOString() });
  }

  if (req.method === "DELETE") {
    const empresaId = Number(url.searchParams.get("empresa_id"));
    if (!empresaId) return jsonResponse({ ok: false, error: "empresa_id é obrigatório" }, 400);
    if (empresaId === usuario.empresa_id) return jsonResponse({ ok: false, error: "não dá para encerrar a sua própria empresa por aqui" }, 400);
    let body = {};
    try { body = await req.json(); } catch {}
    const alvo = await sql`SELECT id, nome FROM empresas WHERE id = ${empresaId}`;
    if (alvo.length === 0) return jsonResponse({ ok: false, error: "empresa não encontrada" }, 404);
    // Confirmação simples: digitar ELIMINA (em maiúsculas).
    if (String(body.confirmar || "").trim() !== "ELIMINA") {
      return jsonResponse({ ok: false, error: "confirmação não confere: digite ELIMINA" }, 400);
    }
    // Arquivos no KV (fotos, documentos, foto de conclusão) — juntar ANTES de apagar as linhas.
    const arquivos = await sql`
      SELECT x.arquivo_id AS id FROM documentos x JOIN obras o ON o.id = x.obra_id WHERE o.empresa_id = ${empresaId}
      UNION SELECT f.arquivo_id FROM etapa_fotos f JOIN etapas t ON t.id = f.etapa_id JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = ${empresaId}
      UNION SELECT t.foto_conclusao_id FROM etapas t JOIN obras o ON o.id = t.obra_id WHERE o.empresa_id = ${empresaId} AND t.foto_conclusao_id IS NOT NULL
    `;
    // Ordem importa: obras primeiro (leva equipe, etapas, fotos, documentos, pedidos, observações),
    // depois a empresa (leva pessoas, convites, permissões). Acessos ficam, sem vínculo (ON DELETE SET NULL).
    await sql`DELETE FROM obras WHERE empresa_id = ${empresaId}`;
    await sql`DELETE FROM empresas WHERE id = ${empresaId}`;
    await apagarDoKV(env, arquivos.map((r) => r.id));
    console.log("admin: empresa encerrada", { empresaId, nome: alvo[0].nome, arquivos: arquivos.length, por: usuario.email });
    return jsonResponse({ ok: true, arquivosApagados: arquivos.length });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
