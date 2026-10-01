# Como continuar o projeto ERP após formatar o computador

## Pasta do projeto

Antes de formatar o computador, copie a pasta inteira do projeto para o HD externo:

```text
C:\Users\gabri\Documents\Codex\2026-09-10\1-introdu-o-voc-vai-atuar
```

Não copie apenas arquivos soltos. O ideal é levar a pasta completa.

## Arquivos principais

Dentro da pasta estão os principais arquivos do ERP:

```text
src/server.js
public/app.js
public/styles.css
data/erp-db.json
tests/critical-flow.test.js
package.json
```

O arquivo mais importante para não perder dados é:

```text
data/erp-db.json
```

Ele guarda produtos, clientes, vendas, estoque, usuários, configurações e histórico de movimentações.

Recomendação: guarde também uma cópia extra desse arquivo no HD externo, com um nome como:

```text
backup-erp-db.json
```

## Depois de formatar

1. Instale o Node.js versão 20 ou superior.
2. Copie a pasta do ERP do HD externo para o novo computador, ou rode direto do HD.
3. Abra o terminal dentro da pasta do projeto.
4. Rode:

```bash
npm install
npm start
```

5. Acesse no navegador:

```text
http://localhost:3000
```

## Login padrão

Se o usuário e senha não tiverem sido alterados:

```text
Usuário: gestor
Senha: 123456
```

## Observação importante

Se depois da formatação o caminho da pasta mudar, não tem problema. O projeto funciona desde que você abra o terminal dentro da pasta correta e rode `npm install` e `npm start`.
