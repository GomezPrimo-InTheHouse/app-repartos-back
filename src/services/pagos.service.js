// src/services/pagos.service.js
const db = require('../config/db');

async function registrar({ cliente_id, monto, metodo, despacho_id, notas, fecha, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO pagos (cliente_id, monto, metodo, despacho_id, notas, fecha, created_by)
     VALUES ($1, $2, COALESCE($3, 'efectivo'), $4, $5, COALESCE($6, now()), $7)
     RETURNING *`,
    [cliente_id, monto, metodo, despacho_id, notas, fecha, createdBy]
  );
  return rows[0];
}

async function listar({ cliente_id, desde, hasta }) {
  const condiciones = [];
  const valores = [];

  if (cliente_id) {
    valores.push(cliente_id);
    condiciones.push(`p.cliente_id = $${valores.length}`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`p.fecha >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`p.fecha <= $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT p.*, c.nombre AS cliente_nombre
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     ${where}
     ORDER BY p.fecha DESC`,
    valores
  );

  return rows;
}

module.exports = { registrar, listar };