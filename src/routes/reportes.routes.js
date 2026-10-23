// src/routes/reportes.routes.js
const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
const { requireAuth, requireModulo } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

// Reportes (módulo contratable)
router.get('/cliente/:id', requireModulo('reportes'), reportesController.estadoCuentaCliente);
router.get('/general', requireModulo('reportes'), reportesController.resumenGeneral);

// El comprobante de pago es parte de Pagos (módulo base): se emite aunque la empresa no tenga Reportes.
router.get('/pago/:id', requireModulo('pagos'), reportesController.comprobantePago);

module.exports = router;