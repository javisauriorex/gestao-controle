import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse } from "../lib/auth.js";

// POST /api/encerrar-empresa — o Dono pede o encerramento da empresa.
// O próprio servidor manda o e-mail ao suporte (Cloudflare Email Routing → binding EMAIL),
// em vez de depender do programa de e-mail do aparelho (o mailto: falhava em computador sem e-mail configurado).
// Nada é apagado aqui: o suporte confirma a identidade e faz o encerramento à mão (até 15 dias).

const REMETENTE = "app@gestaoecontrole.app.br";
const DESTINO = "marcelojavierbonet@gmail.com"; // caixa verificada no Email Routing (suporte@ reenvia para cá)

function b64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function montarMime({ de, para, responderPara, assunto, corpo }) {
  const id = `<${crypto.randomUUID()}@gestaoecontrole.app.br>`;
  const corpoB64 = b64(corpo).replace(/.{1,76}/g, (l) => l + "\r\n");
  return [
    `From: G&C <${de}>`,
    `To: ${para}`,
    responderPara ? `Reply-To: ${responderPara}` : null,
    `Subject: =?UTF-8?B?${b64(assunto)}?=`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    corpoB64,
  ].filter((l) => l !== null).join("\r\n");
}

export default async function encerrarEmpresaHandler(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (usuario.rank !== 1) return jsonResponse({ ok: false, error: "só o Dono pode pedir o encerramento da empresa" }, 403);
  if (!env.EMAIL) return jsonResponse({ ok: false, error: "envio de e-mail indisponível" }, 503);

  const sql = getSql(env);
  const empresas = await sql`SELECT nome FROM empresas WHERE id = ${usuario.empresa_id}`;
  const [{ total: obras }] = await sql`SELECT count(*)::int AS total FROM obras WHERE empresa_id = ${usuario.empresa_id}`;
  const [{ total: pessoas }] = await sql`SELECT count(*)::int AS total FROM usuarios WHERE empresa_id = ${usuario.empresa_id} AND removido_em IS NULL`;
  const ip = req.headers.get("cf-connecting-ip") || "?";

  const corpo = [
    "PEDIDO DE ENCERRAMENTO DE EMPRESA — G&C",
    "",
    `Empresa: ${empresas[0]?.nome || "?"} (id ${usuario.empresa_id})`,
    `Dono: ${usuario.nome || "?"} (usuário id ${usuario.id})`,
    `E-mail da conta: ${usuario.email || "(sem e-mail)"}`,
    `Obras: ${obras} · Pessoas ativas: ${pessoas}`,
    `Pedido em: ${new Date().toISOString()} · IP ${ip}`,
    "",
    "O Dono confirmou no aplicativo que sabe que todas as obras, fotos, documentos e contas da equipe serão apagados.",
    "",
    "Antes de apagar: responder a este e-mail (vai para o e-mail da conta) e confirmar o pedido. Prazo: 15 dias.",
  ].join("\n");

  try {
    const { EmailMessage } = await import("cloudflare:email");
    const raw = montarMime({
      de: REMETENTE,
      para: DESTINO,
      responderPara: usuario.email || null,
      assunto: `Encerrar empresa no G&C — ${empresas[0]?.nome || usuario.empresa_id}`,
      corpo,
    });
    await env.EMAIL.send(new EmailMessage(REMETENTE, DESTINO, raw));
  } catch (e) {
    console.error("encerrar-empresa: envio falhou", e);
    return jsonResponse({ ok: false, error: "não foi possível enviar o pedido agora" }, 502);
  }
  return jsonResponse({ ok: true });
}
