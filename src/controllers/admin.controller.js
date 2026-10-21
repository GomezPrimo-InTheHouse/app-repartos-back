// // // src/controllers/admin.controller.js
// // const { asyncHandler } = require('../utils/asyncHandler');
// // const adminService = require('../services/admin.service');

// // const listarUsuarios = asyncHandler(async (req, res) => {
// //   const usuarios = await adminService.listarUsuarios();
// //   res.json({ usuarios });
// // });

// // const resetearPassword = asyncHandler(async (req, res) => {
// //   const { email, nuevaPassword } = req.body;
// //   if (!email || !nuevaPassword) {
// //     return res.status(400).json({ error: 'email y nuevaPassword son requeridos' });
// //   }
// //   await adminService.resetearPassword(email, nuevaPassword);
// //   res.json({ ok: true });
// // });

// // const listarPropietarios = asyncHandler(async (req, res) => {
// //   const propietarios = await adminService.listarPropietarios();
// //   res.json({ propietarios });
// // });

// // module.exports = { listarUsuarios, resetearPassword, listarPropietarios };

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

// const actualizarFeatures = asyncHandler(async (req, res) => {
//   const { usa_compras_stock, usa_produccion } = req.body;
//   const valido = (v) => v === undefined || typeof v === 'boolean';
//   if (!valido(usa_compras_stock) || !valido(usa_produccion) || (usa_compras_stock === undefined && usa_produccion === undefined)) {
//     return res.status(400).json({ error: 'Enviá usa_compras_stock y/o usa_produccion (boolean)' });
//   }
//   const propietario = await adminService.actualizarFeatures(req.params.id, { usa_compras_stock, usa_produccion });
//   res.json({ propietario });
// });

// module.exports = { listarUsuarios, resetearPassword, listarPropietarios, actualizarFeatures };

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

// Body: { empresa: { nombre_negocio, cuit?, telefono?, email_contacto?, direccion?, usa_produccion? },
//         admin: { nombreCompleto, email, password } }
const crearPropietario = asyncHandler(async (req, res) => {
  const { empresa, admin } = req.body ?? {};
  if (!empresa || !admin) {
    return res.status(400).json({ error: 'Se requieren los datos de la empresa y de su administrador' });
  }
  const propietario = await adminService.crearPropietario({ empresa, admin });
  res.status(201).json({ propietario });
});

// Body: { nombre_negocio, cuit?, telefono?, email_contacto?, direccion? }
const actualizarPropietario = asyncHandler(async (req, res) => {
  const propietario = await adminService.actualizarPropietario(req.params.id, req.body ?? {});
  res.json({ propietario });
});

// Body: { activo: boolean }
const actualizarEstadoPropietario = asyncHandler(async (req, res) => {
  const { activo } = req.body ?? {};
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'activo (boolean) es requerido' });
  }
  const propietario = await adminService.actualizarEstadoPropietario(req.params.id, activo);
  res.json({ propietario });
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

module.exports = {
  listarUsuarios,
  resetearPassword,
  listarPropietarios,
  crearPropietario,
  actualizarPropietario,
  actualizarEstadoPropietario,
  actualizarFeatures,
};