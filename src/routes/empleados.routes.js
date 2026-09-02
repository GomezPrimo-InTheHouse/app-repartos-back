// src/routes/empleados.routes.js
const { Router } = require('express');
const empleadosController = require('../controllers/empleados.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/', empleadosController.listar);
router.post('/', empleadosController.crear);
router.put('/:id/estado', empleadosController.actualizarEstado);
router.post('/:id/resetear-password', empleadosController.resetearPassword);

module.exports = router;