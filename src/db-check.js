const { query, closePool } = require("./db");

async function main() {
  const result = await query("SELECT current_database() AS database, now() AS connected_at");
  console.table(result.rows);
  await closePool();
}

main().catch(async (error) => {
  await closePool();
  console.error("Falha na conexão PostgreSQL:", error.message);
  process.exitCode = 1;
});
