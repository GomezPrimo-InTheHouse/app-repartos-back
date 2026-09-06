// src/services/clientesImport.service.js
const XLSX = require('xlsx');
const db = require('../config/db');
const { env } = require('../config/env');

const SINONIMOS_COLUMNAS = {
  nombre: ['NOMBRE DEL CLIENTE', 'NOMBRE', 'CLIENTE'],
  direccion: ['DIRECCIÓN', 'DIRECCION', 'DOMICILIO'],
  numero: ['N°', 'NRO', 'NUMERO', 'NÚMERO'],
  barrio: ['BARRIO'],
  localidad: ['CIUDAD', 'LOCALIDAD'],
};

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

// Busca, en las primeras filas, una que tenga columnas reconocibles de nombre Y dirección.
// Si la encuentra, todo el resto se puede procesar sin IA (determinístico).
function detectarEncabezado(filas) {
  for (let i = 0; i < Math.min(filas.length, 10); i++) {
    const celdas = filas[i].map((c) => (c === null ? '' : String(c).trim().toUpperCase()));
    const indices = {};

    for (const [campo, sinonimos] of Object.entries(SINONIMOS_COLUMNAS)) {
      const idx = celdas.findIndex((c) => sinonimos.some((s) => c === s || c.includes(s)));
      if (idx !== -1) indices[campo] = idx;
    }

    if (indices.nombre !== undefined && indices.direccion !== undefined) {
      return { filaIndice: i, indices };
    }
  }
  return null;
}

function esFilaDeEncabezadoRepetido(valorCelda) {
  if (!valorCelda) return false;
  const texto = String(valorCelda).trim().toUpperCase();
  return SINONIMOS_COLUMNAS.nombre.includes(texto);
}

// Si al dividir una dirección quedan partes que son solo un número ("2665"),
// le "hereda" el nombre de calle de la parte anterior completa ("PERU 2655" -> calle "PERU").
function completarCalleEnPartes(partes) {
  let calleBase = null;
  return partes.map((parte) => {
    const soloNumero = /^\d+$/.test(parte);
    if (soloNumero && calleBase) {
      return `${calleBase} ${parte}`;
    }
    const match = parte.match(/^(.*?)(\d+)\s*$/);
    calleBase = match ? match[1].trim() : parte;
    return parte;
  });
}

function combinarDireccion(direccion, numero) {
  const partes = [direccion, numero].filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  return partes.length > 0 ? partes.map((p) => String(p).trim()).join(' ') : null;
}

