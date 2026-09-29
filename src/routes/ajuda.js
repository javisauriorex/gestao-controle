import { getUsuario, jsonResponse } from "../lib/auth.js";
import { SECOES, SUGESTOES, RANKS, grupoDoRank, manualCompleto } from "../lib/ajuda-conhecimento.js";

// Ajuda + assistente "Pergunte ao G&C" (Cloudflare Workers AI).
//   GET  /api/ajuda  → seções do manual + perguntas sugeridas para o rank do usuário
//   POST /api/ajuda  { pergunta, historico? } → resposta do assistente, baseada SÓ no manual
// Privacidade: ao modelo vai só a pergunta, o histórico curto da conversa e o rank.
// Nada de nome, e-mail, CPF ou dados das obras. Não guardamos as perguntas.

const MODELO = "@cf/google/gemma-4-26b-a4b-it";
const MODELO_RESERVA = "@cf/meta/llama-3.1-8b-instruct-fp8";

function instrucoes(rank) {
  return `Você é o assistente de ajuda do aplicativo Gestão & Controle (G&C), usado em obras de construção civil no Brasil.
Quem está perguntando tem o rank "${RANKS[rank]}" (rank ${rank}; número menor = mais poder).

REGRAS:
- Responda SEMPRE em português do Brasil, simples e direto, como se falasse com alguém da obra. Frases curtas.
- Use SÓ as informações do MANUAL abaixo. Não invente botões, telas ou funções.
- Se a resposta não estiver no manual, diga que não sabe e sugira falar com o superior dele ou escrever para suporte@gestaoecontrole.app.br.
- Leve em conta o rank da pessoa: se ela não pode fazer algo, explique quem pode.
- Quando for um passo a passo, use uma lista numerada curta (no máximo 6 passos).
- Máximo de uns 120 palavras. Sem markdown pesado: só listas simples e, se precisar, **negrito**.
- Não peça nem aceite dados pessoais (CPF, PIN, senha). Se alguém mandar um PIN ou senha, avise para não compartilhar.
- Assuntos fora do aplicativo: diga educadamente que só ajuda com o G&C.

MANUAL:
${manualCompleto()}`;
}

function extrairTexto(r) {
  if (!r) return "";
  if (typeof r === "string") return r;
  if (r.choices && r.choices[0] && r.choices[0].message) return r.choices[0].message.content || "";
  return r.response || r.result || "";
}

export default async function ajudaHandler(req, env) {
  const usuario = await getUsuario(req, env);
  if (!usuario) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      grupo: grupoDoRank(usuario.rank),
      secoes: SECOES,
      sugestoes: SUGESTOES[grupoDoRank(usuario.rank)],
      assistente: !!env.AI,
    });
  }

  if (req.method === "POST") {
    if (!env.AI) return jsonResponse({ ok: false, error: "O assistente ainda não está ativado." }, 503);
    const { pergunta, historico } = await req.json();
    const texto = String(pergunta || "").trim().slice(0, 400);
    if (!texto) return jsonResponse({ ok: false, error: "Escreva uma pergunta." }, 400);
    const conversa = (Array.isArray(historico) ? historico : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));
    const messages = [{ role: "system", content: instrucoes(usuario.rank) }, ...conversa, { role: "user", content: texto }];

    for (const modelo of [MODELO, MODELO_RESERVA]) {
      try {
        const r = await env.AI.run(modelo, { messages, max_tokens: 500, max_completion_tokens: 500, temperature: 0.2 });
        const resposta = extrairTexto(r).trim();
        if (resposta) return jsonResponse({ ok: true, resposta });
      } catch (e) {
        console.error("Workers AI falhou", modelo, e);
      }
    }
    return jsonResponse({ ok: false, error: "O assistente não conseguiu responder agora (talvez o limite diário gratuito tenha acabado). Tente mais tarde ou veja o guia abaixo." }, 503);
  }

  return jsonResponse({ ok: false, error: "method not allowed" }, 405);
}
