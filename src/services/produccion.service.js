// src/services/produccion.service.js
const db = require('../config/db');

const TIPOS = ['fabricacion', 'ajuste_positivo', 'ajuste_negativo'];
const ORDENES = {
  fecha_desc: 'pr.fecha DESC, pr.created_at DESC',
  fecha_asc: 'pr.fecha ASC, pr.created_at ASC',
  cantidad_desc: 'pr.cantidad DESC, pr.fecha DESC',
  cantidad_asc: 'pr.cantidad ASC, pr.fecha DESC',
};

function bad(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}

async function registrar({ propietarioId, createdBy, producto_id, tipo = 'fabricacion', cantidad, fecha, notas }) {
  if (!TIPOS.includes(tipo)) throw bad(`tipo debe ser uno de: ${TIPOS.join(', ')}`);
  if (!producto_id) throw bad('producto_id es requerido');
  if (!(Number(cantidad) > 0)) throw bad('La cantidad debe ser mayor a 0');

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: prod } = await client.query(
      'SELECT id, nombre FROM productos WHERE id = $1 AND propietario_id = $2 FOR UPDATE',
      [producto_id, propietarioId]
    );
    if (prod.length === 0) {
      throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
    }

    let productoRows;
    if (tipo === 'ajuste_negativo') {
      ({ rows: productoRows } = await client.query(
        `UPDATE productos SET stock_actual = stock_actual - $1
         WHERE id = $2 AND propietario_id = $3 AND stock_actual >= $1 RETURNING *`,
        [cantidad, producto_id, propietarioId]
      ));
      if (productoRows.length === 0) {
        const { rows } = await client.query('SELECT stock_actual FROM productos WHERE id = $1', [producto_id]);
        throw bad(`No se puede descontar ${cantidad}: stock actual de "${prod[0].nombre}" es ${Number(rows[0].stock_actual)}`);
      }
    } else {
      ({ rows: productoRows } = await client.query(
        `UPDATE productos SET stock_actual = stock_actual + $1
         WHERE id = $2 AND propietario_id = $3 RETURNING *`,
        [cantidad, producto_id, propietarioId]
      ));
    }

    const { rows: regRows } = await client.query(
      `INSERT INTO produccion (propietario_id, producto_id, tipo, cantidad, fecha, notas, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7) RETURNING *`,
      [propietarioId, producto_id, tipo, cantidad, fecha || null, notas || null, createdBy]
    );

    await client.query('COMMIT');
    return { registro: regRows[0], producto: productoRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listar({ propietarioId, producto_id, tipo, desde, hasta, orden, limit, offset }) {
  const base = ['pr.propietario_id = $1'];
  const valores = [propietarioId];
  if (producto_id) { valores.push(producto_id); base.push(`pr.producto_id = $${valores.length}`); }
  if (desde) { valores.push(desde); base.push(`pr.fecha >= $${valores.length}`); }
  if (hasta) { valores.push(hasta); base.push(`pr.fecha <= $${valores.length}`); }

  // Resumen por producto del período (ignora el filtro 'tipo' y la paginación)
  const { rows: resumenRows } = await db.query(
    `SELECT pr.producto_id, p.nombre AS producto_nombre,
       COALESCE(SUM(pr.cantidad) FILTER (WHERE pr.tipo = 'fabricacion'), 0) AS fabricado,
       COALESCE(SUM(pr.cantidad) FILTER (WHERE pr.tipo = 'ajuste_positivo'), 0) AS ajustes_positivos,
       COALESCE(SUM(pr.cantidad) FILTER (WHERE pr.tipo = 'ajuste_negativo'), 0) AS ajustes_negativos
     FROM produccion pr JOIN productos p ON p.id = pr.producto_id
     WHERE ${base.join(' AND ')}
     GROUP BY pr.producto_id, p.nombre
     ORDER BY fabricado DESC`,
    valores
  );
  const resumen = resumenRows.map((r) => ({
    producto_id: r.producto_id,
    producto_nombre: r.producto_nombre,
    fabricado: Number(r.fabricado),
    ajustes_positivos: Number(r.ajustes_positivos),
    ajustes_negativos: Number(r.ajustes_negativos),
  }));

  const condiciones = [...base];
  const valoresLista = [...valores];
  if (TIPOS.includes(tipo)) { valoresLista.push(tipo); condiciones.push(`pr.tipo = $${valoresLista.length}`); }
  const where = condiciones.join(' AND ');

  const { rows: countRows } = await db.query(`SELECT COUNT(*) AS total FROM produccion pr WHERE ${where}`, valoresLista);

  let query = `
    SELECT pr.*, p.nombre AS producto_nombre
    FROM produccion pr JOIN productos p ON p.id = pr.producto_id
    WHERE ${where}
    ORDER BY ${ORDENES[orden] || ORDENES.fecha_desc}`;
  if (limit !== undefined) { valoresLista.push(limit); query += ` LIMIT $${valoresLista.length}`; }
  if (offset !== undefined) { valoresLista.push(offset); query += ` OFFSET $${valoresLista.length}`; }

  const { rows } = await db.query(query, valoresLista);

  return {
    registros: rows.map((r) => ({ ...r, cantidad: Number(r.cantidad) })),
    total: Number(countRows[0].total),
    resumen,
    totales: {
      fabricado: resumen.reduce((a, r) => a + r.fabricado, 0),
      ajustes_positivos: resumen.reduce((a, r) => a + r.ajustes_positivos, 0),
      ajustes_negativos: resumen.reduce((a, r) => a + r.ajustes_negativos, 0),
    },
  };
}

module.exports = { registrar, listar };