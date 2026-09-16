// src/services/pricing.service.js

/**
 * Resuelve el precio unitario que corresponde cobrarle a un cliente por un
 * producto puntual. Único punto de la aplicación donde se calcula esto —
 * cualquier consumidor (despachos.service.js hoy, otros a futuro) tiene que
 * pasar por acá en vez de leer producto.precio_venta directo cuando el
 * contexto es "le voy a cobrar esto a este cliente".
 *
 * Hoy solo aplica el porcentaje_aumento general del cliente. El punto de
 * extensión para excepciones puntuales por producto (cliente_id +
 * producto_id) va acá adentro el día de mañana: buscar la excepción
 * primero, y si no existe, caer al cálculo general de abajo. Nada fuera de
 * esta función necesita cambiar cuando eso se implemente.
 */
function resolverPrecioLinea(cliente, producto) {
  const porcentaje = Number(cliente?.porcentaje_aumento || 0);
  const precioBase = Number(producto.precio_venta);
  const precioConAumento = precioBase * (1 + porcentaje / 100);
  // Redondeo a 2 decimales: despacho_items.precio_unitario es numeric(12,2).
  return Math.round(precioConAumento * 100) / 100;
}

module.exports = { resolverPrecioLinea };