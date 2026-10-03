const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

function loadEnvFile(filePath = path.resolve(__dirname, "..", ".env")) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const name = key.trim();
    if (!name || process.env[name] !== undefined) continue;
    let value = rest.join("=").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

loadEnvFile();

const { enviarEmailConvite } = require("./services/email");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_DB_PATH = process.env.ERP_DB_PATH || path.join(ROOT, "data", "erp-db.json");
const PORT = Number(process.env.PORT || 3000);
const APP_URL = normalizeAppUrl(process.env.APP_URL || `http://localhost:${PORT}`);

const PAYMENT_METHODS = ["dinheiro", "pix", "cartao_credito", "cartao_debito", "boleto"];
const PAYMENT_LABELS = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto"
};
const BILL_STATUS = ["pendente", "pago"];
const DELIVERY_STATUS = ["pendente", "em_rota", "entregue", "cancelada"];
const DEFAULT_DELIVERY_KANBAN_COLUMNS = [
  { id: "delivery-col-pending", title: "Pendente / A Separar", slug: "pendente", order: 1 },
  { id: "delivery-col-route", title: "Em Rota", slug: "em_rota", order: 2 },
  { id: "delivery-col-delivered", title: "Entregue", slug: "entregue", order: 3 }
];
const PURCHASE_ORDER_STATUS = ["RASCUNHO", "PEDIDO_ENVIADO", "EM_TRANSITO", "RECEBIDO_TOTAL", "RECEBIDO_PARCIAL", "CANCELADO"];
const PURCHASE_OPEN_STATUS = ["RASCUNHO", "PEDIDO_ENVIADO", "EM_TRANSITO", "RECEBIDO_PARCIAL"];
const PURCHASE_INCOMING_STATUS = ["PEDIDO_ENVIADO", "EM_TRANSITO"];
const SALE_CODE_BASE = 1000;
const INVITE_EXPIRATION_HOURS = 48;
const USER_PROFILE_LABELS = {
  gestor: "Gestor",
  gestor_financeiro: "Gestor Financeiro",
  gerente_loja: "Gerente",
  vendedor: "Vendedor",
  gerente_loja_1: "Gerente Loja 1",
  gerente_loja_2: "Gerente Loja 2",
  estoque: "Estoque",
  ADMINISTRADOR: "Administrador",
  GESTOR_FINANCEIRO: "Gestor Financeiro",
  GERENTE_LOJA: "Gerente Loja",
  OPERADOR_CAIXA: "Operador de Caixa",
  ESTOQUE: "Estoque"
};

const USER_PAPEIS = ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA", "OPERADOR_CAIXA", "ESTOQUE", "PENDENTE"];
const USER_STATUS = ["PENDENTE_APROVACAO", "ATIVO", "INATIVO", "REJEITADO"];
const PAPEL_LABELS = {
  ADMINISTRADOR: "Administrador",
  GESTOR_FINANCEIRO: "Gestor Financeiro",
  GERENTE_LOJA: "Gerente Loja",
  OPERADOR_CAIXA: "Operador de Caixa",
  ESTOQUE: "Estoque",
  PENDENTE: "Pendente de aprovação"
};
const LEGACY_ROLE_BY_PAPEL = {
  ADMINISTRADOR: "gestor",
  GESTOR_FINANCEIRO: "gestor_financeiro",
  GERENTE_LOJA: "gerente_loja",
  OPERADOR_CAIXA: "vendedor",
  ESTOQUE: "estoque",
  PENDENTE: "pendente"
};
const PAPEL_BY_LEGACY_ROLE = {
  gestor: "ADMINISTRADOR",
  admin: "ADMINISTRADOR",
  administrador: "ADMINISTRADOR",
  gerente_financeiro: "GESTOR_FINANCEIRO",
  gestor_financeiro: "GESTOR_FINANCEIRO",
  gerente_loja: "GERENTE_LOJA",
  gerente_loja_1: "GERENTE_LOJA",
  gerente_loja_2: "GERENTE_LOJA",
  vendedor: "OPERADOR_CAIXA",
  operador_caixa: "OPERADOR_CAIXA",
  caixa: "OPERADOR_CAIXA",
  estoque: "ESTOQUE",
  pendente: "PENDENTE"
};

function legacyStoreToLoja(store) {
  return normalizeLoja(store);
}

function formatLojaAddress(endereco = {}) {
  return [endereco.logradouro, endereco.bairro, endereco.cidade].filter(Boolean).join(" - ");
}

function normalizeLoja(store = {}) {
  const rawEndereco = store.endereco && typeof store.endereco === "object" ? store.endereco : {};
  const endereco = {
    logradouro: normalize(rawEndereco.logradouro || store.logradouro || store.address),
    bairro: normalize(rawEndereco.bairro || store.bairro),
    cidade: normalize(rawEndereco.cidade || store.cidade)
  };
  const ativa = store.ativa === undefined
    ? store.active !== false && store.status !== "inativo"
    : Boolean(store.ativa);
  return {
    id: store.id,
    nome: store.nome || store.name || "",
    cnpj: normalize(store.cnpj),
    telefone: normalize(store.telefone || store.phone),
    endereco,
    ativa,
    criado_em: store.criado_em || store.createdAt || nowIso(),
    name: store.nome || store.name || "",
    address: normalize(formatLojaAddress(endereco) || store.address),
    status: ativa ? "ativo" : "inativo",
    active: ativa
  };
}

function lojaPayload(loja) {
  return normalizeLoja(loja);
}

function lojaToStore(loja) {
  const normalized = normalizeLoja(loja);
  return {
    id: normalized.id,
    name: normalized.nome,
    nome: normalized.nome,
    cnpj: normalized.cnpj,
    telefone: normalized.telefone,
    endereco: normalized.endereco,
    ativa: normalized.ativa,
    criado_em: normalized.criado_em,
    address: normalized.address,
    status: normalized.status,
    active: normalized.active
  };
}

function nextLojaId(db) {
  const sequence = (db.lojas || [])
    .map((loja) => String(loja.id || "").match(/^loja[_-](\d+)$/))
    .filter(Boolean)
    .reduce((max, match) => Math.max(max, Number(match[1])), 0) + 1;
  let candidate = `loja-${sequence}`;
  let attempt = sequence;
  while ((db.lojas || []).some((loja) => loja.id === candidate)) {
    attempt += 1;
    candidate = `loja-${attempt}`;
  }
  return candidate;
}

function lojaNameById(db, lojaId) {
  const loja = (db.lojas || []).find((item) => item.id === lojaId);
  return loja?.nome || loja?.name || storeLabelFromId(lojaId);
}

function activeLojaIds(db) {
  return (db.lojas || []).filter((loja) => loja.ativa !== false && loja.status !== "inativo").map((loja) => loja.id);
}

function syncLojaDerivedData(db) {
  db.lojas = (db.lojas || []).map(normalizeLoja);
  db.stores = db.lojas.map(lojaToStore);
  for (const product of db.products || []) {
    product.__lojas = db.lojas;
    normalizeProductStock(product);
  }
  db.configuracoes_empresa = normalizeCompanySettings(db, db.configuracoes_empresa);
}

function lojaFromBody(db, body, existing = {}) {
  const idValue = normalize(existing.id || body.id || nextLojaId(db));
  const endereco = {
    ...(existing.endereco || {}),
    ...(body.endereco || {}),
    logradouro: body.logradouro ?? body.endereco?.logradouro ?? existing.endereco?.logradouro ?? existing.logradouro ?? existing.address,
    bairro: body.bairro ?? body.endereco?.bairro ?? existing.endereco?.bairro ?? existing.bairro,
    cidade: body.cidade ?? body.endereco?.cidade ?? existing.endereco?.cidade ?? existing.cidade
  };
  const loja = normalizeLoja({
    ...existing,
    id: idValue,
    nome: body.nome === undefined ? existing.nome || existing.name : body.nome,
    cnpj: body.cnpj === undefined ? existing.cnpj : body.cnpj,
    telefone: body.telefone === undefined ? existing.telefone || existing.phone : body.telefone,
    endereco,
    ativa: body.ativa === undefined ? existing.ativa ?? existing.active ?? true : body.ativa,
    criado_em: existing.criado_em || existing.createdAt || nowIso()
  });
  if (!loja.id) throw badRequest("ID da loja é obrigatório.");
  if (!loja.nome) throw badRequest("Nome da loja é obrigatório.");
  return loja;
}

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function formatSaleCode(sequence) {
  return SALE_CODE_BASE + sequence;
}

function saleCodeSequence(code) {
  const text = String(code || "").trim();
  const legacyMatch = text.match(/^PED-(\d+)$/i);
  if (legacyMatch) return Number(legacyMatch[1]);
  const numericCode = Number(text);
  if (!Number.isInteger(numericCode) || numericCode <= 0) return 0;
  return numericCode > SALE_CODE_BASE ? numericCode - SALE_CODE_BASE : numericCode;
}

function normalizeSaleCode(code) {
  const sequence = saleCodeSequence(code);
  return sequence ? formatSaleCode(sequence) : "";
}

function nextSaleCode(db) {
  const maxCode = (db.sales || []).reduce((max, sale) => Math.max(max, Number(normalizeSaleCode(sale.codigo_venda)) || 0), 0);
  const configuredNext = Number(db.configuracoes_empresa?.proximo_numero_pedido || 0);
  return Math.max(SALE_CODE_BASE + 1, maxCode + 1, Number.isInteger(configuredNext) ? configuredNext : 0);
}

function numericSaleReference(text) {
  return normalize(text).replace(/PED-(\d+)/gi, (_, sequence) => String(formatSaleCode(Number(sequence))));
}

function normalize(text) {
  return String(text || "").trim();
}

function toNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw badRequest(`${field} inválido.`);
  return number;
}

function toPositiveNumber(value, field) {
  const number = toNumber(value, field);
  if (number <= 0) throw badRequest(`${field} deve ser maior que zero.`);
  return number;
}

function toNonNegativeNumber(value, field) {
  const number = toNumber(value, field);
  if (number < 0) throw badRequest(`${field} deve ser maior ou igual a zero.`);
  return number;
}

function toNonNegativeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw badRequest(`${field} deve ser um inteiro maior ou igual a zero.`);
  }
  return number;
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asciiToken(value) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function productSizeCode(product) {
  const text = asciiToken(product.tamanho_padrao || product.standardSize || "");
  if (text.startsWith("SOL")) return "SOL";
  if (text.startsWith("CAS")) return "CAS";
  if (text.startsWith("QUE")) return "QUE";
  if (text.startsWith("KIN")) return "KIN";
  return "PAD";
}

