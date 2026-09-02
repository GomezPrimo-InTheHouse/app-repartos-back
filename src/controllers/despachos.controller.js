// src/controllers/despachos.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const despachosService = require('../services/despachos.service');

const crear = asyncHandler(async (req, res) => {
  const { cliente_id, items } = req.body;

  if (!cliente_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'cliente_id e items (array no vacío) son requeridos' });
  }

  const despacho = await despachosService.crear({
    ...req.body,
    propietarioId: req.user.propietarioId,
    createdBy: req.user.id,
  });
  res.status(201).json({ despacho });
});

const anular = asyncHandler(async (req, res) => {
  const { motivo } = req.body;
  const despacho = await despachosService.anular(req.user.propietarioId, req.params.id, {
    motivo,
    anuladoPor: req.user.id,
  });
  res.json({ despacho });
});

const obtener = asyncHandler(async (req, res) => {
  const despacho = await despachosService.obtenerPorId(req.user.propietarioId, req.params.id);
  if (!despacho) {
    return res.status(404).json({ error: 'Despacho no encontrado' });
  }
  res.json({ despacho });
});

const listar = asyncHandler(async (req, res) => {
  const { cliente_id, estado, desde, hasta } = req.query;
  const despachos = await despachosService.listar({
    propietarioId: req.user.propietarioId,
    cliente_id,
    estado,
    desde,
    hasta,
  });
  res.json({ despachos });
});

module.exports = { crear, anular, obtener, listar };