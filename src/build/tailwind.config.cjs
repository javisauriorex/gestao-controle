// Gera vendor/tailwind.css a partir das classes usadas no index.html (Tailwind 3.4.17).
// Rodar (Claude faz isso): npx tailwindcss@3.4.17 -c src/build/tailwind.config.cjs -i src/build/tailwind.in.css -o vendor/tailwind.css --minify
module.exports = {
  content: ["./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Special Elite"', "ui-monospace", "monospace"],
        mono: ['"Special Elite"', "ui-monospace", "monospace"],
      },
    },
  },
};
