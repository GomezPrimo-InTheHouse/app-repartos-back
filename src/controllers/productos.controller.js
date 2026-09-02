// src/controllers/productos.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const productosService = require('../services/productos.service');

const listar = asyncHandler(async (req, res) => {
  const { busqueda, activo, stockBajo } = req.query;
  const productos = await productosService.listar({
    propietarioId: req.user.propietarioId,
    busqueda,
    activo: activo === undefined ? undefined : activo === 'true',
    stockBajo: stockBajo === 'true',
  });
  res.json({ productos });
});

const obtener = asyncHandler(async (req, res) => {
  const producto = await productosService.obtenerPorId(req.user.propietarioId, req.params.id);
  if (!producto) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  res.json({ producto });
});

const crear = asyncHandler(async (req, res) => {
  const { nombre, precio_venta } = req.body;
  if (!nombre || precio_venta === undefined) {
    return res.status(400).json({ error: 'nombre y precio_venta son requeridos' });
  }

  const producto = await productosService.crear({
    ...req.body,
    propietarioId: req.user.propietarioId,
    createdBy: req.user.id,
  });
  res.status(201).json({ producto });
});

const actualizar = asyncHandler(async (req, res) => {
  const producto = await productosService.actualizar(req.user.propietarioId, req.params.id, req.body);
  if (!producto) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  res.json({ producto });
});

const eliminar = asyncHandler(async (req, res) => {
  const resultado = await productosService.eliminar(req.user.propietarioId, req.params.id);
  if (!resultado) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  res.json({ ok: true });
});

module.exports = { listar, obtener, crear, actualizar, eliminar };