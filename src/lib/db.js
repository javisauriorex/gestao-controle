import { neon } from "@neondatabase/serverless";

// En Netlify, `process.env.DATABASE_URL` vivía siempre disponible.
// En Cloudflare Workers, las env vars llegan por request (env.DATABASE_URL),
// así que sql se construye una vez por request, no a nivel de módulo.
export function getSql(env) {
  return neon(env.DATABASE_URL);
}
