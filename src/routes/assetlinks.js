// GET /.well-known/assetlinks.json — vincula o app da Play Store (TWA) ao domínio.
// Sem este arquivo o app mostra a barra do navegador no topo.
// A(s) impressão(ões) digital(is) SHA-256 vêm da variável TWA_SHA256 do Cloudflare
// (separadas por vírgula): assim, quando o Google gera a chave de assinatura, não precisa subir código.
// Arquivo público, sem dados de ninguém.

export const PACOTE_ANDROID = "br.app.gestaoecontrole";

export default async function assetlinks(request, env) {
  const impressoes = String((env && env.TWA_SHA256) || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  const corpo = impressoes.length === 0 ? [] : [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACOTE_ANDROID,
      sha256_cert_fingerprints: impressoes,
    },
  }];
  return new Response(JSON.stringify(corpo, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
    },
  });
}
