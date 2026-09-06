
// src/services/repartosEjecuciones.service.js
const db = require('../config/db');

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function diaSemanaDeFecha(fechaStr) {
  const d = new Date(`${fechaStr}T00:00:00`);
  return DIAS[d.getDay()];
}

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
    `SELECT rei.id, rei.cliente_id, c.nombre AS cliente_nombre, rei.orden, rei.visitado,
       COALESCE(
         json_agg(
           json_build_object(
             'producto_id', reip.producto_id,
             'producto_nombre', p.nombre,
             'cantidad_estimada', reip.cantidad_estimada,
             'cantidad_real', reip.cantidad_real
           ) ORDER BY p.nombre
         ) FILTER (WHERE reip.id IS NOT NULL), '[]'
       ) AS productos
     FROM reparto_ejecutado_items rei
     JOIN clientes c ON c.id = rei.cliente_id
     LEFT JOIN reparto_ejecutado_item_productos reip ON reip.reparto_ejecutado_item_id = rei.id
     LEFT JOIN productos p ON p.id = reip.producto_id
     WHERE rei.reparto_ejecutado_id = $1
     GROUP BY rei.id, c.nombre
     ORDER BY rei.orden, c.nombre`,
    [id]
  );

  return { ...ejecucion, items };
}

async function generarEjecucion({ propietarioId, lista, fecha }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: ejecRows } = await client.query(
      `INSERT INTO repartos_ejecutados (propietario_id, lista_reparto_id, fecha)
       VALUES ($1, $2, $3)
       ON CONFLICT (lista_reparto_id, fecha) DO NOTHING
       RETURNING *`,
      [propietarioId, lista.id, fecha]
    );

    let ejecucion = ejecRows[0];

    if (!ejecucion) {
      // Otra request concurrente ya la generó justo antes — la recuperamos, no duplicamos nada
      const { rows } = await client.query(
        'SELECT * FROM repartos_ejecutados WHERE lista_reparto_id = $1 AND fecha = $2',
        [lista.id, fecha]
      );
      ejecucion = rows[0];
      await client.query('COMMIT');
      return ejecucion;
    }

    const { rows: items } = await client.query(
      'SELECT * FROM lista_reparto_items WHERE lista_reparto_id = $1 ORDER BY orden',
      [lista.id]
    );

    for (const item of items) {
      const { rows: nuevoItemRows } = await client.query(
        `INSERT INTO reparto_ejecutado_items (reparto_ejecutado_id, cliente_id, orden)
         VALUES ($1, $2, $3) RETURNING id`,
        [ejecucion.id, item.cliente_id, item.orden]
      );
      const nuevoItemId = nuevoItemRows[0].id;

      const { rows: productos } = await client.query(
        'SELECT * FROM lista_reparto_item_productos WHERE lista_reparto_item_id = $1',
        [item.id]
      );

      for (const prod of productos) {
        await client.query(
          `INSERT INTO reparto_ejecutado_item_productos (reparto_ejecutado_item_id, producto_id, cantidad_estimada)
           VALUES ($1, $2, $3)`,
          [nuevoItemId, prod.producto_id, prod.cantidad_estimada]
        );
      }
    }

    await client.query('COMMIT');
    return ejecucion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function obtenerOGenerarDelDia({ propietarioId, fecha }) {
  const dia = diaSemanaDeFecha(fecha);

  const { rows: listas } = await db.query(
    `SELECT * FROM listas_reparto
     WHERE propietario_id = $1 AND activa = true
     AND (
       (tipo = 'semanal' AND dia_semana = $2)
       OR
       (tipo = 'unica' AND fecha = $3)
     )`,
    [propietarioId, dia, fecha]
  );

  const ejecuciones = [];

  for (const lista of listas) {
    const { rows: existentes } = await db.query(
      'SELECT * FROM repartos_ejecutados WHERE lista_reparto_id = $1 AND fecha = $2',
      [lista.id, fecha]
    );

    const ejecucion = existentes[0] || (await generarEjecucion({ propietarioId, lista, fecha }));
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

async function obtenerItemEjecucion(itemId) {
  const { rows } = await db.query(
    `SELECT rei.id, rei.cliente_id, c.nombre AS cliente_nombre, rei.visitado,
       COALESCE(
         json_agg(
           json_build_object(
             'producto_id', reip.producto_id,
             'producto_nombre', p.nombre,
             'cantidad_estimada', reip.cantidad_estimada,
             'cantidad_real', reip.cantidad_real
           ) ORDER BY p.nombre
         ) FILTER (WHERE reip.id IS NOT NULL), '[]'
       ) AS productos
     FROM reparto_ejecutado_items rei
     JOIN clientes c ON c.id = rei.cliente_id
     LEFT JOIN reparto_ejecutado_item_productos reip ON reip.reparto_ejecutado_item_id = rei.id
     LEFT JOIN productos p ON p.id = reip.producto_id
     WHERE rei.id = $1
     GROUP BY rei.id, c.nombre`,
    [itemId]
  );
  return rows[0] || null;
}

async function actualizarItemEjecucion(propietarioId, ejecucionId, itemId, { visitado, productos }) {
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

  if (Array.isArray(productos)) {
    for (const prod of productos) {
      await db.query(
        `UPDATE reparto_ejecutado_item_productos
         SET cantidad_real = $1
         WHERE reparto_ejecutado_item_id = $2 AND producto_id = $3`,
        [prod.cantidad_real, itemId, prod.producto_id]
      );
    }
  }

  return obtenerItemEjecucion(itemId);
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