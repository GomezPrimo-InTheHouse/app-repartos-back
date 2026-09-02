// src/routes/admin.routes.js
const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get('/usuarios', adminController.listarUsuarios);
router.post('/resetear-password', adminController.resetearPassword);
router.get('/propietarios', adminController.listarPropietarios);

module.exports = router;