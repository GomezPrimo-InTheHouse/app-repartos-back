// src/config/db.js
const { Pool } = require('pg');
const { env } = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err);
});

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (!env.isProduction) {
    console.log('SQL ejecutado', { text, duration, rows: result.rowCount });
  }

  return result;
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };