// src/controllers/auth.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const { env } = require('../config/env');
const authService = require('../services/auth.service');

function opcionesCookie(expiresAt) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    ...(expiresAt ? { expires: new Date(expiresAt * 1000) } : {}),
  };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const { accessToken, expiresAt, user } = await authService.login(email, password);

  res.cookie(env.cookieName, accessToken, opcionesCookie(expiresAt));

  res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  // Mismos atributos que al setearla (sin esto, algunos navegadores no la reconocen para borrarla)
  res.clearCookie(env.cookieName, opcionesCookie());
  res.json({ ok: true });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, logout, me };