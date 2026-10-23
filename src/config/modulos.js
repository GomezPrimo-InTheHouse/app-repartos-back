// src/config/modulos.js
// Catálogo único de módulos del sistema.
//
// - base: toda empresa los tiene, no se contratan aparte.
// - contratable: el super admin los activa por empresa (propietarios.modulos). Si la empresa no lo tiene,
//   el módulo no existe para nadie de esa empresa: ni admin ni vendedor (lo controla requireModulo).
// - asignable: se le puede habilitar a un vendedor en "Mi equipo" (profiles.permisos).
//   admin y super_admin no usan permisos: acceden a todo lo que su empresa tiene.
//
// Agregar un módulo vendible nuevo = agregar una línea acá + su clave al CHECK de la migración 007.
const MODULOS = [
  { clave: 'dashboard', etiqueta: 'Inicio', base: true, asignable: true },
  { clave: 'clientes', etiqueta: 'Clientes', base: true, asignable: true },
  { clave: 'productos', etiqueta: 'Productos', base: true, asignable: true },
  { clave: 'despachos', etiqueta: 'Despachos', base: true, asignable: true },
  { clave: 'pagos', etiqueta: 'Pagos', base: true, asignable: true },
  { clave: 'reparto', etiqueta: 'Reparto', contratable: true, asignable: true },
  { clave: 'reportes', etiqueta: 'Reportes', contratable: true, asignable: true },
  { clave: 'equipo', etiqueta: 'Mi equipo', contratable: true, asignable: false },
  { clave: 'produccion', etiqueta: 'Producción', contratable: true, asignable: true },
  { clave: 'geolocalizacion', etiqueta: 'Mapa', contratable: true, asignable: true },
];

const MODULOS_CONTRATABLES = MODULOS.filter((m) => m.contratable).map((m) => m.clave);

// Claves que se pueden guardar en profiles.permisos de un vendedor.
const CLAVES_VALIDAS = MODULOS.filter((m) => m.asignable).map((m) => m.clave);

// Lo que tenía cada empresa antes de la migración 007 (para no cortarle nada si el código
// se despliega antes que la migración): todo lo existente + los flags que tuviera activos.
function modulosLegacy(empresa) {
  const modulos = ['reparto', 'reportes', 'equipo'];
  if (empresa?.usa_produccion) modulos.push('produccion');
  if (empresa?.usa_geolocalizacion) modulos.push('geolocalizacion');
  return modulos;
}

// Valida y normaliza la lista de módulos contratados (sin repetidos, en el orden del catálogo).
function normalizarModulosEmpresa(modulos) {
  if (!Array.isArray(modulos)) {
    throw Object.assign(new Error('modulos debe ser una lista'), { status: 400 });
  }
  const invalidos = modulos.filter((m) => !MODULOS_CONTRATABLES.includes(m));
  if (invalidos.length > 0) {
    throw Object.assign(new Error(`Módulo(s) inválido(s): ${invalidos.join(', ')}`), { status: 400 });
  }
  return MODULOS_CONTRATABLES.filter((m) => modulos.includes(m));
}

// ¿La empresa del usuario tiene el módulo? Los de base siempre; las claves desconocidas no se filtran acá.
function empresaTieneModulo(user, clave) {
  if (!MODULOS_CONTRATABLES.includes(clave)) return true;
  return Array.isArray(user?.modulosEmpresa) && user.modulosEmpresa.includes(clave);
}

function etiquetaModulo(clave) {
  return MODULOS.find((m) => m.clave === clave)?.etiqueta ?? clave;
}

// Módulos que el admin puede asignarle a un vendedor: los asignables que su empresa tiene.
function modulosParaUsuario(user) {
  return MODULOS
    .filter((m) => m.asignable && empresaTieneModulo(user, m.clave))
    .map(({ clave, etiqueta }) => ({ clave, etiqueta }));
}

module.exports = {
  MODULOS,
  MODULOS_CONTRATABLES,
  CLAVES_VALIDAS,
  modulosLegacy,
  normalizarModulosEmpresa,
  empresaTieneModulo,
  etiquetaModulo,
  modulosParaUsuario,
};