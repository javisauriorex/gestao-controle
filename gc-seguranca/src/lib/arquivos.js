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
