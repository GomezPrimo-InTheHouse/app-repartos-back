// src/services/comprasStock.service.js
const db = require('../config/db');

async function registrar({ propietarioId, producto_id, cantidad, costo_unitario, proveedor, fecha, notas, createdBy }) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Verifica que el producto pertenezca a este propietario antes de tocar nada
    const { rows: productoCheck } = await client.query(
      'SELECT id FROM productos WHERE id = $1 AND propietario_id = $2 FOR UPDATE',
      [producto_id, propietarioId]
    );
    if (productoCheck.length === 0) {
      throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
    }

    const { rows: compraRows } = await client.query(
      `INSERT INTO compras_stock (propietario_id, producto_id, cantidad, costo_unitario, proveedor, fecha, notas, created_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8)
       RETURNING *`,
      [propietarioId, producto_id, cantidad, costo_unitario, proveedor, fecha, notas, createdBy]
    );

    const { rows: productoRows } = await client.query(
      `UPDATE productos
       SET stock_actual = stock_actual + $1,
           costo_unitario = $2
       WHERE id = $3 AND propietario_id = $4
       RETURNING *`,
      [cantidad, costo_unitario, producto_id, propietarioId]
    );

    await client.query('COMMIT');

    return { compra: compraRows[0], producto: productoRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listar({ propietarioId, producto_id, desde, hasta }) {
  const condiciones = ['cs.propietario_id = $1'];
  const valores = [propietarioId];

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

  const { rows } = await db.query(
    `SELECT cs.*, p.nombre AS producto_nombre
     FROM compras_stock cs
     JOIN productos p ON p.id = cs.producto_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY cs.fecha DESC, cs.created_at DESC`,
    valores
  );

  return rows;
}

module.exports = { registrar, listar };