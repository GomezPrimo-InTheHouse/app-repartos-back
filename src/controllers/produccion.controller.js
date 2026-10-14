// src/controllers/produccion.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const produccionService = require('../services/produccion.service');

const registrar = asyncHandler(async (req, res) => {
  const resultado = await produccionService.registrar({
    ...req.body,
    propietarioId: req.user.propietarioId,
    createdBy: req.user.id,
  });
  res.status(201).json(resultado);
});

const listar = asyncHandler(async (req, res) => {
  const { producto_id, tipo, desde, hasta, orden } = req.query;
  const limit = req.query.limit !== undefined ? Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 100) : 8;
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const resultado = await produccionService.listar({
    propietarioId: req.user.propietarioId,
    producto_id, tipo, desde, hasta, orden, limit, offset,
  });
  res.json(resultado);
});

module.exports = { registrar, listar };