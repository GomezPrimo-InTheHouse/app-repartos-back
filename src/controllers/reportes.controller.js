// src/controllers/reportes.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const reportesService = require('../services/reportes.service');
const { crearDocumento, escribirEstadoCuentaCliente, escribirResumenGeneral } = require('../utils/pdf');

const estadoCuentaCliente = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;

  const datos = await reportesService.obtenerEstadoCuentaCliente({
    propietarioId: req.user.propietarioId,
    clienteId: req.params.id,
    desde,
    hasta,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="estado_cuenta_${datos.cliente.nombre.replace(/\s+/g, '_')}.pdf"`
  );

  const doc = crearDocumento();
  doc.pipe(res);
  escribirEstadoCuentaCliente(doc, { ...datos, desde, hasta });
  doc.end();
});

const resumenGeneral = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;

  const datos = await reportesService.obtenerResumenGeneral({
    propietarioId: req.user.propietarioId,
    desde,
    hasta,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="resumen_general.pdf"');

  const doc = crearDocumento();
  doc.pipe(res);
  escribirResumenGeneral(doc, { ...datos, desde, hasta });
  doc.end();
});

module.exports = { estadoCuentaCliente, resumenGeneral };