function skuSequence(sku) {
  const match = String(sku || "").match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function nextSku(db, product) {
  const category = asciiToken(product.category || product.categoria || "PRO").slice(0, 3).padEnd(3, "X");
  const size = productSizeCode(product);
  const next = Math.max(SALE_CODE_BASE, ...(db.products || []).map((item) => skuSequence(item.sku))) + 1;
  let candidate = `${category}-${size}-${next}`;
  let sequence = next;
  while ((db.products || []).some((item) => item.sku === candidate)) {
    sequence += 1;
    candidate = `${category}-${size}-${sequence}`;
  }
  return candidate;
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(":");
  if (!salt || !expected) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), hash);
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function forbidden(message = "Acesso negado para este perfil.") {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function notFound(message = "Registro não encontrado.") {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function seedData() {
  const stores = [
    {
      id: "loja_1",
      nome: "Loja 1",
      name: "Loja 1",
      cnpj: "",
      status: "ativo",
      address: "Endereço da Loja 1"
    },
    {
      id: "loja_2",
      nome: "Loja 2",
      name: "Loja 2",
      cnpj: "",
      status: "ativo",
      address: "Endereço da Loja 2"
    }
  ];
  const users = [
    {
      id: "user_gestor",
      name: "Gestor",
      username: "gestor",
      passwordHash: passwordHash("123456"),
      role: "gestor",
      storeId: null,
      loja_id: null,
      active: true
    },
    {
      id: "user_gerente_1",
      name: "Gerente Loja 1",
      username: "gerente1",
      passwordHash: passwordHash("123456"),
      role: "gerente_loja",
      storeId: "loja_1",
      loja_id: "loja_1",
      active: true
    },
    {
      id: "user_gerente_2",
      name: "Gerente Loja 2",
      username: "gerente2",
      passwordHash: passwordHash("123456"),
      role: "gerente_loja",
      storeId: "loja_2",
      loja_id: "loja_2",
      active: true
    },
    {
      id: "user_estoque",
      name: "Gerente de Estoque",
      username: "estoque",
      passwordHash: passwordHash("123456"),
      role: "estoque",
      storeId: null,
      loja_id: null,
      active: true
    }
  ].map(usuarioRecord);

  return {
    meta: { createdAt: nowIso(), updatedAt: nowIso() },
    lojas: stores.map(legacyStoreToLoja),
    stores,
    usuarios: users,
    users: users.map(normalizeUsuario),
    convites: [],
    sessions: [],
    fornecedores: [],
    ordens_compra: [],
    itens_ordem_compra: [],
    contas_a_pagar: [],
    vendedores: [
      { id: "vend_1", nome: "Vendedora Loja 1", loja_padrao: "Loja 1", telefone: "(85) 90000-0001", ativo: true, criado_em: nowIso() },
      { id: "vend_2", nome: "Vendedor Loja 2", loja_padrao: "Loja 2", telefone: "(85) 90000-0002", ativo: true, criado_em: nowIso() },
      { id: "vend_3", nome: "Vendedor Apoio", loja_padrao: "Ambas", telefone: "(85) 90000-0003", ativo: true, criado_em: nowIso() }
    ],
    products: [],
    customers: [],
    stockMovements: [],
    movimentacoes_estoque: [],
    sessoes_caixa: [],
    configuracoes_empresa: defaultCompanySettings(stores),
    sales: [],
    cashMovements: [],
    bills: [],
    deliveryOrders: [],
    kanban_entregas_colunas: structuredClone(DEFAULT_DELIVERY_KANBAN_COLUMNS)
  };
}

class JsonStore {
  constructor(filePath = DEFAULT_DB_PATH) {
    this.filePath = filePath;
    this.data = this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      const seeded = seedData();
      this.save(seeded);
      return seeded;
    }
    const loaded = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    migrateData(loaded);
    return loaded;
  }

  save(data = this.data) {
    data.meta = data.meta || {};
    data.meta.updatedAt = nowIso();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    // Windows pode manter o destino aberto por um instante, impedindo renameSync.
    // Um temporario exclusivo + copia com substituicao deixa a persistencia resiliente.
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    try {
      fs.copyFileSync(tempPath, this.filePath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

function canonicalPapel(value) {
  const raw = normalize(value);
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (USER_PAPEIS.includes(upper)) return upper;
  return PAPEL_BY_LEGACY_ROLE[raw.toLowerCase()] || "ADMINISTRADOR";
}

function papelFromProfile(profile, lojaId = "") {
  const selected = normalize(profile);
  return {
    papel: canonicalPapel(selected),
    loja_id: selected === "gerente_loja_1" ? "loja_1" : selected === "gerente_loja_2" ? "loja_2" : normalize(lojaId)
  };
}

function legacyRoleFromPapel(papel) {
  return LEGACY_ROLE_BY_PAPEL[canonicalPapel(papel)] || "gestor";
}

function userPapel(user) {
  return canonicalPapel(user?.papel || user?.role || user?.profile);
}

function papelLabel(papel) {
  return PAPEL_LABELS[canonicalPapel(papel)] || papel;
}

function normalizeUsuario(user) {
  const source = user || {};
  const fromProfile = source.profile ? papelFromProfile(source.profile, source.loja_id || source.storeId) : null;
  const papel = canonicalPapel(source.papel || fromProfile?.papel || source.role);
  const rawStatus = normalize(source.status).toUpperCase();
  const status = USER_STATUS.includes(rawStatus) ? rawStatus : (source.ativo === false || source.active === false ? "INATIVO" : "ATIVO");
  let lojaId = normalize(source.loja_id ?? source.storeId ?? fromProfile?.loja_id ?? "");
  if (["ADMINISTRADOR", "GESTOR_FINANCEIRO", "ESTOQUE"].includes(papel)) lojaId = "TODAS";
  if (["GERENTE_LOJA", "OPERADOR_CAIXA"].includes(papel) && (!lojaId || lojaId === "TODAS")) lojaId = "loja_1";
  const login = normalize(source.login || source.username).toLowerCase();
  const nome = normalize(source.nome || source.name);
  const senhaHash = source.senha_hash || source.passwordHash || passwordHash("123456");
  const criadoEm = source.criado_em || source.createdAt || nowIso();
  const usuario = {
    id: source.id || id("user"),
    nome,
    login,
    senha_hash: senhaHash,
    papel,
    loja_id: lojaId,
    ativo: status === "ATIVO",
    status,
    solicitado_em: source.solicitado_em || source.requestedAt || null,
    aprovado_por: source.aprovado_por || source.approvedBy || null,
    cargo_solicitado: normalize(source.cargo_solicitado || source.cargoSolicitado),
    justificativa_acesso: normalize(source.justificativa_acesso || source.justificativa),
    criado_em: criadoEm
  };
  return {
    ...usuario,
    name: usuario.nome,
    username: usuario.login,
    passwordHash: usuario.senha_hash,
    role: legacyRoleFromPapel(usuario.papel),
    storeId: usuario.loja_id === "TODAS" ? null : usuario.loja_id,
    active: usuario.ativo,
    createdAt: usuario.criado_em
  };
}

function usuarioRecord(user) {
  const normalized = normalizeUsuario(user);
  return {
    id: normalized.id,
    nome: normalized.nome,
    login: normalized.login,
    senha_hash: normalized.senha_hash,
    papel: normalized.papel,
    loja_id: normalized.loja_id,
    ativo: normalized.ativo,
    status: normalized.status,
    solicitado_em: normalized.solicitado_em,
    aprovado_por: normalized.aprovado_por,
    cargo_solicitado: normalized.cargo_solicitado,
    justificativa_acesso: normalized.justificativa_acesso,
    criado_em: normalized.criado_em
  };
}

function usuarioPayload(usuario) {
  const normalized = normalizeUsuario(usuario);
  const legacyRole = legacyRoleFromPapel(normalized.papel);
  return {
    id: normalized.id,
    nome: normalized.nome,
    name: normalized.nome,
    login: normalized.login,
    username: normalized.login,
    papel: normalized.papel,
    papelLabel: papelLabel(normalized.papel),
    role: legacyRole,
    loja_id: normalized.loja_id,
    storeId: normalized.loja_id === "TODAS" ? null : normalized.loja_id,
    profile: legacyRole,
    profileLabel: papelLabel(normalized.papel),
    ativo: normalized.ativo,
    active: normalized.ativo,
    status: normalized.status,
    solicitado_em: normalized.solicitado_em,
    aprovado_por: normalized.aprovado_por,
    cargo_solicitado: normalized.cargo_solicitado,
    justificativa_acesso: normalized.justificativa_acesso,
    criado_em: normalized.criado_em,
    createdAt: normalized.criado_em
  };
}

function publicUser(user) {
  if (!user) return null;
  const payload = usuarioPayload(user);
  return {
    id: payload.id,
    nome: payload.nome,
    name: payload.name,
    login: payload.login,
    username: payload.username,
    papel: payload.papel,
    papelLabel: payload.papelLabel,
    role: payload.role,
    loja_id: payload.loja_id,
    storeId: payload.storeId
  };
}

function userProfile(user) {
  return legacyRoleFromPapel(userPapel(user));
}

function userPayload(user) {
  return usuarioPayload(user);
}

function accessFromProfile(profile, lojaId = "") {
  const access = papelFromProfile(profile, lojaId);
  return { role: legacyRoleFromPapel(access.papel), storeId: access.loja_id === "TODAS" ? null : access.loja_id, papel: access.papel, loja_id: access.loja_id };
}

function validateUserAccess(db, access) {
  const papel = canonicalPapel(access.papel || access.role);
  let lojaId = normalize(access.loja_id || access.storeId || "");
  if (["GERENTE_LOJA", "OPERADOR_CAIXA"].includes(papel)) {
    if (!lojaId || lojaId === "TODAS") throw badRequest("Gerente de Loja e Operador de Caixa devem ter uma loja vinculada.");
    if (!db.lojas.some((loja) => loja.id === lojaId && loja.ativa !== false && loja.status !== "inativo")) throw badRequest("Loja vinculada inválida.");
  } else {
    lojaId = "TODAS";
  }
  return { papel, loja_id: lojaId, role: legacyRoleFromPapel(papel), storeId: lojaId === "TODAS" ? null : lojaId };
}

function normalizeUser(user) {
  return normalizeUsuario(user);
}

function syncUsuarios(db) {
  const source = Array.isArray(db.usuarios) && db.usuarios.length ? db.usuarios : Array.isArray(db.users) ? db.users : seedData().users;
  db.usuarios = source.map(usuarioRecord);
  db.users = db.usuarios.map(normalizeUsuario);
}

function normalizeAppUrl(value) {
  return String(value || "").replace(/\/+$/, "") || "http://localhost:3000";
}

function invitationExpiresAt(hours = INVITE_EXPIRATION_HOURS) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function normalizeConvite(invite) {
  const source = invite || {};
  const token = normalize(source.token) || crypto.randomBytes(32).toString("hex");
  const createdAt = source.criado_em || source.createdAt || nowIso();
  return {
    id: source.id || id("conv"),
    nome: normalize(source.nome || source.name),
    email: normalize(source.email).toLowerCase(),
    papel: canonicalPapel(source.papel || source.role),
    loja_id: normalize(source.loja_id || source.storeId || "TODAS"),
    token,
    status: normalize(source.status || "PENDENTE").toUpperCase(),
    expira_em: source.expira_em || source.expiresAt || invitationExpiresAt(),
    criado_em: createdAt,
    criado_por: source.criado_por || source.createdBy || null,
    enviado_em: source.enviado_em || source.sentAt || null,
    revogado_em: source.revogado_em || null,
    concluido_em: source.concluido_em || null
  };
}

function syncConvites(db) {
  db.convites = Array.isArray(db.convites) ? db.convites.map(normalizeConvite) : [];
}

function convitePayload(invite) {
  const normalized = normalizeConvite(invite);
  return {
    ...normalized,
    activationLink: activationLink(normalized.token),
    papelLabel: papelLabel(normalized.papel),
    expirado: conviteExpired(normalized)
  };
}

function conviteExpired(invite) {
  return new Date(invite.expira_em).getTime() <= Date.now();
}

function findPendingInviteByToken(db, token) {
  const invite = db.convites.find((item) => item.token === normalize(token));
  if (!invite || invite.status !== "PENDENTE" || conviteExpired(invite)) return null;
  return invite;
}

function activationLink(token) {
  return `${APP_URL}/ativar-conta?token=${encodeURIComponent(token)}`;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(email));
}

async function sendInviteEmail(invite) {
  const emailResult = await enviarEmailConvite({
    nome: invite.nome,
    email: invite.email,
    papel: papelLabel(invite.papel),
    loja: invite.loja_id === "TODAS" ? "Todas as Unidades" : invite.loja_id,
    token: invite.token
  });
  if (emailResult.sent) invite.enviado_em = nowIso();
  return emailResult;
}

function maxSaleCode(db) {
  return (db.sales || []).reduce((max, sale) => Math.max(max, Number(normalizeSaleCode(sale.codigo_venda)) || 0), 0);
}

function defaultCompanySettings(stores = []) {
  const lojaSettings = {};
  for (const store of stores) {
    lojaSettings[store.id] = {
      nome: store.name || store.nome || "",
      logradouro: store.address || "",
      bairro: "",
      cidade: ""
    };
  }
  return {
    marca_principal: "Rede de Móveis e Colchões",
    razao_social: "",
    cnpj: "",
    inscricao_estadual: "",
    telefone_whatsapp: "",
    bot_api_key: "",
    lojas: lojaSettings,
    proximo_numero_pedido: SALE_CODE_BASE + 1,
    mensagem_rodape_garantia: "Garantia conforme legislação vigente. Confira os produtos no ato da entrega.",
    exibir_assinatura_cliente: true
  };
}

function normalizeCompanySettings(db, settings = {}) {
  const defaults = defaultCompanySettings(db.stores || []);
  const source = settings || {};
  const stores = {};
  for (const store of db.stores || []) {
    const current = source.lojas?.[store.id] || {};
    stores[store.id] = {
      nome: normalize(current.nome || store.name),
      logradouro: normalize(current.logradouro || store.endereco?.logradouro || store.address),
      bairro: normalize(current.bairro || store.endereco?.bairro),
      cidade: normalize(current.cidade || store.endereco?.cidade)
    };
  }
  const nextNumber = Number(source.proximo_numero_pedido || 0);
  return {
    marca_principal: normalize(source.marca_principal || source.nome_fantasia || defaults.marca_principal),
    razao_social: normalize(source.razao_social),
    cnpj: normalize(source.cnpj),
    inscricao_estadual: normalize(source.inscricao_estadual),
    telefone_whatsapp: normalize(source.telefone_whatsapp),
    bot_api_key: normalize(source.bot_api_key),
    lojas: stores,
    proximo_numero_pedido: Math.max(SALE_CODE_BASE + 1, maxSaleCode(db) + 1, Number.isInteger(nextNumber) ? nextNumber : 0),
    mensagem_rodape_garantia: normalize(source.mensagem_rodape_garantia || defaults.mensagem_rodape_garantia),
    exibir_assinatura_cliente: source.exibir_assinatura_cliente !== false
  };
}

function requireRole(user, roles) {
  const allowedPapeis = roles.map(canonicalPapel);
  if (!allowedPapeis.includes(userPapel(user))) throw forbidden();
}

function allowedStoreIds(db, user) {
  if (["ADMINISTRADOR", "GESTOR_FINANCEIRO", "ESTOQUE"].includes(userPapel(user)) || user.loja_id === "TODAS") return activeLojaIds(db);
  const lojaId = user.loja_id || user.storeId;
  return activeLojaIds(db).includes(lojaId) ? [lojaId] : [];
}

function visibleStores(db, user) {
  const allowedIds = allowedStoreIds(db, user);
  return db.stores.filter((store) => allowedIds.includes(store.id) && store.ativa !== false && store.status !== "inativo");
}

function assertStoreAccess(db, user, storeId) {
  if (!db.lojas.some((loja) => loja.id === storeId && loja.ativa !== false && loja.status !== "inativo")) throw badRequest("Loja inválida.");
  if (!allowedStoreIds(db, user).includes(storeId)) throw forbidden("Este perfil não pode operar esta loja.");
}

function findActiveProduct(db, productId) {
  const product = db.products.find((item) => item.id === productId && item.active !== false);
  if (!product) throw badRequest("Produto inexistente ou inativo.");
  return product;
}

function findActiveCustomer(db, customerId) {
  const customer = db.customers.find((item) => item.id === customerId && item.active !== false);
  if (!customer) throw badRequest("Cliente inexistente ou inativo.");
  return customer;
}

function migrateData(db) {
  const seededStores = seedData().stores;
  const lojaSource = Array.isArray(db.lojas) && db.lojas.length ? db.lojas : Array.isArray(db.stores) ? db.stores.map(legacyStoreToLoja) : seededStores.map(legacyStoreToLoja);
  db.lojas = lojaSource.map(normalizeLoja);
  db.stores = db.lojas.map(lojaToStore);
  syncUsuarios(db);
  syncConvites(db);
  db.fornecedores = Array.isArray(db.fornecedores) ? db.fornecedores.map((supplier) => normalizeFornecedor(supplier)) : [];
  db.ordens_compra = Array.isArray(db.ordens_compra) ? db.ordens_compra.map(normalizePurchaseOrder) : [];
  db.itens_ordem_compra = Array.isArray(db.itens_ordem_compra) ? db.itens_ordem_compra.map(normalizePurchaseItem) : [];
  db.contas_a_pagar = Array.isArray(db.contas_a_pagar) ? db.contas_a_pagar : [];
  migrateVendedores(db);
  db.customers = Array.isArray(db.customers) ? db.customers.map((customer) => normalizeCustomer(customer)) : [];
  db.sales = Array.isArray(db.sales) ? db.sales.map((sale) => normalizeSaleRecord(sale)) : [];
  migrateSaleCodes(db);
  migrateSaleReferences(db);
  db.stock = Array.isArray(db.stock) ? db.stock : [];
  db.stockMovements = Array.isArray(db.stockMovements) ? db.stockMovements : [];
  db.movimentacoes_estoque = Array.isArray(db.movimentacoes_estoque) ? db.movimentacoes_estoque : [];
  db.sessoes_caixa = Array.isArray(db.sessoes_caixa) ? db.sessoes_caixa.map(normalizeCashSession) : [];
  db.kanban_entregas_colunas = (Array.isArray(db.kanban_entregas_colunas) && db.kanban_entregas_colunas.length
    ? db.kanban_entregas_colunas
    : structuredClone(DEFAULT_DELIVERY_KANBAN_COLUMNS))
    .map((column, index) => ({ id: String(column.id || id("delivery_col")), title: normalize(column.title) || "Nova etapa", slug: normalize(column.slug || column.status).toLowerCase().replace(/[\s-]+/g, "_"), order: Number(column.order ?? column.position ?? index + 1) }))
    .filter((column) => column.slug)
    .sort((a, b) => a.order - b.order)
    .map((column, index) => ({ ...column, order: index + 1 }));
  const needsMigration = db.stock.some((row) => Object.prototype.hasOwnProperty.call(row, "storeId"));
  const legacyStock = new Map();
  if (needsMigration) {
    for (const row of db.stock) {
      const current = legacyStock.get(row.productId) || { saldo_deposito: 0, showroom_loja1: 0, showroom_loja2: 0 };
      // Saldo legado por loja era o saldo vendável. Na nova regra, preservamos esse saldo no depósito central.
      current.saldo_deposito += Number(row.quantity || 0);
      legacyStock.set(row.productId, current);
    }
  }
  for (const product of db.products || []) {
    normalizeProductData(db, product);
    const migrated = legacyStock.get(product.id);
    if (migrated && product.saldo_deposito === undefined && product.showroom_loja1 === undefined && product.showroom_loja2 === undefined) {
      product.saldo_deposito = migrated.saldo_deposito;
      product.showroom_loja1 = migrated.showroom_loja1;
      product.showroom_loja2 = migrated.showroom_loja2;
    }
    product.__lojas = db.lojas;
    normalizeProductStock(product);
  }
  db.stock = [];
  db.stockMovements = db.stockMovements.map((movement) => normalizeStockMovement(movement));
  migrateStockAuditFromLegacy(db);
  db.movimentacoes_estoque = db.movimentacoes_estoque.map((movement) => normalizeStockAuditMovement(movement));
  db.configuracoes_empresa = normalizeCompanySettings(db, db.configuracoes_empresa);
}

function normalizeCashSession(session) {
  return {
    id: session.id || id("cx"),
    loja_id: normalize(session.loja_id || session.storeId),
    operador_id: normalize(session.operador_id || session.operatorId),
    data_abertura: session.data_abertura || session.openedAt || nowIso(),
    saldo_inicial_troco: money(Number(session.saldo_inicial_troco ?? session.openingCash ?? 0)),
    data_fechamento: session.data_fechamento || session.closedAt || null,
    status: session.status === "fechado" ? "fechado" : "aberto",
    valores_declarados: session.valores_declarados || {},
    valores_sistema: session.valores_sistema || {},
    diferenca: money(Number(session.diferenca || 0))
  };
}

function currentCashSession(db, lojaId, date = todayDate()) {
  return (db.sessoes_caixa || [])
    .find((session) => {
      const normalized = normalizeCashSession(session);
      return normalized.loja_id === lojaId && normalized.status === "aberto" && String(normalized.data_abertura).slice(0, 10) === date;
    });
}

function openCashSession(db, lojaId) {
  return (db.sessoes_caixa || [])
    .filter((session) => {
      const normalized = normalizeCashSession(session);
      return normalized.loja_id === lojaId && normalized.status === "aberto";
    })
    .sort((a, b) => String(b.data_abertura).localeCompare(String(a.data_abertura)))[0] || null;
}

function cashSessionMovements(db, session) {
  const openedAt = new Date(session.data_abertura).getTime();
  const closedAt = session.data_fechamento ? new Date(session.data_fechamento).getTime() : Infinity;
  return (db.cashMovements || []).filter((movement) => {
    const createdAt = new Date(movement.createdAt || `${movement.date}T00:00:00.000Z`).getTime();
    return movement.storeId === session.loja_id && createdAt >= openedAt && createdAt <= closedAt;
  });
}

function cashSystemTotals(db, session) {
  const totals = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));
  totals.dinheiro = money(Number(session.saldo_inicial_troco || 0));
  for (const movement of cashSessionMovements(db, session)) {
    const method = movement.paymentMethod || movement.metodo || "dinheiro";
    if (!totals[method]) totals[method] = 0;
    totals[method] = money(totals[method] + (movement.type === "entrada" ? movement.value : -movement.value));
  }
  return totals;
}

function cashTotal(values = {}) {
  return money(Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0));
}

function cashSessionPayload(db, session) {
  const normalized = normalizeCashSession(session);
  return {
    ...normalized,
    loja_nome: lojaNameById(db, normalized.loja_id),
    operador_nome: db.users.find((user) => user.id === normalized.operador_id)?.name || "Operador"
  };
}

function migrateSaleCodes(db) {
  const used = new Set((db.sales || []).map((sale) => normalizeSaleCode(sale.codigo_venda || sale.saleCode)).filter(Boolean).map(String));
  let nextSequence = Math.max(0, ...(db.sales || []).map((sale) => saleCodeSequence(sale.codigo_venda || sale.saleCode))) + 1;
  for (const sale of db.sales || []) {
    sale.codigo_venda = normalizeSaleCode(sale.codigo_venda || sale.saleCode);
    if (sale.codigo_venda) continue;
    let code = formatSaleCode(nextSequence);
    while (used.has(String(code))) {
      nextSequence += 1;
      code = formatSaleCode(nextSequence);
    }
    sale.codigo_venda = code;
    used.add(String(code));
    nextSequence += 1;
  }
}

function migrateSaleReferences(db) {
  for (const movement of db.cashMovements || []) {
    movement.description = numericSaleReference(movement.description);
  }
  for (const movement of db.movimentacoes_estoque || []) {
    movement.referencia = numericSaleReference(movement.referencia);
  }
}

function storeLabelFromId(storeId) {
  if (storeId === "loja_1") return "Loja 1";
  if (storeId === "loja_2") return "Loja 2";
  const suffix = String(storeId || "").match(/^loja[_-](\d+)$/);
  if (suffix) return `Loja ${suffix[1]}`;
  return "Ambas";
}

function sellerStoreMatches(db, vendedor, storeId) {
  return vendedor.loja_padrao === "Ambas"
    || vendedor.loja_id === storeId
    || vendedor.storeId === storeId
    || vendedor.loja_padrao === lojaNameById(db, storeId)
    || vendedor.loja_padrao === storeLabelFromId(storeId);
}

function normalizeFornecedor(supplier) {
  return {
    id: supplier.id || id("forn"),
    razao_social: normalize(supplier.razao_social || supplier.razaoSocial),
    nome_fantasia: normalize(supplier.nome_fantasia || supplier.nomeFantasia),
    cnpj: normalize(supplier.cnpj),
    contato_nome: normalize(supplier.contato_nome || supplier.contato_representante || supplier.contatoRepresentante),
    contato_representante: normalize(supplier.contato_nome || supplier.contato_representante || supplier.contatoRepresentante),
    telefone: normalize(supplier.telefone || supplier.phone),
    email: normalize(supplier.email),
    condicoes_pagamento_padrao: normalize(supplier.condicoes_pagamento_padrao || supplier.condicoesPagamentoPadrao),
    ativo: supplier.ativo === undefined ? supplier.active !== false : Boolean(supplier.ativo),
    criado_em: supplier.criado_em || supplier.createdAt || nowIso()
  };
}

function fornecedorPayload(supplier) {
  return normalizeFornecedor(supplier);
}

function findFornecedor(db, supplierId, { requireActive = false } = {}) {
  const supplier = db.fornecedores.find((item) => item.id === supplierId);
  if (!supplier) return null;
  if (requireActive && supplier.ativo === false) return null;
  return supplier;
}

function normalizePurchaseItem(item) {
  const ordered = Number(item.quantidade_pedida ?? item.quantity ?? 0);
  const received = Number(item.quantidade_recebida ?? item.receivedQuantity ?? 0);
  const cost = money(numberOrZero(item.custo_unitario ?? item.unitCost));
  const plannedCost = money(numberOrZero(item.custo_planejado ?? item.plannedUnitCost ?? cost));
  const receivedValue = money(numberOrZero(item.valor_recebido ?? item.receivedValue ?? received * cost));
  return {
    id: item.id || id("oci"),
    ordem_id: normalize(item.ordem_id || item.orderId),
    produto_id: normalize(item.produto_id || item.productId),
    quantidade_pedida: Number.isInteger(ordered) && ordered >= 0 ? ordered : 0,
    quantidade_recebida: Number.isInteger(received) && received >= 0 ? received : 0,
    custo_unitario: cost,
    custo_planejado: plannedCost,
    valor_recebido: receivedValue,
    subtotal: money(numberOrZero(item.subtotal ?? receivedValue + Math.max(0, ordered - received) * plannedCost))
  };
}

function normalizePurchaseOrder(order) {
  const status = normalize(order.status || "RASCUNHO").toUpperCase();
  return {
    id: normalize(order.id),
    fornecedor_id: normalize(order.fornecedor_id || order.supplierId),
    loja_id: normalize(order.loja_id || order.storeId),
    data_emissao: normalize(order.data_emissao || order.issueDate || todayDate()),
    previsao_entrega: normalize(order.previsao_entrega || order.expectedDelivery),
    status: PURCHASE_ORDER_STATUS.includes(status) ? status : "RASCUNHO",
    valor_produtos: money(numberOrZero(order.valor_produtos || order.productTotal)),
    valor_frete: money(numberOrZero(order.valor_frete || order.freight)),
    valor_total: money(numberOrZero(order.valor_total || order.total)),
    condicao_pagamento: normalize(order.condicao_pagamento || order.paymentTerms),
    observacoes: normalize(order.observacoes || order.notes),
    recebido_em: order.recebido_em || order.receivedAt || null,
    criado_por: normalize(order.criado_por || order.createdBy),
    criado_em: order.criado_em || order.createdAt || nowIso(),
    atualizado_em: order.atualizado_em || order.updatedAt || nowIso(),
    financeiro_gerado_em: order.financeiro_gerado_em || null
  };
}

function nextPurchaseOrderId(db) {
  const sequence = (db.ordens_compra || []).reduce((max, order) => {
    const match = String(order.id || "").match(/^OC-(\d+)$/i);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 1000) + 1;
  return `OC-${sequence}`;
}

function purchaseOrderItems(db, orderId) {
  return (db.itens_ordem_compra || []).filter((item) => item.ordem_id === orderId);
}

function recalculatePurchaseOrderTotals(db, order) {
  const items = purchaseOrderItems(db, order.id);
  order.valor_produtos = money(items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
  order.valor_total = money(order.valor_produtos + Number(order.valor_frete || 0));
}

function purchaseOrderPayload(db, order) {
  const supplier = findFornecedor(db, order.fornecedor_id);
  const items = purchaseOrderItems(db, order.id).map((item) => {
    const product = db.products.find((row) => row.id === item.produto_id);
    return {
      ...item,
      produto_nome: product?.name || "Produto",
      sku: product?.sku || "",
      quantidade_pendente: Math.max(0, item.quantidade_pedida - item.quantidade_recebida)
    };
  });
  return {
    ...order,
    fornecedor_nome: supplier?.nome_fantasia || supplier?.razao_social || "Fornecedor",
    itens: items
  };
}

function addDays(dateValue, days) {
  const baseDate = String(dateValue || todayDate()).slice(0, 10);
  const date = new Date(`${baseDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function paymentDueDays(terms) {
  const normalized = normalize(terms).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!normalized || normalized.includes("a vista")) return [0];
  const days = [...normalized.matchAll(/\d+/g)].map((match) => Number(match[0])).filter((value) => value >= 0);
  if (normalized.includes("entrada")) return [0, ...days.filter((value) => value > 0)];
  return days.length ? [...new Set(days)] : [30];
}

function createPurchasePayables(db, order) {
  if (order.financeiro_gerado_em) return [];
  const supplier = findFornecedor(db, order.fornecedor_id);
  const dueDays = paymentDueDays(order.condicao_pagamento);
  const totalCents = Math.round(order.valor_total * 100);
  const baseCents = Math.floor(totalCents / dueDays.length);
  let allocated = 0;
  const payables = dueDays.map((days, index) => {
    const cents = index === dueDays.length - 1 ? totalCents - allocated : baseCents;
    allocated += cents;
    return {
      id: id("cp"),
      ordem_id: order.id,
      fornecedor_id: order.fornecedor_id,
      loja_id: order.loja_id,
      storeId: order.loja_id,
      fornecedor: supplier?.nome_fantasia || supplier?.razao_social || "Fornecedor",
      numero_parcela: index + 1,
      total_parcelas: dueDays.length,
      valor: money(cents / 100),
      data_vencimento: addDays(order.recebido_em || todayDate(), days),
      status: "pendente",
      referencia: `Ordem de compra ${order.id}`,
      criado_em: nowIso()
    };
  });
  db.contas_a_pagar.push(...payables);
  order.financeiro_gerado_em = nowIso();
  return payables;
}

function normalizeKitComponents(rawComponents, productId = "") {
  const components = Array.isArray(rawComponents) ? rawComponents : [];
  return components
    .map((component) => ({
      produto_id: normalize(component.produto_id || component.productId),
      quantidade: Number(component.quantidade ?? component.quantity ?? 0)
    }))
    .filter((component) => component.produto_id && component.produto_id !== productId && Number.isFinite(component.quantidade) && component.quantidade > 0);
}

function normalizeProductData(db, product) {
  const supplierId = normalize(product.fornecedor_id || product.supplierId || product.supplier_id);
  const supplier = supplierId ? findFornecedor(db, supplierId) : null;
  const supplierName = normalize(supplier?.nome_fantasia || product.fornecedor_nome || product.brandModel);
  const priceTable = money(numberOrZero(product.preco_tabela ?? product.salePrice));
  const directCost = money(numberOrZero(product.preco_custo ?? product.custo_unitario ?? product.custo_direto ?? product.costPrice));
  const minPrice = money(numberOrZero(product.preco_minimo ?? product.minPrice));
  product.fornecedor_id = supplierId;
  product.supplierId = supplierId;
  product.fornecedor_nome = supplierName;
  product.brandModel = supplierName;
  product.preco_tabela = priceTable;
  product.preco_minimo = minPrice;
  product.custo_direto = directCost;
  product.preco_custo = directCost;
  product.custo_unitario = directCost;
  product.salePrice = priceTable;
  product.costPrice = directCost;
  product.estoque_minimo = toNonNegativeInteger(product.estoque_minimo ?? product.minStock ?? 0, "Estoque mínimo");
  product.minStock = product.estoque_minimo;
  product.tamanho_padrao = normalize(product.tamanho_padrao || product.standardSize);
  product.largura_cm = money(numberOrZero(product.largura_cm ?? product.widthCm));
  product.comprimento_cm = money(numberOrZero(product.comprimento_cm ?? product.lengthCm));
  product.altura_cm = money(numberOrZero(product.altura_cm ?? product.heightCm));
  product.produto_kit = Boolean(product.produto_kit ?? product.isKit);
  product.isKit = product.produto_kit;
  product.componentes_kit = normalizeKitComponents(product.componentes_kit || product.kitComponents, product.id);
  product.kitComponents = product.componentes_kit.map((component) => ({
    productId: component.produto_id,
    quantity: component.quantidade
  }));
  return product;
}

function productFromBody(db, body, existing = {}) {
  const supplierId = body.fornecedor_id === undefined ? existing.fornecedor_id : normalize(body.fornecedor_id);
  const supplier = supplierId ? findFornecedor(db, supplierId, { requireActive: true }) : null;
  const product = {
    ...existing,
    name: body.name === undefined ? existing.name : normalize(body.name),
    category: body.category === undefined ? existing.category : normalize(body.category),
    sku: body.sku === undefined ? existing.sku : normalize(body.sku).toUpperCase(),
    fornecedor_id: supplierId || "",
    fornecedor_nome: supplier?.nome_fantasia || existing.fornecedor_nome || normalize(body.brandModel),
    brandModel: supplier?.nome_fantasia || existing.brandModel || normalize(body.brandModel),
    preco_tabela: body.preco_tabela === undefined && body.salePrice === undefined
      ? existing.preco_tabela ?? existing.salePrice
      : money(toPositiveNumber(body.preco_tabela ?? body.salePrice, "Preço de tabela")),
    preco_minimo: body.preco_minimo === undefined
      ? existing.preco_minimo ?? existing.minPrice ?? 0
      : money(toNonNegativeNumber(body.preco_minimo, "Preço mínimo")),
    custo_direto: body.custo_direto === undefined && body.costPrice === undefined
      ? existing.custo_direto ?? existing.costPrice
      : money(toNonNegativeNumber(body.custo_direto ?? body.costPrice, "Custo direto")),
    minStock: body.minStock === undefined && body.estoque_minimo === undefined ? existing.estoque_minimo ?? existing.minStock ?? 0 : toNonNegativeInteger(body.estoque_minimo ?? body.minStock, "Estoque mínimo"),
    tamanho_padrao: body.tamanho_padrao === undefined ? existing.tamanho_padrao || "" : normalize(body.tamanho_padrao),
    largura_cm: body.largura_cm === undefined ? existing.largura_cm ?? 0 : money(toNonNegativeNumber(body.largura_cm, "Largura")),
    comprimento_cm: body.comprimento_cm === undefined ? existing.comprimento_cm ?? 0 : money(toNonNegativeNumber(body.comprimento_cm, "Comprimento")),
    altura_cm: body.altura_cm === undefined ? existing.altura_cm ?? 0 : money(toNonNegativeNumber(body.altura_cm, "Altura")),
    produto_kit: body.produto_kit === undefined ? Boolean(existing.produto_kit) : Boolean(body.produto_kit),
    componentes_kit: body.componentes_kit === undefined ? existing.componentes_kit || [] : normalizeKitComponents(body.componentes_kit, existing.id),
    active: body.active === undefined ? existing.active !== false : Boolean(body.active)
  };
  normalizeProductData(db, product);
  if (product.preco_minimo > product.preco_tabela) throw badRequest("Preço mínimo não pode superar o preço de tabela.");
  if (supplierId && !supplier) throw badRequest("Fornecedor inválido ou inativo.");
  if (!supplierId && !product.brandModel) throw badRequest("Fornecedor é obrigatório.");
  if (product.produto_kit && !product.componentes_kit.length) throw badRequest("Produto kit deve ter ao menos um componente.");
  return product;
}

function migrateVendedores(db) {
  const legacy = Array.isArray(db.sellers) ? db.sellers : [];
  db.vendedores = Array.isArray(db.vendedores) ? db.vendedores : [];
  if (!db.vendedores.length && legacy.length) {
    db.vendedores = legacy.map((seller) => ({
      id: seller.id,
      nome: seller.name,
      loja_id: seller.storeId,
      loja_padrao: storeLabelFromId(seller.storeId),
      telefone: seller.phone || "",
      ativo: seller.active !== false,
      criado_em: seller.createdAt || nowIso()
    }));
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
  db.vendedores = db.vendedores.map((seller) => normalizeVendedor(seller, db));
  for (const sale of db.sales || []) {
    if (!sale.sellerName) {
      sale.sellerName = db.vendedores.find((seller) => seller.id === sale.sellerId)?.nome || "";
    }
    if (!sale.vendedorId) sale.vendedorId = sale.sellerId;
    if (!sale.vendedorNome) sale.vendedorNome = sale.sellerName;
  }
  delete db.sellers;
}

function normalizeVendedor(seller, db = null) {
  const rawLojaId = normalize(seller.loja_id || seller.storeId);
  const rawLojaPadrao = normalize(seller.loja_padrao || seller.storeName);
  let lojaId = rawLojaId;
  if (db && lojaId && lojaId !== "Ambas" && !(db.lojas || []).some((loja) => loja.id === lojaId)) {
    lojaId = (db.lojas || []).find((loja) => loja.nome === lojaId || loja.name === lojaId || storeLabelFromId(loja.id) === lojaId)?.id || lojaId;
  }
  if (!lojaId && db && rawLojaPadrao && rawLojaPadrao !== "Ambas") {
    lojaId = (db.lojas || []).find((loja) => loja.nome === rawLojaPadrao || loja.name === rawLojaPadrao || storeLabelFromId(loja.id) === rawLojaPadrao)?.id || "";
  }
  if (lojaId === "Ambas") lojaId = "";
  const loja = db ? (db.lojas || []).find((item) => item.id === lojaId) : null;
  const lojaPadrao = rawLojaPadrao === "Ambas" ? "Ambas" : loja?.nome || rawLojaPadrao || storeLabelFromId(lojaId);
  return {
    id: seller.id || id("vend"),
    nome: normalize(seller.nome || seller.name),
    loja_id: lojaPadrao === "Ambas" ? "" : lojaId,
    storeId: lojaPadrao === "Ambas" ? null : lojaId,
    loja_padrao: lojaPadrao,
    telefone: normalize(seller.telefone || seller.phone),
    bot_auth_code: normalize(seller.bot_auth_code),
    bot_code_expires_at: seller.bot_code_expires_at || null,
    whatsapp_phone: normalize(seller.whatsapp_phone),
    ativo: seller.ativo === undefined ? seller.active !== false : Boolean(seller.ativo),
    criado_em: seller.criado_em || seller.createdAt || nowIso()
  };
}

function vendedorPayload(seller, db = null) {
  return normalizeVendedor(seller, db);
}

function findActiveVendedor(db, sellerId) {
  const seller = db.vendedores.find((item) => item.id === sellerId && item.ativo !== false);
  if (!seller) throw badRequest("Vendedor inválido ou inativo.");
  return seller;
}

function pickText(body, existing, fields) {
  for (const field of fields) {
    if (body[field] !== undefined) return normalize(body[field]);
  }
  for (const field of fields) {
    if (existing[field] !== undefined) return normalize(existing[field]);
  }
  return "";
}

function customerName(customer) {
  return normalize(customer.nome || customer.name);
}

function customerPhone(customer) {
  return normalize(customer.telefone || customer.phone);
}

function formatCustomerAddress(customer) {
  const logradouro = normalize(customer.logradouro || customer.endereco || customer.address);
  const numero = normalize(customer.numero);
  const complemento = normalize(customer.complemento);
  const bairro = normalize(customer.bairro);
  const referencia = normalize(customer.referencia);
  const main = [logradouro, numero ? `Nº ${numero}` : "", complemento].filter(Boolean).join(", ");
  const bairroPart = bairro ? ` - ${bairro}` : "";
  const refPart = referencia ? ` (Ref: ${referencia})` : "";
  return `${main}${bairroPart}${refPart}`.trim();
}

function normalizeCustomer(customer) {
  const normalized = {
    id: customer.id || id("cli"),
    nome: normalize(customer.nome || customer.name),
    cpf_cnpj: normalize(customer.cpf_cnpj),
    telefone: normalize(customer.telefone || customer.phone),
    telefone_secundario: normalize(customer.telefone_secundario),
    email: normalize(customer.email),
    cep: normalize(customer.cep),
    logradouro: normalize(customer.logradouro || customer.endereco || customer.address),
    numero: normalize(customer.numero),
    complemento: normalize(customer.complemento),
    bairro: normalize(customer.bairro),
    cidade: normalize(customer.cidade),
    referencia: normalize(customer.referencia),
    ativo: customer.ativo === undefined ? customer.active !== false : Boolean(customer.ativo),
    createdAt: customer.createdAt || customer.criado_em || nowIso(),
    updatedAt: customer.updatedAt || nowIso()
  };
  normalized.name = normalized.nome;
  normalized.phone = normalized.telefone;
  normalized.address = formatCustomerAddress(normalized);
  normalized.active = normalized.ativo;
  return normalized;
}

function customerFromBody(body, existing = {}) {
  const activeValue = body.ativo !== undefined ? body.ativo : body.active !== undefined ? body.active : existing.ativo ?? existing.active ?? true;
  return normalizeCustomer({
    ...existing,
    nome: pickText(body, existing, ["nome", "name"]),
    cpf_cnpj: pickText(body, existing, ["cpf_cnpj"]),
    telefone: pickText(body, existing, ["telefone", "phone"]),
    telefone_secundario: pickText(body, existing, ["telefone_secundario"]),
    email: pickText(body, existing, ["email"]),
    cep: pickText(body, existing, ["cep"]),
    logradouro: pickText(body, existing, ["logradouro", "endereco", "address"]),
    numero: pickText(body, existing, ["numero"]),
    complemento: pickText(body, existing, ["complemento"]),
    bairro: pickText(body, existing, ["bairro"]),
    cidade: pickText(body, existing, ["cidade"]),
    referencia: pickText(body, existing, ["referencia"]),
    ativo: Boolean(activeValue)
  });
}

function normalizeSaleItem(item) {
  const productId = item.productId || item.produto_id;
  const quantity = Number(item.quantity ?? item.quantidade ?? 0);
  const unitPrice = money(Number(item.unitPrice ?? item.preco_unitario ?? 0));
  const total = money(Number(item.total ?? item.subtotal ?? unitPrice * quantity));
  return {
    productId,
    produto_id: productId,
    name: normalize(item.name || item.nome),
    nome: normalize(item.nome || item.name),
    sku: normalize(item.sku),
    quantity,
    quantidade: quantity,
    unitPrice,
    preco_unitario: unitPrice,
    total,
    subtotal: total
  };
}

function normalizeSalePayment(payment) {
  const metodo = normalize(payment.metodo || payment.method || payment.paymentMethod);
  const valor = money(Number(payment.valor ?? payment.value ?? 0));
  const parcelas = Math.max(1, Number(payment.parcelas || payment.installments || 1));
  return {
    metodo,
    method: metodo,
    valor,
    value: valor,
    parcelas: Number.isInteger(parcelas) ? parcelas : 1
  };
}

function salePayments(sale) {
  const payments = Array.isArray(sale.pagamentos) ? sale.pagamentos : Array.isArray(sale.payments) ? sale.payments : [];
  const normalized = payments.map(normalizeSalePayment).filter((payment) => payment.metodo && payment.valor > 0);
  if (normalized.length) return normalized;
  const method = sale.paymentMethod || "sem_pagamento";
  const total = Number(sale.valor_total ?? sale.total ?? 0);
  return total > 0 ? [normalizeSalePayment({ metodo: method, valor: total })] : [];
}

function effectiveSalePayments(sale) {
  let remainingChange = Number(sale.troco || 0);
  return salePayments(sale).map((payment) => {
    let value = payment.valor;
    if (payment.metodo === "dinheiro" && remainingChange > 0) {
      const discount = Math.min(value, remainingChange);
      value = money(value - discount);
      remainingChange = money(remainingChange - discount);
    }
    return { ...payment, valor: value, value };
  }).filter((payment) => payment.valor > 0);
}

function validateSalePayments(body, total) {
  const raw = Array.isArray(body.pagamentos) ? body.pagamentos : Array.isArray(body.payments) ? body.payments : [];
  const payments = raw.length
    ? raw.map(normalizeSalePayment).filter((payment) => payment.metodo && payment.valor > 0)
    : [normalizeSalePayment({ metodo: body.paymentMethod, valor: total })].filter((payment) => payment.metodo && payment.valor > 0);
  if (!payments.length) throw badRequest("Informe ao menos uma forma de pagamento.");
  for (const payment of payments) {
    if (!PAYMENT_METHODS.includes(payment.metodo)) throw badRequest("Forma de pagamento inválida.");
  }
  const totalPaid = money(payments.reduce((sum, payment) => sum + payment.valor, 0));
  if (totalPaid < total) throw badRequest("O total pago deve cobrir 100% do valor final da venda.");
  const troco = money(totalPaid - total);
  return { payments, totalPaid, troco };
}

function normalizeSaleRecord(sale) {
  const items = Array.isArray(sale.items) ? sale.items : Array.isArray(sale.itens) ? sale.itens : [];
  const normalizedItems = items.map((item) => normalizeSaleItem(item));
  const grossTotal = money(Number(sale.totalBruto ?? sale.valor_bruto ?? normalizedItems.reduce((sum, item) => sum + item.total, 0)));
  const discount = money(Number(sale.desconto_adicional ?? sale.discount ?? 0));
  const total = money(Number(sale.valor_total ?? sale.total ?? Math.max(0, grossTotal - discount)));
  return {
    ...sale,
    codigo_venda: normalizeSaleCode(sale.codigo_venda || sale.saleCode),
    status: normalize(sale.status || "CONCLUIDA"),
    items: normalizedItems,
    itens: normalizedItems.map((item) => ({
      produto_id: item.productId,
      nome: item.name,
      quantidade: item.quantity,
      preco_unitario: item.unitPrice,
      subtotal: item.total
    })),
    totalBruto: grossTotal,
    valor_bruto: grossTotal,
    desconto_adicional: discount,
    discount,
    total,
    valor_total: total,
    pagamentos: salePayments({ ...sale, total, valor_total: total }),
    payments: salePayments({ ...sale, total, valor_total: total }).map((payment) => ({
      method: payment.metodo,
      value: payment.valor,
      installments: payment.parcelas
    })),
    total_pago: money(Number(sale.total_pago ?? sale.totalPaid ?? total)),
    troco: money(Number(sale.troco ?? sale.change ?? 0))
  };
}

function normalizeProductStock(product) {
  product.saldo_deposito = toNonNegativeInteger(product.saldo_deposito || 0, "Saldo do depósito");
  const showrooms = product.showrooms && typeof product.showrooms === "object" ? { ...product.showrooms } : {};
  if (showrooms.loja_1 === undefined) showrooms.loja_1 = product.showroom_loja1 || 0;
  if (showrooms.loja_2 === undefined) showrooms.loja_2 = product.showroom_loja2 || 0;
  product.showrooms = {};
  for (const loja of product.__lojas || []) {
    product.showrooms[loja.id] = toNonNegativeInteger(showrooms[loja.id] || 0, `Showroom ${loja.nome || loja.name}`);
  }
  delete product.__lojas;
  product.showroom_loja1 = product.showrooms.loja_1 || 0;
  product.showroom_loja2 = product.showrooms.loja_2 || 0;
  return product;
}

function normalizeStockMovement(movement) {
  const normalized = { ...movement };
  if (normalized.type === "transferencia") {
    normalized.type = "envio_showroom";
    normalized.storeId = normalized.toStoreId || normalized.fromStoreId || null;
    normalized.reason = normalized.reason || "Migração de transferência legada para showroom";
  }
  if (normalized.type === "entrada" || normalized.type === "saida_venda") {
    normalized.storeId = null;
  }
  delete normalized.fromStoreId;
  delete normalized.toStoreId;
  return normalized;
}

function auditTypeFromLegacy(type) {
  return {
    entrada: "ENTRADA",
    entrada_compra: "ENTRADA_COMPRA",
    saida_venda: "SAIDA_VENDA",
    estorno_venda: "ESTORNO_VENDA",
    envio_showroom: "ENVIO_SHOWROOM",
    retorno_showroom: "RETORNO_SHOWROOM"
  }[type] || type;
}

function normalizeStockAuditMovement(movement) {
  return {
    id: movement.id || id("kdx"),
    produto_id: normalize(movement.produto_id || movement.productId),
    tipo: normalize(movement.tipo || auditTypeFromLegacy(movement.type)),
    quantidade: Number(movement.quantidade ?? movement.quantity ?? 0),
    saldo_apos_movimentacao: Number(movement.saldo_apos_movimentacao ?? movement.balanceAfter ?? 0),
    referencia: numericSaleReference(movement.referencia || movement.reason),
    data_hora: movement.data_hora || movement.createdAt || nowIso(),
    usuario: normalize(movement.usuario || movement.userName || movement.userId || "Usuário")
  };
}

function movementDepositDelta(type, quantity) {
  if (type === "entrada" || type === "entrada_compra" || type === "retorno_showroom" || type === "estorno_venda") return quantity;
  if (type === "saida_venda" || type === "envio_showroom") return -quantity;
  return 0;
}

function migrateStockAuditFromLegacy(db) {
  if ((db.movimentacoes_estoque || []).length || !(db.stockMovements || []).length) return;
  const balances = new Map((db.products || []).map((product) => [product.id, getStockRow(db, product.id).saldo_deposito]));
  const indexedMovements = db.stockMovements
    .map((movement, index) => ({ movement, index }))
    .sort((a, b) => String(b.movement.createdAt || "").localeCompare(String(a.movement.createdAt || "")) || b.index - a.index);
  const backfilled = [];
  for (const { movement } of indexedMovements) {
    const productId = movement.productId;
    if (!productId) continue;
    const quantity = Number(movement.quantity || 0);
    const balanceAfter = balances.get(productId) ?? 0;
    const sale = (db.sales || []).find((item) => item.id === movement.saleId);
    backfilled.push({
      id: id("kdx"),
      produto_id: productId,
      tipo: auditTypeFromLegacy(movement.type),
      quantidade: quantity,
      saldo_apos_movimentacao: balanceAfter,
      referencia: stockAuditReference(movement.type, movement.reason, sale?.codigo_venda, movement.storeId),
      data_hora: movement.createdAt || nowIso(),
      usuario: stockAuditUser(db, movement.userId)
    });
    balances.set(productId, balanceAfter - movementDepositDelta(movement.type, quantity));
  }
  db.movimentacoes_estoque = backfilled.sort((a, b) => String(a.data_hora).localeCompare(String(b.data_hora)));
}

function getStockRow(db, productId) {
  const product = db.products.find((item) => item.id === productId);
  if (!product) throw badRequest("Produto inexistente.");
  product.__lojas = db.lojas;
  return normalizeProductStock(product);
}

function stockTotal(row) {
  return row.saldo_deposito + Object.values(row.showrooms || {}).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}

function stockDepositQuantity(db, productId) {
  return getStockRow(db, productId).saldo_deposito;
}

function stockRequirementsForSaleItem(db, item) {
  const product = findActiveProduct(db, item.productId);
  if (!product.produto_kit) {
    return [{ productId: product.id, quantity: item.quantity, sourceProductName: product.name }];
  }
  return product.componentes_kit.map((component) => {
    const componentProduct = findActiveProduct(db, component.produto_id);
    return {
      productId: componentProduct.id,
      quantity: component.quantidade * item.quantity,
      sourceProductName: product.name
    };
  });
}

function itemEstimatedCost(db, item) {
  const product = db.products.find((row) => row.id === item.productId);
  if (!product) return 0;
  if (product.produto_kit && Number(product.custo_direto || product.costPrice || 0) <= 0) {
    return productKitCost(db, product) * item.quantity;
  }
  return Number(product.custo_direto ?? product.costPrice ?? 0) * item.quantity;
}

function productKitCost(db, product) {
  return normalizeKitComponents(product.componentes_kit || product.kitComponents, product.id).reduce((sum, component) => {
    const componentProduct = db.products.find((row) => row.id === component.produto_id);
    return sum + Number(componentProduct?.custo_direto ?? componentProduct?.costPrice ?? 0) * component.quantidade;
  }, 0);
}

function stockPayload(db, product) {
  const row = getStockRow(db, product.id);
  const totalStock = stockTotal(row);
  return {
    product,
    saldo_deposito: row.saldo_deposito,
    showroom_loja1: row.showroom_loja1,
    showroom_loja2: row.showroom_loja2,
    showrooms: db.lojas.map((loja) => ({
      loja_id: loja.id,
      nome: loja.nome || loja.name,
      quantidade: row.showrooms?.[loja.id] || 0
    })),
    total: totalStock,
    a_chegar: (db.itens_ordem_compra || [])
      .filter((item) => item.produto_id === product.id)
      .filter((item) => PURCHASE_INCOMING_STATUS.includes((db.ordens_compra || []).find((order) => order.id === item.ordem_id)?.status))
      .reduce((sum, item) => sum + Math.max(0, Number(item.quantidade_pedida || 0) - Number(item.quantidade_recebida || 0)), 0),
    lowStock: totalStock <= product.minStock,
    lowStockBasis: "total"
  };
}

function stockAuditReference(type, reason, saleCode, storeId) {
  if (type === "entrada_compra") return normalize(reason) || "Entrada por ordem de compra";
  if (type === "saida_venda") return saleCode ? `Venda #${saleCode}` : normalize(reason) || "Venda";
  if (type === "estorno_venda") return saleCode ? `Estorno venda #${saleCode}` : normalize(reason) || "Estorno de venda";
  if (type === "envio_showroom") return normalize(reason) || `Envio para showroom - ${storeLabelFromId(storeId)}`;
  if (type === "retorno_showroom") return normalize(reason) || `Retorno de showroom - ${storeLabelFromId(storeId)}`;
  return normalize(reason) || "Entrada de mercadoria no depósito central";
}

function stockAuditUser(db, userId) {
  const user = db.users.find((item) => item.id === userId);
  if (!user) return "Usuário";
  return `${user.nome || user.name} (${papelLabel(userPapel(user))})`;
}

function recordStockAudit(db, { type, productId, quantity, saldoAposMovimentacao, reason, saleCode, storeId, userId }) {
  db.movimentacoes_estoque = Array.isArray(db.movimentacoes_estoque) ? db.movimentacoes_estoque : [];
  const movement = {
    id: id("kdx"),
    produto_id: productId,
    tipo: auditTypeFromLegacy(type),
    quantidade: quantity,
    saldo_apos_movimentacao: saldoAposMovimentacao,
    referencia: stockAuditReference(type, reason, saleCode, storeId),
    data_hora: nowIso(),
    usuario: stockAuditUser(db, userId)
  };
  db.movimentacoes_estoque.push(movement);
  return movement;
}

function applyStockMovement(db, { type, productId, storeId, quantity, reason, saleId, saleCode, userId }) {
  const product = findActiveProduct(db, productId);
  const qty = toNonNegativeInteger(quantity, "Quantidade");
  if (qty <= 0) throw badRequest("Quantidade deve ser maior que zero.");
  const row = getStockRow(db, product.id);

  if (type === "entrada" || type === "entrada_compra") {
    row.saldo_deposito += qty;
  } else if (type === "saida_venda") {
    if (row.saldo_deposito < qty) throw badRequest(`Estoque insuficiente para ${product.name} no depósito central.`);
    row.saldo_deposito -= qty;
  } else if (type === "estorno_venda") {
    row.saldo_deposito += qty;
  } else if (type === "envio_showroom") {
    if (!db.lojas.some((loja) => loja.id === storeId && loja.status !== "inativo")) throw badRequest("Loja de showroom inválida.");
    if (row.saldo_deposito < qty) throw badRequest(`Estoque insuficiente para enviar ${product.name} ao showroom.`);
    row.saldo_deposito -= qty;
    row.showrooms[storeId] = (row.showrooms[storeId] || 0) + qty;
  } else if (type === "retorno_showroom") {
    if (!db.lojas.some((loja) => loja.id === storeId && loja.status !== "inativo")) throw badRequest("Loja de showroom inválida.");
    if ((row.showrooms[storeId] || 0) < qty) throw badRequest(`Showroom sem saldo suficiente para retornar ${product.name}.`);
    row.showrooms[storeId] -= qty;
    row.saldo_deposito += qty;
  } else {
    throw badRequest("Tipo de movimento inválido.");
  }

  const movement = {
    id: id("mov"),
    type,
    productId: product.id,
    storeId: storeId || null,
    quantity: qty,
    reason: normalize(reason),
    saleId: saleId || null,
    userId: userId || null,
    createdAt: nowIso()
  };
  db.stockMovements.push(movement);
  recordStockAudit(db, {
    type,
    productId: product.id,
    quantity: qty,
    saldoAposMovimentacao: row.saldo_deposito,
    reason,
    saleCode,
    storeId,
    userId
  });
  return movement;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(badRequest("Payload muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(badRequest("JSON inválido."));
      }
    });
  });
}

function filterByPeriod(rows, dateField, from, to) {
  return rows.filter((row) => {
    const date = String(row[dateField] || row.createdAt || "").slice(0, 10);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

function periodRange(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { from: start.toISOString().slice(0, 10), to: todayDate() };
}

function rank(rows, keyGetter, valueGetter = () => 1) {
  const map = new Map();
  for (const row of rows) {
    const key = keyGetter(row);
    map.set(key, (map.get(key) || 0) + valueGetter(row));
  }
  return [...map.entries()]
    .map(([id, value]) => ({ id, value: money(value) }))
    .sort((a, b) => b.value - a.value);
}

function reportData(db, user, query) {
  const storeIds = allowedStoreIds(db, user);
  const selectedStore = query.get("storeId") || "";
  if (selectedStore) assertStoreAccess(db, user, selectedStore);
  const effectiveStores = selectedStore ? [selectedStore] : storeIds;
  const from = query.get("from") || "";
  const to = query.get("to") || "";

  const sales = filterByPeriod(db.sales, "date", from, to)
    .filter((sale) => sale.status !== "CANCELADA")
    .filter((sale) => effectiveStores.includes(sale.storeId));
  const cashMovements = filterByPeriod(db.cashMovements, "date", from, to)
    .filter((movement) => effectiveStores.includes(movement.storeId));
  const stock = db.products.map((product) => {
    const row = getStockRow(db, product.id);
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: product.category,
      saldo_deposito: row.saldo_deposito,
      showroom_loja1: row.showroom_loja1,
      showroom_loja2: row.showroom_loja2,
      showrooms: db.lojas.map((loja) => ({
        loja_id: loja.id,
        nome: loja.nome || loja.name,
        quantidade: row.showrooms?.[loja.id] || 0
      })),
      total: stockTotal(row),
      lowStock: stockTotal(row) <= product.minStock
    };
  });

  return { sales, cashMovements, stock };
}

function botApiKey(db) {
  if (process.env.BOT_API_KEY) return process.env.BOT_API_KEY;
  if (!db.configuracoes_empresa.bot_api_key) {
    db.configuracoes_empresa.bot_api_key = crypto.randomBytes(24).toString("hex");
  }
  return db.configuracoes_empresa.bot_api_key;
}

function validateBotApiKey(db, req) {
  const token = normalize(req.headers["x-bot-token"]);
  if (!token || token !== botApiKey(db)) {
    const error = new Error("Chave do bot ausente ou inválida.");
    error.status = 401;
    throw error;
  }
}

function canonicalDeliveryStatus(value) {
  const normalized = normalize(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
  const aliases = {
    pendente: "pendente",
    a_separar: "pendente",
    em_separacao: "pendente",
    em_rota: "em_rota",
    entregue: "entregue",
    cancelada: "cancelada"
  };
  return aliases[normalized] || normalized;
}

async function api(db, req, res, url, body, user) {
  const method = req.method;
  const pathname = url.pathname;

  if (pathname === "/api/public/lojas" && method === "GET") {
    return db.lojas
      .filter((loja) => loja.ativa !== false && loja.status !== "inativo")
      .map((loja) => ({ id: loja.id, nome: loja.nome || loja.name }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  if (pathname === "/api/solicitacoes-acesso" && method === "POST") {
    const nome = normalize(body.nome || body.name);
    const login = normalize(body.login || body.email || body.username).toLowerCase();
    const lojaId = normalize(body.loja_id || body.storeId);
    const password = String(body.senha || body.password || "");
    const confirmation = String(body.confirmar_senha || body.confirmPassword || "");
    if (!nome || !login || login.length < 3) throw badRequest("Nome completo e login são obrigatórios.");
    if (login.includes("@") && !validEmail(login)) throw badRequest("Informe um e-mail válido.");
    if (!db.lojas.some((loja) => loja.id === lojaId && loja.ativa !== false && loja.status !== "inativo")) throw badRequest("Selecione uma filial válida.");
    if (password.length < 6) throw badRequest("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirmation) throw badRequest("As senhas informadas não conferem.");
    if (db.usuarios.some((item) => item.login === login)) throw badRequest("Este e-mail ou login já está cadastrado.");
    const requestedAt = nowIso();
    const requestedUser = usuarioRecord({
      id: id("user"),
      nome,
      login,
      senha_hash: passwordHash(password),
      papel: "PENDENTE",
      loja_id: lojaId,
      ativo: false,
      status: "PENDENTE_APROVACAO",
      solicitado_em: requestedAt,
      aprovado_por: null,
      criado_em: requestedAt
    });
    db.usuarios.push(requestedUser);
    syncUsuarios(db);
    return { ok: true };
  }

  if (pathname === "/api/auth/request-access" && method === "POST") {
    const nome = normalize(body.nome || body.name);
    const email = normalize(body.email).toLowerCase();
    const cargo = normalize(body.cargo_solicitado || body.cargoSolicitado);
    const justificativa = normalize(body.justificativa);
    if (!nome || !validEmail(email)) throw badRequest("Informe nome completo e um e-mail válido.");
    if (!cargo) throw badRequest("Informe o cargo solicitado.");
    if (justificativa.length < 8) throw badRequest("Descreva brevemente por que você precisa de acesso.");
    if (db.usuarios.some((item) => item.login === email)) throw badRequest("Já existe uma solicitação ou conta para este e-mail.");
    const requestedAt = nowIso();
    const account = usuarioRecord({
      id: id("user"), nome, login: email,
      // A senha temporária não é divulgada: o gestor define a credencial na aprovação.
      senha_hash: passwordHash(crypto.randomBytes(24).toString("hex")),
      papel: "PENDENTE", loja_id: "TODAS", ativo: false,
      status: "PENDENTE_APROVACAO", solicitado_em: requestedAt,
      cargo_solicitado: cargo, justificativa_acesso: justificativa, criado_em: requestedAt
    });
    db.usuarios.push(account);
    db.solicitacoes_acesso = Array.isArray(db.solicitacoes_acesso) ? db.solicitacoes_acesso : [];
    db.solicitacoes_acesso.push({
      id: id("access"), usuario_id: account.id, nome, email,
      cargo_solicitado: cargo, justificativa, status: "pending", criado_em: requestedAt
    });
    syncUsuarios(db);
    return { ok: true, status: "pending" };
  }

  if (["/api/login", "/api/auth/login"].includes(pathname) && method === "POST") {
    const username = normalize(body.username || body.login).toLowerCase();
    const password = String(body.password || "");
    const account = db.usuarios.find((item) => item.login === username);
    if (!account) {
      throw badRequest("Usuário ou senha inválidos.");
    }
    const status = normalize(account.status || (account.ativo === false ? "INATIVO" : "ATIVO")).toUpperCase();
    if (status === "PENDENTE_APROVACAO") throw badRequest("Sua conta ainda está aguardando aprovação da gestão.");
    if (["INATIVO", "REJEITADO"].includes(status) || account.ativo === false) throw badRequest("Acesso suspenso. Entre em contato com o gestor.");
    if (!verifyPassword(password, account.senha_hash)) throw badRequest("Usuário ou senha inválidos.");
    const token = crypto.randomBytes(32).toString("hex");
    db.sessions.push({ token, userId: account.id, createdAt: nowIso() });
    return { token, user: publicUser(account) };
  }

  if (pathname === "/api/convites/validar" && method === "GET") {
    const invite = findPendingInviteByToken(db, url.searchParams.get("token") || "");
    if (!invite) throw badRequest("Este convite expirou ou já foi utilizado. Solicite um novo ao seu gestor.");
    return {
      nome: invite.nome,
      email: invite.email,
      papel: invite.papel,
      papelLabel: papelLabel(invite.papel),
      loja_id: invite.loja_id
    };
  }

  if (pathname === "/api/bot/auth" && method === "POST") {
    validateBotApiKey(db, req);
    const phone = normalize(body.phone).replace(/\D/g, "");
    const code = normalize(body.token);
    if (!/^\d{6}$/.test(code) || phone.length < 10) throw badRequest("Telefone ou código temporário inválido.");
    const seller = db.vendedores.find((item) => item.bot_auth_code === code && item.bot_code_expires_at && new Date(item.bot_code_expires_at) > new Date());
    if (!seller) throw badRequest("Código temporário inválido ou expirado.");
    seller.whatsapp_phone = phone;
    seller.whatsapp_linked_at = nowIso();
    seller.bot_auth_code = "";
    seller.bot_code_expires_at = null;
    return { success: true, vendedor: seller.nome };
  }
  if (pathname === "/api/bot/estoque" && method === "GET") {
    validateBotApiKey(db, req);
    const term = normalize(url.searchParams.get("q")).toLowerCase();
    const products = (db.products || []).filter((product) => !term || `${product.nome || product.name} ${product.sku}`.toLowerCase().includes(term));
    return products.map((product) => {
      const stock = getStockRow(db, product.id);
      const locations = (db.lojas || []).map((loja) => ({ loja_id: loja.id, nome: loja.nome || loja.name, quantidade: Number(stock.showrooms?.[loja.id] || 0) }));
      return { id: product.id, nome: product.nome || product.name, sku: product.sku, estoque_total: stockTotal(stock), deposito: Number(stock.saldo_deposito || 0), localizacoes: locations };
    });
  }

  if (pathname === "/api/ativar-conta" && method === "POST") {
    const invite = findPendingInviteByToken(db, body.token || "");
    if (!invite) throw badRequest("Este convite expirou ou já foi utilizado. Solicite um novo ao seu gestor.");
    const password = String(body.senha || body.password || "");
    const confirm = String(body.confirmar_senha || body.confirmPassword || "");
    if (password.length < 4) throw badRequest("A senha deve ter pelo menos 4 caracteres.");
    if (password !== confirm) throw badRequest("As senhas informadas não conferem.");
    const existing = db.usuarios.find((item) => item.login === invite.email);
    const userData = usuarioRecord({
      ...(existing || {}),
      id: existing?.id || id("user"),
      nome: invite.nome,
      login: invite.email,
      senha_hash: passwordHash(password),
      papel: invite.papel,
      loja_id: invite.loja_id,
      ativo: true,
      status: "ATIVO",
      aprovado_por: invite.criado_por || null,
      criado_em: existing?.criado_em || nowIso()
    });
    if (existing) {
      Object.assign(existing, userData);
    } else {
      db.usuarios.push(userData);
    }
    invite.status = "CONCLUIDO";
    invite.concluido_em = nowIso();
    syncUsuarios(db);
    return { ok: true, login: invite.email };
  }

  if (!user) {
    const error = new Error("Login obrigatório.");
    error.status = 401;
    throw error;
  }

  if (["/api/integracoes/bot", "/api/bot/token"].includes(pathname) && method === "GET") {
    requireRole(user, ["gestor"]);
    const token = botApiKey(db);
    return { success: true, token, apiKey: token, vendedores: db.vendedores.filter((seller) => seller.whatsapp_phone).map((seller) => ({ id: seller.id, nome: seller.nome, whatsapp_phone: seller.whatsapp_phone, vinculado_em: seller.whatsapp_linked_at || seller.criado_em })) };
  }
  if (["/api/integracoes/bot/regenerate-token", "/api/bot/regenerate-token", "/api/integracoes/regenerate-token"].includes(pathname) && method === "POST") {
    requireRole(user, ["gestor"]);
    if (process.env.BOT_API_KEY) throw badRequest("A chave do bot é definida pelo ambiente e não pode ser regenerada pelo painel.");
    db.configuracoes_empresa.bot_api_key = crypto.randomBytes(24).toString("hex");
    return { success: true, token: db.configuracoes_empresa.bot_api_key, apiKey: db.configuracoes_empresa.bot_api_key };
  }
  if (pathname.startsWith("/api/integracoes/bot/vendedores/") && method === "DELETE") {
    requireRole(user, ["gestor"]);
    const seller = db.vendedores.find((item) => item.id === pathname.split("/").pop());
    if (!seller) throw notFound("Vendedor não encontrado.");
    seller.whatsapp_phone = "";
    seller.whatsapp_linked_at = null;
    return { ok: true };
  }

  if (pathname === "/api/admin/access-requests" && method === "GET") {
    requireRole(user, ["gestor"]);
    const requests = Array.isArray(db.solicitacoes_acesso) ? db.solicitacoes_acesso : [];
    return requests.filter((request) => request.status === "pending").map((request) => ({
      ...request,
      usuario: userPayload(db.usuarios.find((account) => account.id === request.usuario_id))
    }));
  }
  if (/^\/api\/admin\/access-requests\/[^/]+\/(approve|reject)$/.test(pathname) && method === "POST") {
    requireRole(user, ["gestor"]);
    const [, requestId, decision] = pathname.match(/^\/api\/admin\/access-requests\/([^/]+)\/(approve|reject)$/) || [];
    const request = (db.solicitacoes_acesso || []).find((item) => item.id === requestId && item.status === "pending");
    if (!request) throw notFound("Solicitação pendente não encontrada.");
    const account = db.usuarios.find((item) => item.id === request.usuario_id);
    if (!account) throw notFound("Conta vinculada à solicitação não encontrada.");
    if (decision === "reject") {
      Object.assign(account, normalizeUsuario({ ...account, ativo: false, status: "REJEITADO", aprovado_por: user.id }));
      request.status = "rejected";
    } else {
      const access = validateUserAccess(db, { papel: body.papel, loja_id: body.loja_id || body.storeId });
      const password = String(body.senha || body.password || "");
      if (password.length < 6) throw badRequest("Defina uma senha temporária de pelo menos 6 caracteres.");
      Object.assign(account, normalizeUsuario({ ...account, ...access, senha_hash: passwordHash(password), ativo: true, status: "ATIVO", aprovado_por: user.id }));
      request.status = "approved";
    }
    request.analisado_por = user.id;
    request.analisado_em = nowIso();
    syncUsuarios(db);
    return { request, user: userPayload(account) };
  }

  if (pathname === "/api/me" && method === "GET") return { user: publicUser(user) };
  if (pathname === "/api/logout" && method === "POST") {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    db.sessions = db.sessions.filter((session) => session.token !== token);
    return { ok: true };
  }
  if (pathname === "/api/bootstrap" && method === "GET") {
    const scopedStores = visibleStores(db, user);
    const scopedStoreIds = scopedStores.map((store) => store.id);
    const scopedVendedores = db.vendedores
      .map((seller) => vendedorPayload(seller, db))
      .filter((seller) => scopedStoreIds.some((storeId) => sellerStoreMatches(db, seller, storeId)));
    return {
      user: publicUser(user),
      lojas: scopedStores.map(legacyStoreToLoja),
      stores: scopedStores,
      configuracoes_empresa: db.configuracoes_empresa,
      fornecedores: db.fornecedores.map(fornecedorPayload),
      vendedores: scopedVendedores,
      paymentMethods: PAYMENT_METHODS,
      billStatus: BILL_STATUS,
      deliveryStatus: DELIVERY_STATUS
    };
  }

  if (pathname === "/api/lojas" && method === "GET") {
    requireRole(user, ["gestor"]);
    return db.lojas.map(lojaPayload).sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome));
  }
  if (pathname === "/api/lojas" && method === "POST") {
    requireRole(user, ["gestor"]);
    const loja = lojaFromBody(db, body, {
      id: body.id || nextLojaId(db),
      ativa: body.ativa === undefined ? true : body.ativa,
      criado_em: nowIso()
    });
    if (db.lojas.some((item) => item.id === loja.id)) throw badRequest("ID de loja já cadastrado.");
    db.lojas.push(loja);
    syncLojaDerivedData(db);
    return lojaPayload(loja);
  }
  if (pathname.startsWith("/api/lojas/") && method === "PUT") {
    requireRole(user, ["gestor"]);
    const lojaId = decodeURIComponent(pathname.split("/").pop());
    const loja = db.lojas.find((item) => item.id === lojaId);
    if (!loja) throw notFound("Loja não encontrada.");
    const updated = lojaFromBody(db, body, loja);
    if (updated.ativa === false && db.lojas.filter((item) => item.id !== loja.id && item.ativa !== false && item.status !== "inativo").length === 0) {
      throw badRequest("Não é permitido inativar a última loja ativa.");
    }
    Object.assign(loja, updated);
    syncLojaDerivedData(db);
    return lojaPayload(loja);
  }

  if (pathname === "/api/configuracoes_empresa" && method === "GET") {
    requireRole(user, ["gestor"]);
    return db.configuracoes_empresa;
  }
  if (pathname === "/api/configuracoes_empresa" && method === "PUT") {
    requireRole(user, ["gestor"]);
    const currentMaxSaleCode = maxSaleCode(db);
    const requestedNextNumber = Number(body.proximo_numero_pedido || db.configuracoes_empresa?.proximo_numero_pedido || SALE_CODE_BASE + 1);
    if (!Number.isInteger(requestedNextNumber) || requestedNextNumber < SALE_CODE_BASE + 1) {
      throw badRequest("Próximo número de pedido inválido.");
    }
    if (requestedNextNumber <= currentMaxSaleCode) {
      throw badRequest(`Próximo número de pedido deve ser maior que ${currentMaxSaleCode}.`);
    }
    db.configuracoes_empresa = normalizeCompanySettings(db, {
      ...db.configuracoes_empresa,
      ...body,
      lojas: {
        ...(db.configuracoes_empresa?.lojas || {}),
        ...(body.lojas || {})
      },
      proximo_numero_pedido: requestedNextNumber,
      exibir_assinatura_cliente: body.exibir_assinatura_cliente === undefined
        ? db.configuracoes_empresa?.exibir_assinatura_cliente !== false
        : body.exibir_assinatura_cliente === true
    });
    return db.configuracoes_empresa;
  }

  if (pathname === "/api/convites" && method === "GET") {
    requireRole(user, ["gestor"]);
    return db.convites
      .map(convitePayload)
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  }
  if (pathname === "/api/convites" && method === "POST") {
    requireRole(user, ["gestor"]);
    const email = normalize(body.email).toLowerCase();
    const nome = normalize(body.nome || body.name);
    if (!nome || !email || !validEmail(email)) throw badRequest("Nome completo e e-mail válido são obrigatórios.");
    if (db.usuarios.some((item) => item.login === email && item.ativo !== false)) throw badRequest("Já existe um usuário ativo com este e-mail.");
    if (db.convites.some((item) => item.email === email && item.status === "PENDENTE" && !conviteExpired(item))) {
      throw badRequest("Já existe um convite pendente para este e-mail.");
    }
    const access = validateUserAccess(db, {
      papel: body.papel || body.role,
      loja_id: body.loja_id || body.storeId
    });
    const invite = normalizeConvite({
      id: id("conv"),
      nome,
      email,
      papel: access.papel,
      loja_id: access.loja_id,
      token: crypto.randomBytes(32).toString("hex"),
      status: "PENDENTE",
      expira_em: invitationExpiresAt(),
      criado_em: nowIso(),
      criado_por: user.id
    });
    db.convites.push(invite);
    let emailResult;
    try {
      emailResult = await sendInviteEmail(invite);
    } catch (error) {
      console.error("Falha ao enviar convite pela Resend:", error);
      emailResult = { sent: false, reason: "Falha no envio pela Resend. Verifique RESEND_API_KEY e EMAIL_FROM." };
    }
    return { convite: convitePayload(invite), email: emailResult };
  }
  if (pathname.startsWith("/api/convites/") && pathname.endsWith("/resend") && method === "POST") {
    requireRole(user, ["gestor"]);
    const inviteId = pathname.split("/").slice(-2)[0];
    const invite = db.convites.find((item) => item.id === inviteId);
    if (!invite) throw notFound("Convite não encontrado.");
    if (invite.status !== "PENDENTE") throw badRequest("Só convites pendentes podem ser reenviados.");
    if (conviteExpired(invite)) {
      invite.token = crypto.randomBytes(32).toString("hex");
      invite.expira_em = invitationExpiresAt();
    }
    let emailResult;
    try {
      emailResult = await sendInviteEmail(invite);
    } catch (error) {
      console.error("Falha ao reenviar convite pela Resend:", error);
      emailResult = { sent: false, reason: "Falha no envio pela Resend. Verifique RESEND_API_KEY e EMAIL_FROM." };
    }
    return { convite: convitePayload(invite), email: emailResult };
  }
  if (pathname.startsWith("/api/convites/") && pathname.endsWith("/revoke") && method === "POST") {
    requireRole(user, ["gestor"]);
    const inviteId = pathname.split("/").slice(-2)[0];
    const invite = db.convites.find((item) => item.id === inviteId);
    if (!invite) throw notFound("Convite não encontrado.");
    if (invite.status !== "PENDENTE") throw badRequest("Só convites pendentes podem ser revogados.");
    invite.status = "REVOGADO";
    invite.revogado_em = nowIso();
    return convitePayload(invite);
  }

  if (pathname === "/api/users" && method === "GET") {
    requireRole(user, ["gestor"]);
    return db.usuarios.map(userPayload);
  }
  if (pathname === "/api/users" && method === "POST") {
    requireRole(user, ["gestor"]);
    const username = normalize(body.username || body.login).toLowerCase();
    const password = String(body.password || body.senha || "");
    if (!normalize(body.name || body.nome) || !username || !password) throw badRequest("Nome, login e senha são obrigatórios.");
    if (password.length < 4) throw badRequest("A senha deve ter pelo menos 4 caracteres.");
    if (db.usuarios.some((item) => item.login === username)) throw badRequest("Login já cadastrado.");
    const profileAccess = body.profile ? papelFromProfile(body.profile, body.loja_id || body.storeId) : null;
    const access = validateUserAccess(db, {
      papel: body.papel || profileAccess?.papel || body.role,
      loja_id: body.loja_id || body.storeId || profileAccess?.loja_id
    });
    const created = normalizeUsuario({
      id: id("user"),
      nome: body.nome || body.name,
      login: username,
      senha_hash: passwordHash(password),
      papel: access.papel,
      loja_id: access.loja_id,
      ativo: true,
      status: "ATIVO",
      aprovado_por: user.id,
      criado_em: nowIso()
    });
    db.usuarios.push(created);
    syncUsuarios(db);
    return userPayload(created);
  }
  if (pathname.endsWith("/approve") && pathname.startsWith("/api/users/") && method === "PUT") {
    requireRole(user, ["gestor"]);
    const userId = pathname.split("/").slice(-2)[0];
    const account = db.usuarios.find((item) => item.id === userId);
    if (!account) throw notFound("Solicitação não encontrada.");
    if (account.status !== "PENDENTE_APROVACAO") throw badRequest("Esta solicitação já foi analisada.");
    const requestedPapel = normalize(body.papel).toUpperCase();
    if (!USER_PAPEIS.includes(requestedPapel) || requestedPapel === "PENDENTE") throw badRequest("Selecione um papel oficial para o integrante.");
    const access = validateUserAccess(db, { papel: requestedPapel, loja_id: body.loja_id || account.loja_id });
    Object.assign(account, normalizeUsuario({
      ...account,
      papel: access.papel,
      loja_id: access.loja_id,
      ativo: true,
      status: "ATIVO",
      aprovado_por: user.id
    }));
    syncUsuarios(db);
    return userPayload(account);
  }
  if (pathname.endsWith("/reject") && pathname.startsWith("/api/users/") && method === "PUT") {
    requireRole(user, ["gestor"]);
    const userId = pathname.split("/").slice(-2)[0];
    const account = db.usuarios.find((item) => item.id === userId);
    if (!account) throw notFound("Solicitação não encontrada.");
    if (account.status !== "PENDENTE_APROVACAO") throw badRequest("Esta solicitação já foi analisada.");
    Object.assign(account, normalizeUsuario({ ...account, ativo: false, status: "REJEITADO", aprovado_por: user.id }));
    db.sessions = db.sessions.filter((session) => session.userId !== account.id);
    syncUsuarios(db);
    return userPayload(account);
  }
  if (pathname.endsWith("/password") && pathname.startsWith("/api/users/") && method === "PUT") {
    requireRole(user, ["gestor"]);
    const userId = pathname.split("/").slice(-2)[0];
    const account = db.usuarios.find((item) => item.id === userId);
    if (!account) throw notFound("Usuário não encontrado.");
    const password = String(body.password || body.senha || "");
    if (password.length < 4) throw badRequest("A senha deve ter pelo menos 4 caracteres.");
    account.senha_hash = passwordHash(password);
    db.sessions = db.sessions.filter((session) => session.userId !== account.id);
    syncUsuarios(db);
    return { ok: true };
  }
  if (pathname.startsWith("/api/users/") && method === "PUT") {
    requireRole(user, ["gestor"]);
    const userId = pathname.split("/").pop();
    const account = db.usuarios.find((item) => item.id === userId);
    if (!account) throw notFound("Usuário não encontrado.");
    const nextUsername = body.username !== undefined || body.login !== undefined
      ? normalize(body.username || body.login).toLowerCase()
      : account.login;
    if (!nextUsername || db.usuarios.some((item) => item.id !== account.id && item.login === nextUsername)) throw badRequest("Login inválido ou já cadastrado.");
    const profileAccess = body.profile ? papelFromProfile(body.profile, body.loja_id || body.storeId || account.loja_id) : null;
    const access = validateUserAccess(db, {
      papel: body.papel || profileAccess?.papel || account.papel,
      loja_id: body.loja_id || body.storeId || profileAccess?.loja_id || account.loja_id
    });
    const activeValue = body.ativo === undefined && body.active === undefined ? account.ativo : Boolean(body.ativo ?? body.active);
    const nextStatus = body.status && USER_STATUS.includes(normalize(body.status).toUpperCase())
      ? normalize(body.status).toUpperCase()
      : activeValue ? "ATIVO" : "INATIVO";
    Object.assign(account, normalizeUsuario({
      ...account,
      nome: body.name === undefined && body.nome === undefined ? account.nome : body.name || body.nome,
      login: nextUsername,
      papel: access.papel,
      loja_id: access.loja_id,
      ativo: activeValue,
      status: nextStatus
    }));
    if ((account.ativo === false || userPapel(account) !== "ADMINISTRADOR") && db.usuarios.filter((item) => item.id !== account.id && userPapel(item) === "ADMINISTRADOR" && item.ativo !== false).length === 0) {
      Object.assign(account, normalizeUsuario({ ...account, papel: "ADMINISTRADOR", loja_id: "TODAS", ativo: true }));
      throw badRequest("Não é permitido remover ou inativar o último Administrador ativo.");
    }
    if (!account.ativo) db.sessions = db.sessions.filter((session) => session.userId !== account.id);
    syncUsuarios(db);
    return userPayload(account);
  }

  if (pathname === "/api/overview" && method === "GET") {
    const period = url.searchParams.get("period") || "month";
    const { from, to } = periodRange(period);
    const data = reportData(db, user, new URLSearchParamsLike({ from, to, storeId: url.searchParams.get("storeId") || "" }));
    const storeIds = [...new Set(data.cashMovements.map((item) => item.storeId).concat(data.sales.map((item) => item.storeId)))];
    const revenue = data.sales.reduce((sum, sale) => sum + sale.total, 0);
    const salesCount = data.sales.length;
    const averageTicket = salesCount ? revenue / salesCount : 0;
    const itemRows = data.sales.flatMap((sale) => sale.items.map((item) => ({ ...item, sale })));
    const estimatedCogs = itemRows.reduce((sum, item) => sum + itemEstimatedCost(db, item), 0);
    const grossProfit = revenue - estimatedCogs;
    const grossMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const stockRows = db.products.map((product) => {
      const row = getStockRow(db, product.id);
      const total = stockTotal(row);
      return {
        product,
        total,
        lowStock: total <= product.minStock,
        value: total * Number(product.custo_direto ?? product.costPrice ?? 0)
      };
    });
    const stockValue = stockRows.reduce((sum, row) => sum + row.value, 0);
    const lowStockCount = stockRows.filter((row) => row.lowStock).length;
    const paymentMethods = rank(data.sales.flatMap((sale) => effectiveSalePayments(sale)), (payment) => payment.metodo || "sem_pagamento", (payment) => payment.valor)
      .map((row) => ({ ...row, name: PAYMENT_LABELS[row.id] || row.id }));
    const cashBalance = db.cashMovements
      .filter((movement) => allowedStoreIds(db, user).includes(movement.storeId))
      .reduce((sum, movement) => sum + (movement.type === "entrada" ? movement.value : -movement.value), 0);
    const dueLimit = new Date();
    dueLimit.setDate(dueLimit.getDate() + 7);
    const dueLimitDate = dueLimit.toISOString().slice(0, 10);
    const bills = db.bills
      .filter((bill) => allowedStoreIds(db, user).includes(bill.storeId))
      .filter((bill) => bill.status === "pendente" && bill.dueDate <= dueLimitDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const sellerRanking = rank(data.sales, (sale) => sale.vendedorId || sale.sellerId, (sale) => sale.total)
      .map((row) => {
        const seller = db.vendedores.find((item) => item.id === row.id);
        const sale = data.sales.find((item) => (item.vendedorId || item.sellerId) === row.id);
        return { ...row, name: seller?.nome || sale?.vendedorNome || sale?.sellerName || "Sem vendedor" };
      });
    const category = url.searchParams.get("category") || "";
    const filteredItemRows = category
      ? itemRows.filter((item) => db.products.find((product) => product.id === item.productId)?.category === category)
      : itemRows;
    const productRanking = rank(filteredItemRows, (item) => item.productId, (item) => item.quantity)
      .map((row) => ({ ...row, name: db.products.find((product) => product.id === row.id)?.name || "Produto" }));
    const brandRanking = rank(filteredItemRows, (item) => db.products.find((product) => product.id === item.productId)?.brandModel || "Sem marca", (item) => item.quantity)
      .map((row) => ({ id: row.id, name: row.id, value: row.value }));

    return {
      period,
      from,
      to,
      storeIds,
      revenue: money(revenue),
      salesCount,
      averageTicket: money(averageTicket),
      grossProfit: money(grossProfit),
      grossMarginPercent: money(grossMarginPercent),
      stockValue: money(stockValue),
      lowStockCount,
      paymentMethods,
      cashBalance: money(cashBalance),
      dueBills: bills,
      sellerRanking,
      productRanking,
      brandRanking
    };
  }

  if (pathname === "/api/fornecedores" && method === "GET") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    return db.fornecedores
      .map(fornecedorPayload)
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome_fantasia.localeCompare(b.nome_fantasia));
  }
  if (pathname === "/api/fornecedores" && method === "POST") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    const supplier = normalizeFornecedor({
      id: id("forn"),
      razao_social: body.razao_social,
      nome_fantasia: body.nome_fantasia,
      cnpj: body.cnpj,
      contato_nome: body.contato_nome || body.contato_representante,
      telefone: body.telefone,
      email: body.email,
      condicoes_pagamento_padrao: body.condicoes_pagamento_padrao,
      ativo: true,
      criado_em: nowIso()
    });
    if (!supplier.razao_social || !supplier.nome_fantasia || !supplier.cnpj) {
      throw badRequest("Razão social, nome fantasia e CNPJ são obrigatórios.");
    }
    if (db.fornecedores.some((item) => item.cnpj === supplier.cnpj)) throw badRequest("Já existe um fornecedor com este CNPJ.");
    db.fornecedores.push(supplier);
    return supplier;
  }
  if (pathname.startsWith("/api/fornecedores/") && method === "PUT") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    const supplier = db.fornecedores.find((item) => item.id === pathname.split("/").pop());
    if (!supplier) throw notFound("Fornecedor não encontrado.");
    const updated = normalizeFornecedor({
      ...supplier,
      razao_social: body.razao_social === undefined ? supplier.razao_social : body.razao_social,
      nome_fantasia: body.nome_fantasia === undefined ? supplier.nome_fantasia : body.nome_fantasia,
      cnpj: body.cnpj === undefined ? supplier.cnpj : body.cnpj,
      contato_nome: body.contato_nome === undefined && body.contato_representante === undefined ? supplier.contato_nome : body.contato_nome || body.contato_representante,
      telefone: body.telefone === undefined ? supplier.telefone : body.telefone,
      email: body.email === undefined ? supplier.email : body.email,
      condicoes_pagamento_padrao: body.condicoes_pagamento_padrao === undefined ? supplier.condicoes_pagamento_padrao : body.condicoes_pagamento_padrao,
      ativo: body.ativo === undefined ? supplier.ativo : body.ativo
    });
    if (!updated.razao_social || !updated.nome_fantasia || !updated.cnpj) {
      throw badRequest("Razão social, nome fantasia e CNPJ são obrigatórios.");
    }
    if (db.fornecedores.some((item) => item.id !== supplier.id && item.cnpj === updated.cnpj)) throw badRequest("Já existe um fornecedor com este CNPJ.");
    Object.assign(supplier, updated);
    return supplier;
  }

  if (pathname === "/api/compras/resumo" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "estoque"]);
    const month = todayDate().slice(0, 7);
    const totalCompradoMes = (db.ordens_compra || [])
      .filter((order) => order.status !== "CANCELADO" && String(order.data_emissao).startsWith(month))
      .reduce((sum, order) => sum + Number(order.valor_total || 0), 0);
    const ordensEmTransito = (db.ordens_compra || []).filter((order) => ["PEDIDO_ENVIADO", "EM_TRANSITO"].includes(order.status)).length;
    const reposicoesUrgentes = (db.products || []).filter((product) => {
      const stock = stockTotal(getStockRow(db, product.id));
      return stock <= Number(product.estoque_minimo ?? product.minStock ?? 0);
    }).length;
    return { total_comprado_mes: money(totalCompradoMes), ordens_em_transito: ordensEmTransito, reposicoes_urgentes: reposicoesUrgentes };
  }
  if (pathname === "/api/compras/ordens" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "estoque"]);
    return (db.ordens_compra || []).map((order) => purchaseOrderPayload(db, order)).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  }
  if (pathname === "/api/compras/ordens" && method === "POST") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    const supplier = findFornecedor(db, normalize(body.fornecedor_id), { requireActive: true });
    if (!supplier) throw badRequest("Fornecedor inválido ou inativo.");
    const lojaId = normalize(body.loja_id || body.storeId);
    assertStoreAccess(db, user, lojaId);
    const rawItems = Array.isArray(body.itens) ? body.itens : [];
    if (!rawItems.length) throw badRequest("Inclua ao menos um produto na ordem de compra.");
    const seenProducts = new Set();
    const orderId = nextPurchaseOrderId(db);
    const items = rawItems.map((raw) => {
      const product = findActiveProduct(db, normalize(raw.produto_id));
      if (seenProducts.has(product.id)) throw badRequest(`O produto ${product.name} foi incluído mais de uma vez.`);
      seenProducts.add(product.id);
      const quantity = toNonNegativeInteger(Number(raw.quantidade_pedida), "Quantidade pedida");
      if (quantity <= 0) throw badRequest("Quantidade pedida deve ser maior que zero.");
      const unitCost = money(toPositiveNumber(raw.custo_unitario, "Custo unitário"));
      return normalizePurchaseItem({
        id: id("oci"),
        ordem_id: orderId,
        produto_id: product.id,
        quantidade_pedida: quantity,
        quantidade_recebida: 0,
        custo_unitario: unitCost,
        custo_planejado: unitCost,
        valor_recebido: 0,
        subtotal: money(quantity * unitCost)
      });
    });
    const freight = money(toNonNegativeNumber(body.valor_frete || 0, "Frete"));
    const productTotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));
    const initialStatus = normalize(body.status || "RASCUNHO").toUpperCase();
    if (!["RASCUNHO", "PEDIDO_ENVIADO"].includes(initialStatus)) throw badRequest("Status inicial da ordem inválido.");
    const order = normalizePurchaseOrder({
      id: orderId,
      fornecedor_id: supplier.id,
      loja_id: lojaId,
      data_emissao: body.data_emissao || todayDate(),
      previsao_entrega: body.previsao_entrega,
      status: initialStatus,
      valor_produtos: productTotal,
      valor_frete: freight,
      valor_total: money(productTotal + freight),
      condicao_pagamento: body.condicao_pagamento || supplier.condicoes_pagamento_padrao,
      observacoes: body.observacoes,
      criado_por: user.id,
      criado_em: nowIso(),
      atualizado_em: nowIso()
    });
    if (!order.previsao_entrega) throw badRequest("Previsão de entrega é obrigatória.");
    if (!order.condicao_pagamento) throw badRequest("Condição de pagamento é obrigatória.");
    db.ordens_compra.push(order);
    db.itens_ordem_compra.push(...items);
    return purchaseOrderPayload(db, order);
  }
  if (/^\/api\/compras\/ordens\/[^/]+\/status$/.test(pathname) && method === "PUT") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    const orderId = decodeURIComponent(pathname.split("/")[4]);
    const order = db.ordens_compra.find((item) => item.id === orderId);
    if (!order) throw notFound("Ordem de compra não encontrada.");
    const nextStatus = normalize(body.status).toUpperCase();
    const transitions = {
      RASCUNHO: ["PEDIDO_ENVIADO", "CANCELADO"],
      PEDIDO_ENVIADO: ["EM_TRANSITO", "CANCELADO"],
      EM_TRANSITO: ["CANCELADO"],
      RECEBIDO_PARCIAL: []
    };
    if (!(transitions[order.status] || []).includes(nextStatus)) throw badRequest("Transição de status não permitida.");
    order.status = nextStatus;
    order.atualizado_em = nowIso();
    return purchaseOrderPayload(db, order);
  }
  if (/^\/api\/compras\/ordens\/[^/]+\/receber$/.test(pathname) && method === "POST") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    const orderId = decodeURIComponent(pathname.split("/")[4]);
    const order = db.ordens_compra.find((item) => item.id === orderId);
    if (!order) throw notFound("Ordem de compra não encontrada.");
    if (!["PEDIDO_ENVIADO", "EM_TRANSITO", "RECEBIDO_PARCIAL"].includes(order.status)) throw badRequest("Esta ordem não está disponível para recebimento.");
    const orderItems = purchaseOrderItems(db, order.id);
    const inputItems = Array.isArray(body.itens) ? body.itens : [];
    const seenItemIds = new Set();
    const checked = inputItems.map((raw) => {
      const item = orderItems.find((row) => row.id === raw.id);
      if (!item) throw badRequest("Item de recebimento inválido.");
      if (seenItemIds.has(item.id)) throw badRequest("O mesmo item foi informado mais de uma vez no recebimento.");
      seenItemIds.add(item.id);
      const quantity = toNonNegativeInteger(Number(raw.quantidade_recebida || 0), "Quantidade recebida");
      const remaining = item.quantidade_pedida - item.quantidade_recebida;
      if (quantity > remaining) throw badRequest(`Quantidade recebida de ${item.produto_id} supera o saldo pendente.`);
      const unitCost = raw.custo_unitario === undefined ? item.custo_unitario : money(toPositiveNumber(raw.custo_unitario, "Custo unitário"));
      const product = findActiveProduct(db, item.produto_id);
      return { item, product, quantity, unitCost };
    });
    if (!checked.some((row) => row.quantity > 0)) throw badRequest("Informe ao menos uma quantidade recebida.");
    for (const row of checked) {
      if (!row.quantity) continue;
      row.item.quantidade_recebida += row.quantity;
      row.item.valor_recebido = money(Number(row.item.valor_recebido || 0) + row.quantity * row.unitCost);
      row.item.custo_unitario = money(row.item.valor_recebido / row.item.quantidade_recebida);
      row.item.subtotal = money(
        Number(row.item.valor_recebido || 0)
        + Math.max(0, row.item.quantidade_pedida - row.item.quantidade_recebida) * Number(row.item.custo_planejado || row.unitCost)
      );
      applyStockMovement(db, {
        type: "entrada_compra",
        productId: row.product.id,
        quantity: row.quantity,
        reason: `Entrada da ordem de compra ${order.id}`,
        userId: user.id
      });
      row.product.preco_custo = row.item.custo_unitario;
      row.product.custo_unitario = row.item.custo_unitario;
      row.product.custo_direto = row.item.custo_unitario;
      row.product.costPrice = row.item.custo_unitario;
    }
    const allReceived = orderItems.every((item) => item.quantidade_recebida >= item.quantidade_pedida);
    order.status = allReceived ? "RECEBIDO_TOTAL" : "RECEBIDO_PARCIAL";
    recalculatePurchaseOrderTotals(db, order);
    order.recebido_em = nowIso();
    order.atualizado_em = nowIso();
    const payables = allReceived ? createPurchasePayables(db, order) : [];
    return { ordem: purchaseOrderPayload(db, order), contas_a_pagar: payables };
  }

  if (pathname === "/api/vendedores" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja"]);
    const storeId = url.searchParams.get("storeId") || "";
    if (storeId) assertStoreAccess(db, user, storeId);
    const permittedStores = allowedStoreIds(db, user);
    return db.vendedores
      .map((seller) => vendedorPayload(seller, db))
      .filter((seller) => {
        const stores = storeId ? [storeId] : permittedStores;
        return stores.some((id) => sellerStoreMatches(db, seller, id));
      })
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  }
  if (pathname === "/api/vendedores/gerar-token-bot" && method === "POST") {
    requireRole(user, ["gestor", "gerente_loja"]);
    const seller = findActiveVendedor(db, normalize(body.vendedor_id || body.sellerId));
    if (userPapel(user) === "GERENTE_LOJA" && !sellerStoreMatches(db, seller, user.loja_id)) throw forbidden("Este vendedor não pertence à sua loja.");
    seller.bot_auth_code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    seller.bot_code_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return { token: seller.bot_auth_code, expiresAt: seller.bot_code_expires_at, vendedor: seller.nome };
  }
  if (pathname === "/api/vendedores" && method === "POST") {
    requireRole(user, ["gestor", "gerente_loja"]);
    const selectedStore = normalize(body.loja_id || body.storeId || body.loja_padrao);
    const seller = normalizeVendedor({
      id: id("vend"),
      nome: body.nome,
      loja_id: selectedStore === "Ambas" ? "" : selectedStore,
      loja_padrao: selectedStore === "Ambas" ? "Ambas" : body.loja_padrao,
      telefone: body.telefone,
      ativo: true,
      criado_em: nowIso()
    }, db);
    if (!seller.nome) throw badRequest("Nome do vendedor é obrigatório.");
    if (seller.loja_padrao !== "Ambas" && !activeLojaIds(db).includes(seller.loja_id)) throw badRequest("Loja padrão inválida.");
    db.vendedores.push(seller);
    return seller;
  }
  if (pathname.startsWith("/api/vendedores/") && method === "PUT") {
    requireRole(user, ["gestor", "gerente_loja"]);
    const seller = db.vendedores.find((item) => item.id === pathname.split("/").pop());
    if (!seller) throw notFound("Vendedor não encontrado.");
    const selectedStore = normalize(body.loja_id || body.storeId || body.loja_padrao || seller.loja_id || seller.storeId || seller.loja_padrao);
    const updated = normalizeVendedor({
      ...seller,
      nome: body.nome === undefined ? seller.nome : body.nome,
      loja_id: selectedStore === "Ambas" ? "" : selectedStore,
      loja_padrao: selectedStore === "Ambas" ? "Ambas" : body.loja_padrao,
      telefone: body.telefone === undefined ? seller.telefone : body.telefone,
      ativo: body.ativo === undefined ? seller.ativo : body.ativo
    }, db);
    if (!updated.nome) throw badRequest("Nome do vendedor é obrigatório.");
    if (updated.loja_padrao !== "Ambas" && !activeLojaIds(db).includes(updated.loja_id)) throw badRequest("Loja padrão inválida.");
    Object.assign(seller, updated);
    return seller;
  }

  if (pathname === "/api/products" && method === "GET") {
    return db.products.map((product) => {
      const stock = stockPayload(db, product);
      return { ...product, ...stock, product: undefined, totalStock: stock.total };
    });
  }
  if (pathname === "/api/products" && method === "POST") {
    requireRole(user, ["gestor", "estoque"]);
    const sku = normalize(body.sku).toUpperCase() || nextSku(db, body);
    body.sku = sku;
    if (db.products.some((product) => product.sku.toUpperCase() === sku)) throw badRequest("SKU já cadastrado.");
    const product = productFromBody(db, body, {
      id: id("prod"),
      saldo_deposito: 0,
      showroom_loja1: 0,
      showroom_loja2: 0,
      showrooms: {},
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    if (!product.name || !product.category) throw badRequest("Nome, categoria e fornecedor são obrigatórios.");
    db.products.push(product);
    getStockRow(db, product.id);
    return product;
  }
  if (pathname.startsWith("/api/products/") && method === "PUT") {
    requireRole(user, ["gestor", "estoque"]);
    const product = db.products.find((item) => item.id === pathname.split("/").pop());
    if (!product) throw notFound();
    if (body.sku && db.products.some((item) => item.id !== product.id && item.sku.toUpperCase() === normalize(body.sku).toUpperCase())) {
      throw badRequest("SKU já cadastrado.");
    }
    if (body.sku !== undefined && !normalize(body.sku)) body.sku = product.sku || nextSku(db, { ...product, ...body });
    const updated = productFromBody(db, body, {
      ...product,
      updatedAt: nowIso()
    });
    if (!updated.name || !updated.category) throw badRequest("Nome, categoria e fornecedor são obrigatórios.");
    Object.assign(product, updated);
    return product;
  }

  if (pathname === "/api/customers" && method === "GET") {
    return db.customers.map((customer) => {
      const sales = db.sales.filter((sale) => sale.customerId === customer.id);
      return {
        ...customer,
        purchaseCount: sales.length,
        totalSpent: money(sales.reduce((sum, sale) => sum + sale.total, 0))
      };
    });
  }
  if (pathname === "/api/customers" && method === "POST") {
    requireRole(user, ["gestor", "gerente_loja"]);
    const customer = customerFromBody(body, {
      id: id("cli"),
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    if (!customer.nome || !customer.telefone) throw badRequest("Nome e telefone são obrigatórios.");
    db.customers.push(customer);
    return customer;
  }
  if (pathname.startsWith("/api/customers/") && method === "PUT") {
    requireRole(user, ["gestor", "gerente_loja"]);
    const customer = db.customers.find((item) => item.id === pathname.split("/").pop());
    if (!customer) throw notFound();
    const updated = customerFromBody(body, {
      ...customer,
      updatedAt: nowIso()
    });
    if (!updated.nome || !updated.telefone) throw badRequest("Nome e telefone são obrigatórios.");
    Object.assign(customer, updated);
    return customer;
  }

  if (pathname === "/api/stock" && method === "GET") {
    return db.products.map((product) => stockPayload(db, product));
  }
  if (pathname === "/api/stock/movements" && method === "GET") {
    requireRole(user, ["gestor", "gerente_loja", "estoque"]);
    const productId = url.searchParams.get("productId") || "";
    const product = db.products.find((item) => item.id === productId);
    if (!product) throw notFound("Produto não encontrado.");
    const row = stockPayload(db, product);
    const movements = (db.movimentacoes_estoque || [])
      .filter((movement) => movement.produto_id === product.id)
      .sort((a, b) => String(b.data_hora).localeCompare(String(a.data_hora)));
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        saldo_deposito: row.saldo_deposito
      },
      movements
    };
  }
  if (pathname === "/api/stock/entry" && method === "POST") {
    requireRole(user, ["gestor", "estoque"]);
    return applyStockMovement(db, {
      type: "entrada",
      productId: body.productId,
      quantity: body.quantity,
      reason: body.reason || "Entrada de mercadoria no depósito central",
      userId: user.id
    });
  }
  if (pathname === "/api/showroom/movements" && method === "GET") {
    requireRole(user, ["gestor", "estoque"]);
    return db.stockMovements
      .filter((movement) => ["envio_showroom", "retorno_showroom"].includes(movement.type))
      .map((movement) => ({
        ...movement,
        productName: db.products.find((product) => product.id === movement.productId)?.name || "Produto",
        sku: db.products.find((product) => product.id === movement.productId)?.sku || "",
        storeName: db.stores.find((store) => store.id === movement.storeId)?.name || "",
        userName: db.users.find((item) => item.id === movement.userId)?.name || "Usuário"
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (pathname === "/api/showroom/movements" && method === "POST") {
    requireRole(user, ["gestor", "estoque"]);
    assertStoreAccess(db, user, body.storeId);
    if (!["envio_showroom", "retorno_showroom"].includes(body.type)) throw badRequest("Tipo de movimentação de showroom inválido.");
    return applyStockMovement(db, {
      type: body.type,
      productId: body.productId,
      storeId: body.storeId,
      quantity: body.quantity,
      reason: body.reason || (body.type === "envio_showroom" ? "Envio para showroom" : "Retorno de showroom"),
      userId: user.id
    });
  }

  if (pathname === "/api/cash/sessions" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja"]);
    const storeFilter = url.searchParams.get("storeId") || "";
    if (storeFilter) assertStoreAccess(db, user, storeFilter);
    const stores = storeFilter ? [storeFilter] : allowedStoreIds(db, user);
    return (db.sessoes_caixa || [])
      .filter((session) => stores.includes(session.loja_id))
      .map((session) => cashSessionPayload(db, session))
      .sort((a, b) => String(b.data_abertura).localeCompare(String(a.data_abertura)));
  }
  if (pathname === "/api/cash/open" && method === "POST") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "vendedor"]);
    assertStoreAccess(db, user, body.storeId || body.loja_id);
    const lojaId = body.storeId || body.loja_id;
    const pendingSession = openCashSession(db, lojaId);
    if (pendingSession) throw badRequest(`Existe um caixa pendente desde ${String(pendingSession.data_abertura).slice(0, 10)}. Feche-o antes de abrir um novo.`);
    const session = normalizeCashSession({
      id: id("cx"),
      loja_id: lojaId,
      operador_id: user.id,
      data_abertura: nowIso(),
      saldo_inicial_troco: toNonNegativeNumber(body.saldo_inicial_troco ?? body.openingCash ?? 0, "Fundo de troco"),
      status: "aberto"
    });
    db.sessoes_caixa.push(session);
    return cashSessionPayload(db, session);
  }
  if (pathname === "/api/cash/sangria" && method === "POST") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "vendedor"]);
    assertStoreAccess(db, user, body.storeId || body.loja_id);
    const lojaId = body.storeId || body.loja_id;
    const session = currentCashSession(db, lojaId, todayDate());
    if (!session) throw badRequest("Abra o caixa antes de registrar sangria.");
    const value = money(toPositiveNumber(body.value || body.valor, "Valor"));
    const reason = normalize(body.reason || body.justificativa || body.description);
    if (!reason) throw badRequest("Justificativa da sangria é obrigatória.");
    const movement = {
      id: id("cash"),
      date: todayDate(),
      type: "saida",
      value,
      category: "Sangria",
      storeId: lojaId,
      saleId: null,
      paymentMethod: "dinheiro",
      sessao_caixa_id: session.id,
      description: reason,
      createdAt: nowIso()
    };
    db.cashMovements.push(movement);
    return movement;
  }
  if (pathname === "/api/cash/close" && method === "POST") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "vendedor"]);
    assertStoreAccess(db, user, body.storeId || body.loja_id);
    const lojaId = body.storeId || body.loja_id;
    const requestedSessionId = normalize(body.sessao_caixa_id || body.sessionId);
    const session = requestedSessionId
      ? (db.sessoes_caixa || []).map(normalizeCashSession).find((item) => item.id === requestedSessionId && item.loja_id === lojaId && item.status === "aberto")
      : openCashSession(db, lojaId);
    if (!session) throw badRequest("Não há caixa pendente para fechar nesta loja.");
    const declared = {};
    for (const method of PAYMENT_METHODS) declared[method] = money(Number(body.valores_declarados?.[method] ?? body[method] ?? 0));
    const system = cashSystemTotals(db, session);
    Object.assign(session, {
      valores_declarados: declared,
      valores_sistema: system,
      diferenca: money(cashTotal(declared) - cashTotal(system)),
      status: "fechado",
      data_fechamento: nowIso()
    });
    return cashSessionPayload(db, session);
  }

  if (pathname === "/api/sales" && method === "GET") {
    return db.sales.filter((sale) => allowedStoreIds(db, user).includes(sale.storeId));
  }
  if (pathname.startsWith("/api/sales/") && pathname.endsWith("/cancel") && method === "POST") {
    requireRole(user, ["gestor"]);
    const saleId = pathname.split("/").slice(-2)[0];
    const sale = db.sales.find((item) => item.id === saleId);
    if (!sale) throw notFound("Venda não encontrada.");
    if (sale.status === "CANCELADA") throw badRequest("Venda já cancelada.");
    sale.status = "CANCELADA";
    sale.cancelada_em = nowIso();
    sale.cancelada_por = user.id;
    for (const item of sale.items || []) {
      for (const requirement of stockRequirementsForSaleItem(db, item)) {
        applyStockMovement(db, {
          type: "estorno_venda",
          productId: requirement.productId,
          quantity: requirement.quantity,
          saleId: sale.id,
          saleCode: sale.codigo_venda,
          reason: `Estorno automático da venda ${sale.codigo_venda}`,
          userId: user.id
        });
      }
    }
    const session = currentCashSession(db, sale.storeId, todayDate());
    for (const payment of effectiveSalePayments(sale)) {
      db.cashMovements.push({
        id: id("cash"),
        date: todayDate(),
        type: "saida",
        value: payment.valor,
        category: "Estorno",
        storeId: sale.storeId,
        saleId: sale.id,
        paymentMethod: payment.metodo,
        parcelas: payment.parcelas,
        sessao_caixa_id: session?.id || sale.sessao_caixa_id || null,
        description: `Estorno da venda ${sale.codigo_venda} - ${PAYMENT_LABELS[payment.metodo] || payment.metodo}`,
        createdAt: nowIso()
      });
    }
    for (const delivery of db.deliveryOrders || []) {
      if (delivery.saleId === sale.id) {
        delivery.status = "cancelada";
        delivery.updatedAt = nowIso();
      }
    }
    return { sale };
  }
  if (pathname === "/api/sales" && method === "POST") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "vendedor"]);
    assertStoreAccess(db, user, body.storeId);
    const cashSession = currentCashSession(db, body.storeId, todayDate());
    if (!cashSession) throw badRequest("Abra o caixa da loja antes de concluir novas vendas.");
    findActiveCustomer(db, body.customerId);
    const seller = findActiveVendedor(db, body.sellerId);
    if (!sellerStoreMatches(db, seller, body.storeId)) throw badRequest("Vendedor não está associado à loja da venda.");
    const items = Array.isArray(body.itens) ? body.itens : Array.isArray(body.items) ? body.items : [];
    if (!items.length) throw badRequest("Informe ao menos um item na venda.");

    const checkedItems = items.map((item) => {
      const product = findActiveProduct(db, item.produto_id || item.productId);
      const quantity = toNonNegativeInteger(item.quantidade ?? item.quantity, "Quantidade");
      if (quantity <= 0) throw badRequest("Quantidade deve ser maior que zero.");
      const unitPrice = item.preco_unitario === undefined && item.unitPrice === undefined
        ? product.salePrice
        : money(toPositiveNumber(item.preco_unitario ?? item.unitPrice, "Preço unitário"));
      const subtotal = money(unitPrice * quantity);
      return {
        productId: product.id,
        produto_id: product.id,
        name: product.name,
        nome: product.name,
        sku: product.sku,
        quantity,
        quantidade: quantity,
        unitPrice,
        preco_unitario: unitPrice,
        total: subtotal,
        subtotal
      };
    });
    const requestedByProduct = new Map();
    for (const item of checkedItems) {
      for (const requirement of stockRequirementsForSaleItem(db, item)) {
        requestedByProduct.set(requirement.productId, (requestedByProduct.get(requirement.productId) || 0) + requirement.quantity);
      }
    }
    for (const [productId, requested] of requestedByProduct.entries()) {
      const product = findActiveProduct(db, productId);
      const available = stockDepositQuantity(db, product.id);
      if (available < requested) throw badRequest(`Estoque insuficiente para ${product.name} no depósito central.`);
    }
    const totalBruto = money(checkedItems.reduce((sum, item) => sum + item.total, 0));
    const descontoAdicional = money(toNonNegativeNumber(body.desconto_adicional ?? body.discount ?? 0, "Desconto adicional"));
    if (descontoAdicional > totalBruto) throw badRequest("Desconto adicional não pode superar o total bruto.");
    const total = money(totalBruto - descontoAdicional);
    const paymentCheck = validateSalePayments(body, total);
    const codigoVenda = nextSaleCode(db);
    const sale = {
      id: id("sale"),
      codigo_venda: codigoVenda,
      date: body.date || todayDate(),
      customerId: body.customerId,
      sellerId: body.sellerId,
      sellerName: seller.nome,
      vendedorId: seller.id,
      vendedorNome: seller.nome,
      storeId: body.storeId,
      status: "CONCLUIDA",
      paymentMethod: paymentCheck.payments.length === 1 ? paymentCheck.payments[0].metodo : "multiplo",
      pagamentos: paymentCheck.payments,
      payments: paymentCheck.payments.map((payment) => ({ method: payment.metodo, value: payment.valor, installments: payment.parcelas })),
      total_pago: paymentCheck.totalPaid,
      troco: paymentCheck.troco,
      sessao_caixa_id: cashSession.id,
      items: checkedItems,
      itens: checkedItems.map((item) => ({
        produto_id: item.productId,
        nome: item.name,
        quantidade: item.quantity,
        preco_unitario: item.unitPrice,
        subtotal: item.total
      })),
      totalBruto,
      valor_bruto: totalBruto,
      desconto_adicional: descontoAdicional,
      discount: descontoAdicional,
      total,
      valor_total: total,
      hasDelivery: Boolean(body.hasDelivery),
      deliveryPerson: normalize(body.deliveryPerson),
      deliveryShift: normalize(body.deliveryShift || body.turno_entrega),
      turno_entrega: normalize(body.turno_entrega || body.deliveryShift),
      createdAt: nowIso()
    };
    if (sale.hasDelivery && !sale.deliveryPerson) throw badRequest("Entregador é obrigatório para venda com entrega.");

    for (const item of checkedItems) {
      const requirements = stockRequirementsForSaleItem(db, item);
      for (const requirement of requirements) {
      applyStockMovement(db, {
        type: "saida_venda",
          productId: requirement.productId,
          quantity: requirement.quantity,
        saleId: sale.id,
        saleCode: sale.codigo_venda,
          reason: requirement.productId === item.productId
            ? "Baixa automática por venda no depósito central"
            : `Baixa automática por kit ${item.name}`,
        userId: user.id
      });
      }
    }

    db.sales.push(sale);
    db.configuracoes_empresa = normalizeCompanySettings(db, {
      ...db.configuracoes_empresa,
      proximo_numero_pedido: sale.codigo_venda + 1
    });
    for (const payment of effectiveSalePayments(sale)) {
      db.cashMovements.push({
        id: id("cash"),
        date: sale.date,
        type: "entrada",
        value: payment.valor,
        category: "Venda",
        storeId: sale.storeId,
        saleId: sale.id,
        paymentMethod: payment.metodo,
        parcelas: payment.parcelas,
        sessao_caixa_id: cashSession.id,
        description: `Entrada automática da venda ${sale.codigo_venda} - ${PAYMENT_LABELS[payment.metodo] || payment.metodo}`,
        createdAt: nowIso()
      });
    }

    let deliveryOrder = null;
    if (sale.hasDelivery) {
      const customer = findActiveCustomer(db, sale.customerId);
      deliveryOrder = {
        id: id("del"),
        saleId: sale.id,
        customerId: customer.id,
        customerName: customerName(customer),
        customerPhone: customerPhone(customer),
        customerSecondaryPhone: customer.telefone_secundario || "",
        customerAddress: {
          logradouro: customer.logradouro || "",
          numero: customer.numero || "",
          bairro: customer.bairro || "",
          complemento: customer.complemento || "",
          cidade: customer.cidade || "",
          referencia: customer.referencia || ""
        },
        address: formatCustomerAddress(customer),
        products: checkedItems.map((item) => `${item.quantity}x ${item.name}`),
        items: checkedItems.map((item) => ({ productId: item.productId, name: item.name, sku: item.sku, quantity: item.quantity })),
        storeId: sale.storeId,
        saleCode: sale.codigo_venda,
        deliveryPerson: sale.deliveryPerson,
        scheduledDate: body.deliveryDate || sale.date,
        deliveryShift: sale.deliveryShift || "Horário Comercial",
        turno_entrega: sale.turno_entrega || sale.deliveryShift || "Horário Comercial",
        status: "pendente",
        createdAt: nowIso()
      };
      db.deliveryOrders.push(deliveryOrder);
    }

    return { sale, deliveryOrder };
  }

  if (pathname === "/api/cash" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "vendedor"]);
    const storeFilter = url.searchParams.get("storeId") || "";
    if (storeFilter) assertStoreAccess(db, user, storeFilter);
    const stores = storeFilter ? [storeFilter] : allowedStoreIds(db, user);
    const movements = db.cashMovements.filter((movement) => stores.includes(movement.storeId));
    const balancesByStore = db.stores
      .filter((store) => stores.includes(store.id))
      .map((store) => ({
        storeId: store.id,
        storeName: store.name,
        balance: money(db.cashMovements
          .filter((movement) => movement.storeId === store.id)
          .reduce((sum, movement) => sum + (movement.type === "entrada" ? movement.value : -movement.value), 0))
      }));
    return {
      movements,
      balancesByStore,
      consolidated: money(balancesByStore.reduce((sum, row) => sum + row.balance, 0)),
      sessoes: (db.sessoes_caixa || []).filter((session) => stores.includes(session.loja_id)).map((session) => cashSessionPayload(db, session)),
      sessoesAbertas: stores.map((storeId) => currentCashSession(db, storeId, todayDate())).filter(Boolean).map((session) => cashSessionPayload(db, session)),
      sessoesPendentes: (db.sessoes_caixa || [])
        .map(normalizeCashSession)
        .filter((session) => stores.includes(session.loja_id) && session.status === "aberto")
        .sort((a, b) => String(a.data_abertura).localeCompare(String(b.data_abertura)))
        .map((session) => cashSessionPayload(db, session))
    };
  }
  if (pathname === "/api/cash" && method === "POST") {
    requireRole(user, ["gestor"]);
    assertStoreAccess(db, user, body.storeId);
    if (!["entrada", "saida"].includes(body.type)) throw badRequest("Tipo de caixa inválido.");
    const movement = {
      id: id("cash"),
      date: body.date || todayDate(),
      type: body.type,
      value: money(toPositiveNumber(body.value, "Valor")),
      category: normalize(body.category),
      storeId: body.storeId,
      saleId: null,
      description: normalize(body.description),
      createdAt: nowIso()
    };
    if (!movement.category) throw badRequest("Categoria é obrigatória.");
    db.cashMovements.push(movement);
    return movement;
  }

  if (pathname === "/api/bills" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja"]);
    const manualBills = db.bills.filter((bill) => allowedStoreIds(db, user).includes(bill.storeId));
    const purchaseBills = ["ADMINISTRADOR", "GESTOR_FINANCEIRO"].includes(userPapel(user))
      ? (db.contas_a_pagar || []).map((bill) => ({
          ...bill,
          supplier: bill.fornecedor,
          value: bill.valor,
          dueDate: bill.data_vencimento,
          paidAt: bill.pago_em || null,
          createdAt: bill.criado_em,
          source: "compra"
        }))
      : [];
    return [...manualBills, ...purchaseBills].sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  }
  if (pathname === "/api/bills" && method === "POST") {
    requireRole(user, ["gestor"]);
    assertStoreAccess(db, user, body.storeId);
    const bill = {
      id: id("bill"),
      supplier: normalize(body.supplier),
      value: money(toPositiveNumber(body.value, "Valor")),
      dueDate: body.dueDate,
      status: "pendente",
      storeId: body.storeId,
      paidAt: null,
      createdAt: nowIso()
    };
    if (!bill.supplier || !bill.dueDate) throw badRequest("Fornecedor e vencimento são obrigatórios.");
    db.bills.push(bill);
    return bill;
  }
  if (pathname.startsWith("/api/bills/") && method === "PUT") {
    requireRole(user, ["gestor"]);
    const billId = pathname.split("/").pop();
    const bill = db.bills.find((item) => item.id === billId) || (db.contas_a_pagar || []).find((item) => item.id === billId);
    if (!bill) throw notFound();
    const status = body.status || bill.status;
    if (!BILL_STATUS.includes(status)) throw badRequest("Status inválido.");
    if (bill.status === "pago") throw badRequest("Esta conta já foi quitada.");
    if (status !== "pago") throw badRequest("Uma conta pendente só pode ser quitada nesta operação.");
    const storeId = normalize(bill.storeId || bill.loja_id || body.storeId);
    assertStoreAccess(db, user, storeId);
    const paymentMethod = normalize(body.paymentMethod || body.metodo_pagamento || "pix").toLowerCase();
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw badRequest("Forma de pagamento inválida.");
    const paidAt = body.paidAt || body.pago_em || todayDate();
    bill.status = "pago";
    bill.paidAt = paidAt;
    if (Object.prototype.hasOwnProperty.call(bill, "data_vencimento")) bill.pago_em = paidAt;
    db.cashMovements.push({
      id: id("cash"),
      date: paidAt,
      type: "saida",
      value: money(Number(bill.value ?? bill.valor ?? 0)),
      category: "Conta a pagar",
      storeId,
      billId: bill.id,
      paymentMethod,
      description: `Quitação de conta - ${bill.supplier || bill.fornecedor || "Fornecedor"}`,
      createdAt: nowIso()
    });
    return bill;
  }

  if (pathname === "/api/deliveries" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja"]);
    const saleStoreMap = new Map(db.sales.map((sale) => [sale.id, sale.storeId]));
    return db.deliveryOrders
      .filter((delivery) => allowedStoreIds(db, user).includes(saleStoreMap.get(delivery.saleId)))
      .sort((a, b) => `${a.scheduledDate}${a.deliveryPerson}`.localeCompare(`${b.scheduledDate}${b.deliveryPerson}`));
  }
  if (pathname === "/api/entregas/kanban/columns" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja"]);
    return db.kanban_entregas_colunas.slice().sort((a, b) => a.order - b.order);
  }
  if (pathname === "/api/entregas/kanban/columns" && method === "POST") {
    requireRole(user, ["gestor"]);
    const title = normalize(body.title || body.titulo);
    const baseSlug = normalize(body.slug || title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!title || !baseSlug) throw badRequest("Informe um título válido para a coluna.");
    let slug = baseSlug;
    let suffix = 2;
    while (db.kanban_entregas_colunas.some((column) => column.slug === slug)) slug = `${baseSlug}_${suffix++}`;
    const column = { id: id("delivery_col"), title, slug, order: db.kanban_entregas_colunas.length + 1 };
    db.kanban_entregas_colunas.push(column);
    Object.defineProperty(column, "__httpStatus", { value: 201, enumerable: false });
    return column;
  }
  if (pathname === "/api/entregas/kanban/columns/reorder" && method === "PUT") {
    requireRole(user, ["gestor"]);
    const orderedIds = Array.isArray(body.columnIds) ? body.columnIds : Array.isArray(body.columns) ? body.columns : [];
    if (orderedIds.length !== db.kanban_entregas_colunas.length || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((columnId) => !db.kanban_entregas_colunas.some((column) => column.id === columnId))) throw badRequest("A ordenação das colunas é inválida.");
    db.kanban_entregas_colunas.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    db.kanban_entregas_colunas.forEach((column, index) => { column.order = index + 1; });
    return db.kanban_entregas_colunas;
  }
  if (pathname.startsWith("/api/entregas/kanban/columns/") && method === "DELETE") {
    requireRole(user, ["gestor"]);
    const columnId = pathname.split("/").pop();
    const column = db.kanban_entregas_colunas.find((item) => item.id === columnId);
    if (!column) throw notFound("Coluna não encontrada.");
    if ((db.deliveryOrders || []).some((delivery) => delivery.status === column.slug)) throw badRequest("Não é possível remover uma coluna que possui entregas.");
    if (db.kanban_entregas_colunas.length === 1) throw badRequest("O Kanban precisa manter ao menos uma coluna.");
    db.kanban_entregas_colunas = db.kanban_entregas_colunas.filter((item) => item.id !== columnId).map((item, index) => ({ ...item, order: index + 1 }));
    return { ok: true };
  }
  if (pathname.startsWith("/api/deliveries/") && method === "PUT") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja"]);
    const delivery = db.deliveryOrders.find((item) => item.id === pathname.split("/").pop());
    if (!delivery) throw notFound();
    const sale = db.sales.find((item) => item.id === delivery.saleId);
    assertStoreAccess(db, user, sale.storeId);
    const requestedStatus = canonicalDeliveryStatus(body.status);
    const dynamicStatuses = (db.kanban_entregas_colunas || []).map((column) => canonicalDeliveryStatus(column.slug || column.status));
    const validStatuses = new Set([...DELIVERY_STATUS, "a_separar", ...dynamicStatuses]);
    if (!validStatuses.has(requestedStatus)) throw badRequest("Status de entrega inválido.");
    delivery.status = requestedStatus;
    delivery.updatedAt = nowIso();
    return delivery;
  }

  if (pathname === "/api/reports" && method === "GET") {
    requireRole(user, ["gestor", "gestor_financeiro", "gerente_loja", "estoque"]);
    return reportData(db, user, url.searchParams);
  }

  throw notFound("Rota não encontrada.");
}

class URLSearchParamsLike {
  constructor(values) {
    this.values = values;
  }

  get(key) {
    return this.values[key] || "";
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" || url.pathname === "/ativar-conta" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function createServer({ dbPath = DEFAULT_DB_PATH } = {}) {
  const store = new JsonStore(dbPath);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (!url.pathname.startsWith("/api/")) {
        serveStatic(req, res, url);
        return;
      }
      const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await parseBody(req) : {};
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const session = token ? store.data.sessions.find((item) => item.token === token) : null;
      const user = session ? store.data.usuarios.find((item) => item.id === session.userId && item.ativo !== false) : null;
      const result = await api(store.data, req, res, url, body, user);
      store.save();
      sendJson(res, 200, result);
    } catch (error) {
      const status = error.status || 500;
      sendJson(res, status, { error: error.message || "Erro interno." });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`ERP MVP disponível em http://localhost:${PORT}`);
    console.log("Usuários iniciais: gestor, gerente1, gerente2, estoque. Senha: 123456");
  });
}

module.exports = { createServer, seedData, passwordHash, JsonStore, api };
