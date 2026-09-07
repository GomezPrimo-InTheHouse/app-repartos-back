// src/services/clientes.service.js
const db = require('../config/db');

function esErrorDniDuplicado(err) {
  return err.code === '23505' && err.constraint === 'idx_clientes_propietario_dni';
}

function construirQueryBase({ propietarioId, busqueda, activo, barrio, soloDeudores, saldoMinimo }) {
  const condiciones = ['c.propietario_id = $1'];
  const valores = [propietarioId];

  if (busqueda) {
    valores.push(`%${busqueda}%`);
    condiciones.push(`(c.nombre ILIKE $${valores.length} OR c.direccion ILIKE $${valores.length})`);
  }
  if (activo !== undefined) {
    valores.push(activo);
    condiciones.push(`c.activo = $${valores.length}`);
  }
  if (barrio) {
    valores.push(`%${barrio}%`);
    condiciones.push(`c.barrio ILIKE $${valores.length}`);
  }

  const saldoExpr = `COALESCE(d.total_despachado, 0) - COALESCE(pg.total_pagado, 0)`;
  const condicionesHaving = [];
  if (soloDeudores) {
    condicionesHaving.push(`${saldoExpr} > 0`);
  }
  if (saldoMinimo !== undefined) {
    valores.push(saldoMinimo);
    condicionesHaving.push(`${saldoExpr} >= $${valores.length}`);
  }

  const sql = `
    SELECT
      c.id, c.nombre, c.dni, c.telefono, c.direccion, c.barrio, c.localidad,
      c.dias_credito, c.limite_credito, c.foto_url, c.activo, c.created_at,
      ${saldoExpr} AS saldo
    FROM clientes c
    LEFT JOIN (
      SELECT cliente_id, SUM(total) AS total_despachado
      FROM despachos
      WHERE estado = 'entregado' AND propietario_id = $1
      GROUP BY cliente_id
    ) d ON d.cliente_id = c.id
    LEFT JOIN (
      SELECT cliente_id, SUM(monto) AS total_pagado
      FROM pagos
      WHERE propietario_id = $1 AND estado = 'activo'
      GROUP BY cliente_id
    ) pg ON pg.cliente_id = c.id
    WHERE ${condiciones.join(' AND ')}
    ${condicionesHaving.length ? `HAVING ${condicionesHaving.join(' AND ')}` : ''}
  `;

  return { sql, valores };
}

async function listar({ propietarioId, busqueda, activo, barrio, ordenarPor, orden, soloDeudores, saldoMinimo, limit, offset }) {
  const { sql, valores } = construirQueryBase({ propietarioId, busqueda, activo, barrio, soloDeudores, saldoMinimo });

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM (${sql}) AS sub`,
    valores
  );
  const total = Number(countRows[0].total);

  const columnaOrden = ordenarPor === 'saldo' ? 'saldo' : 'nombre';
  const direccionOrden = orden === 'asc' ? 'ASC' : ordenarPor === 'saldo' ? 'DESC' : 'ASC';

  let queryFinal = `SELECT * FROM (${sql}) AS sub ORDER BY ${columnaOrden} ${direccionOrden}`;
  const valoresConPaginacion = [...valores];

  if (limit !== undefined) {
    valoresConPaginacion.push(limit);
    queryFinal += ` LIMIT $${valoresConPaginacion.length}`;
  }
  if (offset !== undefined) {
    valoresConPaginacion.push(offset);
    queryFinal += ` OFFSET $${valoresConPaginacion.length}`;
  }

  const { rows } = await db.query(queryFinal, valoresConPaginacion);

  return { clientes: rows.map((r) => ({ ...r, saldo: Number(r.saldo) })), total };
}

async function obtenerPorId(propietarioId, id) {
  const { rows } = await db.query(
    'SELECT * FROM clientes WHERE id = $1 AND propietario_id = $2',
    [id, propietarioId]
  );
  return rows[0] || null;
}

async function crear({ propietarioId, nombre, dni, telefono, direccion, barrio, localidad, dias_credito, limite_credito, foto_url, notas, createdBy }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO clientes (propietario_id, nombre, dni, telefono, direccion, barrio, localidad, dias_credito, limite_credito, foto_url, notas, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [propietarioId, nombre, dni || null, telefono, direccion, barrio, localidad, dias_credito ?? 30, limite_credito ?? 0, foto_url, notas, createdBy]
    );
    return rows[0];
  } catch (err) {
    if (esErrorDniDuplicado(err)) {
      throw Object.assign(new Error('Ya existe un cliente con ese DNI'), { status: 409 });
    }
    throw err;
  }
}

async function actualizar(propietarioId, id, campos) {
  const permitidos = ['nombre', 'dni', 'telefono', 'direccion', 'barrio', 'localidad', 'dias_credito', 'limite_credito', 'foto_url', 'notas', 'activo'];
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

  try {
    const { rows } = await db.query(
      `UPDATE clientes SET ${sets.join(', ')}
       WHERE id = $${valores.length - 1} AND propietario_id = $${valores.length}
       RETURNING *`,
      valores
    );
    return rows[0] || null;
  } catch (err) {
    if (esErrorDniDuplicado(err)) {
      throw Object.assign(new Error('Ya existe un cliente con ese DNI'), { status: 409 });
    }
    throw err;
  }
}

async function eliminar(propietarioId, id) {
  const { rows } = await db.query(
    'UPDATE clientes SET activo = false WHERE id = $1 AND propietario_id = $2 RETURNING id',
    [id, propietarioId]
  );
  return rows[0] || null;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };