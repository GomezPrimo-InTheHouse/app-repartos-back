// src/services/auth.service.js
const { supabase } = require('../config/supabase');
const db = require('../config/db');
const { MODULOS_CONTRATABLES, modulosLegacy } = require('../config/modulos');

// La empresa se lee como JSON (to_jsonb): así el login no se rompe si el código llega a producción
// antes que las migraciones 006/007 (columnas que todavía no existen quedan undefined).
async function obtenerPerfil(userId) {
  const { rows } = await db.query(
    `SELECT p.id, p.nombre_completo, p.rol, p.propietario_id, p.activo, p.permisos,
            to_jsonb(pr) AS empresa
     FROM profiles p
     LEFT JOIN propietarios pr ON pr.id = p.propietario_id
     WHERE p.id = $1`,
    [userId]
  );
  const perfil = rows[0];
  if (!perfil) return null;

  const empresa = perfil.empresa ?? {};
  let modulosEmpresa = [];
  if (perfil.empresa) {
    modulosEmpresa = Array.isArray(empresa.modulos)
      ? MODULOS_CONTRATABLES.filter((m) => empresa.modulos.includes(m)) // ignora valores desconocidos, nunca rompe el login
      : modulosLegacy(empresa);
  }

  return {
    ...perfil,
    empresa: undefined,
    propietario_activo: empresa.activo !== false,
    usa_compras_stock: Boolean(empresa.usa_compras_stock),
    modulos_empresa: modulosEmpresa,
  };
}

function datosSesion(perfil) {
  return {
    nombreCompleto: perfil.nombre_completo,
    rol: perfil.rol,
    propietarioId: perfil.propietario_id,
    permisos: perfil.permisos || [],
    // Módulos contratados por la empresa (los de base no se listan: siempre están)
    modulosEmpresa: perfil.modulos_empresa,
    usaComprasStock: perfil.usa_compras_stock,
    usaProduccion: perfil.modulos_empresa.includes('produccion'),
    usaGeolocalizacion: perfil.modulos_empresa.includes('geolocalizacion'),
  };
}

// Un usuario puede operar si su perfil está activo y, salvo el super admin, si su empresa también lo está.
function validarAcceso(perfil) {
  if (!perfil || !perfil.activo) {
    const err = new Error('Usuario inactivo o sin perfil asociado');
    err.status = 403;
    throw err;
  }
  if (perfil.rol !== 'super_admin' && perfil.propietario_activo === false) {
    const err = new Error('La empresa está desactivada. Contactá al administrador del sistema.');
    err.status = 403;
    throw err;
  }
  // Sin el módulo "Mi equipo" la empresa usa el sistema solo con sus administradores.
  if (perfil.rol === 'vendedor' && !perfil.modulos_empresa.includes('equipo')) {
    const err = new Error('Tu empresa no tiene habilitado el acceso de empleados. Consultá con tu administrador.');
    err.status = 403;
    throw err;
  }
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
  validarAcceso(perfil);

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      ...datosSesion(perfil),
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
  validarAcceso(perfil);

  return {
    id: data.user.id,
    email: data.user.email,
    ...datosSesion(perfil),
  };
}

module.exports = { login, verifyToken, obtenerPerfil };