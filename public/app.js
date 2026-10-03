const app = document.querySelector("#app");

const ACCENT_PRESETS = [
  ["#2563eb", "Azul"],
  ["#7c3aed", "Roxo"],
  ["#10b981", "Esmeralda"],
  ["#f59e0b", "Âmbar"],
  ["#52525b", "Grafite"]
];

function validHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function readThemePreference() {
  return localStorage.getItem("erp_theme") === "dark" ? "dark" : "light";
}

function readAccentPreference() {
  const value = localStorage.getItem("erp_accent");
  return validHexColor(value) ? value.toLowerCase() : "#2563eb";
}

function readDeliveryViewPreference() {
  return localStorage.getItem("erp_deliveries_view") === "kanban" ? "kanban" : "table";
}

function hexToRgb(hex) {
  const normalized = validHexColor(hex) ? hex.slice(1) : "2563eb";
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function shiftHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const shift = (channel) => Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, "0");
  return `#${shift(r)}${shift(g)}${shift(b)}`;
}

function applyThemePreference({ persist = false } = {}) {
  const accent = validHexColor(state.visual.accent) ? state.visual.accent.toLowerCase() : "#2563eb";
  const theme = state.visual.theme === "dark" ? "dark" : "light";
  const { r, g, b } = hexToRgb(accent);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--accent-color", accent);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-hover", shiftHex(accent, theme === "dark" ? 24 : -22));
  document.documentElement.style.setProperty("--accent-strong", shiftHex(accent, theme === "dark" ? 24 : -22));
  document.documentElement.style.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, ${theme === "dark" ? 0.18 : 0.1})`);
  document.documentElement.style.setProperty("--accent-ring", `rgba(${r}, ${g}, ${b}, ${theme === "dark" ? 0.3 : 0.18})`);
  if (persist) {
    localStorage.setItem("erp_theme", theme);
    localStorage.setItem("erp_accent", accent);
  }
}

const state = {
  token: localStorage.getItem("erp_token") || "",
  user: null,
  bootstrap: null,
  view: "home",
  cadastrosOpen: true,
  salesTab: "new",
  settingsTab: "company",
  saleCart: [],
  salePayments: [],
  stockHistory: null,
  productKitComponents: [],
  saleDraft: {
    storeId: "",
    customerId: "",
    sellerId: "",
    productId: "",
    discount: 0,
    hasDelivery: "false",
    deliveryPerson: "",
    deliveryDate: today()
  },
  homePeriod: "month",
  homeCategory: "",
  lastSaleId: "",
  userEditor: null,
  inviteEditorOpen: false,
  passwordUserId: "",
  approvalUserId: "",
  approvalRequestId: "",
  loginMode: "login",
  accessRequestSuccess: false,
  publicStores: [],
  purchaseFilter: "TODAS",
  purchaseSearch: "",
  purchaseOrderOpen: false,
  purchaseReceiveId: "",
  purchaseDetailId: "",
  deliveriesView: readDeliveryViewPreference(),
  deliveriesSearch: "",
  deliveriesPerson: "",
  deliveryColumnFormOpen: false,
  visual: {
    theme: readThemePreference(),
    accent: readAccentPreference()
  },
  activation: {
    token: "",
    invite: null,
    loading: false
  },
  message: "",
  error: "",
  data: {
    products: [],
    customers: [],
    stock: [],
    sales: [],
    cash: null,
    bills: [],
    purchaseOrders: [],
    purchaseSummary: null,
    deliveries: [],
    deliveryKanbanColumns: [],
    botIntegration: null,
    showroomMovements: [],
    fornecedores: [],
    vendedores: [],
    convites: [],
    accessRequests: [],
    lojas: [],
    users: [],
    config: null,
    overview: null,
    reports: null
  }
};

applyThemePreference();

const views = [
  ["home", "Home", ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA"]],
  ["products", "Produtos", ["ADMINISTRADOR", "GERENTE_LOJA", "ESTOQUE"]],
  ["customers", "Clientes", ["ADMINISTRADOR", "GERENTE_LOJA"]],
  ["vendedores", "Vendedores", ["ADMINISTRADOR", "GERENTE_LOJA"]],
  ["fornecedores", "Fornecedores", ["ADMINISTRADOR", "GERENTE_LOJA", "ESTOQUE"]],
  ["purchases", "Compras", ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA", "ESTOQUE"]],
  ["stock", "Estoque", ["ADMINISTRADOR", "GERENTE_LOJA", "ESTOQUE"]],
  ["showroom", "Showroom", ["ADMINISTRADOR", "ESTOQUE"]],
  ["sales", "Vendas", ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA", "OPERADOR_CAIXA"]],
  ["deliveries", "Entregas", ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA"]],
  ["finance", "Financeiro", ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA", "OPERADOR_CAIXA"]],
  ["reports", "Relatórios", ["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA", "ESTOQUE"]],
  ["integrations", "Integrações", ["ADMINISTRADOR"]],
  ["settings", "Configurações", ["ADMINISTRADOR"]]
];

const CADASTRO_VIEW_IDS = ["products", "customers", "vendedores", "fornecedores"];

const ICONS = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  products: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  customers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  vendedores: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M15 6h4v4"/><path d="m19 6-5 5"/></svg>',
  fornecedores: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>',
  purchases: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12l2 5H4l2-5Z"/><path d="M5 7v14h14V7"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>',
  stock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
  showroom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16"/><path d="M5 10l1-6h12l1 6"/><path d="M6 10v10h12V10"/><path d="M9 20v-6h6v6"/></svg>',
  sales: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>',
  deliveries: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17h4V5H2v12h3"/><path d="M14 8h4l4 4v5h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>',
  finance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v13H3z"/><path d="M3 10h18"/><path d="M7 15h4"/><path d="M16 15h1"/></svg>',
  reports: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6 1.8 1.8 0 0 0-.45 1.2V21a2 2 0 1 1-4 0v-.09A1.8 1.8 0 0 0 8.6 19.4a1.8 1.8 0 0 0-1.98-.36l-.08.04a2 2 0 1 1-2-3.46l.08-.04A1.8 1.8 0 0 0 5.6 14a1.8 1.8 0 0 0-.6-1 1.8 1.8 0 0 0-1.2-.45H3.7a2 2 0 1 1 0-4h.09A1.8 1.8 0 0 0 5.6 7.6a1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 10 4.6a1.8 1.8 0 0 0 1-.6 1.8 1.8 0 0 0 .45-1.2V2.7a2 2 0 1 1 4 0v.09A1.8 1.8 0 0 0 16.4 4.6a1.8 1.8 0 0 0 1.98.36l.08-.04a2 2 0 1 1 2 3.46l-.08.04A1.8 1.8 0 0 0 18.4 10c.01.36.12.7.32 1 .2.3.5.52.84.64h.09a2 2 0 1 1 0 4h-.09A1.8 1.8 0 0 0 19.4 15Z"/></svg>',
  integrations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12h8"/><path d="M7 8V5a2 2 0 0 1 2-2h2v5"/><path d="M17 16v3a2 2 0 0 1-2 2h-2v-5"/><path d="M7 16v3a2 2 0 0 0 2 2h2v-5"/><path d="M17 8V5a2 2 0 0 0-2-2h-2v5"/></svg>',
  cadastros: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="M18 16v6"/><path d="M15 19h6"/></svg>'
};

const MODULE_META = {
  home: ["Painel Comercial", "Indicadores de vendas, margem, estoque e pagamentos.", "H"],
  products: ["Cadastro de Produtos", "Catálogo, fornecedores, medidas, preços e kits.", "P"],
  customers: ["Cadastro de Clientes", "Contatos e endereços preparados para vendas e entregas.", "C"],
  vendedores: ["Gestão de Vendedores", "Equipe comercial ativa por loja e histórico de vendas.", "V"],
  fornecedores: ["Gestão de Fornecedores", "Base de marcas, fabricantes e representantes comerciais.", "F"],
  purchases: ["Gestão de Compras", "Reposição integrada ao estoque, custos e contas a pagar.", "OC"],
  stock: ["Estoque Central", "Depósito disponível para venda e saldos físicos de showroom.", "E"],
  showroom: ["Movimentação de Showroom", "Envios e retornos entre depósito central e mostruários.", "S"],
  sales: ["Módulo Comercial & Vendas", "PDV, pedidos com múltiplos itens e comprovantes.", "R$"],
  deliveries: ["Entregas", "Ordens geradas pelas vendas e acompanhamento operacional.", "En"],
  finance: ["Financeiro", "Caixa, contas a pagar e saldos por loja.", "Fi"],
  reports: ["Relatórios", "Filtros de período, loja e exportações operacionais.", "Re"],
  settings: ["Configurações", "Dados da empresa, recibos e controle de acessos.", "Cfg"],
  integrations: ["Integrações", "Conexões externas e acesso do assistente de vendas.", "Int"]
};

const STANDARD_PRODUCT_SIZES = {
  Solteiro: { largura: 88, comprimento: 188 },
  Casal: { largura: 138, comprimento: 188 },
  Queen: { largura: 158, comprimento: 198 },
  King: { largura: 193, comprimento: 203 },
  "Sob Medida": { largura: "", comprimento: "" }
};

const COMPANY_NAME = "Rede de Móveis e Colchões";
const PAYMENT_LABELS = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto"
};

const PAYMENT_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function byId(list, id) {
  return list.find((item) => item.id === id) || {};
}

const USER_PAPEIS = [
  ["ADMINISTRADOR", "Administrador"],
  ["GESTOR_FINANCEIRO", "Gestor Financeiro"],
  ["GERENTE_LOJA", "Gerente Loja"],
  ["OPERADOR_CAIXA", "Operador de Caixa"],
  ["ESTOQUE", "Estoque"]
];

function currentPapel() {
  return state.user?.papel || {
    gestor: "ADMINISTRADOR",
    gestor_financeiro: "GESTOR_FINANCEIRO",
    gerente_loja: "GERENTE_LOJA",
    vendedor: "OPERADOR_CAIXA",
    estoque: "ESTOQUE"
  }[state.user?.role] || state.user?.role || "";
}

function hasPapel(papeis) {
  return papeis.includes(currentPapel());
}

function allowed(view) {
  return hasPapel(view[2]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Erro na operação.");
  return payload;
}

async function safeLoad(path, fallback) {
  try {
    return await api(path);
  } catch {
    return fallback;
  }
}

async function loadData() {
  if (!state.token) return;
  state.bootstrap = await api("/api/bootstrap");
  state.user = state.bootstrap.user;
  state.data.config = state.bootstrap.configuracoes_empresa || null;
  state.data.products = await safeLoad("/api/products", []);
  state.data.customers = await safeLoad("/api/customers", []);
  state.data.stock = await safeLoad("/api/stock", []);
  state.data.sales = await safeLoad("/api/sales", []);
  state.data.cash = await safeLoad("/api/cash", null);
  state.data.bills = await safeLoad("/api/bills", []);
  state.data.purchaseOrders = await safeLoad("/api/compras/ordens", []);
  state.data.purchaseSummary = await safeLoad("/api/compras/resumo", null);
  state.data.deliveries = await safeLoad("/api/deliveries", []);
  state.data.deliveryKanbanColumns = await safeLoad("/api/entregas/kanban/columns", []);
  state.data.showroomMovements = await safeLoad("/api/showroom/movements", []);
  state.data.fornecedores = await safeLoad("/api/fornecedores", []);
  state.data.vendedores = await safeLoad("/api/vendedores", []);
  state.data.botIntegration = currentPapel() === "ADMINISTRADOR" ? await safeLoad("/api/bot/token", null) : null;
  state.data.lojas = currentPapel() === "ADMINISTRADOR" ? await safeLoad("/api/lojas", state.bootstrap.lojas || []) : state.bootstrap.lojas || [];
  state.data.users = currentPapel() === "ADMINISTRADOR" ? await safeLoad("/api/users", []) : [];
  state.data.accessRequests = currentPapel() === "ADMINISTRADOR" ? await safeLoad("/api/admin/access-requests", []) : [];
  state.data.convites = currentPapel() === "ADMINISTRADOR" ? await safeLoad("/api/convites", []) : [];
  await loadOverview();
}

async function loadOverview() {
  const params = new URLSearchParams({
    period: state.homePeriod,
    category: state.homeCategory
  });
  state.data.overview = await safeLoad(`/api/overview?${params}`, null);
}

function storesOptions(selected = "") {
  return (state.bootstrap?.stores || [])
    .map((store) => `<option value="${store.id}" ${selected === store.id ? "selected" : ""}>${esc(store.name)}</option>`)
    .join("");
}

function userStoreId() {
  const lojaId = state.user?.loja_id || state.user?.storeId || "";
  return lojaId === "TODAS" ? "" : lojaId;
}

function isStoreScopedUser() {
  return ["GERENTE_LOJA", "OPERADOR_CAIXA"].includes(currentPapel()) && Boolean(userStoreId());
}

function storeName(storeId) {
  const store = byId(state.bootstrap?.stores || [], storeId);
  return store.name || store.nome || storeId || "";
}

function productsOptions(selected = "") {
  return state.data.products
    .filter((product) => product.active !== false)
    .map((product) => `<option value="${product.id}" ${selected === product.id ? "selected" : ""}>${esc(product.name)} - ${esc(product.sku)}</option>`)
    .join("");
}

function suppliersOptions(selected = "") {
  const activeSuppliers = state.data.fornecedores.filter((supplier) => supplier.ativo !== false);
  return `<option value="">Selecione um fornecedor</option>${activeSuppliers
    .map((supplier) => `<option value="${supplier.id}" ${selected === supplier.id ? "selected" : ""}>${esc(supplier.nome_fantasia)} - ${esc(supplier.cnpj)}</option>`)
    .join("")}`;
}

function customersOptions(selected = "") {
  return state.data.customers
    .filter((customer) => customer.ativo !== false && customer.active !== false)
    .map((customer) => `<option value="${customer.id}" ${selected === customer.id ? "selected" : ""}>${esc(customerDisplayName(customer))}</option>`)
    .join("");
}

function sellerMatchesStore(seller, storeId) {
  if (!storeId) return true;
  const storeLabel = storeName(storeId);
  return seller.loja_padrao === "Ambas" || seller.loja_id === storeId || seller.storeId === storeId || seller.loja_padrao === storeLabel;
}

function sellersOptions(selected = "", storeId = "") {
  const sellers = state.data.vendedores.length ? state.data.vendedores : (state.bootstrap?.vendedores || []);
  return sellers
    .filter((seller) => seller.ativo !== false)
    .filter((seller) => sellerMatchesStore(seller, storeId))
    .map((seller) => `<option value="${seller.id}" ${selected === seller.id ? "selected" : ""}>${esc(seller.nome)} - ${esc(seller.loja_padrao)}</option>`)
    .join("");
}

function lojaPadraoOptions(selected = "Loja 1") {
  const storeOptions = (state.bootstrap?.stores || [])
    .map((store) => `<option value="${store.id}" ${selected === store.id ? "selected" : ""}>${esc(store.name || store.nome)}</option>`)
    .join("");
  return `${storeOptions}<option value="Ambas" ${selected === "Ambas" ? "selected" : ""}>Ambas</option>`;
}

function sellerStoreValue(seller) {
  if (seller?.loja_padrao === "Ambas") return "Ambas";
  if (seller?.loja_id || seller?.storeId) return seller.loja_id || seller.storeId;
  return (state.bootstrap?.stores || []).find((store) => (store.name || store.nome) === seller?.loja_padrao)?.id || "";
}

function storeStatus(loja) {
  return loja.ativa === false || loja.active === false || loja.status === "inativo" ? "inativo" : "ativo";
}

function lojaAddress(loja) {
  const endereco = loja?.endereco || {};
  return [endereco.logradouro || loja?.address, endereco.bairro, endereco.cidade].filter(Boolean).join(" - ") || "-";
}

function fullStoreOptions(selected = "") {
  return (state.data.lojas || [])
    .filter((loja) => storeStatus(loja) === "ativo")
    .map((loja) => `<option value="${loja.id}" ${selected === loja.id ? "selected" : ""}>${esc(loja.nome || loja.name)}</option>`)
    .join("");
}

function paymentOptions() {
  return (state.bootstrap?.paymentMethods || []).map((method) => `<option value="${method}">${PAYMENT_LABELS[method] || method}</option>`).join("");
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function maskCep(value) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function maskPhone(value) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpfCnpj(value) {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function customerDisplayName(customer) {
  return customer?.nome || customer?.name || "";
}

function customerDisplayPhone(customer) {
  return customer?.telefone || customer?.phone || "";
}

function customerFormattedAddress(customer) {
  const logradouro = customer?.logradouro || customer?.endereco || customer?.address || "";
  const numero = customer?.numero || "";
  const complemento = customer?.complemento || "";
  const bairro = customer?.bairro || "";
  const referencia = customer?.referencia || "";
  const main = [logradouro, numero ? `Nº ${numero}` : "", complemento].filter(Boolean).join(", ");
  const bairroPart = bairro ? ` - ${bairro}` : "";
  const refPart = referencia ? ` (Ref: ${referencia})` : "";
  return `${main}${bairroPart}${refPart}`.trim();
}

function customerDistrictCity(customer) {
  return [customer?.bairro, customer?.cidade].filter(Boolean).join(" / ") || customerFormattedAddress(customer) || "-";
}

function productSupplierName(product) {
  return product?.fornecedor_nome || byId(state.data.fornecedores, product?.fornecedor_id).nome_fantasia || product?.brandModel || "-";
}

function productDimensions(product) {
  const largura = Number(product?.largura_cm || 0);
  const comprimento = Number(product?.comprimento_cm || 0);
  const altura = Number(product?.altura_cm || 0);
  const base = largura && comprimento ? `${largura}x${comprimento} cm` : "";
  return altura ? `${base}${base ? " / " : ""}Alt. ${altura} cm` : base || "-";
}

function productKitComponents(product) {
  const components = Array.isArray(product?.componentes_kit) ? product.componentes_kit : Array.isArray(product?.kitComponents) ? product.kitComponents : [];
  return components.map((component) => ({
    produto_id: component.produto_id || component.productId,
    quantidade: Number(component.quantidade ?? component.quantity ?? 0)
  })).filter((component) => component.produto_id && component.quantidade > 0);
}

function productMargin(price, cost) {
  const priceNumber = Number(price || 0);
  const costNumber = Number(cost || 0);
  const value = Math.max(0, priceNumber - costNumber);
  const percent = priceNumber > 0 ? (value / priceNumber) * 100 : 0;
  return { value, percent };
}

function saleItems(sale) {
  const items = Array.isArray(sale?.items) ? sale.items : Array.isArray(sale?.itens) ? sale.itens : [];
  return items.map((item) => {
    const productId = item.productId || item.produto_id || "";
    const product = byId(state.data.products, productId);
    const quantity = Number(item.quantity ?? item.quantidade ?? 0);
    const unitPrice = Number(item.unitPrice ?? item.preco_unitario ?? product.salePrice ?? 0);
    const total = Number(item.total ?? item.subtotal ?? unitPrice * quantity);
    return {
      productId,
      name: item.name || item.nome || product.name || "Produto",
      sku: item.sku || product.sku || "",
      quantity,
      unitPrice,
      total
    };
  });
}

function saleCode(sale) {
  return sale?.codigo_venda || sale?.saleCode || sale?.id || "";
}

function companyConfig() {
  return state.data.config || state.bootstrap?.configuracoes_empresa || {};
}

function storeConfig(storeId) {
  return companyConfig().lojas?.[storeId] || {};
}

function storeAddressFromConfig(storeId) {
  const config = storeConfig(storeId);
  return [config.logradouro, config.bairro, config.cidade].filter(Boolean).join(" - ");
}

function saleGrossTotal(sale) {
  return Number(sale?.totalBruto ?? sale?.valor_bruto ?? saleItems(sale).reduce((sum, item) => sum + item.total, 0));
}

function saleDiscount(sale) {
  return Number(sale?.desconto_adicional ?? sale?.discount ?? 0);
}

function saleFinalTotal(sale) {
  return Number(sale?.valor_total ?? sale?.total ?? Math.max(0, saleGrossTotal(sale) - saleDiscount(sale)));
}

function salePayments(sale) {
  const payments = Array.isArray(sale?.pagamentos) ? sale.pagamentos : Array.isArray(sale?.payments) ? sale.payments : [];
  const normalized = payments.map((payment) => ({
    metodo: payment.metodo || payment.method || payment.paymentMethod,
    valor: Number(payment.valor ?? payment.value ?? 0),
    parcelas: Number(payment.parcelas || payment.installments || 1)
  })).filter((payment) => payment.metodo && payment.valor > 0);
  if (normalized.length) return normalized;
  const total = saleFinalTotal(sale);
  return sale?.paymentMethod && total ? [{ metodo: sale.paymentMethod, valor: total, parcelas: 1 }] : [];
}

function paymentTotal() {
  return state.salePayments.reduce((sum, payment) => sum + Number(payment.valor || 0), 0);
}

function paymentChange() {
  return Math.max(0, paymentTotal() - cartFinalTotal());
}

function paymentRemaining() {
  return Math.max(0, cartFinalTotal() - paymentTotal());
}

function deliveryShiftOptions(selected = "") {
  return ["Manhã (08h às 12h)", "Tarde (13h às 18h)", "Horário Comercial"]
    .map((option) => `<option value="${option}" ${selected === option ? "selected" : ""}>${option}</option>`)
    .join("");
}

function saleStatusBadge(sale) {
  return sale?.status === "CANCELADA" ? '<span class="status danger">Cancelada</span>' : '<span class="status ok">Concluída</span>';
}

function hasOpenCashForStore(storeId) {
  return (state.data.cash?.sessoesAbertas || []).some((session) => session.loja_id === storeId);
}

function cartGrossTotal() {
  return state.saleCart.reduce((sum, item) => sum + item.total, 0);
}

function cartDiscount() {
  return Math.max(0, Number(state.saleDraft.discount || 0));
}

function cartFinalTotal() {
  return Math.max(0, cartGrossTotal() - cartDiscount());
}

function percent(value) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function paymentDonut(rows = []) {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  if (!total) {
    return `
      <div class="donut-empty">
        <div class="donut-placeholder"></div>
        <p class="muted">Sem vendas no período selecionado.</p>
      </div>
    `;
  }
  let offset = 0;
  const slices = rows.map((row, index) => {
    const value = Number(row.value || 0);
    const slice = (value / total) * 100;
    const circle = `
      <circle class="donut-slice" cx="50" cy="50" r="40" pathLength="100"
        stroke="${PAYMENT_COLORS[index % PAYMENT_COLORS.length]}"
        stroke-dasharray="${slice} ${100 - slice}"
        stroke-dashoffset="${-offset}"></circle>
    `;
    offset += slice;
    return circle;
  }).join("");
  return `
    <div class="payment-chart">
      <div class="donut-wrap">
        <svg class="donut-chart" viewBox="0 0 100 100" role="img" aria-label="Distribuição de formas de pagamento">
          <circle class="donut-track" cx="50" cy="50" r="40" pathLength="100"></circle>
          <g transform="rotate(-90 50 50)">${slices}</g>
        </svg>
        <div class="donut-center"><strong>${money(total)}</strong><span>Total</span></div>
      </div>
      <div class="payment-legend">
        ${rows.map((row, index) => `
          <div class="legend-row">
            <span class="legend-dot" style="background:${PAYMENT_COLORS[index % PAYMENT_COLORS.length]}"></span>
            <span>${esc(row.name || PAYMENT_LABELS[row.id] || row.id)}</span>
            <strong>${money(row.value)}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function categoryOptions() {
  const categories = [...new Set(state.data.products.map((product) => product.category).filter(Boolean))].sort();
  return `<option value="">Todas categorias</option>${categories
    .map((category) => `<option value="${esc(category)}" ${state.homeCategory === category ? "selected" : ""}>${esc(category)}</option>`)
    .join("")}`;
}

function showMessage() {
  if (state.error) return `<div class="message error">${esc(state.error)}</div>`;
  if (state.message) return `<div class="message">${esc(state.message)}</div>`;
  return "";
}

function setMessage(message, isError = false) {
  state.message = isError ? "" : message;
  state.error = isError ? message : "";
}

function publicStoreOptions(selected = "") {
  return `<option value="">Selecione a filial</option>${state.publicStores.map((store) => `<option value="${esc(store.id)}" ${selected === store.id ? "selected" : ""}>${esc(store.nome)}</option>`).join("")}`;
}

function renderLogin() {
  const requesting = state.loginMode === "request";
  app.innerHTML = `
    <main class="login">
      <section class="login-panel auth-card ${requesting ? "request-access-panel" : ""}">
        <div class="login-brand"><div><p class="auth-overline">EUROCONFORT</p><h1>${requesting ? "Solicitar acesso" : "Entrar no ERP"}</h1><p>${requesting ? "Seu pedido será revisado pela gestão." : "Use suas credenciais para continuar."}</p></div></div>
        ${showMessage()}
        ${requesting ? state.accessRequestSuccess ? `
          <div class="access-success" role="status">
            <span class="success-mark" aria-hidden="true">✓</span>
            <h2>Solicitação enviada</h2>
            <p>Recebemos sua solicitação. A gestão definirá suas permissões e enviará as instruções de acesso.</p>
          </div>
          <button class="login-link" id="back-to-login" type="button">Já possui acesso? Fazer login</button>
        ` : `
          <form id="access-request-form">
            <label>Nome completo <input name="nome" autocomplete="name" required></label>
            <label>E-mail corporativo <input name="email" type="email" autocomplete="email" required></label>
            <label>Cargo solicitado <input name="cargo_solicitado" placeholder="Ex.: Vendedor(a)" required></label>
            <label>Por que você precisa de acesso? <textarea name="justificativa" rows="3" minlength="8" required></textarea></label>
            <button type="submit">Enviar para aprovação</button>
          </form>
          <button class="login-link" id="back-to-login" type="button">Já possui acesso? Fazer login</button>
        ` : `
          <form id="login-form">
            <label>E-mail ou usuário <input name="username" autocomplete="username" required></label>
            <label>Senha <input name="password" type="password" autocomplete="current-password" required></label>
            <button type="submit">Entrar no ERP</button>
          </form>
          <div class="login-divider"><span>ou</span></div>
          <p class="login-request-copy">Ainda não possui acesso? <button class="login-link inline" id="request-access" type="button">Solicitar acesso</button></p>
        `}
      </section>
    </main>
  `;
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify(form) });
      state.token = result.token;
      state.user = result.user;
      localStorage.setItem("erp_token", state.token);
      await loadData();
      setMessage("Login realizado.");
      render();
    } catch (error) {
      setMessage(error.message, true);
      renderLogin();
    }
  });
  document.querySelector("#request-access")?.addEventListener("click", async () => {
    setMessage("");
    state.loginMode = "request";
    state.accessRequestSuccess = false;
      renderLogin();
  });
  document.querySelector("#back-to-login")?.addEventListener("click", () => {
    setMessage("");
    state.loginMode = "login";
    state.accessRequestSuccess = false;
    renderLogin();
  });
  document.querySelector("#access-request-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/auth/request-access", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      setMessage("");
      state.accessRequestSuccess = true;
      renderLogin();
    } catch (error) {
      setMessage(error.message, true);
      renderLogin();
    }
  });
}

async function loadActivationInvite(token) {
  state.activation = { token, invite: null, loading: true };
  setMessage("");
  try {
    state.activation.invite = await api(`/api/convites/validar?token=${encodeURIComponent(token)}`);
  } catch (error) {
    setMessage(error.message || "Este convite expirou ou já foi utilizado. Solicite um novo ao seu gestor.", true);
  } finally {
    state.activation.loading = false;
  }
}

async function renderActivation() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (state.activation.token !== token && !state.activation.loading) await loadActivationInvite(token);
  const invite = state.activation.invite;
  app.innerHTML = `
    <main class="login">
      <section class="login-panel activation-panel">
        <h1>Ativar Conta</h1>
        <p>Euroconfort ERP</p>
        ${showMessage()}
        ${state.activation.loading ? `<div class="message">Validando convite...</div>` : ""}
        ${invite ? `
          <form id="activation-form">
            <label>Nome completo <input value="${esc(invite.nome)}" readonly></label>
            <label>E-mail <input value="${esc(invite.email)}" readonly></label>
            <div class="grid-2">
              <label>Papel <input value="${esc(invite.papelLabel || invite.papel)}" readonly></label>
              <label>Loja <input value="${esc(linkedStoreLabel({ loja_id: invite.loja_id }))}" readonly></label>
            </div>
            <label>Defina sua Senha <input name="senha" type="password" minlength="4" required autocomplete="new-password"></label>
            <label>Confirme sua Senha <input name="confirmar_senha" type="password" minlength="4" required autocomplete="new-password"></label>
            <button type="submit">Ativar Conta</button>
          </form>
        ` : `<p class="muted">Este convite expirou ou já foi utilizado. Solicite um novo ao seu gestor.</p>`}
      </section>
    </main>
  `;
  document.querySelector("#activation-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/api/ativar-conta", {
        method: "POST",
        body: JSON.stringify({ token, ...form })
      });
      window.history.replaceState({}, "", "/");
      state.activation = { token: "", invite: null, loading: false };
      state.token = "";
      localStorage.removeItem("erp_token");
      setMessage("Conta ativada com sucesso. Entre usando seu e-mail e a senha definida.");
      renderLogin();
    } catch (error) {
      setMessage(error.message, true);
      renderActivation();
    }
  });
}

function viewConfig(id) {
  return views.find((view) => view[0] === id);
}

function renderNavButton(id, extraClass = "") {
  const view = viewConfig(id);
  if (!view || !allowed(view)) return "";
  const [, label] = view;
  const classes = [state.view === id ? "active" : "", extraClass].filter(Boolean).join(" ");
  return `<button class="${classes}" data-view="${id}" type="button"><span class="nav-icon" aria-hidden="true">${ICONS[id] || ""}</span><span>${label}</span></button>`;
}

function renderNav() {
  const cadastroItems = CADASTRO_VIEW_IDS.map((id) => viewConfig(id)).filter((view) => view && allowed(view));
  const cadastrosActive = CADASTRO_VIEW_IDS.includes(state.view);
  const cadastrosOpen = state.cadastrosOpen || cadastrosActive;
  const cadastroGroup = cadastroItems.length ? `
    <div class="nav-group ${cadastrosOpen ? "open" : ""} ${cadastrosActive ? "active-group" : ""}">
      <button class="nav-group-trigger ${cadastrosActive ? "active" : ""}" data-cadastros-toggle type="button" aria-expanded="${cadastrosOpen}">
        <span class="nav-label"><span class="nav-icon" aria-hidden="true">${ICONS.cadastros}</span><span>Cadastros</span></span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <div class="nav-submenu ${cadastrosOpen ? "" : "hidden"}">
        ${cadastroItems.map(([id]) => renderNavButton(id, "subnav")).join("")}
      </div>
    </div>
  ` : "";

  return [
    renderNavButton("home"),
    cadastroGroup,
    renderNavButton("stock"),
    renderNavButton("purchases"),
    renderNavButton("showroom"),
    renderNavButton("sales"),
    renderNavButton("deliveries"),
    renderNavButton("finance"),
    renderNavButton("reports"),
    renderNavButton("integrations"),
    renderNavButton("settings")
  ].join("");
}

function userInitial() {
  return esc((state.user?.name || "G").trim().charAt(0).toUpperCase());
}

function currentStoreId() {
  return userStoreId() || state.saleDraft.storeId || state.bootstrap?.stores?.[0]?.id || "";
}

function topbarStoreOptions() {
  const selected = currentStoreId();
  return (state.bootstrap?.stores || [])
    .map((store) => `<option value="${store.id}" ${selected === store.id ? "selected" : ""}>Unidade: ${esc(store.name)}</option>`)
    .join("");
}

function moduleHeader() {
  const [title, subtitle, icon] = MODULE_META[state.view] || ["ERP MVP", "Operação comercial integrada.", "ERP"];
  return `
    <div class="module-heading">
      <span class="module-icon" aria-hidden="true">${icon}</span>
      <div>
        <h1>${esc(title)}</h1>
        <p>${esc(subtitle)}</p>
      </div>
    </div>
  `;
}

function renderShell(content) {
  const nav = renderNav();
  const role = state.user.papelLabel || USER_PAPEIS.find(([papel]) => papel === currentPapel())?.[1] || currentPapel();
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-card">
          <span class="brand-logo" aria-hidden="true">DR</span>
          <div>
            <strong>ERP MVP</strong>
            <span class="version-label">v0.2.0</span>
          </div>
        </div>
        <nav class="nav">${nav}</nav>
        <div class="user-box">
          <span class="avatar" aria-hidden="true">${userInitial()}</span>
          <div>
            <strong>${esc(state.user.name)}</strong><br>
            <span>${esc(role)}</span>
          </div>
          <button class="secondary" id="logout" type="button">Sair</button>
        </div>
      </aside>
      <div class="main-shell">
        <header class="topbar">
          <label class="unit-select">
            <span class="topbar-glyph" aria-hidden="true">Lo</span>
            <select aria-label="Unidade ativa" ${isStoreScopedUser() ? "disabled" : ""}>${topbarStoreOptions()}</select>
          </label>
          <div class="topbar-actions">
            <label class="global-search" for="global-search">
              <span aria-hidden="true"></span>
              <input id="global-search" type="search" placeholder="Buscar no ERP">
              <kbd>Ctrl K</kbd>
            </label>
            <details class="avatar-menu">
              <summary><span class="avatar" aria-hidden="true">${userInitial()}</span></summary>
              <div class="avatar-popover">
                <strong>${esc(state.user.name)}</strong>
                <span>${esc(role)}</span>
              </div>
            </details>
          </div>
        </header>
        <main class="content">${moduleHeader()}${showMessage()}${content}</main>
      </div>
      <div id="print-root" aria-hidden="true"></div>
    </div>
  `;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      if (CADASTRO_VIEW_IDS.includes(state.view)) state.cadastrosOpen = true;
      if (state.view === "sales") state.salesTab = "new";
      if (state.view === "settings") state.settingsTab = "company";
      setMessage("");
      render();
    });
  });
  const cadastrosToggle = document.querySelector("[data-cadastros-toggle]");
  if (cadastrosToggle) {
    cadastrosToggle.addEventListener("click", () => {
      state.cadastrosOpen = !state.cadastrosOpen;
      render();
    });
  }
  document.querySelector("#logout").addEventListener("click", async () => {
    await safeLoad("/api/logout", {});
    localStorage.removeItem("erp_token");
    state.token = "";
    state.user = null;
    renderLogin();
  });
}

