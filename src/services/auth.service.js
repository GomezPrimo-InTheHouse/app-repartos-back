// src/services/auth.service.js
const { supabase } = require('../config/supabase');

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}

async function verifyToken(accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    const err = new Error('Sesión inválida o expirada');
    err.status = 401;
    throw err;
  }

  return data.user;
}

module.exports = { login, verifyToken };