// src/routes/repartos.routes.js
const { Router } = require('express');
const listasController = require('../controllers/repartosListas.controller');
const ejecucionesController = require('../controllers/repartosEjecuciones.controller');
const { requireAuth, requireModulo } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth, requireModulo('reparto'));

router.get('/listas', listasController.listar);
router.get('/listas/:id', listasController.obtener);
router.post('/listas', listasController.crear);
router.put('/listas/:id', listasController.actualizar);
router.delete('/listas/:id', listasController.eliminar);
router.post('/listas/:id/items', listasController.agregarItem);
router.delete('/listas/:id/items/:itemId', listasController.eliminarItem);

router.get('/hoy', ejecucionesController.hoy);
router.get('/ejecuciones', ejecucionesController.listar);
router.get('/ejecuciones/:id', ejecucionesController.obtener);
router.put('/ejecuciones/:id/items/:itemId', ejecucionesController.actualizarItem);
router.post('/ejecuciones/:id/completar', ejecucionesController.completar);

module.exports = router;