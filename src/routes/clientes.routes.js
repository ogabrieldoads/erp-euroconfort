const { domainRouter } = require("./route-factory");

module.exports = (dispatch) => domainRouter((path) => ["/customers", "/deliveries", "/vendedores"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)), dispatch);
