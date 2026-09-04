// src/controllers/pagos.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const pagosService = require('../services/pagos.service');

const registrar = asyncHandler(async (req, res) => {
  const { cliente_id, monto } = req.body;

  if (!cliente_id || monto === undefined || monto === null) {
    return res.status(400).json({ error: 'cliente_id y monto son requeridos' });
  }

  const pago = await pagosService.registrar({
    ...req.body,
    propietarioId: req.user.propietarioId,
    createdBy: req.user.id,
  });
  res.status(201).json({ pago });
});

const anular = asyncHandler(async (req, res) => {
  const { motivo } = req.body;
  const pago = await pagosService.anular(req.user.propietarioId, req.params.id, {
    motivo,
    anuladoPor: req.user.id,
  });
  res.json({ pago });
});

const listar = asyncHandler(async (req, res) => {
  const { cliente_id, estado, desde, hasta, limit, offset } = req.query;

  const resultado = await pagosService.listar({
    propietarioId: req.user.propietarioId,
    cliente_id,
    estado,
    desde,
    hasta,
    limit: limit !== undefined ? Number(limit) : undefined,
    offset: offset !== undefined ? Number(offset) : undefined,
  });

  res.json(resultado); // { pagos, total }
});

module.exports = { registrar, anular, listar };