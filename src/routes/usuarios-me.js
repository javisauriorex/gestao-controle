import { getSql } from "../lib/db.js";
import { getUsuario, jsonResponse, hashSenha } from "../lib/auth.js";
import { limparCpf, cpfValido, problemaPin } from "./convite-link.js";

export default async function usuariosMeHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    const { senha_hash, pin_hash, cpf, ...publico } = usuario; // nunca mandar hashes nem CPF inteiro pro navegador
    const cpfMascarado = cpf ? `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}` : null;
    return jsonResponse({ ok: true, usuario: { ...publico, cpf_mascarado: cpfMascarado, tem_senha: !!senha_hash, tem_pin: !!pin_hash } });
  }

  // Define ou troca a senha. Útil sobretudo pra quem entrou via Google e
  // ainda não tem senha própria — assim consegue entrar mesmo sem o Google
  // (ex: se perder acesso à conta Google), e o navegador oferece salvar
  // a senha no Google Password Manager.
  if (req.method === "PATCH") {
    const body = await req.json();

    // Criar/trocar meu PIN (para também entrar com CPF + PIN). Quem já tem CPF não troca o CPF.
    if (body.pin !== undefined) {
      const sql = getSql(env);
      const cpf = usuario.cpf || limparCpf(body.cpf);
      if (!cpfValido(cpf)) return jsonResponse({ ok: false, error: "CPF inválido. Confira os números." }, 400);
      const prob = problemaPin(body.pin, cpf);
      if (prob) return jsonResponse({ ok: false, error: prob }, 400);
      if (!usuario.cpf) {
        const dono = await sql`SELECT id FROM usuarios WHERE cpf = ${cpf} AND id <> ${usuario.id}`;
        if (dono.length > 0) return jsonResponse({ ok: false, error: "Este CPF já está em outra conta." }, 409);
      }
      const pinHash = await hashSenha(String(body.pin));
      await sql`UPDATE usuarios SET cpf = ${cpf}, pin_hash = ${pinHash}, pin_tentativas = 0, pin_bloqueado_ate = NULL WHERE id = ${usuario.id}`;
      return jsonResponse({ ok: true });
    }

    const { novaSenha } = body;
    if (!novaSenha || novaSenha.length < 6) {
      return jsonResponse({ ok: false, error: "a senha precisa ter ao menos 6 caracteres" }, 400);
    }
    const sql = getSql(env);
    const senhaHash = await hashSenha(novaSenha);
    await sql`UPDATE usuarios SET senha_hash = ${senhaHash} WHERE id = ${usuario.id}`;
    return jsonResponse({ ok: true });
  }

  // Excluir conta. DELETE sem ?id → a própria conta. DELETE ?id=X → conta de outro (só um superior dele).
  // A pessoa NÃO some do histórico: nome e registros ficam, e ela aparece como "ausente".
  // Apagamos os dados de acesso e pessoais (email, CPF, senha, PIN, telefone) — ela não entra mais,
  // e o email/CPF ficam livres caso um dia seja convidada de novo.
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
    if (donoId && donoId !== alvo.id) {
      await sql`UPDATE obras SET responsavel_id = ${donoId} WHERE responsavel_id = ${alvo.id} AND empresa_id = ${usuario.empresa_id}`;
      await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        SELECT id, ${donoId}, '', ${usuario.id} FROM obras WHERE responsavel_id = ${donoId} AND empresa_id = ${usuario.empresa_id}
        ON CONFLICT (obra_id, usuario_id) DO NOTHING
      `;
    }
    await sql`UPDATE convites SET aceito = true WHERE usuario_id = ${alvo.id} AND aceito = false`;
    await sql`
      UPDATE usuarios SET
        removido_em = now(), removido_por = ${usuario.id},
        email = NULL, cpf = NULL, senha_hash = NULL, pin_hash = NULL, telefone = NULL
      WHERE id = ${alvo.id}
    `;
    return jsonResponse({ ok: true, propria });
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
