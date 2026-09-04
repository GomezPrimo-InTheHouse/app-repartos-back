// // src/services/productos.service.js
// const db = require('../config/db');

// async function listar({ propietarioId, busqueda, activo, stockBajo }) {
//   const condiciones = ['propietario_id = $1'];
//   const valores = [propietarioId];

//   if (busqueda) {
//     valores.push(`%${busqueda}%`);
//     condiciones.push(`nombre ILIKE $${valores.length}`);
//   }

//   if (activo !== undefined) {
//     valores.push(activo);
//     condiciones.push(`activo = $${valores.length}`);
//   }

//   if (stockBajo) {
//     condiciones.push(`stock_actual <= stock_minimo`);
//   }

//   const { rows } = await db.query(
//     `SELECT id, nombre, categoria, costo_unitario, precio_venta, stock_actual, stock_minimo, imagen_url, activo, created_at
//      FROM productos
//      WHERE ${condiciones.join(' AND ')}
//      ORDER BY nombre ASC`,
//     valores
//   );

//   return rows;
// }

// async function obtenerPorId(propietarioId, id) {
//   const { rows } = await db.query(
//     'SELECT * FROM productos WHERE id = $1 AND propietario_id = $2',
//     [id, propietarioId]
//   );
//   return rows[0] || null;
// }

// async function crear({ propietarioId, nombre, categoria, costo_unitario, precio_venta, stock_minimo, imagen_url, createdBy }) {
//   const { rows } = await db.query(
//     `INSERT INTO productos (propietario_id, nombre, categoria, costo_unitario, precio_venta, stock_minimo, imagen_url, created_by)
//      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//      RETURNING *`,
//     [propietarioId, nombre, categoria, costo_unitario ?? 0, precio_venta ?? 0, stock_minimo ?? 0, imagen_url, createdBy]
//   );
//   return rows[0];
// }

// async function actualizar(propietarioId, id, campos) {
//   const permitidos = ['nombre', 'categoria', 'costo_unitario', 'precio_venta', 'stock_minimo', 'imagen_url', 'activo'];
//   const sets = [];
//   const valores = [];

//   for (const campo of permitidos) {
//     if (campos[campo] !== undefined) {
//       valores.push(campos[campo]);
//       sets.push(`${campo} = $${valores.length}`);
//     }
//   }

//   if (sets.length === 0) return obtenerPorId(propietarioId, id);

//   valores.push(id, propietarioId);
//   const { rows } = await db.query(
//     `UPDATE productos SET ${sets.join(', ')}
//      WHERE id = $${valores.length - 1} AND propietario_id = $${valores.length}
//      RETURNING *`,
//     valores
//   );
//   return rows[0] || null;
// }

// async function eliminar(propietarioId, id) {
//   const { rows } = await db.query(
//     'UPDATE productos SET activo = false WHERE id = $1 AND propietario_id = $2 RETURNING id',
//     [id, propietarioId]
//   );
//   return rows[0] || null;
// }

// module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };


// src/services/productos.service.js
const db = require('../config/db');

async function listar({ propietarioId, busqueda, activo, stockBajo }) {
  const condiciones = ['propietario_id = $1'];
  const valores = [propietarioId];

  if (busqueda) {
    valores.push(`%${busqueda}%`);
    condiciones.push(`nombre ILIKE $${valores.length}`);
  }

  if (activo !== undefined) {
    valores.push(activo);
    condiciones.push(`activo = $${valores.length}`);
  }

  if (stockBajo) {
    condiciones.push(`stock_actual <= stock_minimo`);
  }

  const { rows } = await db.query(
    `SELECT id, nombre, categoria, costo_unitario, precio_venta, stock_actual, stock_minimo,
            imagen_url, maneja_envase, activo, created_at
     FROM productos
     WHERE ${condiciones.join(' AND ')}
     ORDER BY nombre ASC`,
    valores
  );

  return rows;
}

async function obtenerPorId(propietarioId, id) {
  const { rows } = await db.query(
    'SELECT * FROM productos WHERE id = $1 AND propietario_id = $2',
    [id, propietarioId]
  );
  return rows[0] || null;
}

async function crear({ propietarioId, nombre, categoria, costo_unitario, precio_venta, stock_minimo, imagen_url, maneja_envase, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO productos (propietario_id, nombre, categoria, costo_unitario, precio_venta, stock_minimo, imagen_url, maneja_envase, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [propietarioId, nombre, categoria, costo_unitario ?? 0, precio_venta ?? 0, stock_minimo ?? 0, imagen_url, maneja_envase ?? false, createdBy]
  );
  return rows[0];
}

async function actualizar(propietarioId, id, campos) {
  const permitidos = ['nombre', 'categoria', 'costo_unitario', 'precio_venta', 'stock_minimo', 'imagen_url', 'maneja_envase', 'activo'];
  const sets = [];
  const valores = [];

  for (const campo of permitidos) {
    if (campos[campo] !== undefined) {
      valores.push(campos[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  }

  if (sets.length === 0) return obtenerPorId(propietarioId, id);

  valores.push(id, propietarioId);
  const { rows } = await db.query(
    `UPDATE productos SET ${sets.join(', ')}
     WHERE id = $${valores.length - 1} AND propietario_id = $${valores.length}
     RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function eliminar(propietarioId, id) {
  const { rows } = await db.query(
    'UPDATE productos SET activo = false WHERE id = $1 AND propietario_id = $2 RETURNING id',
    [id, propietarioId]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };