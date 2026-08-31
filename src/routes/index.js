// src/routes/index.js
const { Router } = require('express');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', require('./auth.routes'));
router.use('/clientes', require('./clientes.routes'));
router.use('/productos', require('./productos.routes'));
router.use('/despachos', require('./despachos.routes'));
router.use('/pagos', require('./pagos.routes'));
router.use('/compras-stock', require('./comprasStock.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;