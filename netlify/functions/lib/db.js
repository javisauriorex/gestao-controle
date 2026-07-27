import { neon } from "@netlify/neon";

// Usa automáticamente NETLIFY_DATABASE_URL, configurada sola al activar Netlify DB.
export const sql = neon();
