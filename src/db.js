const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

let pool = null;

function loadEnvFile(filePath = path.resolve(__dirname, "..", ".env")) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const name = key.trim();
    if (!name || process.env[name] !== undefined) continue;
    let value = rest.join("=").trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

function sslConfig(connectionString) {
  if (process.env.PGSSL === "false") return false;
  if (process.env.PGSSL === "true") return { rejectUnauthorized: false };
  return /supabase\.co|sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined;
}

function getPool() {
  loadEnvFile();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada no .env.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: sslConfig(connectionString)
    });
  }
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = { getPool, query, closePool, loadEnvFile };
