// src/controllers/geolocalizacion.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
// const service = require('../services/geolocalizacion.service');
const service = require('../services/geolocalizacion.service')

// GET /geolocalizacion/clientes?lista_id=
const listarClientes = asyncHandler(async (req, res) => {
  const resultado = await service.listarClientes({
    propietarioId: req.user.propietarioId,
    listaId: req.query.lista_id || null,
  });
  res.json(resultado);
});

// PUT /geolocalizacion/clientes/:id/ubicacion  Body: { latitud, longitud, origen: 'manual' | 'gps' }
// latitud y longitud en null quitan la ubicación.
const actualizarUbicacionCliente = asyncHandler(async (req, res) => {
  const { latitud, longitud, origen } = req.body ?? {};
  const cliente = await service.actualizarUbicacionCliente(req.user.propietarioId, req.params.id, {
    latitud,
    longitud,
    origen,
  });
  res.json({ cliente });
});

// POST /geolocalizacion/mi-ubicacion  Body: { latitud, longitud, precision? }
const registrarMiUbicacion = asyncHandler(async (req, res) => {
  const { latitud, longitud, precision } = req.body ?? {};
  await service.registrarMiUbicacion({
    userId: req.user.id,
    propietarioId: req.user.propietarioId,
    latitud,
    longitud,
    precision,
  });
  res.json({ ok: true });
});

// GET /geolocalizacion/repartidores
const listarRepartidores = asyncHandler(async (req, res) => {
  const repartidores = await service.listarRepartidores(req.user.propietarioId);
  res.json({ repartidores });
});

module.exports = { listarClientes, actualizarUbicacionCliente, registrarMiUbicacion, listarRepartidores };