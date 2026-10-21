
// // src/services/repartosEjecuciones.service.js
// const db = require('../config/db');

// const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// function diaSemanaDeFecha(fechaStr) {
//   const d = new Date(`${fechaStr}T00:00:00`);
//   return DIAS[d.getDay()];
// }

// // productos y visitado se calculan enteramente contra despachos/despacho_items reales del
// // mismo cliente y misma fecha — ya no hay estimado/real, solo "lo que realmente se despachó".
// async function obtenerEjecucionDetalle(propietarioId, id) {
//   const { rows: ejecRows } = await db.query(
//     `SELECT re.*, lr.nombre AS lista_nombre, lr.tipo AS lista_tipo
//      FROM repartos_ejecutados re
//      JOIN listas_reparto lr ON lr.id = re.lista_reparto_id
//      WHERE re.id = $1 AND re.propietario_id = $2`,
//     [id, propietarioId]
//   );
//   const ejecucion = ejecRows[0];
//   if (!ejecucion) return null;

//   const { rows: items } = await db.query(
//     `SELECT
//        rei.id, rei.cliente_id, c.nombre AS cliente_nombre, c.porcentaje_aumento, rei.orden,
//        (
//          rei.visitado
//          OR EXISTS (
//            SELECT 1 FROM despachos d2
//            WHERE d2.cliente_id = rei.cliente_id
//              AND d2.propietario_id = re.propietario_id
//              AND d2.estado = 'entregado'
//              AND (d2.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = re.fecha
//          )
//        ) AS visitado,
//        COALESCE(prod.productos, '[]') AS productos
//      FROM reparto_ejecutado_items rei
//      JOIN repartos_ejecutados re ON re.id = rei.reparto_ejecutado_id
//      JOIN clientes c ON c.id = rei.cliente_id
//      LEFT JOIN LATERAL (
//        SELECT json_agg(
//                 json_build_object('producto_id', x.producto_id, 'producto_nombre', x.producto_nombre, 'cantidad', x.cantidad)
//                 ORDER BY x.producto_nombre
//               ) AS productos
//        FROM (
//          SELECT di.producto_id, p.nombre AS producto_nombre, SUM(di.cantidad) AS cantidad
//          FROM despacho_items di
//          JOIN despachos d3 ON d3.id = di.despacho_id
//          JOIN productos p ON p.id = di.producto_id
//          WHERE d3.cliente_id = rei.cliente_id
//            AND d3.propietario_id = re.propietario_id
//            AND d3.estado = 'entregado'
//            AND (d3.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = re.fecha
//          GROUP BY di.producto_id, p.nombre
//        ) x
//      ) prod ON true
//      WHERE rei.reparto_ejecutado_id = $1
//      ORDER BY rei.orden, c.nombre`,
//     [id]
//   );

//   return { ...ejecucion, items };
// }

// // Alinea los clientes de una ejecución NO cerrada con los de su lista (la lista es la fuente de verdad):
// //  - agrega los clientes que se sumaron a la lista después de generar la ejecución,
// //  - actualiza el orden de visita,
// //  - quita los que se sacaron de la lista, salvo que ya tengan actividad ese día
// //    (marcados como visitados o con un despacho entregado), para no perder historial.
// // Una ejecución completada queda congelada: es el registro de lo que pasó.
// async function sincronizarConLista(client, ejecucion, fecha) {
//   if (ejecucion.estado === 'completado') return;

//   await client.query(
//     `INSERT INTO reparto_ejecutado_items (reparto_ejecutado_id, cliente_id, orden)
//      SELECT $1, lri.cliente_id, lri.orden
//      FROM lista_reparto_items lri
//      WHERE lri.lista_reparto_id = $2
//        AND NOT EXISTS (
//          SELECT 1 FROM reparto_ejecutado_items rei
//          WHERE rei.reparto_ejecutado_id = $1 AND rei.cliente_id = lri.cliente_id
//        )`,
//     [ejecucion.id, ejecucion.lista_reparto_id]
//   );

//   await client.query(
//     `UPDATE reparto_ejecutado_items rei
//      SET orden = lri.orden
//      FROM lista_reparto_items lri
//      WHERE rei.reparto_ejecutado_id = $1
//        AND lri.lista_reparto_id = $2
//        AND lri.cliente_id = rei.cliente_id
//        AND rei.orden IS DISTINCT FROM lri.orden`,
//     [ejecucion.id, ejecucion.lista_reparto_id]
//   );

