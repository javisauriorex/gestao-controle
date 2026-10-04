import { SECOES } from "../lib/ajuda-conhecimento.js";
import { CABECALHOS_SEGURANCA } from "../lib/auth.js";

// GET /manual — o Manual do Usuário completo, numa página para ler, imprimir ou salvar em PDF.
// Sai do MESMO texto da tela Ajuda e do assistente (src/lib/ajuda-conhecimento.js):
// mudou o manual lá, esta página muda junto. Página pública (não mostra dados de ninguém).

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Texto simples do manual → HTML: parágrafos, listas "- " e "1. ", **negrito**.
function paraHtml(texto) {
  const negrito = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const blocos = texto.trim().split(/\n\s*\n/);
  return blocos.map((bloco) => {
    const linhas = bloco.split("\n");
    const html = [];
    let lista = null;
    const fecha = () => { if (lista) { html.push(`</${lista}>`); lista = null; } };
    for (const l of linhas) {
      const ul = l.match(/^\s*-\s+(.*)/);
      const ol = l.match(/^\s*\d+\.\s+(.*)/);
      if (ul || ol) {
        const tipo = ul ? "ul" : "ol";
        if (lista !== tipo) { fecha(); html.push(`<${tipo}>`); lista = tipo; }
        html.push(`<li>${negrito((ul || ol)[1])}</li>`);
      } else {
        fecha();
        html.push(`<p>${negrito(l)}</p>`);
      }
    }
    fecha();
    return html.join("");
  }).join("\n");
}

export default async function manualHandler() {
  const indice = SECOES.map((s, i) => `<li><a href="#${s.id}">${i + 1}. ${esc(s.titulo)}</a></li>`).join("");
  const capitulos = SECOES.map((s, i) => `
    <section id="${s.id}">
      <h2>${i + 1}. ${esc(s.titulo)}</h2>
      ${paraHtml(s.texto)}
      <p class="topo"><a href="#indice">↑ Índice</a></p>
    </section>`).join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Manual do Usuário — G&amp;C</title>
<link rel="icon" href="/icon-192.png" />
<style>
  :root { --ink:#2b2620; --muted:#6b6257; --line:#d9d1c4; --bg:#f6f1e7; --amber:#c47f17; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 Georgia, "Times New Roman", serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  header { display:flex; align-items:center; gap:14px; border-bottom:2px solid var(--ink); padding-bottom:14px; }
  header img { width:56px; height:56px; border-radius:50%; }
  h1 { font-size: 1.6rem; margin:0; }
  .sub { color:var(--muted); margin:2px 0 0; font-size:.9rem; }
  .acoes { margin:18px 0; display:flex; gap:10px; flex-wrap:wrap; }
  .acoes a, .acoes button { font:inherit; font-size:.9rem; border:1px solid var(--ink); background:#fff; color:var(--ink); padding:8px 14px; border-radius:4px; cursor:pointer; text-decoration:none; }
  .acoes button { background:var(--amber); border-color:var(--amber); color:#fff; }
  nav#indice { background:#fff; border:1px solid var(--line); border-radius:6px; padding:14px 18px; }
  nav#indice h2 { margin:0 0 8px; font-size:1.1rem; border:0; padding:0; }
  nav#indice ol { list-style:none; padding:0; margin:0; columns:2; column-gap:24px; }
  nav#indice li { margin:3px 0; break-inside:avoid; }
  a { color:var(--amber); }
  section { margin-top:34px; }
  h2 { font-size:1.25rem; border-bottom:1px solid var(--line); padding-bottom:6px; }
  ul, ol { padding-left: 1.3em; }
  li { margin: 3px 0; }
  .topo { font-size:.85rem; text-align:right; }
  footer { margin-top:48px; border-top:1px solid var(--line); padding-top:12px; color:var(--muted); font-size:.85rem; }
  @media (max-width: 560px) { nav#indice ol { columns:1; } }
  @media print {
    body { background:#fff; font-size:12pt; }
    .acoes, .topo { display:none; }
    section { break-inside: avoid-page; }
    a { color:inherit; text-decoration:none; }
  }
</style>
</head>
<body>
<main>
  <header>
    <img src="/logo.png" alt="G&amp;C" />
    <div>
      <h1>Manual do Usuário</h1>
      <p class="sub">G&amp;C — Gestão &amp; Controle · versão beta</p>
    </div>
  </header>
  <div class="acoes">
    <button onclick="window.print()">⤓ Imprimir / salvar em PDF</button>
    <a href="/">← Voltar ao aplicativo</a>
  </div>
  <nav id="indice"><h2>Índice</h2><ol>${indice}</ol></nav>
  ${capitulos}
  <footer>
    Dúvidas: botão AJUDA no aplicativo · suporte@gestaoecontrole.app.br · info@gestaoecontrole.app.br<br />
    <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Política de Privacidade</a>
  </footer>
</main>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", ...CABECALHOS_SEGURANCA } });
}
