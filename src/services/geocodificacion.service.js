// src/services/geocodificacion.service.js
// Búsqueda de direcciones con Nominatim (OpenStreetMap), centralizada en el back para cumplir su
// política de uso: https://operations.osmfoundation.org/policies/nominatim/
//   - máximo 1 pedido por segundo para TODA la aplicación (cola global),
//   - identificar la aplicación con un User-Agent propio,
//   - no usarlo como autocompletar mientras se escribe (el front busca solo al confirmar),
//   - cachear resultados repetidos.
const db = require('../config/db');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Contacto opcional para Nominatim (lo recomiendan): variable de entorno NOMINATIM_CONTACTO, ej. un email del proyecto.
const USER_AGENT = `Cuaderno-app-repartos/1.0${process.env.NOMINATIM_CONTACTO ? ` (${process.env.NOMINATIM_CONTACTO})` : ''}`;
const INTERVALO_MS = 1100; // un poco más de 1 s entre pedidos
const TIMEOUT_MS = 8000;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOCALIDAD_POR_DEFECTO = 'Villa María';

function errorHttp(mensaje, status) {
  return Object.assign(new Error(mensaje), { status });
}

// ---- Cola global: un pedido a Nominatim por vez, separados por INTERVALO_MS ----
let ultimaLlamada = 0;
let cola = Promise.resolve();

function enCola(tarea) {
  const resultado = cola.then(async () => {
    const espera = ultimaLlamada + INTERVALO_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaLlamada = Date.now();
    return tarea();
  });
  cola = resultado.catch(() => {}); // un error no traba la cola
  return resultado;
}

// ---- Caché en memoria (se pierde al reiniciar el servidor; alcanza para búsquedas repetidas) ----
const cache = new Map();

function leerCache(clave) {
  const entrada = cache.get(clave);
  if (!entrada) return null;
  if (Date.now() - entrada.guardado > CACHE_TTL_MS) {
    cache.delete(clave);
    return null;
  }
  return entrada.valor;
}

function guardarCache(clave, valor) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // descarta la más vieja
  cache.set(clave, { valor, guardado: Date.now() });
}

// Localidad a usar si el pedido no trae una: la más común entre los clientes de la empresa.
async function localidadPorDefecto(propietarioId) {
  const { rows } = await db.query(
    `SELECT trim(localidad) AS localidad
     FROM clientes
     WHERE propietario_id = $1 AND activo = true AND nullif(trim(localidad), '') IS NOT NULL
     GROUP BY trim(localidad)
     ORDER BY count(*) DESC
     LIMIT 1`,
    [propietarioId]
  );
  return rows[0]?.localidad || LOCALIDAD_POR_DEFECTO;
}

// Arma el texto de un resultado: "Bolívar 1313, Barrio Rivadavia, Villa María"
function etiquetaDe(r) {
  const a = r.address ?? {};
  const calle = [a.road, a.house_number].filter(Boolean).join(' ');
  const barrio = a.suburb || a.neighbourhood || a.quarter;
  const ciudad = a.city || a.town || a.village || a.municipality;
  const partes = [calle || r.name, barrio, ciudad].filter(Boolean);
  return partes.length ? [...new Set(partes)].join(', ') : r.display_name;
}

/**
 * Busca una dirección dentro de una localidad (Argentina). Devuelve hasta 5 resultados:
 * { latitud, longitud, etiqueta, exacta } — exacta = false si OSM no tiene la altura y
 * devolvió la calle o el barrio en general (el pin hay que ajustarlo a mano).
 */
async function buscarDireccion({ propietarioId, direccion, localidad }) {
  const texto = String(direccion ?? '').trim();
  if (texto.length < 3) throw errorHttp('Escribí una dirección (al menos 3 caracteres)', 400);
  if (texto.length > 200) throw errorHttp('La dirección es demasiado larga', 400);

  const ciudad = String(localidad ?? '').trim() || (await localidadPorDefecto(propietarioId));
  const consulta = `${texto}, ${ciudad}`;
  const clave = consulta.toLowerCase().replace(/\s+/g, ' ');

  const enCache = leerCache(clave);
  if (enCache) return { localidad: ciudad, resultados: enCache };

  const params = new URLSearchParams({
    q: consulta,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ar',
    'accept-language': 'es',
  });

  const datos = await enCola(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw errorHttp('El buscador de direcciones no respondió. Probá de nuevo en un momento o marcá el punto en el mapa.', 502);
      }
      return res.json();
    } catch (err) {
      if (err.status) throw err;
      throw errorHttp('No se pudo conectar con el buscador de direcciones. Marcá el punto en el mapa.', 502);
    } finally {
      clearTimeout(timer);
    }
  });

  const resultados = (Array.isArray(datos) ? datos : [])
    .map((r) => ({
      latitud: Number(Number(r.lat).toFixed(6)),
      longitud: Number(Number(r.lon).toFixed(6)),
      etiqueta: etiquetaDe(r),
      exacta: Boolean(r.address?.house_number),
    }))
    .filter((r) => Number.isFinite(r.latitud) && Number.isFinite(r.longitud));

  guardarCache(clave, resultados);
  return { localidad: ciudad, resultados };
}

module.exports = { buscarDireccion, localidadPorDefecto };