//   await client.query(
//     `DELETE FROM reparto_ejecutado_items rei
//      WHERE rei.reparto_ejecutado_id = $1
//        AND rei.visitado IS NOT TRUE
//        AND NOT EXISTS (
//          SELECT 1 FROM lista_reparto_items lri
//          WHERE lri.lista_reparto_id = $2 AND lri.cliente_id = rei.cliente_id
//        )
//        AND NOT EXISTS (
//          SELECT 1 FROM despachos d
//          WHERE d.cliente_id = rei.cliente_id
//            AND d.propietario_id = $3
//            AND d.estado = 'entregado'
//            AND (d.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = $4
//        )`,
//     [ejecucion.id, ejecucion.lista_reparto_id, ejecucion.propietario_id, fecha]
//   );
// }

// // Crea la ejecución del día si no existe y la sincroniza con su lista.
// // El FOR UPDATE serializa pedidos simultáneos (dos celulares abriendo el reparto a la vez)
// // para que no se dupliquen clientes.
// async function obtenerOGenerarEjecucion({ propietarioId, lista, fecha }) {
//   const client = await db.getClient();
//   try {
//     await client.query('BEGIN');

//     await client.query(
//       `INSERT INTO repartos_ejecutados (propietario_id, lista_reparto_id, fecha)
//        VALUES ($1, $2, $3)
//        ON CONFLICT (lista_reparto_id, fecha) DO NOTHING`,
//       [propietarioId, lista.id, fecha]
//     );

//     const { rows } = await client.query(
//       'SELECT * FROM repartos_ejecutados WHERE lista_reparto_id = $1 AND fecha = $2 FOR UPDATE',
//       [lista.id, fecha]
//     );
//     const ejecucion = rows[0];

//     await sincronizarConLista(client, ejecucion, fecha);

//     await client.query('COMMIT');
//     return ejecucion;
//   } catch (err) {
//     await client.query('ROLLBACK');
//     throw err;
//   } finally {
//     client.release();
//   }
// }

// // Una lista semanal puede tener varios días (dias_semana text[]): entra si el día de la fecha está en el array.
// async function obtenerOGenerarDelDia({ propietarioId, fecha }) {
//   const dia = diaSemanaDeFecha(fecha);

//   const { rows: listas } = await db.query(
//     `SELECT * FROM listas_reparto
//      WHERE propietario_id = $1 AND activa = true
//      AND (
//        (tipo = 'semanal' AND $2 = ANY(dias_semana))
//        OR
//        (tipo = 'unica' AND fecha = $3)
//      )`,
//     [propietarioId, dia, fecha]
//   );

//   const ejecuciones = [];

//   for (const lista of listas) {
//     const ejecucion = await obtenerOGenerarEjecucion({ propietarioId, lista, fecha });
//     const detalle = await obtenerEjecucionDetalle(propietarioId, ejecucion.id);
//     ejecuciones.push(detalle);
//   }

//   return ejecuciones;
// }

// async function listarEjecuciones({ propietarioId, desde, hasta, lista_reparto_id }) {
//   const condiciones = ['re.propietario_id = $1'];
//   const valores = [propietarioId];

//   if (lista_reparto_id) {
//     valores.push(lista_reparto_id);
//     condiciones.push(`re.lista_reparto_id = $${valores.length}`);
//   }
//   if (desde) {
//     valores.push(desde);
//     condiciones.push(`re.fecha >= $${valores.length}`);
//   }
//   if (hasta) {
//     valores.push(hasta);
//     condiciones.push(`re.fecha <= $${valores.length}`);
//   }

//   const { rows } = await db.query(
//     `SELECT re.*, lr.nombre AS lista_nombre, lr.tipo AS lista_tipo
//      FROM repartos_ejecutados re
//      JOIN listas_reparto lr ON lr.id = re.lista_reparto_id
//      WHERE ${condiciones.join(' AND ')}
//      ORDER BY re.fecha DESC`,
//     valores
//   );
//   return rows;
// }

// // Solo maneja "visitado" manual. Ya no acepta/usa "productos" en absoluto.
// async function actualizarItemEjecucion(propietarioId, ejecucionId, itemId, { visitado }) {
//   const { rows: check } = await db.query(
//     `SELECT rei.id FROM reparto_ejecutado_items rei
//      JOIN repartos_ejecutados re ON re.id = rei.reparto_ejecutado_id
//      WHERE rei.id = $1 AND rei.reparto_ejecutado_id = $2 AND re.propietario_id = $3`,
//     [itemId, ejecucionId, propietarioId]
//   );
//   if (check.length === 0) {
//     throw Object.assign(new Error('Item de reparto no encontrado'), { status: 404 });
//   }

//   if (visitado !== undefined) {
//     await db.query('UPDATE reparto_ejecutado_items SET visitado = $1 WHERE id = $2', [visitado, itemId]);
//   }

//   const detalle = await obtenerEjecucionDetalle(propietarioId, ejecucionId);
//   return detalle.items.find((i) => i.id === itemId);
// }

