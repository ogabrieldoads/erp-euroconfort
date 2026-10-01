const express = require("express");
const authRoutes = require("./auth.routes");
const produtosRoutes = require("./produtos.routes");
const vendasRoutes = require("./vendas.routes");
const comprasRoutes = require("./compras.routes");
const clientesRoutes = require("./clientes.routes");

function createApiRouter(runtime) {
  const router = express.Router();
  const dispatch = runtime.dispatch.bind(runtime);
  router.use(authRoutes(dispatch));
  router.use(produtosRoutes(dispatch));
  router.use(vendasRoutes(dispatch));
  router.use(comprasRoutes(dispatch));
  router.use(clientesRoutes(dispatch));
  router.use(dispatch);
  return router;
}

module.exports = { createApiRouter };
