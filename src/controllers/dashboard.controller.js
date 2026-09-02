// src/controllers/dashboard.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const resumen = asyncHandler(async (req, res) => {
  const data = await dashboardService.obtenerResumen(req.user.propietarioId);
  res.json(data);
});

const productosMasVendidos = asyncHandler(async (req, res) => {
  const { limit, desde, hasta } = req.query;
  const productos = await dashboardService.productosMasVendidos({
    propietarioId: req.user.propietarioId,
    limit: limit ? Number(limit) : undefined,
    desde,
    hasta,
  });
  res.json({ productos });
});

const clientesComprometidos = asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const clientes = await dashboardService.clientesComprometidos({
    propietarioId: req.user.propietarioId,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ clientes });
});

module.exports = { resumen, productosMasVendidos, clientesComprometidos };