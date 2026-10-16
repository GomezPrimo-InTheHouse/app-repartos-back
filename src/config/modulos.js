// src/config/modulos.js
// Lista única de módulos operativos que se pueden habilitar/restringir por empleado.
// admin y super_admin siempre tienen acceso a todo, esto solo aplica a 'vendedor'.
//
// requiereFlag: el módulo solo existe para empresas que tengan ese flag activo en req.user
// (ver auth.service). Si la empresa no lo tiene, no se ofrece como permiso asignable.
const MODULOS_DISPONIBLES = [
  { clave: 'clientes', etiqueta: 'Clientes' },
  { clave: 'productos', etiqueta: 'Productos' },
  { clave: 'despachos', etiqueta: 'Despachos' },
  { clave: 'pagos', etiqueta: 'Pagos' },
  { clave: 'dashboard', etiqueta: 'Dashboard' },
  { clave: 'reportes', etiqueta: 'Reportes' },
  { clave: 'produccion', etiqueta: 'Producción', requiereFlag: 'usaProduccion' },
  { clave: 'reparto', etiqueta: 'Reparto' },
];

const CLAVES_VALIDAS = MODULOS_DISPONIBLES.map((m) => m.clave);

// Módulos que puede ver/asignar un usuario según los flags de su empresa.
function modulosParaUsuario(user) {
  return MODULOS_DISPONIBLES
    .filter((m) => !m.requiereFlag || Boolean(user?.[m.requiereFlag]))
    .map(({ clave, etiqueta }) => ({ clave, etiqueta }));
}

module.exports = { MODULOS_DISPONIBLES, CLAVES_VALIDAS, modulosParaUsuario };