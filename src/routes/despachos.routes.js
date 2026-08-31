// src/routes/despachos.routes.js
const { Router } = require('express');
const despachosController = require('../controllers/despachos.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', despachosController.listar);
router.get('/:id', despachosController.obtener);
router.post('/', despachosController.crear);
router.post('/:id/anular', despachosController.anular);

module.exports = router;