const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../src/server");

async function startServer() {
  const tempRoot = path.join(__dirname, "..", "work", "test-db");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "erp-access-"));
  const dbPath = path.join(tempDir, "db.json");
  const server = createServer({ dbPath });
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, dbPath, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, method, pathname, token, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, payload: await response.json() };
}

test("solicitação de acesso exige aprovação e respeita aprovação ou rejeição", async () => {
  const { server, dbPath, baseUrl } = await startServer();
  try {
    const stores = await request(baseUrl, "GET", "/api/public/lojas");
    assert.equal(stores.response.status, 200);
    assert.ok(stores.payload.length >= 1);
    const storeId = stores.payload[0].id;

    const pendingRequest = await request(baseUrl, "POST", "/api/solicitacoes-acesso", null, {
      nome: "Maria Solicitante",
      login: "maria.solicitante@example.com",
      loja_id: storeId,
      senha: "senha123",
      confirmar_senha: "senha123"
    });
    assert.equal(pendingRequest.response.status, 200);

    const pendingLogin = await request(baseUrl, "POST", "/api/auth/login", null, {
      login: "maria.solicitante@example.com",
      password: "senha123"
    });
    assert.equal(pendingLogin.response.status, 400);
    assert.equal(pendingLogin.payload.error, "Sua conta ainda está aguardando aprovação da gestão.");

    const adminLogin = await request(baseUrl, "POST", "/api/auth/login", null, { login: "gestor", password: "123456" });
    assert.equal(adminLogin.response.status, 200);
    const token = adminLogin.payload.token;
    const users = await request(baseUrl, "GET", "/api/users", token);
    const pendingUser = users.payload.find((user) => user.login === "maria.solicitante@example.com");
    assert.equal(pendingUser.status, "PENDENTE_APROVACAO");
    assert.equal(pendingUser.papel, "PENDENTE");
    assert.equal(pendingUser.loja_id, storeId);

    const approval = await request(baseUrl, "PUT", `/api/users/${pendingUser.id}/approve`, token, {
      papel: "OPERADOR_CAIXA",
      loja_id: storeId
    });
    assert.equal(approval.response.status, 200);
    assert.equal(approval.payload.status, "ATIVO");
    assert.equal(approval.payload.papel, "OPERADOR_CAIXA");
    assert.equal(approval.payload.aprovado_por, "user_gestor");

    const approvedLogin = await request(baseUrl, "POST", "/api/auth/login", null, {
      login: "maria.solicitante@example.com",
      password: "senha123"
    });
    assert.equal(approvedLogin.response.status, 200);
    assert.equal(approvedLogin.payload.user.papel, "OPERADOR_CAIXA");

    await request(baseUrl, "POST", "/api/solicitacoes-acesso", null, {
      nome: "João Rejeitado",
      login: "joao.rejeitado@example.com",
      loja_id: storeId,
      senha: "senha456",
      confirmar_senha: "senha456"
    });
    const usersAfterSecondRequest = await request(baseUrl, "GET", "/api/users", token);
    const rejectedUser = usersAfterSecondRequest.payload.find((user) => user.login === "joao.rejeitado@example.com");
    const rejection = await request(baseUrl, "PUT", `/api/users/${rejectedUser.id}/reject`, token);
    assert.equal(rejection.response.status, 200);
    assert.equal(rejection.payload.status, "REJEITADO");

    const rejectedLogin = await request(baseUrl, "POST", "/api/auth/login", null, {
      login: "joao.rejeitado@example.com",
      password: "senha456"
    });
    assert.equal(rejectedLogin.response.status, 400);
    assert.equal(rejectedLogin.payload.error, "Acesso suspenso. Entre em contato com o gestor.");

    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    const storedUser = db.usuarios.find((user) => user.id === pendingUser.id);
    assert.ok(storedUser.solicitado_em);
    assert.equal(storedUser.aprovado_por, "user_gestor");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("novo fluxo de acesso registra cargo, aguarda gestor e libera credencial temporária", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const requestAccess = await request(baseUrl, "POST", "/api/auth/request-access", null, {
      nome: "Ana Comercial",
      email: "ana.comercial@example.com",
      cargo_solicitado: "Consultora de vendas",
      justificativa: "Preciso consultar o catálogo e registrar pedidos da loja."
    });
    assert.equal(requestAccess.response.status, 200);
    assert.equal(requestAccess.payload.status, "pending");

    const pendingLogin = await request(baseUrl, "POST", "/api/auth/login", null, { login: "ana.comercial@example.com", password: "qualquer" });
    assert.equal(pendingLogin.response.status, 400);
    assert.match(pendingLogin.payload.error, /aguardando aprovação/);

    const manager = await request(baseUrl, "POST", "/api/auth/login", null, { login: "gestor", password: "123456" });
    const pending = await request(baseUrl, "GET", "/api/admin/access-requests", manager.payload.token);
    assert.equal(pending.response.status, 200);
    const access = pending.payload.find((item) => item.email === "ana.comercial@example.com");
    assert.equal(access.cargo_solicitado, "Consultora de vendas");

    const approved = await request(baseUrl, "POST", `/api/admin/access-requests/${access.id}/approve`, manager.payload.token, {
      papel: "OPERADOR_CAIXA", loja_id: "loja_1", senha: "senha123"
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.user.status, "ATIVO");

    const activeLogin = await request(baseUrl, "POST", "/api/auth/login", null, { login: "ana.comercial@example.com", password: "senha123" });
    assert.equal(activeLogin.response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
