// src/services/comprasStock.service.js
const db = require('../config/db');

async function registrar({ producto_id, cantidad, costo_unitario, proveedor, fecha, notas, createdBy }) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { rows: compraRows } = await client.query(
      `INSERT INTO compras_stock (producto_id, cantidad, costo_unitario, proveedor, fecha, notas, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7)
       RETURNING *`,
      [producto_id, cantidad, costo_unitario, proveedor, fecha, notas, createdBy]
    );

    // Sube el stock y actualiza el costo del producto al último costo de compra
    const { rows: productoRows } = await client.query(
      `UPDATE productos
       SET stock_actual = stock_actual + $1,
           costo_unitario = $2
       WHERE id = $3
       RETURNING *`,
      [cantidad, costo_unitario, producto_id]
    );

    if (productoRows.length === 0) {
      throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
    }

    await client.query('COMMIT');

    return { compra: compraRows[0], producto: productoRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listar({ producto_id, desde, hasta }) {
  const condiciones = [];
  const valores = [];

  if (producto_id) {
    valores.push(producto_id);
    condiciones.push(`cs.producto_id = $${valores.length}`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`cs.fecha >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`cs.fecha <= $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT cs.*, p.nombre AS producto_nombre
     FROM compras_stock cs
     JOIN productos p ON p.id = cs.producto_id
     ${where}
     ORDER BY cs.fecha DESC, cs.created_at DESC`,
    valores
  );

  return rows;
}

module.exports = { registrar, listar };