import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, hashSenha, verificarSenha, renovarSessoes } from "../lib/auth.js";
import { limparCpf, cpfValido, problemaPin } from "./convite-link.js";
import { camposCpf, temCpf, cpfConfere, hashPin, mascaraDe } from "../lib/cpf.js";
import { TERMOS_VERSAO } from "../lib/legal.js";

export default async function usuariosMeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    const { senha_hash, pin_hash, cpf, cpf_hash, cpf_mascarado, sessao_versao, login_tentativas, login_rodadas, login_bloqueado_ate, pin_tentativas, pin_rodadas, pin_bloqueado_ate, ...publico } = usuario; // nunca mandar hashes nem CPF inteiro pro navegador
    const cpfMascarado = mascaraDe(usuario);
    const emp = await getSql(env)`SELECT nome FROM empresas WHERE id = ${usuario.empresa_id}`;
    return jsonResponse({ ok: true, termos_vigente: TERMOS_VERSAO, usuario: {
      ...publico, empresa_nome: emp[0] ? emp[0].nome : null, cpf_mascarado: cpfMascarado, tem_senha: !!senha_hash, tem_pin: !!pin_hash,
    } });
  }

  // Define ou troca a senha. Útil sobretudo pra quem entrou via Google e
  // ainda não tem senha própria — assim consegue entrar mesmo sem o Google
  // (ex: se perder acesso à conta Google), e o navegador oferece salvar
  // a senha no Google Password Manager.
  if (req.method === "PATCH") {
    const body = await req.json();

    // "Sair de todos os aparelhos" (S8): derruba todas as sessões; este aparelho recebe um token novo.
    if (body.sairDeTodos) {
      const novoToken = await renovarSessoes(getSql(env), usuario.id, env);
      return jsonResponse({ ok: true, novoToken });
    }

    // Apresentação do começo (slides) vista ou pulada: não aparece mais sozinha.
    if (body.apresentacaoVista) {
      await getSql(env)`UPDATE usuarios SET apresentacao_vista_em = now() WHERE id = ${usuario.id}`;
      return jsonResponse({ ok: true });
    }

    // Aceite dos Termos de Uso e da Política de Privacidade (versão vigente) — L4
    if (body.aceitarTermos) {
      await getSql(env)`UPDATE usuarios SET termos_versao = ${TERMOS_VERSAO}, termos_aceito_em = now() WHERE id = ${usuario.id}`;
      return jsonResponse({ ok: true, termos_versao: TERMOS_VERSAO });
    }

    // Criar/trocar meu PIN (para também entrar com CPF + PIN). Quem já tem CPF não troca o CPF.
    if (body.pin !== undefined) {
      const sql = getSql(env);
      // Quem já tem CPF confirma o CPF (prova de que é a pessoa e permite conferir que o PIN não é parte dele).
      const cpf = limparCpf(body.cpf);
      if (!cpfValido(cpf)) return jsonResponse({ ok: false, error: "CPF inválido. Confira os números." }, 400);
      if (temCpf(usuario) && !(await cpfConfere(env, usuario, cpf))) {
        return jsonResponse({ ok: false, error: "Este CPF não é o cadastrado na sua conta." }, 400);
      }
      const prob = problemaPin(body.pin, cpf);
      if (prob) return jsonResponse({ ok: false, error: prob }, 400);
      const campos = await camposCpf(env, cpf);
      if (!temCpf(usuario)) {
        const dono = await sql`SELECT id FROM usuarios WHERE (cpf_hash = ${campos.cpf_hash} OR cpf = ${cpf}) AND id <> ${usuario.id}`;
        if (dono.length > 0) return jsonResponse({ ok: false, error: "Este CPF já está em outra conta." }, 409);
      }
      const pinHash = await hashPin(env, body.pin);
      await sql`UPDATE usuarios SET cpf = ${campos.cpf}, cpf_hash = ${campos.cpf_hash}, cpf_mascarado = ${campos.cpf_mascarado},
        pin_hash = ${pinHash}, pin_tentativas = 0, pin_rodadas = 0, pin_bloqueado_ate = NULL WHERE id = ${usuario.id}`;
      // Trocou o PIN: as outras sessões caem (S8); este aparelho segue logado com o token novo.
      const novoToken = usuario.pin_hash ? await renovarSessoes(sql, usuario.id, env) : null;
      return jsonResponse({ ok: true, novoToken });
    }

    const { novaSenha, senhaAtual } = body;
    if (!novaSenha || novaSenha.length < 8) {
      return jsonResponse({ ok: false, error: "a senha precisa ter ao menos 8 caracteres" }, 400);
    }
    // S8: quem já tem senha precisa informar a atual (um token roubado não basta para trocar a senha).
    if (usuario.senha_hash && !(senhaAtual && (await verificarSenha(String(senhaAtual), usuario.senha_hash)))) {
      return jsonResponse({ ok: false, error: "A senha atual não confere." }, 403);
    }
    const sql = getSql(env);
    const senhaHash = await hashSenha(novaSenha);
    await sql`UPDATE usuarios SET senha_hash = ${senhaHash}, login_tentativas = 0, login_rodadas = 0, login_bloqueado_ate = NULL WHERE id = ${usuario.id}`;
    // Senha nova: as outras sessões caem; este aparelho segue logado com o token novo.
    const novoToken = await renovarSessoes(sql, usuario.id, env);
    return jsonResponse({ ok: true, novoToken });
  }

  // Excluir conta. DELETE sem ?id → a própria conta. DELETE ?id=X → conta de outro (só um superior dele).
  // ANONIMIZAÇÃO: os registros da pessoa (observações, pedidos, etapas, fotos) ficam na obra,
  // mas assinados como "Usuário removido". Apagamos nome, email, CPF, senha, PIN e telefone:
  // não sobra nenhum dado pessoal. Email/CPF ficam livres caso um dia seja convidada de novo.
  if (req.method === "DELETE") {
    const sql = getSql(env);
    const idParam = new URL(req.url).searchParams.get("id");
    const alvoId = idParam ? Number(idParam) : usuario.id;
    const alvos = await sql`SELECT * FROM usuarios WHERE id = ${alvoId} AND empresa_id = ${usuario.empresa_id} AND removido_em IS NULL`;
    if (alvos.length === 0) return jsonResponse({ ok: false, error: "não encontrado" }, 404);
    const alvo = alvos[0];
    const propria = alvo.id === usuario.id;
    if (propria && usuario.rank === 1) {
      return jsonResponse({ ok: false, error: "o Dono não pode excluir a própria conta (a empresa ficaria sem dono)" }, 403);
    }
    if (!propria && !(usuario.rank < alvo.rank)) {
      return jsonResponse({ ok: false, error: "só um superior pode excluir a conta de outra pessoa" }, 403);
    }
    // Obras em que ele era responsável passam para o Dono da empresa.
    const empresas = await sql`SELECT dono_usuario_id FROM empresas WHERE id = ${usuario.empresa_id}`;
    const donoId = empresas[0] && empresas[0].dono_usuario_id;
    // Tudo ou nada (C1): a conta não fica "meio excluída".
    const q = [];
    if (donoId && donoId !== alvo.id) {
      q.push(sql`UPDATE obras SET responsavel_id = ${donoId} WHERE responsavel_id = ${alvo.id} AND empresa_id = ${usuario.empresa_id}`);
      q.push(sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        SELECT id, ${donoId}, '', ${usuario.id} FROM obras WHERE responsavel_id = ${donoId} AND empresa_id = ${usuario.empresa_id}
        ON CONFLICT (obra_id, usuario_id) DO NOTHING
      `);
    }
    q.push(sql`DELETE FROM convites WHERE usuario_id = ${alvo.id}`);
    // Play Store / LGPD: a inscrição de notificações do celular também é dado da pessoa e sai junto com a conta.
    q.push(sql`DELETE FROM push_inscricoes WHERE usuario_id = ${alvo.id}`);
    q.push(sql`
      UPDATE usuarios SET
        removido_em = now(), removido_por = ${usuario.id}, nome = 'Usuário removido',
        email = NULL, cpf = NULL, cpf_hash = NULL, cpf_mascarado = NULL, senha_hash = NULL, pin_hash = NULL, telefone = NULL, excecao_modulos = NULL
      WHERE id = ${alvo.id}
    `);
    await sql.transaction(q);
    return jsonResponse({ ok: true, propria });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
