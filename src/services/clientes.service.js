// src/services/clientes.service.js
const db = require('../config/db');

async function listar({ busqueda, activo }) {
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

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT id, nombre, telefono, direccion, dias_credito, limite_credito, foto_url, activo, created_at
     FROM clientes
     ${where}
     ORDER BY nombre ASC`,
    valores
  );

  return rows;
}

async function obtenerPorId(id) {
  const { rows } = await db.query('SELECT * FROM clientes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function crear({ nombre, telefono, direccion, dias_credito, limite_credito, foto_url, notas, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO clientes (nombre, telefono, direccion, dias_credito, limite_credito, foto_url, notas, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [nombre, telefono, direccion, dias_credito ?? 30, limite_credito ?? 0, foto_url, notas, createdBy]
  );
  return rows[0];
}

async function actualizar(id, campos) {
  const permitidos = ['nombre', 'telefono', 'direccion', 'dias_credito', 'limite_credito', 'foto_url', 'notas', 'activo'];
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
    `UPDATE clientes SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function eliminar(id) {
  // Baja lógica: nunca se borra un cliente con historial de despachos/pagos
  const { rows } = await db.query(
    'UPDATE clientes SET activo = false WHERE id = $1 RETURNING id',
    [id]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };