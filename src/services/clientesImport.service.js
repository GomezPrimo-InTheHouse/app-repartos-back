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

function completarCalleEnPartes(partes) {
  let calleBase = null;
  return partes.map((parte) => {
    const soloNumero = /^\d+$/.test(parte);
    if (soloNumero && calleBase) return `${calleBase} ${parte}`;
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
  return String(texto).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

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
      creados.push({ nombre: nombreTexto, direccion: combinarDireccion(direccionTexto, numeroCelda), barrio, localidad });
      continue;
    }

    omitidos.push({
      fila: { nombre: nombreTexto, direccion: direccionTexto },
      motivo: 'Fila ambigua: no se pudo dividir con confianza (nombre y dirección con distinta cantidad de partes separadas por "/")',
    });
  }

  return { creados, omitidos, divididas };
}

function construirPrompt(filasCrudas) {
  return `
Sos un asistente que extrae datos de CLIENTES ÚNICOS a partir de filas de una planilla de reparto
de una sodería con un formato que no se pudo detectar automáticamente por columnas.

De cada fila, extraé SOLO: nombre, direccion, barrio, localidad (normalizando variantes de ciudad
a una sola forma). Ignorá cantidades, montos y observaciones. Si una fila no parece un cliente real,
o si el nombre tiene un "/" pero la dirección no tiene la misma cantidad de partes (o viceversa),
NO la incluyas — mejor omitir que adivinar.

Respondé EXCLUSIVAMENTE con un array JSON, empezando con "[" y terminando con "]", sin texto adicional.
Cada elemento: { "nombre": string, "direccion": string|null, "barrio": string|null, "localidad": string|null }

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
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
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

async function extraerCandidatosCrudos(buffer) {
  const filasCrudas = leerExcel(buffer);

  if (filasCrudas.length === 0) {
    throw Object.assign(new Error('El archivo no tiene filas de datos'), { status: 400 });
  }
  if (filasCrudas.length > 300) {
    throw Object.assign(new Error('Máximo 300 filas por archivo — dividí el Excel en partes más chicas'), { status: 400 });
  }

  const header = detectarEncabezado(filasCrudas);

  if (header) {
    const resultado = extraerClientesDeterministico(filasCrudas, header);
    return { totalFilasLeidas: filasCrudas.length, metodoExtraccion: 'deterministico', ...resultado };
  }

  const clientesExtraidos = await interpretarConIA(filasCrudas);
  return { totalFilasLeidas: filasCrudas.length, metodoExtraccion: 'ia', creados: clientesExtraidos, omitidos: [], divididas: [] };
}

// ---- Paso 1: previsualizar (no toca la base) ----
async function previsualizar({ propietarioId, buffer }) {
  const { totalFilasLeidas, metodoExtraccion, creados, omitidos: omitidosExtraccion, divididas } =
    await extraerCandidatosCrudos(buffer);

  const { rows: existentes } = await db.query('SELECT nombre FROM clientes WHERE propietario_id = $1', [propietarioId]);
  const nombresExistentes = new Set(existentes.map((c) => normalizarNombreClave(c.nombre)));

  const vistos = new Set();
  const candidatos = [];
  const omitidos = [...omitidosExtraccion];
  let idx = 0;

  for (const cliente of creados) {
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
    if (vistos.has(clave)) {
      omitidos.push({ fila: cliente, motivo: 'Duplicado dentro del mismo archivo' });
      continue;
    }
    vistos.add(clave);

    candidatos.push({
      id: idx++,
      nombre,
      direccion: cliente.direccion || null,
      barrio: cliente.barrio || null,
      localidad: cliente.localidad || null,
    });
  }

  return { totalFilasLeidas, metodoExtraccion, candidatos, omitidos, filasDivididas: divididas };
}

// ---- Paso 2: confirmar (crea en la base los candidatos que el frontend mande) ----
async function confirmar({ propietarioId, candidatos, createdBy }) {
  if (!Array.isArray(candidatos) || candidatos.length === 0) {
    throw Object.assign(new Error('candidatos debe ser un array no vacío'), { status: 400 });
  }

  const { rows: existentes } = await db.query('SELECT nombre FROM clientes WHERE propietario_id = $1', [propietarioId]);
  const nombresExistentes = new Set(existentes.map((c) => normalizarNombreClave(c.nombre)));

  const vistos = new Set();
  const creados = [];
  const omitidos = [];

  for (const cliente of candidatos) {
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
    if (vistos.has(clave)) {
      omitidos.push({ fila: cliente, motivo: 'Duplicado dentro de la selección enviada' });
      continue;
    }
    vistos.add(clave);

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

  return { creados, omitidos };
}

module.exports = { previsualizar, confirmar };