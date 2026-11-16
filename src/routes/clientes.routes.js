// src/routes/clientes.routes.js
const { Router } = require('express');
const clientesController = require('../controllers/clientes.controller');
const clientesImportController = require('../controllers/clientesImport.controller');
const envasesController = require('../controllers/envases.controller');
const { requireAuth, requireModulo, requireAlgunModulo } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = Router();

// Antes del router.use: el teléfono también se carga desde el aviso por WhatsApp del módulo Reparto,
// así que alcanza con tener Clientes o Reparto.
router.put('/:id/telefono', requireAuth, requireAlgunModulo(['clientes', 'reparto']), clientesController.actualizarTelefono);

router.use(requireAuth, requireModulo('clientes'));

router.get('/', clientesController.listar);
router.get('/:id', clientesController.obtener);
router.post('/', clientesController.crear);
router.put('/:id', clientesController.actualizar);
router.delete('/:id', clientesController.eliminar);

router.post('/importar-excel/previsualizar', upload.single('archivo'), clientesImportController.previsualizar);
router.post('/importar-excel/confirmar', clientesImportController.confirmar);

router.get('/:id/envases', envasesController.obtenerSaldos);
router.post('/:id/envases/ajuste', envasesController.ajuste);

module.exports = router;