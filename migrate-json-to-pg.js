const fs = require("node:fs/promises");
const path = require("node:path");
const { getPool, closePool, loadEnvFile } = require("./src/db");

loadEnvFile();

const ROOT = __dirname;
const JSON_DB_PATH = process.env.ERP_DB_PATH || path.join(ROOT, "data", "erp-db.json");
const SCHEMA_PATH = path.join(ROOT, "database", "schema.sql");

function arrayFrom(db, primary, fallback) {
  if (Array.isArray(db[primary]) && db[primary].length) return db[primary];
  if (fallback && Array.isArray(db[fallback])) return db[fallback];
  return [];
}

function uniqueById(items) {
  const map = new Map();
  for (const item of items) {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function text(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const normalized = text(value);
  return normalized || null;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function timestamp(value) {
  const normalized = text(value);
  if (!normalized) return new Date().toISOString();
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function timestampOrNull(value) {
  const normalized = text(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function json(value, fallback) {
  if (value && typeof value === "object") return JSON.stringify(value);
  return JSON.stringify(fallback);
}

function normalizePapel(value) {
  const raw = text(value).toUpperCase().replace(/[\s-]+/g, "_");
  const byLegacy = {
    GESTOR: "ADMINISTRADOR",
    ADMIN: "ADMINISTRADOR",
    ADMINISTRADOR: "ADMINISTRADOR",
    GESTOR_FINANCEIRO: "GESTOR_FINANCEIRO",
    GERENTE_FINANCEIRO: "GESTOR_FINANCEIRO",
    GERENTE_LOJA: "GERENTE_LOJA",
    GERENTE_LOJA_1: "GERENTE_LOJA",
    GERENTE_LOJA_2: "GERENTE_LOJA",
    VENDEDOR: "OPERADOR_CAIXA",
    OPERADOR_CAIXA: "OPERADOR_CAIXA",
    CAIXA: "OPERADOR_CAIXA",
    ESTOQUE: "ESTOQUE",
    PENDENTE: "PENDENTE"
  };
  return byLegacy[raw] || "ADMINISTRADOR";
}

function lojaIdForUsuario(user) {
  const papel = normalizePapel(user.papel || user.role || user.profile);
  if (["ADMINISTRADOR", "GESTOR_FINANCEIRO", "ESTOQUE"].includes(papel)) return "TODAS";
  return text(user.loja_id || user.storeId) || "loja_1";
}

function normalizeLoja(store) {
  const endereco = store.endereco && typeof store.endereco === "object"
    ? store.endereco
    : {
        logradouro: text(store.address || store.logradouro),
        bairro: text(store.bairro),
        cidade: text(store.cidade)
      };
  const ativa = store.ativa === undefined ? store.active !== false && store.status !== "inativo" : store.ativa !== false;
  return {
    id: text(store.id),
    nome: text(store.nome || store.name),
    cnpj: nullableText(store.cnpj),
    telefone: nullableText(store.telefone || store.phone),
    endereco,
    ativa,
    criado_em: timestamp(store.criado_em || store.createdAt)
  };
}

function normalizeUsuario(user, knownLojaIds) {
  const papel = normalizePapel(user.papel || user.role || user.profile);
  const rawStatus = text(user.status).toUpperCase();
  const status = ["PENDENTE_APROVACAO", "ATIVO", "INATIVO", "REJEITADO"].includes(rawStatus)
    ? rawStatus
    : user.ativo === false || user.active === false ? "INATIVO" : "ATIVO";
  let lojaId = lojaIdForUsuario({ ...user, papel });
  if (!knownLojaIds.has(lojaId)) lojaId = "TODAS";
  return {
    id: text(user.id),
    nome: text(user.nome || user.name),
    login: text(user.login || user.username).toLowerCase(),
    senha_hash: text(user.senha_hash || user.passwordHash),
    papel,
    loja_id: lojaId,
    ativo: status === "ATIVO",
    status,
    solicitado_em: timestampOrNull(user.solicitado_em || user.requestedAt),
    aprovado_por: nullableText(user.aprovado_por || user.approvedBy),
    criado_em: timestamp(user.criado_em || user.createdAt)
  };
}

function normalizeProduto(product) {
  const showroom = product.showrooms && typeof product.showrooms === "object"
    ? product.showrooms
    : {
        loja_1: integer(product.showroom_loja1, 0),
        loja_2: integer(product.showroom_loja2, 0)
      };
  return {
    id: text(product.id),
    sku: nullableText(product.sku),
    nome: text(product.nome || product.name),
    categoria: nullableText(product.categoria || product.category),
    tamanho: nullableText(product.tamanho || product.tamanho_padrao || product.standardSize),
    preco_venda: number(product.preco_venda ?? product.preco_tabela ?? product.salePrice, 0),
    preco_minimo: number(product.preco_minimo, 0),
    preco_custo: number(product.preco_custo ?? product.custo_unitario ?? product.custo_direto ?? product.costPrice, 0),
    custo_unitario: number(product.custo_unitario ?? product.preco_custo ?? product.custo_direto ?? product.costPrice, 0),
    estoque_minimo: integer(product.estoque_minimo ?? product.minStock, 0),
    saldo_deposito: integer(product.saldo_deposito, 0),
    showroom,
    criado_em: timestamp(product.criado_em || product.createdAt)
  };
}

function normalizeFornecedor(supplier) {
  return {
    id: text(supplier.id),
    razao_social: text(supplier.razao_social || supplier.razaoSocial),
    nome_fantasia: text(supplier.nome_fantasia || supplier.nomeFantasia),
    cnpj: text(supplier.cnpj),
    contato_nome: nullableText(supplier.contato_nome || supplier.contato_representante),
    telefone: nullableText(supplier.telefone || supplier.phone),
    email: nullableText(supplier.email),
    condicoes_pagamento_padrao: nullableText(supplier.condicoes_pagamento_padrao),
    ativo: supplier.ativo === undefined ? supplier.active !== false : supplier.ativo !== false,
    criado_em: timestamp(supplier.criado_em || supplier.createdAt)
  };
}

function normalizeOrdemCompra(order, knownSupplierIds, knownUserIds) {
  const supplierId = text(order.fornecedor_id);
  const userId = text(order.criado_por);
  return {
    id: text(order.id),
    fornecedor_id: knownSupplierIds.has(supplierId) ? supplierId : null,
    data_emissao: text(order.data_emissao),
    previsao_entrega: text(order.previsao_entrega),
    status: text(order.status),
    valor_produtos: number(order.valor_produtos),
    valor_frete: number(order.valor_frete),
    valor_total: number(order.valor_total),
    condicao_pagamento: text(order.condicao_pagamento),
    observacoes: nullableText(order.observacoes),
    recebido_em: timestampOrNull(order.recebido_em),
    criado_por: knownUserIds.has(userId) ? userId : null,
    criado_em: timestamp(order.criado_em),
    atualizado_em: timestamp(order.atualizado_em || order.criado_em),
    financeiro_gerado_em: timestampOrNull(order.financeiro_gerado_em)
  };
}

function normalizeItemOrdemCompra(item, knownOrderIds, knownProductIds) {
  const orderId = text(item.ordem_id);
  const productId = text(item.produto_id);
  return {
    id: text(item.id),
    ordem_id: knownOrderIds.has(orderId) ? orderId : null,
    produto_id: knownProductIds.has(productId) ? productId : null,
    quantidade_pedida: integer(item.quantidade_pedida),
    quantidade_recebida: integer(item.quantidade_recebida),
    custo_unitario: number(item.custo_unitario),
    subtotal: number(item.subtotal)
  };
}

function normalizeContaPagar(bill, knownOrderIds, knownSupplierIds) {
  const orderId = text(bill.ordem_id);
  const supplierId = text(bill.fornecedor_id);
  return {
    id: text(bill.id),
    ordem_id: knownOrderIds.has(orderId) ? orderId : null,
    fornecedor_id: knownSupplierIds.has(supplierId) ? supplierId : null,
    numero_parcela: integer(bill.numero_parcela, 1),
    total_parcelas: integer(bill.total_parcelas, 1),
    valor: number(bill.valor),
    data_vencimento: text(bill.data_vencimento),
    status: text(bill.status || "pendente"),
    referencia: nullableText(bill.referencia),
    pago_em: text(bill.pago_em) || null,
    criado_em: timestamp(bill.criado_em)
  };
}

function normalizeCliente(customer) {
  const endereco = {
    cep: text(customer.cep),
    logradouro: text(customer.logradouro || customer.address),
    numero: text(customer.numero),
    complemento: text(customer.complemento),
    bairro: text(customer.bairro),
    cidade: text(customer.cidade),
    referencia: text(customer.referencia)
  };
  return {
    id: text(customer.id),
    nome: text(customer.nome || customer.name),
    cpf: nullableText(customer.cpf || customer.cpf_cnpj),
    telefone: nullableText(customer.telefone || customer.phone),
    email: nullableText(customer.email),
    endereco,
    criado_em: timestamp(customer.criado_em || customer.createdAt)
  };
}

function normalizeVenda(sale, knownLojaIds, knownClienteIds) {
  const lojaId = text(sale.loja_id || sale.storeId);
  const clienteId = text(sale.cliente_id || sale.customerId);
  return {
    id: text(sale.id),
    codigo_venda: integer(sale.codigo_venda, null),
    loja_id: knownLojaIds.has(lojaId) ? lojaId : "TODAS",
    vendedor_id: nullableText(sale.vendedor_id || sale.vendedorId || sale.sellerId),
    cliente_id: knownClienteIds.has(clienteId) ? clienteId : null,
    total: number(sale.total ?? sale.valor_total, 0),
    desconto: number(sale.desconto ?? sale.desconto_adicional ?? sale.discount, 0),
    pagamentos: Array.isArray(sale.pagamentos) ? sale.pagamentos : Array.isArray(sale.payments) ? sale.payments : [],
    status: text(sale.status || "CONCLUIDA"),
    criado_em: timestamp(sale.criado_em || sale.createdAt || sale.date)
  };
}

function vendaItems(sale, knownProdutoIds) {
  const items = Array.isArray(sale.itens) && sale.itens.length ? sale.itens : Array.isArray(sale.items) ? sale.items : [];
  return items.map((item) => {
    const produtoId = text(item.produto_id || item.productId);
    const quantidade = integer(item.quantidade ?? item.quantity, 0);
    const precoUnitario = number(item.preco_unitario ?? item.unitPrice, 0);
    return {
      venda_id: text(sale.id),
      produto_id: knownProdutoIds.has(produtoId) ? produtoId : null,
      quantidade,
      preco_unitario: precoUnitario,
      subtotal: number(item.subtotal ?? item.total, precoUnitario * quantidade)
    };
  }).filter((item) => item.venda_id && item.quantidade > 0);
}

function normalizeMovimentacao(movement, knownProdutoIds) {
  const produtoId = text(movement.produto_id || movement.productId);
  return {
    id: text(movement.id) || null,
    produto_id: knownProdutoIds.has(produtoId) ? produtoId : null,
    tipo: text(movement.tipo || movement.type).toUpperCase(),
    quantidade: integer(movement.quantidade ?? movement.quantity, 0),
    saldo_apos: integer(movement.saldo_apos ?? movement.saldo_apos_movimentacao, null),
    referencia: nullableText(movement.referencia || movement.reason || movement.saleId),
    criado_em: timestamp(movement.criado_em || movement.data_hora || movement.createdAt)
  };
}

function normalizeSessaoCaixa(session, knownLojaIds, knownUserIds) {
  const lojaId = text(session.loja_id || session.storeId);
  const operadorId = text(session.operador_id || session.operatorId);
  return {
    id: text(session.id),
    loja_id: knownLojaIds.has(lojaId) ? lojaId : "TODAS",
    operador_id: knownUserIds.has(operadorId) ? operadorId : null,
    data_abertura: timestamp(session.data_abertura || session.openedAt || session.createdAt),
    saldo_inicial_troco: number(session.saldo_inicial_troco ?? session.openingCash, 0),
    data_fechamento: timestampOrNull(session.data_fechamento || session.closedAt),
    status: text(session.status || "aberto"),
    valores_declarados: session.valores_declarados || session.declaredValues || {},
    valores_sistema: session.valores_sistema || session.systemValues || {},
    diferenca: number(session.diferenca, 0)
  };
}

async function upsertLojas(client, lojas) {
  const sql = `
    INSERT INTO lojas (id, nome, cnpj, telefone, endereco, ativa, criado_em)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      cnpj = EXCLUDED.cnpj,
      telefone = EXCLUDED.telefone,
      endereco = EXCLUDED.endereco,
      ativa = EXCLUDED.ativa,
      criado_em = EXCLUDED.criado_em
  `;
  for (const loja of lojas) {
    await client.query(sql, [loja.id, loja.nome, loja.cnpj, loja.telefone, json(loja.endereco, {}), loja.ativa, loja.criado_em]);
  }
}

async function upsertUsuarios(client, usuarios) {
  const sql = `
    INSERT INTO usuarios (id, nome, login, senha_hash, papel, loja_id, ativo, status, solicitado_em, aprovado_por, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10)
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      login = EXCLUDED.login,
      senha_hash = EXCLUDED.senha_hash,
      papel = EXCLUDED.papel,
      loja_id = EXCLUDED.loja_id,
      ativo = EXCLUDED.ativo,
      status = EXCLUDED.status,
      solicitado_em = EXCLUDED.solicitado_em,
      criado_em = EXCLUDED.criado_em
  `;
  for (const usuario of usuarios) {
    await client.query(sql, [usuario.id, usuario.nome, usuario.login, usuario.senha_hash, usuario.papel, usuario.loja_id, usuario.ativo, usuario.status, usuario.solicitado_em, usuario.criado_em]);
  }
  const knownIds = new Set(usuarios.map((usuario) => usuario.id));
  for (const usuario of usuarios) {
    await client.query("UPDATE usuarios SET aprovado_por = $1 WHERE id = $2", [knownIds.has(usuario.aprovado_por) ? usuario.aprovado_por : null, usuario.id]);
  }
}

async function upsertProdutos(client, produtos) {
  const sql = `
    INSERT INTO produtos (id, sku, nome, categoria, tamanho, preco_venda, preco_minimo, preco_custo, custo_unitario, estoque_minimo, saldo_deposito, showroom, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
    ON CONFLICT (id) DO UPDATE SET
      sku = EXCLUDED.sku,
      nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      tamanho = EXCLUDED.tamanho,
      preco_venda = EXCLUDED.preco_venda,
      preco_minimo = EXCLUDED.preco_minimo,
      preco_custo = EXCLUDED.preco_custo,
      custo_unitario = EXCLUDED.custo_unitario,
      estoque_minimo = EXCLUDED.estoque_minimo,
      saldo_deposito = EXCLUDED.saldo_deposito,
      showroom = EXCLUDED.showroom,
      criado_em = EXCLUDED.criado_em
  `;
  for (const produto of produtos) {
    await client.query(sql, [
      produto.id,
      produto.sku,
      produto.nome,
      produto.categoria,
      produto.tamanho,
      produto.preco_venda,
      produto.preco_minimo,
      produto.preco_custo,
      produto.custo_unitario,
      produto.estoque_minimo,
      produto.saldo_deposito,
      json(produto.showroom, {}),
      produto.criado_em
    ]);
  }
}

async function upsertClientes(client, clientes) {
  const sql = `
    INSERT INTO clientes (id, nome, cpf, telefone, email, endereco, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      cpf = EXCLUDED.cpf,
      telefone = EXCLUDED.telefone,
      email = EXCLUDED.email,
      endereco = EXCLUDED.endereco,
      criado_em = EXCLUDED.criado_em
  `;
  for (const cliente of clientes) {
    await client.query(sql, [cliente.id, cliente.nome, cliente.cpf, cliente.telefone, cliente.email, json(cliente.endereco, {}), cliente.criado_em]);
  }
}

async function upsertVendas(client, vendas, sales, knownProdutoIds) {
  const sql = `
    INSERT INTO vendas (id, codigo_venda, loja_id, vendedor_id, cliente_id, total, desconto, pagamentos, status, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      codigo_venda = EXCLUDED.codigo_venda,
      loja_id = EXCLUDED.loja_id,
      vendedor_id = EXCLUDED.vendedor_id,
      cliente_id = EXCLUDED.cliente_id,
      total = EXCLUDED.total,
      desconto = EXCLUDED.desconto,
      pagamentos = EXCLUDED.pagamentos,
      status = EXCLUDED.status,
      criado_em = EXCLUDED.criado_em
  `;
  const itemSql = `
    INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES ($1, $2, $3, $4, $5)
  `;
  for (let index = 0; index < vendas.length; index += 1) {
    const venda = vendas[index];
    await client.query(sql, [
      venda.id,
      venda.codigo_venda,
      venda.loja_id,
      venda.vendedor_id,
      venda.cliente_id,
      venda.total,
      venda.desconto,
      json(venda.pagamentos, []),
      venda.status,
      venda.criado_em
    ]);
    await client.query("DELETE FROM itens_venda WHERE venda_id = $1", [venda.id]);
    for (const item of vendaItems(sales[index], knownProdutoIds)) {
      await client.query(itemSql, [item.venda_id, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal]);
    }
  }
}

async function insertMovimentacoes(client, movimentacoes) {
  const sql = `
    INSERT INTO movimentacoes_estoque (external_id, produto_id, tipo, quantidade, saldo_apos, referencia, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (external_id) DO NOTHING
  `;
  for (const movement of movimentacoes) {
    const externalId = movement.id || `legacy:${movement.produto_id}:${movement.tipo}:${movement.quantidade}:${movement.criado_em}:${movement.referencia || ""}`;
    await client.query(sql, [externalId, movement.produto_id, movement.tipo, movement.quantidade, movement.saldo_apos, movement.referencia, movement.criado_em]);
  }
}

async function upsertSessoesCaixa(client, sessoes) {
  const sql = `
    INSERT INTO sessoes_caixa (id, loja_id, operador_id, data_abertura, saldo_inicial_troco, data_fechamento, status, valores_declarados, valores_sistema, diferenca)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
    ON CONFLICT (id) DO UPDATE SET
      loja_id = EXCLUDED.loja_id,
      operador_id = EXCLUDED.operador_id,
      data_abertura = EXCLUDED.data_abertura,
      saldo_inicial_troco = EXCLUDED.saldo_inicial_troco,
      data_fechamento = EXCLUDED.data_fechamento,
      status = EXCLUDED.status,
      valores_declarados = EXCLUDED.valores_declarados,
      valores_sistema = EXCLUDED.valores_sistema,
      diferenca = EXCLUDED.diferenca
  `;
  for (const session of sessoes) {
    await client.query(sql, [
      session.id,
      session.loja_id,
      session.operador_id,
      session.data_abertura,
      session.saldo_inicial_troco,
      session.data_fechamento,
      session.status,
      json(session.valores_declarados, {}),
      json(session.valores_sistema, {}),
      session.diferenca
    ]);
  }
}

async function upsertFornecedores(client, fornecedores) {
  const sql = `
    INSERT INTO fornecedores (id, razao_social, nome_fantasia, cnpj, contato_nome, telefone, email, condicoes_pagamento_padrao, ativo, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia,
      cnpj = EXCLUDED.cnpj,
      contato_nome = EXCLUDED.contato_nome,
      telefone = EXCLUDED.telefone,
      email = EXCLUDED.email,
      condicoes_pagamento_padrao = EXCLUDED.condicoes_pagamento_padrao,
      ativo = EXCLUDED.ativo
  `;
  for (const supplier of fornecedores) {
    await client.query(sql, [supplier.id, supplier.razao_social, supplier.nome_fantasia, supplier.cnpj, supplier.contato_nome, supplier.telefone, supplier.email, supplier.condicoes_pagamento_padrao, supplier.ativo, supplier.criado_em]);
  }
}

async function upsertOrdensCompra(client, orders, items) {
  const orderSql = `
    INSERT INTO ordens_compra (id, fornecedor_id, data_emissao, previsao_entrega, status, valor_produtos, valor_frete, valor_total, condicao_pagamento, observacoes, recebido_em, criado_por, criado_em, atualizado_em, financeiro_gerado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET
      fornecedor_id = EXCLUDED.fornecedor_id,
      data_emissao = EXCLUDED.data_emissao,
      previsao_entrega = EXCLUDED.previsao_entrega,
      status = EXCLUDED.status,
      valor_produtos = EXCLUDED.valor_produtos,
      valor_frete = EXCLUDED.valor_frete,
      valor_total = EXCLUDED.valor_total,
      condicao_pagamento = EXCLUDED.condicao_pagamento,
      observacoes = EXCLUDED.observacoes,
      recebido_em = EXCLUDED.recebido_em,
      atualizado_em = EXCLUDED.atualizado_em,
      financeiro_gerado_em = EXCLUDED.financeiro_gerado_em
  `;
  const itemSql = `
    INSERT INTO itens_ordem_compra (id, ordem_id, produto_id, quantidade_pedida, quantidade_recebida, custo_unitario, subtotal)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      quantidade_pedida = EXCLUDED.quantidade_pedida,
      quantidade_recebida = EXCLUDED.quantidade_recebida,
      custo_unitario = EXCLUDED.custo_unitario,
      subtotal = EXCLUDED.subtotal
  `;
  for (const order of orders) {
    await client.query(orderSql, [order.id, order.fornecedor_id, order.data_emissao, order.previsao_entrega, order.status, order.valor_produtos, order.valor_frete, order.valor_total, order.condicao_pagamento, order.observacoes, order.recebido_em, order.criado_por, order.criado_em, order.atualizado_em, order.financeiro_gerado_em]);
    await client.query("DELETE FROM itens_ordem_compra WHERE ordem_id = $1", [order.id]);
    for (const item of items.filter((row) => row.ordem_id === order.id)) {
      await client.query(itemSql, [item.id, item.ordem_id, item.produto_id, item.quantidade_pedida, item.quantidade_recebida, item.custo_unitario, item.subtotal]);
    }
  }
}

async function upsertContasPagar(client, bills) {
  const sql = `
    INSERT INTO contas_a_pagar (id, ordem_id, fornecedor_id, numero_parcela, total_parcelas, valor, data_vencimento, status, referencia, pago_em, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      valor = EXCLUDED.valor,
      data_vencimento = EXCLUDED.data_vencimento,
      status = EXCLUDED.status,
      referencia = EXCLUDED.referencia,
      pago_em = EXCLUDED.pago_em
  `;
  for (const bill of bills) {
    await client.query(sql, [bill.id, bill.ordem_id, bill.fornecedor_id, bill.numero_parcela, bill.total_parcelas, bill.valor, bill.data_vencimento, bill.status, bill.referencia, bill.pago_em, bill.criado_em]);
  }
}

function prepareRows(db) {
  const lojas = uniqueById(arrayFrom(db, "lojas", "stores").map(normalizeLoja).filter((loja) => loja.id && loja.nome));
  const knownLojaIds = new Set(["TODAS", ...lojas.map((loja) => loja.id)]);
  const usuarios = uniqueById(arrayFrom(db, "usuarios", "users").map((user) => normalizeUsuario(user, knownLojaIds)).filter((user) => user.id && user.nome && user.login && user.senha_hash));
  const knownUserIds = new Set(usuarios.map((user) => user.id));
  const produtos = uniqueById(arrayFrom(db, "products").map(normalizeProduto).filter((product) => product.id && product.nome));
  const knownProdutoIds = new Set(produtos.map((product) => product.id));
  const fornecedores = uniqueById(arrayFrom(db, "fornecedores").map(normalizeFornecedor).filter((supplier) => supplier.id && supplier.razao_social && supplier.nome_fantasia && supplier.cnpj));
  const knownSupplierIds = new Set(fornecedores.map((supplier) => supplier.id));
  const ordensCompra = uniqueById(arrayFrom(db, "ordens_compra").map((order) => normalizeOrdemCompra(order, knownSupplierIds, knownUserIds)).filter((order) => order.id && order.fornecedor_id && order.data_emissao && order.previsao_entrega));
  const knownOrderIds = new Set(ordensCompra.map((order) => order.id));
  const itensOrdemCompra = uniqueById(arrayFrom(db, "itens_ordem_compra").map((item) => normalizeItemOrdemCompra(item, knownOrderIds, knownProdutoIds)).filter((item) => item.id && item.ordem_id && item.produto_id && item.quantidade_pedida > 0));
  const contasPagar = uniqueById(arrayFrom(db, "contas_a_pagar").map((bill) => normalizeContaPagar(bill, knownOrderIds, knownSupplierIds)).filter((bill) => bill.id && bill.data_vencimento));
  const clientes = uniqueById(arrayFrom(db, "customers").map(normalizeCliente).filter((customer) => customer.id && customer.nome));
  const knownClienteIds = new Set(clientes.map((customer) => customer.id));
  const sales = uniqueById(arrayFrom(db, "sales"));
  const vendas = sales.map((sale) => normalizeVenda(sale, knownLojaIds, knownClienteIds)).filter((sale) => sale.id && sale.status);
  const movementSource = arrayFrom(db, "movimentacoes_estoque", "stockMovements");
  const movimentacoes = movementSource.map((movement) => normalizeMovimentacao(movement, knownProdutoIds)).filter((movement) => movement.tipo && movement.quantidade !== 0);
  const sessoes = uniqueById(arrayFrom(db, "sessoes_caixa").map((session) => normalizeSessaoCaixa(session, knownLojaIds, knownUserIds)).filter((session) => session.id && session.status));
  const vendedores = uniqueById(arrayFrom(db, "vendedores", "sellers")).map((row) => ({ id: text(row.id), nome: text(row.nome || row.name), loja_id: text(row.loja_id || row.storeId) || "loja_1", comissao_padrao: number(row.comissao_padrao, 0), ativo: row.ativo !== false && row.active !== false, criado_em: timestamp(row.criado_em || row.createdAt) })).filter((row) => row.id && row.nome && knownLojaIds.has(row.loja_id));
  const entregas = uniqueById(arrayFrom(db, "deliveryOrders")).map((row) => ({ id: text(row.id), venda_id: text(row.saleId), cliente_id: nullableText(row.customerId), endereco_entrega: row.customerAddress || { endereco: text(row.address) }, turno: nullableText(row.turno_entrega || row.deliveryShift), status: text(row.status || "pendente"), motorista: nullableText(row.deliveryPerson), data_agendada: nullableText(row.scheduledDate), assinado_por: nullableText(row.assinado_por), comprovante_url: nullableText(row.comprovante_url), criado_em: timestamp(row.createdAt) })).filter((row) => row.id && row.venda_id);
  const movimentosCaixa = uniqueById(arrayFrom(db, "cashMovements")).map((row) => ({ id: text(row.id), sessao_caixa_id: nullableText(row.sessao_caixa_id), loja_id: text(row.storeId), tipo: row.category === "Sangria" ? "SANGRIA" : row.category === "Venda" ? "ENTRADA_VENDA" : row.category === "Estorno" ? "ESTORNO" : row.category === "Conta a pagar" ? "CONTA_PAGAR" : "OUTRO", valor: number(row.value), forma_pagamento: nullableText(row.paymentMethod), motivo: nullableText(row.description), operador_id: nullableText(row.operatorId), criado_em: timestamp(row.createdAt || row.date) })).filter((row) => row.id && knownLojaIds.has(row.loja_id));
  const contasManuais = uniqueById(arrayFrom(db, "bills")).map((row) => ({ id: text(row.id), fornecedor_id: nullableText(row.fornecedor_id), loja_id: text(row.storeId), categoria: text(row.category || "Despesa geral"), descricao: nullableText(row.description || row.supplier), valor: number(row.value), vencimento: text(row.dueDate), status: text(row.status || "pendente"), pago_em: nullableText(row.paidAt), criado_em: timestamp(row.createdAt) })).filter((row) => row.id && row.loja_id && row.vencimento);
  const convites = uniqueById(arrayFrom(db, "convites")).map((row) => ({ id: text(row.id), token: text(row.token), email: text(row.email), papel: text(row.papel), loja_id: text(row.loja_id), expiracao: timestamp(row.expira_em || row.expiracao || row.expiresAt), usado: row.status === "CONCLUIDO" || row.usado === true, criado_em: timestamp(row.criado_em || row.createdAt) })).filter((row) => row.id && row.token && row.email && knownLojaIds.has(row.loja_id));
  const configuracoes = Object.entries(db.configuracoes_empresa || {}).map(([chave, valor]) => ({ chave, valor, atualizado_em: timestamp(db.meta?.updatedAt) }));
  return { lojas, usuarios, produtos, fornecedores, ordensCompra, itensOrdemCompra, contasPagar, clientes, sales, vendas, movimentacoes, sessoes, vendedores, entregas, movimentosCaixa, contasManuais, convites, configuracoes, knownProdutoIds };
}

async function upsertExtras(client, rows) {
  for (const row of rows.vendedores) await client.query("INSERT INTO vendedores (id,nome,loja_id,comissao_padrao,ativo,criado_em) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome,loja_id=EXCLUDED.loja_id,comissao_padrao=EXCLUDED.comissao_padrao,ativo=EXCLUDED.ativo", [row.id,row.nome,row.loja_id,row.comissao_padrao,row.ativo,row.criado_em]);
  for (const row of rows.entregas) await client.query("INSERT INTO entregas (id,venda_id,cliente_id,endereco_entrega,turno,status,motorista,data_agendada,assinado_por,comprovante_url,criado_em) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,turno=EXCLUDED.turno,motorista=EXCLUDED.motorista,data_agendada=EXCLUDED.data_agendada", [row.id,row.venda_id,row.cliente_id,json(row.endereco_entrega,{}),row.turno,row.status,row.motorista,row.data_agendada,row.assinado_por,row.comprovante_url,row.criado_em]);
  for (const row of rows.movimentosCaixa) await client.query("INSERT INTO movimentacoes_caixa (id,sessao_caixa_id,loja_id,tipo,valor,forma_pagamento,motivo,operador_id,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING", [row.id,row.sessao_caixa_id,row.loja_id,row.tipo,row.valor,row.forma_pagamento,row.motivo,row.operador_id,row.criado_em]);
  for (const row of rows.contasManuais) await client.query("INSERT INTO contas_pagar_manuais (id,fornecedor_id,loja_id,categoria,descricao,valor,vencimento,status,pago_em,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,pago_em=EXCLUDED.pago_em", [row.id,row.fornecedor_id,row.loja_id,row.categoria,row.descricao,row.valor,row.vencimento,row.status,row.pago_em,row.criado_em]);
  for (const row of rows.convites) await client.query("INSERT INTO convites (id,token,email,papel,loja_id,expiracao,usado,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET usado=EXCLUDED.usado,expiracao=EXCLUDED.expiracao", [row.id,row.token,row.email,row.papel,row.loja_id,row.expiracao,row.usado,row.criado_em]);
  for (const row of rows.configuracoes) await client.query("INSERT INTO configuracoes_empresa (chave,valor,atualizado_em) VALUES ($1,$2::jsonb,$3) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor,atualizado_em=EXCLUDED.atualizado_em", [row.chave,json(row.valor,{}),row.atualizado_em]);
}

async function validateMigration(client, rows) {
  const entities = [["lojas","lojas"],["usuarios","usuarios"],["produtos","produtos"],["fornecedores","fornecedores"],["ordensCompra","ordens_compra"],["itensOrdemCompra","itens_ordem_compra"],["contasPagar","contas_a_pagar"],["clientes","clientes"],["vendas","vendas"],["movimentacoes","movimentacoes_estoque"],["sessoes","sessoes_caixa"],["vendedores","vendedores"],["entregas","entregas"],["movimentosCaixa","movimentacoes_caixa"],["contasManuais","contas_pagar_manuais"],["convites","convites"],["configuracoes","configuracoes_empresa"]];
  const report = [];
  for (const [key, table] of entities) {
    const result = table === "lojas"
      ? await client.query("SELECT COUNT(*)::int AS count FROM lojas WHERE id <> $1", ["TODAS"])
      : await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    const jsonCount = rows[key].length;
    const pgCount = result.rows[0].count;
    report.push({ Entidade: table, JSON: jsonCount, PostgreSQL: pgCount, Status: jsonCount === pgCount ? "OK" : "Divergente" });
  }
  console.table(report);
  if (report.some((row) => row.Status !== "OK")) throw new Error("Validação pós-migração encontrou divergências.");
}

async function main() {
  loadEnvFile();
  const rawDb = await fs.readFile(JSON_DB_PATH, "utf8");
  const db = JSON.parse(rawDb);
  const rows = prepareRows(db);

  if (process.argv.includes("--dry-run")) {
    console.log("Dry-run concluido. Nenhum dado foi enviado ao PostgreSQL.");
    console.table({
      lojas: rows.lojas.length,
      usuarios: rows.usuarios.length,
      produtos: rows.produtos.length,
      fornecedores: rows.fornecedores.length,
      ordens_compra: rows.ordensCompra.length,
      itens_ordem_compra: rows.itensOrdemCompra.length,
      contas_a_pagar: rows.contasPagar.length,
      clientes: rows.clientes.length,
      vendas: rows.vendas.length,
      movimentacoes_estoque: rows.movimentacoes.length,
      sessoes_caixa: rows.sessoes.length,
      vendedores: rows.vendedores.length,
      entregas: rows.entregas.length,
      movimentacoes_caixa: rows.movimentosCaixa.length,
      contas_pagar_manuais: rows.contasManuais.length,
      convites: rows.convites.length,
      configuracoes_empresa: rows.configuracoes.length
    });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const schemaSql = await fs.readFile(SCHEMA_PATH, "utf8");
    await client.query("BEGIN");
    await client.query(schemaSql);
    await upsertLojas(client, rows.lojas);
    await upsertUsuarios(client, rows.usuarios);
    await upsertProdutos(client, rows.produtos);
    await upsertFornecedores(client, rows.fornecedores);
    await upsertOrdensCompra(client, rows.ordensCompra, rows.itensOrdemCompra);
    await upsertContasPagar(client, rows.contasPagar);
    await upsertClientes(client, rows.clientes);
    await upsertVendas(client, rows.vendas, rows.sales, rows.knownProdutoIds);
    await insertMovimentacoes(client, rows.movimentacoes);
    await upsertSessoesCaixa(client, rows.sessoes);
  await upsertExtras(client, rows);
  await client.query(
    "INSERT INTO erp_runtime_state (id, payload, atualizado_em) VALUES ($1, $2::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, atualizado_em = EXCLUDED.atualizado_em",
    ["principal", JSON.stringify(db)]
  );
  await validateMigration(client, rows);
    await client.query("COMMIT");
    console.log("Migracao concluida com sucesso.");
    console.table({
      lojas: rows.lojas.length,
      usuarios: rows.usuarios.length,
      produtos: rows.produtos.length,
      fornecedores: rows.fornecedores.length,
      ordens_compra: rows.ordensCompra.length,
      itens_ordem_compra: rows.itensOrdemCompra.length,
      contas_a_pagar: rows.contasPagar.length,
      clientes: rows.clientes.length,
      vendas: rows.vendas.length,
      movimentacoes_estoque: rows.movimentacoes.length,
      sessoes_caixa: rows.sessoes.length,
      vendedores: rows.vendedores.length,
      entregas: rows.entregas.length,
      movimentacoes_caixa: rows.movimentosCaixa.length,
      contas_pagar_manuais: rows.contasManuais.length,
      convites: rows.convites.length,
      configuracoes_empresa: rows.configuracoes.length
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(async (error) => {
  await closePool();
  console.error("Falha na migracao:", error.message);
  process.exitCode = 1;
});