function renderHome() {
  const overview = state.data.overview || {};
  const maxSeller = Math.max(1, ...(overview.sellerRanking || []).map((row) => row.value));
  const maxProduct = Math.max(1, ...(overview.productRanking || []).map((row) => row.value));
  renderShell(`
    <section class="page">
      <div class="page-header">
        <div>
          <h1>Home</h1>
          <p class="muted">Período: ${esc(overview.from || "")} a ${esc(overview.to || "")}</p>
        </div>
        <div class="toolbar">
          <select id="home-period">
            <option value="day" ${state.homePeriod === "day" ? "selected" : ""}>Hoje</option>
            <option value="week" ${state.homePeriod === "week" ? "selected" : ""}>Semana</option>
            <option value="month" ${state.homePeriod === "month" ? "selected" : ""}>Mês</option>
          </select>
          <select id="home-category">${categoryOptions()}</select>
        </div>
      </div>
      <div class="metrics">
        <div class="metric">
          <span class="metric-icon">R$</span>
          <span>Faturamento</span>
          <strong>${money(overview.revenue)}</strong>
        </div>
        <div class="metric">
          <span class="metric-icon">#</span>
          <span>Vendas / Ticket</span>
          <strong>${overview.salesCount || 0}</strong>
          <small>Ticket: ${money(overview.averageTicket)}</small>
        </div>
        <div class="metric">
          <span class="metric-icon">%</span>
          <span>Margem Bruta Estimada</span>
          <strong>${percent(overview.grossMarginPercent)}</strong>
          <small>Lucro: ${money(overview.grossProfit)}</small>
        </div>
        <div class="metric">
          <span class="metric-icon">Cx</span>
          <span>Valor em Estoque</span>
          <strong>${money(overview.stockValue)}</strong>
          <small>${overview.lowStockCount || 0} itens com estoque baixo</small>
        </div>
      </div>
      <section class="panel payment-panel">
        <div>
          <h2>Formas de Pagamento</h2>
          <p class="muted">Distribuição PIX, Cartão e Dinheiro</p>
        </div>
        ${paymentDonut(overview.paymentMethods || [])}
      </section>
      <div class="grid-2">
        <section class="panel">
          <h2>Vendas por vendedor(a)</h2>
          <div class="rank">${rankRows(overview.sellerRanking || [], maxSeller, true)}</div>
        </section>
        <section class="panel">
          <h2>Produtos mais vendidos</h2>
          <div class="rank">${rankRows(overview.productRanking || [], maxProduct, false)}</div>
        </section>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>Marcas/modelos</h2>
          <div class="rank">${rankRows(overview.brandRanking || [], Math.max(1, ...(overview.brandRanking || []).map((row) => row.value)), false)}</div>
        </section>
        <section class="panel">
          <h2>Contas a pagar</h2>
          <div class="split-table">
            <table><thead><tr><th>Fornecedor</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>
              ${(overview.dueBills || []).map((bill) => `<tr><td>${esc(bill.supplier)}</td><td>${esc(bill.dueDate)}</td><td>${money(bill.value)}</td><td>${bill.dueDate < today() ? '<span class="status danger">Vencida</span>' : '<span class="status warn">Próxima</span>'}</td></tr>`).join("") || emptyRow(4)}
            </tbody></table>
          </div>
        </section>
      </div>
    </section>
  `);
  document.querySelector("#home-period").addEventListener("change", async (event) => {
    state.homePeriod = event.target.value;
    await loadOverview();
    renderHome();
  });
  document.querySelector("#home-category").addEventListener("change", async (event) => {
    state.homeCategory = event.target.value;
    await loadOverview();
    renderHome();
  });
}

function rankRows(rows, max, currency) {
  if (!rows.length) return '<p class="muted">Sem dados no período.</p>';
  return rows.slice(0, 6).map((row, index) => `
    <div class="rank-row">
      <span class="rank-badge">#${index + 1}</span>
      <div class="rank-label"><strong>${esc(row.name)}</strong><span>${currency ? money(row.value) : `${row.value} un.`}</span></div>
      <div class="bar"><span style="width:${Math.max(6, (row.value / max) * 100)}%"></span></div>
    </div>
  `).join("");
}

function emptyRow(cols) {
  return `<tr class="empty-row"><td colspan="${cols}" class="muted">Sem registros.</td></tr>`;
}

function emptySearchRow(cols) {
  return `<tr class="no-match-row hidden"><td colspan="${cols}" class="muted">Nenhum registro encontrado</td></tr>`;
}

function searchBox(id, placeholder = "Buscar") {
  return `
    <label class="search-box" for="${id}">
      <span aria-hidden="true"></span>
      <input id="${id}" type="search" autocomplete="off" placeholder="${esc(placeholder)}">
    </label>
  `;
}

function bindTableSearch(inputId, tableName) {
  const input = document.querySelector(`#${inputId}`);
  const table = document.querySelector(`[data-search-table="${tableName}"]`);
  if (!input || !table) return;
  const rows = [...table.querySelectorAll("tbody tr:not(.empty-row):not(.no-match-row)")];
  const empty = table.querySelector(".empty-row");
  const noMatch = table.querySelector(".no-match-row");
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const haystack = `${row.innerText} ${row.dataset.search || ""}`.toLowerCase();
      const matches = !query || haystack.includes(query);
      row.classList.toggle("hidden", !matches);
      if (matches) visible += 1;
    });
    if (empty) empty.classList.toggle("hidden", Boolean(query));
    if (noMatch) noMatch.classList.toggle("hidden", !query || visible > 0);
  });
}

function receiptHtml(sale) {
  if (!sale) return "";
  const items = saleItems(sale);
  const grossTotal = saleGrossTotal(sale);
  const discount = saleDiscount(sale);
  const finalTotal = saleFinalTotal(sale);
  const payments = salePayments(sale);
  const customer = byId(state.data.customers, sale.customerId);
  const store = byId(state.bootstrap?.stores || [], sale.storeId);
  const config = companyConfig();
  const currentStoreConfig = storeConfig(sale.storeId);
  const delivery = state.data.deliveries.find((item) => item.saleId === sale.id);
  const sellerName = sale.vendedorNome || sale.sellerName || byId(state.data.vendedores, sale.vendedorId || sale.sellerId).nome || "-";
  const deliveryStatus = sale.hasDelivery
    ? `Entrega agendada${delivery?.scheduledDate ? ` para ${delivery.scheduledDate}` : ""}${delivery?.status ? ` (${delivery.status})` : ""}`
    : "Retirada";
  const customerAddress = sale.hasDelivery ? delivery?.address || customerFormattedAddress(customer) || "" : "";

  return `
    <section class="print-receipt" aria-label="Comprovante de venda">
      <header class="receipt-header">
        <h1>${esc(config.marca_principal || COMPANY_NAME)}</h1>
        <p>${esc(currentStoreConfig.nome || store.name || "Loja")}${config.cnpj ? ` · CNPJ ${esc(config.cnpj)}` : ""}</p>
        ${storeAddressFromConfig(sale.storeId) ? `<p>${esc(storeAddressFromConfig(sale.storeId))}</p>` : ""}
        ${config.telefone_whatsapp ? `<p>Contato: ${esc(config.telefone_whatsapp)}</p>` : ""}
        <div class="receipt-meta">
          <span>Pedido: <strong>${esc(saleCode(sale))}</strong></span>
          <span>Status: <strong>${sale.status === "CANCELADA" ? "CANCELADA" : "CONCLUIDA"}</strong></span>
          <span>Data/Hora: <strong>${esc(formatDateTime(sale.createdAt || sale.date))}</strong></span>
        </div>
      </header>

      <section class="receipt-section">
        <h2>Cliente</h2>
        <p><strong>${esc(customerDisplayName(customer) || "-")}</strong></p>
        <p>Telefone: ${esc(customerDisplayPhone(customer) || "-")}</p>
        ${customerAddress ? `<p>Endereço: ${esc(customerAddress)}</p>` : ""}
      </section>

      <section class="receipt-section">
        <h2>Venda</h2>
        <p>Vendedor responsável: <strong>${esc(sellerName)}</strong></p>
      </section>

      <section class="receipt-section">
        <h2>Itens</h2>
        <table class="receipt-items">
          <thead><tr><th>Produto</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${esc(item.name)}<br><span>SKU: ${esc(item.sku)}</span></td>
                <td>${item.quantity}</td>
                <td>${money(item.unitPrice)}</td>
                <td>${money(item.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>

      <section class="receipt-totals">
        <div><span>Total bruto</span><strong>${money(grossTotal)}</strong></div>
        ${discount ? `<div><span>Desconto adicional</span><strong>${money(discount)}</strong></div>` : ""}
        <div><span>Pagamentos</span><strong>${payments.map((payment) => `${PAYMENT_LABELS[payment.metodo] || payment.metodo}: ${money(payment.valor)}${payment.parcelas > 1 ? ` (${payment.parcelas}x)` : ""}`).join(" / ") || "-"}</strong></div>
        ${sale.troco ? `<div><span>Troco</span><strong>${money(sale.troco)}</strong></div>` : ""}
        <div><span>Status da entrega</span><strong>${esc(deliveryStatus)}</strong></div>
        <div class="receipt-total"><span>Valor total</span><strong>${money(finalTotal)}</strong></div>
      </section>

      <footer class="receipt-footer">
        <p>Observações:</p>
        ${config.mensagem_rodape_garantia ? `<p>${esc(config.mensagem_rodape_garantia)}</p>` : ""}
        <div class="receipt-lines"></div>
        ${config.exibir_assinatura_cliente !== false ? '<div class="signature-line">Assinatura do cliente</div>' : ""}
      </footer>
    </section>
  `;
}

