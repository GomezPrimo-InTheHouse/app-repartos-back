// src/routes/dashboard.routes.js
const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/resumen', dashboardController.resumen);
router.get('/productos-mas-vendidos', dashboardController.productosMasVendidos);
router.get('/clientes-comprometidos', dashboardController.clientesComprometidos);

module.exports = router;