// src/services/dashboard.service.js
const db = require('../config/db');

async function obtenerResumen() {
  const { rows } = await db.query(`
    SELECT
      COALESCE((
        SELECT SUM((di.precio_unitario - di.costo_unitario) * di.cantidad)
        FROM despacho_items di
        JOIN despachos d ON d.id = di.despacho_id
        WHERE d.estado = 'entregado'
      ), 0) AS total_ganado,
      COALESCE((SELECT SUM(costo_total) FROM compras_stock), 0) AS total_invertido,
      COALESCE((SELECT SUM(total) FROM despachos WHERE estado = 'entregado'), 0)
        - COALESCE((SELECT SUM(monto) FROM pagos), 0) AS total_me_deben,
      COALESCE((
        SELECT SUM(monto) FROM pagos
        WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
      ), 0) AS total_pagado_mes
  `);

  const row = rows[0];
  return {
    totalGanado: Number(row.total_ganado),
    totalInvertido: Number(row.total_invertido),
    totalMeDeben: Number(row.total_me_deben),
    totalPagadoMes: Number(row.total_pagado_mes),
  };
}

async function productosMasVendidos({ limit = 10, desde, hasta }) {
  const condiciones = [`d.estado = 'entregado'`];
  const valores = [];

  if (desde) {
    valores.push(desde);
    condiciones.push(`d.fecha >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`d.fecha <= $${valores.length}`);
  }

  valores.push(limit);

  const { rows } = await db.query(
    `SELECT p.id, p.nombre, SUM(di.cantidad) AS cantidad_vendida, SUM(di.subtotal) AS monto_vendido
     FROM despacho_items di
     JOIN despachos d ON d.id = di.despacho_id
     JOIN productos p ON p.id = di.producto_id
     WHERE ${condiciones.join(' AND ')}
     GROUP BY p.id, p.nombre
     ORDER BY cantidad_vendida DESC
     LIMIT $${valores.length}`,
    valores
  );

  return rows;
}

async function clientesComprometidos({ limit = 10 }) {
  const { rows } = await db.query(
    `SELECT
       c.id, c.nombre, c.dias_credito, c.limite_credito,
       COALESCE(d.total_despachado, 0) - COALESCE(pg.total_pagado, 0) AS saldo
     FROM clientes c
     LEFT JOIN (
       SELECT cliente_id, SUM(total) AS total_despachado
       FROM despachos WHERE estado = 'entregado'
       GROUP BY cliente_id
     ) d ON d.cliente_id = c.id
     LEFT JOIN (
       SELECT cliente_id, SUM(monto) AS total_pagado
       FROM pagos GROUP BY cliente_id
     ) pg ON pg.cliente_id = c.id
     WHERE (COALESCE(d.total_despachado, 0) - COALESCE(pg.total_pagado, 0)) > 0
     ORDER BY saldo DESC
     LIMIT $1`,
    [limit]
  );

  return rows;
}

module.exports = { obtenerResumen, productosMasVendidos, clientesComprometidos };