function printSaleReceipt(saleId) {
  const sale = state.data.sales.find((item) => item.id === saleId);
  if (!sale) {
    setMessage("Venda não encontrada para impressão.", true);
    renderSales();
    return;
  }
  const printRoot = document.querySelector("#print-root");
  printRoot.innerHTML = receiptHtml(sale);
  document.body.classList.add("is-printing-receipt");
  const cleanup = () => document.body.classList.remove("is-printing-receipt");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1000);
}

function productDeliveryDescription(item) {
  const product = byId(state.data.products, item.productId || item.produto_id);
  const dimensions = productDimensions(product);
  return `${item.quantity || item.quantidade}x ${item.name || item.nome || product.name || "Produto"}${dimensions !== "-" ? ` - ${dimensions}` : ""}`;
}

function deliveryOrderHtml(delivery) {
  const sale = state.data.sales.find((item) => item.id === delivery.saleId) || {};
  const customer = byId(state.data.customers, delivery.customerId || sale.customerId);
  const store = byId(state.bootstrap?.stores || [], delivery.storeId || sale.storeId);
  const config = companyConfig();
  const address = delivery.customerAddress || {};
  const items = saleItems(sale);
  return `
    <section class="print-receipt delivery-receipt" aria-label="Ordem de entrega">
      <header class="receipt-header">
        <h1>Ordem de Entrega / Romaneio</h1>
        <p>${esc(config.marca_principal || COMPANY_NAME)} - ${esc(store.name || store.nome || "Loja")}</p>
        <div class="receipt-meta">
          <span>Pedido: <strong>${esc(delivery.saleCode || saleCode(sale))}</strong></span>
          <span>Data/Turno: <strong>${esc(delivery.scheduledDate || "")} - ${esc(delivery.turno_entrega || delivery.deliveryShift || "Horário Comercial")}</strong></span>
        </div>
      </header>
      <section class="receipt-section">
        <h2>Cliente</h2>
        <p><strong>${esc(delivery.customerName || customerDisplayName(customer) || "-")}</strong></p>
        <p>Telefones: ${esc([delivery.customerPhone || customerDisplayPhone(customer), delivery.customerSecondaryPhone || customer.telefone_secundario].filter(Boolean).join(" / ") || "-")}</p>
        <p>Rua: ${esc(address.logradouro || customer.logradouro || "-")}</p>
        <p>Número: ${esc(address.numero || customer.numero || "-")} · Bairro: ${esc(address.bairro || customer.bairro || "-")} · Complemento: ${esc(address.complemento || customer.complemento || "-")}</p>
        <p>Ponto de referência: ${esc(address.referencia || customer.referencia || "-")}</p>
      </section>
      <section class="receipt-section">
        <h2>Produtos</h2>
        <table class="receipt-items">
          <thead><tr><th>Qtd.</th><th>Descrição</th></tr></thead>
          <tbody>${(items.length ? items : delivery.items || []).map((item) => `<tr><td>${item.quantity || item.quantidade}</td><td>${esc(productDeliveryDescription(item))}</td></tr>`).join("")}</tbody>
        </table>
      </section>
      <footer class="receipt-footer delivery-stub">
        <h2>Canhoto de Recebimento</h2>
        <p>Recebido por (Nome Legível): ___________________________________________</p>
        <p>RG / CPF: ___________________________________</p>
        <p>Data e Hora: ____/____/______ às ____:____</p>
        <p>Declaro ter recebido os produtos acima em perfeito estado e devidamente conferidos.</p>
        <div class="signature-line">Assinatura de quem recebeu</div>
      </footer>
    </section>
  `;
}

function printDeliveryOrder(deliveryId) {
  const delivery = state.data.deliveries.find((item) => item.id === deliveryId);
  if (!delivery) {
    setMessage("Entrega não encontrada para impressão.", true);
    renderDeliveries();
    return;
  }
  const printRoot = document.querySelector("#print-root");
  printRoot.innerHTML = deliveryOrderHtml(delivery);
  document.body.classList.add("is-printing-receipt");
  const cleanup = () => document.body.classList.remove("is-printing-receipt");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1000);
}

function bindReceiptButtons() {
  document.querySelectorAll("[data-print-sale]").forEach((button) => {
    button.addEventListener("click", () => printSaleReceipt(button.dataset.printSale));
  });
  document.querySelectorAll("[data-print-delivery]").forEach((button) => {
    button.addEventListener("click", () => printDeliveryOrder(button.dataset.printDelivery));
  });
}

function bindSaleCancelButtons() {
  document.querySelectorAll("[data-cancel-sale]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sale = state.data.sales.find((item) => item.id === button.dataset.cancelSale);
      if (!sale || !confirm(`Cancelar e estornar a venda ${saleCode(sale)}?`)) return;
      try {
        await api(`/api/sales/${sale.id}/cancel`, { method: "POST", body: JSON.stringify({}) });
        await loadData();
        setMessage(`Venda ${saleCode(sale)} cancelada e estornada.`);
        state.salesTab = "history";
        renderSales();
      } catch (error) {
        setMessage(error.message, true);
        renderSales();
      }
    });
  });
}

function stockMovementLabel(type) {
  return {
    ENTRADA: "Entrada",
    SAIDA_VENDA: "Saída por venda",
    ESTORNO_VENDA: "Estorno de venda",
    ENVIO_SHOWROOM: "Envio showroom",
    RETORNO_SHOWROOM: "Retorno showroom"
  }[type] || type || "-";
}

function stockMovementClass(type) {
  if (type === "SAIDA_VENDA") return "danger";
  if (type === "ESTORNO_VENDA") return "ok";
  if (type === "ENVIO_SHOWROOM") return "info";
  return "ok";
}

function stockMovementSignedQuantity(movement) {
  const quantity = Number(movement.quantidade || 0);
  const sign = ["SAIDA_VENDA", "ENVIO_SHOWROOM"].includes(movement.tipo) ? "-" : "+";
  return `${sign}${quantity}`;
}

function stockHistoryModal() {
  const history = state.stockHistory;
  if (!history) return "";
  const product = history.product || {};
  const movements = history.movements || [];
  return `
    <div class="modal-backdrop" data-close-stock-history>
      <section class="modal-card stock-history-modal" role="dialog" aria-modal="true" aria-labelledby="stock-history-title">
        <header class="modal-header">
          <div>
            <span class="eyebrow">Kardex do produto</span>
            <h2 id="stock-history-title">${esc(product.name || "Produto")}</h2>
            <p>${esc(product.sku || "-")} - ${esc(product.category || "-")} - Depósito central: <strong>${Number(product.saldo_deposito || 0)}</strong></p>
          </div>
          <button class="secondary small" type="button" data-close-stock-history>Fechar</button>
        </header>
        <div class="split-table">
          <table>
            <thead><tr><th>Data e hora</th><th>Tipo</th><th>Qtd.</th><th>Referência / origem</th><th>Saldo restante</th></tr></thead>
            <tbody>
              ${movements.map((movement) => `
                <tr>
                  <td>${esc(formatDateTime(movement.data_hora))}</td>
                  <td><span class="status ${stockMovementClass(movement.tipo)}">${esc(stockMovementLabel(movement.tipo))}</span></td>
                  <td><strong class="${["SAIDA_VENDA", "ENVIO_SHOWROOM"].includes(movement.tipo) ? "qty-negative" : "qty-positive"}">${esc(stockMovementSignedQuantity(movement))}</strong></td>
                  <td>${esc(movement.referencia || "-")}</td>
                  <td>${Number(movement.saldo_apos_movimentacao || 0)}</td>
                </tr>
              `).join("") || '<tr><td colspan="5" class="muted">Nenhuma movimentação registrada para este item.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function bindStockHistory() {
  document.querySelectorAll("[data-stock-history]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        state.stockHistory = await api(`/api/stock/movements?productId=${encodeURIComponent(button.dataset.stockHistory)}`);
        renderStock();
      } catch (error) {
        setMessage(error.message, true);
        renderStock();
      }
    });
  });
  document.querySelectorAll("[data-close-stock-history]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.currentTarget.classList.contains("modal-backdrop") && event.currentTarget !== event.target) return;
      state.stockHistory = null;
      renderStock();
    });
  });
}

function renderProducts() {
  const canEdit = hasPapel(["ADMINISTRADOR", "ESTOQUE"]);
  const activeProducts = state.data.products.filter((product) => product.active !== false);
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Produtos</h1></div>
      ${canEdit ? `
        <section class="panel">
          <h2>Novo produto</h2>
          <form id="product-form" class="form-grid">
            <input type="hidden" name="id">
            <input type="hidden" name="tamanho_padrao">
            <div class="grid-3">
              <label>Nome <input name="name" required></label>
              <label>Categoria <input name="category" required></label>
              <label>Fornecedor <select name="fornecedor_id">${suppliersOptions()}</select></label>
            </div>
            <div class="grid-3">
              <label>SKU <input name="sku" placeholder="Gerado automaticamente" readonly></label>
              <label>Estoque mínimo <input name="minStock" type="number" min="0" value="0"></label>
              <div></div>
            </div>
            <div class="form-subsection">
              <h3>Tamanho Padrão</h3>
              <div class="quick-buttons">
                ${Object.entries(STANDARD_PRODUCT_SIZES).map(([label, size]) => `<button class="secondary small" data-product-size="${esc(label)}" data-width="${size.largura}" data-length="${size.comprimento}" type="button">${esc(label)}</button>`).join("")}
              </div>
              <div class="grid-3">
                <label>Largura (cm) <input name="largura_cm" type="number" step="0.1" min="0"></label>
                <label>Comprimento (cm) <input name="comprimento_cm" type="number" step="0.1" min="0"></label>
                <label>Altura (cm) <input name="altura_cm" type="number" step="0.1" min="0"></label>
              </div>
            </div>
            <div class="form-subsection">
              <h3>Formação de Preço & Política Comercial</h3>
              <div class="grid-3">
                <label>Preço de Tabela (R$) <input name="preco_tabela" id="product-price-table" type="number" step="0.01" min="0.01" required></label>
                <label>Preço Mínimo / Piso (R$) <input name="preco_minimo" type="number" step="0.01" min="0"></label>
                <label>Custo Direto (CMV) (R$) <input name="custo_direto" id="product-direct-cost" type="number" step="0.01" min="0"></label>
              </div>
              <div class="margin-card" id="product-margin-card">
                <span>Margem Bruta Estimada</span>
                <strong>0,0% / ${money(0)}</strong>
              </div>
            </div>
            <div class="form-subsection">
              <label class="inline-check"><input name="produto_kit" id="product-is-kit" type="checkbox"> Produto é um Kit</label>
              <div id="kit-builder" class="kit-builder hidden">
                <div class="grid-3">
                  <label>Produto avulso <select id="kit-component-product">${activeProducts.map((product) => `<option value="${product.id}">${esc(product.name)} - ${esc(product.sku)}</option>`).join("")}</select></label>
                  <label>Quantidade <input id="kit-component-quantity" type="number" min="1" value="1"></label>
                  <button id="add-kit-component" type="button">Adicionar componente</button>
                </div>
                <div class="split-table cart-table">
                  <table><thead><tr><th>Componente</th><th>Qtd</th><th></th></tr></thead><tbody id="kit-components-body"></tbody></table>
                </div>
              </div>
            </div>
            <div class="grid-3">
              <button class="secondary" id="product-clear" type="button">Novo</button>
              <button type="submit">Salvar</button>
              <div></div>
            </div>
          </form>
        </section>
      ` : ""}
      <section class="panel">
        <h2>Lista</h2>
        ${searchBox("products-search", "Buscar produto, SKU, categoria ou fornecedor")}
        <div class="split-table">
          <table data-search-table="products">
            <thead><tr><th>Produto</th><th>Fornecedor</th><th>SKU</th><th>Categoria</th><th>Dimensões</th><th>Tabela</th><th>Estoque</th><th>Status</th><th></th></tr></thead>
            <tbody>${state.data.products.map((product) => `
              <tr data-search="${esc(product.id)} ${esc(product.name)} ${esc(product.sku)} ${esc(product.category)} ${esc(productSupplierName(product))}">
                <td><strong>${esc(product.name)}</strong>${product.produto_kit ? '<br><span class="tag">Kit</span>' : ""}</td>
                <td>${esc(productSupplierName(product))}</td>
                <td>${esc(product.sku)}</td>
                <td>${esc(product.category)}</td>
                <td>${esc(productDimensions(product))}</td>
                <td>${money(product.preco_tabela ?? product.salePrice)}</td>
                <td>${product.totalStock}</td>
                <td>${product.active === false ? '<span class="status danger">Inativo</span>' : product.lowStock ? '<span class="status warn">Baixo</span>' : '<span class="status ok">Ativo</span>'}</td>
                <td>${canEdit ? `<div class="row-actions"><button class="small secondary" data-edit-product="${product.id}" type="button">Editar</button><button class="small secondary" data-toggle-product="${product.id}" type="button">${product.active === false ? "Ativar" : "Inativar"}</button></div>` : ""}</td>
              </tr>
            `).join("") || emptyRow(9)}${emptySearchRow(9)}</tbody>
          </table>
        </div>
      </section>
    </section>
  `);
  bindTableSearch("products-search", "products");
  const form = document.querySelector("#product-form");
  if (form) {
    bindProductFormHelpers(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const productId = values.id;
      delete values.id;
      values.produto_kit = form.elements.produto_kit.checked;
      values.componentes_kit = values.produto_kit ? state.productKitComponents : [];
      try {
        await api(productId ? `/api/products/${productId}` : "/api/products", {
          method: productId ? "PUT" : "POST",
          body: JSON.stringify(values)
        });
        await loadData();
        state.productKitComponents = [];
        setMessage(productId ? "Produto atualizado." : "Produto cadastrado.");
        renderProducts();
      } catch (error) {
        setMessage(error.message, true);
        renderProducts();
      }
    });
    document.querySelector("#product-clear").addEventListener("click", () => {
      state.productKitComponents = [];
      form.reset();
      form.elements.id.value = "";
      updateProductMargin(form);
      renderKitComponents();
      document.querySelector("#kit-builder").classList.add("hidden");
    });
  }
  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = state.data.products.find((item) => item.id === button.dataset.editProduct);
      state.productKitComponents = productKitComponents(product);
      form.elements.id.value = product.id;
      form.elements.name.value = product.name;
      form.elements.category.value = product.category;
      form.elements.fornecedor_id.value = product.fornecedor_id || "";
      form.elements.sku.value = product.sku;
      form.elements.preco_tabela.value = product.preco_tabela ?? product.salePrice;
      form.elements.preco_minimo.value = product.preco_minimo || "";
      form.elements.custo_direto.value = product.custo_direto ?? product.costPrice;
      form.elements.minStock.value = product.minStock;
      form.elements.tamanho_padrao.value = product.tamanho_padrao || "";
      form.elements.largura_cm.value = product.largura_cm || "";
      form.elements.comprimento_cm.value = product.comprimento_cm || "";
      form.elements.altura_cm.value = product.altura_cm || "";
      form.elements.produto_kit.checked = Boolean(product.produto_kit);
      document.querySelector("#kit-builder").classList.toggle("hidden", !form.elements.produto_kit.checked);
      updateProductMargin(form);
      renderKitComponents(product.id);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-toggle-product]").forEach((button) => {
    button.addEventListener("click", async () => {
      const product = state.data.products.find((item) => item.id === button.dataset.toggleProduct);
      await api(`/api/products/${product.id}`, { method: "PUT", body: JSON.stringify({ active: product.active === false }) });
      await loadData();
      setMessage("Produto atualizado.");
      renderProducts();
    });
  });
}

function updateProductMargin(form) {
  const margin = productMargin(form.elements.preco_tabela.value, form.elements.custo_direto.value);
  const card = document.querySelector("#product-margin-card");
  if (!card) return;
  card.innerHTML = `
    <span>Margem Bruta Estimada</span>
    <strong>${margin.percent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% / ${money(margin.value)}</strong>
  `;
}

function renderKitComponents(currentProductId = "") {
  const body = document.querySelector("#kit-components-body");
  if (!body) return;
  body.innerHTML = state.productKitComponents.length ? state.productKitComponents.map((component, index) => {
    const product = byId(state.data.products, component.produto_id);
    return `
      <tr>
        <td><strong>${esc(product.name || "Produto")}</strong><br><span class="muted">SKU: ${esc(product.sku || "")}</span></td>
        <td>${component.quantidade}</td>
        <td><button class="small secondary" data-remove-kit-component="${index}" type="button">Remover</button></td>
      </tr>
    `;
  }).join("") : emptyRow(3);
  document.querySelectorAll("[data-remove-kit-component]").forEach((button) => {
    button.addEventListener("click", () => {
      state.productKitComponents.splice(Number(button.dataset.removeKitComponent), 1);
      renderKitComponents(currentProductId);
    });
  });
}

function bindProductFormHelpers(form) {
  updateProductMargin(form);
  renderKitComponents(form.elements.id.value);
  form.elements.preco_tabela.addEventListener("input", () => updateProductMargin(form));
  form.elements.custo_direto.addEventListener("input", () => updateProductMargin(form));

  document.querySelectorAll("[data-product-size]").forEach((button) => {
    button.addEventListener("click", () => {
      form.elements.tamanho_padrao.value = button.dataset.productSize;
      form.elements.largura_cm.value = button.dataset.width;
      form.elements.comprimento_cm.value = button.dataset.length;
    });
  });

  const kitCheckbox = document.querySelector("#product-is-kit");
  const kitBuilder = document.querySelector("#kit-builder");
  kitCheckbox.addEventListener("change", () => {
    kitBuilder.classList.toggle("hidden", !kitCheckbox.checked);
    if (!kitCheckbox.checked) {
      state.productKitComponents = [];
      renderKitComponents(form.elements.id.value);
    }
  });

  document.querySelector("#add-kit-component").addEventListener("click", () => {
    const componentProductId = document.querySelector("#kit-component-product").value;
    const currentProductId = form.elements.id.value;
    const quantity = Number(document.querySelector("#kit-component-quantity").value || 0);
    if (!componentProductId || quantity <= 0) {
      setMessage("Informe um componente e uma quantidade válida.", true);
      renderProducts();
      return;
    }
    if (componentProductId === currentProductId) {
      setMessage("Um kit não pode conter ele mesmo como componente.", true);
      renderProducts();
      return;
    }
    const existing = state.productKitComponents.find((component) => component.produto_id === componentProductId);
    if (existing) {
      existing.quantidade += quantity;
    } else {
      state.productKitComponents.push({ produto_id: componentProductId, quantidade: quantity });
    }
    setMessage("");
    renderKitComponents(currentProductId);
  });
}

function bindCustomerFormHelpers(form) {
  if (!form) return;
  const maskedFields = [
    ["cpf_cnpj", maskCpfCnpj],
    ["telefone", maskPhone],
    ["telefone_secundario", maskPhone],
    ["cep", maskCep]
  ];
  maskedFields.forEach(([name, formatter]) => {
    const field = form.elements[name];
    if (!field) return;
    field.addEventListener("input", () => {
      field.value = formatter(field.value);
    });
  });

  const cepField = form.elements.cep;
  let lastCepLookup = "";
  if (!cepField) return;
  cepField.addEventListener("input", async () => {
    const cep = digitsOnly(cepField.value);
    if (cep.length !== 8 || cep === lastCepLookup) return;
    lastCepLookup = cep;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!response.ok || data.erro) return;
      if (!form.elements.logradouro.value) form.elements.logradouro.value = data.logradouro || "";
      if (!form.elements.bairro.value) form.elements.bairro.value = data.bairro || "";
      if (!form.elements.cidade.value) form.elements.cidade.value = data.localidade || "";
    } catch {
      // O cadastro continua manual quando a consulta externa de CEP não estiver disponível.
    }
  });
}

