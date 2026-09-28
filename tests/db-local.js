// Substitui src/lib/db.js nas provas: em vez do Neon (nuvem), usa um Postgres local.
import pg from "pg";
export const pool = new pg.Pool({
  host: process.env.PGHOST || "/tmp/pgt", port: Number(process.env.PGPORT || 5499),
  user: process.env.PGUSER || "postgres", database: process.env.PGDATABASE || "gc_teste",
});
export function getSql() {
  return async (strings, ...vals) => {
    let q = strings[0];
    vals.forEach((v, i) => { q += "$" + (i + 1) + strings[i + 1]; });
    return (await pool.query(q, vals)).rows;
  };
}
