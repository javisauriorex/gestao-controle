// G&C — roda no <head>, antes de desenhar a tela (D2: antes era código escrito dentro do index.html).
(function () {
  // Chrome avisa que o app é instalável (às vezes antes do React montar): guardamos o evento.
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__gcInstalar = e; window.dispatchEvent(new Event("gc-instalavel")); });
  window.addEventListener("appinstalled", function () { window.__gcInstalar = null; window.__gcInstalado = true; window.dispatchEvent(new Event("gc-instalado")); });

  // Tamanho da letra e tema escuro antes de desenhar (evita "pulo").
  try {
    var f = { normal: 1.12, grande: 1.25, enorme: 1.4 }[localStorage.getItem("gc-fonte") || "normal"];
    if (f) document.documentElement.style.setProperty("--fs", f);
    if (localStorage.getItem("tema") === "escuro") document.documentElement.classList.add("gc-tema-escuro");
  } catch (e) {}

  // Splash: fica no mínimo até a animação terminar (~2,6 s) e some quando o app avisa que está pronto.
  var t0 = Date.now(), fechado = false;
  window.gcFecharSplash = function () {
    if (fechado) return; fechado = true;
    setTimeout(function () {
      var el = document.getElementById("gc-splash");
      if (!el) return;
      el.classList.add("saindo");
      setTimeout(function () { el.remove(); }, 350);
    }, Math.max(0, 2600 - (Date.now() - t0)));
  };
  setTimeout(window.gcFecharSplash, 15000); // se algo travar, não prende a pessoa no splash
})();
