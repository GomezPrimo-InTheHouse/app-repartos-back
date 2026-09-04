// src/services/envases.service.js
const db = require('../config/db');

async function obtenerSaldos(propietarioId, clienteId) {
  const { rows } = await db.query(
    `SELECT me.producto_id, p.nombre AS producto_nombre, SUM(me.delta) AS saldo
     FROM movimientos_envase me
     JOIN productos p ON p.id = me.producto_id
     WHERE me.cliente_id = $1 AND me.propietario_id = $2 AND p.maneja_envase = true
     GROUP BY me.producto_id, p.nombre
     ORDER BY p.nombre`,
    [clienteId, propietarioId]
  );

  return rows.map((r) => ({ ...r, saldo: Number(r.saldo) }));
}

async function obtenerSaldoProducto(executor, propietarioId, clienteId, productoId) {
  const { rows } = await executor.query(
    `SELECT COALESCE(SUM(delta), 0) AS saldo
     FROM movimientos_envase
     WHERE cliente_id = $1 AND producto_id = $2 AND propietario_id = $3`,
    [clienteId, productoId, propietarioId]
  );
  return Number(rows[0].saldo);
}

async function ajusteManual({ propietarioId, clienteId, productoId, delta, motivo, createdBy }) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw Object.assign(new Error('delta debe ser un número entero distinto de 0'), { status: 400 });
  }

  const { rows: clienteRows } = await db.query(
    'SELECT id FROM clientes WHERE id = $1 AND propietario_id = $2',
    [clienteId, propietarioId]
  );
  if (clienteRows.length === 0) {
    throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  }

  const { rows: productoRows } = await db.query(
    'SELECT id, nombre, maneja_envase FROM productos WHERE id = $1 AND propietario_id = $2',
    [productoId, propietarioId]
  );
  const producto = productoRows[0];
  if (!producto) {
    throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
  }
  if (!producto.maneja_envase) {
    throw Object.assign(
      new Error(`El producto "${producto.nombre}" no maneja envases retornables`),
      { status: 400 }
    );
  }

  await db.query(
    `INSERT INTO movimientos_envase (propietario_id, cliente_id, producto_id, despacho_id, delta, tipo, motivo, created_by)
     VALUES ($1, $2, $3, NULL, $4, 'ajuste_manual', $5, $6)`,
    [propietarioId, clienteId, productoId, delta, motivo || null, createdBy]
  );

  const saldo = await obtenerSaldoProducto(db, propietarioId, clienteId, productoId);

  return { producto_id: productoId, producto_nombre: producto.nombre, saldo };
}

module.exports = { obtenerSaldos, obtenerSaldoProducto, ajusteManual };