function renderCustomers() {
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Clientes</h1></div>
      <section class="panel">
        <h2>Novo cliente</h2>
        <form id="customer-form" class="form-grid">
          <input type="hidden" name="id">
          <div class="grid-2">
            <label>Nome completo <input name="nome" required></label>
            <label>CPF/CNPJ <input name="cpf_cnpj" inputmode="numeric" autocomplete="off"></label>
          </div>
          <div class="grid-3">
            <label>Telefone (WhatsApp) <input name="telefone" inputmode="tel" required></label>
            <label>Telefone secundário <input name="telefone_secundario" inputmode="tel"></label>
            <label>E-mail <input name="email" type="email"></label>
          </div>
          <div class="grid-3">
            <label>CEP <input name="cep" id="customer-cep" inputmode="numeric" autocomplete="postal-code"></label>
            <label>Logradouro <input name="logradouro"></label>
            <label>Número <input name="numero"></label>
          </div>
          <div class="grid-3">
            <label>Bairro <input name="bairro"></label>
            <label>Cidade <input name="cidade"></label>
            <label>Complemento <input name="complemento"></label>
          </div>
          <label>Ponto de referência <input name="referencia"></label>
          <div class="toolbar">
            <button class="secondary" id="customer-clear" type="button">Novo</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <h2>Lista</h2>
        ${searchBox("customers-search", "Buscar cliente, telefone, bairro ou cidade")}
        <div class="split-table">
          <table data-search-table="customers"><thead><tr><th>Nome</th><th>Telefone</th><th>Bairro/Cidade</th><th>Ações</th></tr></thead><tbody>
            ${state.data.customers.map((customer) => `
              <tr data-search="${esc(customer.id)} ${esc(customerDisplayName(customer))} ${esc(customerDisplayPhone(customer))} ${esc(customer.cpf_cnpj)} ${esc(customer.email)} ${esc(customerDistrictCity(customer))} ${esc(customerFormattedAddress(customer))}">
                <td>${esc(customerDisplayName(customer))} ${customer.ativo === false || customer.active === false ? '<span class="status danger">Inativo</span>' : ""}</td>
                <td>${esc(customerDisplayPhone(customer))}</td>
                <td>${esc(customerDistrictCity(customer))}</td>
                <td><div class="row-actions"><button class="small secondary" data-edit-customer="${customer.id}" type="button">Editar</button><button class="small secondary" data-toggle-customer="${customer.id}" type="button">${customer.ativo === false || customer.active === false ? "Ativar" : "Inativar"}</button></div></td>
              </tr>
            `).join("") || emptyRow(4)}${emptySearchRow(4)}
          </tbody></table>
        </div>
      </section>
    </section>
  `);
  bindTableSearch("customers-search", "customers");
  const customerForm = document.querySelector("#customer-form");
  bindCustomerFormHelpers(customerForm);
  customerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const customerId = values.id;
    delete values.id;
    try {
      await api(customerId ? `/api/customers/${customerId}` : "/api/customers", {
        method: customerId ? "PUT" : "POST",
        body: JSON.stringify(values)
      });
      await loadData();
      setMessage(customerId ? "Cliente atualizado." : "Cliente cadastrado.");
      renderCustomers();
    } catch (error) {
      setMessage(error.message, true);
      renderCustomers();
    }
  });
  document.querySelector("#customer-clear").addEventListener("click", () => {
    customerForm.reset();
    customerForm.elements.id.value = "";
  });
  document.querySelectorAll("[data-edit-customer]").forEach((button) => {
    button.addEventListener("click", () => {
      const customer = state.data.customers.find((item) => item.id === button.dataset.editCustomer);
      customerForm.elements.id.value = customer.id;
      customerForm.elements.nome.value = customerDisplayName(customer);
      customerForm.elements.cpf_cnpj.value = customer.cpf_cnpj || "";
      customerForm.elements.telefone.value = customerDisplayPhone(customer);
      customerForm.elements.telefone_secundario.value = customer.telefone_secundario || "";
      customerForm.elements.email.value = customer.email || "";
      customerForm.elements.cep.value = customer.cep || "";
      customerForm.elements.logradouro.value = customer.logradouro || customer.endereco || customer.address || "";
      customerForm.elements.numero.value = customer.numero || "";
      customerForm.elements.complemento.value = customer.complemento || "";
      customerForm.elements.bairro.value = customer.bairro || "";
      customerForm.elements.cidade.value = customer.cidade || "";
      customerForm.elements.referencia.value = customer.referencia || "";
      customerForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-toggle-customer]").forEach((button) => {
    button.addEventListener("click", async () => {
      const customer = state.data.customers.find((item) => item.id === button.dataset.toggleCustomer);
      await api(`/api/customers/${customer.id}`, { method: "PUT", body: JSON.stringify({ ativo: customer.ativo === false || customer.active === false }) });
      await loadData();
      setMessage("Cliente atualizado.");
      renderCustomers();
    });
  });
}

function renderVendedores() {
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Vendedores</h1></div>
      <section class="panel">
        <h2>Novo vendedor</h2>
        <form id="seller-form" class="form-grid">
          <input type="hidden" name="id">
          <div class="grid-3">
            <label>Nome <input name="nome" required></label>
            <label>Loja padrão <select name="loja_id" required>${lojaPadraoOptions()}</select></label>
            <label>Telefone <input name="telefone"></label>
          </div>
          <div class="toolbar">
            <button class="secondary" id="seller-clear" type="button">Novo</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <h2>Lista</h2>
        <div class="split-table">
          <table><thead><tr><th>Nome</th><th>Loja padrão</th><th>Telefone</th><th>Criado em</th><th>Status</th><th></th></tr></thead><tbody>
            ${state.data.vendedores.map((seller) => `
              <tr>
                <td><strong>${esc(seller.nome)}</strong></td>
                <td>${esc(seller.loja_padrao)}</td>
                <td>${esc(seller.telefone || "-")}</td>
                <td>${esc(String(seller.criado_em || "").slice(0, 10))}</td>
                <td>${seller.ativo === false ? '<span class="status danger">Inativo</span>' : '<span class="status ok">Ativo</span>'}</td>
                <td><div class="row-actions"><button class="small secondary" data-edit-seller="${seller.id}" type="button">Editar</button><button class="small secondary" data-toggle-seller="${seller.id}" type="button">${seller.ativo === false ? "Ativar" : "Inativar"}</button></div></td>
              </tr>
            `).join("") || emptyRow(6)}
          </tbody></table>
        </div>
      </section>
    </section>
  `);
  const form = document.querySelector("#seller-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const sellerId = values.id;
    delete values.id;
    try {
      await api(sellerId ? `/api/vendedores/${sellerId}` : "/api/vendedores", {
        method: sellerId ? "PUT" : "POST",
        body: JSON.stringify(values)
      });
      await loadData();
      setMessage(sellerId ? "Vendedor atualizado." : "Vendedor cadastrado.");
      renderVendedores();
    } catch (error) {
      setMessage(error.message, true);
      renderVendedores();
    }
  });
  document.querySelector("#seller-clear").addEventListener("click", () => form.reset());
  document.querySelectorAll("[data-edit-seller]").forEach((button) => {
    button.addEventListener("click", () => {
      const seller = state.data.vendedores.find((item) => item.id === button.dataset.editSeller);
      form.elements.id.value = seller.id;
      form.elements.nome.value = seller.nome;
      form.elements.loja_id.value = sellerStoreValue(seller);
      form.elements.telefone.value = seller.telefone || "";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-toggle-seller]").forEach((button) => {
    button.addEventListener("click", async () => {
      const seller = state.data.vendedores.find((item) => item.id === button.dataset.toggleSeller);
      await api(`/api/vendedores/${seller.id}`, { method: "PUT", body: JSON.stringify({ ativo: seller.ativo === false }) });
      await loadData();
      setMessage("Vendedor atualizado.");
      renderVendedores();
    });
  });
}

function renderFornecedores() {
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Fornecedores</h1></div>
      <section class="panel">
        <h2>Novo fornecedor</h2>
        <form id="supplier-form" class="form-grid">
          <input type="hidden" name="id">
          <div class="grid-3">
            <label>Nome fantasia <input name="nome_fantasia" required></label>
            <label>Razão social <input name="razao_social" required></label>
            <label>CNPJ <input name="cnpj" inputmode="numeric" autocomplete="off" required></label>
          </div>
          <div class="grid-3">
            <label>Contato <input name="contato_nome" placeholder="Nome do representante"></label>
            <label>Telefone <input name="telefone" inputmode="tel"></label>
            <label>E-mail <input name="email" type="email"></label>
          </div>
          <label>Condição de pagamento padrão <input name="condicoes_pagamento_padrao" placeholder="Ex.: Entrada + 30/60 dias"></label>
          <div class="toolbar">
            <button class="secondary" id="supplier-clear" type="button">Novo</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <h2>Lista</h2>
        ${searchBox("suppliers-search", "Buscar fornecedor, CNPJ ou contato")}
        <div class="split-table">
          <table data-search-table="suppliers"><thead><tr><th>Nome Fantasia</th><th>Razão Social</th><th>CNPJ</th><th>Contato</th><th>Ações</th></tr></thead><tbody>
            ${state.data.fornecedores.map((supplier) => `
              <tr data-search="${esc(supplier.id)} ${esc(supplier.nome_fantasia)} ${esc(supplier.razao_social)} ${esc(supplier.cnpj)} ${esc(supplier.contato_nome || supplier.contato_representante)} ${esc(supplier.email)}">
                <td><strong>${esc(supplier.nome_fantasia)}</strong> ${supplier.ativo === false ? '<span class="status danger">Inativo</span>' : ""}</td>
                <td>${esc(supplier.razao_social)}</td>
                <td>${esc(supplier.cnpj)}</td>
                <td>${esc(supplier.contato_nome || supplier.contato_representante || supplier.telefone || supplier.email || "-")}</td>
                <td><div class="row-actions"><button class="small secondary" data-edit-supplier="${supplier.id}" type="button">Editar</button><button class="small secondary" data-toggle-supplier="${supplier.id}" type="button">${supplier.ativo === false ? "Ativar" : "Inativar"}</button></div></td>
              </tr>
            `).join("") || emptyRow(5)}${emptySearchRow(5)}
          </tbody></table>
        </div>
      </section>
    </section>
  `);
  bindTableSearch("suppliers-search", "suppliers");
  const form = document.querySelector("#supplier-form");
  const cnpjField = form.elements.cnpj;
  cnpjField.addEventListener("input", () => {
    cnpjField.value = maskCpfCnpj(cnpjField.value);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const supplierId = values.id;
    delete values.id;
    try {
      await api(supplierId ? `/api/fornecedores/${supplierId}` : "/api/fornecedores", {
        method: supplierId ? "PUT" : "POST",
        body: JSON.stringify(values)
      });
      await loadData();
      setMessage(supplierId ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      renderFornecedores();
    } catch (error) {
      setMessage(error.message, true);
      renderFornecedores();
    }
  });
  document.querySelector("#supplier-clear").addEventListener("click", () => {
    form.reset();
    form.elements.id.value = "";
  });
  document.querySelectorAll("[data-edit-supplier]").forEach((button) => {
    button.addEventListener("click", () => {
      const supplier = state.data.fornecedores.find((item) => item.id === button.dataset.editSupplier);
      form.elements.id.value = supplier.id;
      form.elements.nome_fantasia.value = supplier.nome_fantasia;
      form.elements.razao_social.value = supplier.razao_social;
      form.elements.cnpj.value = supplier.cnpj;
      form.elements.contato_nome.value = supplier.contato_nome || supplier.contato_representante || "";
      form.elements.telefone.value = supplier.telefone || "";
      form.elements.email.value = supplier.email || "";
      form.elements.condicoes_pagamento_padrao.value = supplier.condicoes_pagamento_padrao || "";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-toggle-supplier]").forEach((button) => {
    button.addEventListener("click", async () => {
      const supplier = state.data.fornecedores.find((item) => item.id === button.dataset.toggleSupplier);
      await api(`/api/fornecedores/${supplier.id}`, { method: "PUT", body: JSON.stringify({ ativo: supplier.ativo === false }) });
      await loadData();
      setMessage("Fornecedor atualizado.");
      renderFornecedores();
    });
  });
}

const PURCHASE_STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  PEDIDO_ENVIADO: "Pedido enviado",
  EM_TRANSITO: "Em trânsito",
  RECEBIDO_TOTAL: "Recebido total",
  RECEBIDO_PARCIAL: "Recebido parcial",
  CANCELADO: "Cancelado"
};

function purchaseStatusBadge(status) {
  const tone = status === "RECEBIDO_TOTAL" ? "ok" : status === "CANCELADO" ? "danger" : status === "EM_TRANSITO" || status === "RECEBIDO_PARCIAL" ? "warn" : "info";
  return `<span class="status ${tone}">${esc(PURCHASE_STATUS_LABELS[status] || status)}</span>`;
}

function shortDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : esc(value);
}

function purchaseProductLabel(product) {
  return `${product.sku || "SEM SKU"} · ${product.name}`;
}

function purchaseProductDatalist() {
  return `<datalist id="purchase-products-list">${state.data.products.filter((product) => product.active !== false).map((product) => `<option value="${esc(purchaseProductLabel(product))}"></option>`).join("")}</datalist>`;
}

function purchaseItemRow() {
  return `
    <div class="purchase-item-row">
      <label>Produto <input class="purchase-product-picker" list="purchase-products-list" placeholder="Busque por SKU ou nome" required></label>
      <label>Quantidade <input class="purchase-quantity" type="number" min="1" step="1" value="1" required></label>
      <label>Custo unitário <input class="purchase-cost" type="number" min="0.01" step="0.01" required></label>
      <button class="secondary icon-action" type="button" data-remove-purchase-item title="Remover item" aria-label="Remover item">×</button>
    </div>
  `;
}

function purchaseOrderModal() {
  if (!state.purchaseOrderOpen) return "";
  return `
    <div class="modal-backdrop" data-close-purchase-modal>
      <section class="modal-card purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title">
        <div class="modal-header">
          <div><h2 id="purchase-modal-title">Nova Ordem de Compra</h2><p>Cadastre produtos, custos e condições negociadas.</p></div>
          <button class="secondary icon-action" type="button" data-close-purchase-modal aria-label="Fechar">×</button>
        </div>
        <form id="purchase-order-form" class="form-grid modal-scroll">
          <div class="grid-2">
            <label>Fornecedor <select name="fornecedor_id" required>${suppliersOptions()}</select></label>
            <label>Previsão de entrega <input name="previsao_entrega" type="date" min="${today()}" required></label>
          </div>
          <div class="grid-2">
            <label>Frete <input name="valor_frete" type="number" min="0" step="0.01" value="0"></label>
            <label>Condição de pagamento <input name="condicao_pagamento" placeholder="Ex.: Entrada + 30/60 dias" required></label>
          </div>
          <label>Loja responsável pelo pagamento <select name="loja_id" required>${storesOptions(isStoreScopedUser() ? userStoreId() : state.bootstrap?.stores?.[0]?.id || "")}</select></label>
          <label>Observações <textarea name="observacoes" rows="2" placeholder="Condições comerciais, transportadora ou instruções"></textarea></label>
          <section class="purchase-items-box">
            <div class="section-heading"><div><h3>Itens da ordem</h3><p class="muted">Pesquise pelo SKU ou nome cadastrado.</p></div><button class="secondary small" type="button" id="add-purchase-item">+ Adicionar item</button></div>
            ${purchaseProductDatalist()}
            <div id="purchase-items">${purchaseItemRow()}</div>
          </section>
          <div class="toolbar modal-actions">
            <button class="secondary" type="button" data-close-purchase-modal>Cancelar</button>
            <button class="secondary" type="submit" data-purchase-submit="RASCUNHO">Salvar rascunho</button>
            <button type="submit" data-purchase-submit="PEDIDO_ENVIADO">Salvar e enviar</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function purchaseDetailModal() {
  const order = state.data.purchaseOrders.find((item) => item.id === state.purchaseDetailId);
  if (!order) return "";
  return `
    <div class="modal-backdrop" data-close-purchase-detail>
      <section class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header"><div><h2>${esc(order.id)}</h2><p>${esc(order.fornecedor_nome)} · ${purchaseStatusBadge(order.status)}</p></div><button class="secondary icon-action" type="button" data-close-purchase-detail aria-label="Fechar">×</button></div>
        <div class="purchase-detail-grid">
          <div><span>Emissão</span><strong>${shortDate(order.data_emissao)}</strong></div>
          <div><span>Previsão</span><strong>${shortDate(order.previsao_entrega)}</strong></div>
          <div><span>Pagamento</span><strong>${esc(order.condicao_pagamento)}</strong></div>
          <div><span>Total</span><strong>${money(order.valor_total)}</strong></div>
        </div>
        <div class="split-table modal-scroll"><table><thead><tr><th>Produto</th><th>Pedido</th><th>Recebido</th><th>Pendente</th><th>Custo</th><th>Subtotal</th></tr></thead><tbody>${order.itens.map((item) => `<tr><td><strong>${esc(item.produto_nome)}</strong><br><span class="muted">${esc(item.sku)}</span></td><td>${item.quantidade_pedida}</td><td>${item.quantidade_recebida}</td><td>${item.quantidade_pendente}</td><td>${money(item.custo_unitario)}</td><td>${money(item.subtotal)}</td></tr>`).join("")}</tbody></table></div>
        ${order.observacoes ? `<p class="purchase-notes"><strong>Observações:</strong> ${esc(order.observacoes)}</p>` : ""}
      </section>
    </div>
  `;
}

function purchaseReceiveModal() {
  const order = state.data.purchaseOrders.find((item) => item.id === state.purchaseReceiveId);
  if (!order) return "";
  return `
    <div class="modal-backdrop" data-close-purchase-receive>
      <section class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header"><div><h2>Receber ${esc(order.id)}</h2><p>Conferência física na doca. Informe apenas o recebido agora.</p></div><button class="secondary icon-action" type="button" data-close-purchase-receive aria-label="Fechar">×</button></div>
        <form id="purchase-receive-form" class="form-grid modal-scroll">
          <div class="split-table"><table><thead><tr><th>Produto</th><th>Pedido</th><th>Já recebido</th><th>Receber agora</th><th>Custo unitário</th></tr></thead><tbody>
            ${order.itens.map((item) => `<tr data-receive-item="${esc(item.id)}"><td><strong>${esc(item.produto_nome)}</strong><br><span class="muted">${esc(item.sku)}</span></td><td>${item.quantidade_pedida}</td><td>${item.quantidade_recebida}</td><td><input class="receive-quantity table-input" type="number" min="0" max="${item.quantidade_pendente}" step="1" value="${item.quantidade_pendente}"></td><td><input class="receive-cost table-input" type="number" min="0.01" step="0.01" value="${Number(item.custo_unitario).toFixed(2)}"></td></tr>`).join("")}
          </tbody></table></div>
          <div class="toolbar modal-actions"><button class="secondary" type="button" data-close-purchase-receive>Cancelar</button><button type="submit">Confirmar entrada no estoque</button></div>
        </form>
      </section>
    </div>
  `;
}

function filteredPurchaseOrders() {
  const search = state.purchaseSearch.trim().toLowerCase();
  return state.data.purchaseOrders.filter((order) => {
    const statusMatch = state.purchaseFilter === "TODAS"
      || (state.purchaseFilter === "ABERTAS" && ["RASCUNHO", "PEDIDO_ENVIADO", "RECEBIDO_PARCIAL"].includes(order.status))
      || (state.purchaseFilter === "EM_TRANSITO" && order.status === "EM_TRANSITO")
      || (state.purchaseFilter === "CONCLUIDAS" && ["RECEBIDO_TOTAL", "CANCELADO"].includes(order.status));
    const text = `${order.id} ${order.fornecedor_nome} ${order.status}`.toLowerCase();
    return statusMatch && (!search || text.includes(search));
  });
}

function renderPurchases() {
  const canManage = hasPapel(["ADMINISTRADOR", "GERENTE_LOJA", "ESTOQUE"]);
  const summary = state.data.purchaseSummary || {};
  const orders = filteredPurchaseOrders();
  renderShell(`
    <section class="page purchases-page">
      <div class="page-header purchase-page-header">
        <p class="muted">Pedidos, recebimentos e reposição do depósito central.</p>
        <div class="toolbar">${canManage ? '<button class="secondary" id="open-suppliers" type="button">Fornecedores</button><button id="new-purchase-order" type="button">+ Nova Ordem de Compra</button>' : ""}</div>
      </div>
      <div class="metrics purchase-metrics">
        <div class="metric"><span>Total comprado no mês</span><strong>${money(summary.total_comprado_mes)}</strong></div>
        <div class="metric"><span>Ordens em trânsito</span><strong>${Number(summary.ordens_em_transito || 0)}</strong></div>
        <div class="metric"><span>Reposições urgentes</span><strong>${Number(summary.reposicoes_urgentes || 0)}</strong></div>
      </div>
      <section class="panel">
        <div class="purchase-filters">
          <div class="tabs">${[["TODAS", "Todas"], ["ABERTAS", "Em aberto"], ["EM_TRANSITO", "Em trânsito"], ["CONCLUIDAS", "Concluídas"]].map(([value, label]) => `<button class="tab-button ${state.purchaseFilter === value ? "active" : ""}" data-purchase-filter="${value}" type="button">${label}</button>`).join("")}</div>
          <label class="search-box purchase-search"><input id="purchase-search" type="search" value="${esc(state.purchaseSearch)}" placeholder="Buscar por ordem ou fornecedor"></label>
        </div>
        <div class="split-table"><table><thead><tr><th>ID</th><th>Fornecedor</th><th>Data emissão</th><th>Previsão</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          ${orders.map((order) => `<tr data-purchase-row data-search="${esc(`${order.id} ${order.fornecedor_nome} ${order.status}`.toLowerCase())}"><td><strong>${esc(order.id)}</strong></td><td>${esc(order.fornecedor_nome)}</td><td>${shortDate(order.data_emissao)}</td><td>${shortDate(order.previsao_entrega)}</td><td>${money(order.valor_total)}</td><td>${purchaseStatusBadge(order.status)}</td><td><div class="row-actions"><button class="small secondary" data-purchase-detail="${esc(order.id)}" type="button">Detalhes</button>${canManage && order.status === "RASCUNHO" ? `<button class="small secondary" data-purchase-status="PEDIDO_ENVIADO" data-purchase-id="${esc(order.id)}" type="button">Enviar pedido</button>` : ""}${canManage && order.status === "PEDIDO_ENVIADO" ? `<button class="small secondary" data-purchase-status="EM_TRANSITO" data-purchase-id="${esc(order.id)}" type="button">Em trânsito</button>` : ""}${canManage && ["PEDIDO_ENVIADO", "EM_TRANSITO", "RECEBIDO_PARCIAL"].includes(order.status) ? `<button class="small" data-purchase-receive="${esc(order.id)}" type="button">Receber</button>` : ""}${canManage && ["RASCUNHO", "PEDIDO_ENVIADO", "EM_TRANSITO"].includes(order.status) ? `<button class="small danger-button" data-purchase-status="CANCELADO" data-purchase-id="${esc(order.id)}" type="button">Cancelar</button>` : ""}</div></td></tr>`).join("") || emptyRow(7)}
        </tbody></table></div>
      </section>
      ${purchaseOrderModal()}${purchaseDetailModal()}${purchaseReceiveModal()}
    </section>
  `);
  bindPurchases();
}

function bindPurchases() {
  document.querySelector("#new-purchase-order")?.addEventListener("click", () => { state.purchaseOrderOpen = true; renderPurchases(); });
  document.querySelector("#open-suppliers")?.addEventListener("click", () => { state.view = "fornecedores"; render(); });
  document.querySelectorAll("[data-purchase-filter]").forEach((button) => button.addEventListener("click", () => { state.purchaseFilter = button.dataset.purchaseFilter; renderPurchases(); }));
  document.querySelector("#purchase-search")?.addEventListener("input", (event) => {
    state.purchaseSearch = event.target.value;
    const query = state.purchaseSearch.trim().toLowerCase();
    document.querySelectorAll("[data-purchase-row]").forEach((row) => { row.hidden = Boolean(query) && !row.dataset.search.includes(query); });
  });
  document.querySelectorAll("[data-close-purchase-modal]").forEach((element) => element.addEventListener("click", (event) => { if (event.target === element || element.tagName === "BUTTON") { state.purchaseOrderOpen = false; renderPurchases(); } }));
  document.querySelectorAll("[data-close-purchase-detail]").forEach((element) => element.addEventListener("click", (event) => { if (event.target === element || element.tagName === "BUTTON") { state.purchaseDetailId = ""; renderPurchases(); } }));
  document.querySelectorAll("[data-close-purchase-receive]").forEach((element) => element.addEventListener("click", (event) => { if (event.target === element || element.tagName === "BUTTON") { state.purchaseReceiveId = ""; renderPurchases(); } }));
  document.querySelectorAll("[data-purchase-detail]").forEach((button) => button.addEventListener("click", () => { state.purchaseDetailId = button.dataset.purchaseDetail; renderPurchases(); }));
  document.querySelectorAll("[data-purchase-receive]").forEach((button) => button.addEventListener("click", () => { state.purchaseReceiveId = button.dataset.purchaseReceive; renderPurchases(); }));
  document.querySelectorAll("[data-purchase-status]").forEach((button) => button.addEventListener("click", async () => {
    if (button.dataset.purchaseStatus === "CANCELADO" && !window.confirm(`Cancelar a ordem ${button.dataset.purchaseId}?`)) return;
    try {
      await api(`/api/compras/ordens/${encodeURIComponent(button.dataset.purchaseId)}/status`, { method: "PUT", body: JSON.stringify({ status: button.dataset.purchaseStatus }) });
      await loadData();
      setMessage("Status da ordem atualizado.");
    } catch (error) { setMessage(error.message, true); }
    renderPurchases();
  }));
  const items = document.querySelector("#purchase-items");
  const purchaseForm = document.querySelector("#purchase-order-form");
  purchaseForm?.elements.fornecedor_id?.addEventListener("change", (event) => {
    const supplier = state.data.fornecedores.find((item) => item.id === event.target.value);
    if (supplier?.condicoes_pagamento_padrao && !purchaseForm.elements.condicao_pagamento.value) {
      purchaseForm.elements.condicao_pagamento.value = supplier.condicoes_pagamento_padrao;
    }
  });
  document.querySelector("#add-purchase-item")?.addEventListener("click", () => items.insertAdjacentHTML("beforeend", purchaseItemRow()));
  items?.addEventListener("click", (event) => { const button = event.target.closest("[data-remove-purchase-item]"); if (button && items.children.length > 1) button.closest(".purchase-item-row").remove(); });
  purchaseForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const itens = [...event.currentTarget.querySelectorAll(".purchase-item-row")].map((row) => {
      const query = row.querySelector(".purchase-product-picker").value.trim().toLowerCase();
      const product = state.data.products.find((item) => [purchaseProductLabel(item), item.sku, item.name].some((value) => String(value || "").toLowerCase() === query));
      return { produto_id: product?.id || "", quantidade_pedida: Number(row.querySelector(".purchase-quantity").value), custo_unitario: Number(row.querySelector(".purchase-cost").value) };
    });
    try {
      await api("/api/compras/ordens", { method: "POST", body: JSON.stringify({ ...values, status: event.submitter?.dataset.purchaseSubmit || "RASCUNHO", data_emissao: today(), itens }) });
      state.purchaseOrderOpen = false;
      await loadData();
      setMessage("Ordem de compra criada.");
    } catch (error) { setMessage(error.message, true); }
    renderPurchases();
  });
  document.querySelector("#purchase-receive-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const itens = [...event.currentTarget.querySelectorAll("[data-receive-item]")].map((row) => ({ id: row.dataset.receiveItem, quantidade_recebida: Number(row.querySelector(".receive-quantity").value), custo_unitario: Number(row.querySelector(".receive-cost").value) }));
    try {
      await api(`/api/compras/ordens/${encodeURIComponent(state.purchaseReceiveId)}/receber`, { method: "POST", body: JSON.stringify({ itens }) });
      state.purchaseReceiveId = "";
      await loadData();
      setMessage("Recebimento confirmado. Estoque e custo atualizados; contas a pagar são geradas ao concluir o recebimento total.");
    } catch (error) { setMessage(error.message, true); }
    renderPurchases();
  });
}

