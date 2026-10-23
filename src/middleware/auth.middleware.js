// src/middleware/auth.middleware.js
const { env } = require('../config/env');
const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { empresaTieneModulo, etiquetaModulo } = require('../config/modulos');

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

function moduloNoContratado(res, clave) {
  return res.status(403).json({ error: `Tu empresa no tiene contratado el módulo "${etiquetaModulo(clave)}"` });
}

// Dos controles: 1) la empresa tiene el módulo contratado (los de base siempre);
// 2) admin y super_admin pasan; vendedor solo si tiene el módulo en su array de permisos.
function requireModulo(nombreModulo) {
  return (req, res, next) => {
    const { rol, permisos } = req.user || {};

    if (rol !== 'super_admin' && !empresaTieneModulo(req.user, nombreModulo)) {
      return moduloNoContratado(res, nombreModulo);
    }

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

// Pasa si el usuario tiene al menos uno de los módulos, contando solo los que su empresa tiene contratados.
function requireAlgunModulo(modulos) {
  return (req, res, next) => {
    const { rol, permisos } = req.user || {};
    if (rol === 'super_admin') return next();
    const contratados = modulos.filter((m) => empresaTieneModulo(req.user, m));
    if (contratados.length === 0) return moduloNoContratado(res, modulos[0]);
    if (rol === 'admin') return next();
    if (Array.isArray(permisos) && contratados.some((m) => permisos.includes(m))) return next();
    return res.status(403).json({ error: 'No tenés acceso a esta función' });
  };
}

// Solo controla que la empresa tenga el módulo contratado (para rutas sin permiso por vendedor, ej. Mi equipo).
function requireModuloEmpresa(clave) {
  return (req, res, next) => {
    if (req.user?.rol === 'super_admin' || empresaTieneModulo(req.user, clave)) return next();
    return moduloNoContratado(res, clave);
  };
}

// Atajos para módulos enteros (las rutas ya usan requireModulo, que también controla la empresa).
const requireProduccionActivo = requireModuloEmpresa('produccion');
const requireGeolocalizacionActivo = requireModuloEmpresa('geolocalizacion');

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireAdmin,
  requireModulo,
  requireAlgunModulo,
  requireModuloEmpresa,
  requireComprasActivo,
  requireProduccionActivo,
  requireGeolocalizacionActivo,
};