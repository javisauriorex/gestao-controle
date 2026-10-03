import { nivelNaObra, podeVer } from "./acesso.js";

// ============================================================
// Controle de acesso aos arquivos (fotos e documentos no Cloudflare KV).
// Antes: um token fixo, público no index.html → qualquer um lia/apagava tudo.
// Agora: precisa estar logado, e o arquivo tem que ser de uma obra a que
// você tem acesso (ou ter sido enviado por você e ainda não vinculado).
// ============================================================

// Em que obra/módulo este arquivo está vinculado? (null se ainda não está)
export async function vinculoDoArquivo(sql, arquivoId) {
  const docs = await sql`SELECT obra_id FROM documentos WHERE arquivo_id = ${arquivoId} LIMIT 1`;
  if (docs.length) return { obraId: docs[0].obra_id, modulo: "documentos" };
  const fotos = await sql`
    SELECT e.obra_id FROM etapa_fotos f JOIN etapas e ON e.id = f.etapa_id WHERE f.arquivo_id = ${arquivoId} LIMIT 1
  `;
  if (fotos.length) return { obraId: fotos[0].obra_id, modulo: "etapas" };
  const conclusao = await sql`SELECT obra_id FROM etapas WHERE foto_conclusao_id = ${arquivoId} LIMIT 1`;
  if (conclusao.length) return { obraId: conclusao[0].obra_id, modulo: "etapas" };
  return null;
}

export async function podeLerArquivo(sql, usuario, arquivoId, metadata, env) {
  const vinculo = await vinculoDoArquivo(sql, arquivoId);
  if (vinculo) {
    const { nivel } = await nivelNaObra(sql, usuario, vinculo.obraId, vinculo.modulo, env);
    return podeVer(nivel);
  }
  // Ainda não vinculado (acabou de subir): só quem enviou.
  return !!metadata && metadata.por === usuario.id;
}

// Apaga do KV sem quebrar se falhar (limite diário de escrita, etc.)
export async function apagarDoKV(env, ids) {
  for (const id of ids.filter(Boolean)) {
    try { await env.ARQUIVOS.delete(id); } catch (e) { console.error("KV delete falhou", id, e); }
  }
}

// ============================================================
// S1 — Conteúdo do arquivo. O "payload" é um JSON { nome, tipo, dataUrl }.
// O dataUrl TEM que ser um arquivo de verdade (imagem, PDF, Word, Excel) em base64.
// Antes, dava para gravar "javascript:..." ou uma página HTML disfarçada de PDF:
// ao abrir, o código rodava dentro do G&C e roubava a sessão de quem abriu.
// ============================================================
export const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // celular que não informa o tipo: o navegador só baixa, nunca executa
];
// Só o começo importa para a segurança: é o tipo declarado que decide o que o navegador faz com o arquivo.
const RE_DATAURL = /^data:([a-z0-9.+\/-]+);base64,[A-Za-z0-9+/]/;

// Devolve null se o payload serve, ou a mensagem de erro.
export function problemaNoPayload(payload) {
  let obj;
  try { obj = JSON.parse(payload); } catch { return "arquivo inválido"; }
  if (!obj || typeof obj !== "object" || typeof obj.dataUrl !== "string") return "arquivo inválido";
  const m = obj.dataUrl.slice(0, 200).match(RE_DATAURL);
  if (!m || !TIPOS_PERMITIDOS.includes(m[1].toLowerCase())) return "tipo de arquivo não permitido";
  if (obj.nome !== undefined && (typeof obj.nome !== "string" || obj.nome.length > 200)) return "nome de arquivo inválido";
  if (obj.tipo !== undefined && typeof obj.tipo !== "string") return "arquivo inválido";
  return null;
}