function renderStock() {
  const canMove = hasPapel(["ADMINISTRADOR", "ESTOQUE"]);
  const showroomStores = state.bootstrap?.stores || [];
  const showroomHeaders = showroomStores.map((store) => `<th>Showroom ${esc(store.name || store.nome)}</th>`).join("");
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Estoque</h1></div>
      ${canMove ? `
        <section class="panel">
          <h2>Entrada no depósito central</h2>
          <form id="stock-entry-form" class="form-grid">
            <div class="grid-3">
              <label>Produto <select name="productId" required>${productsOptions()}</select></label>
              <label>Quantidade <input name="quantity" type="number" min="1" required></label>
              <label>Observação <input name="reason" value="Entrada de mercadoria"></label>
            </div>
            <button type="submit">Registrar entrada</button>
          </form>
        </section>
      ` : ""}
      <section class="panel">
        <h2>Saldo consolidado</h2>
        ${searchBox("stock-search", "Buscar produto, SKU ou categoria")}
        <div class="split-table">
          <table data-search-table="stock"><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Depósito Central (Venda)</th><th>A Chegar / Em Trânsito</th>${showroomHeaders}<th>Saldo Total</th><th>Alerta</th><th>Histórico</th></tr></thead><tbody>
            ${state.data.stock.map((row) => `
              <tr data-search="${esc(row.product.id)} ${esc(row.product.name)} ${esc(row.product.sku)} ${esc(row.product.category)} ${esc(row.product.brandModel)}">
                <td><strong>${esc(row.product.name)}</strong><br><span class="muted">${esc(row.product.brandModel)}</span></td>
                <td>${esc(row.product.sku)}</td>
                <td>${esc(row.product.category)}</td>
                <td>${row.saldo_deposito}</td>
                <td>${Number(row.a_chegar || 0) ? `<span class="status info">+${Number(row.a_chegar)}</span>` : '<span class="muted">0</span>'}</td>
                ${showroomStores.map((store) => {
                  const showroom = (row.showrooms || []).find((item) => item.loja_id === store.id);
                  return `<td>${showroom?.quantidade || 0}</td>`;
                }).join("")}
                <td>${row.total}</td>
                <td>${row.lowStock ? '<span class="status warn">Abaixo do mínimo</span>' : '<span class="status ok">Ok</span>'}</td>
                <td><button class="small secondary" type="button" data-stock-history="${esc(row.product.id)}">Histórico</button></td>
              </tr>
            `).join("") || emptyRow(8 + showroomStores.length)}${emptySearchRow(8 + showroomStores.length)}
          </tbody></table>
        </div>
      </section>
      ${stockHistoryModal()}
    </section>
  `);
  bindTableSearch("stock-search", "stock");
  bindStockHistory();
  const entry = document.querySelector("#stock-entry-form");
  if (entry) entry.addEventListener("submit", submitForm("/api/stock/entry", "Entrada registrada."));
}

function renderShowroom() {
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Movimentação de Showroom</h1></div>
      <section class="panel">
        <h2>Nova movimentação</h2>
        <form id="showroom-form" class="form-grid">
          <div class="grid-3">
            <label>Tipo
              <select name="type" required>
                <option value="envio_showroom">Envio para showroom</option>
                <option value="retorno_showroom">Retorno ao depósito</option>
              </select>
            </label>
            <label>Produto <select name="productId" required>${productsOptions()}</select></label>
            <label>Loja <select name="storeId" required>${storesOptions()}</select></label>
          </div>
          <div class="grid-3">
            <label>Quantidade <input name="quantity" type="number" min="1" required></label>
            <label>Observação <input name="reason" placeholder="Ex.: troca de mostruário"></label>
            <div></div>
          </div>
          <button type="submit">Registrar movimentação</button>
        </form>
      </section>
      <section class="panel">
        <h2>Histórico</h2>
        ${searchBox("showroom-search", "Buscar movimentação, produto, SKU ou usuário")}
        <div class="split-table">
          <table data-search-table="showroom"><thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>SKU</th><th>Quantidade</th><th>Loja</th><th>Usuário</th><th>Observação</th></tr></thead><tbody>
            ${state.data.showroomMovements.map((movement) => `
              <tr data-search="${esc(movement.id)} ${esc(movement.productName)} ${esc(movement.sku)} ${esc(movement.storeName)} ${esc(movement.userName)}">
                <td>${esc(String(movement.createdAt || "").slice(0, 16).replace("T", " "))}</td>
                <td>${movement.type === "envio_showroom" ? "Envio" : "Retorno"}</td>
                <td>${esc(movement.productName)}</td>
                <td>${esc(movement.sku)}</td>
                <td>${movement.quantity}</td>
                <td>${esc(movement.storeName)}</td>
                <td>${esc(movement.userName)}</td>
                <td>${esc(movement.reason)}</td>
              </tr>
            `).join("") || emptyRow(8)}${emptySearchRow(8)}
          </tbody></table>
        </div>
      </section>
    </section>
  `);
  bindTableSearch("showroom-search", "showroom");
  document.querySelector("#showroom-form").addEventListener("submit", submitForm("/api/showroom/movements", "Movimentação de showroom registrada."));
}

