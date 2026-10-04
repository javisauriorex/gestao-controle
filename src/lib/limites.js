// ============================================================
// Freios contra abuso (Bloco B).
//  1) Subidas de arquivos: no máximo 20 por EMPRESA e 10 por PESSOA por dia (fotos + documentos juntos).
//     O plano grátis do Cloudflare permite ~1.000 gravações por dia para o app inteiro.
//  2) Erros de login por IP: muitas senhas/PINs errados vindos da mesma rede, em contas diferentes,
//     bloqueiam essa rede por 1 hora (impede testar PINs em massa com listas de CPF vazadas).
//  3) Cadastros por IP: no máximo 5 empresas novas por hora vindas da mesma rede.
// "Dia" = dia no horário de Brasília.
// ============================================================

export const LIMITE_UPLOADS_EMPRESA_DIA = 20;
export const LIMITE_UPLOADS_PESSOA_DIA = 10;
export const LIMITE_FALHAS_IP_HORA = 30;
export const LIMITE_CADASTROS_IP_HORA = 5;

export const ipDe = (req) => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "sem-ip";

// Devolve a mensagem de erro se passou do limite; senão null.
export async function problemaLimiteUpload(sql, usuario) {
  const [r] = await sql`
    SELECT
      count(*) FILTER (WHERE empresa_id = ${usuario.empresa_id})::int AS empresa,
      count(*) FILTER (WHERE usuario_id = ${usuario.id})::int AS pessoa
    FROM uploads
    WHERE criado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
      AND (empresa_id = ${usuario.empresa_id} OR usuario_id = ${usuario.id})
  `;
  if (r.pessoa >= LIMITE_UPLOADS_PESSOA_DIA) return `Você chegou ao limite de ${LIMITE_UPLOADS_PESSOA_DIA} arquivos (fotos e documentos) por dia. Amanhã libera de novo.`;
  if (r.empresa >= LIMITE_UPLOADS_EMPRESA_DIA) return `A empresa chegou ao limite de ${LIMITE_UPLOADS_EMPRESA_DIA} arquivos (fotos e documentos) por dia. Amanhã libera de novo.`;
  return null;
}

export async function registrarUpload(sql, usuario) {
  await sql`INSERT INTO uploads (usuario_id, empresa_id) VALUES (${usuario.id}, ${usuario.empresa_id})`;
}

export async function falhasDoIp(sql, req) {
  const [r] = await sql`SELECT count(*)::int AS n FROM falhas_login WHERE ip = ${ipDe(req)} AND criado_em > now() - interval '1 hour'`;
  return r.n;
}

export async function ipBloqueado(sql, req) {
  const [r] = await sql`SELECT count(*)::int AS n FROM falhas_login WHERE ip = ${ipDe(req)} AND criado_em > now() - interval '1 hour'`;
  return r.n >= LIMITE_FALHAS_IP_HORA;
}

export async function registrarFalha(sql, req) {
  try { await sql`INSERT INTO falhas_login (ip) VALUES (${ipDe(req)})`; } catch (e) { console.error("registrarFalha", e); }
}

export async function cadastrosDemaisDoIp(sql, req) {
  const [r] = await sql`
    SELECT count(*)::int AS n FROM acessos WHERE metodo = 'cadastro' AND ip = ${ipDe(req)} AND criado_em > now() - interval '1 hour'
  `;
  return r.n >= LIMITE_CADASTROS_IP_HORA;
}

export const MSG_IP_BLOQUEADO = "Muitas tentativas erradas a partir desta rede. Por segurança, espere 1 hora e tente de novo.";
