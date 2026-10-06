const express = require("express");
let axios;
try {
  axios = require("axios");
} catch {
  // Mantém o servidor inicializável antes da instalação da nova dependência.
  axios = {
    async get(url, config = {}) { return requestWithFetch("GET", url, config); },
    async delete(url, config = {}) { return requestWithFetch("DELETE", url, config); }
  };
}
const { loadEnvFile } = require("../db");
const { domainRouter } = require("./route-factory");

async function requestWithFetch(method, url, config) {
  const response = await fetch(url, { method, headers: config.headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(`Evolution API respondeu ${response.status}.`);
    error.response = { status: response.status, data };
    throw error;
  }
  return { data, status: response.status };
}

function getEvolutionConfig() {
  loadEnvFile();
  return {
    evolutionUrl: (process.env.EVOLUTION_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
    evolutionApiKey: process.env.EVOLUTION_API_KEY,
    instanceName: process.env.INSTANCE_NAME || "euroconfort-bot"
  };
}

function normalizeState(payload) {
  const state = String(payload?.state || payload?.instance?.state || payload?.instance?.connectionState || "close").toLowerCase();
  if (state === "open") return "open";
  if (state.includes("connect")) return "connecting";
  return "close";
}

function normalizeQrCode(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const rawBase64 = source.base64 || source.qrcode?.base64 || source.qrCode?.base64 || null;
  return {
    base64: rawBase64 && !/^data:image\//i.test(rawBase64)
      ? `data:image/png;base64,${rawBase64.trim()}`
      : rawBase64,
    pairingCode: source.pairingCode || source.pairing_code || source.code || null,
    count: Number(source.count || 0)
  };
}

function sendEvolutionError(error, res, action) {
  const upstreamStatus = error.response?.status;
  const upstreamData = error.response?.data;
  console.error(`[Evolution API] Falha ao ${action}:`, {
    status: upstreamStatus,
    message: error.message,
    response: upstreamData
  });
  return res.status(upstreamStatus || 502).json({
    error: `Não foi possível ${action}.`,
    details: upstreamData?.message || upstreamData?.error || null
  });
}

function createEvolutionRouter() {
  const router = express.Router();

  router.get("/bot/status", async (_req, res) => {
    try {
      const { evolutionUrl, evolutionApiKey, instanceName } = getEvolutionConfig();
      if (!evolutionApiKey) return res.status(503).json({ error: "EVOLUTION_API_KEY não configurada." });
      const { data } = await axios.get(`${evolutionUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: evolutionApiKey },
        timeout: 10000
      });
      return res.json({ state: normalizeState(data) });
    } catch (error) {
      return sendEvolutionError(error, res, "consultar o status do WhatsApp");
    }
  });

  router.get("/bot/qrcode", async (_req, res) => {
    try {
      const { evolutionUrl, evolutionApiKey, instanceName } = getEvolutionConfig();
      if (!evolutionApiKey) return res.status(503).json({ error: "EVOLUTION_API_KEY não configurada." });
      const { data } = await axios.get(`${evolutionUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: evolutionApiKey },
        timeout: 15000
      });
      return res.json(normalizeQrCode(data));
    } catch (error) {
      return sendEvolutionError(error, res, "gerar o QR Code do WhatsApp");
    }
  });

  router.post("/bot/logout", async (_req, res) => {
    try {
      const { evolutionUrl, evolutionApiKey, instanceName } = getEvolutionConfig();
      if (!evolutionApiKey) return res.status(503).json({ error: "EVOLUTION_API_KEY não configurada." });
      const { data } = await axios.delete(`${evolutionUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: evolutionApiKey },
        timeout: 15000
      });
      return res.json({ success: true, message: "WhatsApp desconectado com sucesso.", data: data || null });
    } catch (error) {
      return sendEvolutionError(error, res, "desconectar o WhatsApp");
    }
  });

  return router;
}

module.exports = (dispatch) => {
  const router = express.Router();
  router.use(createEvolutionRouter());
  router.use(domainRouter((path) => (
    path === "/bot/auth"
    || path === "/bot/estoque"
    || path === "/bot/token"
    || path === "/bot/regenerate-token"
    || path === "/integracoes/bot"
    || path === "/integracoes/regenerate-token"
    || path.startsWith("/integracoes/bot/")
  ), dispatch));
  return router;
};

module.exports.createEvolutionRouter = createEvolutionRouter;
module.exports.normalizeQrCode = normalizeQrCode;
