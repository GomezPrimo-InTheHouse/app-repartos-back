// src/services/auth.service.js
const { supabase } = require('../config/supabase');
const db = require('../config/db');

async function obtenerPerfil(userId) {
  const { rows } = await db.query(
    'SELECT id, nombre_completo, rol, propietario_id, activo FROM profiles WHERE id = $1',
    [userId]
  );
  return rows[0] || null;
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  const perfil = await obtenerPerfil(data.user.id);

  if (!perfil || !perfil.activo) {
    const err = new Error('Usuario inactivo o sin perfil asociado');
    err.status = 403;
    throw err;
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      nombreCompleto: perfil.nombre_completo,
      rol: perfil.rol,
      propietarioId: perfil.propietario_id,
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

  const perfil = await obtenerPerfil(data.user.id);

  if (!perfil || !perfil.activo) {
    const err = new Error('Usuario inactivo o sin perfil asociado');
    err.status = 403;
    throw err;
  }

  return {
    id: data.user.id,
    email: data.user.email,
    nombreCompleto: perfil.nombre_completo,
    rol: perfil.rol,
    propietarioId: perfil.propietario_id,
  };
}

module.exports = { login, verifyToken, obtenerPerfil };