// src/routes/dashboard.routes.js
const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { requireAuth, requireModulo } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth, requireModulo('dashboard'));

router.get('/resumen', dashboardController.resumen);
router.get('/productos-mas-vendidos', dashboardController.productosMasVendidos);
router.get('/clientes-comprometidos', dashboardController.clientesComprometidos);

module.exports = router;