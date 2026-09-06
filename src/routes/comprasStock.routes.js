// src/routes/comprasStock.routes.js
const { Router } = require('express');
const comprasStockController = require('../controllers/comprasStock.controller');
const { requireAuth, requireModulo } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth, requireModulo('compras_stock'));

router.get('/', comprasStockController.listar);
router.post('/', comprasStockController.registrar);

module.exports = router;