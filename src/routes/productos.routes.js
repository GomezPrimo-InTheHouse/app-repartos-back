// src/routes/productos.routes.js
const { Router } = require('express');
const productosController = require('../controllers/productos.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', productosController.listar);
router.get('/:id', productosController.obtener);
router.post('/', productosController.crear);
router.put('/:id', productosController.actualizar);
router.delete('/:id', productosController.eliminar);

module.exports = router;