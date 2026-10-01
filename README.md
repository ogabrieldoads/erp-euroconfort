# ERP MVP Fase 1

Aplicação web para a Fase 1 do ERP de uma rede de 2 lojas físicas de móveis e colchões, construída a partir do DRS `DRS_ERP_MVP_Fase1.docx`.

## Como rodar

```bash
npm start
```

Acesse `http://localhost:3000`.

Para envio real dos convites por e-mail, preencha o arquivo `.env`:

```env
APP_URL=http://localhost:3000
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Euroconfort ERP <onboarding@resend.dev>
```

Usuários iniciais:

| Perfil | Usuário | Senha |
| --- | --- | --- |
| Administrador | `gestor` | `123456` |
| Gerente Loja 1 | `gerente1` | `123456` |
| Gerente Loja 2 | `gerente2` | `123456` |
| Estoque | `estoque` | `123456` |

## Testes

```bash
npm test
```

Os testes cobrem o fluxo de maior risco do DRS e das regras atualizadas: venda com validação no depósito central, baixa automática, lançamento de caixa, geração de ordem de entrega, movimentação de showroom, cadastro/uso de vendedores e permissões da equipe.

## Decisões técnicas

- Stack: Node.js puro no backend e HTML/CSS/JavaScript no frontend. A escolha reduz dependências, custo e risco de instalação.
- Persistência: arquivo JSON em `data/erp-db.json`. Para operação real em duas lojas, a camada de persistência deve ser trocada por um banco compartilhado gratuito ou barato, como Supabase/Postgres, mantendo as regras de negócio já implementadas.
- Autenticação: login próprio por usuário com senha protegida via `scrypt` e sessão por token.
- Usuários e permissões: coleção canônica `usuarios` com `id`, `nome`, `login`, `senha_hash`, `papel`, `loja_id`, `ativo` e `criado_em`. Os papéis são `ADMINISTRADOR`, `GESTOR_FINANCEIRO`, `GERENTE_LOJA`, `OPERADOR_CAIXA` e `ESTOQUE`.
- Convites de equipe: coleção `convites` com token seguro, expiração de 48 horas, status `PENDENTE`, `CONCLUIDO` ou `REVOGADO`, envio transacional via Resend e ativação pública em `/ativar-conta?token=...`.
- Custo: sem serviços pagos nesta versão local. Hospedagem posterior deve priorizar camada gratuita para respeitar RNF06.

## Mapeamento para o DRS

| Requisito | Entrega |
| --- | --- |
| RF01 | Cadastro de produtos com nome, categoria, marca/modelo, SKU, preço de venda, preço de custo e estoque mínimo. |
| RF02 | Cadastro de clientes com nome, telefone, endereço e histórico resumido de compras. |
| RF03 | Produtos e clientes podem ser inativados sem excluir histórico. |
| RF04 | Tela de estoque mostra Depósito Central, Showroom Loja 1, Showroom Loja 2 e saldo físico total por produto. |
| RF05 | Entrada de mercadoria cai automaticamente no Depósito Central. |
| RF06 | Venda concluída baixa estoque automaticamente do Depósito Central, mantendo o caixa na loja da venda. |
| RF07 atualizado | Movimentação de showroom envia itens do Depósito Central para uma loja e retorna itens da loja para o Depósito Central, com histórico. |
| RF08 | Alerta visual quando o saldo total do produto fica abaixo do mínimo configurado. |
| RF09 | Registro de venda com cliente, vendedor(a), loja, produto e forma de pagamento. |
| RF10 / RN01 atualizado | Backend bloqueia venda sem saldo suficiente no Depósito Central, mesmo que haja saldo em showroom. |
| RF11 | Cada venda registra o ID e o nome do vendedor selecionado na coleção `vendedores`. |
| RF12 / RN03 | Venda concluída gera entrada automática de caixa. |
| RF13 | Financeiro registra entradas e saídas de caixa por data, valor, categoria e loja. |
| RF14 | Cadastro de contas a pagar com fornecedor, valor, vencimento e status. |
| RF15 | Saldo de caixa consolidado e por loja, respeitando perfil. |
| RF16 | Gestor pode marcar conta como quitada com data de pagamento. |
| RF17 / RN03 | Venda com entrega gera ordem com cliente, endereço, produtos e entregador. |
| RF18 | Entregas são listadas por data e entregador, sem cálculo de rota. |
| RF19 | Ordem de entrega pode alternar entre pendente e entregue. |
| RF20 | Home mostra faturamento do período, saldo de caixa e contas próximas/vencidas. |
| RF21 | Home mostra ranking de vendas por vendedor(a) usando a entidade `vendedores`. |
| RF22 | Home mostra ranking de produtos e marcas/modelos vendidos. |
| RF23 | Relatórios filtram vendas, estoque e financeiro por período e loja. |
| RF24 | Exportação simples em CSV dos dados exibidos nos relatórios. |
| RNF01 / RNF02 | Interface web responsiva, simples e objetiva. |
| RNF05 / RN05 | Gestor vê financeiro consolidado; gerente vê dados da própria loja. Ações financeiras manuais ficam restritas ao Gestor. |
| RNF06 / RNF07 | Sem custo operacional local e sem dependência de migração do CUSTON. |

## Limites conhecidos da versão local

- O banco JSON é adequado para validação funcional e uso piloto controlado, mas não é a escolha final ideal para acesso simultâneo entre duas lojas.
- A estrutura atual de saldo em `data/erp-db.json` usa `saldo_deposito`, `showroom_loja1` e `showroom_loja2` por produto.
- A estrutura atual de vendedores em `data/erp-db.json` usa a coleção `vendedores` com `id`, `nome`, `loja_padrao`, `telefone`, `ativo` e `criado_em`.
- A exportação implementada é CSV; PDF pode ficar para depois porque RF24 tem prioridade baixa.
- O DRS não especifica cadastro de usuários pela interface, então os usuários iniciais são semeados no backend.
