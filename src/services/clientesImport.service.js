
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
  return XLSX.utils.sheet_to_json(hoja, { defval: null });
}

async function interpretarConIA(filasCrudas) {
  if (!env.geminiApiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY no configurada en el servidor'), { status: 500 });
  }

  const prompt = `
Sos un asistente que normaliza datos de clientes de un negocio de reparto/distribución a crédito.
Te paso filas crudas extraídas de un Excel, con columnas y encabezados que pueden ser inconsistentes,
en español o con abreviaturas.

Devolvé EXCLUSIVAMENTE un array JSON válido (sin texto adicional, sin explicaciones, sin bloques de
código markdown), donde cada elemento tenga EXACTAMENTE estas claves:

{
  "nombre": string o null,
  "telefono": string o null,
  "direccion": string o null,
  "dias_credito": number o null,
  "limite_credito": number o null,
  "notas": string o null
}

Reglas:
- Si no podés determinar el nombre del cliente en una fila, poné "nombre": null.
- "dias_credito" y "limite_credito" deben ser números puros (sin texto, sin símbolos de moneda, sin comas de miles). Si no hay dato claro, poné null.
- No inventes datos que no estén presentes en la fila original.
- Mantené el mismo orden de las filas de entrada (una fila de entrada = un elemento de salida).

Filas:
${JSON.stringify(filasCrudas)}
`.trim();

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const errorTexto = await response.text();
    throw Object.assign(new Error(`Error al consultar la IA: ${errorTexto}`), { status: 502 });
  }

  const data = await response.json();
  const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const limpio = textoRespuesta.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(limpio);
  } catch (err) {
    throw Object.assign(new Error('La IA no devolvió un JSON válido, reintentá o revisá el archivo'), { status: 502 });
  }
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

  const filasNormalizadas = await interpretarConIA(filasCrudas);

  const creados = [];
  const omitidos = [];

  for (const fila of filasNormalizadas) {
    const nombre = fila?.nombre ? String(fila.nombre).trim() : '';

    if (!nombre) {
      omitidos.push({ fila, motivo: 'Sin nombre identificable' });
      continue;
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO clientes (propietario_id, nombre, telefono, direccion, dias_credito, limite_credito, notas, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, nombre`,
        [
          propietarioId,
          nombre,
          fila.telefono || null,
          fila.direccion || null,
          fila.dias_credito ?? null,
          fila.limite_credito ?? null,
          fila.notas || null,
          createdBy,
        ]
      );
      creados.push(rows[0]);
    } catch (err) {
      omitidos.push({ fila, motivo: `Error al guardar: ${err.message}` });
    }
  }

  return { totalFilasLeidas: filasCrudas.length, creados, omitidos };
}

module.exports = { importar };