import { getNivel, nivelEfetivo, jsonResponse } from "./auth.js";

// ============================================================
// Acesso por obra — um único lugar que decide o que cada um pode fazer
// dentro de uma obra, usando a tela de Permissões (nível por rank) +
// o bloqueio por obra que o responsável da obra define no ⚙ de Equipe.
//
//   - Obra de outra empresa → nenhum.
//   - Rank 4..8 que não está na equipe da obra → nenhum (cada um vê SÓ as suas obras).
//   - Dono, Eng. Chefe e Eng. Estagiário (rank 1-3) acessam todas as obras da empresa
//     (o Estagiário só vê: a matriz padrão dele é "visualizar").
// ============================================================

const ORDEM = { nenhum: 0, visualizar: 1, receber: 2, editar: 3 };

// Dono, Eng. Chefe e Eng. Estagiário veem todas as obras; do Mestre para baixo, só as suas.
export const veTodasAsObras = (usuario) => usuario.rank <= 3;

export async function nivelNaObra(sql, usuario, obraId, modulo, env) {
  if (!obraId) return { nivel: "nenhum", membro: false };
  const obras = await sql`SELECT id, responsavel_id FROM obras WHERE id = ${obraId} AND empresa_id = ${usuario.empresa_id}`;
  if (obras.length === 0) return { nivel: "nenhum", membro: false };
  const membros = await sql`SELECT excecao_modulos FROM equipe WHERE obra_id = ${obraId} AND usuario_id = ${usuario.id}`;
  const membro = membros.length > 0;
  if (!veTodasAsObras(usuario) && !membro) return { nivel: "nenhum", membro: false };
  let nivel = await getNivel(usuario.empresa_id, usuario.rank, modulo, env);
  if (membro) nivel = nivelEfetivo(nivel, membros[0].excecao_modulos, modulo);
  return { nivel, membro, obra: obras[0] };
}

export const podeVer = (nivel) => ORDEM[nivel] >= 1;
export const podeEditar = (nivel) => nivel === "editar";
// "receber": vê, faz pedidos e confirma o que recebeu (Ferramentas/Materiais).
export const podeReceber = (nivel) => ORDEM[nivel] >= 2;

export const semAcesso = () => jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);
export const soVisualizar = () => jsonResponse({ ok: false, error: "seu nível neste módulo é só visualizar" }, 403);

// Descobre a obra de um registro pelo id (para PATCH/DELETE que só recebem ?id=)
export async function obraDoRegistro(sql, tabela, id) {
  const q = {
    etapas: sql`SELECT obra_id FROM etapas WHERE id = ${id}`,
    materiais: sql`SELECT obra_id FROM materiais WHERE id = ${id}`,
    ferramentas: sql`SELECT obra_id FROM ferramentas WHERE id = ${id}`,
    documentos: sql`SELECT obra_id FROM documentos WHERE id = ${id}`,
    observacoes: sql`SELECT obra_id FROM observacoes WHERE id = ${id}`,
    etapa_fotos: sql`SELECT e.obra_id FROM etapa_fotos f JOIN etapas e ON e.id = f.etapa_id WHERE f.id = ${id}`,
    etapa: sql`SELECT obra_id FROM etapas WHERE id = ${id}`,
    pedidos: sql`SELECT obra_id FROM pedidos WHERE id = ${id}`,
  }[tabela];
  const rows = await q;
  return rows.length ? rows[0].obra_id : null;
}
