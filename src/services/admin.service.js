// // // src/services/admin.service.js
// // const db = require('../config/db');

// // async function listarUsuarios() {
// //   const { rows } = await db.query(`
// //     SELECT
// //       u.id, u.email, p.nombre_completo, p.rol, p.activo,
// //       pr.id AS propietario_id, pr.nombre_negocio
// //     FROM auth.users u
// //     JOIN public.profiles p ON p.id = u.id
// //     LEFT JOIN public.propietarios pr ON pr.id = p.propietario_id
// //     ORDER BY pr.nombre_negocio NULLS FIRST, p.nombre_completo
// //   `);
// //   return rows;
// // }

// // async function resetearPassword(email, nuevaPassword) {
// //   const { rows } = await db.query(
// //     'SELECT id FROM auth.users WHERE email = $1',
// //     [email]
// //   );
// //   if (rows.length === 0) {
// //     throw Object.assign(new Error('No existe un usuario con ese email'), { status: 404 });
// //   }

// //   await db.query('SELECT resetear_password($1, $2)', [email, nuevaPassword]);
// // }

// // async function listarPropietarios() {
// //   const { rows } = await db.query('SELECT * FROM propietarios ORDER BY nombre_negocio');
// //   return rows;
// // }

// // module.exports = { listarUsuarios, resetearPassword, listarPropietarios };

// // src/services/admin.service.js
// const db = require('../config/db');

// async function listarUsuarios() {
//   const { rows } = await db.query(`
//     SELECT
//       u.id, u.email, p.nombre_completo, p.rol, p.activo,
//       pr.id AS propietario_id, pr.nombre_negocio
//     FROM auth.users u
//     JOIN public.profiles p ON p.id = u.id
//     LEFT JOIN public.propietarios pr ON pr.id = p.propietario_id
//     ORDER BY pr.nombre_negocio NULLS FIRST, p.nombre_completo
//   `);
//   return rows;
// }

// async function resetearPassword(email, nuevaPassword) {
//   const { rows } = await db.query(
//     'SELECT id FROM auth.users WHERE email = $1',
//     [email]
//   );
//   if (rows.length === 0) {
//     throw Object.assign(new Error('No existe un usuario con ese email'), { status: 404 });
//   }

//   await db.query('SELECT resetear_password($1, $2)', [email, nuevaPassword]);
// }

// async function listarPropietarios() {
//   const { rows } = await db.query('SELECT * FROM propietarios ORDER BY nombre_negocio');
//   return rows;
// }

// async function actualizarFeatures(propietarioId, { usa_compras_stock, usa_produccion }) {
//   const { rows } = await db.query(
//     `UPDATE propietarios
//      SET usa_compras_stock = COALESCE($1, usa_compras_stock),
//          usa_produccion = COALESCE($2, usa_produccion)
//      WHERE id = $3 RETURNING *`,
//     [usa_compras_stock ?? null, usa_produccion ?? null, propietarioId]
//   );
//   if (rows.length === 0) {
//     throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
//   }
//   return rows[0];
// }

// module.exports = { listarUsuarios, resetearPassword, listarPropietarios, actualizarFeatures };


// src/services/admin.service.js
const db = require('../config/db');

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

function validarDatosEmpresa({ nombre_negocio, email_contacto }) {
  const nombre = textoOpcional(nombre_negocio);
  if (!nombre) throw errorHttp('El nombre del negocio es obligatorio', 400);
  if (nombre.length > 120) throw errorHttp('El nombre del negocio no puede superar los 120 caracteres', 400);

  const email = textoOpcional(email_contacto);
  if (email && !EMAIL_REGEX.test(email)) throw errorHttp('El email de contacto no es válido', 400);

  return nombre;
}

async function verificarNombreLibre(client, nombre, excluirId = null) {
  const { rows } = await client.query(
    `SELECT 1 FROM propietarios
     WHERE lower(trim(nombre_negocio)) = lower($1)
       AND ($2::text IS NULL OR id::text <> $2::text)`,
    [nombre, excluirId]
  );
  if (rows.length > 0) throw errorHttp('Ya existe una empresa con ese nombre', 409);
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

// Alta de empresa + su administrador inicial, todo o nada.
async function crearPropietario({ empresa, admin }) {
  const nombre = validarDatosEmpresa(empresa);

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

    await verificarNombreLibre(client, nombre);

    const { rows: emailUsado } = await client.query(
      'SELECT 1 FROM auth.users WHERE lower(email) = $1',
      [adminEmail]
    );
    if (emailUsado.length > 0) throw errorHttp('Ya existe un usuario con ese email', 409);

    const { rows } = await client.query(
      `INSERT INTO propietarios (nombre_negocio, cuit, telefono, email_contacto, direccion, usa_produccion, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [
        nombre,
        textoOpcional(empresa.cuit),
        textoOpcional(empresa.telefono),
        textoOpcional(empresa.email_contacto),
        textoOpcional(empresa.direccion),
        empresa.usa_produccion === true,
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
    throw err;
  } finally {
    client.release();
  }
}

async function actualizarPropietario(id, empresa) {
  const nombre = validarDatosEmpresa(empresa);

  const client = await db.getClient();
  try {
    await verificarNombreLibre(client, nombre, id);

    const { rows } = await client.query(
      `UPDATE propietarios
       SET nombre_negocio = $1, cuit = $2, telefono = $3, email_contacto = $4, direccion = $5
       WHERE id = $6
       RETURNING id`,
      [
        nombre,
        textoOpcional(empresa.cuit),
        textoOpcional(empresa.telefono),
        textoOpcional(empresa.email_contacto),
        textoOpcional(empresa.direccion),
        id,
      ]
    );
    if (rows.length === 0) throw errorHttp('Empresa no encontrada', 404);
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

async function actualizarFeatures(propietarioId, { usa_compras_stock, usa_produccion }) {
  const { rows } = await db.query(
    `UPDATE propietarios
     SET usa_compras_stock = COALESCE($1, usa_compras_stock),
         usa_produccion = COALESCE($2, usa_produccion)
     WHERE id = $3 RETURNING *`,
    [usa_compras_stock ?? null, usa_produccion ?? null, propietarioId]
  );
  if (rows.length === 0) {
    throw errorHttp('Empresa no encontrada', 404);
  }
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