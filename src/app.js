// src/app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { env } = require('./config/env');
const routes = require('./routes/index');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };