// src/services/admin.service.js
const db = require('../config/db');
const { normalizarModulosEmpresa } = require('../config/modulos');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;

function errorHttp(mensaje, status) {
  return Object.assign(new Error(mensaje), { status });
}

// Texto opcional: recorta espacios y convierte '' en null.
function textoOpcional(valor) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return limpio === '' ? null : limpio;
}

// ---------- Documento del titular (CUIT / CUIL / DNI) ----------
// Es lo que identifica a una empresa: el nombre puede repetirse (dos "Sodería El Sol" en distintas
// ciudades), el documento no. Se guarda solo con dígitos en la columna `cuit`.

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
// Prefijos de CUIT/CUIL de personas humanas: sus dígitos 3 a 10 son el DNI.
const PREFIJOS_PERSONA = ['20', '23', '24', '27'];

function cuitValido(digitos) {
  const suma = PESOS_CUIT.reduce((acc, peso, i) => acc + peso * Number(digitos[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) return false;
  return verificador === Number(digitos[10]);
}

// Devuelve los dígitos normalizados o lanza 400 si el formato no es válido.
function normalizarDocumento(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) throw errorHttp('El CUIT, CUIL o DNI del titular es obligatorio', 400);
  if (digitos.length === 7 || digitos.length === 8) return digitos.padStart(8, '0');
  if (digitos.length === 11) {
    if (!cuitValido(digitos)) throw errorHttp('El CUIT/CUIL no es válido (revisá el dígito verificador)', 400);
    return digitos;
  }
  throw errorHttp('El documento debe ser un DNI (7 u 8 dígitos) o un CUIT/CUIL (11 dígitos)', 400);
}

// DNI contenido en el documento: el propio DNI, o el de un CUIT/CUIL de persona. null para CUIT de empresa.
function dniDe(documento) {
  if (documento.length === 8) return documento;
  if (PREFIJOS_PERSONA.includes(documento.slice(0, 2))) return documento.slice(2, 10);
  return null;
}

// Rechaza si el documento ya está en otra empresa, también cuando el mismo titular
// figura con su DNI en una y con su CUIT/CUIL en otra.
async function verificarDocumentoLibre(client, documento, excluirId = null) {
  const dni = dniDe(documento);
  const { rows } = await client.query(
    `SELECT nombre_negocio FROM propietarios
     WHERE ($3::text IS NULL OR id::text <> $3::text)
       AND (
         cuit = $1
         OR ($2::text IS NOT NULL AND (
               cuit = $2
               OR (length(cuit) = 11 AND left(cuit, 2) IN ('20','23','24','27') AND substr(cuit, 3, 8) = $2)
            ))
       )
     LIMIT 1`,
    [documento, dni, excluirId]
  );
  if (rows.length > 0) {
    throw errorHttp(`Ese titular ya está registrado en la empresa "${rows[0].nombre_negocio}"`, 409);
  }
}

function validarDatosEmpresa({ nombre_negocio, email_contacto, cuit }) {
  const nombre = textoOpcional(nombre_negocio);
  if (!nombre) throw errorHttp('El nombre del negocio es obligatorio', 400);
  if (nombre.length > 120) throw errorHttp('El nombre del negocio no puede superar los 120 caracteres', 400);

  const email = textoOpcional(email_contacto);
  if (email && !EMAIL_REGEX.test(email)) throw errorHttp('El email de contacto no es válido', 400);

  return { nombre, documento: normalizarDocumento(cuit) };
}

// El índice único de la base (migración 005) es la última barrera ante dos altas simultáneas.
function traducirDuplicado(err) {
  if (err.code === '23505' && String(err.constraint || '').includes('cuit')) {
    return errorHttp('Ese CUIT, CUIL o DNI ya está registrado en otra empresa', 409);
  }
  return err;
}

// ---------- Usuarios ----------

async function listarUsuarios() {
  const { rows } = await db.query(`
    SELECT
      u.id, u.email, p.nombre_completo, p.rol, p.activo,
      pr.id AS propietario_id, pr.nombre_negocio
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.propietarios pr ON pr.id = p.propietario_id
    ORDER BY pr.nombre_negocio NULLS FIRST, p.nombre_completo
  `);
  return rows;
}

async function resetearPassword(email, nuevaPassword) {
  const { rows } = await db.query(
    'SELECT id FROM auth.users WHERE email = $1',
    [email]
  );
  if (rows.length === 0) {
    throw errorHttp('No existe un usuario con ese email', 404);
  }

  await db.query('SELECT resetear_password($1, $2)', [email, nuevaPassword]);
}

// ---------- Empresas (propietarios) ----------

async function listarPropietarios() {
  const { rows } = await db.query(`
    SELECT pr.*,
      (SELECT count(*)::int FROM profiles p WHERE p.propietario_id = pr.id) AS cantidad_usuarios,
      (SELECT u.email
         FROM profiles p JOIN auth.users u ON u.id = p.id
        WHERE p.propietario_id = pr.id AND p.rol = 'admin'
        ORDER BY p.created_at
        LIMIT 1) AS email_admin
    FROM propietarios pr
    ORDER BY pr.nombre_negocio
  `);
  return rows;
}

async function obtenerPropietario(id) {
  const { rows } = await db.query(
    `SELECT pr.*,
       (SELECT count(*)::int FROM profiles p WHERE p.propietario_id = pr.id) AS cantidad_usuarios
     FROM propietarios pr WHERE pr.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Las columnas usa_produccion / usa_geolocalizacion quedan sincronizadas con `modulos` por compatibilidad;
// la fuente de verdad es `modulos` (migración 007).
const SET_MODULOS = `
  modulos = $MOD::text[],
  usa_produccion = 'produccion' = ANY($MOD::text[]),
  usa_geolocalizacion = 'geolocalizacion' = ANY($MOD::text[])`;

// Alta de empresa + su administrador inicial, todo o nada.
async function crearPropietario({ empresa, admin }) {
  const { nombre, documento } = validarDatosEmpresa(empresa);
  const modulos = normalizarModulosEmpresa(empresa.modulos ?? []);

  const adminEmail = textoOpcional(admin?.email)?.toLowerCase();
  const adminNombre = textoOpcional(admin?.nombreCompleto);
  const adminPassword = admin?.password ? String(admin.password) : '';

  if (!adminNombre) throw errorHttp('El nombre del administrador es obligatorio', 400);
  if (!adminEmail || !EMAIL_REGEX.test(adminEmail)) throw errorHttp('El email del administrador no es válido', 400);
  if (adminPassword.trim().length < PASSWORD_MIN) {
    throw errorHttp(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`, 400);
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await verificarDocumentoLibre(client, documento);

    const { rows: emailUsado } = await client.query(
      'SELECT 1 FROM auth.users WHERE lower(email) = $1',
      [adminEmail]
    );
    if (emailUsado.length > 0) throw errorHttp('Ya existe un usuario con ese email', 409);

    const { rows } = await client.query(
      `INSERT INTO propietarios
         (nombre_negocio, cuit, telefono, email_contacto, direccion, modulos, usa_produccion, usa_geolocalizacion, activo)
       VALUES ($1, $2, $3, $4, $5, $6::text[], 'produccion' = ANY($6::text[]), 'geolocalizacion' = ANY($6::text[]), true)
       RETURNING id`,
      [
        nombre,
        documento,
        textoOpcional(empresa.telefono),
        textoOpcional(empresa.email_contacto),
        textoOpcional(empresa.direccion),
        modulos,
      ]
    );
    const propietarioId = rows[0].id;

    // Misma función que usa "Mi equipo" para crear empleados, con rol admin.
    // La contraseña se normaliza igual que en el login (trim).
    await client.query(
      'SELECT crear_usuario_empleado($1, $2, $3, $4, $5)',
      [propietarioId, adminEmail, adminPassword.trim(), adminNombre, 'admin']
    );

    await client.query('COMMIT');
    return obtenerPropietario(propietarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw traducirDuplicado(err);
  } finally {
    client.release();
  }
}

// `modulos` es opcional: si no viene, los módulos contratados no se tocan.
async function actualizarPropietario(id, empresa) {
  const { nombre, documento } = validarDatosEmpresa(empresa);
  const modulos = empresa.modulos === undefined ? null : normalizarModulosEmpresa(empresa.modulos);

  const client = await db.getClient();
  try {
    await verificarDocumentoLibre(client, documento, id);

    const { rows } = await client.query(
      `UPDATE propietarios
       SET nombre_negocio = $1, cuit = $2, telefono = $3, email_contacto = $4, direccion = $5,
           modulos = COALESCE($7::text[], modulos),
           usa_produccion = CASE WHEN $7::text[] IS NULL THEN usa_produccion ELSE 'produccion' = ANY($7::text[]) END,
           usa_geolocalizacion = CASE WHEN $7::text[] IS NULL THEN usa_geolocalizacion ELSE 'geolocalizacion' = ANY($7::text[]) END
       WHERE id = $6
       RETURNING id`,
      [
        nombre,
        documento,
        textoOpcional(empresa.telefono),
        textoOpcional(empresa.email_contacto),
        textoOpcional(empresa.direccion),
        id,
        modulos,
      ]
    );
    if (rows.length === 0) throw errorHttp('Empresa no encontrada', 404);
  } catch (err) {
    throw traducirDuplicado(err);
  } finally {
    client.release();
  }

  return obtenerPropietario(id);
}

// Baja lógica: una empresa inactiva conserva todos sus datos, pero sus usuarios no pueden ingresar
// (ver auth.service). Reactivarla les devuelve el acceso.
async function actualizarEstadoPropietario(id, activo) {
  const { rows } = await db.query(
    'UPDATE propietarios SET activo = $1 WHERE id = $2 RETURNING id',
    [activo, id]
  );
  if (rows.length === 0) throw errorHttp('Empresa no encontrada', 404);
  return obtenerPropietario(id);
}

// Compatibilidad con el endpoint anterior (flags sueltos): se traduce a la lista de módulos.
async function actualizarFeatures(propietarioId, { usa_compras_stock, usa_produccion, usa_geolocalizacion }) {
  const { rows: actuales } = await db.query('SELECT modulos FROM propietarios WHERE id = $1', [propietarioId]);
  if (actuales.length === 0) throw errorHttp('Empresa no encontrada', 404);

  let modulos = actuales[0].modulos ?? [];
  const aplicar = (clave, valor) => {
    if (valor === true && !modulos.includes(clave)) modulos = [...modulos, clave];
    if (valor === false) modulos = modulos.filter((m) => m !== clave);
  };
  aplicar('produccion', usa_produccion);
  aplicar('geolocalizacion', usa_geolocalizacion);
  modulos = normalizarModulosEmpresa(modulos);

  const { rows } = await db.query(
    `UPDATE propietarios
     SET usa_compras_stock = COALESCE($2, usa_compras_stock), ${SET_MODULOS.replaceAll('$MOD', '$1')}
     WHERE id = $3 RETURNING *`,
    [modulos, usa_compras_stock ?? null, propietarioId]
  );
  return rows[0];
}

module.exports = {
  listarUsuarios,
  resetearPassword,
  listarPropietarios,
  crearPropietario,
  actualizarPropietario,
  actualizarEstadoPropietario,
  actualizarFeatures,
};