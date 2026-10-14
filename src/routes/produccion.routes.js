// src/routes/produccion.routes.js
const { Router } = require('express');
const produccionController = require('../controllers/produccion.controller');
const { requireAuth, requireModulo, requireProduccionActivo } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth, requireProduccionActivo, requireModulo('produccion'));

router.get('/', produccionController.listar);
router.post('/', produccionController.registrar);

module.exports = router;