// async function completarEjecucion(propietarioId, id) {
//   const { rows } = await db.query(
//     `UPDATE repartos_ejecutados SET estado = 'completado' WHERE id = $1 AND propietario_id = $2 RETURNING *`,
//     [id, propietarioId]
//   );
//   return rows[0] || null;
// }

// module.exports = {
//   obtenerOGenerarDelDia,
//   listarEjecuciones,
//   obtenerEjecucionDetalle,
//   actualizarItemEjecucion,
//   completarEjecucion,
// };

// src/services/repartosEjecuciones.service.js
const db = require('../config/db');

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function diaSemanaDeFecha(fechaStr) {
  const d = new Date(`${fechaStr}T00:00:00`);
  return DIAS[d.getDay()];
}

// productos y visitado se calculan enteramente contra despachos/despacho_items reales del
// mismo cliente y misma fecha — ya no hay estimado/real, solo "lo que realmente se despachó".
async function obtenerEjecucionDetalle(propietarioId, id) {
  const { rows: ejecRows } = await db.query(
    `SELECT re.*, lr.nombre AS lista_nombre, lr.tipo AS lista_tipo
     FROM repartos_ejecutados re
     JOIN listas_reparto lr ON lr.id = re.lista_reparto_id
     WHERE re.id = $1 AND re.propietario_id = $2`,
    [id, propietarioId]
  );
  const ejecucion = ejecRows[0];
  if (!ejecucion) return null;

  const { rows: items } = await db.query(
    `SELECT
       rei.id, rei.cliente_id, c.nombre AS cliente_nombre, c.porcentaje_aumento, rei.orden,
       (
         rei.visitado
         OR EXISTS (
           SELECT 1 FROM despachos d2
           WHERE d2.cliente_id = rei.cliente_id
             AND d2.propietario_id = re.propietario_id
             AND d2.estado = 'entregado'
             AND (d2.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = re.fecha
         )
       ) AS visitado,
       COALESCE(prod.productos, '[]') AS productos
     FROM reparto_ejecutado_items rei
     JOIN repartos_ejecutados re ON re.id = rei.reparto_ejecutado_id
     JOIN clientes c ON c.id = rei.cliente_id
     LEFT JOIN LATERAL (
       SELECT json_agg(
                json_build_object('producto_id', x.producto_id, 'producto_nombre', x.producto_nombre, 'cantidad', x.cantidad)
                ORDER BY x.producto_nombre
              ) AS productos
       FROM (
         SELECT di.producto_id, p.nombre AS producto_nombre, SUM(di.cantidad) AS cantidad
         FROM despacho_items di
         JOIN despachos d3 ON d3.id = di.despacho_id
         JOIN productos p ON p.id = di.producto_id
         WHERE d3.cliente_id = rei.cliente_id
           AND d3.propietario_id = re.propietario_id
           AND d3.estado = 'entregado'
           AND (d3.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = re.fecha
         GROUP BY di.producto_id, p.nombre
       ) x
     ) prod ON true
     WHERE rei.reparto_ejecutado_id = $1
     ORDER BY rei.orden, c.nombre`,
    [id]
  );

  return { ...ejecucion, items };
}

// Alinea los clientes de una ejecución NO cerrada con los de su lista (la lista es la fuente de verdad):
//  - agrega los clientes que se sumaron a la lista después de generar la ejecución,
//  - actualiza el orden de visita,
//  - quita los que se sacaron de la lista, salvo que ya tengan actividad ese día
//    (marcados como visitados o con un despacho entregado), para no perder historial.
// Una ejecución completada queda congelada: es el registro de lo que pasó.
async function sincronizarConLista(client, ejecucion, fecha) {
  if (ejecucion.estado === 'completado') return;

  await client.query(
    `INSERT INTO reparto_ejecutado_items (reparto_ejecutado_id, cliente_id, orden)
     SELECT $1, lri.cliente_id, lri.orden
     FROM lista_reparto_items lri
     WHERE lri.lista_reparto_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM reparto_ejecutado_items rei
         WHERE rei.reparto_ejecutado_id = $1 AND rei.cliente_id = lri.cliente_id
       )`,
    [ejecucion.id, ejecucion.lista_reparto_id]
  );

  await client.query(
    `UPDATE reparto_ejecutado_items rei
     SET orden = lri.orden
     FROM lista_reparto_items lri
     WHERE rei.reparto_ejecutado_id = $1
       AND lri.lista_reparto_id = $2
       AND lri.cliente_id = rei.cliente_id
       AND rei.orden IS DISTINCT FROM lri.orden`,
    [ejecucion.id, ejecucion.lista_reparto_id]
  );

  await client.query(
    `DELETE FROM reparto_ejecutado_items rei
     WHERE rei.reparto_ejecutado_id = $1
       AND rei.visitado IS NOT TRUE
       AND NOT EXISTS (
         SELECT 1 FROM lista_reparto_items lri
         WHERE lri.lista_reparto_id = $2 AND lri.cliente_id = rei.cliente_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM despachos d
         WHERE d.cliente_id = rei.cliente_id
           AND d.propietario_id = $3
           AND d.estado = 'entregado'
           AND (d.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = $4
       )`,
    [ejecucion.id, ejecucion.lista_reparto_id, ejecucion.propietario_id, fecha]
  );
}

