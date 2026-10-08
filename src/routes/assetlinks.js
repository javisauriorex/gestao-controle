// GET /.well-known/assetlinks.json — vincula o app da Play Store (TWA) ao domínio.
// Sem este arquivo o app mostra a barra do navegador no topo.
// Impressões digitais SHA-256 (públicas, não são segredo) dos certificados que assinam o app:
//  1) chave de UPLOAD gerada no PWABuilder (08/10/2026) — vale para os testes antes da Play assinar;
//  2) chave de ASSINATURA do Google (Play App Signing) — acrescentar aqui depois de subir o .aab,
//     em Play Console → Integridade do app. Sem ela o app instalado pela loja mostra a barra do navegador.
// Além destas, ainda vale a variável TWA_SHA256 do Cloudflare (separadas por vírgula), se existir.
// Fica no código de propósito: variável só no painel pode ser apagada num deploy do GitHub.

export const PACOTE_ANDROID = "br.app.gestaoecontrole";

const IMPRESSOES_NO_CODIGO = [
  "15:58:AB:D5:11:15:92:C6:2F:19:2E:EE:15:70:6F:B6:BC:8C:58:68:33:8C:11:03:44:7D:33:96:1C:E7:C7:F6", // upload (PWABuilder)
];

export default async function assetlinks(request, env) {
  const doPainel = String((env && env.TWA_SHA256) || "").split(",");
  const impressoes = [...new Set([...IMPRESSOES_NO_CODIGO, ...doPainel]
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s)))];
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