function renderSales() {
  const draft = state.saleDraft;
  const activeProducts = state.data.products.filter((product) => product.active !== false);
  const selectedProduct = activeProducts.find((product) => product.id === draft.productId) || activeProducts[0] || {};
  const selectedStoreId = isStoreScopedUser() ? userStoreId() : draft.storeId || userStoreId() || state.bootstrap?.stores?.[0]?.id || "";
  const cashOpen = hasOpenCashForStore(selectedStoreId);
  const grossTotal = cartGrossTotal();
  const discount = cartDiscount();
  const finalTotal = cartFinalTotal();
  const activeTab = state.salesTab || "new";
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Vendas</h1></div>
      <div class="tabs" role="tablist" aria-label="Vendas">
        <button class="tab-button ${activeTab === "new" ? "active" : ""}" data-sales-tab="new" type="button" role="tab" aria-selected="${activeTab === "new"}">Nova Venda</button>
        <button class="tab-button ${activeTab === "history" ? "active" : ""}" data-sales-tab="history" type="button" role="tab" aria-selected="${activeTab === "history"}">Histórico de Vendas</button>
      </div>
      ${activeTab === "new" ? `
        <section class="panel">
          <h2>Nova venda</h2>
          <form id="sale-form" class="form-grid">
            <div class="grid-3">
              <label>Loja <select name="storeId" id="sale-store" required ${isStoreScopedUser() ? "disabled" : ""}>${storesOptions(selectedStoreId)}</select></label>
              <label>Cliente <select name="customerId" required>${customersOptions(draft.customerId)}</select></label>
              <label>Vendedor(a) <select name="sellerId" id="sale-seller" required>${sellersOptions(draft.sellerId, selectedStoreId)}</select></label>
            </div>
          </form>
        </section>
        ${cashOpen ? "" : `
          <section class="panel cash-required-panel">
            <h2>Abertura de Caixa necessária</h2>
            <p class="muted">Abra o caixa da unidade antes de concluir novas vendas.</p>
            <form id="sale-cash-open-form" class="form-grid">
              <div class="grid-3">
                <label>Loja <select name="storeId" ${isStoreScopedUser() ? "disabled" : ""}>${storesOptions(selectedStoreId)}</select></label>
                <label>Fundo de Troco <input name="saldo_inicial_troco" type="number" min="0" step="0.01" value="0"></label>
                <button type="submit">Abrir Caixa</button>
              </div>
            </form>
          </section>
        `}
        <section class="panel">
          <h2>Itens do Pedido</h2>
          <div class="form-grid" id="sale-item-form">
            <div class="grid-3">
              <label>Produto <select name="productId" id="sale-product" required>${activeProducts.map((product) => `<option value="${product.id}" ${selectedProduct.id === product.id ? "selected" : ""}>${esc(product.name)} - ${esc(product.sku)}</option>`).join("")}</select></label>
              <label>Preço de tabela <input name="listPrice" id="sale-list-price" value="${selectedProduct.salePrice === undefined ? "" : money(selectedProduct.salePrice)}" readonly></label>
              <label>Preço praticado / unitário <input name="unitPrice" id="sale-unit-price" type="number" step="0.01" min="0.01" value="${Number(selectedProduct.salePrice || 0).toFixed(2)}"></label>
            </div>
            <div class="grid-3">
              <label>Quantidade <input name="quantity" id="sale-item-quantity" type="number" min="1" value="1"></label>
              <button id="add-sale-item" type="button">+ Adicionar ao Pedido</button>
              <div></div>
            </div>
          </div>
          <div class="split-table cart-table">
            <table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th><th></th></tr></thead><tbody>
              ${state.saleCart.map((item, index) => `
                <tr>
                  <td><strong>${esc(item.name)}</strong><br><span class="muted">SKU: ${esc(item.sku)}</span></td>
                  <td>${item.quantity}</td>
                  <td>${money(item.unitPrice)}</td>
                  <td>${money(item.total)}</td>
                  <td><button class="small secondary" data-remove-sale-item="${index}" type="button">Remover</button></td>
                </tr>
              `).join("") || emptyRow(5)}
            </tbody></table>
          </div>
        </section>
        <section class="panel">
          <h2>Resumo financeiro</h2>
          <div class="sale-summary">
            <div><span>Total bruto dos itens</span><strong>${money(grossTotal)}</strong></div>
            <label>Desconto adicional (R$) <input name="discount" id="sale-discount" type="number" step="0.01" min="0" value="${Number(discount || 0).toFixed(2)}"></label>
            <div><span>Valor total final</span><strong id="sale-final-total">${money(finalTotal)}</strong></div>
          </div>
          <div class="payment-builder">
            <div class="grid-3 sale-payment-row">
              <label>Forma <select id="sale-payment-method">${paymentOptions()}</select></label>
              <label>Valor parcial <input id="sale-payment-value" type="number" step="0.01" min="0.01" value="${Number(paymentRemaining() || finalTotal || 0).toFixed(2)}"></label>
              <label>Parcelas <input id="sale-payment-installments" type="number" min="1" step="1" value="1"></label>
            </div>
            <button class="secondary" id="add-sale-payment" type="button">+ Adicionar Pagamento</button>
            <div class="split-table cart-table">
              <table><thead><tr><th>Forma</th><th>Valor</th><th>Parcelas</th><th></th></tr></thead><tbody>
                ${state.salePayments.map((payment, index) => `
                  <tr>
                    <td>${esc(PAYMENT_LABELS[payment.metodo] || payment.metodo)}</td>
                    <td>${money(payment.valor)}</td>
                    <td>${payment.parcelas || 1}x</td>
                    <td><button class="small secondary" data-remove-sale-payment="${index}" type="button">Remover</button></td>
                  </tr>
                `).join("") || emptyRow(4)}
              </tbody></table>
            </div>
            <div class="payment-summary" id="sale-payment-summary">
              <div><span>Total pago</span><strong>${money(paymentTotal())}</strong></div>
              <div><span>Restante a pagar</span><strong>${money(paymentRemaining())}</strong></div>
              <div><span>Troco</span><strong>${money(paymentChange())}</strong></div>
            </div>
          </div>
        </section>
        <section class="panel">
          <h2>Entrega</h2>
          <div class="grid-3">
            <label>Entrega <select name="hasDelivery" id="sale-has-delivery"><option value="false" ${draft.hasDelivery !== "true" ? "selected" : ""}>Não</option><option value="true" ${draft.hasDelivery === "true" ? "selected" : ""}>Sim</option></select></label>
            <label>Entregador <input name="deliveryPerson" id="sale-delivery-person" value="${esc(draft.deliveryPerson || "")}"></label>
            <label>Data entrega <input name="deliveryDate" id="sale-delivery-date" type="date" value="${esc(draft.deliveryDate || today())}"></label>
            <label>Turno de Entrega <select name="deliveryShift" id="sale-delivery-shift">${deliveryShiftOptions(draft.deliveryShift || "Horário Comercial")}</select></label>
          </div>
          <button id="finish-sale" type="button" ${state.saleCart.length && cashOpen ? "" : "disabled"}>Concluir venda</button>
        </section>
        ${state.lastSaleId ? `
          <section class="panel last-sale-panel">
            <div>
          <h2>Última venda concluída</h2>
              <p class="muted">Pedido ${esc(saleCode(byId(state.data.sales, state.lastSaleId)) || state.lastSaleId)} pronto para impressão ou salvamento em PDF.</p>
            </div>
            <button type="button" data-print-sale="${esc(state.lastSaleId)}">Imprimir / Salvar PDF</button>
          </section>
        ` : ""}
      ` : `
        <section class="panel">
          <h2>Histórico de Vendas</h2>
          ${searchBox("sales-search", "Buscar venda, cliente, vendedor ou loja")}
          <div class="split-table">
            <table data-search-table="sales"><thead><tr><th>Código</th><th>Data</th><th>Cliente</th><th>Vendedor(a)</th><th>Loja</th><th>Total</th><th>Status</th><th>Entrega</th><th></th></tr></thead><tbody>
              ${state.data.sales.slice().reverse().map((sale) => `
                <tr data-search="${esc(sale.id)} ${esc(saleCode(sale))} ${esc(sale.customerId)} ${esc(sale.vendedorId || sale.sellerId)} ${esc(sale.vendedorNome || sale.sellerName)}">
                  <td><strong>${esc(saleCode(sale))}</strong></td>
                  <td>${esc(sale.date)}</td>
                  <td>${esc(customerDisplayName(byId(state.data.customers, sale.customerId)))}</td>
                  <td>${esc(sale.vendedorNome || sale.sellerName || byId(state.data.vendedores, sale.vendedorId || sale.sellerId).nome)}</td>
                  <td>${esc(byId(state.bootstrap.stores, sale.storeId).name)}</td>
                  <td>${money(saleFinalTotal(sale))}</td>
                  <td>${saleStatusBadge(sale)}</td>
                  <td>${sale.hasDelivery ? '<span class="status warn">Sim</span>' : '<span class="status ok">Não</span>'}</td>
                  <td><div class="row-actions"><button class="small secondary" type="button" data-print-sale="${esc(sale.id)}">Imprimir / Salvar PDF</button>${currentPapel() === "ADMINISTRADOR" && sale.status !== "CANCELADA" ? `<button class="small danger" type="button" data-cancel-sale="${esc(sale.id)}">Cancelar / Estornar</button>` : ""}</div></td>
                </tr>
              `).join("") || emptyRow(9)}${emptySearchRow(9)}
            </tbody></table>
          </div>
        </section>
      `}
    </section>
  `);
  bindSalesTabs();
  bindReceiptButtons();
  if (activeTab === "history") {
    bindSaleCancelButtons();
    bindTableSearch("sales-search", "sales");
    return;
  }
  bindSaleBuilder();
}

function bindSalesTabs() {
  document.querySelectorAll("[data-sales-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.salesTab = button.dataset.salesTab;
      setMessage("");
      renderSales();
    });
  });
}

function readSaleDraft() {
  const storeSelect = document.querySelector("#sale-store");
  const sellerSelect = document.querySelector("#sale-seller");
  state.saleDraft = {
    ...state.saleDraft,
    storeId: (isStoreScopedUser() ? userStoreId() : storeSelect?.value) || state.saleDraft.storeId,
    customerId: document.querySelector('[name="customerId"]')?.value || state.saleDraft.customerId,
    sellerId: sellerSelect?.value || state.saleDraft.sellerId,
    productId: document.querySelector("#sale-product")?.value || state.saleDraft.productId,
    discount: Number(document.querySelector("#sale-discount")?.value || 0),
    hasDelivery: document.querySelector("#sale-has-delivery")?.value || state.saleDraft.hasDelivery,
    deliveryPerson: document.querySelector("#sale-delivery-person")?.value || "",
    deliveryDate: document.querySelector("#sale-delivery-date")?.value || today(),
    deliveryShift: document.querySelector("#sale-delivery-shift")?.value || "Horário Comercial"
  };
}

function updateSalePaymentSummary() {
  const summary = document.querySelector("#sale-payment-summary");
  const finalTotalLabel = document.querySelector("#sale-final-total");
  if (finalTotalLabel) finalTotalLabel.textContent = money(cartFinalTotal());
  if (!summary) return;
  summary.innerHTML = `
    <div><span>Total pago</span><strong>${money(paymentTotal())}</strong></div>
    <div><span>Restante a pagar</span><strong>${money(paymentRemaining())}</strong></div>
    <div><span>Troco</span><strong>${money(paymentChange())}</strong></div>
  `;
}

function bindSaleBuilder() {
  const storeSelect = document.querySelector("#sale-store");
  const sellerSelect = document.querySelector("#sale-seller");
  const productSelect = document.querySelector("#sale-product");
  const unitPriceInput = document.querySelector("#sale-unit-price");
  const listPriceInput = document.querySelector("#sale-list-price");
  const discountInput = document.querySelector("#sale-discount");
  const saleCashOpenForm = document.querySelector("#sale-cash-open-form");

  if (saleCashOpenForm) {
    saleCashOpenForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const values = cashFormValues(saleCashOpenForm);
        values.storeId = isStoreScopedUser() ? userStoreId() : values.storeId || storeSelect?.value;
        await api("/api/cash/open", { method: "POST", body: JSON.stringify(values) });
        await loadData();
        setMessage("Caixa aberto para a unidade.");
        renderSales();
      } catch (error) {
        setMessage(error.message, true);
        renderSales();
      }
    });
  }
  if (storeSelect) {
    storeSelect.addEventListener("change", () => {
      state.saleDraft.storeId = storeSelect.value;
      sellerSelect.innerHTML = sellersOptions("", storeSelect.value);
      state.saleDraft.sellerId = sellerSelect.value;
    });
  }
  document.querySelectorAll("#sale-form select, #sale-has-delivery, #sale-delivery-person, #sale-delivery-date, #sale-delivery-shift").forEach((field) => {
    field.addEventListener("change", readSaleDraft);
    field.addEventListener("input", readSaleDraft);
  });
  if (discountInput) {
    discountInput.addEventListener("input", () => {
      readSaleDraft();
      updateSalePaymentSummary();
    });
  }
  if (productSelect) {
    productSelect.addEventListener("change", () => {
      const product = byId(state.data.products, productSelect.value);
      listPriceInput.value = product.salePrice === undefined ? "" : money(product.salePrice);
      unitPriceInput.value = Number(product.salePrice || 0).toFixed(2);
      state.saleDraft.productId = productSelect.value;
    });
  }
  document.querySelector("#add-sale-item").addEventListener("click", () => {
    readSaleDraft();
    const product = byId(state.data.products, productSelect.value);
    const quantity = Number(document.querySelector("#sale-item-quantity").value || 0);
    const unitPrice = Number(unitPriceInput.value || 0);
    if (!product.id || quantity <= 0 || unitPrice <= 0) {
      setMessage("Informe produto, quantidade e preço praticado válidos.", true);
      renderSales();
      return;
    }
    state.saleCart.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice,
      total: Number((quantity * unitPrice).toFixed(2))
    });
    setMessage("");
    renderSales();
  });
  document.querySelector("#add-sale-payment").addEventListener("click", () => {
    readSaleDraft();
    const method = document.querySelector("#sale-payment-method").value;
    const value = Number(document.querySelector("#sale-payment-value").value || 0);
    const installments = Number(document.querySelector("#sale-payment-installments").value || 1);
    if (!method || value <= 0) {
      setMessage("Informe forma e valor de pagamento válidos.", true);
      renderSales();
      return;
    }
    state.salePayments.push({ metodo: method, valor: Number(value.toFixed(2)), parcelas: Math.max(1, installments) });
    setMessage("");
    renderSales();
  });
  document.querySelectorAll("[data-remove-sale-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      readSaleDraft();
      state.salePayments.splice(Number(button.dataset.removeSalePayment), 1);
      renderSales();
    });
  });
  document.querySelectorAll("[data-remove-sale-item]").forEach((button) => {
    button.addEventListener("click", () => {
      readSaleDraft();
      state.saleCart.splice(Number(button.dataset.removeSaleItem), 1);
      renderSales();
    });
  });
  document.querySelector("#finish-sale").addEventListener("click", async () => {
    readSaleDraft();
    if (!state.saleCart.length) {
      setMessage("Adicione ao menos um item ao pedido.", true);
      renderSales();
      return;
    }
    if (paymentTotal() < cartFinalTotal()) {
      setMessage("Adicione pagamentos suficientes para cobrir o total da venda.", true);
      renderSales();
      return;
    }
    const body = {
      customerId: state.saleDraft.customerId,
      sellerId: state.saleDraft.sellerId,
      storeId: isStoreScopedUser() ? userStoreId() : state.saleDraft.storeId,
      pagamentos: state.salePayments,
      desconto_adicional: cartDiscount(),
      valor_total: cartFinalTotal(),
      itens: state.saleCart.map((item) => ({
        produto_id: item.productId,
        nome: item.name,
        quantidade: item.quantity,
        preco_unitario: item.unitPrice,
        subtotal: item.total
      })),
      hasDelivery: state.saleDraft.hasDelivery === "true",
      deliveryPerson: state.saleDraft.deliveryPerson,
      deliveryDate: state.saleDraft.deliveryDate,
      deliveryShift: state.saleDraft.deliveryShift
    };
    try {
      const result = await api("/api/sales", { method: "POST", body: JSON.stringify(body) });
      state.lastSaleId = result.sale.id;
      state.saleCart = [];
      state.salePayments = [];
      state.saleDraft = {
        storeId: isStoreScopedUser() ? userStoreId() : "",
        customerId: "",
        sellerId: "",
        productId: "",
        discount: 0,
        hasDelivery: "false",
        deliveryPerson: "",
        deliveryDate: today(),
        deliveryShift: "Horário Comercial"
      };
      await loadData();
      setMessage(`Venda ${result.sale.codigo_venda || result.sale.id} concluída com baixa de estoque, caixa e entrega quando aplicável.`);
      renderSales();
    } catch (error) {
      setMessage(error.message, true);
      renderSales();
    }
  });
}

function renderFinance() {
  const canWrite = currentPapel() === "ADMINISTRADOR";
  const canOperateCash = hasPapel(["ADMINISTRADOR", "GESTOR_FINANCEIRO", "GERENTE_LOJA", "OPERADOR_CAIXA"]);
  const cash = state.data.cash || { balancesByStore: [], movements: [], consolidated: 0 };
  const openSessions = cash.sessoesAbertas || [];
  const pendingSessions = cash.sessoesPendentes || [];
  const selectedStoreId = isStoreScopedUser() ? userStoreId() : state.bootstrap?.stores?.[0]?.id || "";
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Financeiro</h1></div>
      <div class="metrics">
        <div class="metric"><span>Saldo atual</span><strong>${money(cash.consolidated)}</strong></div>
        <div class="metric"><span>Entradas/saídas</span><strong>${cash.movements.length}</strong></div>
        <div class="metric"><span>Contas pendentes</span><strong>${state.data.bills.filter((bill) => bill.status === "pendente").length}</strong></div>
      </div>
      ${canOperateCash ? `
        <section class="panel">
          <h2>Operação diária de caixa</h2>
          <div class="cash-session-list">
            ${openSessions.map((session) => `<span class="status ok">Caixa aberto: ${esc(session.loja_nome)} desde ${esc(formatDateTime(session.data_abertura))}</span>`).join("") || '<span class="status warn">Nenhum caixa aberto hoje nas unidades permitidas.</span>'}
            ${pendingSessions.filter((session) => !openSessions.some((open) => open.id === session.id)).map((session) => `<span class="status danger">Fechamento pendente: ${esc(session.loja_nome)} desde ${esc(formatDateTime(session.data_abertura))}</span>`).join("")}
          </div>
          <div class="grid-3">
            <form id="cash-open-form" class="form-grid compact-form">
              <h3>Abertura de Caixa</h3>
              <label>Loja <select name="storeId" ${isStoreScopedUser() ? "disabled" : ""}>${storesOptions(selectedStoreId)}</select></label>
              <label>Fundo de Troco <input name="saldo_inicial_troco" type="number" min="0" step="0.01" value="0"></label>
              <button type="submit">Abrir Caixa</button>
            </form>
            <form id="cash-sangria-form" class="form-grid compact-form">
              <h3>Sangria de Caixa</h3>
              <label>Loja <select name="storeId" ${isStoreScopedUser() ? "disabled" : ""}>${storesOptions(selectedStoreId)}</select></label>
              <label>Valor <input name="value" type="number" min="0.01" step="0.01" required></label>
              <label>Justificativa <input name="reason" required placeholder="Ex.: transferência para cofre"></label>
              <button class="secondary" type="submit">Registrar Sangria</button>
            </form>
            <form id="cash-close-form" class="form-grid compact-form">
              <h3>Fechamento Cego</h3>
              <label>Loja <select name="storeId" ${isStoreScopedUser() ? "disabled" : ""}>${storesOptions(selectedStoreId)}</select></label>
              <label>Dinheiro físico <input name="dinheiro" type="number" min="0" step="0.01" value="0"></label>
              <label>PIX declarado <input name="pix" type="number" min="0" step="0.01" value="0"></label>
              <label>Cartão crédito <input name="cartao_credito" type="number" min="0" step="0.01" value="0"></label>
              <label>Cartão débito <input name="cartao_debito" type="number" min="0" step="0.01" value="0"></label>
              <button type="submit">Fechar Caixa</button>
            </form>
          </div>
        </section>
      ` : ""}
      ${canWrite ? `
        <div class="grid-2">
          <section class="panel">
            <h2>Lançamento de caixa</h2>
            <form id="cash-form" class="form-grid">
              <div class="grid-2">
                <label>Tipo <select name="type"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
                <label>Loja <select name="storeId">${storesOptions()}</select></label>
              </div>
              <div class="grid-2">
                <label>Valor <input name="value" type="number" min="0.01" step="0.01" required></label>
                <label>Categoria <input name="category" required></label>
              </div>
              <label>Descrição <input name="description"></label>
              <button type="submit">Registrar</button>
            </form>
          </section>
          <section class="panel">
            <h2>Conta a pagar</h2>
            <form id="bill-form" class="form-grid">
              <label>Fornecedor <input name="supplier" required></label>
              <div class="grid-3">
                <label>Valor <input name="value" type="number" min="0.01" step="0.01" required></label>
                <label>Vencimento <input name="dueDate" type="date" required></label>
                <label>Loja <select name="storeId">${storesOptions()}</select></label>
              </div>
              <button type="submit">Cadastrar conta</button>
            </form>
          </section>
        </div>
      ` : ""}
      <div class="grid-2">
        <section class="panel">
          <h2>Saldos por loja</h2>
          <div class="split-table"><table><thead><tr><th>Loja</th><th>Saldo</th></tr></thead><tbody>
            ${cash.balancesByStore.map((row) => `<tr><td>${esc(row.storeName)}</td><td>${money(row.balance)}</td></tr>`).join("") || emptyRow(2)}
          </tbody></table></div>
        </section>
        <section class="panel">
          <h2>Contas a pagar</h2>
          <div class="split-table"><table><thead><tr><th>Fornecedor</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>
            ${state.data.bills.map((bill) => `
              <tr>
                <td>${esc(bill.supplier)}</td><td>${esc(bill.dueDate)}</td><td>${money(bill.value)}</td>
                <td>${bill.status === "pago" ? '<span class="status ok">Pago</span>' : bill.dueDate < today() ? '<span class="status danger">Vencida</span>' : '<span class="status warn">Pendente</span>'}</td>
                <td>${canWrite && bill.status !== "pago" ? `<div class="row-actions"><select class="small" data-bill-payment-method="${bill.id}">${paymentOptions()}</select><button class="small secondary" data-pay-bill="${bill.id}" data-store-id="${esc(bill.storeId || bill.loja_id || selectedStoreId)}" type="button">Quitar</button></div>` : ""}</td>
              </tr>
            `).join("") || emptyRow(5)}
          </tbody></table></div>
        </section>
      </div>
    </section>
  `);
  const cashForm = document.querySelector("#cash-form");
  if (cashForm) cashForm.addEventListener("submit", submitForm("/api/cash", "Lançamento registrado."));
  bindCashSessionForms();
  const billForm = document.querySelector("#bill-form");
  if (billForm) billForm.addEventListener("submit", submitForm("/api/bills", "Conta cadastrada."));
  document.querySelectorAll("[data-pay-bill]").forEach((button) => {
    button.addEventListener("click", async () => {
      const paymentMethod = document.querySelector(`[data-bill-payment-method="${button.dataset.payBill}"]`)?.value || "pix";
      await api(`/api/bills/${button.dataset.payBill}`, { method: "PUT", body: JSON.stringify({ status: "pago", storeId: button.dataset.storeId, paymentMethod }) });
      await loadData();
      setMessage("Conta quitada.");
      renderFinance();
    });
  });
}

function cashFormValues(form) {
  const values = Object.fromEntries(new FormData(form));
  if (isStoreScopedUser()) values.storeId = userStoreId();
  return values;
}

function bindCashSessionForms() {
  const openForm = document.querySelector("#cash-open-form");
  if (openForm) {
    openForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/cash/open", { method: "POST", body: JSON.stringify(cashFormValues(openForm)) });
        await loadData();
        setMessage("Caixa aberto.");
        renderFinance();
      } catch (error) {
        setMessage(error.message, true);
        renderFinance();
      }
    });
  }
  const sangriaForm = document.querySelector("#cash-sangria-form");
  if (sangriaForm) {
    sangriaForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api("/api/cash/sangria", { method: "POST", body: JSON.stringify(cashFormValues(sangriaForm)) });
        await loadData();
        setMessage("Sangria registrada.");
        renderFinance();
      } catch (error) {
        setMessage(error.message, true);
        renderFinance();
      }
    });
  }
  const closeForm = document.querySelector("#cash-close-form");
  if (closeForm) {
    closeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = cashFormValues(closeForm);
      const body = {
        storeId: values.storeId,
        valores_declarados: {
          dinheiro: values.dinheiro,
          pix: values.pix,
          cartao_credito: values.cartao_credito,
          cartao_debito: values.cartao_debito,
          boleto: values.boleto || 0
        }
      };
      try {
        const result = await api("/api/cash/close", { method: "POST", body: JSON.stringify(body) });
        await loadData();
        setMessage(`Caixa fechado. Diferença apurada: ${money(result.diferenca)}.`);
        renderFinance();
      } catch (error) {
        setMessage(error.message, true);
        renderFinance();
      }
    });
  }
}

function deliverySearchText(delivery) {
  return [delivery.id, delivery.saleId, delivery.saleCode, delivery.customerName, delivery.deliveryPerson, ...(delivery.products || [])].join(" ").toLowerCase();
}

function deliveryCard(delivery) {
  return `<article class="delivery-card" draggable="true" data-kanban-card="${esc(delivery.id)}" data-delivery-search="${esc(deliverySearchText(delivery))}" data-delivery-person="${esc(delivery.deliveryPerson || "")}">
    <div class="delivery-card-head"><strong>${esc(delivery.customerName || "Cliente não informado")}</strong><span>${esc(delivery.scheduledDate || "Sem data")}</span></div>
    <p class="delivery-address">${esc(delivery.address || "Endereço não informado")}</p>
    <p class="delivery-products">${esc((delivery.products || []).join(", ") || "Produtos não informados")}</p>
    <div class="delivery-card-footer"><span>Entregador: ${esc(delivery.deliveryPerson || "A definir")}</span><button class="small secondary" type="button" data-print-delivery="${esc(delivery.id)}">Romaneio PDF</button></div>
  </article>`;
}

