
// src/config/env.js
require('dotenv').config();

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'DATABASE_URL',
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
    'Revisá tu archivo .env (copiá .env.example como base).'
  );
}

const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,

  databaseUrl: process.env.DATABASE_URL,

  frontendUrls,

  cookieName: process.env.COOKIE_NAME || 'app_repartos_session',

  // Opcional: solo se valida en el momento de usarse (importación de clientes por IA)
  geminiApiKey: process.env.GEMINI_API_KEY || null,

  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = { env };