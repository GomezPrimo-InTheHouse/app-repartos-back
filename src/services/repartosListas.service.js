
// src/services/repartosListas.service.js
const db = require('../config/db');

async function obtenerRaw(propietarioId, id) {
  const { rows } = await db.query(
    'SELECT * FROM listas_reparto WHERE id = $1 AND propietario_id = $2',
    [id, propietarioId]
  );
  return rows[0] || null;
}

async function listar({ propietarioId, tipo, activa }) {
  const condiciones = ['propietario_id = $1'];
  const valores = [propietarioId];

  if (tipo) {
    valores.push(tipo);
    condiciones.push(`tipo = $${valores.length}`);
  }
  if (activa !== undefined) {
    valores.push(activa);
    condiciones.push(`activa = $${valores.length}`);
  }

  const { rows } = await db.query(
    `SELECT * FROM listas_reparto WHERE ${condiciones.join(' AND ')} ORDER BY nombre`,
    valores
  );
  return rows;
}

async function obtenerPorId(propietarioId, id) {
  const lista = await obtenerRaw(propietarioId, id);
  if (!lista) return null;

  const { rows: items } = await db.query(
    `SELECT lri.id, lri.cliente_id, c.nombre AS cliente_nombre, lri.orden,
       COALESCE(
         json_agg(
           json_build_object(
             'producto_id', lrip.producto_id,
             'producto_nombre', p.nombre,
             'cantidad_estimada', lrip.cantidad_estimada
           ) ORDER BY p.nombre
         ) FILTER (WHERE lrip.id IS NOT NULL), '[]'
       ) AS productos
     FROM lista_reparto_items lri
     JOIN clientes c ON c.id = lri.cliente_id
     LEFT JOIN lista_reparto_item_productos lrip ON lrip.lista_reparto_item_id = lri.id
     LEFT JOIN productos p ON p.id = lrip.producto_id
     WHERE lri.lista_reparto_id = $1
     GROUP BY lri.id, c.nombre
     ORDER BY lri.orden, c.nombre`,
    [id]
  );

  return { ...lista, items };
}

async function insertarItemsConProductos(client, listaId, items) {
  for (const [index, item] of items.entries()) {
    const { rows: itemRows } = await client.query(
      `INSERT INTO lista_reparto_items (lista_reparto_id, cliente_id, orden) VALUES ($1, $2, $3) RETURNING id`,
      [listaId, item.cliente_id, item.orden ?? index]
    );
    const itemId = itemRows[0].id;

    for (const prod of item.productos || []) {
      if (!(Number(prod.cantidad_estimada) > 0)) {
        throw Object.assign(new Error('cantidad_estimada debe ser mayor a 0'), { status: 400 });
      }
      await client.query(
        `INSERT INTO lista_reparto_item_productos (lista_reparto_item_id, producto_id, cantidad_estimada)
         VALUES ($1, $2, $3)`,
        [itemId, prod.producto_id, prod.cantidad_estimada]
      );
    }
  }
}

