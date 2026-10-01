const path = require("node:path");
const http = require("node:http");
const express = require("express");
const cors = require("cors");
const { createApiRuntime } = require("./app-runtime");
const { createApiRouter } = require("./routes");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

function createServer({ dbPath } = {}) {
  const app = express();
  const runtime = createApiRuntime({ dbPath });
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(runtime));
  app.use(express.static(PUBLIC_DIR));
  app.get("/ativar-conta", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message || "Erro interno." }));
  return http.createServer(app);
}

if (require.main === module) {
  createServer().listen(PORT, () => console.log(`ERP MVP disponível em http://localhost:${PORT}`));
}

module.exports = { createServer };
