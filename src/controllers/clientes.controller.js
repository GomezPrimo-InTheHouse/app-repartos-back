// src/controllers/clientes.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const clientesService = require('../services/clientes.service');

const listar = asyncHandler(async (req, res) => {
  const { busqueda, activo } = req.query;
  const clientes = await clientesService.listar({
    busqueda,
    activo: activo === undefined ? undefined : activo === 'true',
  });
  res.json({ clientes });
});

const obtener = asyncHandler(async (req, res) => {
  const cliente = await clientesService.obtenerPorId(req.params.id);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  res.json({ cliente });
});

const crear = asyncHandler(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const cliente = await clientesService.crear({ ...req.body, createdBy: req.user.id });
  res.status(201).json({ cliente });
});

const actualizar = asyncHandler(async (req, res) => {
  const cliente = await clientesService.actualizar(req.params.id, req.body);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  res.json({ cliente });
});

const eliminar = asyncHandler(async (req, res) => {
  const resultado = await clientesService.eliminar(req.params.id);
  if (!resultado) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  res.json({ ok: true });
});

module.exports = { listar, obtener, crear, actualizar, eliminar };