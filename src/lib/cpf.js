// ============================================================
// C4 — CPF e PIN mais robustos.
//  • CPF: a base guarda só uma "huella" (HMAC-SHA256 com a chave secreta PIN_PEPPER) para achar a
//    conta no login e impedir CPF repetido, e a versão mascarada "123.***.***-45" para mostrar.
//    O CPF completo deixa de existir na base.
//  • PIN: antes do hash (PBKDF2), o PIN passa por um HMAC com a mesma chave secreta ("pepper").
//    Quem roubar só a base não consegue testar os 10.000 PINs possíveis sem a chave.
// A chave fica SÓ no Cloudflare (segredo PIN_PEPPER). Sem ela, o app segue funcionando no modo antigo.
// PINs antigos (sem "v2$") continuam valendo e são convertidos no próximo login certo.
// ============================================================
import { hashSenha, verificarSenha } from "./auth.js";

async function hmacHex(chave, texto) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const mascararCpf = (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.***.***-${c.slice(9)}` : null);

export async function cpfHash(env, cpf) {
  return env.PIN_PEPPER ? hmacHex(env.PIN_PEPPER, "cpf:" + cpf) : null;
}

// Colunas a gravar para um CPF: com a chave → só huella + máscara; sem a chave → modo antigo (CPF completo).
export async function camposCpf(env, cpf) {
  const h = await cpfHash(env, cpf);
  return { cpf: h ? null : cpf, cpf_hash: h, cpf_mascarado: mascararCpf(cpf) };
}

export const temCpf = (u) => !!(u && (u.cpf || u.cpf_hash));

// O CPF digitado é o desta conta?
export async function cpfConfere(env, u, cpf) {
  if (u.cpf_hash) return (await cpfHash(env, cpf)) === u.cpf_hash;
  return !!u.cpf && u.cpf === cpf;
}

export const mascaraDe = (u) => (u ? u.cpf_mascarado || mascararCpf(u.cpf) : null);

export async function hashPin(env, pin) {
  if (!env.PIN_PEPPER) return hashSenha(String(pin));
  return "v2$" + (await hashSenha(await hmacHex(env.PIN_PEPPER, "pin:" + pin)));
}

// { ok, atualizar }: "atualizar" = PIN antigo certo → regravar no formato novo.
export async function conferirPin(env, pin, guardado) {
  if (!guardado) return { ok: false };
  if (guardado.startsWith("v2$")) {
    if (!env.PIN_PEPPER) return { ok: false };
    return { ok: await verificarSenha(await hmacHex(env.PIN_PEPPER, "pin:" + pin), guardado.slice(3)), atualizar: false };
  }
  const ok = await verificarSenha(String(pin), guardado);
  return { ok, atualizar: ok && !!env.PIN_PEPPER };
}