function normalizarLocalidad(texto) {
  if (!texto) return null;
  // Normaliza puntuación/espacios (ej: "V.MARIA" / "V. MARIA" / "V  MARIA" -> "V MARIA")
  // No expande abreviaturas (eso sí requeriría criterio/IA) — solo unifica formato.
  return String(texto).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

// Extracción 100% determinística cuando hay encabezado reconocible: sin IA, sin tokens.
function extraerClientesDeterministico(filas, header) {
  const { filaIndice, indices } = header;
  const creados = [];
  const omitidos = [];
  const divididas = [];

  for (let i = filaIndice + 1; i < filas.length; i++) {
    const fila = filas[i];
    const nombreCelda = fila[indices.nombre];

    if (!nombreCelda || String(nombreCelda).trim() === '') continue;
    if (esFilaDeEncabezadoRepetido(nombreCelda)) continue;

    const nombreTexto = String(nombreCelda).trim();
    if (nombreTexto.toUpperCase().startsWith('TOTAL') || nombreTexto.toUpperCase().startsWith('RESUMEN')) continue;

    const direccionCelda = indices.direccion !== undefined ? fila[indices.direccion] : null;
    const numeroCelda = indices.numero !== undefined ? fila[indices.numero] : null;
    const barrioCelda = indices.barrio !== undefined ? fila[indices.barrio] : null;
    const localidadCelda = indices.localidad !== undefined ? fila[indices.localidad] : null;

    const direccionTexto = direccionCelda ? String(direccionCelda).trim() : '';
    const partesNombre = nombreTexto.split('/').map((s) => s.trim()).filter(Boolean);
    const partesDireccionCruda = direccionTexto.split('/').map((s) => s.trim()).filter(Boolean);

    const barrio = barrioCelda ? String(barrioCelda).trim() : null;
    const localidad = normalizarLocalidad(localidadCelda);

    if (partesDireccionCruda.length === 0) {
      omitidos.push({ fila: { nombre: nombreTexto }, motivo: 'Fila sin dirección — posible resto de otra tabla' });
      continue;
    }

    if (partesNombre.length > 1 && partesNombre.length === partesDireccionCruda.length) {
      const partesDireccion = completarCalleEnPartes(partesDireccionCruda);
      const generados = partesNombre.map((nombreParte, idx) => ({
        nombre: nombreParte,
        direccion: combinarDireccion(partesDireccion[idx], idx === 0 ? numeroCelda : null),
        barrio,
        localidad,
      }));
      divididas.push({ filaOriginal: `${nombreTexto} / ${direccionTexto}`, clientesGenerados: generados.map((g) => g.nombre) });
      creados.push(...generados);
      continue;
    }

    if (partesNombre.length === 1 && partesDireccionCruda.length === 1) {
      creados.push({
        nombre: nombreTexto,
        direccion: combinarDireccion(direccionTexto, numeroCelda),
        barrio,
        localidad,
      });
      continue;
    }

    omitidos.push({
      fila: { nombre: nombreTexto, direccion: direccionTexto },
      motivo: 'Fila ambigua: no se pudo dividir con confianza (nombre y dirección con distinta cantidad de partes separadas por "/")',
    });
  }

  return { creados, omitidos, divididas };
}

// --- Fallback con IA, solo para archivos SIN encabezado reconocible ---

function construirPrompt(filasCrudas) {
  return `
Sos un asistente que extrae datos de CLIENTES ÚNICOS a partir de filas de una planilla de reparto
de una sodería con un formato que no se pudo detectar automáticamente por columnas.

De cada fila, extraé SOLO: nombre, direccion, barrio, localidad (normalizando variantes de ciudad
a una sola forma). Ignorá cantidades, montos y observaciones. Si una fila no parece un cliente real,
o si el nombre tiene un "/" pero la dirección no tiene la misma cantidad de partes (o viceversa),
NO la incluyas — mejor omitir que adivinar.

Respondé EXCLUSIVAMENTE con un array JSON, empezando con "[" y terminando con "]", sin texto
adicional. Cada elemento: { "nombre": string, "direccion": string|null, "barrio": string|null, "localidad": string|null }

Filas (array de arrays):
${JSON.stringify(filasCrudas)}
`.trim();
}

function extraerJsonDeTexto(texto) {
  const inicio = texto.indexOf('[');
  const fin = texto.lastIndexOf(']');
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw Object.assign(new Error('La IA no devolvió un JSON válido, reintentá o revisá el archivo'), { status: 502 });
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
    throw Object.assign(new Error('La respuesta de la IA se cortó por exceder el límite de tokens.'), { status: 502 });
  }

  const textoRespuesta = data.content?.[0]?.text || '';
  try {
    return extraerJsonDeTexto(textoRespuesta).map((c) => ({ ...c, barrio: c.barrio || null, localidad: normalizarLocalidad(c.localidad) }));
  } catch (err) {
    if (!env.isProduction) console.error('Respuesta cruda de la IA (no parseable):', textoRespuesta);
    throw err;
  }
}

function normalizarNombreClave(nombre) {
  return String(nombre).trim().toUpperCase().replace(/\s+/g, ' ');
}

async function importar({ propietarioId, buffer, createdBy }) {
  const filasCrudas = leerExcel(buffer);

  if (filasCrudas.length === 0) {
    throw Object.assign(new Error('El archivo no tiene filas de datos'), { status: 400 });
  }
  if (filasCrudas.length > 300) {
    throw Object.assign(new Error('Máximo 300 filas por archivo — dividí el Excel en partes más chicas'), { status: 400 });
  }

  const header = detectarEncabezado(filasCrudas);

  let clientesExtraidos;
  let omitidosPrevios = [];
  let divididas = [];
  let usoIA = false;

  if (header) {
    const resultado = extraerClientesDeterministico(filasCrudas, header);
    clientesExtraidos = resultado.creados;
    omitidosPrevios = resultado.omitidos;
    divididas = resultado.divididas;
  } else {
    usoIA = true;
    clientesExtraidos = await interpretarConIA(filasCrudas);
  }

  const { rows: existentes } = await db.query('SELECT nombre FROM clientes WHERE propietario_id = $1', [propietarioId]);
  const nombresExistentes = new Set(existentes.map((c) => normalizarNombreClave(c.nombre)));

  const vistosEnEsteArchivo = new Set();
  const creados = [];
  const omitidos = [...omitidosPrevios];

  for (const cliente of clientesExtraidos) {
    const nombre = cliente?.nombre ? String(cliente.nombre).trim() : '';
    if (!nombre) {
      omitidos.push({ fila: cliente, motivo: 'Sin nombre identificable' });
      continue;
    }

    const clave = normalizarNombreClave(nombre);

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
    metodoExtraccion: usoIA ? 'ia' : 'deterministico',
    creados,
    omitidos,
    filasDivididas: divididas,
  };
}

module.exports = { importar };