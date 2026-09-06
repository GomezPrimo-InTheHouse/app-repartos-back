// src/controllers/reportes.controller.js
const { asyncHandler } = require('../utils/asyncHandler');
const reportesService = require('../services/reportes.service');
const {
  crearDocumento,
  escribirEstadoCuentaCliente,
  escribirResumenGeneral,
  escribirComprobantePago,
} = require('../utils/pdf');

// Arma un Content-Disposition seguro para nombres con tildes/ñ (RFC 5987):
// incluye un fallback ASCII (sin tildes) + la versión UTF-8 codificada.
function contentDispositionPdf(nombreBase) {
  const sinTildes = nombreBase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const codificado = encodeURIComponent(nombreBase.replace(/\s+/g, '_'));
  return `attachment; filename="${sinTildes}.pdf"; filename*=UTF-8''${codificado}.pdf`;
}

const estadoCuentaCliente = asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query;

  const datos = await reportesService.obtenerEstadoCuentaCliente({
    propietarioId: req.user.propietarioId,
    clienteId: req.params.id,
    desde,
    hasta,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDispositionPdf(`estado_cuenta_${datos.cliente.nombre}`));

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

const comprobantePago = asyncHandler(async (req, res) => {
  const datos = await reportesService.obtenerComprobantePago({
    propietarioId: req.user.propietarioId,
    pagoId: req.params.id,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDispositionPdf(`comprobante_pago_${datos.pago.cliente_nombre}`));

  const doc = crearDocumento();
  doc.pipe(res);
  escribirComprobantePago(doc, datos);
  doc.end();
});

module.exports = { estadoCuentaCliente, resumenGeneral, comprobantePago };