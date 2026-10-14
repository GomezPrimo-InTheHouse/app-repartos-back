// // src/controllers/admin.controller.js
// const { asyncHandler } = require('../utils/asyncHandler');
// const adminService = require('../services/admin.service');

// const listarUsuarios = asyncHandler(async (req, res) => {
//   const usuarios = await adminService.listarUsuarios();
//   res.json({ usuarios });
// });

// const resetearPassword = asyncHandler(async (req, res) => {
//   const { email, nuevaPassword } = req.body;
//   if (!email || !nuevaPassword) {
//     return res.status(400).json({ error: 'email y nuevaPassword son requeridos' });
//   }
//   await adminService.resetearPassword(email, nuevaPassword);
//   res.json({ ok: true });
// });

// const listarPropietarios = asyncHandler(async (req, res) => {
//   const propietarios = await adminService.listarPropietarios();
//   res.json({ propietarios });
// });

// module.exports = { listarUsuarios, resetearPassword, listarPropietarios };

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

const actualizarFeatures = asyncHandler(async (req, res) => {
  const { usa_compras_stock, usa_produccion } = req.body;
  const valido = (v) => v === undefined || typeof v === 'boolean';
  if (!valido(usa_compras_stock) || !valido(usa_produccion) || (usa_compras_stock === undefined && usa_produccion === undefined)) {
    return res.status(400).json({ error: 'Enviá usa_compras_stock y/o usa_produccion (boolean)' });
  }
  const propietario = await adminService.actualizarFeatures(req.params.id, { usa_compras_stock, usa_produccion });
  res.json({ propietario });
});

module.exports = { listarUsuarios, resetearPassword, listarPropietarios, actualizarFeatures };