// G&C — carrega o app SEM travar a abertura (D2, 10/11/2026).
//  1) a página (splash) termina de carregar sozinha → o Android tira o ícone dele e mostra o NOSSO splash;
//  2) só depois baixamos React e o app (app.js, que já vem compilado: o celular não precisa mais do Babel);
//  3) a biblioteca de zip (só para o backup) vem por último, sem pressa.
(function () {
  var app = (document.currentScript && document.currentScript.getAttribute("data-app")) || "app.js";
  function carregar(src) {
    return new Promise(function (ok, falha) {
      var s = document.createElement("script"); s.src = src; s.async = false;
      s.onload = ok; s.onerror = function () { falha(new Error("falhou " + src)); };
      document.body.appendChild(s);
    });
  }
  function iniciar() {
    try { localStorage.removeItem("gc-app-js"); localStorage.removeItem("gc-app-hash"); } catch (e) {} // cache antigo (até o Bloco D)
    Promise.all([carregar("vendor/react.production.min.js"), carregar("vendor/react-dom.production.min.js"), carregar(app)])
      .then(function () { carregar("vendor/jszip.min.js").catch(function () {}); })
      .catch(function (e) { console.error(e); if (window.gcFecharSplash) window.gcFecharSplash(); });
  }
  if (document.readyState === "complete") setTimeout(iniciar, 0);
  else window.addEventListener("load", function () { setTimeout(iniciar, 0); });

  // Service worker sempre na última versão:
  //  - updateViaCache "none": o navegador nunca usa cópia velha do sw.js;
  //  - ao abrir o app e ao voltar para ele, pergunta ao servidor se há versão nova;
  //  - a versão nova assume na hora (skipWaiting + clients.claim no sw.js) e a tela recarrega
  //    sozinha na próxima vez que a pessoa voltar ao app (nunca no meio de algo que está digitando).
  if ("serviceWorker" in navigator) {
    var recarregarAoVoltar = false;
    var jaTinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!jaTinhaControle) return; // primeira instalação: nada a recarregar
      if (document.hidden) location.reload(); else recarregarAoVoltar = true;
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
        reg.update().catch(function () {});
        document.addEventListener("visibilitychange", function () {
          if (document.hidden) return;
          if (recarregarAoVoltar) { location.reload(); return; }
          reg.update().catch(function () {});
        });
      }).catch(function (e) { console.log("SW falhou:", e); });
    });
  }
})();
