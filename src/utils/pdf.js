// src/utils/pdf.js
const PDFDocument = require('pdfkit');

function crearDocumento() {
  return new PDFDocument({ margin: 40, size: 'A4' });
}

function formatoMoneda(n) {
  return `$${Number(n).toFixed(2)}`;
}

function formatoFecha(f) {
  return new Date(f).toLocaleDateString('es-AR');
}

function escribirEstadoCuentaCliente(doc, { cliente, despachos, pagos, totalDespachadoPeriodo, totalPagadoPeriodo, saldoActual, desde, hasta }) {
  doc.fontSize(18).text('Estado de Cuenta', { align: 'center' });
  doc.moveDown();

  doc.fontSize(11).text(`Cliente: ${cliente.nombre}`);
  if (cliente.telefono) doc.text(`Teléfono: ${cliente.telefono}`);
  doc.text(`Período: ${desde || 'inicio'} a ${hasta || 'hoy'}`);
  doc.moveDown();

  doc.fontSize(13).text('Despachos', { underline: true });
  doc.moveDown(0.5);

  if (despachos.length === 0) {
    doc.fontSize(10).text('Sin despachos en el período.');
  }

  despachos.forEach((d) => {
    doc.fontSize(10).text(`Remito #${d.numero} - ${formatoFecha(d.fecha)} - Total: ${formatoMoneda(d.total)}`);
    d.items.forEach((item) => {
      doc.fontSize(9).text(
        `   ${item.cantidad} x ${item.producto_nombre} @ ${formatoMoneda(item.precio_unitario)} = ${formatoMoneda(item.subtotal)}`
      );
    });
    doc.moveDown(0.3);
  });

  doc.moveDown();
  doc.fontSize(13).text('Pagos', { underline: true });
  doc.moveDown(0.5);

  if (pagos.length === 0) {
    doc.fontSize(10).text('Sin pagos en el período.');
  }

  pagos.forEach((p) => {
    doc.fontSize(10).text(
      `${formatoFecha(p.fecha)} - ${p.metodo} - ${formatoMoneda(p.monto)}${p.notas ? ' - ' + p.notas : ''}`
    );
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total despachado en el período: ${formatoMoneda(totalDespachadoPeriodo)}`);
  doc.text(`Total pagado en el período: ${formatoMoneda(totalPagadoPeriodo)}`);
  doc.font('Helvetica-Bold').text(`Saldo actual (acumulado, no solo del período): ${formatoMoneda(saldoActual)}`);
  doc.font('Helvetica');
}

function escribirResumenGeneral(doc, { totalPagado, totalDespachado, cantidadDespachos, pagosPorMetodo, productosDespachados, desde, hasta }) {
  doc.fontSize(18).text('Resumen General del Negocio', { align: 'center' });
  doc.moveDown();

  doc.fontSize(11).text(`Período: ${desde || 'inicio'} a ${hasta || 'hoy'}`);
  doc.moveDown();

  doc.fontSize(13).text('Totales', { underline: true });
  doc.fontSize(10).text(`Cantidad de despachos: ${cantidadDespachos}`);
  doc.text(`Total despachado: ${formatoMoneda(totalDespachado)}`);
  doc.text(`Total pagado: ${formatoMoneda(totalPagado)}`);
  doc.moveDown();

  doc.fontSize(13).text('Pagos por método', { underline: true });
  if (pagosPorMetodo.length === 0) doc.fontSize(10).text('Sin pagos en el período.');
  pagosPorMetodo.forEach((p) => {
    doc.fontSize(10).text(`${p.metodo}: ${p.cantidad} pagos - ${formatoMoneda(p.total)}`);
  });
  doc.moveDown();

  doc.fontSize(13).text('Productos despachados', { underline: true });
  if (productosDespachados.length === 0) doc.fontSize(10).text('Sin despachos en el período.');
  productosDespachados.forEach((p) => {
    doc.fontSize(10).text(`${p.nombre}: ${p.cantidad} unidades - ${formatoMoneda(p.monto)}`);
  });
}

module.exports = { crearDocumento, escribirEstadoCuentaCliente, escribirResumenGeneral };