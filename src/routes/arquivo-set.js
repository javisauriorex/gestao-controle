import { getUsuario, jsonResponse } from "../lib/auth.js";
import { problemaNoPayload } from "../lib/arquivos.js";
import { getSql } from "../lib/db.js";
import { problemaLimiteUpload, registrarUpload } from "../lib/limites.js";

export default async function arquivoSetHandler(req, env) {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  const { id, payload } = await req.json();
  if (!id || !payload) return jsonResponse({ ok: false, error: "id e payload são obrigatórios" }, 400);
  // Ids novos são UUID (impossíveis de adivinhar). Não aceitamos ids curtos nem sobrescrever arquivo existente.
  if (!/^[0-9a-f-]{32,40}$/i.test(id)) return jsonResponse({ ok: false, error: "id inválido" }, 400);
  const existente = await env.ARQUIVOS.get(id);
  if (existente !== null) return jsonResponse({ ok: false, error: "arquivo já existe" }, 409);
  if (typeof payload !== "string") return jsonResponse({ ok: false, error: "arquivo inválido" }, 400);
  if (payload.length > 6 * 1024 * 1024) return jsonResponse({ ok: false, error: "arquivo grande demais" }, 413);
  const problema = problemaNoPayload(payload);
  if (problema) return jsonResponse({ ok: false, error: problema }, 400);
  // Limite diário (fotos + documentos): 20 por empresa, 10 por pessoa.
  const sql = getSql(env);
  const limite = await problemaLimiteUpload(sql, usuario);
  if (limite) return jsonResponse({ ok: false, codigo: "limite_diario", error: limite }, 429);

  // O frontend já manda `payload` como string JSON pronta; gravamos tal qual.
  // metadata: quem enviou e de que empresa (usado para autorizar a leitura antes de vincular).
  await env.ARQUIVOS.put(id, payload, { metadata: { por: usuario.id, empresa: usuario.empresa_id } });
  await registrarUpload(sql, usuario);
  return jsonResponse({ ok: true });
}
