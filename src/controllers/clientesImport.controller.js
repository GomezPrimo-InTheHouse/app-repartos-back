
// src/controllers/clientesImport.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const clientesImportService = require('../services/clientesImport.service');

const importar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Debés adjuntar un archivo Excel (.xlsx o .xls) en el campo "archivo"' });
  }

  const resultado = await clientesImportService.importar({
    propietarioId: req.user.propietarioId,
    buffer: req.file.buffer,
    createdBy: req.user.id,
  });

  res.status(201).json(resultado);
});

module.exports = { importar };