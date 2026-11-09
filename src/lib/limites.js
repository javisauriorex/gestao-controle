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

// IP de quem chamou (o Cloudflare preenche cf-connecting-ip; ninguém consegue falsificar).
// IPv6: agrupamos pela rede /64 — cada casa/celular recebe milhões de endereços dentro dela,
// e sem isso daria para trocar de IP a cada tentativa.
export function ipDe(req) {
  const ip = req.headers.get("cf-connecting-ip") || "sem-ip";
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + "::/64";
  return ip;
}

// ---- Contadores genéricos (tabela contadores, Bloco D) ----
// Soma 1 uso na janela atual ("hora" ou "dia") e devolve true se PASSOU do limite.
export async function excedeu(sql, chave, limite, janela = "dia") {
  const unidade = janela === "hora" ? "hour" : "day";
  const [r] = await sql`
    INSERT INTO contadores (chave, janela, n) VALUES (${chave}, date_trunc(${unidade}, now()), 1)
    ON CONFLICT (chave, janela) DO UPDATE SET n = contadores.n + 1
    RETURNING n
  `;
  return r.n > limite;
}

// ---- Tentativas de PIN / senha sem "corrida" (Bloco D, achado A2) ----
// Reserva a tentativa ANTES de conferir: um UPDATE atômico soma 1 e devolve o total.
// Mil pedidos ao mesmo tempo recebem 1, 2, 3... — do 6º em diante já nem são conferidos.
// Devolve { bloqueado: true } se a conta já está bloqueada, ou { n } = número desta tentativa.
export async function reservarTentativa(sql, usuarioId, tipo) {
  const rows = tipo === "pin"
    ? await sql`UPDATE usuarios SET pin_tentativas = COALESCE(pin_tentativas, 0) + 1
        WHERE id = ${usuarioId} AND (pin_bloqueado_ate IS NULL OR pin_bloqueado_ate <= now())
        RETURNING pin_tentativas AS n, COALESCE(pin_rodadas, 0) AS rodadas`
    : await sql`UPDATE usuarios SET login_tentativas = COALESCE(login_tentativas, 0) + 1
        WHERE id = ${usuarioId} AND (login_bloqueado_ate IS NULL OR login_bloqueado_ate <= now())
        RETURNING login_tentativas AS n, COALESCE(login_rodadas, 0) AS rodadas`;
  if (rows.length === 0) return { bloqueado: true };
  return { n: rows[0].n, rodadas: rows[0].rodadas };
}

// Bloqueia a conta (progressivo: 15 min → 1 h → 24 h). Devolve os minutos.
export async function bloquearTentativas(sql, usuarioId, tipo, rodadas, duracaoBloqueioMin) {
  const min = duracaoBloqueioMin(rodadas);
  if (tipo === "pin") {
    await sql`UPDATE usuarios SET pin_tentativas = 0, pin_rodadas = ${rodadas + 1},
      pin_bloqueado_ate = now() + (${min} * interval '1 minute')
      WHERE id = ${usuarioId} AND (pin_bloqueado_ate IS NULL OR pin_bloqueado_ate <= now())`;
  } else {
    await sql`UPDATE usuarios SET login_tentativas = 0, login_rodadas = ${rodadas + 1},
      login_bloqueado_ate = now() + (${min} * interval '1 minute')
      WHERE id = ${usuarioId} AND (login_bloqueado_ate IS NULL OR login_bloqueado_ate <= now())`;
  }
  return min;
}

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

export async function registrarUpload(sql, usuario, arquivoId = null) {
  await sql`INSERT INTO uploads (usuario_id, empresa_id, arquivo_id) VALUES (${usuario.id}, ${usuario.empresa_id}, ${arquivoId})`;
}

// Teto do app inteiro por dia (D2): o plano grátis do KV aceita ~1.000 gravações/dia; deixamos folga
// para apagar arquivos e para o faxineiro.
export const LIMITE_UPLOADS_TOTAL_DIA = 600;

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
