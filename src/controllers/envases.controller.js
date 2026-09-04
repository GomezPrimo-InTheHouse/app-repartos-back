// src/controllers/envases.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const envasesService = require('../services/envases.service');

const obtenerSaldos = asyncHandler(async (req, res) => {
  const envases = await envasesService.obtenerSaldos(req.user.propietarioId, req.params.id);
  res.json({ envases });
});

const ajuste = asyncHandler(async (req, res) => {
  const { producto_id, delta, motivo } = req.body;

  if (!producto_id || delta === undefined) {
    return res.status(400).json({ error: 'producto_id y delta son requeridos' });
  }

  const resultado = await envasesService.ajusteManual({
    propietarioId: req.user.propietarioId,
    clienteId: req.params.id,
    productoId: producto_id,
    delta: Number(delta),
    motivo,
    createdBy: req.user.id,
  });

  res.status(201).json(resultado);
});

module.exports = { obtenerSaldos, ajuste };