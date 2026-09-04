// src/services/pagos.service.js
const db = require('../config/db');

async function registrar({ propietarioId, cliente_id, monto, metodo, despacho_id, notas, fecha, createdBy }) {
  if (!(Number(monto) > 0)) {
    throw Object.assign(new Error('El monto debe ser mayor a 0'), { status: 400 });
  }

  const { rows: clienteRows } = await db.query(
    'SELECT id, nombre FROM clientes WHERE id = $1 AND propietario_id = $2',
    [cliente_id, propietarioId]
  );
  const cliente = clienteRows[0];
  if (!cliente) {
    throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  }

  const { rows } = await db.query(
    `INSERT INTO pagos (propietario_id, cliente_id, monto, metodo, despacho_id, notas, fecha, created_by)
     VALUES ($1, $2, $3, COALESCE($4, 'efectivo'), $5, $6, COALESCE($7, now()), $8)
     RETURNING *`,
    [propietarioId, cliente_id, monto, metodo, despacho_id, notas, fecha, createdBy]
  );

  return { ...rows[0], cliente_nombre: cliente.nombre };
}

async function anular(propietarioId, id, { motivo, anuladoPor }) {
  const { rows: pagoRows } = await db.query(
    'SELECT * FROM pagos WHERE id = $1 AND propietario_id = $2',
    [id, propietarioId]
  );
  const pago = pagoRows[0];

  if (!pago) {
    throw Object.assign(new Error('Pago no encontrado'), { status: 404 });
  }
  if (pago.estado === 'anulado') {
    throw Object.assign(new Error('El pago ya está anulado'), { status: 400 });
  }

  const { rows } = await db.query(
    `UPDATE pagos
     SET estado = 'anulado', anulado_por = $1, anulado_at = now(), motivo_anulacion = $2
     WHERE id = $3 AND propietario_id = $4
     RETURNING *`,
    [anuladoPor, motivo, id, propietarioId]
  );

  return rows[0];
}

async function listar({ propietarioId, cliente_id, estado, desde, hasta, limit, offset }) {
  const condiciones = ['p.propietario_id = $1'];
  const valores = [propietarioId];

  if (cliente_id) {
    valores.push(cliente_id);
    condiciones.push(`p.cliente_id = $${valores.length}`);
  }
  if (estado) {
    valores.push(estado);
    condiciones.push(`p.estado = $${valores.length}`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`p.fecha >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`p.fecha <= $${valores.length}`);
  }

  const whereClause = condiciones.join(' AND ');

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM pagos p WHERE ${whereClause}`,
    valores
  );
  const total = Number(countRows[0].total);

  let query = `
    SELECT p.*, c.nombre AS cliente_nombre
    FROM pagos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE ${whereClause}
    ORDER BY p.fecha DESC`;

  const valoresConPaginacion = [...valores];

  if (limit !== undefined) {
    valoresConPaginacion.push(limit);
    query += ` LIMIT $${valoresConPaginacion.length}`;
  }
  if (offset !== undefined) {
    valoresConPaginacion.push(offset);
    query += ` OFFSET $${valoresConPaginacion.length}`;
  }

  const { rows } = await db.query(query, valoresConPaginacion);

  return { pagos: rows, total };
}

module.exports = { registrar, anular, listar };