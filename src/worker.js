import { login, signup } from "./lib/auth.js";
import documentos from "./routes/documentos.js";
import equipe from "./routes/equipe.js";
import etapas from "./routes/etapas.js";
import obras from "./routes/obras.js";
import convites from "./routes/convites.js";
import observacoes from "./routes/observacoes.js";
import materiais from "./routes/materiais.js";
import ferramentas from "./routes/ferramentas.js";
import usuariosMe from "./routes/usuarios-me.js";
import permissoes from "./routes/permissoes.js";
import leads from "./routes/leads.js";
import arquivoSet from "./routes/arquivo-set.js";
import arquivoGet from "./routes/arquivo-get.js";
import arquivoDelete from "./routes/arquivo-delete.js";

const ROTAS = {
  "/api/auth/login": login,
  "/api/auth/signup": signup,
  "/api/documentos": documentos,
  "/api/equipe": equipe,
  "/api/etapas": etapas,
  "/api/obras": obras,
  "/api/convites": convites,
  "/api/observacoes": observacoes,
  "/api/materiais": materiais,
  "/api/ferramentas": ferramentas,
  "/api/usuarios-me": usuariosMe,
  "/api/permissoes": permissoes,
  "/api/leads": leads,
  "/api/arquivo-set": arquivoSet,
  "/api/arquivo-get": arquivoGet,
  "/api/arquivo-delete": arquivoDelete,
};

export default {
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
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
