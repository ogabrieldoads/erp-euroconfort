CREATE TABLE IF NOT EXISTS lojas (
  id VARCHAR PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  endereco JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO lojas (id, nome, cnpj, telefone, endereco, ativa)
VALUES ('TODAS', 'Todas as Unidades', NULL, NULL, '{}'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN (
    'ADMINISTRADOR',
    'GESTOR_FINANCEIRO',
    'GERENTE_LOJA',
    'OPERADOR_CAIXA',
    'ESTOQUE',
    'PENDENTE'
  )),
  loja_id VARCHAR NOT NULL REFERENCES lojas(id),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('PENDENTE_APROVACAO', 'ATIVO', 'INATIVO', 'REJEITADO')),
  solicitado_em TIMESTAMPTZ,
  aprovado_por VARCHAR,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ATIVO';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS solicitado_em TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprovado_por VARCHAR;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo_solicitado TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS justificativa_acesso TEXT;
UPDATE usuarios SET status = CASE WHEN ativo THEN 'ATIVO' ELSE 'INATIVO' END WHERE status IS NULL OR status NOT IN ('PENDENTE_APROVACAO', 'ATIVO', 'INATIVO', 'REJEITADO');
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_papel_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_papel_check CHECK (papel IN ('ADMINISTRADOR', 'GESTOR_FINANCEIRO', 'GERENTE_LOJA', 'OPERADOR_CAIXA', 'ESTOQUE', 'PENDENTE'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_status_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_status_check CHECK (status IN ('PENDENTE_APROVACAO', 'ATIVO', 'INATIVO', 'REJEITADO'));
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_aprovado_por_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES usuarios(id);

CREATE TABLE IF NOT EXISTS solicitacoes_acesso (
  id VARCHAR PRIMARY KEY,
  usuario_id VARCHAR NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo_solicitado TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  analisado_por VARCHAR REFERENCES usuarios(id) ON DELETE RESTRICT,
  analisado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_acesso_status_criado ON solicitacoes_acesso(status, criado_em);

CREATE TABLE IF NOT EXISTS produtos (
  id VARCHAR PRIMARY KEY,
  sku TEXT UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT,
  tamanho TEXT,
  preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_custo NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  saldo_deposito INTEGER NOT NULL DEFAULT 0,
  showroom JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_minimo INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS fornecedores (
  id VARCHAR PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  contato_nome TEXT,
  telefone TEXT,
  email TEXT,
  condicoes_pagamento_padrao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_compra (
  id VARCHAR PRIMARY KEY,
  fornecedor_id VARCHAR NOT NULL REFERENCES fornecedores(id),
  data_emissao DATE NOT NULL,
  previsao_entrega DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'RASCUNHO',
    'PEDIDO_ENVIADO',
    'EM_TRANSITO',
    'RECEBIDO_TOTAL',
    'RECEBIDO_PARCIAL',
    'CANCELADO'
  )),
  valor_produtos NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_frete NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  condicao_pagamento TEXT NOT NULL,
  observacoes TEXT,
  recebido_em TIMESTAMPTZ,
  criado_por VARCHAR REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  financeiro_gerado_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS itens_ordem_compra (
  id VARCHAR PRIMARY KEY,
  ordem_id VARCHAR NOT NULL REFERENCES ordens_compra(id) ON DELETE CASCADE,
  produto_id VARCHAR NOT NULL REFERENCES produtos(id),
  quantidade_pedida INTEGER NOT NULL CHECK (quantidade_pedida > 0),
  quantidade_recebida INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0 AND quantidade_recebida <= quantidade_pedida),
  custo_unitario NUMERIC(12,2) NOT NULL CHECK (custo_unitario > 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (ordem_id, produto_id)
);

CREATE TABLE IF NOT EXISTS contas_a_pagar (
  id VARCHAR PRIMARY KEY,
  ordem_id VARCHAR REFERENCES ordens_compra(id),
  fornecedor_id VARCHAR REFERENCES fornecedores(id),
  numero_parcela INTEGER NOT NULL DEFAULT 1,
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  referencia TEXT,
  pago_em DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id VARCHAR PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  endereco JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendas (
  id VARCHAR PRIMARY KEY,
  codigo_venda INTEGER UNIQUE,
  loja_id VARCHAR NOT NULL REFERENCES lojas(id),
  vendedor_id VARCHAR,
  cliente_id VARCHAR REFERENCES clientes(id),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  pagamentos JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itens_venda (
  id SERIAL PRIMARY KEY,
  venda_id VARCHAR NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id VARCHAR REFERENCES produtos(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id SERIAL PRIMARY KEY,
  produto_id VARCHAR REFERENCES produtos(id),
  tipo TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  saldo_apos INTEGER,
  referencia TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessoes_caixa (
  id VARCHAR PRIMARY KEY,
  loja_id VARCHAR NOT NULL REFERENCES lojas(id),
  operador_id VARCHAR REFERENCES usuarios(id),
  data_abertura TIMESTAMPTZ NOT NULL,
  saldo_inicial_troco NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_fechamento TIMESTAMPTZ,
  status TEXT NOT NULL,
  valores_declarados JSONB NOT NULL DEFAULT '{}'::jsonb,
  valores_sistema JSONB NOT NULL DEFAULT '{}'::jsonb,
  diferenca NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendedores (
  id VARCHAR PRIMARY KEY,
  nome TEXT NOT NULL,
  loja_id VARCHAR NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  comissao_padrao NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS bot_auth_code VARCHAR(6);
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS bot_code_expires_at TIMESTAMPTZ;
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

CREATE TABLE IF NOT EXISTS entregas (
  id VARCHAR PRIMARY KEY,
  venda_id VARCHAR NOT NULL REFERENCES vendas(id) ON DELETE RESTRICT,
  cliente_id VARCHAR REFERENCES clientes(id) ON DELETE RESTRICT,
  endereco_entrega JSONB NOT NULL DEFAULT '{}'::jsonb,
  turno TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  motorista TEXT,
  data_agendada DATE,
  assinado_por TEXT,
  comprovante_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etapas são configuráveis pelo Kanban; instalações antigas não devem manter
-- uma restrição estática de status.
ALTER TABLE entregas DROP CONSTRAINT IF EXISTS entregas_status_check;

CREATE TABLE IF NOT EXISTS entregas_kanban_colunas (
  id VARCHAR PRIMARY KEY,
  titulo TEXT NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  posicao INTEGER NOT NULL CHECK (posicao > 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id VARCHAR PRIMARY KEY,
  sessao_caixa_id VARCHAR REFERENCES sessoes_caixa(id) ON DELETE RESTRICT,
  loja_id VARCHAR NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('SUPRIMENTO', 'SANGRIA', 'ENTRADA_VENDA', 'ESTORNO', 'CONTA_PAGAR', 'OUTRO')),
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  forma_pagamento TEXT,
  motivo TEXT,
  operador_id VARCHAR REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contas_pagar_manuais (
  id VARCHAR PRIMARY KEY,
  fornecedor_id VARCHAR REFERENCES fornecedores(id) ON DELETE RESTRICT,
  loja_id VARCHAR NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  categoria TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  pago_em DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS convites (
  id VARCHAR PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  papel TEXT NOT NULL,
  loja_id VARCHAR NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  expiracao TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuracoes_empresa (
  chave VARCHAR PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estado compatível durante a transição: preserva os campos legados ainda
-- consumidos pela interface enquanto as entidades normalizadas são projetadas
-- nas tabelas relacionais acima.
CREATE TABLE IF NOT EXISTS erp_runtime_state (
  id VARCHAR PRIMARY KEY,
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ordens_compra ADD COLUMN IF NOT EXISTS loja_id VARCHAR REFERENCES lojas(id) ON DELETE RESTRICT;
ALTER TABLE itens_ordem_compra ADD COLUMN IF NOT EXISTS custo_planejado NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE itens_ordem_compra ADD COLUMN IF NOT EXISTS valor_recebido NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE contas_a_pagar ADD COLUMN IF NOT EXISTS loja_id VARCHAR REFERENCES lojas(id) ON DELETE RESTRICT;
ALTER TABLE contas_a_pagar ADD COLUMN IF NOT EXISTS movimentacao_caixa_id VARCHAR;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS external_id VARCHAR UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_fornecedor ON ordens_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_status ON ordens_compra(status);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_previsao ON ordens_compra(previsao_entrega);
CREATE INDEX IF NOT EXISTS idx_itens_ordem_compra_ordem ON itens_ordem_compra(ordem_id);
CREATE INDEX IF NOT EXISTS idx_itens_ordem_compra_produto ON itens_ordem_compra(produto_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_vencimento_status ON contas_a_pagar(data_vencimento, status);
CREATE INDEX IF NOT EXISTS idx_vendas_codigo_venda ON vendas(codigo_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_loja_id ON vendas(loja_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_criado_em ON vendas(criado_em);
CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);
CREATE INDEX IF NOT EXISTS idx_usuarios_loja_id ON usuarios(loja_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_produto_id ON movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_criado_em ON movimentacoes_estoque(criado_em);
CREATE INDEX IF NOT EXISTS idx_sessoes_caixa_loja_status ON sessoes_caixa(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_vendedores_loja_ativo ON vendedores(loja_id, ativo);
CREATE INDEX IF NOT EXISTS idx_entregas_data_status ON entregas(data_agendada, status);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_loja_data ON movimentacoes_caixa(loja_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_manuais_vencimento_status ON contas_pagar_manuais(vencimento, status);
CREATE INDEX IF NOT EXISTS idx_convites_email_expiracao ON convites(email, expiracao);
