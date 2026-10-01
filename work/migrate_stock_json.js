const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.resolve(__dirname, "..", "data", "erp-db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

db.stock = Array.isArray(db.stock) ? db.stock : [];
const legacyStock = new Map();
if (db.stock.length) {
  for (const row of db.stock) {
    const current = legacyStock.get(row.productId) || {
      saldo_deposito: 0,
      showroom_loja1: 0,
      showroom_loja2: 0
    };
    if (Object.prototype.hasOwnProperty.call(row, "storeId")) {
      current.saldo_deposito += Number(row.quantity || 0);
    } else {
      current.saldo_deposito += Number(row.saldo_deposito || 0);
      current.showroom_loja1 += Number(row.showroom_loja1 || 0);
      current.showroom_loja2 += Number(row.showroom_loja2 || 0);
    }
    legacyStock.set(row.productId, current);
  }
}

for (const product of db.products || []) {
  const migrated = legacyStock.get(product.id);
  if (migrated && product.saldo_deposito === undefined && product.showroom_loja1 === undefined && product.showroom_loja2 === undefined) {
    product.saldo_deposito = migrated.saldo_deposito;
    product.showroom_loja1 = migrated.showroom_loja1;
    product.showroom_loja2 = migrated.showroom_loja2;
  }
  product.saldo_deposito = Number(product.saldo_deposito || 0);
  product.showroom_loja1 = Number(product.showroom_loja1 || 0);
  product.showroom_loja2 = Number(product.showroom_loja2 || 0);
}

if ([...(db.products || [])].every((product) => product.saldo_deposito === 0 && product.showroom_loja1 === 0 && product.showroom_loja2 === 0)) {
  const recovered = new Map();
  for (const movement of db.stockMovements || []) {
    const row = recovered.get(movement.productId) || { saldo_deposito: 0, showroom_loja1: 0, showroom_loja2: 0 };
    const qty = Number(movement.quantity || 0);
    if (movement.type === "entrada") row.saldo_deposito += qty;
    if (movement.type === "saida_venda") row.saldo_deposito -= qty;
    if (movement.type === "envio_showroom") {
      row.saldo_deposito -= qty;
      if (movement.storeId === "loja_1") row.showroom_loja1 += qty;
      if (movement.storeId === "loja_2") row.showroom_loja2 += qty;
    }
    if (movement.type === "retorno_showroom") {
      row.saldo_deposito += qty;
      if (movement.storeId === "loja_1") row.showroom_loja1 -= qty;
      if (movement.storeId === "loja_2") row.showroom_loja2 -= qty;
    }
    recovered.set(movement.productId, row);
  }
  for (const product of db.products || []) {
    const row = recovered.get(product.id);
    if (!row) continue;
    product.saldo_deposito = Math.max(0, row.saldo_deposito);
    product.showroom_loja1 = Math.max(0, row.showroom_loja1);
    product.showroom_loja2 = Math.max(0, row.showroom_loja2);
  }
}

db.stock = [];

db.stockMovements = (db.stockMovements || []).map((movement) => {
  if (movement.type === "transferencia") {
    return {
      ...movement,
      type: "envio_showroom",
      storeId: movement.toStoreId || movement.fromStoreId || null,
      reason: movement.reason || "Migração de transferência legada para showroom",
      fromStoreId: undefined,
      toStoreId: undefined
    };
  }
  if (movement.type === "entrada") {
    return {
      ...movement,
      storeId: null,
      reason: movement.reason || "Entrada de mercadoria no depósito central",
      fromStoreId: undefined,
      toStoreId: undefined
    };
  }
  if (movement.type === "saida_venda") {
    return {
      ...movement,
      storeId: null,
      reason: movement.reason || "Baixa automática por venda no depósito central",
      fromStoreId: undefined,
      toStoreId: undefined
    };
  }
  return movement;
});

db.meta = db.meta || {};
db.meta.updatedAt = new Date().toISOString();

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log("Migrado:", db.stock.length, "produtos em estoque");
