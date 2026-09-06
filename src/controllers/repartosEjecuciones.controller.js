
// src/controllers/repartosEjecuciones.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/repartosEjecuciones.service');

const hoy = asyncHandler(async (req, res) => {
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
  const ejecuciones = await service.obtenerOGenerarDelDia({
    propietarioId: req.user.propietarioId,
    fecha,
  });
  res.json({ fecha, ejecuciones });
});

const listar = asyncHandler(async (req, res) => {
  const { desde, hasta, lista_reparto_id } = req.query;
  const ejecuciones = await service.listarEjecuciones({
    propietarioId: req.user.propietarioId,
    desde,
    hasta,
    lista_reparto_id,
  });
  res.json({ ejecuciones });
});

const obtener = asyncHandler(async (req, res) => {
  const ejecucion = await service.obtenerEjecucionDetalle(req.user.propietarioId, req.params.id);
  if (!ejecucion) {
    return res.status(404).json({ error: 'Ejecución no encontrada' });
  }
  res.json({ ejecucion });
});

const actualizarItem = asyncHandler(async (req, res) => {
  const { visitado, productos } = req.body;
  const item = await service.actualizarItemEjecucion(
    req.user.propietarioId,
    req.params.id,
    req.params.itemId,
    { visitado, productos }
  );
  res.json({ item });
});

const completar = asyncHandler(async (req, res) => {
  const ejecucion = await service.completarEjecucion(req.user.propietarioId, req.params.id);
  if (!ejecucion) {
    return res.status(404).json({ error: 'Ejecución no encontrada' });
  }
  res.json({ ejecucion });
});

module.exports = { hoy, listar, obtener, actualizarItem, completar };