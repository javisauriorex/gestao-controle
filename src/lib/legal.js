// ============================================================
// Coisas exigidas por lei (LGPD / Marco Civil) num lugar só.
// ============================================================

// Versão vigente dos Termos de Uso + Política de Privacidade.
// Mudou o texto de forma relevante? Suba a versão: todos terão que aceitar de novo.
export const TERMOS_VERSAO = "1.0";

// Marco Civil art. 15: guardar IP + data/hora dos acessos por 6 meses.
// Aproveita a chamada para fazer a faxina legal (logs velhos e convites vencidos).
export async function registrarAcesso(sql, req, usuarioId, metodo) {
  try {
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || null;
    const ua = (req.headers.get("user-agent") || "").slice(0, 300);
    await sql`INSERT INTO acessos (usuario_id, metodo, ip, user_agent) VALUES (${usuarioId}, ${metodo}, ${ip}, ${ua})`;
    await faxina(sql);
  } catch (e) {
    console.error("registrarAcesso falhou", e); // nunca impede o login
  }
}

async function faxina(sql) {
  await sql`DELETE FROM acessos WHERE criado_em < now() - interval '180 days'`;
  await sql`DELETE FROM convites WHERE expira_em IS NOT NULL AND expira_em < now() - interval '30 days'`;
  await sql`DELETE FROM convites WHERE expira_em IS NULL AND criado_em < now() - interval '37 days'`;
}

// Bloqueio progressivo: 5 erros → 15 min; a próxima rodada → 1 h; depois → 24 h.
// Zera quando a pessoa acerta.
export const MAX_TENTATIVAS = 5;
const DURACOES_MIN = [15, 60, 24 * 60];
export function duracaoBloqueioMin(rodadas) {
  return DURACOES_MIN[Math.min(rodadas, DURACOES_MIN.length - 1)];
}
export function textoEspera(ate) {
  const min = Math.ceil((new Date(ate) - new Date()) / 60000);
  return min >= 120 ? `${Math.ceil(min / 60)} horas` : `${min} min`;
}
