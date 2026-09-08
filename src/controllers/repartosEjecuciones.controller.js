// src/controllers/repartosEjecuciones.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/repartosEjecuciones.service');
const { env } = require('../config/env');

// "Hoy" calculado en la zona horaria del negocio, NO en la del servidor (que en Render es UTC).
// Usa Intl.DateTimeFormat con locale 'en-CA', que da formato YYYY-MM-DD directo.
function hoyEnZonaDelNegocio() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.timezoneNegocio,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

const hoy = asyncHandler(async (req, res) => {
  const fecha = req.query.fecha || hoyEnZonaDelNegocio();
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
  const { visitado } = req.body;
  const item = await service.actualizarItemEjecucion(req.user.propietarioId, req.params.id, req.params.itemId, { visitado });
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