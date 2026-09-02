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

  if (!user.propietarioId) {
    return res.status(403).json({ error: 'Usuario sin negocio asignado' });
  }

  req.user = user;
  next();
});

module.exports = { requireAuth };