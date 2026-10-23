// src/services/geolocalizacion.service.js
// Módulo opcional Geolocalización: ubicación de clientes en el mapa y última posición de cada empleado.
const db = require('../config/db');

const ORIGENES = ['manual', 'gps'];

function errorHttp(mensaje, status) {
  return Object.assign(new Error(mensaje), { status });
}

// Valida un par lat/lng. Devuelve números o lanza 400. (0,0) se rechaza: es el valor típico de un GPS sin señal.
function validarCoordenadas(latitud, longitud) {
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (latitud === null || latitud === undefined || longitud === null || longitud === undefined
      || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw errorHttp('latitud y longitud son requeridas y deben ser números', 400);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw errorHttp('Coordenadas fuera de rango', 400);
  }
  if (lat === 0 && lng === 0) {
    throw errorHttp('Ubicación inválida (0, 0): el GPS todavía no tiene señal', 400);
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function aNumero(valor) {
  return valor === null || valor === undefined ? null : Number(valor);
}

// Clientes activos con su ubicación y saldo (despachos entregados - pagos activos, RN-01).
// Con listaId: solo los de esa lista, en su orden de visita.
async function listarClientes({ propietarioId, listaId }) {
  const { rows: listas } = await db.query(
    `SELECT id, nombre, tipo, dias_semana, fecha
     FROM listas_reparto
     WHERE propietario_id = $1 AND activa = true
     ORDER BY nombre`,
    [propietarioId]
  );

  if (listaId && !listas.some((l) => String(l.id) === String(listaId))) {
    throw errorHttp('Lista de reparto no encontrada', 404);
  }

  const valores = [propietarioId];
  let joinLista = '';
  let orden = 'c.nombre';
  let columnaOrden = 'NULL::int AS orden';
  if (listaId) {
    valores.push(listaId);
    joinLista = 'JOIN lista_reparto_items lri ON lri.cliente_id = c.id AND lri.lista_reparto_id = $2';
    orden = 'lri.orden, c.nombre';
    columnaOrden = 'lri.orden';
  }

  const { rows } = await db.query(
    `SELECT
       c.id, c.nombre, c.direccion, c.barrio, c.limite_credito, c.porcentaje_aumento,
       c.latitud, c.longitud, c.ubicacion_origen, c.ubicacion_actualizada_at,
       COALESCE(d.total, 0) - COALESCE(pg.total, 0) AS saldo,
       ${columnaOrden}
     FROM clientes c
     ${joinLista}
     LEFT JOIN (
       SELECT cliente_id, SUM(total) AS total FROM despachos
       WHERE propietario_id = $1 AND estado = 'entregado' GROUP BY cliente_id
     ) d ON d.cliente_id = c.id
     LEFT JOIN (
       SELECT cliente_id, SUM(monto) AS total FROM pagos
       WHERE propietario_id = $1 AND estado = 'activo' GROUP BY cliente_id
     ) pg ON pg.cliente_id = c.id
     WHERE c.propietario_id = $1 AND c.activo = true
     ORDER BY ${orden}`,
    valores
  );

  const clientes = rows.map((r) => ({
    ...r,
    latitud: aNumero(r.latitud),
    longitud: aNumero(r.longitud),
    limite_credito: aNumero(r.limite_credito),
    porcentaje_aumento: aNumero(r.porcentaje_aumento) ?? 0,
    saldo: Number(r.saldo),
  }));

  return { listas, clientes };
}

// Guarda (o quita, con latitud y longitud en null) la ubicación de un cliente.
async function actualizarUbicacionCliente(propietarioId, clienteId, { latitud, longitud, origen }) {
  let lat = null;
  let lng = null;
  let origenFinal = null;

  const quitar = latitud === null && longitud === null;
  if (!quitar) {
    ({ lat, lng } = validarCoordenadas(latitud, longitud));
    origenFinal = ORIGENES.includes(origen) ? origen : 'manual';
  }

  const { rows } = await db.query(
    `UPDATE clientes
     SET latitud = $1, longitud = $2, ubicacion_origen = $3,
         ubicacion_actualizada_at = CASE WHEN $1::numeric IS NULL THEN NULL ELSE now() END
     WHERE id = $4 AND propietario_id = $5
     RETURNING id, nombre, latitud, longitud, ubicacion_origen, ubicacion_actualizada_at`,
    [lat, lng, origenFinal, clienteId, propietarioId]
  );
  if (rows.length === 0) throw errorHttp('Cliente no encontrado', 404);

  const r = rows[0];
  return { ...r, latitud: aNumero(r.latitud), longitud: aNumero(r.longitud) };
}

// Última posición del usuario logueado: una fila por usuario, se pisa en cada envío.
async function registrarMiUbicacion({ userId, propietarioId, latitud, longitud, precision }) {
  const { lat, lng } = validarCoordenadas(latitud, longitud);
  const precisionM = Number.isFinite(Number(precision)) && Number(precision) >= 0
    ? Math.min(Number(precision), 9999999)
    : null;

  await db.query(
    `INSERT INTO ubicaciones_empleados (profile_id, propietario_id, latitud, longitud, precision_m, registrada_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (profile_id) DO UPDATE
       SET propietario_id = EXCLUDED.propietario_id,
           latitud = EXCLUDED.latitud,
           longitud = EXCLUDED.longitud,
           precision_m = EXCLUDED.precision_m,
           registrada_at = now()`,
    [userId, propietarioId, lat, lng, precisionM]
  );
  return { ok: true };
}

// Empleados activos de la empresa con su última ubicación (null si nunca abrió la app con el módulo activo).
async function listarRepartidores(propietarioId) {
  const { rows } = await db.query(
    `SELECT p.id, p.nombre_completo, p.rol,
            ue.latitud, ue.longitud, ue.precision_m, ue.registrada_at
     FROM profiles p
     LEFT JOIN ubicaciones_empleados ue ON ue.profile_id = p.id AND ue.propietario_id = p.propietario_id
     WHERE p.propietario_id = $1 AND p.activo = true
     ORDER BY ue.registrada_at DESC NULLS LAST, p.nombre_completo`,
    [propietarioId]
  );
  return rows.map((r) => ({
    ...r,
    latitud: aNumero(r.latitud),
    longitud: aNumero(r.longitud),
    precision_m: aNumero(r.precision_m),
  }));
}

module.exports = {
  listarClientes,
  actualizarUbicacionCliente,
  registrarMiUbicacion,
  listarRepartidores,
};