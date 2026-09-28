import worker from "./src/worker.js";
import { pool } from "./src/lib/db.js";
const env = { JWT_SECRET: "x".repeat(32), ASSETS: { fetch: () => new Response("asset") } };
let falhas = 0, ok = 0;
async function call(method, path, token, body) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const r = await worker.fetch(new Request("https://t" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
function check(nome, cond, extra = "") { if (cond) { ok++; } else { falhas++; console.log("❌", nome, extra); } }
function cpf(n) { const b = String(n).padStart(9, "1").slice(0, 9).split("").map(Number);
  const d = (arr) => { let s = 0; arr.forEach((x, i) => s += x * (arr.length + 1 - i)); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = d(b); const d2 = d([...b, d1]); return b.join("") + d1 + d2; }

const dono = await call("POST", "/api/auth/signup", null, { email: "dono@x.com", senha: "123456", nome: "Dono" });
check("signup dono", dono.ok, JSON.stringify(dono));
const D = dono.token;
const obraA = await call("POST", "/api/obras", D, { cliente: "Obra A" });
check("dono cria obra A", obraA.ok, JSON.stringify(obraA));
const A = obraA.obra.id;

const pessoas = {};
const ranks = { chefe: 2, estag: 3, mestre: 4, encarr: 5, almox: 6, prof: 8 };
let i = 0;
for (const [k, r] of Object.entries(ranks)) {
  const c = await call("POST", "/api/convite-link", D, { obraId: A, nome: k, rank: r });
  check("convite " + k, c.ok, JSON.stringify(c));
  const a = await call("POST", "/api/auth/aceitar-convite", null, { token: c.token, cpf: cpf(234567890 + (i++) * 1111), pin: "8391" });
  check("aceitar " + k, a.ok, JSON.stringify(a));
  pessoas[k] = { token: a.token, id: a.usuario.id };
}
const T = (k) => pessoas[k].token;

// Convite para rank igual ao próprio → proibido
check("chefe NÃO convida rank 2", (await call("POST", "/api/convite-link", T("chefe"), { obraId: A, nome: "z", rank: 2 })).status === 403);

// Mestre cria obra B e continua vendo
const obraB = await call("POST", "/api/obras", T("mestre"), { cliente: "Obra B" });
check("mestre cria obra B", obraB.ok, JSON.stringify(obraB));
const B = obraB.obra.id;
const listaMestre = await call("GET", "/api/obras", T("mestre"));
check("mestre vê A e B", listaMestre.obras.length === 2, JSON.stringify(listaMestre.obras.map(o=>o.cliente)));
check("encarregado cria obra → 403", (await call("POST", "/api/obras", T("encarr"), { cliente: "X" })).status === 403);

// Visibilidade
const listaProf = await call("GET", "/api/obras", T("prof"));
check("profissional só vê A", listaProf.obras.length === 1 && listaProf.obras[0].id === A, JSON.stringify(listaProf.obras));
const listaChefe = await call("GET", "/api/obras", T("chefe"));
check("chefe vê todas (A e B) mesmo sem estar em B", listaChefe.obras.length === 2);
check("encarregado lê materiais da obra B (não é membro) → 403", (await call("GET", `/api/materiais?obra_id=${B}`, T("encarr"))).status === 403);

// Materiais por nível de Permissões
check("almoxarife cria material (nível editar)", (await call("POST", "/api/materiais", T("almox"), { obraId: A, texto: "cimento" })).ok);
check("profissional cria material → 403 (nível nenhum)", (await call("POST", "/api/materiais", T("prof"), { obraId: A, texto: "x" })).status === 403);
const gp = await call("GET", `/api/materiais?obra_id=${A}`, T("prof"));
check("profissional GET materiais → lista vazia, sem erro", gp.ok && gp.materiais.length === 0, JSON.stringify(gp));
const m1 = await call("POST", "/api/materiais", T("encarr"), { obraId: A, texto: "areia" });
check("encarregado cria material", m1.ok);
check("almoxarife apaga material do encarregado (superior) → 403", (await call("DELETE", `/api/materiais?id=${m1.item.id}`, T("almox"))).status === 403);
check("mestre apaga material do encarregado → ok", (await call("DELETE", `/api/materiais?id=${m1.item.id}`, T("mestre"))).ok);

// Etapas: concluir sem ser autor
const et = await call("POST", "/api/etapas", D, { obraId: A, texto: "Fundação" });
check("dono cria etapa", et.ok);
check("encarregado conclui etapa do dono", (await call("PATCH", `/api/etapas?id=${et.etapa.id}`, T("encarr"), { concluida: true })).ok);
check("encarregado muda texto da etapa do dono → 403", (await call("PATCH", `/api/etapas?id=${et.etapa.id}`, T("encarr"), { texto: "x" })).status === 403);
check("mestre cria etapa (antes era bloqueado)", (await call("POST", "/api/etapas", T("mestre"), { obraId: A, texto: "Alvenaria" })).ok);

// Obras: apagar
check("mestre apaga obra → 403", (await call("DELETE", `/api/obras?id=${B}`, T("mestre"))).status === 403);

// Permissões
check("mestre edita permissões → 403", (await call("PATCH", "/api/permissoes", T("mestre"), { rank: 8, modulo: "materiais", nivel: "editar" })).status === 403);
check("estagiário edita rank 2 → 403", (await call("PATCH", "/api/permissoes", T("estag"), { rank: 2, modulo: "materiais", nivel: "nenhum" })).status === 403);
check("estagiário edita rank 3 (próprio) → 403", (await call("PATCH", "/api/permissoes", T("estag"), { rank: 3, modulo: "materiais", nivel: "nenhum" })).status === 403);
check("estagiário edita rank 8 → ok", (await call("PATCH", "/api/permissoes", T("estag"), { rank: 8, modulo: "materiais", nivel: "visualizar" })).ok);

// ⚙ bloqueio por obra: só o responsável (Dono na obra A)
const eqA = await call("GET", `/api/equipe?obra_id=${A}`, D);
const linhaEnc = eqA.equipe.find((m) => m.usuario_id === pessoas.encarr.id);
check("chefe bloqueia módulo (não é responsável) → 403", (await call("PATCH", `/api/equipe?id=${linhaEnc.id}`, T("chefe"), { excecaoModulos: { materiais: "nenhum" } })).status === 403);
const bl = await call("PATCH", `/api/equipe?id=${linhaEnc.id}`, D, { excecaoModulos: { materiais: "nenhum" } });
check("responsável (dono) bloqueia materiais do encarregado", bl.ok && bl.membro.excecao_modulos?.materiais === "nenhum", JSON.stringify(bl));
check("encarregado bloqueado não cria material", (await call("POST", "/api/materiais", T("encarr"), { obraId: A, texto: "x" })).status === 403);
// Transferir responsável para o mestre; agora o mestre bloqueia e o dono não
check("chefe transfere responsável para mestre", (await call("PATCH", `/api/obras?id=${A}`, T("chefe"), { novoResponsavelId: pessoas.mestre.id })).ok);
check("mestre (novo responsável) desbloqueia encarregado", (await call("PATCH", `/api/equipe?id=${linhaEnc.id}`, T("mestre"), { excecaoModulos: null })).ok);
const linhaChefe = eqA.equipe.find((m) => m.usuario_id === pessoas.chefe.id);
check("mestre bloqueia o chefe (superior) → 403", (await call("PATCH", `/api/equipe?id=${linhaChefe.id}`, T("mestre"), { excecaoModulos: { etapas: "nenhum" } })).status === 403);

// Rank via ⚙
const linhaProf = eqA.equipe.find((m) => m.usuario_id === pessoas.prof.id);
check("chefe muda rank do profissional para 7", (await call("PATCH", `/api/equipe?id=${linhaProf.id}`, T("chefe"), { rank: 7 })).ok);
check("chefe tenta dar rank 2 → 400", (await call("PATCH", `/api/equipe?id=${linhaProf.id}`, T("chefe"), { rank: 2 })).status === 400);

// Excluir conta / ausente
check("dono não exclui a própria conta", (await call("DELETE", "/api/usuarios-me", D)).status === 403);
check("mestre exclui conta do chefe → 403", (await call("DELETE", `/api/usuarios-me?id=${pessoas.chefe.id}`, T("mestre"))).status === 403);
check("profissional exclui a própria conta", (await call("DELETE", "/api/usuarios-me", T("prof"))).ok);
check("token do excluído não funciona mais", (await call("GET", "/api/obras", T("prof"))).status === 401);
const eqA2 = await call("GET", `/api/equipe?obra_id=${A}`, D);
check("excluído aparece como ausente na equipe", !!eqA2.equipe.find((m) => m.usuario_id === pessoas.prof.id)?.removido_em);
const empresa = await call("GET", "/api/equipe", D);
check("excluído some da lista 'Da empresa'", !empresa.equipe.find((m) => m.usuario_id === pessoas.prof.id));
check("mestre (responsável) exclui conta do encarregado", (await call("DELETE", `/api/usuarios-me?id=${pessoas.encarr.id}`, T("mestre"))).ok);
check("mestre exclui a própria conta → obra A volta pro dono", (await call("DELETE", "/api/usuarios-me", T("mestre"))).ok);
const obraA2 = (await call("GET", "/api/obras", D)).obras.find((o) => o.id === A);
check("responsável da obra A agora é o dono", obraA2.responsavel_id === (await call("GET", "/api/usuarios-me", D)).usuario.id);

// Observações com autor ausente
check("almox registra observação", (await call("POST", "/api/observacoes", T("almox"), { obraId: A, texto: "Atenção tubulação" })).ok);

// --- Regras decididas em 2026-09-28 ---
const c2 = await call("POST", "/api/obras", D, { cliente: "Obra C" });
const C_ = c2.obra.id;
const e1 = await call("POST", "/api/convite-link", D, { obraId: C_, nome: "enc2", rank: 5 });
const enc2 = await call("POST", "/api/auth/aceitar-convite", null, { token: e1.token, cpf: cpf(398765432), pin: "7302" });
check("aceitar enc2", enc2.ok, JSON.stringify(enc2));
const convEnc = await call("POST", "/api/convite-link", enc2.token, { obraId: C_, nome: "pedreiro", rank: 8, funcao: "Pedreiro" });
check("encarregado convida profissional", convEnc.ok, JSON.stringify(convEnc));
check("encarregado convida rank 5 (igual) → 403", (await call("POST", "/api/convite-link", enc2.token, { obraId: C_, nome: "x", rank: 5 })).status === 403);
check("encarregado convida para obra onde não está → 403", (await call("POST", "/api/convite-link", enc2.token, { obraId: A, nome: "x", rank: 8 })).status === 403);
check("encarregado gera Novo PIN → 403", (await call("POST", "/api/convite-link", enc2.token, { usuarioId: pessoas.almox.id })).status === 403);
// Eng. Chefe edita outro Eng. Chefe
const cc = await call("POST", "/api/convite-link", D, { obraId: C_, nome: "chefe2", rank: 2 });
const chefe2 = await call("POST", "/api/auth/aceitar-convite", null, { token: cc.token, cpf: cpf(476543210), pin: "5190" });
const eqC = await call("GET", `/api/equipe?obra_id=${C_}`, D);
const linhaChefe2 = eqC.equipe.find((m) => m.usuario_id === chefe2.usuario.id);
check("chefe muda rank de outro chefe para 3", (await call("PATCH", `/api/equipe?id=${linhaChefe2.id}`, T("chefe"), { rank: 3 })).ok);
check("chefe tenta dar rank 1 → 400", (await call("PATCH", `/api/equipe?id=${linhaChefe2.id}`, T("chefe"), { rank: 1 })).status === 400);
// Criar meu PIN (conta de email → também entra com CPF)
check("dono cria PIN com CPF", (await call("PATCH", "/api/usuarios-me", D, { cpf: cpf(512345678), pin: "6027" })).ok);
check("dono entra com CPF + PIN", (await call("POST", "/api/auth/login-cpf", null, { cpf: cpf(512345678), pin: "6027" })).ok);
const me = await call("GET", "/api/usuarios-me", D);
check("usuarios-me não devolve CPF inteiro nem hashes", !("cpf" in me.usuario) && !("pin_hash" in me.usuario) && !!me.usuario.cpf_mascarado, JSON.stringify(me.usuario));
// Etapa: quem concluiu
const et2 = await call("POST", "/api/etapas", D, { obraId: C_, texto: "Reboco" });
await call("PATCH", `/api/etapas?id=${et2.etapa.id}`, enc2.token, { concluida: true });
const ets = await call("GET", `/api/etapas?obra_id=${C_}`, D);
check("etapa mostra quem concluiu", ets.etapas.find((e) => e.id === et2.etapa.id)?.concluida_por_nome === "enc2");

console.log(`\n${ok} ok, ${falhas} falhas`);
process.exitCode = falhas ? 1 : 0;
await pool.end();
