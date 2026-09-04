// src/routes/pagos.routes.js
const { Router } = require('express');
const pagosController = require('../controllers/pagos.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', pagosController.listar);
router.post('/', pagosController.registrar);
router.post('/:id/anular', pagosController.anular);

module.exports = router;