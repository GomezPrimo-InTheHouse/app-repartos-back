// // src/middleware/auth.middleware.js
// const { env } = require('../config/env');
// const authService = require('../services/auth.service');
// const { asyncHandler } = require('../utils/asyncHandler');

// const requireAuth = asyncHandler(async (req, res, next) => {
//   const token = req.cookies?.[env.cookieName];

//   if (!token) {
//     return res.status(401).json({ error: 'No autenticado' });
//   }

//   const user = await authService.verifyToken(token);

//   if (user.rol !== 'super_admin' && !user.propietarioId) {
//     return res.status(403).json({ error: 'Usuario sin negocio asignado' });
//   }

//   req.user = user;
//   next();
// });

// function requireSuperAdmin(req, res, next) {
//   if (req.user?.rol !== 'super_admin') {
//     return res.status(403).json({ error: 'Requiere permisos de super administrador' });
//   }
//   next();
// }

// function requireAdmin(req, res, next) {
//   if (req.user?.rol !== 'admin') {
//     return res.status(403).json({ error: 'Requiere permisos de administrador' });
//   }
//   next();
// }

// // admin y super_admin siempre pasan. vendedor solo si tiene el módulo en su array de permisos.
// function requireModulo(nombreModulo) {
//   return (req, res, next) => {
//     const { rol, permisos } = req.user || {};

//     if (rol === 'admin' || rol === 'super_admin') {
//       return next();
//     }

//     if (Array.isArray(permisos) && permisos.includes(nombreModulo)) {
//       return next();
//     }

//     return res.status(403).json({ error: `No tenés acceso al módulo "${nombreModulo}"` });
//   };
// }

// module.exports = { requireAuth, requireSuperAdmin, requireAdmin, requireModulo };

// src/middleware/auth.middleware.js
const { env } = require('../config/env');
const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[env.cookieName];

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const user = await authService.verifyToken(token);

  if (user.rol !== 'super_admin' && !user.propietarioId) {
    return res.status(403).json({ error: 'Usuario sin negocio asignado' });
  }

  req.user = user;
  next();
});

function requireSuperAdmin(req, res, next) {
  if (req.user?.rol !== 'super_admin') {
    return res.status(403).json({ error: 'Requiere permisos de super administrador' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Requiere permisos de administrador' });
  }
  next();
}

// admin y super_admin siempre pasan. vendedor solo si tiene el módulo en su array de permisos.
function requireModulo(nombreModulo) {
  return (req, res, next) => {
    const { rol, permisos } = req.user || {};

    if (rol === 'admin' || rol === 'super_admin') {
      return next();
    }

    if (Array.isArray(permisos) && permisos.includes(nombreModulo)) {
      return next();
    }

    return res.status(403).json({ error: `No tenés acceso al módulo "${nombreModulo}"` });
  };
}

// El módulo Compras / control de stock solo existe para empresas con el flag activo.
function requireComprasActivo(req, res, next) {
  if (!req.user?.usaComprasStock) {
    return res.status(403).json({ error: 'El módulo de compras no está habilitado para esta empresa' });
  }
  next();
}

// El módulo Producción (y el control de stock en despachos) solo existe con el flag activo.
function requireProduccionActivo(req, res, next) {
  if (!req.user?.usaProduccion) {
    return res.status(403).json({ error: 'El módulo de producción no está habilitado para esta empresa' });
  }
  next();
}

module.exports = { requireAuth, requireSuperAdmin, requireAdmin, requireModulo, requireComprasActivo, requireProduccionActivo };