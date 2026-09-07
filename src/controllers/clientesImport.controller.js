// src/controllers/clientesImport.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const clientesImportService = require('../services/clientesImport.service');

const previsualizar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Debés adjuntar un archivo Excel (.xlsx o .xls) en el campo "archivo"' });
  }

  const resultado = await clientesImportService.previsualizar({
    propietarioId: req.user.propietarioId,
    buffer: req.file.buffer,
  });

  res.json(resultado);
});

const confirmar = asyncHandler(async (req, res) => {
  const { candidatos } = req.body;

  if (!Array.isArray(candidatos)) {
    return res.status(400).json({ error: 'candidatos debe ser un array' });
  }

  const resultado = await clientesImportService.confirmar({
    propietarioId: req.user.propietarioId,
    candidatos,
    createdBy: req.user.id,
  });

  res.status(201).json(resultado);
});

module.exports = { previsualizar, confirmar };