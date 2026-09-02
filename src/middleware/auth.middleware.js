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

  // El super_admin no pertenece a ningún propietario, es el único caso permitido sin uno
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

module.exports = { requireAuth, requireSuperAdmin, requireAdmin };