function renderDeliveries() {
  const people = [...new Set(state.data.deliveries.map((delivery) => delivery.deliveryPerson).filter(Boolean))].sort();
  const columns = state.data.deliveryKanbanColumns.length
    ? state.data.deliveryKanbanColumns.slice().sort((a, b) => a.order - b.order)
    : [{ id: "delivery-col-pending", title: "Pendente / A Separar", slug: "pendente", order: 1 }, { id: "delivery-col-route", title: "Em Rota", slug: "em_rota", order: 2 }, { id: "delivery-col-delivered", title: "Entregue", slug: "entregue", order: 3 }];
  renderShell(`
    <section class="page">
      <div class="page-header delivery-page-header"><div><h1>Entregas</h1><p class="muted">Acompanhe a separação, rota e confirmação de cada pedido.</p></div><div class="view-toggle" role="group" aria-label="Visualização das entregas"><button type="button" data-delivery-view="table" class="${state.deliveriesView === "table" ? "active" : ""}">Tabela</button><button type="button" data-delivery-view="kanban" class="${state.deliveriesView === "kanban" ? "active" : ""}">Kanban</button></div></div>
      <section class="panel deliveries-panel">
        <div class="delivery-filters"><label class="search-field">Buscar<input id="deliveries-search" value="${esc(state.deliveriesSearch)}" placeholder="Cliente, produto ou entrega"></label><label>Entregador<select id="deliveries-person"><option value="">Todos os entregadores</option>${people.map((person) => `<option value="${esc(person)}" ${person === state.deliveriesPerson ? "selected" : ""}>${esc(person)}</option>`).join("")}</select></label></div>
        <div class="deliveries-table-view ${state.deliveriesView === "table" ? "is-active" : ""}"><div class="split-table"><table><thead><tr><th>Data</th><th>Turno</th><th>Entregador</th><th>Cliente</th><th>Endereço</th><th>Produtos</th><th>Status</th><th></th></tr></thead><tbody>${state.data.deliveries.map((delivery) => `<tr data-delivery-row data-delivery-search="${esc(deliverySearchText(delivery))}" data-delivery-person="${esc(delivery.deliveryPerson || "")}"><td>${esc(delivery.scheduledDate)}</td><td>${esc(delivery.turno_entrega || delivery.deliveryShift || "Horário Comercial")}</td><td>${esc(delivery.deliveryPerson)}</td><td>${esc(delivery.customerName)}</td><td>${esc(delivery.address)}</td><td>${esc((delivery.products || []).join(", "))}</td><td>${delivery.status === "entregue" ? '<span class="status ok">Entregue</span>' : delivery.status === "em_rota" ? '<span class="status info">Em rota</span>' : delivery.status === "cancelada" ? '<span class="status danger">Cancelada</span>' : '<span class="status warn">Pendente</span>'}</td><td><button class="small secondary" type="button" data-print-delivery="${esc(delivery.id)}">Romaneio PDF</button></td></tr>`).join("") || emptyRow(8)}</tbody></table></div></div>
        ${state.deliveriesView === "kanban" ? `<div class="kanban-toolbar"><button type="button" class="small secondary" id="new-delivery-column">+ Nova Coluna</button></div>${state.deliveryColumnFormOpen ? '<form class="kanban-column-form" id="delivery-column-form"><input name="title" placeholder="Nome da etapa" required><button type="submit">Adicionar</button><button class="secondary" type="button" id="cancel-delivery-column">Cancelar</button></form>' : ""}` : ""}
        <div class="deliveries-kanban-view ${state.deliveriesView === "kanban" ? "is-active" : ""}">${columns.map((column) => `<section class="kanban-column" draggable="true" data-kanban-column-id="${esc(column.id)}"><header><h2>${esc(column.title)}</h2><span>${state.data.deliveries.filter((delivery) => delivery.status === column.slug).length}</span></header><div class="kanban-dropzone" data-kanban-dropzone="${esc(column.slug)}">${state.data.deliveries.filter((delivery) => delivery.status === column.slug).map(deliveryCard).join("") || '<p class="kanban-empty">Nenhuma entrega</p>'}</div></section>`).join("")}</div>
      </section>
    </section>
  `);
  const applyFilters = () => document.querySelectorAll("[data-delivery-search]").forEach((element) => {
    element.hidden = !element.dataset.deliverySearch.includes(state.deliveriesSearch.trim().toLowerCase()) || Boolean(state.deliveriesPerson && element.dataset.deliveryPerson !== state.deliveriesPerson);
  });
  document.querySelector("#deliveries-search")?.addEventListener("input", (event) => { state.deliveriesSearch = event.target.value; applyFilters(); });
  document.querySelector("#deliveries-person")?.addEventListener("change", (event) => { state.deliveriesPerson = event.target.value; applyFilters(); });
  document.querySelectorAll("[data-delivery-view]").forEach((button) => button.addEventListener("click", () => { state.deliveriesView = button.dataset.deliveryView; localStorage.setItem("erp_deliveries_view", state.deliveriesView); renderDeliveries(); }));
  document.querySelector("#new-delivery-column")?.addEventListener("click", () => { state.deliveryColumnFormOpen = true; renderDeliveries(); });
  document.querySelector("#cancel-delivery-column")?.addEventListener("click", () => { state.deliveryColumnFormOpen = false; renderDeliveries(); });
  document.querySelector("#delivery-column-form")?.addEventListener("submit", async (event) => { event.preventDefault(); try { await api("/api/entregas/kanban/columns", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); await loadData(); state.deliveryColumnFormOpen = false; setMessage("Coluna criada."); } catch (error) { setMessage(error.message, true); } renderDeliveries(); });
  bindReceiptButtons();
  document.querySelectorAll("[data-kanban-card]").forEach((card) => {
    card.addEventListener("dragstart", (event) => { event.stopPropagation(); event.dataTransfer.setData("application/x-delivery-card", card.dataset.kanbanCard); card.classList.add("is-dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
  });
  document.querySelectorAll("[data-kanban-dropzone]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("is-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", async (event) => { event.preventDefault(); event.stopPropagation(); zone.classList.remove("is-over"); const id = event.dataTransfer.getData("application/x-delivery-card"); const delivery = state.data.deliveries.find((item) => item.id === id); const status = String(zone.dataset.kanbanDropzone || "").trim(); if (!delivery || delivery.status === status) return; console.log("Enviando status:", status); try { await api(`/api/deliveries/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status }) }); await loadData(); setMessage("Status da entrega atualizado."); } catch (error) { setMessage(error.message || "Não foi possível atualizar a etapa da entrega.", true); } renderDeliveries(); });
  });
  document.querySelectorAll("[data-kanban-column-id]").forEach((column) => {
    column.addEventListener("dragstart", (event) => { event.dataTransfer.setData("application/x-delivery-column", column.dataset.kanbanColumnId); column.classList.add("is-dragging"); });
    column.addEventListener("dragend", () => column.classList.remove("is-dragging"));
    column.addEventListener("dragover", (event) => { if (event.dataTransfer.types.includes("application/x-delivery-column")) event.preventDefault(); });
    column.addEventListener("drop", async (event) => { const movedId = event.dataTransfer.getData("application/x-delivery-column"); if (!movedId || movedId === column.dataset.kanbanColumnId) return; event.preventDefault(); const order = columns.map((item) => item.id); order.splice(order.indexOf(movedId), 1); order.splice(order.indexOf(column.dataset.kanbanColumnId), 0, movedId); try { await api("/api/entregas/kanban/columns/reorder", { method: "PUT", body: JSON.stringify({ columnIds: order }) }); await loadData(); setMessage("Colunas reordenadas."); } catch (error) { setMessage(error.message, true); } renderDeliveries(); });
  });
}

function renderReports() {
  const reports = state.data.reports || { sales: [], cashMovements: [], stock: [] };
  const showroomStores = state.bootstrap?.stores || [];
  const showroomHeaders = showroomStores.map((store) => `<th>Showroom ${esc(store.name || store.nome)}</th>`).join("");
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Relatórios</h1></div>
      <section class="panel">
        <h2>Filtros</h2>
        <form id="report-form" class="form-grid">
          <div class="grid-3">
            <label>De <input name="from" type="date"></label>
            <label>Até <input name="to" type="date" value="${today()}"></label>
            <label>Loja <select name="storeId"><option value="">Todas permitidas</option>${storesOptions()}</select></label>
          </div>
          <div class="toolbar">
            <button type="submit">Filtrar</button>
            <button class="secondary" id="export-csv" type="button">Exportar CSV</button>
          </div>
        </form>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h2>Vendas</h2>
          <div class="split-table"><table><thead><tr><th>Data</th><th>Loja</th><th>Total</th></tr></thead><tbody>
            ${reports.sales.map((sale) => `<tr><td>${esc(sale.date)}</td><td>${esc(byId(state.bootstrap.stores, sale.storeId).name)}</td><td>${money(sale.total)}</td></tr>`).join("") || emptyRow(3)}
          </tbody></table></div>
        </section>
        <section class="panel">
          <h2>Financeiro</h2>
          <div class="split-table"><table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>
            ${reports.cashMovements.map((movement) => `<tr><td>${esc(movement.date)}</td><td>${esc(movement.type)}</td><td>${esc(movement.category)}</td><td>${money(movement.value)}</td></tr>`).join("") || emptyRow(4)}
          </tbody></table></div>
        </section>
      </div>
      <section class="panel">
        <h2>Estoque</h2>
        <div class="split-table"><table><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Depósito</th>${showroomHeaders}<th>Total</th></tr></thead><tbody>
          ${reports.stock.map((row) => `
            <tr>
              <td>${esc(row.productName)}</td>
              <td>${esc(row.sku)}</td>
              <td>${esc(row.category)}</td>
              <td>${row.saldo_deposito}</td>
              ${showroomStores.map((store) => {
                const showroom = (row.showrooms || []).find((item) => item.loja_id === store.id);
                return `<td>${showroom?.quantidade || 0}</td>`;
              }).join("")}
              <td>${row.total}</td>
            </tr>
          `).join("") || emptyRow(5 + showroomStores.length)}
        </tbody></table></div>
      </section>
    </section>
  `);
  document.querySelector("#report-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const params = new URLSearchParams(Object.fromEntries(new FormData(event.currentTarget)));
    state.data.reports = await api(`/api/reports?${params}`);
    setMessage("Relatório atualizado.");
    renderReports();
  });
  document.querySelector("#export-csv").addEventListener("click", exportReportsCsv);
}

function renderIntegrations() {
  const integration = state.data.botIntegration || { apiKey: "", vendedores: [] };
  renderShell(`<section class="page"><div class="page-header"><div><h1>Integrações</h1><p class="muted">Conecte o catálogo e a equipe comercial ao seu chatbot.</p></div></div>
    <section class="panel"><h2>Chave de Acesso do Bot (API Key)</h2><p class="muted">Envie esta chave no cabeçalho <code>x-bot-token</code>. Trate-a como uma senha.</p><div class="integration-key"><code>${esc(integration.apiKey || "Não disponível")}</code><button class="small secondary" id="copy-bot-key" type="button">Copiar</button><button class="small" id="regenerate-bot-key" type="button">Regenerar Token</button></div></section>
    <section class="panel"><h2>Documentação rápida dos endpoints</h2><div class="integration-endpoints"><article><code>POST /api/bot/auth</code><p>Vincula um WhatsApp com telefone e código temporário de seis dígitos.</p></article><article><code>GET /api/bot/estoque?q={termo}</code><p>Consulta catálogo, saldo total, depósito e disponibilidade por unidade.</p></article></div></section>
    <section class="panel"><h2>WhatsApp dos Vendedores Vinculados</h2><div class="split-table"><table><thead><tr><th>Vendedor</th><th>WhatsApp autorizado</th><th>Vinculado em</th><th></th></tr></thead><tbody>${integration.vendedores.map((seller) => `<tr><td>${esc(seller.nome)}</td><td>${esc(seller.whatsapp_phone)}</td><td>${esc(formatDateTime(seller.vinculado_em))}</td><td><button class="small danger" data-unlink-bot-seller="${esc(seller.id)}" type="button">Desvincular</button></td></tr>`).join("") || emptyRow(4)}</tbody></table></div></section></section>`);
  document.querySelector("#copy-bot-key")?.addEventListener("click", async () => { await navigator.clipboard.writeText(integration.apiKey); setMessage("Chave copiada."); renderIntegrations(); });
  document.querySelector("#regenerate-bot-key")?.addEventListener("click", async () => { if (!window.confirm("Regenerar a chave desconectará bots que usam a chave atual.")) return; try { await api("/api/bot/regenerate-token", { method: "POST" }); state.data.botIntegration = await api("/api/bot/token"); setMessage("Chave regenerada."); } catch (error) { setMessage(error.message, true); } renderIntegrations(); });
  document.querySelectorAll("[data-unlink-bot-seller]").forEach((button) => button.addEventListener("click", async () => { try { await api(`/api/integracoes/bot/vendedores/${encodeURIComponent(button.dataset.unlinkBotSeller)}`, { method: "DELETE" }); state.data.botIntegration = await api("/api/integracoes/bot"); setMessage("WhatsApp desvinculado."); } catch (error) { setMessage(error.message, true); } renderIntegrations(); }));
}

function settingTabButton(id, label) {
  return `<button class="tab-button ${state.settingsTab === id ? "active" : ""}" data-settings-tab="${id}" type="button">${label}</button>`;
}

function papelOptions(selected = "") {
  return USER_PAPEIS.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function allUnitOptions(selected = "TODAS") {
  const stores = (state.data.lojas.length ? state.data.lojas : state.bootstrap?.stores || []).filter((loja) => storeStatus(loja) === "ativo");
  return `<option value="TODAS" ${selected === "TODAS" ? "selected" : ""}>Todas as Unidades</option>${stores
    .map((store) => `<option value="${store.id}" ${selected === store.id ? "selected" : ""}>${esc(store.nome || store.name)}</option>`)
    .join("")}`;
}

function userNeedsStore(papel) {
  return ["GERENTE_LOJA", "OPERADOR_CAIXA"].includes(papel);
}

function userById(userId) {
  return state.data.users.find((operator) => operator.id === userId) || {};
}

function linkedStoreLabel(user) {
  const lojaId = user.loja_id || user.storeId;
  if (!lojaId || lojaId === "TODAS") return "Todas as Unidades";
  const label = storeName(lojaId);
  if (label) return label;
  return lojaId;
}

function renderCompanySettings(config) {
  const lojas = config.lojas || {};
  const companyStores = state.bootstrap?.stores || [];
  return `
    <section class="panel">
      <h2>Dados da Empresa</h2>
      <form id="company-settings-form" class="form-grid">
        <div class="grid-3">
          <label>Nome Fantasia / Marca principal <input name="marca_principal" value="${esc(config.marca_principal || COMPANY_NAME)}" required></label>
          <label>Razão Social <input name="razao_social" value="${esc(config.razao_social || "")}"></label>
          <label>CNPJ <input name="cnpj" value="${esc(config.cnpj || "")}"></label>
        </div>
        <div class="grid-3">
          <label>Inscrição Estadual <input name="inscricao_estadual" value="${esc(config.inscricao_estadual || "")}"></label>
          <label>Telefone / WhatsApp <input name="telefone_whatsapp" value="${esc(config.telefone_whatsapp || "")}"></label>
          <div></div>
        </div>
        <div class="grid-2">
          ${companyStores.map((store) => {
            const loja = lojas[store.id] || {};
            return `
              <section class="form-subsection" data-company-store="${esc(store.id)}">
                <h3>${esc(store.name || store.nome)}</h3>
                <label>Logradouro <input name="${esc(store.id)}_logradouro" value="${esc(loja.logradouro || "")}"></label>
                <div class="grid-2">
                  <label>Bairro <input name="${esc(store.id)}_bairro" value="${esc(loja.bairro || "")}"></label>
                  <label>Cidade <input name="${esc(store.id)}_cidade" value="${esc(loja.cidade || "")}"></label>
                </div>
              </section>
            `;
          }).join("")}
        </div>
        <button type="submit">Salvar Dados da Empresa</button>
      </form>
    </section>
  `;
}

function renderReceiptSettings(config) {
  return `
    <section class="panel">
      <h2>Recibo & Garantia</h2>
      <form id="receipt-settings-form" class="form-grid">
        <div class="grid-2">
          <label>Próximo Número de Pedido <input name="proximo_numero_pedido" type="number" min="1001" step="1" value="${Number(config.proximo_numero_pedido || 1001)}" required></label>
          <label class="inline-check"><input name="exibir_assinatura_cliente" type="checkbox" ${config.exibir_assinatura_cliente !== false ? "checked" : ""}> Exibir linha de assinatura do cliente no comprovante</label>
        </div>
        <label>Mensagem de Rodapé / Termo de Garantia
          <textarea name="mensagem_rodape_garantia" rows="6">${esc(config.mensagem_rodape_garantia || "")}</textarea>
        </label>
        <button type="submit">Salvar Parâmetros de Impressão</button>
      </form>
    </section>
  `;
}

function renderStoreSettings() {
  return `
    <section class="panel">
      <h2>Nova Loja / Unidade</h2>
      <form id="store-form" class="form-grid">
        <input type="hidden" name="id">
        <div class="grid-3">
          <label>Nome da loja <input name="nome" required placeholder="Ex.: Loja 3 - Shopping"></label>
          <label>CNPJ <input name="cnpj" inputmode="numeric" autocomplete="off"></label>
          <label>Telefone <input name="telefone" autocomplete="off"></label>
        </div>
        <div class="grid-3">
          <label>Logradouro <input name="logradouro"></label>
          <label>Bairro <input name="bairro"></label>
          <label>Cidade <input name="cidade"></label>
        </div>
        <div class="toolbar">
          <button class="secondary" id="store-clear" type="button">Nova</button>
          <button type="submit">Salvar Loja</button>
        </div>
      </form>
    </section>
    <section class="panel">
      <h2>Lojas cadastradas</h2>
      ${searchBox("stores-search", "Buscar loja, CNPJ, telefone ou endereço")}
      <div class="split-table">
        <table data-search-table="stores"><thead><tr><th>Loja</th><th>CNPJ</th><th>Telefone</th><th>Endereço</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          ${(state.data.lojas || []).map((loja) => `
            <tr data-search="${esc(loja.id)} ${esc(loja.nome || loja.name)} ${esc(loja.cnpj)} ${esc(loja.telefone)} ${esc(lojaAddress(loja))}">
              <td><strong>${esc(loja.nome || loja.name)}</strong><br><span class="muted">${esc(loja.id)}</span></td>
              <td>${esc(loja.cnpj || "-")}</td>
              <td>${esc(loja.telefone || "-")}</td>
              <td>${esc(lojaAddress(loja))}</td>
              <td>${storeStatus(loja) === "ativo" ? '<span class="status ok">Ativa</span>' : '<span class="status danger">Inativa</span>'}</td>
              <td><div class="row-actions"><button class="small secondary" type="button" data-edit-store="${esc(loja.id)}">Editar</button><button class="small secondary" type="button" data-toggle-store="${esc(loja.id)}">${storeStatus(loja) === "ativo" ? "Inativar" : "Ativar"}</button></div></td>
            </tr>
          `).join("") || emptyRow(6)}${emptySearchRow(6)}
        </tbody></table>
      </div>
    </section>
  `;
}

function renderUserSettings() {
  const editor = state.userEditor;
  const passwordUser = state.passwordUserId ? userById(state.passwordUserId) : null;
  const approvalUser = state.approvalUserId ? userById(state.approvalUserId) : null;
  const pendingRequests = state.data.accessRequests?.length
    ? state.data.accessRequests.map((request) => ({ ...request.usuario, requestId: request.id, cargo_solicitado: request.cargo_solicitado, justificativa_acesso: request.justificativa, solicitado_em: request.criado_em }))
    : state.data.users.filter((user) => user.status === "PENDENTE_APROVACAO");
  const teamUsers = state.data.users.filter((user) => !["PENDENTE_APROVACAO", "REJEITADO"].includes(user.status));
  const pendingInvites = state.data.convites.filter((invite) => invite.status === "PENDENTE");
  return `
    <section class="panel access-requests-panel">
      <div class="page-header">
        <div>
          <h2>Solicitações de Acesso Pendentes <span class="count-badge">${pendingRequests.length}</span></h2>
          <p class="muted">Revise a filial solicitada e defina as permissões antes de liberar o acesso.</p>
        </div>
      </div>
      <div class="split-table">
        <table><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo / justificativa</th><th>Data</th><th>Ações</th></tr></thead><tbody>
          ${pendingRequests.map((request) => `
            <tr>
              <td><strong>${esc(request.nome || request.name)}</strong></td>
              <td>${esc(request.login || request.username)}</td>
              <td><strong>${esc(request.cargo_solicitado || "Não informado")}</strong><br><small class="muted">${esc(request.justificativa_acesso || "Solicitação legada")}</small></td>
              <td>${esc(formatDateTime(request.solicitado_em || request.criado_em))}</td>
              <td><div class="row-actions"><button type="button" class="small" data-approve-request="${esc(request.requestId || request.id)}" data-request-user="${esc(request.id)}">Aprovar</button><button type="button" class="small danger-button" data-reject-request="${esc(request.requestId || request.id)}" data-request-user="${esc(request.id)}">Rejeitar</button></div></td>
            </tr>
          `).join("") || emptyRow(5)}
        </tbody></table>
      </div>
    </section>
    <section class="panel">
      <div class="page-header">
        <div>
          <h2>Gestão de Usuários e Permissões</h2>
          <p class="muted">Controle de acesso por papel, unidade vinculada e status de login.</p>
        </div>
        <button id="new-user" type="button">+ Convidar Novo Membro</button>
      </div>
      <div class="split-table">
        <table><thead><tr><th>Nome</th><th>Login</th><th>Papel</th><th>Loja Vinculada</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          ${teamUsers.map((operator) => `
            <tr>
              <td><strong>${esc(operator.nome || operator.name)}</strong></td>
              <td>${esc(operator.login || operator.username)}</td>
              <td>${esc(operator.papelLabel || operator.profileLabel || operator.papel)}</td>
              <td>${esc(linkedStoreLabel(operator))}</td>
              <td>${operator.status === "ATIVO" ? '<span class="status ok">Ativo</span>' : '<span class="status danger">Inativo</span>'}</td>
              <td>
                <div class="row-actions">
                  <button class="small secondary" type="button" data-edit-user="${esc(operator.id)}">Editar Dados / Papel</button>
                  <button class="small secondary" type="button" data-reset-password="${esc(operator.id)}">Redefinir Senha</button>
                  <button class="small secondary" type="button" data-user-status="${esc(operator.id)}" data-active="${operator.ativo !== false && operator.active !== false ? "false" : "true"}">${operator.ativo !== false && operator.active !== false ? "Inativar" : "Reativar"}</button>
                </div>
              </td>
            </tr>
          `).join("") || emptyRow(6)}
        </tbody></table>
      </div>
    </section>
    <section class="panel">
      <div class="page-header">
        <div>
          <h2>Convites Pendentes</h2>
          <p class="muted">Acompanhe convites ainda não ativados pela equipe.</p>
        </div>
      </div>
      <div class="split-table">
        <table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Loja</th><th>Data do Convite</th><th>Ações</th></tr></thead><tbody>
          ${pendingInvites.map((invite) => `
            <tr>
              <td><strong>${esc(invite.nome)}</strong>${invite.expirado ? '<br><span class="status warn">Expirado</span>' : ""}</td>
              <td>${esc(invite.email)}</td>
              <td>${esc(invite.papelLabel || invite.papel)}</td>
              <td>${esc(linkedStoreLabel({ loja_id: invite.loja_id }))}</td>
              <td>${esc(formatDateTime(invite.criado_em))}</td>
              <td>
                <div class="row-actions">
                  <button class="small secondary" type="button" data-resend-invite="${esc(invite.id)}">Reenviar E-mail</button>
                  <button class="small danger" type="button" data-revoke-invite="${esc(invite.id)}">Revogar Convite</button>
                </div>
                ${invite.activationLink ? `<small class="muted local-invite-link">${esc(invite.activationLink)}</small>` : ""}
              </td>
            </tr>
          `).join("") || emptyRow(6)}
        </tbody></table>
      </div>
    </section>
    ${editor ? `
      <div class="modal-backdrop" data-close-user-modal>
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Equipe</span>
              <h2 id="user-modal-title">Editar Integrante</h2>
              <p>Atualize dados, papel e loja vinculada.</p>
            </div>
            <button class="secondary" type="button" data-close-user-modal>Fechar</button>
          </div>
          <form id="user-editor-form" class="form-grid">
            <input type="hidden" name="id" value="${esc(editor.id || "")}">
            <div class="grid-2">
              <label>Nome completo <input name="nome" value="${esc(editor.nome || "")}" required></label>
              <label>Login <input name="login" value="${esc(editor.login || "")}" required autocomplete="off"></label>
            </div>
            <div class="grid-2">
              <label>Papel <select name="papel" id="user-papel" required>${papelOptions(editor.papel || "OPERADOR_CAIXA")}</select></label>
              <label>Loja <select name="loja_id" id="user-loja">${allUnitOptions(editor.loja_id || "TODAS")}</select></label>
            </div>
            <label class="inline-check"><input name="ativo" type="checkbox" ${editor.ativo !== false ? "checked" : ""}> Usuário ativo</label>
            <div class="toolbar">
              <button class="secondary" type="button" data-close-user-modal>Cancelar</button>
              <button type="submit">Salvar Alterações</button>
            </div>
          </form>
        </section>
      </div>
    ` : ""}
    ${state.inviteEditorOpen ? `
      <div class="modal-backdrop" data-close-invite-modal>
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Convite por e-mail</span>
              <h2 id="invite-modal-title">Convidar Novo Membro</h2>
              <p>O integrante receberá um link válido por 48 horas para definir a própria senha.</p>
            </div>
            <button class="secondary" type="button" data-close-invite-modal>Fechar</button>
          </div>
          <form id="invite-editor-form" class="form-grid">
            <div class="grid-2">
              <label>Nome completo <input name="nome" required></label>
              <label>E-mail <input name="email" type="email" required autocomplete="email"></label>
            </div>
            <div class="grid-2">
              <label>Papel <select name="papel" id="invite-papel" required>${papelOptions("OPERADOR_CAIXA")}</select></label>
              <label>Loja Vinculada <select name="loja_id" id="invite-loja">${allUnitOptions(state.bootstrap?.stores?.[0]?.id || "")}</select></label>
            </div>
            <div class="toolbar">
              <button class="secondary" type="button" data-close-invite-modal>Cancelar</button>
              <button type="submit">Enviar Convite</button>
            </div>
          </form>
        </section>
      </div>
    ` : ""}
    ${passwordUser ? `
      <div class="modal-backdrop" data-close-password-modal>
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Segurança</span>
              <h2 id="password-modal-title">Redefinir Senha</h2>
              <p>${esc(passwordUser.nome || passwordUser.name)} terá as sessões ativas encerradas.</p>
            </div>
            <button class="secondary" type="button" data-close-password-modal>Fechar</button>
          </div>
          <form id="password-editor-form" class="form-grid">
            <label>Nova senha <input name="senha" type="password" minlength="4" required autocomplete="new-password"></label>
            <div class="toolbar">
              <button class="secondary" type="button" data-close-password-modal>Cancelar</button>
              <button type="submit">Salvar Senha</button>
            </div>
          </form>
        </section>
      </div>
    ` : ""}
    ${approvalUser ? `
      <div class="modal-backdrop" data-close-approval-modal>
        <section class="modal-card approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title">
          <div class="modal-header">
            <div><span class="eyebrow">Solicitação de acesso</span><h2 id="approval-modal-title">Aprovar Integrante</h2><p>${esc(approvalUser.nome)} · ${esc(approvalUser.login)}</p></div>
            <button class="secondary icon-action" type="button" data-close-approval-modal aria-label="Fechar">×</button>
          </div>
          <form id="approval-form" class="form-grid">
            <div class="grid-2">
              <label>Papel oficial <select name="papel" id="approval-papel" required>${papelOptions("OPERADOR_CAIXA")}</select></label>
              <label>Loja vinculada <select name="loja_id" id="approval-loja">${allUnitOptions(approvalUser.loja_id || state.bootstrap?.stores?.[0]?.id || "")}</select></label>
            </div>
            <label>Senha temporária <input name="senha" type="password" minlength="6" required autocomplete="new-password"></label>
            <div class="toolbar modal-actions"><button class="secondary" type="button" data-close-approval-modal>Cancelar</button><button type="submit">Confirmar Aprovação</button></div>
          </form>
        </section>
      </div>
    ` : ""}
  `;
}

function renderAppearanceSettings() {
  const currentAccent = validHexColor(state.visual.accent) ? state.visual.accent : "#2563eb";
  return `
    <section class="panel">
      <div class="page-header">
        <div>
          <h2>Aparência</h2>
          <p class="muted">Tema visual e cor de destaque salvos neste navegador.</p>
        </div>
      </div>
      <div class="theme-options">
        <div class="theme-section">
          <h3>Modo de Exibição</h3>
          <div class="theme-choice-grid" role="radiogroup" aria-label="Modo de exibição">
            <button class="theme-card ${state.visual.theme === "light" ? "active" : ""}" type="button" data-theme-choice="light" role="radio" aria-checked="${state.visual.theme === "light"}">
              <span class="theme-preview light" aria-hidden="true"></span>
              <strong>Modo Claro<span>Superfícies limpas e alto contraste.</span></strong>
            </button>
            <button class="theme-card ${state.visual.theme === "dark" ? "active" : ""}" type="button" data-theme-choice="dark" role="radio" aria-checked="${state.visual.theme === "dark"}">
              <span class="theme-preview dark" aria-hidden="true"></span>
              <strong>Modo Escuro<span>Fundo escuro com bordas discretas.</span></strong>
            </button>
          </div>
        </div>
        <div class="theme-section">
          <h3>Cor de Destaque</h3>
          <div class="accent-grid" aria-label="Cores predefinidas">
            ${ACCENT_PRESETS.map(([color, label]) => `
              <button class="accent-swatch ${currentAccent.toLowerCase() === color ? "active" : ""}" type="button" data-accent-color="${color}" style="--swatch:${color}" title="${esc(label)}" aria-label="${esc(label)}"></button>
            `).join("")}
            <label class="custom-color">Personalizada
              <input id="custom-accent" type="color" value="${esc(currentAccent)}" aria-label="Cor de destaque customizada">
            </label>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSettings() {
  const config = companyConfig();
  const pendingAccessCount = state.data.users.filter((user) => user.status === "PENDENTE_APROVACAO").length;
  renderShell(`
    <section class="page">
      <div class="page-header"><h1>Configurações</h1></div>
      <div class="tabs" role="tablist" aria-label="Configurações">
        ${settingTabButton("company", "Dados da Empresa")}
        ${settingTabButton("stores", "Lojas / Unidades")}
        ${settingTabButton("receipt", "Recibo & Garantia")}
        ${settingTabButton("users", `Gestão de Usuários${pendingAccessCount ? ` <span class="tab-count">${pendingAccessCount}</span>` : ""}`)}
        ${settingTabButton("appearance", "Aparência")}
      </div>
      ${state.settingsTab === "company" ? renderCompanySettings(config) : ""}
      ${state.settingsTab === "stores" ? renderStoreSettings() : ""}
      ${state.settingsTab === "receipt" ? renderReceiptSettings(config) : ""}
      ${state.settingsTab === "users" ? renderUserSettings() : ""}
      ${state.settingsTab === "appearance" ? renderAppearanceSettings() : ""}
    </section>
  `);
  bindSettings();
}

function bindSettings() {
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.settingsTab = button.dataset.settingsTab;
      setMessage("");
      if (state.settingsTab === "users") {
        state.data.users = await safeLoad("/api/users", []);
        state.data.convites = await safeLoad("/api/convites", []);
      }
      if (state.settingsTab === "stores") state.data.lojas = await safeLoad("/api/lojas", []);
      renderSettings();
    });
  });
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.visual.theme = button.dataset.themeChoice === "dark" ? "dark" : "light";
      applyThemePreference({ persist: true });
      setMessage("Preferência de tema salva.");
      renderSettings();
    });
  });
  document.querySelectorAll("[data-accent-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.visual.accent = button.dataset.accentColor;
      applyThemePreference({ persist: true });
      setMessage("Cor de destaque salva.");
      renderSettings();
    });
  });
  const customAccent = document.querySelector("#custom-accent");
  if (customAccent) {
    customAccent.addEventListener("input", () => {
      if (!validHexColor(customAccent.value)) return;
      state.visual.accent = customAccent.value.toLowerCase();
      applyThemePreference({ persist: true });
    });
    customAccent.addEventListener("change", () => {
      setMessage("Cor de destaque salva.");
      renderSettings();
    });
  }
  const storeForm = document.querySelector("#store-form");
  if (storeForm) {
    const cnpjField = storeForm.elements.cnpj;
    const phoneField = storeForm.elements.telefone;
    cnpjField?.addEventListener("input", () => {
      cnpjField.value = maskCpfCnpj(cnpjField.value);
    });
    phoneField?.addEventListener("input", () => {
      phoneField.value = maskPhone(phoneField.value);
    });
    bindTableSearch("stores-search", "stores");
    storeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(storeForm));
      const storeId = values.id;
      const body = {
        nome: values.nome,
        cnpj: values.cnpj,
        telefone: values.telefone,
        endereco: {
          logradouro: values.logradouro,
          bairro: values.bairro,
          cidade: values.cidade
        }
      };
      try {
        await api(storeId ? `/api/lojas/${encodeURIComponent(storeId)}` : "/api/lojas", {
          method: storeId ? "PUT" : "POST",
          body: JSON.stringify(body)
        });
        await loadData();
        setMessage(storeId ? "Loja atualizada." : "Loja cadastrada.");
        state.settingsTab = "stores";
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
    document.querySelector("#store-clear").addEventListener("click", () => {
      storeForm.reset();
      storeForm.elements.id.value = "";
    });
    document.querySelectorAll("[data-edit-store]").forEach((button) => {
      button.addEventListener("click", () => {
        const loja = (state.data.lojas || []).find((item) => item.id === button.dataset.editStore);
        const endereco = loja?.endereco || {};
        storeForm.elements.id.value = loja.id;
        storeForm.elements.nome.value = loja.nome || loja.name || "";
        storeForm.elements.cnpj.value = loja.cnpj || "";
        storeForm.elements.telefone.value = loja.telefone || "";
        storeForm.elements.logradouro.value = endereco.logradouro || loja.address || "";
        storeForm.elements.bairro.value = endereco.bairro || "";
        storeForm.elements.cidade.value = endereco.cidade || "";
        storeForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    document.querySelectorAll("[data-toggle-store]").forEach((button) => {
      button.addEventListener("click", async () => {
        const loja = (state.data.lojas || []).find((item) => item.id === button.dataset.toggleStore);
        try {
          await api(`/api/lojas/${encodeURIComponent(loja.id)}`, { method: "PUT", body: JSON.stringify({ ativa: storeStatus(loja) !== "ativo" }) });
          await loadData();
          state.settingsTab = "stores";
          setMessage("Status da loja atualizado.");
          renderSettings();
        } catch (error) {
          setMessage(error.message, true);
          renderSettings();
        }
      });
    });
  }
  const companyForm = document.querySelector("#company-settings-form");
  if (companyForm) {
    companyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(companyForm));
      const body = {
        marca_principal: values.marca_principal,
        razao_social: values.razao_social,
        cnpj: values.cnpj,
        inscricao_estadual: values.inscricao_estadual,
        telefone_whatsapp: values.telefone_whatsapp,
        lojas: Object.fromEntries((state.bootstrap?.stores || []).map((store) => [
          store.id,
          {
            logradouro: values[`${store.id}_logradouro`],
            bairro: values[`${store.id}_bairro`],
            cidade: values[`${store.id}_cidade`]
          }
        ]))
      };
      try {
        state.data.config = await api("/api/configuracoes_empresa", { method: "PUT", body: JSON.stringify(body) });
        state.bootstrap.configuracoes_empresa = state.data.config;
        setMessage("Dados da empresa salvos.");
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  }
  const receiptForm = document.querySelector("#receipt-settings-form");
  if (receiptForm) {
    receiptForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(receiptForm);
      const body = {
        proximo_numero_pedido: Number(formData.get("proximo_numero_pedido")),
        mensagem_rodape_garantia: formData.get("mensagem_rodape_garantia"),
        exibir_assinatura_cliente: formData.has("exibir_assinatura_cliente")
      };
      try {
        state.data.config = await api("/api/configuracoes_empresa", { method: "PUT", body: JSON.stringify(body) });
        state.bootstrap.configuracoes_empresa = state.data.config;
        setMessage("Parâmetros de impressão salvos.");
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  }
  document.querySelector("#new-user")?.addEventListener("click", () => {
    state.inviteEditorOpen = true;
    renderSettings();
  });
  document.querySelectorAll("[data-approve-request]").forEach((button) => {
    button.addEventListener("click", () => {
      state.approvalUserId = button.dataset.requestUser || button.dataset.approveRequest;
      state.approvalRequestId = button.dataset.approveRequest;
      renderSettings();
    });
  });
  document.querySelectorAll("[data-reject-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      const account = userById(button.dataset.requestUser || button.dataset.rejectRequest);
      if (!window.confirm(`Rejeitar a solicitação de ${account.nome || account.name}?`)) return;
      try {
        const path = button.dataset.requestUser
          ? `/api/admin/access-requests/${encodeURIComponent(button.dataset.rejectRequest)}/reject`
          : `/api/users/${encodeURIComponent(account.id)}/reject`;
        await api(path, { method: button.dataset.requestUser ? "POST" : "PUT" });
        state.data.users = await api("/api/users");
        state.data.accessRequests = await safeLoad("/api/admin/access-requests", []);
        setMessage("Solicitação rejeitada.");
      } catch (error) {
        setMessage(error.message, true);
      }
      renderSettings();
    });
  });
  document.querySelectorAll("[data-close-approval-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-approval-modal")) {
        state.approvalUserId = "";
        state.approvalRequestId = "";
        renderSettings();
      }
    });
  });
  const approvalForm = document.querySelector("#approval-form");
  if (approvalForm) {
    const papelSelect = approvalForm.querySelector("#approval-papel");
    const lojaSelect = approvalForm.querySelector("#approval-loja");
    const syncApprovalStore = () => {
      const requiresStore = userNeedsStore(papelSelect.value);
      lojaSelect.required = requiresStore;
      lojaSelect.disabled = !requiresStore;
      if (requiresStore && (!lojaSelect.value || lojaSelect.value === "TODAS")) lojaSelect.value = userById(state.approvalUserId).loja_id || state.bootstrap?.stores?.[0]?.id || "";
      if (!requiresStore) lojaSelect.value = "TODAS";
    };
    syncApprovalStore();
    papelSelect.addEventListener("change", syncApprovalStore);
    approvalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const path = state.approvalRequestId
          ? `/api/admin/access-requests/${encodeURIComponent(state.approvalRequestId)}/approve`
          : `/api/users/${encodeURIComponent(state.approvalUserId)}/approve`;
        await api(path, { method: state.approvalRequestId ? "POST" : "PUT", body: JSON.stringify(Object.fromEntries(new FormData(approvalForm))) });
        state.data.users = await api("/api/users");
        state.data.accessRequests = await safeLoad("/api/admin/access-requests", []);
        state.approvalUserId = "";
        state.approvalRequestId = "";
        setMessage("Solicitação aprovada. O integrante já pode entrar no sistema.");
      } catch (error) {
        setMessage(error.message, true);
      }
      renderSettings();
    });
  }
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const operator = userById(button.dataset.editUser);
      state.userEditor = {
        mode: "edit",
        id: operator.id,
        nome: operator.nome || operator.name || "",
        login: operator.login || operator.username || "",
        papel: operator.papel || "OPERADOR_CAIXA",
        loja_id: operator.loja_id || "TODAS",
        ativo: operator.ativo !== false && operator.active !== false
      };
      renderSettings();
    });
  });
  document.querySelectorAll("[data-reset-password]").forEach((button) => {
    button.addEventListener("click", () => {
      state.passwordUserId = button.dataset.resetPassword;
      renderSettings();
    });
  });
  document.querySelectorAll("[data-close-user-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-user-modal")) {
        state.userEditor = null;
        renderSettings();
      }
    });
  });
  document.querySelectorAll("[data-close-password-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-password-modal")) {
        state.passwordUserId = "";
        renderSettings();
      }
    });
  });
  document.querySelectorAll("[data-close-invite-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-invite-modal")) {
        state.inviteEditorOpen = false;
        renderSettings();
      }
    });
  });
  const inviteForm = document.querySelector("#invite-editor-form");
  if (inviteForm) {
    const papelSelect = inviteForm.querySelector("#invite-papel");
    const lojaSelect = inviteForm.querySelector("#invite-loja");
    const syncInviteStore = () => {
      if (!papelSelect || !lojaSelect) return;
      const requiresStore = userNeedsStore(papelSelect.value);
      lojaSelect.required = requiresStore;
      lojaSelect.disabled = !requiresStore;
      if (requiresStore && (!lojaSelect.value || lojaSelect.value === "TODAS")) lojaSelect.value = state.bootstrap?.stores?.[0]?.id || "";
      if (!requiresStore) lojaSelect.value = "TODAS";
    };
    syncInviteStore();
    papelSelect?.addEventListener("change", syncInviteStore);
    inviteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await api("/api/convites", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(inviteForm)))
        });
        state.data.convites = await api("/api/convites");
        state.inviteEditorOpen = false;
        setMessage(result.email?.sent ? "Convite enviado por e-mail." : `Convite criado. ${result.email?.reason || "Configure o SMTP para enviar por e-mail."}`);
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  }
  document.querySelectorAll("[data-resend-invite]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const result = await api(`/api/convites/${button.dataset.resendInvite}/resend`, { method: "POST" });
        state.data.convites = await api("/api/convites");
        setMessage(result.email?.sent ? "Convite reenviado por e-mail." : `Convite atualizado. ${result.email?.reason || "Configure o SMTP para enviar por e-mail."}`);
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  });
  document.querySelectorAll("[data-revoke-invite]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/convites/${button.dataset.revokeInvite}/revoke`, { method: "POST" });
        state.data.convites = await api("/api/convites");
        setMessage("Convite revogado.");
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  });
  const userForm = document.querySelector("#user-editor-form");
  if (userForm) {
    const papelSelect = userForm.querySelector("#user-papel");
    const lojaSelect = userForm.querySelector("#user-loja");
    const syncUserStore = () => {
      if (!papelSelect || !lojaSelect) return;
      const requiresStore = userNeedsStore(papelSelect.value);
      lojaSelect.required = requiresStore;
      lojaSelect.disabled = !requiresStore;
      if (requiresStore && (!lojaSelect.value || lojaSelect.value === "TODAS")) lojaSelect.value = state.bootstrap?.stores?.[0]?.id || "";
      if (!requiresStore) lojaSelect.value = "TODAS";
    };
    syncUserStore();
    papelSelect?.addEventListener("change", syncUserStore);
    userForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(userForm));
      form.ativo = userForm.elements.ativo?.checked === true;
      try {
        const userId = form.id;
        delete form.id;
        await api(`/api/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
        state.data.users = await api("/api/users");
        state.userEditor = null;
        setMessage("Integrante atualizado.");
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  }
  document.querySelectorAll("[data-user-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/users/${button.dataset.userStatus}`, { method: "PUT", body: JSON.stringify({ ativo: button.dataset.active === "true" }) });
        state.data.users = await api("/api/users");
        setMessage("Status do usuário atualizado.");
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  });
  const passwordForm = document.querySelector("#password-editor-form");
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await api(`/api/users/${state.passwordUserId}/password`, { method: "PUT", body: JSON.stringify(Object.fromEntries(new FormData(passwordForm))) });
        state.passwordUserId = "";
        setMessage("Senha redefinida.");
        renderSettings();
      } catch (error) {
        setMessage(error.message, true);
        renderSettings();
      }
    });
  }
}

