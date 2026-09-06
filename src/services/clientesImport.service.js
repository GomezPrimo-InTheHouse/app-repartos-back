// src/services/clientesImport.service.js
const XLSX = require('xlsx');
const db = require('../config/db');
const { env } = require('../config/env');

function leerExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const primeraHoja = workbook.SheetNames[0];
  if (!primeraHoja) {
    throw Object.assign(new Error('El archivo no tiene hojas'), { status: 400 });
  }
  const hoja = workbook.Sheets[primeraHoja];

  // header: 1 => devuelve arrays por fila (posición de columna), no objetos por nombre de columna.
  // Necesario acá porque este tipo de planilla suele tener títulos de sección y encabezados
  // repetidos a mitad de la hoja, lo que rompe el mapeo automático por nombre de columna.
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });

  // Filtra filas completamente vacías antes de mandarlas a la IA (ahorra tokens)
  return filas.filter((fila) => fila.some((celda) => celda !== null && String(celda).trim() !== ''));
}

function construirPrompt(filasCrudas) {
  return `
Sos un asistente que extrae datos de CLIENTES ÚNICOS a partir de una planilla de control de repartos
de una sodería. La planilla NO es una lista limpia de clientes: es un registro diario de reparto,
con estas características que tenés que tener en cuenta:

- Está organizada en SECCIONES POR DÍA (ej: filas con solo el texto "JUEVES 13/08" o "VIERNES 14/08"
  a modo de título de sección). Esas filas NO son clientes, ignoralas.
- El encabezado de columnas (algo como CLIENTE, DIRECCIÓN, N°, BARRIO, CIUDAD, SODA, AGUA X 12,
  AGUA X 20, $ COBRADO, OBSERVACIONES) puede aparecer REPETIDO varias veces a lo largo de la planilla,
  una vez por cada sección de día. Esas filas de encabezado NO son clientes, ignoralas.
- Al final de cada sección o de la planilla puede haber filas de TOTALES o RESÚMENES
  (ej: "TOTAL COBRADO JUEVES 13/08", "RESUMEN GENERAL", "Total Efectivo (Registrado)").
  Esas filas NO son clientes, ignoralas.
- El MISMO CLIENTE puede aparecer en más de una sección de día (una fila por cada día que se le
  repartió). Vos tenés que devolver cada cliente **una sola vez** en tu respuesta final — si aparece
  varias veces, quedate con los datos más completos que encuentres entre todas sus apariciones
  (ej: si en una fila falta el barrio pero en otra aparición del mismo cliente sí está, usá el que
  tiene el dato).
- Las columnas de cantidades (SODA, AGUA X 12, AGUA X 20) y de cobro ($ COBRADO) y observaciones
  del día NO te interesan para esta tarea — ignoralas completamente, no las incluyas en tu respuesta.

De cada fila de cliente real, extraé SOLO estos datos:
- nombre: el nombre del cliente (columna CLIENTE)
- direccion: combiná la columna de dirección con el número de puerta si están en columnas separadas
  (ej: "MEXICO" + "318" → "MEXICO 318"). Si no hay número, usá solo la calle.
- barrio: la columna BARRIO tal cual, o null si no está
- localidad: la columna CIUDAD, pero NORMALIZANDO variantes obvias de la misma ciudad a un solo
  valor consistente (ej: "V. MARIA", "V MARIA", "V.MARIA" son todas la misma ciudad, elegí una
  forma consistente y usala siempre, como "Villa María"). Si no hay dato, null.

Respondé EXCLUSIVAMENTE con un array JSON válido, empezando directo con "[" y terminando con "]".
Nada de texto antes ni después, nada de markdown. Cada elemento debe tener EXACTAMENTE estas claves:
{ "nombre": string, "direccion": string o null, "barrio": string o null, "localidad": string o null }

No incluyas ningún elemento sin nombre identificable. No repitas el mismo cliente dos veces.

Filas crudas de la planilla (array de arrays, cada sub-array es una fila, en el orden original):
${JSON.stringify(filasCrudas)}
`.trim();
}

function extraerJsonDeTexto(texto) {
  const inicio = texto.indexOf('[');
  const fin = texto.lastIndexOf(']');

  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw Object.assign(
      new Error('La IA no devolvió un JSON válido, reintentá o revisá el archivo'),
      { status: 502 }
    );
  }

  const posibleJson = texto.slice(inicio, fin + 1);
  return JSON.parse(posibleJson);
}

async function interpretarConIA(filasCrudas) {
  if (!env.anthropicApiKey) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY no configurada en el servidor'), { status: 500 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: construirPrompt(filasCrudas) }],
    }),
  });

  if (!response.ok) {
    const errorTexto = await response.text();
    throw Object.assign(new Error(`Error al consultar la IA: ${errorTexto}`), { status: 502 });
  }

  const data = await response.json();

  if (data.stop_reason === 'max_tokens') {
    throw Object.assign(
      new Error('La respuesta de la IA se cortó por exceder el límite de tokens. Probá con un archivo con menos filas.'),
      { status: 502 }
    );
  }

  const textoRespuesta = data.content?.[0]?.text || '';

  try {
    return extraerJsonDeTexto(textoRespuesta);
  } catch (err) {
    if (!env.isProduction) {
      console.error('Respuesta cruda de la IA (no parseable):', textoRespuesta);
    }
    throw err;
  }
}

function normalizarNombre(nombre) {
  return String(nombre).trim().toUpperCase().replace(/\s+/g, ' ');
}

async function importar({ propietarioId, buffer, createdBy }) {
  const filasCrudas = leerExcel(buffer);

  if (filasCrudas.length === 0) {
    throw Object.assign(new Error('El archivo no tiene filas de datos'), { status: 400 });
  }
  if (filasCrudas.length > 200) {
    throw Object.assign(
      new Error('Máximo 200 filas por archivo — dividí el Excel en partes más chicas'),
      { status: 400 }
    );
  }

  const clientesExtraidos = await interpretarConIA(filasCrudas);

  // Clientes ya existentes en la base (para no duplicar contra lo que ya estaba cargado)
  const { rows: existentes } = await db.query(
    'SELECT nombre FROM clientes WHERE propietario_id = $1',
    [propietarioId]
  );
  const nombresExistentes = new Set(existentes.map((c) => normalizarNombre(c.nombre)));

  const vistosEnEsteArchivo = new Set();
  const creados = [];
  const omitidos = [];

  for (const cliente of clientesExtraidos) {
    const nombre = cliente?.nombre ? String(cliente.nombre).trim() : '';

    if (!nombre) {
      omitidos.push({ fila: cliente, motivo: 'Sin nombre identificable' });
      continue;
    }

    const clave = normalizarNombre(nombre);

    if (nombresExistentes.has(clave)) {
      omitidos.push({ fila: cliente, motivo: 'Ya existe un cliente con ese nombre en tu base' });
      continue;
    }

    if (vistosEnEsteArchivo.has(clave)) {
      omitidos.push({ fila: cliente, motivo: 'Duplicado dentro del mismo archivo' });
      continue;
    }
    vistosEnEsteArchivo.add(clave);

    try {
      const { rows } = await db.query(
        `INSERT INTO clientes (propietario_id, nombre, direccion, barrio, localidad, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre`,
        [propietarioId, nombre, cliente.direccion || null, cliente.barrio || null, cliente.localidad || null, createdBy]
      );
      creados.push(rows[0]);
    } catch (err) {
      omitidos.push({ fila: cliente, motivo: `Error al guardar: ${err.message}` });
    }
  }

  return { totalFilasLeidas: filasCrudas.length, creados, omitidos };
}

module.exports = { importar };