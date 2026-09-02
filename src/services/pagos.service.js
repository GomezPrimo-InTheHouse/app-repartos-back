// src/services/pagos.service.js
const db = require('../config/db');

async function registrar({ propietarioId, cliente_id, monto, metodo, despacho_id, notas, fecha, createdBy }) {
  const { rows: clienteCheck } = await db.query(
    'SELECT id FROM clientes WHERE id = $1 AND propietario_id = $2',
    [cliente_id, propietarioId]
  );
  if (clienteCheck.length === 0) {
    throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  }

  const { rows } = await db.query(
    `INSERT INTO pagos (propietario_id, cliente_id, monto, metodo, despacho_id, notas, fecha, created_by)
     VALUES ($1, $2, $3, COALESCE($4, 'efectivo'), $5, $6, COALESCE($7, now()), $8)
     RETURNING *`,
    [propietarioId, cliente_id, monto, metodo, despacho_id, notas, fecha, createdBy]
  );
  return rows[0];
}

async function listar({ propietarioId, cliente_id, desde, hasta }) {
  const condiciones = ['p.propietario_id = $1'];
  const valores = [propietarioId];

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

  const { rows } = await db.query(
    `SELECT p.*, c.nombre AS cliente_nombre
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY p.fecha DESC`,
    valores
  );

  return rows;
}

module.exports = { registrar, listar };