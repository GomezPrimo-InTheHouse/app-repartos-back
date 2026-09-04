// src/services/reportes.service.js
const db = require('../config/db');
const envasesService = require('./envases.service');

async function obtenerEstadoCuentaCliente({ propietarioId, clienteId, desde, hasta }) {
  const { rows: clienteRows } = await db.query(
    'SELECT * FROM clientes WHERE id = $1 AND propietario_id = $2',
    [clienteId, propietarioId]
  );
  const cliente = clienteRows[0];
  if (!cliente) {
    throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  }

  const condDespachos = [`d.cliente_id = $1`, `d.propietario_id = $2`, `d.estado = 'entregado'`];
  const valDespachos = [clienteId, propietarioId];
  if (desde) { valDespachos.push(desde); condDespachos.push(`d.fecha >= $${valDespachos.length}`); }
  if (hasta) { valDespachos.push(hasta); condDespachos.push(`d.fecha <= $${valDespachos.length}`); }

  const { rows: despachos } = await db.query(
    `SELECT d.id, d.numero, d.fecha, d.total,
       json_agg(
         json_build_object(
           'producto_nombre', p.nombre,
           'cantidad', di.cantidad,
           'precio_unitario', di.precio_unitario,
           'subtotal', di.subtotal
         ) ORDER BY p.nombre
       ) AS items
     FROM despachos d
     JOIN despacho_items di ON di.despacho_id = d.id
     JOIN productos p ON p.id = di.producto_id
     WHERE ${condDespachos.join(' AND ')}
     GROUP BY d.id
     ORDER BY d.fecha ASC`,
    valDespachos
  );

  const condPagos = [`cliente_id = $1`, `propietario_id = $2`, `estado = 'activo'`];
  const valPagos = [clienteId, propietarioId];
  if (desde) { valPagos.push(desde); condPagos.push(`fecha >= $${valPagos.length}`); }
  if (hasta) { valPagos.push(hasta); condPagos.push(`fecha <= $${valPagos.length}`); }

  const { rows: pagos } = await db.query(
    `SELECT id, fecha, monto, metodo, notas
     FROM pagos
     WHERE ${condPagos.join(' AND ')}
     ORDER BY fecha ASC`,
    valPagos
  );

  const { rows: saldoRows } = await db.query(
    `SELECT
       COALESCE((SELECT SUM(total) FROM despachos WHERE cliente_id = $1 AND propietario_id = $2 AND estado = 'entregado'), 0)
       - COALESCE((SELECT SUM(monto) FROM pagos WHERE cliente_id = $1 AND propietario_id = $2 AND estado = 'activo'), 0) AS saldo`,
    [clienteId, propietarioId]
  );

  return {
    cliente,
    despachos,
    pagos,
    totalDespachadoPeriodo: despachos.reduce((acc, d) => acc + Number(d.total), 0),
    totalPagadoPeriodo: pagos.reduce((acc, p) => acc + Number(p.monto), 0),
    saldoActual: Number(saldoRows[0].saldo),
  };
}

async function obtenerResumenGeneral({ propietarioId, desde, hasta }) {
  const condPagos = ['propietario_id = $1', `estado = 'activo'`];
  const valPagos = [propietarioId];
  if (desde) { valPagos.push(desde); condPagos.push(`fecha >= $${valPagos.length}`); }
  if (hasta) { valPagos.push(hasta); condPagos.push(`fecha <= $${valPagos.length}`); }

  const { rows: pagosPorMetodo } = await db.query(
    `SELECT metodo, COUNT(*) AS cantidad, COALESCE(SUM(monto), 0) AS total
     FROM pagos WHERE ${condPagos.join(' AND ')}
     GROUP BY metodo`,
    valPagos
  );

  const { rows: totalPagosRows } = await db.query(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE ${condPagos.join(' AND ')}`,
    valPagos
  );

  const condDespachos = [`d.propietario_id = $1`, `d.estado = 'entregado'`];
  const valDespachos = [propietarioId];
  if (desde) { valDespachos.push(desde); condDespachos.push(`d.fecha >= $${valDespachos.length}`); }
  if (hasta) { valDespachos.push(hasta); condDespachos.push(`d.fecha <= $${valDespachos.length}`); }

  const { rows: totalDespachosRows } = await db.query(
    `SELECT COUNT(*) AS cantidad_despachos, COALESCE(SUM(total), 0) AS total_despachado
     FROM despachos d WHERE ${condDespachos.join(' AND ')}`,
    valDespachos
  );

  const { rows: productosDespachados } = await db.query(
    `SELECT p.nombre, SUM(di.cantidad) AS cantidad, SUM(di.subtotal) AS monto
     FROM despacho_items di
     JOIN despachos d ON d.id = di.despacho_id
     JOIN productos p ON p.id = di.producto_id
     WHERE ${condDespachos.join(' AND ')}
     GROUP BY p.nombre
     ORDER BY cantidad DESC`,
    valDespachos
  );

  return {
    pagosPorMetodo,
    totalPagado: Number(totalPagosRows[0].total),
    cantidadDespachos: Number(totalDespachosRows[0].cantidad_despachos),
    totalDespachado: Number(totalDespachosRows[0].total_despachado),
    productosDespachados,
  };
}

async function obtenerComprobantePago({ propietarioId, pagoId }) {
  const { rows: pagoRows } = await db.query(
    `SELECT p.*, c.id AS cliente_id, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
     FROM pagos p
     JOIN clientes c ON c.id = p.cliente_id
     WHERE p.id = $1 AND p.propietario_id = $2`,
    [pagoId, propietarioId]
  );
  const pago = pagoRows[0];
  if (!pago) {
    throw Object.assign(new Error('Pago no encontrado'), { status: 404 });
  }

  const { rows: saldoRows } = await db.query(
    `SELECT
       COALESCE((SELECT SUM(total) FROM despachos WHERE cliente_id = $1 AND propietario_id = $2 AND estado = 'entregado'), 0)
       - COALESCE((SELECT SUM(monto) FROM pagos WHERE cliente_id = $1 AND propietario_id = $2 AND estado = 'activo'), 0) AS saldo`,
    [pago.cliente_id, propietarioId]
  );
  const saldoActual = Number(saldoRows[0].saldo);

  const envases = await envasesService.obtenerSaldos(propietarioId, pago.cliente_id);

  return { pago, saldoActual, envases };
}

module.exports = { obtenerEstadoCuentaCliente, obtenerResumenGeneral, obtenerComprobantePago };