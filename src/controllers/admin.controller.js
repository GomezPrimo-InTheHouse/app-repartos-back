// src/controllers/admin.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const adminService = require('../services/admin.service');

const listarUsuarios = asyncHandler(async (req, res) => {
  const usuarios = await adminService.listarUsuarios();
  res.json({ usuarios });
});

const resetearPassword = asyncHandler(async (req, res) => {
  const { email, nuevaPassword } = req.body;
  if (!email || !nuevaPassword) {
    return res.status(400).json({ error: 'email y nuevaPassword son requeridos' });
  }
  await adminService.resetearPassword(email, nuevaPassword);
  res.json({ ok: true });
});

const listarPropietarios = asyncHandler(async (req, res) => {
  const propietarios = await adminService.listarPropietarios();
  res.json({ propietarios });
});

module.exports = { listarUsuarios, resetearPassword, listarPropietarios };