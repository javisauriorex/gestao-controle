# Bibliotecas fixas (vendor/)

Desde 04/10/2026 o G&C NÃO baixa mais nada de unpkg.com nem de cdn.tailwindcss.com.
As bibliotecas ficam em `vendor/`, em versão fixa:

| Arquivo | Origem | Versão |
|---|---|---|
| vendor/react.production.min.js | npm react (umd) | 18.3.1 |
| vendor/react-dom.production.min.js | npm react-dom (umd) | 18.3.1 |
| vendor/babel.min.js | npm @babel/standalone | 7.29.9 |
| vendor/tailwind.css | gerado com tailwindcss 3.4.17 a partir do index.html | — |

**Importante:** o `tailwind.css` só contém as classes que o index.html usa. Se o index.html
ganhar classes novas, é preciso gerar o CSS de novo (comando em tailwind.config.cjs) e subir
o `vendor/tailwind.css` junto. Atualizar versão = decisão consciente, nunca automática.

## D2 (10/11/2026) — o app vem compilado

- O código do app mora em `src/app/app.jsx` (não é publicado).
- `node src/build/compilar.mjs` gera `app.js` (já sem JSX) e atualiza a versão (`app.js?v=…`) no `index.html`.
- O celular não baixa mais o Babel (`vendor/babel.min.js` fica no repo só para compilar).
- `index.html` não tem nenhum `<script>` escrito dentro: só `inicio.js` (head) e `carregar.js` (fim).
  A CSP de `/` e `/index.html` (em `_headers`) proíbe código inline.
- Toda entrega que muda o app leva juntos: `src/app/app.jsx`, `app.js`, `index.html` e, se mudou classe, `vendor/tailwind.css`.
