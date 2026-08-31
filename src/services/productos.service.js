// src/services/productos.service.js
const db = require('../config/db');

async function listar({ busqueda, activo, stockBajo }) {
  const condiciones = [];
  const valores = [];

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

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT id, nombre, categoria, costo_unitario, precio_venta, stock_actual, stock_minimo, imagen_url, activo, created_at
     FROM productos
     ${where}
     ORDER BY nombre ASC`,
    valores
  );

  return rows;
}

async function obtenerPorId(id) {
  const { rows } = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function crear({ nombre, categoria, costo_unitario, precio_venta, stock_minimo, imagen_url, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO productos (nombre, categoria, costo_unitario, precio_venta, stock_minimo, imagen_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [nombre, categoria, costo_unitario ?? 0, precio_venta ?? 0, stock_minimo ?? 0, imagen_url, createdBy]
  );
  return rows[0];
}

async function actualizar(id, campos) {
  // Nota: stock_actual NO se actualiza acá directamente.
  // Sube por compras_stock y baja por despachos, para mantener consistencia.
  const permitidos = ['nombre', 'categoria', 'costo_unitario', 'precio_venta', 'stock_minimo', 'imagen_url', 'activo'];
  const sets = [];
  const valores = [];

  for (const campo of permitidos) {
    if (campos[campo] !== undefined) {
      valores.push(campos[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  }

  if (sets.length === 0) return obtenerPorId(id);

  valores.push(id);
  const { rows } = await db.query(
    `UPDATE productos SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function eliminar(id) {
  const { rows } = await db.query(
    'UPDATE productos SET activo = false WHERE id = $1 RETURNING id',
    [id]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };