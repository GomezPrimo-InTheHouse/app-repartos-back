// src/controllers/empleados.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const empleadosService = require('../services/empleados.service');

const listar = asyncHandler(async (req, res) => {
  const empleados = await empleadosService.listar(req.user.propietarioId);
  res.json({ empleados });
});

const crear = asyncHandler(async (req, res) => {
  const { email, password, nombreCompleto, rol } = req.body;

  if (!email || !password || !nombreCompleto) {
    return res.status(400).json({ error: 'email, password y nombreCompleto son requeridos' });
  }

  const empleado = await empleadosService.crear({
    propietarioId: req.user.propietarioId,
    email,
    password,
    nombreCompleto,
    rol,
  });
  res.status(201).json({ empleado });
});

const actualizarEstado = asyncHandler(async (req, res) => {
  const { activo } = req.body;

  if (activo === undefined) {
    return res.status(400).json({ error: 'activo es requerido' });
  }

  const resultado = await empleadosService.actualizarEstado(req.user.propietarioId, req.params.id, activo);
  if (!resultado) {
    return res.status(404).json({ error: 'Empleado no encontrado' });
  }
  res.json({ empleado: resultado });
});

const resetearPassword = asyncHandler(async (req, res) => {
  const { nuevaPassword } = req.body;

  if (!nuevaPassword) {
    return res.status(400).json({ error: 'nuevaPassword es requerida' });
  }

  await empleadosService.resetearPassword(req.user.propietarioId, req.params.id, nuevaPassword);
  res.json({ ok: true });
});

module.exports = { listar, crear, actualizarEstado, resetearPassword };