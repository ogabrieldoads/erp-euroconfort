const express = require("express");

function domainRouter(matches, dispatch) {
  const router = express.Router();
  router.use((req, res, next) => (matches(req.path) ? dispatch(req, res, next) : next()));
  return router;
}

module.exports = { domainRouter };
