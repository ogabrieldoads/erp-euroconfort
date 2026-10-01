const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.resolve(__dirname, "..", "data", "erp-db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

function nowIso() {
  return new Date().toISOString();
}

function storeLabelFromId(storeId) {
  if (storeId === "loja_1") return "Loja 1";
  if (storeId === "loja_2") return "Loja 2";
  return "Ambas";
}

function normalizeSeller(seller) {
  return {
    id: seller.id,
    nome: String(seller.nome || seller.name || "").trim(),
    loja_padrao: ["Loja 1", "Loja 2", "Ambas"].includes(seller.loja_padrao)
      ? seller.loja_padrao
      : storeLabelFromId(seller.storeId),
    telefone: String(seller.telefone || seller.phone || "").trim(),
    ativo: seller.ativo === undefined ? seller.active !== false : Boolean(seller.ativo),
    criado_em: seller.criado_em || seller.createdAt || nowIso()
  };
}

const legacy = Array.isArray(db.sellers) ? db.sellers : [];
db.vendedores = Array.isArray(db.vendedores) ? db.vendedores.map(normalizeSeller) : [];

if (!db.vendedores.length && legacy.length) {
  db.vendedores = legacy.map(normalizeSeller);
}

const defaults = [
  { id: "vend_1", nome: "Vendedora Loja 1", loja_padrao: "Loja 1", telefone: "(85) 90000-0001" },
  { id: "vend_2", nome: "Vendedor Loja 2", loja_padrao: "Loja 2", telefone: "(85) 90000-0002" },
  { id: "vend_3", nome: "Vendedor Apoio", loja_padrao: "Ambas", telefone: "(85) 90000-0003" }
];

for (const seller of defaults) {
  const existing = db.vendedores.find((item) => item.id === seller.id);
  if (!existing) {
    db.vendedores.push({ ...seller, ativo: true, criado_em: nowIso() });
  } else if (!existing.telefone) {
    existing.telefone = seller.telefone;
  }
}

for (const sale of db.sales || []) {
  if (!sale.sellerName) {
    sale.sellerName = db.vendedores.find((seller) => seller.id === sale.sellerId)?.nome || "";
  }
  if (!sale.vendedorId) sale.vendedorId = sale.sellerId;
  if (!sale.vendedorNome) sale.vendedorNome = sale.sellerName;
}

delete db.sellers;
db.meta = db.meta || {};
db.meta.updatedAt = nowIso();

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log("Vendedores migrados:", db.vendedores.length);
