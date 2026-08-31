// src/controllers/pagos.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const pagosService = require('../services/pagos.service');

const registrar = asyncHandler(async (req, res) => {
  const { cliente_id, monto } = req.body;

  if (!cliente_id || !monto) {
    return res.status(400).json({ error: 'cliente_id y monto son requeridos' });
  }

  const pago = await pagosService.registrar({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ pago });
});

const listar = asyncHandler(async (req, res) => {
  const { cliente_id, desde, hasta } = req.query;
  const pagos = await pagosService.listar({ cliente_id, desde, hasta });
  res.json({ pagos });
});

module.exports = { registrar, listar };