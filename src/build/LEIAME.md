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
