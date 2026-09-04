// src/routes/clientes.routes.js
const { Router } = require('express');
const clientesController = require('../controllers/clientes.controller');
const clientesImportController = require('../controllers/clientesImport.controller');
const envasesController = require('../controllers/envases.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', clientesController.listar);
router.get('/:id', clientesController.obtener);
router.post('/', clientesController.crear);
router.put('/:id', clientesController.actualizar);
router.delete('/:id', clientesController.eliminar);

router.post('/importar-excel', upload.single('archivo'), clientesImportController.importar);

router.get('/:id/envases', envasesController.obtenerSaldos);
router.post('/:id/envases/ajuste', envasesController.ajuste);

module.exports = router;