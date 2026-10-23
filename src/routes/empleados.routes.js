// src/routes/empleados.routes.js
const { Router } = require('express');
const empleadosController = require('../controllers/empleados.controller');
const { requireAuth, requireAdmin, requireModuloEmpresa } = require('../middleware/auth.middleware');

const router = Router();

// "Mi equipo" es un módulo contratable: sin él, la empresa opera solo con su administrador.
router.use(requireAuth, requireAdmin, requireModuloEmpresa('equipo'));

router.get('/modulos-disponibles', empleadosController.modulosDisponibles);
router.get('/', empleadosController.listar);
router.post('/', empleadosController.crear);
router.put('/:id/estado', empleadosController.actualizarEstado);
router.put('/:id/permisos', empleadosController.actualizarPermisos);
router.post('/:id/resetear-password', empleadosController.resetearPassword);

module.exports = router;