// src/controllers/clientes.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const clientesService = require('../services/clientes.service');

const listar = asyncHandler(async (req, res) => {
  const { busqueda, activo, barrio, ordenarPor, orden, soloDeudores, saldoMinimo, limit, offset } = req.query;

  const resultado = await clientesService.listar({
    propietarioId: req.user.propietarioId,
    busqueda,
    activo: activo === undefined ? undefined : activo === 'true',
    barrio,
    ordenarPor,
    orden,
    soloDeudores: soloDeudores === 'true',
    saldoMinimo: saldoMinimo !== undefined ? Number(saldoMinimo) : undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
    offset: offset !== undefined ? Number(offset) : undefined,
  });

  res.json(resultado); // { clientes, total }
});

const obtener = asyncHandler(async (req, res) => {
  const cliente = await clientesService.obtenerPorId(req.user.propietarioId, req.params.id);
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

  const cliente = await clientesService.crear({
    ...req.body,
    propietarioId: req.user.propietarioId,
    createdBy: req.user.id,
  });
  res.status(201).json({ cliente });
});

const actualizar = asyncHandler(async (req, res) => {
  const cliente = await clientesService.actualizar(req.user.propietarioId, req.params.id, req.body);
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  res.json({ cliente });
});

const eliminar = asyncHandler(async (req, res) => {
  const resultado = await clientesService.eliminar(req.user.propietarioId, req.params.id);
  if (!resultado) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  res.json({ ok: true });
});

module.exports = { listar, obtener, crear, actualizar, eliminar };