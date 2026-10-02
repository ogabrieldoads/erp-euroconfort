const { JsonStore, api } = require("./legacy-api");
const { PostgresRuntimeRepository } = require("./repositories/postgres-runtime.repository");

function createApiRuntime({ dbPath } = {}) {
  const store = new JsonStore(dbPath);
  const postgres = process.env.USE_POSTGRES === "true" ? new PostgresRuntimeRepository(store.data, dbPath) : null;

  return {
    async dispatch(req, res, next) {
      try {
        const url = new URL(req.originalUrl || req.url, `http://${req.headers.host || "localhost"}`);
        const run = async (data) => {
          const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
          const session = token ? data.sessions.find((item) => item.token === token) : null;
          const user = session ? data.usuarios.find((item) => item.id === session.userId && item.ativo !== false) : null;
          return api(data, req, res, url, req.body || {}, user);
        };
        const result = postgres
          ? await postgres.execute({ pathname: url.pathname, method: req.method, action: run })
          : await run(store.data);
        if (!postgres) store.save();
        // Injeção de dbPath é exclusiva de testes: mantém sua cópia temporária
        // observável, sem transformar o JSON padrão em fonte de verdade no modo PG.
        if (postgres && dbPath) store.save(postgres.lastData);
        const status = result && typeof result === "object" && !Array.isArray(result) && result.__httpStatus ? result.__httpStatus : 200;
        res.status(status).json(result);
      } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message || "Erro interno." });
        return next(error);
      }
    }
  };
}

module.exports = { createApiRuntime };
