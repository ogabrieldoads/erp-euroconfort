const { domainRouter } = require("./route-factory");

// O handler compartilhado preserva o mesmo adaptador JSON/PostgreSQL e aplica
// a validação x-bot-token dentro da camada de domínio.
module.exports = (dispatch) => domainRouter((path) => (
  path === "/bot/auth"
  || path === "/bot/estoque"
  || path === "/integracoes/bot"
  || path.startsWith("/integracoes/bot/")
), dispatch);
