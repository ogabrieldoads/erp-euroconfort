const { query, closePool } = require("./db");

async function main() {
  await query("CREATE TABLE IF NOT EXISTS erp_connection_checks (id VARCHAR PRIMARY KEY, checked_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  await query("INSERT INTO erp_connection_checks (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET checked_at = now()", ["route-read-write"]);
  const result = await query("SELECT id, checked_at FROM erp_connection_checks WHERE id = $1", ["route-read-write"]);
  if (!result.rows.length) throw new Error("Falha na validação de leitura/escrita PostgreSQL.");
  console.table(result.rows);
  await closePool();
}

main().catch(async (error) => {
  await closePool();
  console.error("Falha no teste PostgreSQL:", error.message);
  process.exitCode = 1;
});
