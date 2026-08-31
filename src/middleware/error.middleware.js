// src/middleware/error.middleware.js
const { env } = require('../config/env');

function notFoundHandler(req, res, next) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(status).json({
    error: message,
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, errorHandler };