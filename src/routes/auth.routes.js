const { domainRouter } = require("./route-factory");

module.exports = (dispatch) => domainRouter((path) => [
  "/public/lojas", "/solicitacoes-acesso", "/login", "/auth/login", "/ativar-conta", "/me", "/logout",
  "/convites", "/convites/validar", "/users"
].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)), dispatch);
