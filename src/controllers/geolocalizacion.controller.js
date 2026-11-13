// src/controllers/geolocalizacion.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/geolocalizacion.service');
const geocodificacion = require('../services/geocodificacion.service');

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

// GET /geolocalizacion/buscar-direccion?direccion=&localidad=
// Sin localidad, usa la más común entre los clientes de la empresa.
const buscarDireccion = asyncHandler(async (req, res) => {
  const resultado = await geocodificacion.buscarDireccion({
    propietarioId: req.user.propietarioId,
    direccion: req.query.direccion,
    localidad: req.query.localidad,
  });
  res.json(resultado);
});

// POST /geolocalizacion/clientes/:id/ubicar-automatico
// Busca la dirección del cliente y, si la encuentra con altura exacta, guarda el pin.
const ubicarAutomatico = asyncHandler(async (req, res) => {
  const resultado = await service.ubicarAutomatico(req.user.propietarioId, req.params.id);
  res.json(resultado);
});

module.exports = {
  listarClientes,
  actualizarUbicacionCliente,
  ubicarAutomatico,
  registrarMiUbicacion,
  listarRepartidores,
  buscarDireccion,
};