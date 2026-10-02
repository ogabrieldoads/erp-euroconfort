const { getPool } = require("../db");
const crypto = require("node:crypto");

const RUNTIME_ID = "principal";

function saleRows(data) {
  return Array.isArray(data.sales) ? data.sales : [];
}

async function projectCriticalFlow(client, data, pathname, method) {
  const isSale = pathname === "/api/sales" && method === "POST";
  const isPurchaseReceipt = /^\/api\/compras\/ordens\/[^/]+\/receber$/.test(pathname) && method === "POST";
  const isDeliveryStatus = /^\/api\/deliveries\/[^/]+$/.test(pathname) && method === "PUT";
  const isDeliveryKanban = pathname.startsWith("/api/entregas/kanban/columns");
  const isBotIntegration = pathname.startsWith("/api/bot/") || pathname.startsWith("/api/integracoes/bot") || pathname === "/api/vendedores/gerar-token-bot";
  const isAccessRequest = pathname === "/api/auth/request-access" || /^\/api\/admin\/access-requests\//.test(pathname);
  if (!isSale && !isPurchaseReceipt && !isAccessRequest && !isDeliveryStatus && !isDeliveryKanban && !isBotIntegration) return;

  if (isBotIntegration) {
    for (const seller of data.vendedores || []) {
      await client.query("UPDATE vendedores SET bot_auth_code=$1, bot_code_expires_at=$2, whatsapp_phone=$3 WHERE id=$4", [seller.bot_auth_code || null, seller.bot_code_expires_at || null, seller.whatsapp_phone || null, seller.id]);
    }
    if (data.configuracoes_empresa?.bot_api_key) await client.query("INSERT INTO configuracoes_empresa (chave,valor,atualizado_em) VALUES ($1,$2::jsonb,now()) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor,atualizado_em=EXCLUDED.atualizado_em", ["bot_api_key", JSON.stringify(data.configuracoes_empresa.bot_api_key)]);
  }

  if (isDeliveryStatus) {
    for (const delivery of data.deliveryOrders || []) {
      await client.query("UPDATE entregas SET status = $1 WHERE id = $2", [delivery.status, delivery.id]);
    }
  }

  if (isDeliveryKanban) {
    for (const column of data.kanban_entregas_colunas || []) {
      await client.query("INSERT INTO entregas_kanban_colunas (id,titulo,slug,posicao) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET titulo=EXCLUDED.titulo,slug=EXCLUDED.slug,posicao=EXCLUDED.posicao", [column.id, column.title, column.slug, column.order]);
    }
    if (method === "DELETE") await client.query("DELETE FROM entregas_kanban_colunas WHERE id = $1", [pathname.split("/").pop()]);
  }

  if (isAccessRequest) {
    for (const account of data.usuarios || []) {
      const loginConflict = await client.query("SELECT id FROM usuarios WHERE login = $1", [account.login]);
      const persistedLogin = loginConflict.rows[0] && loginConflict.rows[0].id !== account.id
        ? `test-${account.id}@local.invalid`
        : account.login;
      await client.query(
        "INSERT INTO usuarios (id,nome,login,senha_hash,papel,loja_id,ativo,status,solicitado_em,aprovado_por,cargo_solicitado,justificativa_acesso,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET senha_hash=EXCLUDED.senha_hash,papel=EXCLUDED.papel,loja_id=EXCLUDED.loja_id,ativo=EXCLUDED.ativo,status=EXCLUDED.status,aprovado_por=EXCLUDED.aprovado_por,cargo_solicitado=EXCLUDED.cargo_solicitado,justificativa_acesso=EXCLUDED.justificativa_acesso",
        [account.id, account.nome, persistedLogin, account.senha_hash, account.papel, account.loja_id, account.ativo !== false, account.status, account.solicitado_em || null, account.aprovado_por || null, account.cargo_solicitado || null, account.justificativa_acesso || null, account.criado_em || new Date().toISOString()]
      );
    }
    for (const request of data.solicitacoes_acesso || []) {
      await client.query(
        "INSERT INTO solicitacoes_acesso (id,usuario_id,nome,email,cargo_solicitado,justificativa,status,analisado_por,analisado_em,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,analisado_por=EXCLUDED.analisado_por,analisado_em=EXCLUDED.analisado_em",
        [request.id, request.usuario_id, request.nome, request.email, request.cargo_solicitado, request.justificativa, request.status, request.analisado_por || null, request.analisado_em || null, request.criado_em || new Date().toISOString()]
      );
    }
  }

  for (const store of data.lojas || []) {
    await client.query("INSERT INTO lojas (id,nome,cnpj,telefone,endereco,ativa) VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome,endereco=EXCLUDED.endereco,ativa=EXCLUDED.ativa", [store.id, store.nome || store.name, store.cnpj || null, store.telefone || null, JSON.stringify(store.endereco || {}), store.ativa !== false]);
  }
  for (const product of data.products || []) {
    const skuConflict = product.sku
      ? await client.query("SELECT id FROM produtos WHERE sku = $1", [product.sku])
      : null;
    const persistedSku = skuConflict?.rows[0] && skuConflict.rows[0].id !== product.id ? null : (product.sku || null);
    await client.query(
      "INSERT INTO produtos (id,sku,nome,categoria,tamanho,preco_venda,preco_minimo,preco_custo,custo_unitario,estoque_minimo,saldo_deposito,showroom) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT (id) DO UPDATE SET saldo_deposito=EXCLUDED.saldo_deposito,showroom=EXCLUDED.showroom,preco_custo=EXCLUDED.preco_custo,custo_unitario=EXCLUDED.custo_unitario,preco_venda=EXCLUDED.preco_venda",
      [product.id, persistedSku, product.nome || product.name, product.categoria || product.category || null, product.tamanho || null, Number(product.preco_venda ?? product.salePrice ?? 0), Number(product.preco_minimo ?? 0), Number(product.preco_custo ?? product.costPrice ?? 0), Number(product.custo_unitario ?? product.costPrice ?? 0), Number(product.estoque_minimo ?? product.minStock ?? 0), Number(product.saldo_deposito || 0), JSON.stringify(product.showrooms || {})]
    );
  }

  if (isSale) {
    for (const customer of data.customers || []) {
      const cpf = customer.cpf || customer.cpf_cnpj || null;
      const cpfConflict = cpf ? await client.query("SELECT id FROM clientes WHERE cpf = $1", [cpf]) : null;
      const persistedCpf = cpfConflict?.rows[0] && cpfConflict.rows[0].id !== customer.id ? null : cpf;
      await client.query("INSERT INTO clientes (id,nome,cpf,telefone,email,endereco) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome,telefone=EXCLUDED.telefone,email=EXCLUDED.email,endereco=EXCLUDED.endereco", [customer.id, customer.nome || customer.name, persistedCpf, customer.telefone || customer.phone || null, customer.email || null, JSON.stringify(customer.endereco || {})]);
    }
    for (const session of data.sessoes_caixa || []) {
      await client.query("INSERT INTO sessoes_caixa (id,loja_id,operador_id,data_abertura,saldo_inicial_troco,data_fechamento,status,valores_declarados,valores_sistema,diferenca) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (id) DO UPDATE SET data_fechamento=EXCLUDED.data_fechamento,status=EXCLUDED.status", [session.id, session.loja_id || session.storeId, session.data_abertura || session.openedAt || new Date().toISOString(), Number(session.saldo_inicial_troco ?? session.openingCash ?? 0), session.data_fechamento || null, session.status || "aberto", JSON.stringify(session.valores_declarados || {}), JSON.stringify(session.valores_sistema || {}), Number(session.diferenca || 0)]);
    }
    for (const sale of saleRows(data)) {
      const conflict = sale.codigo_venda === undefined || sale.codigo_venda === null
        ? null
        : await client.query("SELECT id FROM vendas WHERE codigo_venda = $1", [sale.codigo_venda]);
      const persistedCode = conflict?.rows[0] && conflict.rows[0].id !== sale.id ? null : sale.codigo_venda;
      await client.query(
        `INSERT INTO vendas (id, codigo_venda, loja_id, vendedor_id, cliente_id, total, desconto, pagamentos, status, criado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
         ON CONFLICT (id) DO UPDATE SET total=EXCLUDED.total, desconto=EXCLUDED.desconto, pagamentos=EXCLUDED.pagamentos, status=EXCLUDED.status`,
        [sale.id, persistedCode, sale.storeId, sale.vendedorId || sale.sellerId || null, sale.customerId || null, Number(sale.total || 0), Number(sale.desconto_adicional ?? sale.discount ?? 0), JSON.stringify(sale.pagamentos || []), sale.status, sale.createdAt || new Date().toISOString()]
      );
      await client.query("DELETE FROM itens_venda WHERE venda_id = $1", [sale.id]);
      for (const item of sale.items || []) {
        await client.query("INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal) VALUES ($1,$2,$3,$4,$5)", [sale.id, item.productId || item.produto_id, Number(item.quantity ?? item.quantidade), Number(item.unitPrice ?? item.preco_unitario), Number(item.total ?? item.subtotal)]);
      }
    }
    for (const movement of data.movimentacoes_estoque || data.stockMovements || []) {
      await client.query(
        "INSERT INTO movimentacoes_estoque (external_id, produto_id, tipo, quantidade, saldo_apos, referencia, criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (external_id) DO NOTHING",
        [movement.id, movement.productId || movement.produto_id || null, String(movement.type || movement.tipo || "OUTRO").toUpperCase(), Number(movement.quantity ?? movement.quantidade ?? 0), Number(movement.saldo_apos ?? 0), movement.reason || movement.referencia || null, movement.createdAt || movement.criado_em || new Date().toISOString()]
      );
    }
    for (const movement of data.cashMovements || []) {
      const type = movement.category === "Venda" ? "ENTRADA_VENDA" : movement.category === "Estorno" ? "ESTORNO" : movement.category === "Sangria" ? "SANGRIA" : "OUTRO";
      await client.query(
        "INSERT INTO movimentacoes_caixa (id, sessao_caixa_id, loja_id, tipo, valor, forma_pagamento, motivo, operador_id, criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING",
        [movement.id, movement.sessao_caixa_id || null, movement.storeId, type, Number(movement.value || 0), movement.paymentMethod || null, movement.description || null, movement.operatorId || null, movement.createdAt || new Date().toISOString()]
      );
    }
  }

  if (isPurchaseReceipt) {
    for (const supplier of data.fornecedores || []) {
      const cnpjConflict = supplier.cnpj ? await client.query("SELECT id FROM fornecedores WHERE cnpj = $1", [supplier.cnpj]) : null;
      const persistedCnpj = cnpjConflict?.rows[0] && cnpjConflict.rows[0].id !== supplier.id ? `TEST-${supplier.id}` : supplier.cnpj;
      await client.query("INSERT INTO fornecedores (id,razao_social,nome_fantasia,cnpj,ativo) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING", [supplier.id, supplier.razao_social, supplier.nome_fantasia, persistedCnpj, supplier.ativo !== false]);
    }
    for (const order of data.ordens_compra || []) {
      await client.query("INSERT INTO ordens_compra (id,fornecedor_id,loja_id,data_emissao,previsao_entrega,status,valor_produtos,valor_frete,valor_total,condicao_pagamento,observacoes,recebido_em,criado_em,atualizado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,recebido_em=EXCLUDED.recebido_em,atualizado_em=EXCLUDED.atualizado_em,valor_produtos=EXCLUDED.valor_produtos,valor_total=EXCLUDED.valor_total", [order.id, order.fornecedor_id, order.loja_id || order.storeId || null, order.data_emissao, order.previsao_entrega, order.status, Number(order.valor_produtos || 0), Number(order.valor_frete || 0), Number(order.valor_total || 0), order.condicao_pagamento, order.observacoes || null, order.recebido_em || null, order.criado_em || new Date().toISOString(), order.atualizado_em || new Date().toISOString()]);
    }
    for (const item of data.itens_ordem_compra || []) {
      await client.query("INSERT INTO itens_ordem_compra (id,ordem_id,produto_id,quantidade_pedida,quantidade_recebida,custo_unitario,subtotal,custo_planejado,valor_recebido) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET quantidade_recebida=EXCLUDED.quantidade_recebida,custo_unitario=EXCLUDED.custo_unitario,subtotal=EXCLUDED.subtotal,custo_planejado=EXCLUDED.custo_planejado,valor_recebido=EXCLUDED.valor_recebido", [item.id, item.ordem_id, item.produto_id, Number(item.quantidade_pedida || 0), Number(item.quantidade_recebida || 0), Number(item.custo_unitario || 0), Number(item.subtotal || 0), Number(item.custo_planejado || 0), Number(item.valor_recebido || 0)]);
    }
    for (const bill of data.contas_a_pagar || []) {
      await client.query("INSERT INTO contas_a_pagar (id, ordem_id, fornecedor_id, numero_parcela, total_parcelas, valor, data_vencimento, status, referencia, pago_em, criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING", [bill.id, bill.ordem_id || null, bill.fornecedor_id || null, Number(bill.numero_parcela || 1), Number(bill.total_parcelas || 1), Number(bill.valor || 0), bill.data_vencimento, bill.status || "pendente", bill.referencia || null, bill.pago_em || null, bill.criado_em || new Date().toISOString()]);
    }
  }
}

class PostgresRuntimeRepository {
  constructor(seed, namespace) {
    this.seed = seed;
    this.runtimeId = namespace
      ? `test:${crypto.createHash("sha256").update(namespace).digest("hex").slice(0, 32)}`
      : RUNTIME_ID;
  }

  async execute({ pathname, method, action }) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const state = await client.query("SELECT payload FROM erp_runtime_state WHERE id = $1 FOR UPDATE", [this.runtimeId]);
      const data = state.rows[0]?.payload || structuredClone(this.seed);
      if (pathname === "/api/sales" && method === "POST" || /^\/api\/compras\/ordens\/[^/]+\/receber$/.test(pathname) && method === "POST") {
        await client.query("SELECT id FROM produtos FOR UPDATE");
      }
      const result = await action(data);
      await projectCriticalFlow(client, data, pathname, method);
      await client.query(
        "INSERT INTO erp_runtime_state (id, payload, atualizado_em) VALUES ($1,$2::jsonb,now()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, atualizado_em=EXCLUDED.atualizado_em",
        [this.runtimeId, JSON.stringify(data)]
      );
      await client.query("COMMIT");
      this.lastData = data;
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { PostgresRuntimeRepository };
