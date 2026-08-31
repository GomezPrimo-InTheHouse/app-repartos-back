// src/routes/comprasStock.routes.js
const { Router } = require('express');
const comprasStockController = require('../controllers/comprasStock.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', comprasStockController.listar);
router.post('/', comprasStockController.registrar);

module.exports = router;