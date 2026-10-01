const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../src/server");

async function startServer() {
  const tempRoot = path.join(__dirname, "..", "work", "test-db");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "erp-mvp-"));
  const dbPath = path.join(tempDir, "db.json");
  const server = createServer({ dbPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl, dbPath };
}

async function request(baseUrl, method, pathName, token, body) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  return { response, payload };
}

async function openCash(baseUrl, token, storeId = "loja_1", openingCash = 0) {
  return request(baseUrl, "POST", "/api/cash/open", token, {
    storeId,
    saldo_inicial_troco: openingCash
  });
}

test("fluxo crítico: venda valida estoque, baixa saldo, gera caixa e entrega", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    assert.equal(login.response.status, 200);
    const token = login.payload.token;

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Colchão Queen Comfort",
      category: "colchão",
      brandModel: "Comfort Q158",
      sku: "COL-Q-COMFORT",
      salePrice: 1899.9,
      costPrice: 990,
      minStock: 1
    });
    assert.equal(product.response.status, 200);

    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      nome: "Maria Cliente",
      cpf_cnpj: "123.456.789-00",
      telefone: "(85) 99999-0000",
      telefone_secundario: "(85) 98888-0000",
      email: "maria@example.com",
      cep: "60000-000",
      logradouro: "Rua das Flores",
      numero: "100",
      complemento: "Casa",
      bairro: "Centro",
      cidade: "Fortaleza",
      referencia: "Portão azul"
    });
    assert.equal(customer.response.status, 200);
    assert.equal(customer.payload.nome, "Maria Cliente");
    assert.equal(customer.payload.name, "Maria Cliente");
    assert.equal(customer.payload.address, "Rua das Flores, Nº 100, Casa - Centro (Ref: Portão azul)");

    const stockEntry = await request(baseUrl, "POST", "/api/stock/entry", token, {
      productId: product.payload.id,
      quantity: 2
    });
    assert.equal(stockEntry.response.status, 200);
    await openCash(baseUrl, token, "loja_1");

    const blockedSale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 3 }],
      hasDelivery: false
    });
    assert.equal(blockedSale.response.status, 400);
    assert.match(blockedSale.payload.error, /Estoque insuficiente/);

    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: true,
      deliveryPerson: "Carlos",
      deliveryDate: "2026-09-10"
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.codigo_venda, 1001);
    assert.equal(sale.payload.sale.total, 1899.9);
    assert.equal(sale.payload.sale.sellerName, "Vendedora Loja 1");
    assert.equal(sale.payload.sale.vendedorNome, "Vendedora Loja 1");
    assert.equal(sale.payload.deliveryOrder.status, "pendente");

    const stock = await request(baseUrl, "GET", "/api/stock", token);
    const productStock = stock.payload.find((row) => row.product.id === product.payload.id);
    assert.equal(productStock.saldo_deposito, 1);
    assert.equal(productStock.showroom_loja1, 0);
    assert.equal(productStock.showroom_loja2, 0);
    assert.equal(productStock.total, 1);

    const cash = await request(baseUrl, "GET", "/api/cash", token);
    assert.equal(cash.payload.consolidated, 1899.9);
    assert.equal(cash.payload.movements.length, 1);
    assert.equal(cash.payload.movements[0].category, "Venda");
    assert.equal(cash.payload.movements[0].description, "Entrada automática da venda 1001 - Pix");
    assert.equal(cash.payload.movements[0].paymentMethod, "pix");

    const kardex = await request(baseUrl, "GET", `/api/stock/movements?productId=${product.payload.id}`, token);
    assert.equal(kardex.response.status, 200);
    assert.equal(kardex.payload.product.saldo_deposito, 1);
    assert.deepEqual(kardex.payload.movements.map((movement) => movement.tipo).sort(), ["ENTRADA", "SAIDA_VENDA"]);
    const saleMovement = kardex.payload.movements.find((movement) => movement.tipo === "SAIDA_VENDA");
    assert.equal(saleMovement.referencia, "Venda #1001");
    assert.equal(saleMovement.quantidade, 1);
    assert.equal(saleMovement.saldo_apos_movimentacao, 1);

    const deliveries = await request(baseUrl, "GET", "/api/deliveries", token);
    assert.equal(deliveries.payload.length, 1);
    assert.equal(deliveries.payload[0].deliveryPerson, "Carlos");
    assert.equal(deliveries.payload[0].customerName, "Maria Cliente");
    assert.equal(deliveries.payload[0].address, "Rua das Flores, Nº 100, Casa - Centro (Ref: Portão azul)");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("caixa pendente bloqueia nova abertura até o fechamento", async () => {
  const first = await startServer();
  let server = first.server;
  try {
    const login = await request(first.baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const opened = await openCash(first.baseUrl, login.payload.token, "loja_1", 100);
    assert.equal(opened.response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const saved = JSON.parse(fs.readFileSync(first.dbPath, "utf8"));
  saved.sessoes_caixa[0].data_abertura = "2026-09-01T08:00:00.000Z";
  fs.writeFileSync(first.dbPath, JSON.stringify(saved, null, 2));

  const restarted = createServer({ dbPath: first.dbPath });
  await new Promise((resolve) => restarted.listen(0, resolve));
  server = restarted;
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;
    const blocked = await openCash(baseUrl, token, "loja_1");
    assert.equal(blocked.response.status, 400);
    assert.match(blocked.payload.error, /caixa pendente/);

    const cash = await request(baseUrl, "GET", "/api/cash", token);
    assert.equal(cash.payload.sessoesPendentes.length, 1);

    const closed = await request(baseUrl, "POST", "/api/cash/close", token, {
      storeId: "loja_1",
      valores_declarados: { dinheiro: 100, pix: 0, cartao_credito: 0, cartao_debito: 0, boleto: 0 }
    });
    assert.equal(closed.response.status, 200);
    assert.equal(closed.payload.status, "fechado");

    const reopened = await openCash(baseUrl, token, "loja_1");
    assert.equal(reopened.response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("vendedores: cadastro, edição, inativação e bloqueio em venda", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const created = await request(baseUrl, "POST", "/api/vendedores", token, {
      nome: "Ana Vendedora",
      loja_padrao: "Ambas",
      telefone: "(85) 97777-0000"
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.ativo, true);

    const edited = await request(baseUrl, "PUT", `/api/vendedores/${created.payload.id}`, token, {
      nome: "Ana Vendedora Sênior",
      loja_padrao: "Loja 2",
      telefone: "(85) 97777-0001"
    });
    assert.equal(edited.response.status, 200);
    assert.equal(edited.payload.nome, "Ana Vendedora Sênior");
    assert.equal(edited.payload.loja_padrao, "Loja 2");

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Mesa Box",
      category: "cama",
      brandModel: "Box Teste",
      sku: "BOX-VEND",
      salePrice: 1200,
      costPrice: 700,
      minStock: 1
    });
    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      name: "Cliente Vendedor",
      phone: "(85) 96666-0000",
      address: "Rua Vendas, 200"
    });
    await request(baseUrl, "POST", "/api/stock/entry", token, {
      productId: product.payload.id,
      quantity: 2
    });
    await openCash(baseUrl, token, "loja_2");

    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: created.payload.id,
      storeId: "loja_2",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.sellerId, created.payload.id);
    assert.equal(sale.payload.sale.vendedorId, created.payload.id);
    assert.equal(sale.payload.sale.sellerName, "Ana Vendedora Sênior");
    assert.equal(sale.payload.sale.vendedorNome, "Ana Vendedora Sênior");

    const overview = await request(baseUrl, "GET", "/api/overview?period=month", token);
    assert.ok(overview.payload.sellerRanking.some((row) => row.id === created.payload.id && row.name === "Ana Vendedora Sênior"));

    const inactive = await request(baseUrl, "PUT", `/api/vendedores/${created.payload.id}`, token, { ativo: false });
    assert.equal(inactive.response.status, 200);
    assert.equal(inactive.payload.ativo, false);

    const blockedSale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: created.payload.id,
      storeId: "loja_2",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(blockedSale.response.status, 400);
    assert.match(blockedSale.payload.error, /Vendedor inválido ou inativo/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("fornecedores: cadastro, edição, busca por API e inativação", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const invalid = await request(baseUrl, "POST", "/api/fornecedores", token, {
      nome_fantasia: "Sem CNPJ",
      razao_social: "Fornecedor Sem CNPJ LTDA"
    });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.payload.error, /Razão social, nome fantasia e CNPJ/);

    const created = await request(baseUrl, "POST", "/api/fornecedores", token, {
      nome_fantasia: "Colchões Prime",
      razao_social: "Colchões Prime Indústria LTDA",
      cnpj: "12.345.678/0001-90",
      contato_representante: "Marcos (85) 99999-2222",
      email: "representante@example.com"
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.payload.ativo, true);
    assert.equal(created.payload.nome_fantasia, "Colchões Prime");

    const edited = await request(baseUrl, "PUT", `/api/fornecedores/${created.payload.id}`, token, {
      nome_fantasia: "Prime Colchões",
      razao_social: "Colchões Prime Indústria LTDA",
      cnpj: "12.345.678/0001-90",
      contato_representante: "Marcos (85) 98888-3333"
    });
    assert.equal(edited.response.status, 200);
    assert.equal(edited.payload.nome_fantasia, "Prime Colchões");
    assert.equal(edited.payload.contato_representante, "Marcos (85) 98888-3333");

    const inactive = await request(baseUrl, "PUT", `/api/fornecedores/${created.payload.id}`, token, { ativo: false });
    assert.equal(inactive.response.status, 200);
    assert.equal(inactive.payload.ativo, false);

    const suppliers = await request(baseUrl, "GET", "/api/fornecedores", token);
    assert.equal(suppliers.response.status, 200);
    assert.ok(suppliers.payload.some((supplier) => supplier.id === created.payload.id && supplier.ativo === false));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("produtos: fornecedor, dimensões, preço e kit baixam componentes na venda", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const supplier = await request(baseUrl, "POST", "/api/fornecedores", token, {
      nome_fantasia: "Fornecedor Kit",
      razao_social: "Fornecedor Kit LTDA",
      cnpj: "22.333.444/0001-55"
    });
    assert.equal(supplier.response.status, 200);

    const box = await request(baseUrl, "POST", "/api/products", token, {
      name: "Box Avulso",
      category: "base",
      fornecedor_id: supplier.payload.id,
      sku: "KIT-BOX",
      preco_tabela: 900,
      preco_minimo: 750,
      custo_direto: 400,
      largura_cm: 158,
      comprimento_cm: 198,
      altura_cm: 35,
      minStock: 1
    });
    const mattress = await request(baseUrl, "POST", "/api/products", token, {
      name: "Colchão Avulso",
      category: "colchão",
      fornecedor_id: supplier.payload.id,
      sku: "KIT-COL",
      preco_tabela: 1500,
      preco_minimo: 1300,
      custo_direto: 700,
      largura_cm: 158,
      comprimento_cm: 198,
      altura_cm: 28,
      minStock: 1
    });
    assert.equal(box.response.status, 200);
    assert.equal(mattress.response.status, 200);
    assert.equal(box.payload.fornecedor_nome, "Fornecedor Kit");
    assert.equal(box.payload.salePrice, 900);
    assert.equal(box.payload.costPrice, 400);

    const kit = await request(baseUrl, "POST", "/api/products", token, {
      name: "Kit Queen Completo",
      category: "kit",
      fornecedor_id: supplier.payload.id,
      sku: "KIT-QUEEN",
      preco_tabela: 2200,
      preco_minimo: 2000,
      custo_direto: 1100,
      tamanho_padrao: "Queen",
      largura_cm: 158,
      comprimento_cm: 198,
      produto_kit: true,
      componentes_kit: [
        { produto_id: box.payload.id, quantidade: 1 },
        { produto_id: mattress.payload.id, quantidade: 1 }
      ],
      minStock: 0
    });
    assert.equal(kit.response.status, 200);
    assert.equal(kit.payload.produto_kit, true);
    assert.equal(kit.payload.componentes_kit.length, 2);

    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: box.payload.id, quantity: 2 });
    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: mattress.payload.id, quantity: 2 });
    await openCash(baseUrl, token, "loja_1");

    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      nome: "Cliente Kit",
      telefone: "(85) 94444-0000",
      logradouro: "Rua Combo",
      numero: "10"
    });

    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      itens: [{ produto_id: kit.payload.id, quantidade: 1, preco_unitario: 2100 }],
      hasDelivery: false
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.items[0].productId, kit.payload.id);
    assert.equal(sale.payload.sale.total, 2100);

    const stock = await request(baseUrl, "GET", "/api/stock", token);
    assert.equal(stock.payload.find((row) => row.product.id === box.payload.id).saldo_deposito, 1);
    assert.equal(stock.payload.find((row) => row.product.id === mattress.payload.id).saldo_deposito, 1);
    assert.equal(stock.payload.find((row) => row.product.id === kit.payload.id).saldo_deposito, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("vendas: pedido com múltiplos itens usa preço praticado, desconto e baixa por item", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const mattress = await request(baseUrl, "POST", "/api/products", token, {
      name: "Colchão Casal Negociado",
      category: "colchão",
      brandModel: "Neg 138",
      sku: "MULTI-COL",
      salePrice: 2000,
      costPrice: 1000,
      minStock: 1
    });
    const pillow = await request(baseUrl, "POST", "/api/products", token, {
      name: "Travesseiro Premium",
      category: "acessório",
      brandModel: "Prem 01",
      sku: "MULTI-TRAV",
      salePrice: 300,
      costPrice: 120,
      minStock: 1
    });
    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      nome: "Cliente Multi",
      telefone: "(85) 95555-0000",
      logradouro: "Rua Pedido",
      numero: "77",
      bairro: "Aldeota"
    });
    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: mattress.payload.id, quantity: 2 });
    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: pillow.payload.id, quantity: 5 });
    await openCash(baseUrl, token, "loja_1", 100);

    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      pagamentos: [
        { metodo: "pix", valor: 1000 },
        { metodo: "cartao_credito", valor: 1200, parcelas: 3 }
      ],
      desconto_adicional: 100,
      itens: [
        { produto_id: mattress.payload.id, nome: "Colchão Casal Negociado", quantidade: 1, preco_unitario: 1800, subtotal: 1800 },
        { produto_id: pillow.payload.id, nome: "Travesseiro Premium", quantidade: 2, preco_unitario: 250, subtotal: 500 }
      ],
      hasDelivery: false
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.items.length, 2);
    assert.equal(sale.payload.sale.totalBruto, 2300);
    assert.equal(sale.payload.sale.desconto_adicional, 100);
    assert.equal(sale.payload.sale.total, 2200);
    assert.equal(sale.payload.sale.valor_total, 2200);
    assert.equal(sale.payload.sale.paymentMethod, "multiplo");
    assert.equal(sale.payload.sale.pagamentos.length, 2);

    const stock = await request(baseUrl, "GET", "/api/stock", token);
    assert.equal(stock.payload.find((row) => row.product.id === mattress.payload.id).saldo_deposito, 1);
    assert.equal(stock.payload.find((row) => row.product.id === pillow.payload.id).saldo_deposito, 3);

    const cash = await request(baseUrl, "GET", "/api/cash", token);
    assert.equal(cash.payload.consolidated, 2200);
    assert.equal(cash.payload.movements.filter((movement) => movement.category === "Venda").length, 2);

    const overview = await request(baseUrl, "GET", "/api/overview?period=month", token);
    assert.equal(overview.response.status, 200);
    assert.equal(overview.payload.salesCount, 1);
    assert.equal(overview.payload.averageTicket, 2200);
    assert.equal(overview.payload.grossProfit, 960);
    assert.equal(overview.payload.grossMarginPercent, 43.64);
    assert.equal(overview.payload.stockValue, 1360);
    assert.equal(overview.payload.lowStockCount, 1);
    assert.ok(overview.payload.paymentMethods.some((row) => row.id === "pix" && row.value === 1000));
    assert.ok(overview.payload.paymentMethods.some((row) => row.id === "cartao_credito" && row.value === 1200));

    const blocked = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      itens: [{ produto_id: pillow.payload.id, quantidade: 10, preco_unitario: 250 }],
      hasDelivery: false
    });
    assert.equal(blocked.response.status, 400);
    assert.match(blocked.payload.error, /Travesseiro Premium/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("showroom movimenta depósito central e venda não usa saldo em exposição", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Cama Showroom",
      category: "cama",
      brandModel: "Mostruário 01",
      sku: "SHOW-01",
      salePrice: 2500,
      costPrice: 1400,
      minStock: 1
    });
    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      name: "Cliente Showroom",
      phone: "(85) 98888-0000",
      address: "Rua Central, 50"
    });
    await request(baseUrl, "POST", "/api/stock/entry", token, {
      productId: product.payload.id,
      quantity: 2
    });
    await openCash(baseUrl, token, "loja_1");

    const sendToShowroom = await request(baseUrl, "POST", "/api/showroom/movements", token, {
      type: "envio_showroom",
      productId: product.payload.id,
      storeId: "loja_1",
      quantity: 2,
      reason: "Exposição"
    });
    assert.equal(sendToShowroom.response.status, 200);

    const blockedSale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(blockedSale.response.status, 400);
    assert.match(blockedSale.payload.error, /depósito central/);

    const stockAfterSend = await request(baseUrl, "GET", "/api/stock", token);
    const afterSend = stockAfterSend.payload.find((row) => row.product.id === product.payload.id);
    assert.equal(afterSend.saldo_deposito, 0);
    assert.equal(afterSend.showroom_loja1, 2);
    assert.equal(afterSend.total, 2);

    const returnToDeposit = await request(baseUrl, "POST", "/api/showroom/movements", token, {
      type: "retorno_showroom",
      productId: product.payload.id,
      storeId: "loja_1",
      quantity: 1,
      reason: "Retorno para venda"
    });
    assert.equal(returnToDeposit.response.status, 200);

    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.codigo_venda, 1001);

    const stockAfterSale = await request(baseUrl, "GET", "/api/stock", token);
    const afterSale = stockAfterSale.payload.find((row) => row.product.id === product.payload.id);
    assert.equal(afterSale.saldo_deposito, 0);
    assert.equal(afterSale.showroom_loja1, 1);
    assert.equal(afterSale.total, 1);

    const movements = await request(baseUrl, "GET", "/api/showroom/movements", token);
    assert.equal(movements.payload.length, 2);
    assert.deepEqual(new Set(movements.payload.map((movement) => movement.type)), new Set(["envio_showroom", "retorno_showroom"]));
    assert.ok(movements.payload.every((movement) => movement.userName === "Gestor"));

    const kardex = await request(baseUrl, "GET", `/api/stock/movements?productId=${product.payload.id}`, token);
    assert.equal(kardex.response.status, 200);
    assert.equal(kardex.payload.movements.length, 4);
    assert.deepEqual(new Set(kardex.payload.movements.map((movement) => movement.tipo)), new Set(["ENTRADA", "ENVIO_SHOWROOM", "RETORNO_SHOWROOM", "SAIDA_VENDA"]));
    assert.equal(kardex.payload.movements.find((movement) => movement.tipo === "ENVIO_SHOWROOM").saldo_apos_movimentacao, 0);
    assert.equal(kardex.payload.movements.find((movement) => movement.tipo === "RETORNO_SHOWROOM").saldo_apos_movimentacao, 1);
    assert.equal(kardex.payload.movements.find((movement) => movement.tipo === "SAIDA_VENDA").referencia, "Venda #1001");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("RN05: usuário vinculado à loja só acessa vendas, caixa e relatórios da própria unidade", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const gestorLogin = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const gestorToken = gestorLogin.payload.token;
    const product = await request(baseUrl, "POST", "/api/products", gestorToken, {
      name: "Produto Escopo Loja",
      category: "colchão",
      brandModel: "Escopo",
      sku: "SCOPE-001",
      salePrice: 1000,
      costPrice: 500,
      minStock: 1
    });
    const customer = await request(baseUrl, "POST", "/api/customers", gestorToken, {
      nome: "Cliente Escopo",
      telefone: "(85) 93333-0000"
    });
    await request(baseUrl, "POST", "/api/stock/entry", gestorToken, { productId: product.payload.id, quantity: 3 });
    await openCash(baseUrl, gestorToken, "loja_1");
    await openCash(baseUrl, gestorToken, "loja_2");
    const saleLoja1 = await request(baseUrl, "POST", "/api/sales", gestorToken, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    const saleLoja2 = await request(baseUrl, "POST", "/api/sales", gestorToken, {
      customerId: customer.payload.id,
      sellerId: "vend_2",
      storeId: "loja_2",
      paymentMethod: "dinheiro",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(saleLoja1.response.status, 200);
    assert.equal(saleLoja2.response.status, 200);

    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gerente1", password: "123456" });
    const token = login.payload.token;

    const bootstrap = await request(baseUrl, "GET", "/api/bootstrap", token);
    assert.equal(bootstrap.response.status, 200);
    assert.deepEqual(bootstrap.payload.lojas.map((loja) => loja.id), ["loja_1"]);
    assert.equal(bootstrap.payload.user.loja_id, "loja_1");

    const sales = await request(baseUrl, "GET", "/api/sales", token);
    assert.deepEqual(sales.payload.map((sale) => sale.storeId), ["loja_1"]);

    const cash = await request(baseUrl, "GET", "/api/cash", token);
    assert.equal(cash.response.status, 200);
    assert.deepEqual(cash.payload.balancesByStore.map((row) => row.storeId), ["loja_1"]);

    const reports = await request(baseUrl, "GET", "/api/reports", token);
    assert.equal(reports.response.status, 200);
    assert.deepEqual(reports.payload.sales.map((sale) => sale.storeId), ["loja_1"]);

    const blockedReport = await request(baseUrl, "GET", "/api/reports?storeId=loja_2", token);
    assert.equal(blockedReport.response.status, 403);

    const blockedCash = await request(baseUrl, "GET", "/api/cash?storeId=loja_2", token);
    assert.equal(blockedCash.response.status, 403);

    const blockedSale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_2",
      storeId: "loja_2",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(blockedSale.response.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("lojas dinâmicas: gestor cria filial e sistema usa a nova unidade em vendedores, showroom e vendas", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const createdStore = await request(baseUrl, "POST", "/api/lojas", token, {
      nome: "Loja 3 - Shopping",
      cnpj: "11.222.333/0001-44",
      telefone: "(85) 98888-7777",
      endereco: {
        logradouro: "Av. Shopping, 300",
        bairro: "Papicu",
        cidade: "Fortaleza"
      }
    });
    assert.equal(createdStore.response.status, 200);
    assert.equal(createdStore.payload.id, "loja-3");
    assert.equal(createdStore.payload.ativa, true);
    assert.equal(createdStore.payload.endereco.bairro, "Papicu");

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Produto Nova Filial",
      category: "colchão",
      brandModel: "Filial",
      sku: "LOJA3-001",
      salePrice: 1500,
      costPrice: 700,
      minStock: 1
    });
    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: product.payload.id, quantity: 3 });
    await openCash(baseUrl, token, createdStore.payload.id);

    const showroom = await request(baseUrl, "POST", "/api/showroom/movements", token, {
      type: "envio_showroom",
      productId: product.payload.id,
      storeId: createdStore.payload.id,
      quantity: 1,
      reason: "Mostruário nova filial"
    });
    assert.equal(showroom.response.status, 200);

    const seller = await request(baseUrl, "POST", "/api/vendedores", token, {
      nome: "Vendedor Shopping",
      loja_id: createdStore.payload.id,
      telefone: "(85) 97777-3333"
    });
    assert.equal(seller.response.status, 200);
    assert.equal(seller.payload.loja_id, createdStore.payload.id);
    assert.equal(seller.payload.loja_padrao, "Loja 3 - Shopping");

    const user = await request(baseUrl, "POST", "/api/users", token, {
      name: "Operador Shopping",
      username: "shopping",
      password: "1234",
      profile: "vendedor",
      loja_id: createdStore.payload.id
    });
    assert.equal(user.response.status, 200);
    assert.equal(user.payload.role, "vendedor");
    assert.equal(user.payload.loja_id, createdStore.payload.id);

    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      nome: "Cliente Shopping",
      telefone: "(85) 92222-1111"
    });

    const userLogin = await request(baseUrl, "POST", "/api/login", null, { username: "shopping", password: "1234" });
    const userToken = userLogin.payload.token;
    const scopedBootstrap = await request(baseUrl, "GET", "/api/bootstrap", userToken);
    assert.deepEqual(scopedBootstrap.payload.lojas.map((loja) => loja.id), [createdStore.payload.id]);

    const sale = await request(baseUrl, "POST", "/api/sales", userToken, {
      customerId: customer.payload.id,
      sellerId: seller.payload.id,
      storeId: createdStore.payload.id,
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.storeId, createdStore.payload.id);

    const blockedSale = await request(baseUrl, "POST", "/api/sales", userToken, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(blockedSale.response.status, 403);

    const stock = await request(baseUrl, "GET", "/api/stock", token);
    const productStock = stock.payload.find((row) => row.product.id === product.payload.id);
    assert.ok(productStock.showrooms.some((row) => row.loja_id === createdStore.payload.id && row.quantidade === 1));
    assert.equal(productStock.saldo_deposito, 1);

    const inactive = await request(baseUrl, "PUT", `/api/lojas/${createdStore.payload.id}`, token, { ativa: false });
    assert.equal(inactive.response.status, 200);
    assert.equal(inactive.payload.ativa, false);
    const refreshedBootstrap = await request(baseUrl, "GET", "/api/bootstrap", token);
    assert.ok(!refreshedBootstrap.payload.lojas.some((loja) => loja.id === createdStore.payload.id));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("frente de caixa: SKU automático, bloqueio sem caixa, pagamento fracionado, fechamento e estorno", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Colchão Queen Caixa",
      category: "colchão",
      brandModel: "Auto SKU",
      tamanho_padrao: "Queen",
      salePrice: 1000,
      costPrice: 500,
      minStock: 1
    });
    assert.equal(product.response.status, 200);
    assert.match(product.payload.sku, /^COL-QUE-\d+$/);

    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      nome: "Cliente Caixa",
      telefone: "(85) 91111-2222",
      logradouro: "Rua Caixa",
      numero: "44",
      bairro: "Centro",
      referencia: "Portaria"
    });
    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: product.payload.id, quantity: 2 });

    const blockedNoCash = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(blockedNoCash.response.status, 400);
    assert.match(blockedNoCash.payload.error, /Abra o caixa/);

    const open = await openCash(baseUrl, token, "loja_1", 100);
    assert.equal(open.response.status, 200);
    assert.equal(open.payload.status, "aberto");

    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      pagamentos: [
        { metodo: "dinheiro", valor: 600 },
        { metodo: "pix", valor: 400 }
      ],
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: true,
      deliveryPerson: "Motorista",
      deliveryDate: "2026-09-12",
      deliveryShift: "Manhã (08h às 12h)"
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.pagamentos.length, 2);
    assert.equal(sale.payload.deliveryOrder.turno_entrega, "Manhã (08h às 12h)");

    const stockAfterSale = await request(baseUrl, "GET", "/api/stock", token);
    assert.equal(stockAfterSale.payload.find((row) => row.product.id === product.payload.id).saldo_deposito, 1);

    const sangria = await request(baseUrl, "POST", "/api/cash/sangria", token, {
      storeId: "loja_1",
      value: 50,
      reason: "Transferência para cofre"
    });
    assert.equal(sangria.response.status, 200);

    const close = await request(baseUrl, "POST", "/api/cash/close", token, {
      storeId: "loja_1",
      valores_declarados: {
        dinheiro: 650,
        pix: 400,
        cartao_credito: 0,
        cartao_debito: 0,
        boleto: 0
      }
    });
    assert.equal(close.response.status, 200);
    assert.equal(close.payload.status, "fechado");
    assert.equal(close.payload.diferenca, 0);

    const cancel = await request(baseUrl, "POST", `/api/sales/${sale.payload.sale.id}/cancel`, token, {});
    assert.equal(cancel.response.status, 200);
    assert.equal(cancel.payload.sale.status, "CANCELADA");

    const stockAfterCancel = await request(baseUrl, "GET", "/api/stock", token);
    assert.equal(stockAfterCancel.payload.find((row) => row.product.id === product.payload.id).saldo_deposito, 2);

    const cash = await request(baseUrl, "GET", "/api/cash", token);
    assert.equal(cash.payload.movements.filter((movement) => movement.category === "Estorno").length, 2);

    const kardex = await request(baseUrl, "GET", `/api/stock/movements?productId=${product.payload.id}`, token);
    assert.ok(kardex.payload.movements.some((movement) => movement.tipo === "ESTORNO_VENDA"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("configurações: gestor controla empresa, numeração e usuários", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const login = await request(baseUrl, "POST", "/api/login", null, { username: "gestor", password: "123456" });
    const token = login.payload.token;

    const managerLogin = await request(baseUrl, "POST", "/api/login", null, { username: "gerente1", password: "123456" });
    const blockedUsers = await request(baseUrl, "GET", "/api/users", managerLogin.payload.token);
    assert.equal(blockedUsers.response.status, 403);

    const users = await request(baseUrl, "GET", "/api/users", token);
    assert.equal(users.response.status, 200);
    assert.ok(users.payload.some((user) => user.username === "gestor" && user.profile === "gestor"));

    const settings = await request(baseUrl, "PUT", "/api/configuracoes_empresa", token, {
      marca_principal: "Euroconfort",
      razao_social: "Euroconfort Móveis LTDA",
      cnpj: "12.345.678/0001-90",
      inscricao_estadual: "123456789",
      telefone_whatsapp: "(85) 99999-9999",
      lojas: {
        loja_1: { logradouro: "Av. Loja 1, 100", bairro: "Centro", cidade: "Fortaleza" },
        loja_2: { logradouro: "Av. Loja 2, 200", bairro: "Aldeota", cidade: "Fortaleza" }
      },
      proximo_numero_pedido: 2000,
      mensagem_rodape_garantia: "Garantia personalizada.",
      exibir_assinatura_cliente: false
    });
    assert.equal(settings.response.status, 200);
    assert.equal(settings.payload.marca_principal, "Euroconfort");
    assert.equal(settings.payload.proximo_numero_pedido, 2000);
    assert.equal(settings.payload.exibir_assinatura_cliente, false);

    const createdUser = await request(baseUrl, "POST", "/api/users", token, {
      name: "Operador Teste",
      username: "operador",
      password: "1234",
      profile: "gerente_loja_1"
    });
    assert.equal(createdUser.response.status, 200);
    assert.equal(createdUser.payload.role, "gerente_loja");
    assert.equal(createdUser.payload.storeId, "loja_1");

    const loginCreated = await request(baseUrl, "POST", "/api/login", null, { username: "operador", password: "1234" });
    assert.equal(loginCreated.response.status, 200);

    const reset = await request(baseUrl, "PUT", `/api/users/${createdUser.payload.id}/password`, token, { password: "5678" });
    assert.equal(reset.response.status, 200);
    const oldPassword = await request(baseUrl, "POST", "/api/login", null, { username: "operador", password: "1234" });
    assert.equal(oldPassword.response.status, 400);
    const newPassword = await request(baseUrl, "POST", "/api/login", null, { username: "operador", password: "5678" });
    assert.equal(newPassword.response.status, 200);

    const inactive = await request(baseUrl, "PUT", `/api/users/${createdUser.payload.id}`, token, { active: false });
    assert.equal(inactive.response.status, 200);
    assert.equal(inactive.payload.active, false);
    const blockedLogin = await request(baseUrl, "POST", "/api/login", null, { username: "operador", password: "5678" });
    assert.equal(blockedLogin.response.status, 400);

    const product = await request(baseUrl, "POST", "/api/products", token, {
      name: "Produto Config",
      category: "colchão",
      brandModel: "Config",
      sku: "CONF-001",
      salePrice: 1000,
      costPrice: 400,
      minStock: 1
    });
    const customer = await request(baseUrl, "POST", "/api/customers", token, {
      nome: "Cliente Config",
      telefone: "(85) 90000-1111"
    });
    await request(baseUrl, "POST", "/api/stock/entry", token, { productId: product.payload.id, quantity: 1 });
    await openCash(baseUrl, token, "loja_1");
    const sale = await request(baseUrl, "POST", "/api/sales", token, {
      customerId: customer.payload.id,
      sellerId: "vend_1",
      storeId: "loja_1",
      paymentMethod: "pix",
      items: [{ productId: product.payload.id, quantity: 1 }],
      hasDelivery: false
    });
    assert.equal(sale.response.status, 200);
    assert.equal(sale.payload.sale.codigo_venda, 2000);
    const updatedSettings = await request(baseUrl, "GET", "/api/configuracoes_empresa", token);
    assert.equal(updatedSettings.payload.proximo_numero_pedido, 2001);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("usuários e permissões: papéis novos controlam acesso da equipe", async () => {
  const { server, baseUrl, dbPath } = await startServer();
  try {
    const adminLogin = await request(baseUrl, "POST", "/api/login", null, { login: "gestor", password: "123456" });
    assert.equal(adminLogin.response.status, 200);
    assert.equal(adminLogin.payload.user.papel, "ADMINISTRADOR");
    const token = adminLogin.payload.token;

    const financeiro = await request(baseUrl, "POST", "/api/users", token, {
      nome: "Gestora Financeira",
      login: "financeiro",
      senha: "1234",
      papel: "GESTOR_FINANCEIRO",
      loja_id: "TODAS"
    });
    assert.equal(financeiro.response.status, 200);
    assert.equal(financeiro.payload.papel, "GESTOR_FINANCEIRO");
    assert.equal(financeiro.payload.loja_id, "TODAS");

    const operador = await request(baseUrl, "POST", "/api/users", token, {
      nome: "Operadora Caixa Loja 2",
      login: "caixa2",
      senha: "1234",
      papel: "OPERADOR_CAIXA",
      loja_id: "loja_2"
    });
    assert.equal(operador.response.status, 200);
    assert.equal(operador.payload.papel, "OPERADOR_CAIXA");
    assert.equal(operador.payload.storeId, "loja_2");

    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    assert.ok(db.usuarios.some((user) => user.login === "financeiro" && user.senha_hash && user.papel === "GESTOR_FINANCEIRO"));
    assert.ok(db.usuarios.some((user) => user.login === "caixa2" && user.loja_id === "loja_2"));

    const financeLogin = await request(baseUrl, "POST", "/api/login", null, { login: "financeiro", password: "1234" });
    assert.equal(financeLogin.response.status, 200);
    assert.equal(financeLogin.payload.user.papel, "GESTOR_FINANCEIRO");
    const financeToken = financeLogin.payload.token;
    const financeBootstrap = await request(baseUrl, "GET", "/api/bootstrap", financeToken);
    assert.equal(financeBootstrap.payload.stores.length, 2);
    const blockedUsers = await request(baseUrl, "GET", "/api/users", financeToken);
    assert.equal(blockedUsers.response.status, 403);
    const blockedCompany = await request(baseUrl, "PUT", "/api/configuracoes_empresa", financeToken, { marca_principal: "Bloqueado" });
    assert.equal(blockedCompany.response.status, 403);
    const financeCash = await request(baseUrl, "GET", "/api/cash", financeToken);
    assert.equal(financeCash.response.status, 200);
    const financeReports = await request(baseUrl, "GET", "/api/reports", financeToken);
    assert.equal(financeReports.response.status, 200);

    const operatorLogin = await request(baseUrl, "POST", "/api/login", null, { login: "caixa2", password: "1234" });
    assert.equal(operatorLogin.response.status, 200);
    const operatorToken = operatorLogin.payload.token;
    const operatorBootstrap = await request(baseUrl, "GET", "/api/bootstrap", operatorToken);
    assert.equal(operatorBootstrap.payload.stores.length, 1);
    assert.equal(operatorBootstrap.payload.stores[0].id, "loja_2");
    const operatorCash = await request(baseUrl, "GET", "/api/cash", operatorToken);
    assert.equal(operatorCash.response.status, 200);
    const blockedReports = await request(baseUrl, "GET", "/api/reports", operatorToken);
    assert.equal(blockedReports.response.status, 403);
    const blockedDeliveries = await request(baseUrl, "GET", "/api/deliveries", operatorToken);
    assert.equal(blockedDeliveries.response.status, 403);

    const inactive = await request(baseUrl, "PUT", `/api/users/${operador.payload.id}`, token, { ativo: false });
    assert.equal(inactive.response.status, 200);
    assert.equal(inactive.payload.ativo, false);
    const blockedLogin = await request(baseUrl, "POST", "/api/login", null, { login: "caixa2", password: "1234" });
    assert.equal(blockedLogin.response.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("convites: administrador envia convite e membro ativa conta por token", async () => {
  const { server, baseUrl, dbPath } = await startServer();
  try {
    const adminLogin = await request(baseUrl, "POST", "/api/login", null, { login: "gestor", password: "123456" });
    const token = adminLogin.payload.token;

    const invite = await request(baseUrl, "POST", "/api/convites", token, {
      nome: "Nova Operadora",
      email: "nova.operadora@example.com",
      papel: "OPERADOR_CAIXA",
      loja_id: "loja_1"
    });
    assert.equal(invite.response.status, 200);
    assert.equal(invite.payload.convite.status, "PENDENTE");
    assert.equal(invite.payload.convite.papel, "OPERADOR_CAIXA");
    assert.match(invite.payload.convite.activationLink, /\/ativar-conta\?token=/);

    const dbAfterInvite = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    const storedInvite = dbAfterInvite.convites.find((item) => item.email === "nova.operadora@example.com");
    assert.ok(storedInvite.token);
    assert.equal(storedInvite.status, "PENDENTE");

    const validate = await request(baseUrl, "GET", `/api/convites/validar?token=${storedInvite.token}`);
    assert.equal(validate.response.status, 200);
    assert.equal(validate.payload.nome, "Nova Operadora");
    assert.equal(validate.payload.email, "nova.operadora@example.com");

    const activation = await request(baseUrl, "POST", "/api/ativar-conta", null, {
      token: storedInvite.token,
      senha: "minhaSenha",
      confirmar_senha: "minhaSenha"
    });
    assert.equal(activation.response.status, 200);
    assert.equal(activation.payload.login, "nova.operadora@example.com");

    const memberLogin = await request(baseUrl, "POST", "/api/login", null, {
      login: "nova.operadora@example.com",
      password: "minhaSenha"
    });
    assert.equal(memberLogin.response.status, 200);
    assert.equal(memberLogin.payload.user.papel, "OPERADOR_CAIXA");
    assert.equal(memberLogin.payload.user.loja_id, "loja_1");

    const usedToken = await request(baseUrl, "GET", `/api/convites/validar?token=${storedInvite.token}`);
    assert.equal(usedToken.response.status, 400);
    assert.match(usedToken.payload.error, /expirou ou já foi utilizado/);

    const secondInvite = await request(baseUrl, "POST", "/api/convites", token, {
      nome: "Gerente Temporária",
      email: "gerente.temp@example.com",
      papel: "GERENTE_LOJA",
      loja_id: "loja_2"
    });
    assert.equal(secondInvite.response.status, 200);
    const revoke = await request(baseUrl, "POST", `/api/convites/${secondInvite.payload.convite.id}/revoke`, token);
    assert.equal(revoke.response.status, 200);
    assert.equal(revoke.payload.status, "REVOGADO");
    const revokedToken = await request(baseUrl, "GET", `/api/convites/validar?token=${secondInvite.payload.convite.token}`);
    assert.equal(revokedToken.response.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
