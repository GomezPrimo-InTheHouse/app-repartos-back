// src/routes/reportes.routes.js
const { Router } = require('express');
const reportesController = require('../controllers/reportes.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/cliente/:id', reportesController.estadoCuentaCliente);
router.get('/general', reportesController.resumenGeneral);

module.exports = router;