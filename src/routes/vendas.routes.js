const { domainRouter } = require("./route-factory");

module.exports = (dispatch) => domainRouter((path) => ["/sales", "/cash"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)), dispatch);
