import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, podeAsignarRank, ehSuperior, podeMudarRanks } from "../lib/auth.js";
import { nivelNaObra, podeVer, veTodasAsObras } from "../lib/acesso.js";

// Data de hoje no Brasil (AAAA-MM-DD), para a presença marcada pela própria pessoa.
function diaBR(deslocDias = 0) {
  return new Date(Date.now() + deslocDias * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Equipe de uma obra (regras: claude/permisos-y-flujos.md §5.4).
//  - Adicionar/convidar: quem tem "editar" na Equipe desta obra (padrão: Dono, Eng. Chefe, Mestre, Encarregado,
//    Chefe de Turma), sempre para ranks abaixo do próprio (Dono/Eng. Chefe adicionam qualquer um já da empresa).
//  - Tirar da obra: só um SUPERIOR (ninguém tira a si mesmo nem um par). O responsável da obra não sai sem transferir.
//  - Rank (vale para todas as obras): Dono, Eng. Chefe e Mestre, só de quem está abaixo e só para ranks abaixo do seu.
//    O Dono principal pode nomear um co-Dono. Mudar/excluir um Dono passa pelo suporte.
//  - Função (desta obra): Dono/Eng. Chefe ou o responsável da obra.
//  - Bloqueio de módulos NESTA obra (⚙): SÓ o responsável da obra, e só para quem está abaixo dele.
//  - Presença: cada um marca a SUA, só de hoje. Um superior pode anotar a de alguém de baixo (até 7 dias),
//    e fica visível "marcado por Fulano (rank)".
//  - E-mail, presença e bloqueios de alguém: só a própria pessoa e os superiores dela veem.
//  - Quem teve a conta excluída aparece como "ausente" (removido_em preenchido).

async function obraDaEmpresa(sql, obraId, empresaId) {
  const r = await sql`SELECT id, responsavel_id FROM obras WHERE id = ${obraId} AND empresa_id = ${empresaId}`;
  return r[0] || null;
}

async function acessoAObra(sql, usuario, obraId) {
  const obra = await obraDaEmpresa(sql, obraId, usuario.empresa_id);
  if (!obra) return null;
  if (veTodasAsObras(usuario)) return obra;
  const m = await sql`SELECT 1 FROM equipe WHERE obra_id = ${obraId} AND usuario_id = ${usuario.id}`;
  return m.length ? obra : null;
}


export default async function equipeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const sql = getSql(env);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) {
      // Sem obra_id: todo mundo ATIVO da empresa (pra escolher responsável ou "Da empresa").
      const todos = await sql`
        SELECT id as usuario_id, email, nome, rank FROM usuarios
        WHERE empresa_id = ${usuario.empresa_id} AND removido_em IS NULL
        ORDER BY nome
      `;
      // E-mail só da própria pessoa e de quem está abaixo.
      todos.forEach((p) => { if (p.usuario_id !== usuario.id && !ehSuperior(usuario, p.rank, p.usuario_id)) p.email = null; });
      return jsonResponse({ ok: true, equipe: todos });
    }
    if (!(await acessoAObra(sql, usuario, obraId))) return jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);
    const equipe = await sql`
      SELECT e.*, u.email, u.nome, u.rank, u.removido_em FROM equipe e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.obra_id = ${obraId}
      ORDER BY u.removido_em NULLS FIRST, e.id
    `;
    // A lista vem sempre (precisa dela para pedidos), mas e-mail, presença e bloqueios de cada pessoa
    // só para ela mesma e para os superiores dela que veem a Equipe (H6).
    const { nivel } = await nivelNaObra(sql, usuario, obraId, "equipe", env);
    equipe.forEach((m) => {
      if (m.usuario_id === usuario.id) return;
      if (podeVer(nivel) && ehSuperior(usuario, m.rank, m.usuario_id)) return;
      m.email = null; m.asistencias = []; m.presencas_por = null; m.excecao_modulos = null;
    });
    return jsonResponse({ ok: true, equipe });
  }

  if (req.method === "POST") {
    const { obraId, email, rank, funcao, usuarioId } = await req.json();
    if (!obraId) return jsonResponse({ ok: false, error: "faltam dados" }, 400);
    const acesso = await nivelNaObra(sql, usuario, obraId, "equipe", env);
    if (!acesso.obra) return jsonResponse({ ok: false, error: "obra não encontrada ou você não está na equipe" }, 404);
    // H1: adicionar/convidar exige "editar" na Equipe desta obra.
    if (acesso.nivel !== "editar") return jsonResponse({ ok: false, error: "seu acesso à Equipe desta obra não permite adicionar pessoas" }, 403);

    // Adicionar alguém que JÁ é da empresa (inclusive quem entra com CPF, sem email)
    if (obraId && usuarioId) {
      const pessoas = await sql`
        SELECT * FROM usuarios WHERE id = ${usuarioId} AND empresa_id = ${usuario.empresa_id} AND removido_em IS NULL
      `;
      if (pessoas.length === 0) return jsonResponse({ ok: false, error: "pessoa não encontrada na empresa" }, 404);
      const p = pessoas[0];
      if (usuario.rank > 2 && p.rank <= usuario.rank) {
        return jsonResponse({ ok: false, error: "só pode adicionar pessoas de rank abaixo do seu" }, 403);
      }
      const rows = await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${obraId}, ${p.id}, ${funcao || ""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO UPDATE SET funcao = ${funcao || ""}
        RETURNING *
      `;
      return jsonResponse({ ok: true, equipe: { ...rows[0], email: p.email, nome: p.nome, rank: p.rank }, convite: false });
    }

    if (!obraId || !email) return jsonResponse({ ok: false, error: "faltam dados" }, 400);

    const emailNorm = email.toLowerCase();
    const existentes = await sql`SELECT * FROM usuarios WHERE email = ${emailNorm}`;

    if (existentes.length > 0) {
      const membro = existentes[0];
      if (membro.empresa_id !== usuario.empresa_id || membro.removido_em) {
        return jsonResponse({ ok: false, error: "este email já pertence a outra empresa" }, 409);
      }
      if (usuario.rank > 2 && membro.rank <= usuario.rank) {
        return jsonResponse({ ok: false, error: "só pode adicionar pessoas de rank abaixo do seu" }, 403);
      }
      const rows = await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${obraId}, ${membro.id}, ${funcao || ""}, ${usuario.id})
        ON CONFLICT (obra_id, usuario_id) DO UPDATE SET funcao = ${funcao || ""}
        RETURNING *
      `;
      return jsonResponse({ ok: true, equipe: { ...rows[0], email: membro.email, nome: membro.nome, rank: membro.rank }, convite: false });
    }

    if (!rank) return jsonResponse({ ok: false, error: "rank é obrigatório para convidar alguém novo" }, 400);
    if (!podeAsignarRank(usuario.rank, rank, usuario)) {
      return jsonResponse({ ok: false, error: "só pode convidar para um rank abaixo do seu" }, 403);
    }
    // Todo convite por email também ganha um link (token), pra poder mandar por WhatsApp.
    const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const token = [...tokenBytes].map((x) => x.toString(16).padStart(2, "0")).join("");
    const expira = new Date(Date.now() + 7 * 86400000).toISOString();
    const rows = await sql`
      INSERT INTO convites (empresa_id, email, nome, rank, funcao, obra_id, criado_por, token, expira_em)
      VALUES (${usuario.empresa_id}, ${emailNorm}, ${emailNorm.split("@")[0]}, ${rank}, ${funcao || ""}, ${obraId}, ${usuario.id}, ${token}, ${expira})
      RETURNING *
    `;
    return jsonResponse({ ok: true, convite: rows[0], token });
  }

  if (req.method === "PATCH") {
    const id = url.searchParams.get("id");
    const body = await req.json();
    const { data } = body;
    const alvos = await sql`SELECT * FROM equipe WHERE id = ${id}`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const atual = alvos[0];
    const obra = await acessoAObra(sql, usuario, atual.obra_id);
    if (!obra) return jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);

    // Editar integrante
    if (data === undefined) {
      const pessoas = await sql`SELECT * FROM usuarios WHERE id = ${atual.usuario_id} AND empresa_id = ${usuario.empresa_id}`;
      if (pessoas.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
      const alvo = pessoas[0];
      const souResponsavel = obra.responsavel_id === usuario.id;
      const alvoAbaixo = ehSuperior(usuario, alvo.rank, alvo.id);

      if (body.rank !== undefined && Number(body.rank) !== alvo.rank) {
        if (alvo.rank === 1) return jsonResponse({ ok: false, error: "mudar o rank de um Dono é feito pelo suporte (suporte@gestaoecontrole.app.br)" }, 403);
        if (!podeMudarRanks(usuario) || !alvoAbaixo) return jsonResponse({ ok: false, error: "só Dono, Eng. Chefe e Mestre de Obra mudam o rank, e só de quem está abaixo deles" }, 403);
        if (!podeAsignarRank(usuario.rank, body.rank, usuario)) return jsonResponse({ ok: false, error: "só pode dar um rank abaixo do seu" }, 400);
      }
      if (body.excecaoModulos !== undefined && (!souResponsavel || !alvoAbaixo)) {
        return jsonResponse({ ok: false, error: "só o responsável da obra bloqueia módulos, e só de quem está abaixo dele" }, 403);
      }
      if (body.funcao !== undefined && usuario.rank > 2 && !souResponsavel) {
        return jsonResponse({ ok: false, error: "só Dono/Eng. Chefe ou o responsável da obra mudam a função" }, 403);
      }

      if (body.rank !== undefined && Number(body.rank) !== alvo.rank) await sql`UPDATE usuarios SET rank = ${Number(body.rank)} WHERE id = ${alvo.id}`;
      if (body.excecaoModulos !== undefined) {
        await sql`UPDATE equipe SET excecao_modulos = ${body.excecaoModulos ? JSON.stringify(body.excecaoModulos) : null} WHERE id = ${id}`;
      }
      if (body.funcao !== undefined) await sql`UPDATE equipe SET funcao = ${String(body.funcao || "").trim()} WHERE id = ${id}`;

      const membros = await sql`
        SELECT e.*, u.email, u.nome, u.rank, u.removido_em FROM equipe e
        JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ${id}
      `;
      return jsonResponse({ ok: true, membro: membros[0] });
    }

    // Presença (decisão do Javi 05/10): cada um marca a SUA, só de hoje.
    // Exceção visível: um superior com "editar" na Equipe anota a de alguém de baixo (até 7 dias atrás),
    // e fica registrado quem anotou. O superior não desmarca o que a própria pessoa marcou.
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return jsonResponse({ ok: false, error: "data inválida" }, 400);
    }
    const asistencias = Array.isArray(atual.asistencias) ? atual.asistencias : [];
    const anotacoes = atual.presencas_por && typeof atual.presencas_por === "object" ? { ...atual.presencas_por } : {};
    const tem = asistencias.includes(data);
    let novas;
    if (atual.usuario_id === usuario.id) {
      if (data !== diaBR(0)) return jsonResponse({ ok: false, error: "você só marca a sua presença do dia de hoje" }, 403);
      novas = tem ? asistencias.filter((d) => d !== data) : [...asistencias, data];
      delete anotacoes[data];
    } else {
      const { nivel } = await nivelNaObra(sql, usuario, atual.obra_id, "equipe", env);
      const alvos2 = await sql`SELECT rank FROM usuarios WHERE id = ${atual.usuario_id}`;
      if (nivel !== "editar" || !alvos2.length || !ehSuperior(usuario, alvos2[0].rank, atual.usuario_id)) {
        return jsonResponse({ ok: false, error: "só um superior com acesso de edição à Equipe anota a presença de outra pessoa" }, 403);
      }
      const ultimos7 = Array.from({ length: 8 }, (_, i) => diaBR(-i));
      if (!ultimos7.includes(data)) return jsonResponse({ ok: false, error: "só dá para anotar presença de até 7 dias atrás" }, 400);
      if (tem) {
        const a = anotacoes[data];
        if (!a) return jsonResponse({ ok: false, error: "esta presença foi marcada pela própria pessoa: só ela pode desmarcar" }, 403);
        if (a.por !== usuario.id && !ehSuperior(usuario, a.rank, a.por)) return jsonResponse({ ok: false, error: "só quem anotou (ou um superior dele) pode desfazer" }, 403);
        novas = asistencias.filter((d) => d !== data);
        delete anotacoes[data];
      } else {
        novas = [...asistencias, data];
        anotacoes[data] = { por: usuario.id, nome: usuario.nome, rank: usuario.rank };
      }
    }
    const rows = await sql`
      UPDATE equipe SET asistencias = ${JSON.stringify(novas)}, presencas_por = ${Object.keys(anotacoes).length ? JSON.stringify(anotacoes) : null}
      WHERE id = ${id} RETURNING *
    `;
    return jsonResponse({ ok: true, equipe: rows[0] });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);
    const alvos = await sql`
      SELECT e.*, u.rank as rank_membro FROM equipe e JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ${id}
    `;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const obraAlvo = await acessoAObra(sql, usuario, alvos[0].obra_id);
    if (!obraAlvo) return jsonResponse({ ok: false, error: "sem acesso a esta obra" }, 403);
    // H1: só um SUPERIOR com "editar" na Equipe tira alguém da obra (ninguém tira a si mesmo nem um par).
    const { nivel } = await nivelNaObra(sql, usuario, alvos[0].obra_id, "equipe", env);
    if (nivel !== "editar" || !ehSuperior(usuario, alvos[0].rank_membro, alvos[0].usuario_id)) {
      return jsonResponse({ ok: false, error: "só um superior pode tirar alguém da obra" }, 403);
    }
    // H4: o responsável da obra não sai sem antes transferir a obra para outra pessoa.
    if (obraAlvo.responsavel_id === alvos[0].usuario_id) {
      return jsonResponse({ ok: false, error: "esta pessoa é a responsável da obra: transfira a obra antes de tirá-la" }, 400);
    }
    await sql`DELETE FROM equipe WHERE id = ${id}`;
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
