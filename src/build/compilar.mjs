// ============================================================
// Compila o app: src/app/app.jsx → app.js (JavaScript pronto, sem JSX) e atualiza a versão no index.html.
// Uso (na pasta do repositório):   node src/build/compilar.mjs
// Usa o MESMO Babel fixo que está em vendor/ (7.29.9), sem instalar nada.
// D2 (10/11/2026): o celular não baixa nem roda mais o Babel; a CSP do app proíbe código dentro da página.
// ============================================================
import fs from "fs";
import vm from "vm";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ctx = { console };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, "vendor/babel.min.js"), "utf8"), ctx);

const fonte = fs.readFileSync(path.join(raiz, "src/app/app.jsx"), "utf8");
const { code } = ctx.Babel.transform(fonte, { presets: [["react", { runtime: "classic" }]] });
const versao = crypto.createHash("sha256").update(code).digest("hex").slice(0, 12);
const cabecalho = `// G&C — app compilado de src/app/app.jsx (NÃO editar este arquivo: editar o app.jsx e rodar node src/build/compilar.mjs). Versão ${versao}\n`;
fs.writeFileSync(path.join(raiz, "app.js"), cabecalho + code + "\n");

const indexPath = path.join(raiz, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const novo = html.replace(/data-app="app\.js\?v=[^"]*"/, `data-app="app.js?v=${versao}"`);
if (novo === html && !html.includes(`app.js?v=${versao}`)) throw new Error("não achei data-app no index.html");
fs.writeFileSync(indexPath, novo);
console.log(`app.js gerado (${(code.length / 1024).toFixed(0)} KB) — versão ${versao}`);
