const { domainRouter } = require("./route-factory");

module.exports = (dispatch) => domainRouter((path) => ["/compras", "/fornecedores", "/bills"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)), dispatch);
