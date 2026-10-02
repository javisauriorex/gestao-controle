// Simula o módulo "cloudflare:email" (só existe dentro do Cloudflare) para as provas locais.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === "cloudflare:email") return { url: "data:text/javascript," + encodeURIComponent("export class EmailMessage { constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; } }"), shortCircuit: true };
  return next(spec, ctx);
}`));
