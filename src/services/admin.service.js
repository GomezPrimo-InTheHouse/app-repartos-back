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

// module.exports = { listarUsuarios, resetearPassword, listarPropietarios };

// src/services/admin.service.js
const db = require('../config/db');

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
    throw Object.assign(new Error('No existe un usuario con ese email'), { status: 404 });
  }

  await db.query('SELECT resetear_password($1, $2)', [email, nuevaPassword]);
}

async function listarPropietarios() {
  const { rows } = await db.query('SELECT * FROM propietarios ORDER BY nombre_negocio');
  return rows;
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
    throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  }
  return rows[0];
}

module.exports = { listarUsuarios, resetearPassword, listarPropietarios, actualizarFeatures };