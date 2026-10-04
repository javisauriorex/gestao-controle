import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";
import { enviarEmail } from "../lib/email.js";

// POST /api/sugestao { texto } — "Sugestões de fluxo de informação?" (tela Permissões).
// Guarda a sugestão e manda um e-mail para suporte@. Até 3 por pessoa por dia.
const SUPORTE = "suporte@gestaoecontrole.app.br";
const MAX_POR_DIA = 3;
const RANKS = { 1: "Dono", 2: "Engenheiro Chefe de Obra", 3: "Engenheiro Estagiário", 4: "Mestre de Obra", 5: "Encarregado", 6: "Almoxarife", 7: "Chefe de Turma", 8: "Profissional" };

export default async function sugestaoHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  let body = {};
  try { body = await req.json(); } catch {}
  const texto = String(body.texto || "").trim().slice(0, 3000);
  if (texto.length < 5) return jsonResponse({ ok: false, error: "Escreva sua sugestão." }, 400);
  const sql = getSql(env);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM sugestoes WHERE usuario_id = ${usuario.id} AND criado_em > now() - interval '1 day'`;
  if (n >= MAX_POR_DIA) return jsonResponse({ ok: false, error: "Você já mandou 3 sugestões hoje. Obrigado! Tente amanhã." }, 429);
  const emp = await sql`SELECT nome FROM empresas WHERE id = ${usuario.empresa_id}`;
  await sql`INSERT INTO sugestoes (empresa_id, usuario_id, texto) VALUES (${usuario.empresa_id}, ${usuario.id}, ${texto})`;
  const enviado = await enviarEmail(env, {
    para: SUPORTE,
    assunto: `Sugestão de fluxo de informação — ${emp[0]?.nome || "empresa " + usuario.empresa_id}`,
    texto: `Sugestão enviada pela tela Permissões do G&C.\n\nDe: ${usuario.nome || "(sem nome)"} · ${RANKS[usuario.rank] || "rank " + usuario.rank}\nE-mail: ${usuario.email || "(entra com CPF)"}\nEmpresa: ${emp[0]?.nome || usuario.empresa_id} (id ${usuario.empresa_id}) · usuário id ${usuario.id}\n\n---\n${texto}\n---`,
  });
  return jsonResponse({ ok: true, enviado });
}
