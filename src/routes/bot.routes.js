const { domainRouter } = require("./route-factory");

// O handler compartilhado preserva o mesmo adaptador JSON/PostgreSQL e aplica
// a validação x-bot-token dentro da camada de domínio.
module.exports = (dispatch) => domainRouter((path) => (
  path === "/bot/auth"
  || path === "/bot/estoque"
  || path === "/bot/token"
  || path === "/bot/regenerate-token"
  || path === "/integracoes/bot"
  || path === "/integracoes/regenerate-token"
  || path.startsWith("/integracoes/bot/")
), dispatch);
