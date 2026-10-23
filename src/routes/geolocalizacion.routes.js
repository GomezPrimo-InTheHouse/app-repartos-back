// src/routes/geolocalizacion.routes.js
const { Router } = require('express');
const controller = require('../controllers/geolocalizacion.controller');
const {
  requireAuth,
  requireAdmin,
  requireModulo,
  requireAlgunModulo,
  requireGeolocalizacionActivo,
} = require('../middleware/auth.middleware');

const router = Router();

// Todo el módulo existe solo si la empresa lo tiene activo.
router.use(requireAuth, requireGeolocalizacionActivo);

// Cualquier usuario de la empresa reporta su propia posición al abrir la app.
router.post('/mi-ubicacion', controller.registrarMiUbicacion);

// Tab Clientes: admin, o vendedor con el módulo Geolocalización.
router.get('/clientes', requireModulo('geolocalizacion'), controller.listarClientes);

// Ubicar a un cliente: también desde Clientes o desde el Reparto del día ("guardar mi ubicación" en la puerta).
router.put(
  '/clientes/:id/ubicacion',
  requireAlgunModulo(['geolocalizacion', 'clientes', 'reparto']),
  controller.actualizarUbicacionCliente
);

// Tab Repartidores: solo el administrador de la empresa.
router.get('/repartidores', requireAdmin, controller.listarRepartidores);

module.exports = router;