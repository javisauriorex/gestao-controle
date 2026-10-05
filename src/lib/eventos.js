// ============================================================
// SISTEMA DE EVENTOS / AVISOS (claude/permisos-y-flujos.md §4)
//
// Cada ação na obra vira um EVENTO (uma linha só). A bandeja 🔔 de cada pessoa
// é calculada na hora de ler, com as regras da hierarquia:
//   - Para BAIXO desce a novidade de trabalho (criou, concluiu, entregou...) — a todos os inferiores e pares.
//   - Para CIMA sobe só até a "profundidade" que cada um escolheu (padrão: 1 = só o escalão imediato),
//     e só dos cajones que ele deixou ligados.
//   - A auditoria (editou, apagou, desmarcou) NÃO desce: vai para o autor afetado e para os superiores.
//   - Quem não vê o cajón (🔒) não recebe aviso dele. Obra silenciada (🔕) não avisa.
//   - "Afetado" (te pediram algo, te entregaram, apagaram algo seu, te tiraram da obra): avisa sempre.
//   - Pedidos são conversa: só avisam as partes.
// ============================================================

export const CATEGORIAS = ["etapas", "fotos", "materiais", "ferramentas", "documentos", "observacoes", "equipe", "pedidos", "obra"];
// Categoria → cajón cuja permissão decide se a pessoa "vê" o evento.
const MODULO_DA_CATEGORIA = { etapas: "etapas", fotos: "etapas", materiais: "materiais", ferramentas: "ferramentas", documentos: "documentos", observacoes: "observacoes", equipe: "equipe" };
export const ACOES_AUDITORIA = new Set(["editou", "apagou", "desmarcou", "rank"]);

// Cadeia de mando (escalões). Laterais: Estagiário (3) junto do Eng. Chefe, Almoxarife (6) junto do Mestre.
const POS = { 1: 1, 2: 2, 3: 2.5, 4: 3, 5: 4, 6: 3.5, 7: 5, 8: 6 };
const CADEIA = [1, 2, 4, 5, 7, 8]; // só estes são "eslabões" da cadeia de avisos
export const PROFUNDIDADE_MAX = 5;

const NIVEL = { nenhum: 0, visualizar: 1, receber: 2, editar: 3 };

// Grava um evento. Nunca derruba a ação principal: se falhar, só registra no log.
export async function registrarEvento(sql, usuario, { obraId = null, categoria, acao, alvoId = null, texto, afetadoId = null }) {
  try {
    if (afetadoId && Number(afetadoId) === usuario.id) afetadoId = null;
    await sql`
      INSERT INTO eventos (empresa_id, obra_id, categoria, acao, alvo_id, texto, autor_id, rank_autor, afetado_id)
      VALUES (${usuario.empresa_id}, ${obraId}, ${categoria}, ${acao}, ${alvoId}, ${String(texto || "").slice(0, 300)}, ${usuario.id}, ${usuario.rank}, ${afetadoId})
    `;
  } catch (e) {
    console.error("registrarEvento falhou", e);
  }
}

// Quantos escalões da cadeia, PRESENTES nesta obra, separam o autor de mim (1 = sou o imediato).
function distancia(meuRank, rankAutor, ranksNaObra) {
  const de = POS[meuRank], ate = POS[rankAutor];
  let entre = 0;
  for (const r of CADEIA) {
    const p = POS[r];
    if (p > de && p < ate && ranksNaObra.has(r)) entre++;
  }
  return entre + 1;
}

// Decide se UM evento aparece para mim. Função pura (testada à parte).
//  ctx: { eu: {id, rank}, prefs: {profundidade, modulos}, silenciadas: Set, nivelEm(obraId, modulo), ranksNaObra(obraId): Set, entrouEm(obraId): Date|null }
export function eventoVisivel(ev, ctx) {
  const { eu } = ctx;
  if (ev.autor_id === eu.id) return false;
  if (ev.afetado_id === eu.id) return true; // te afeta: sempre
  if (ev.categoria === "pedidos") return false; // conversa entre as partes
  if (ev.obra_id && ctx.silenciadas.has(ev.obra_id)) return false;
  // Não mostra o que aconteceu antes de eu entrar nesta obra.
  const entrou = ev.obra_id ? ctx.entrouEm(ev.obra_id) : null;
  if (entrou && new Date(ev.criado_em) < entrou) return false;
  const modulo = MODULO_DA_CATEGORIA[ev.categoria];
  if (modulo && NIVEL[ctx.nivelEm(ev.obra_id, modulo)] < 1) return false; // 🔒
  const ligado = !ctx.prefs.modulos || ctx.prefs.modulos[ev.categoria] !== false;
  const auditoria = ACOES_AUDITORIA.has(ev.acao);
  const rankAutor = ev.rank_autor;
  if (eu.rank >= rankAutor) {
    // Sou par ou estou abaixo: recebo a novidade de trabalho, nunca a auditoria.
    return !auditoria && ligado;
  }
  // Estou acima: até a profundidade escolhida.
  const d = distancia(eu.rank, rankAutor, ev.obra_id ? ctx.ranksNaObra(ev.obra_id) : new Set(CADEIA));
  return ligado && d <= Math.max(1, Number(ctx.prefs.profundidade) || 1);
}
