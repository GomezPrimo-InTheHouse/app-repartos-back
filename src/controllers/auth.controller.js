// src/controllers/auth.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const { env } = require('../config/env');
const authService = require('../services/auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const { accessToken, refreshToken, expiresAt, user } = await authService.login(email, password);

  res.cookie(env.cookieName, accessToken, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    expires: new Date(expiresAt * 1000),
  });

  res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.cookieName);
  res.json({ ok: true });
});

const me = asyncHandler(async (req, res) => {
  // req.user lo setea el middleware de auth
  res.json({ user: req.user });
});

module.exports = { login, logout, me };