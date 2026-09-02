// src/services/despachos.service.js
const db = require('../config/db');

async function obtenerSaldoCliente(executor, propietarioId, clienteId) {
  const { rows } = await executor.query(
    `SELECT
       COALESCE((SELECT SUM(total) FROM despachos WHERE cliente_id = $1 AND propietario_id = $2 AND estado = 'entregado'), 0)
       - COALESCE((SELECT SUM(monto) FROM pagos WHERE cliente_id = $1 AND propietario_id = $2), 0) AS saldo`,
    [clienteId, propietarioId]
  );
  return Number(rows[0].saldo);
}

async function crear({ propietarioId, cliente_id, items, notas, createdBy }) {
  if (!items || items.length === 0) {
    throw Object.assign(new Error('El despacho debe tener al menos un producto'), { status: 400 });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { rows: clienteRows } = await client.query(
      'SELECT * FROM clientes WHERE id = $1 AND propietario_id = $2 FOR UPDATE',
      [cliente_id, propietarioId]
    );
    const cliente = clienteRows[0];
    if (!cliente) {
      throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
    }

    const saldoActual = await obtenerSaldoCliente(client, propietarioId, cliente_id);

    let total = 0;
    const itemsProcesados = [];

    for (const item of items) {
      const { rows: productoRows } = await client.query(
        'SELECT * FROM productos WHERE id = $1 AND propietario_id = $2 FOR UPDATE',
        [item.producto_id, propietarioId]
      );
      const producto = productoRows[0];

      if (!producto) {
        throw Object.assign(new Error(`Producto ${item.producto_id} no encontrado`), { status: 404 });
      }
      if (Number(producto.stock_actual) < Number(item.cantidad)) {
        throw Object.assign(
          new Error(`Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock_actual})`),
          { status: 400 }
        );
      }

      const subtotal = Number(item.cantidad) * Number(producto.precio_venta);
      total += subtotal;

      itemsProcesados.push({
        producto_id: producto.id,
        cantidad: item.cantidad,
        precio_unitario: producto.precio_venta,
        costo_unitario: producto.costo_unitario,
      });
    }

    const alertaCredito =
      saldoActual + total > Number(cliente.limite_credito) && Number(cliente.limite_credito) > 0;

    const { rows: despachoRows } = await client.query(
      `INSERT INTO despachos (propietario_id, cliente_id, total, alerta_credito_al_momento, notas, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [propietarioId, cliente_id, total, alertaCredito, notas, createdBy]
    );
    const despacho = despachoRows[0];

    for (const item of itemsProcesados) {
      await client.query(
        `INSERT INTO despacho_items (despacho_id, producto_id, cantidad, precio_unitario, costo_unitario)
         VALUES ($1, $2, $3, $4, $5)`,
        [despacho.id, item.producto_id, item.cantidad, item.precio_unitario, item.costo_unitario]
      );

      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND propietario_id = $3',
        [item.cantidad, item.producto_id, propietarioId]
      );
    }

    await client.query('COMMIT');

    return { ...despacho, items: itemsProcesados };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function anular(propietarioId, id, { motivo, anuladoPor }) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { rows: despachoRows } = await client.query(
      'SELECT * FROM despachos WHERE id = $1 AND propietario_id = $2 FOR UPDATE',
      [id, propietarioId]
    );
    const despacho = despachoRows[0];

    if (!despacho) {
      throw Object.assign(new Error('Despacho no encontrado'), { status: 404 });
    }
    if (despacho.estado === 'anulado') {
      throw Object.assign(new Error('El despacho ya está anulado'), { status: 400 });
    }

    const { rows: items } = await client.query(
      'SELECT * FROM despacho_items WHERE despacho_id = $1',
      [id]
    );

    for (const item of items) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2 AND propietario_id = $3',
        [item.cantidad, item.producto_id, propietarioId]
      );
    }

    const { rows: actualizadoRows } = await client.query(
      `UPDATE despachos
       SET estado = 'anulado', anulado_por = $1, anulado_at = now(), motivo_anulacion = $2
       WHERE id = $3 AND propietario_id = $4
       RETURNING *`,
      [anuladoPor, motivo, id, propietarioId]
    );

    await client.query('COMMIT');
    return actualizadoRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function obtenerPorId(propietarioId, id) {
  const { rows: despachoRows } = await db.query(
    `SELECT d.*, c.nombre AS cliente_nombre
     FROM despachos d
     JOIN clientes c ON c.id = d.cliente_id
     WHERE d.id = $1 AND d.propietario_id = $2`,
    [id, propietarioId]
  );
  const despacho = despachoRows[0];
  if (!despacho) return null;

  const { rows: items } = await db.query(
    `SELECT di.*, p.nombre AS producto_nombre
     FROM despacho_items di
     JOIN productos p ON p.id = di.producto_id
     WHERE di.despacho_id = $1`,
    [id]
  );

  return { ...despacho, items };
}

async function listar({ propietarioId, cliente_id, estado, desde, hasta }) {
  const condiciones = ['d.propietario_id = $1'];
  const valores = [propietarioId];

  if (cliente_id) {
    valores.push(cliente_id);
    condiciones.push(`d.cliente_id = $${valores.length}`);
  }
  if (estado) {
    valores.push(estado);
    condiciones.push(`d.estado = $${valores.length}`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`d.fecha >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`d.fecha <= $${valores.length}`);
  }

  const { rows } = await db.query(
    `SELECT d.*, c.nombre AS cliente_nombre
     FROM despachos d
     JOIN clientes c ON c.id = d.cliente_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY d.fecha DESC`,
    valores
  );

  return rows;
}

module.exports = { crear, anular, obtenerPorId, listar, obtenerSaldoCliente };