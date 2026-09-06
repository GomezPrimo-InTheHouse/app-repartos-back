
// src/controllers/repartosListas.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/repartosListas.service');

const listar = asyncHandler(async (req, res) => {
  const { tipo, activa } = req.query;
  const listas = await service.listar({
    propietarioId: req.user.propietarioId,
    tipo,
    activa: activa === undefined ? undefined : activa === 'true',
  });
  res.json({ listas });
});

const obtener = asyncHandler(async (req, res) => {
  const lista = await service.obtenerPorId(req.user.propietarioId, req.params.id);
  if (!lista) {
    return res.status(404).json({ error: 'Lista no encontrada' });
  }
  res.json({ lista });
});

const crear = asyncHandler(async (req, res) => {
  const { nombre, tipo } = req.body;
  if (!nombre || !tipo) {
    return res.status(400).json({ error: 'nombre y tipo son requeridos' });
  }

  const lista = await service.crear({
    ...req.body,
    propietarioId: req.user.propietarioId,
    createdBy: req.user.id,
  });
  res.status(201).json({ lista });
});

const actualizar = asyncHandler(async (req, res) => {
  const lista = await service.actualizar(req.user.propietarioId, req.params.id, req.body);
  if (!lista) {
    return res.status(404).json({ error: 'Lista no encontrada' });
  }
  res.json({ lista });
});

const eliminar = asyncHandler(async (req, res) => {
  const resultado = await service.eliminar(req.user.propietarioId, req.params.id);
  if (!resultado) {
    return res.status(404).json({ error: 'Lista no encontrada' });
  }
  res.json({ ok: true });
});

const agregarItem = asyncHandler(async (req, res) => {
  const { cliente_id } = req.body;
  if (!cliente_id) {
    return res.status(400).json({ error: 'cliente_id es requerido' });
  }

  const id = await service.agregarItem(req.user.propietarioId, req.params.id, req.body);
  res.status(201).json({ id });
});

const editarItem = asyncHandler(async (req, res) => {
  const { productos } = req.body;
  if (!Array.isArray(productos)) {
    return res.status(400).json({ error: 'productos debe ser un array' });
  }

  await service.editarItemProductos(req.user.propietarioId, req.params.id, req.params.itemId, productos);
  res.json({ ok: true });
});

const eliminarItem = asyncHandler(async (req, res) => {
  const resultado = await service.eliminarItem(req.user.propietarioId, req.params.id, req.params.itemId);
  if (!resultado) {
    return res.status(404).json({ error: 'Item no encontrado' });
  }
  res.json({ ok: true });
});

module.exports = { listar, obtener, crear, actualizar, eliminar, agregarItem, editarItem, eliminarItem };