// Crea la ejecución del día si no existe y la sincroniza con su lista.
// El FOR UPDATE serializa pedidos simultáneos (dos celulares abriendo el reparto a la vez)
// para que no se dupliquen clientes.
async function obtenerOGenerarEjecucion({ propietarioId, lista, fecha }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO repartos_ejecutados (propietario_id, lista_reparto_id, fecha)
       VALUES ($1, $2, $3)
       ON CONFLICT (lista_reparto_id, fecha) DO NOTHING`,
      [propietarioId, lista.id, fecha]
    );

    const { rows } = await client.query(
      'SELECT * FROM repartos_ejecutados WHERE lista_reparto_id = $1 AND fecha = $2 FOR UPDATE',
      [lista.id, fecha]
    );
    const ejecucion = rows[0];

    await sincronizarConLista(client, ejecucion, fecha);

    await client.query('COMMIT');
    return ejecucion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Una lista semanal puede tener varios días (dias_semana text[]): entra si el día de la fecha está en el array.
async function obtenerOGenerarDelDia({ propietarioId, fecha }) {
  const dia = diaSemanaDeFecha(fecha);

  const { rows: listas } = await db.query(
    `SELECT * FROM listas_reparto
     WHERE propietario_id = $1 AND activa = true
     AND (
       (tipo = 'semanal' AND $2 = ANY(dias_semana))
       OR
       (tipo = 'unica' AND fecha = $3)
     )`,
    [propietarioId, dia, fecha]
  );

  const ejecuciones = [];

  for (const lista of listas) {
    const ejecucion = await obtenerOGenerarEjecucion({ propietarioId, lista, fecha });
    const detalle = await obtenerEjecucionDetalle(propietarioId, ejecucion.id);
    ejecuciones.push(detalle);
  }

  return ejecuciones;
}

async function listarEjecuciones({ propietarioId, desde, hasta, lista_reparto_id }) {
  const condiciones = ['re.propietario_id = $1'];
  const valores = [propietarioId];

  if (lista_reparto_id) {
    valores.push(lista_reparto_id);
    condiciones.push(`re.lista_reparto_id = $${valores.length}`);
  }
  if (desde) {
    valores.push(desde);
    condiciones.push(`re.fecha >= $${valores.length}`);
  }
  if (hasta) {
    valores.push(hasta);
    condiciones.push(`re.fecha <= $${valores.length}`);
  }

  const { rows } = await db.query(
    `SELECT re.*, lr.nombre AS lista_nombre, lr.tipo AS lista_tipo
     FROM repartos_ejecutados re
     JOIN listas_reparto lr ON lr.id = re.lista_reparto_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY re.fecha DESC`,
    valores
  );
  return rows;
}

// Solo maneja "visitado" manual. Ya no acepta/usa "productos" en absoluto.
async function actualizarItemEjecucion(propietarioId, ejecucionId, itemId, { visitado }) {
  const { rows: check } = await db.query(
    `SELECT rei.id FROM reparto_ejecutado_items rei
     JOIN repartos_ejecutados re ON re.id = rei.reparto_ejecutado_id
     WHERE rei.id = $1 AND rei.reparto_ejecutado_id = $2 AND re.propietario_id = $3`,
    [itemId, ejecucionId, propietarioId]
  );
  if (check.length === 0) {
    throw Object.assign(new Error('Item de reparto no encontrado'), { status: 404 });
  }

  if (visitado !== undefined) {
    await db.query('UPDATE reparto_ejecutado_items SET visitado = $1 WHERE id = $2', [visitado, itemId]);
  }

  const detalle = await obtenerEjecucionDetalle(propietarioId, ejecucionId);
  return detalle.items.find((i) => i.id === itemId);
}

async function completarEjecucion(propietarioId, id) {
  const { rows } = await db.query(
    `UPDATE repartos_ejecutados SET estado = 'completado' WHERE id = $1 AND propietario_id = $2 RETURNING *`,
    [id, propietarioId]
  );
  return rows[0] || null;
}

module.exports = {
  obtenerOGenerarDelDia,
  listarEjecuciones,
  obtenerEjecucionDetalle,
  actualizarItemEjecucion,
  completarEjecucion,
};