async function crear({ propietarioId, nombre, tipo, dia_semana, fecha, items, createdBy }) {
  if (!['semanal', 'unica'].includes(tipo)) {
    throw Object.assign(new Error("tipo debe ser 'semanal' o 'unica'"), { status: 400 });
  }
  if (tipo === 'semanal' && !dia_semana) {
    throw Object.assign(new Error('dia_semana es requerido para listas semanales'), { status: 400 });
  }
  if (tipo === 'unica' && !fecha) {
    throw Object.assign(new Error('fecha es requerida para listas únicas'), { status: 400 });
  }

  const client = await db.getClient();
  let listaId;
  try {
    await client.query('BEGIN');

    const { rows: listaRows } = await client.query(
      `INSERT INTO listas_reparto (propietario_id, nombre, tipo, dia_semana, fecha, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        propietarioId,
        nombre,
        tipo,
        tipo === 'semanal' ? dia_semana : null,
        tipo === 'unica' ? fecha : null,
        createdBy,
      ]
    );
    listaId = listaRows[0].id;

    if (Array.isArray(items) && items.length > 0) {
      await insertarItemsConProductos(client, listaId, items);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return obtenerPorId(propietarioId, listaId);
}

async function actualizar(propietarioId, id, campos) {
  const actual = await obtenerRaw(propietarioId, id);
  if (!actual) return null;

  const nuevoTipo = campos.tipo ?? actual.tipo;
  if (!['semanal', 'unica'].includes(nuevoTipo)) {
    throw Object.assign(new Error("tipo debe ser 'semanal' o 'unica'"), { status: 400 });
  }

  let nuevoDia = actual.dia_semana;
  let nuevaFecha = actual.fecha;

  if (nuevoTipo !== actual.tipo) {
    if (nuevoTipo === 'semanal') {
      if (!campos.dia_semana) {
        throw Object.assign(new Error('dia_semana es requerido al convertir a semanal'), { status: 400 });
      }
      nuevoDia = campos.dia_semana;
      nuevaFecha = null;
    } else {
      if (!campos.fecha) {
        throw Object.assign(new Error('fecha es requerida al convertir a unica'), { status: 400 });
      }
      nuevaFecha = campos.fecha;
      nuevoDia = null;
    }
  } else {
    if (nuevoTipo === 'semanal' && campos.dia_semana !== undefined) nuevoDia = campos.dia_semana;
    if (nuevoTipo === 'unica' && campos.fecha !== undefined) nuevaFecha = campos.fecha;
  }

  const nombre = campos.nombre ?? actual.nombre;
  const activa = campos.activa ?? actual.activa;

  const { rows } = await db.query(
    `UPDATE listas_reparto SET nombre = $1, tipo = $2, dia_semana = $3, fecha = $4, activa = $5
     WHERE id = $6 AND propietario_id = $7
     RETURNING *`,
    [nombre, nuevoTipo, nuevoDia, nuevaFecha, activa, id, propietarioId]
  );
  return rows[0];
}

async function eliminar(propietarioId, id) {
  const { rows } = await db.query(
    'UPDATE listas_reparto SET activa = false WHERE id = $1 AND propietario_id = $2 RETURNING id',
    [id, propietarioId]
  );
  return rows[0] || null;
}

async function agregarItem(propietarioId, listaId, { cliente_id, orden, productos }) {
  const lista = await obtenerRaw(propietarioId, listaId);
  if (!lista) {
    throw Object.assign(new Error('Lista no encontrada'), { status: 404 });
  }

  const client = await db.getClient();
  let itemId;
  try {
    await client.query('BEGIN');

    const { rows: itemRows } = await client.query(
      `INSERT INTO lista_reparto_items (lista_reparto_id, cliente_id, orden) VALUES ($1, $2, $3) RETURNING id`,
      [listaId, cliente_id, orden ?? 0]
    );
    itemId = itemRows[0].id;

    for (const prod of productos || []) {
      if (!(Number(prod.cantidad_estimada) > 0)) {
        throw Object.assign(new Error('cantidad_estimada debe ser mayor a 0'), { status: 400 });
      }
      await client.query(
        `INSERT INTO lista_reparto_item_productos (lista_reparto_item_id, producto_id, cantidad_estimada)
         VALUES ($1, $2, $3)`,
        [itemId, prod.producto_id, prod.cantidad_estimada]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return itemId;
}

async function editarItemProductos(propietarioId, listaId, itemId, productos) {
  const { rows: check } = await db.query(
    `SELECT lri.id FROM lista_reparto_items lri
     JOIN listas_reparto lr ON lr.id = lri.lista_reparto_id
     WHERE lri.id = $1 AND lri.lista_reparto_id = $2 AND lr.propietario_id = $3`,
    [itemId, listaId, propietarioId]
  );
  if (check.length === 0) {
    throw Object.assign(new Error('Item no encontrado'), { status: 404 });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM lista_reparto_item_productos WHERE lista_reparto_item_id = $1', [itemId]);

    for (const prod of productos) {
      if (!(Number(prod.cantidad_estimada) > 0)) {
        throw Object.assign(new Error('cantidad_estimada debe ser mayor a 0'), { status: 400 });
      }
      await client.query(
        `INSERT INTO lista_reparto_item_productos (lista_reparto_item_id, producto_id, cantidad_estimada)
         VALUES ($1, $2, $3)`,
        [itemId, prod.producto_id, prod.cantidad_estimada]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function eliminarItem(propietarioId, listaId, itemId) {
  const { rows: check } = await db.query(
    `SELECT lri.id FROM lista_reparto_items lri
     JOIN listas_reparto lr ON lr.id = lri.lista_reparto_id
     WHERE lri.id = $1 AND lri.lista_reparto_id = $2 AND lr.propietario_id = $3`,
    [itemId, listaId, propietarioId]
  );
  if (check.length === 0) return null;

  await db.query('DELETE FROM lista_reparto_items WHERE id = $1', [itemId]);
  return { id: itemId };
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  agregarItem,
  editarItemProductos,
  eliminarItem,
};