import { login, signup } from "./lib/auth.js";
import { googleStart, googleCallback } from "./routes/google.js";
import { criarConviteLink, conviteInfo, aceitarConvite, loginCpf } from "./routes/convite-link.js";
import documentos from "./routes/documentos.js";
import equipe from "./routes/equipe.js";
import etapas from "./routes/etapas.js";
import etapaFotos from "./routes/etapa-fotos.js";
import obras from "./routes/obras.js";
import convites from "./routes/convites.js";
import observacoes from "./routes/observacoes.js";
import materiais from "./routes/materiais.js";
import ferramentas from "./routes/ferramentas.js";
import pedidos from "./routes/pedidos.js";
import usuariosMe from "./routes/usuarios-me.js";
import permissoes from "./routes/permissoes.js";
import leads from "./routes/leads.js";
import arquivoSet from "./routes/arquivo-set.js";
import arquivoGet from "./routes/arquivo-get.js";
import arquivoDelete from "./routes/arquivo-delete.js";
import ajuda from "./routes/ajuda.js";
import encerrarEmpresa from "./routes/encerrar-empresa.js";
import manual from "./routes/manual.js";
import assetlinks from "./routes/assetlinks.js";
import { reenviarConfirmacao, esqueciSenha, redefinirSenha, paginaConfirmarEmail, paginaRedefinirSenha } from "./routes/conta-email.js";
import admin from "./routes/admin.js";
import meusDados from "./routes/meus-dados.js";
import googleConfig from "./routes/google-config.js";
import sugestao from "./routes/sugestao.js";
import avisos from "./routes/avisos.js";
import push from "./routes/push.js";
import { enviarBackup } from "./lib/backup.js";
import { getSql } from "./lib/db.js";

const ROTAS = {
  "/api/auth/login": login,
  "/api/auth/signup": signup,
  "/api/auth/google": googleStart,
  "/api/auth/google/callback": googleCallback,
  "/api/auth/aceitar-convite": aceitarConvite,
  "/api/auth/login-cpf": loginCpf,
  "/api/auth/reenviar-confirmacao": reenviarConfirmacao,
  "/api/auth/esqueci-senha": esqueciSenha,
  "/api/auth/redefinir-senha": redefinirSenha,
  "/api/convite-link": criarConviteLink,
  "/api/convite-info": conviteInfo,
  "/api/documentos": documentos,
  "/api/equipe": equipe,
  "/api/etapas": etapas,
  "/api/etapa-fotos": etapaFotos,
  "/api/obras": obras,
  "/api/convites": convites,
  "/api/observacoes": observacoes,
  "/api/materiais": materiais,
  "/api/ferramentas": ferramentas,
  "/api/pedidos": pedidos,
  "/api/usuarios-me": usuariosMe,
  "/api/permissoes": permissoes,
  "/api/leads": leads,
  "/api/arquivo-set": arquivoSet,
  "/api/arquivo-get": arquivoGet,
  "/api/arquivo-delete": arquivoDelete,
  "/api/ajuda": ajuda,
  "/api/encerrar-empresa": encerrarEmpresa,
  "/api/admin": admin,
  "/api/meus-dados": meusDados,
  "/api/google-config": googleConfig,
  "/api/sugestao": sugestao,
  "/api/avisos": avisos,
  "/api/push": push,
};

export default {
  // Tarefa agendada (wrangler.jsonc → triggers.crons): backup semanal por e-mail, sábado 11:30 de Brasília.
  async scheduled(event, env, ctx) {
    // Limpeza dos avisos: novidades somem em 30 dias; auditoria (editou/apagou) fica 12 meses (Política de Privacidade).
    ctx.waitUntil(Promise.resolve().then(() => getSql(env)`
      DELETE FROM eventos WHERE (criado_em < now() - interval '30 days' AND acao NOT IN ('editou', 'apagou', 'desmarcou', 'rank'))
         OR criado_em < now() - interval '12 months'
    `).catch((e) => console.error("limpeza de eventos falhou", e)));
    ctx.waitUntil(enviarBackup(env, getSql(env)).then(
      (r) => console.log("backup semanal enviado", r.arquivo, r.kb + " KB"),
      (e) => console.error("backup semanal FALHOU", e)
    ));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const handler = ROTAS[url.pathname];
      if (!handler) {
        return new Response(JSON.stringify({ ok: false, error: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      try {
        return await handler(request, env, ctx);
      } catch (err) {
        // O detalhe fica só no log do Cloudflare; o navegador recebe uma mensagem genérica.
        console.error("Erro em", url.pathname, err);
        return new Response(JSON.stringify({ ok: false, error: "erro interno do servidor" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    if (url.pathname === "/manual" || url.pathname === "/manual/") return manual(request, env);
    if (url.pathname === "/.well-known/assetlinks.json") return assetlinks(request, env);
    try {
      if (url.pathname === "/confirmar-email") return await paginaConfirmarEmail(request, env);
      if (url.pathname === "/redefinir-senha") return await paginaRedefinirSenha(request, env);
    } catch (err) {
      console.error("Erro em", url.pathname, err);
      return new Response("Erro interno. Tente de novo em instantes.", { status: 500 });
    }

    return env.ASSETS.fetch(request);
  },
};
