// Validações simples de entrada (Bloco D, 09/11/2026).

// Textos que vêm de fora: tira caracteres de controle (quebras de linha etc.) e corta no tamanho.
export function textoLimpo(v, max) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
// E-mail com formato simples e sem quebras de linha (evita injeção em cabeçalhos de e-mail).
export function emailValido(e) {
  return typeof e === "string" && e.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(e);
}

