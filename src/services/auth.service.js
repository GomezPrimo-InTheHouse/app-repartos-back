// // src/services/auth.service.js
// const { supabase } = require('../config/supabase');
// const db = require('../config/db');

// async function obtenerPerfil(userId) {
//   const { rows } = await db.query(
//     'SELECT id, nombre_completo, rol, propietario_id, activo, permisos FROM profiles WHERE id = $1',
//     [userId]
//   );
//   return rows[0] || null;
// }

// function normalizarEmail(email) {
//   return String(email).trim().toLowerCase();
// }

// function normalizarPassword(password) {
//   return String(password).trim();
// }

// async function login(email, password) {
//   const { data, error } = await supabase.auth.signInWithPassword({
//     email: normalizarEmail(email),
//     password: normalizarPassword(password),
//   });

//   if (error) {
//     const err = new Error('Credenciales inválidas');
//     err.status = 401;
//     throw err;
//   }

//   const perfil = await obtenerPerfil(data.user.id);

//   if (!perfil || !perfil.activo) {
//     const err = new Error('Usuario inactivo o sin perfil asociado');
//     err.status = 403;
//     throw err;
//   }

//   return {
//     accessToken: data.session.access_token,
//     refreshToken: data.session.refresh_token,
//     expiresAt: data.session.expires_at,
//     user: {
//       id: data.user.id,
//       email: data.user.email,
//       nombreCompleto: perfil.nombre_completo,
//       rol: perfil.rol,
//       propietarioId: perfil.propietario_id,
//       permisos: perfil.permisos || [],
//     },
//   };
// }

// async function verifyToken(accessToken) {
//   const { data, error } = await supabase.auth.getUser(accessToken);

//   if (error || !data?.user) {
//     const err = new Error('Sesión inválida o expirada');
//     err.status = 401;
//     throw err;
//   }

//   const perfil = await obtenerPerfil(data.user.id);

//   if (!perfil || !perfil.activo) {
//     const err = new Error('Usuario inactivo o sin perfil asociado');
//     err.status = 403;
//     throw err;
//   }

//   return {
//     id: data.user.id,
//     email: data.user.email,
//     nombreCompleto: perfil.nombre_completo,
//     rol: perfil.rol,
//     propietarioId: perfil.propietario_id,
//     permisos: perfil.permisos || [],
//   };
// }

// module.exports = { login, verifyToken, obtenerPerfil };

// src/services/auth.service.js
const { supabase } = require('../config/supabase');
const db = require('../config/db');

async function obtenerPerfil(userId) {
  const { rows } = await db.query(
    `SELECT p.id, p.nombre_completo, p.rol, p.propietario_id, p.activo, p.permisos,
            COALESCE(pr.usa_compras_stock, false) AS usa_compras_stock,
            COALESCE(pr.usa_produccion, false) AS usa_produccion
     FROM profiles p
     LEFT JOIN propietarios pr ON pr.id = p.propietario_id
     WHERE p.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function normalizarEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizarPassword(password) {
  return String(password).trim();
}

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizarEmail(email),
    password: normalizarPassword(password),
  });

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
      permisos: perfil.permisos || [],
      usaComprasStock: perfil.usa_compras_stock,
      usaProduccion: perfil.usa_produccion,
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
    permisos: perfil.permisos || [],
    usaComprasStock: perfil.usa_compras_stock,
      usaProduccion: perfil.usa_produccion,
  };
}

module.exports = { login, verifyToken, obtenerPerfil };