# Handoff do ERP Euroconfort

## Estado atual

O projeto e um ERP local para moveis e colchoes, executado por Node.js com frontend estatico e persistencia local em `data/erp-db.json`.

Funcionalidades recentes implementadas:

- autenticacao com hash `scrypt`;
- solicitacao publica de cadastro com aprovacao do gestor;
- status de usuario `PENDENTE_APROVACAO`, `ATIVO`, `INATIVO` e `REJEITADO`;
- gestao de usuarios, papeis e lojas em Configuracoes;
- convites por e-mail via Resend;
- migracao preparada para PostgreSQL/Supabase em `database/schema.sql` e `migrate-json-to-pg.js`;
- modulo de Compras integrado a estoque, custos e contas a pagar;
- temas claro/escuro e cor de destaque;
- persistencia JSON corrigida para evitar falha de `renameSync` no Windows.

## Como iniciar em outro computador

1. Instale Node.js 20 ou superior.
2. Abra um terminal nesta pasta.
3. Instale as dependencias: `npm install` ou `pnpm install`.
4. Copie `.env.example` para `.env` e preencha apenas as credenciais necessarias.
5. Inicie com `node src/server.js`.
6. Acesse `http://localhost:3000/`.

Usuarios iniciais: `gestor`, `gerente1`, `gerente2` e `estoque`. A senha inicial existente no banco de desenvolvimento e `123456`; altere-a antes de qualquer uso real.

## Dados e seguranca

- `data/erp-db.json` e a base local atual e deve ser preservada como contingencia.
- `.env` contem configuracoes potencialmente sensiveis. Nao publique essa pasta.
- Para usar Resend em outro computador, mantenha a chave somente no `.env` e prefira gerar uma nova chave.
- Para migrar para PostgreSQL, configure `DATABASE_URL` e revise o schema antes de executar a migracao.

## Retomada recomendada

Leia `README.md`, este arquivo, `src/server.js`, `public/app.js`, `public/styles.css`, `database/schema.sql` e `tests/`.

Antes de alterar: confirme `data/erp-db.json`, execute `npm test` ou `pnpm test`, preserve as permissoes por papel e nao remova o banco JSON sem validar a migracao PostgreSQL. Depois, teste `http://localhost:3000/` novamente.

## Verificacao

`npm test`

O ultimo estado validado passou em 14 testes.
