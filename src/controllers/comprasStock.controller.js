// src/controllers/comprasStock.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const comprasStockService = require('../services/comprasStock.service');

const registrar = asyncHandler(async (req, res) => {
  const { producto_id, cantidad, costo_unitario } = req.body;

  if (!producto_id || !cantidad || costo_unitario === undefined) {
    return res.status(400).json({ error: 'producto_id, cantidad y costo_unitario son requeridos' });
  }

  const resultado = await comprasStockService.registrar({ ...req.body, createdBy: req.user.id });
  res.status(201).json(resultado);
});

const listar = asyncHandler(async (req, res) => {
  const { producto_id, desde, hasta } = req.query;
  const compras = await comprasStockService.listar({ producto_id, desde, hasta });
  res.json({ compras });
});

module.exports = { registrar, listar };