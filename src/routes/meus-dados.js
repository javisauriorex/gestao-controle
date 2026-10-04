import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";

// ============================================================
// GET /api/meus-dados — "Exportar meus dados" (LGPD art. 18, II e V: acesso e portabilidade).
// Cada pessoa recebe os SEUS dados: cadastro, obras em que participa, presenças, o que escreveu,
// pedidos, arquivos que enviou e registros de acesso. Não traz dados de outras pessoas além do
// nome da outra parte num pedido. (Os dados da empresa inteira ficam no "Backup de tudo" do Dono.)
// ============================================================

export default async function meusDadosHandler(req, env) {
  if (req.method !== "GET") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const u = await getUsuario(req, env);
  if (!u) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);

  const [empresa] = await sql`SELECT nome FROM empresas WHERE id = ${u.empresa_id}`;
  const obras = await sql`
    SELECT o.cliente AS obra, o.endereco, o.estado, e.funcao, e.asistencias AS presencas, e.criado_em AS entrou_em
    FROM equipe e JOIN obras o ON o.id = e.obra_id WHERE e.usuario_id = ${u.id} ORDER BY o.id
  `;
  const observacoes = await sql`
    SELECT ob.cliente AS obra, o.texto, o.criado_em, o.editado_em,
      COALESCE((SELECT json_agg(json_build_object('texto', h.texto, 'substituido_em', h.substituido_em) ORDER BY h.id)
                FROM observacoes_historico h WHERE h.observacao_id = o.id), '[]') AS versoes_anteriores
    FROM observacoes o JOIN obras ob ON ob.id = o.obra_id WHERE o.criado_por = ${u.id} ORDER BY o.id
  `;
  const pedidos = await sql`
    SELECT ob.cliente AS obra, p.tipo, p.descricao, p.quantidade, p.status, p.criado_em, p.atendido_em,
      CASE WHEN p.remetente_id = ${u.id} THEN 'entregou' ELSE 'recebeu' END AS papel,
      CASE WHEN p.remetente_id = ${u.id} THEN ud.nome ELSE ur.nome END AS outra_pessoa
    FROM pedidos p JOIN obras ob ON ob.id = p.obra_id
    JOIN usuarios ur ON ur.id = p.remetente_id JOIN usuarios ud ON ud.id = p.destinatario_id
    WHERE p.remetente_id = ${u.id} OR p.destinatario_id = ${u.id} ORDER BY p.id
  `;
  const etapas = await sql`
    SELECT ob.cliente AS obra, e.texto,
      (e.criado_por = ${u.id}) AS criada_por_voce, CASE WHEN e.concluida_por = ${u.id} THEN e.concluida_em END AS concluida_por_voce_em
    FROM etapas e JOIN obras ob ON ob.id = e.obra_id
    WHERE e.criado_por = ${u.id} OR e.concluida_por = ${u.id} ORDER BY e.id
  `;
  const itens = await sql`
    SELECT 'material' AS tipo, ob.cliente AS obra, m.texto, m.criado_em FROM materiais m JOIN obras ob ON ob.id = m.obra_id WHERE m.criado_por = ${u.id}
    UNION ALL
    SELECT 'ferramenta', ob.cliente, f.texto, f.criado_em FROM ferramentas f JOIN obras ob ON ob.id = f.obra_id WHERE f.criado_por = ${u.id}
    ORDER BY criado_em
  `;
  const arquivos = await sql`
    SELECT 'documento' AS tipo, ob.cliente AS obra, d.nome, d.criado_em FROM documentos d JOIN obras ob ON ob.id = d.obra_id WHERE d.criado_por = ${u.id}
    UNION ALL
    SELECT 'foto de avanço', ob.cliente, et.texto, f.criado_em FROM etapa_fotos f JOIN etapas et ON et.id = f.etapa_id JOIN obras ob ON ob.id = et.obra_id WHERE f.criado_por = ${u.id}
    ORDER BY criado_em
  `;
  const acessos = await sql`
    SELECT criado_em AS quando, metodo AS como, ip FROM acessos WHERE usuario_id = ${u.id} ORDER BY id DESC LIMIT 500
  `;

  const cpfMascarado = u.cpf ? `${u.cpf.slice(0, 3)}.***.***-${u.cpf.slice(9)}` : (u.cpf_mascarado || null);
  return jsonResponse({
    ok: true,
    gerado_em: new Date().toISOString(),
    sobre: "Seus dados no Gestão & Controle (LGPD, art. 18). Fotos e documentos aparecem pelo nome; o conteúdo fica disponível no aplicativo. Dúvidas: info@gestaoecontrole.app.br",
    cadastro: {
      nome: u.nome, email: u.email, email_confirmado: !!u.email_verificado, cpf: cpfMascarado, telefone: u.telefone,
      empresa: empresa ? empresa.nome : null, rank: u.rank, conta_criada_em: u.criado_em,
      entra_com_senha: !!u.senha_hash, entra_com_pin: !!u.pin_hash,
      termos_aceitos: u.termos_versao ? { versao: u.termos_versao, em: u.termos_aceito_em } : null,
    },
    obras, observacoes, pedidos, etapas, materiais_e_ferramentas: itens, arquivos_enviados: arquivos,
    registros_de_acesso: acessos,
  });
}
