// Substitui src/lib/db.js nas provas: em vez do Neon (nuvem), usa um Postgres local.
// Imita o driver do Neon: sql`...` só roda quando é aguardado (await), e sql.transaction([...])
// roda várias consultas numa transação (tudo ou nada).
import pg from "pg";
export const pool = new pg.Pool({
  host: process.env.PGHOST || "/tmp/pgt", port: Number(process.env.PGPORT || 5499),
  user: process.env.PGUSER || "postgres", database: process.env.PGDATABASE || "gc_teste",
});
function montar(strings, vals) {
  let q = strings[0];
  vals.forEach((v, i) => { q += "$" + (i + 1) + strings[i + 1]; });
  return { q, vals };
}
export function getSql() {
  const sql = (strings, ...vals) => {
    const c = montar(strings, vals);
    return { __consulta: c, then: (ok, falha) => pool.query(c.q, c.vals).then((r) => r.rows).then(ok, falha) };
  };
  sql.transaction = async (consultas) => {
    const cli = await pool.connect();
    try {
      await cli.query("BEGIN");
      const out = [];
      for (const k of consultas) out.push((await cli.query(k.__consulta.q, k.__consulta.vals)).rows);
      await cli.query("COMMIT");
      return out;
    } catch (e) { await cli.query("ROLLBACK"); throw e; }
    finally { cli.release(); }
  };
  return sql;
}
