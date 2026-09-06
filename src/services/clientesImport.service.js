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

  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });
  return filas.filter((fila) => fila.some((celda) => celda !== null && String(celda).trim() !== ''));
}

// Saca filas basura ANTES de gastar tokens de IA: encabezados repetidos, totales/resúmenes,
// y filas título de sección (una sola celda con contenido).
function filtrarFilasUtiles(filas) {
  return filas.filter((fila) => {
    const celdasConTexto = fila
      .filter((c) => c !== null && String(c).trim() !== '')
      .map((c) => String(c).trim().toUpperCase());

    if (celdasConTexto.length <= 1) return false; // fila título de sección
    if (celdasConTexto.includes('CLIENTE')) return false; // encabezado repetido
    if (celdasConTexto[0].includes('TOTAL') || celdasConTexto[0].includes('RESUMEN')) return false;

    return true;
  });
}

function construirPrompt(filasCrudas) {
  return `
Sos un asistente que extrae datos de CLIENTES ÚNICOS a partir de filas de una planilla de reparto
de una sodería (ya se sacaron encabezados repetidos, títulos de sección y totales, así que estas
filas deberían ser todas de clientes reales, pero puede quedar alguna excepción).

El MISMO CLIENTE puede aparecer más de una vez (reparto de distintos días). Devolvé cada cliente
UNA SOLA VEZ, combinando los datos más completos que encuentres entre sus apariciones.

De cada fila, extraé SOLO:
- nombre: nombre del cliente
- direccion: calle + número combinados si están en columnas separadas
- barrio: tal cual aparece, o null
- localidad: la ciudad, normalizando variantes obvias a una sola forma (ej: "V. MARIA" / "V MARIA" / "V.MARIA" → "Villa María"). null si no hay dato.

Ignorá completamente cualquier columna de cantidades, montos cobrados u observaciones del día.
Si una fila no parece ser un cliente real (ej. quedó algún total o resumen sin filtrar), no la incluyas.

Respondé EXCLUSIVAMENTE con un array JSON, empezando con "[" y terminando con "]", sin texto
adicional ni markdown. Cada elemento: { "nombre": string, "direccion": string|null, "barrio": string|null, "localidad": string|null }

Filas (array de arrays):
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

  return JSON.parse(texto.slice(inicio, fin + 1));
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
      max_tokens: 16000,
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

  const filasUtiles = filtrarFilasUtiles(filasCrudas);

  if (filasUtiles.length === 0) {
    throw Object.assign(new Error('No se encontraron filas de clientes después de filtrar encabezados/totales'), { status: 400 });
  }
  if (filasUtiles.length > 300) {
    throw Object.assign(
      new Error('Máximo 300 filas útiles por archivo — dividí el Excel en partes más chicas'),
      { status: 400 }
    );
  }

  const clientesExtraidos = await interpretarConIA(filasUtiles);

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

  return {
    totalFilasLeidas: filasCrudas.length,
    totalFilasUtiles: filasUtiles.length,
    creados,
    omitidos,
  };
}

module.exports = { importar };