// ============================================================
// Cloudflare Turnstile — o "não sou um robô" sem semáforos nem bicicletas.
// Modo Gerenciado: quase sempre verifica sozinho; às vezes mostra um tilde.
// Chave secreta: segredo TURNSTILE_SECRET no Cloudflare. Sem ela, a verificação é pulada
// (assim o app não quebra antes de a chave estar configurada) e fica registrado no log.
// ============================================================
import { ipDe } from "./limites.js";

export async function turnstileOk(env, req, token) {
  if (!env.TURNSTILE_SECRET) { console.error("TURNSTILE_SECRET não configurada: verificação pulada"); return true; }
  if (!token || typeof token !== "string" || token.length > 2048) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ipDe(req) }),
    });
    const d = await r.json();
    return d.success === true;
  } catch (e) {
    console.error("Turnstile falhou", e);
    return false;
  }
}

export const MSG_TURNSTILE = "Confirme que você não é um robô e tente de novo.";
// Depois de quantos erros de login (da mesma rede, na última hora) o Turnstile passa a ser pedido no login.
export const FALHAS_PARA_PEDIR_TURNSTILE = 5;
