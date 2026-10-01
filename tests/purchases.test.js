const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../src/server");

async function startServer() {
  const tempRoot = path.join(__dirname, "..", "work", "test-db");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "erp-purchases-"));
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

test("compras integra recebimento parcial e total com estoque, custos e financeiro", async () => {
  const { server, baseUrl, dbPath } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    assert.equal(login.response.status, 200);
    const token = login.payload.token;

    const supplier = await request(baseUrl, "POST", "/api/fornecedores", token, {
      razao_social: "Fábrica Conforto Ltda",
      nome_fantasia: "Fábrica Conforto",
      cnpj: "11.222.333/0001-44",
      contato_nome: "Ana Compras",
      telefone: "(85) 99999-1000",
      email: "compras@example.com",
      condicoes_pagamento_padrao: "Entrada + 30/60 dias"
    });
    assert.equal(supplier.response.status, 200);

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Colchão Teste Compras",
      category: "Colchão",
      fornecedor_id: supplier.payload.id,
      sku: "CMP-TESTE-001",
      salePrice: 399,
      costPrice: 90,
      minStock: 5
    });
    assert.equal(product.response.status, 200);

    const order = await request(baseUrl, "POST", "/api/compras/ordens", token, {
      fornecedor_id: supplier.payload.id,
      loja_id: "loja_1",
      data_emissao: "2026-09-18",
      previsao_entrega: "2026-09-25",
      status: "PEDIDO_ENVIADO",
      valor_frete: 20,
      condicao_pagamento: "Entrada + 30/60 dias",
      itens: [{ produto_id: product.payload.id, quantidade_pedida: 5, custo_unitario: 100 }]
    });
    assert.equal(order.response.status, 200);
    assert.equal(order.payload.id, "OC-1001");
    assert.equal(order.payload.valor_total, 520);

    const stockIncoming = await request(baseUrl, "GET", "/api/stock", token);
    const incomingRow = stockIncoming.payload.find((row) => row.product.id === product.payload.id);
    assert.equal(incomingRow.a_chegar, 5);

    const itemId = order.payload.itens[0].id;
    const partial = await request(baseUrl, "POST", `/api/compras/ordens/${order.payload.id}/receber`, token, {
      itens: [{ id: itemId, quantidade_recebida: 2, custo_unitario: 110 }]
    });
    assert.equal(partial.response.status, 200, JSON.stringify(partial.payload));
    assert.equal(partial.payload.ordem.status, "RECEBIDO_PARCIAL");
    assert.equal(partial.payload.contas_a_pagar.length, 0);

    const dbAfterPartial = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    const storedProduct = dbAfterPartial.products.find((row) => row.id === product.payload.id);
    assert.equal(storedProduct.saldo_deposito, 2);
    assert.equal(storedProduct.preco_custo, 110);
    assert.equal(dbAfterPartial.movimentacoes_estoque.at(-1).tipo, "ENTRADA_COMPRA");
    assert.match(dbAfterPartial.movimentacoes_estoque.at(-1).referencia, /OC-1001/);

    const total = await request(baseUrl, "POST", `/api/compras/ordens/${order.payload.id}/receber`, token, {
      itens: [{ id: itemId, quantidade_recebida: 3, custo_unitario: 105 }]
    });
    assert.equal(total.response.status, 200);
    assert.equal(total.payload.ordem.status, "RECEBIDO_TOTAL");
    assert.equal(total.payload.ordem.valor_total, 555);
    assert.equal(total.payload.contas_a_pagar.length, 3);
    assert.equal(total.payload.contas_a_pagar.reduce((sum, bill) => sum + bill.valor, 0), 555);
    assert.ok(total.payload.contas_a_pagar.every((bill) => bill.storeId === "loja_1"));

    const stockFinal = await request(baseUrl, "GET", "/api/stock", token);
    const finalRow = stockFinal.payload.find((row) => row.product.id === product.payload.id);
    assert.equal(finalRow.saldo_deposito, 5);
    assert.equal(finalRow.a_chegar, 0);

    const bills = await request(baseUrl, "GET", "/api/bills", token);
    const purchaseBills = bills.payload.filter((bill) => bill.ordem_id === order.payload.id);
    assert.equal(purchaseBills.length, 3);

    const paid = await request(baseUrl, "PUT", `/api/bills/${purchaseBills[0].id}`, token, {
      status: "pago",
      storeId: "loja_1",
      paymentMethod: "pix"
    });
    assert.equal(paid.response.status, 200);
    const cash = await request(baseUrl, "GET", "/api/cash", token);
    assert.ok(cash.payload.movements.some((movement) => movement.billId === purchaseBills[0].id && movement.type === "saida" && movement.value === purchaseBills[0].value));

    const duplicate = await request(baseUrl, "POST", `/api/compras/ordens/${order.payload.id}/receber`, token, {
      itens: [{ id: itemId, quantidade_recebida: 1, custo_unitario: 105 }]
    });
    assert.equal(duplicate.response.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