function exportReportsCsv() {
  const reports = state.data.reports || { sales: [], cashMovements: [], stock: [] };
  const rows = [
    ["tipo", "data", "loja", "descricao", "valor_quantidade"],
    ...reports.sales.map((sale) => ["venda", sale.date, byId(state.bootstrap.stores, sale.storeId).name, sale.id, sale.total]),
    ...reports.cashMovements.map((movement) => ["caixa", movement.date, byId(state.bootstrap.stores, movement.storeId).name, movement.category, movement.value]),
    ...reports.stock.map((row) => {
      const showroomText = (row.showrooms || []).map((showroom) => `${showroom.nome}:${showroom.quantidade}`).join(" ");
      return ["estoque", "", "Depósito/Showrooms", `${row.productName} ${row.sku}`, `dep:${row.saldo_deposito} ${showroomText} total:${row.total}`];
    })
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorios-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function submitForm(path, successMessage) {
  return async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(path, { method: "POST", body: JSON.stringify(values) });
      await loadData();
      setMessage(successMessage);
      render();
    } catch (error) {
      setMessage(error.message, true);
      render();
    }
  };
}

function render() {
  if (!state.token) return renderLogin();
  const visibleViews = views.filter(allowed).map(([id]) => id);
  if (!visibleViews.includes(state.view)) state.view = visibleViews[0] || "products";
  const renderers = {
    home: renderHome,
    products: renderProducts,
    customers: renderCustomers,
    vendedores: renderVendedores,
    fornecedores: renderFornecedores,
    stock: renderStock,
    purchases: renderPurchases,
    showroom: renderShowroom,
    sales: renderSales,
    finance: renderFinance,
    deliveries: renderDeliveries,
    reports: renderReports,
    integrations: renderIntegrations,
    settings: renderSettings
  };
  renderers[state.view]();
}

(async function init() {
  try {
    if (window.location.pathname === "/ativar-conta") {
      await renderActivation();
      return;
    }
    if (state.token) await loadData();
    render();
  } catch {
    localStorage.removeItem("erp_token");
    state.token = "";
    setMessage("Faça login para continuar.");
    renderLogin();
  }
})();
