// src/app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { env } = require('./config/env');
const routes = require('./routes/index');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(cors({
  origin(origin, callback) {
    // Permite requests sin origin (ej: Postman, curl) y los orígenes de la lista
    if (!origin || env.frontendUrls.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };