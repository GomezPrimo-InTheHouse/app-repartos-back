// src/config/modulos.js
// Lista única de módulos operativos que se pueden habilitar/restringir por empleado.
// admin y super_admin siempre tienen acceso a todo, esto solo aplica a 'vendedor'.
const MODULOS_DISPONIBLES = [
  { clave: 'clientes', etiqueta: 'Clientes' },
  { clave: 'productos', etiqueta: 'Productos' },
  { clave: 'despachos', etiqueta: 'Despachos' },
  { clave: 'pagos', etiqueta: 'Pagos' },
  { clave: 'dashboard', etiqueta: 'Dashboard' },
  { clave: 'reportes', etiqueta: 'Reportes' },
  { clave: 'compras_stock', etiqueta: 'Compras de stock' },
  { clave: 'reparto', etiqueta: 'Reparto' },
];

const CLAVES_VALIDAS = MODULOS_DISPONIBLES.map((m) => m.clave);

module.exports = { MODULOS_DISPONIBLES, CLAVES_VALIDAS };