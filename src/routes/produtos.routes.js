const { domainRouter } = require("./route-factory");

module.exports = (dispatch) => domainRouter((path) => ["/products", "/stock", "/showroom"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)), dispatch);
