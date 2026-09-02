// src/services/empleados.service.js
const db = require('../config/db');

async function listar(propietarioId) {
  const { rows } = await db.query(
    `SELECT p.id, u.email, p.nombre_completo, p.rol, p.activo, p.created_at
     FROM public.profiles p
     JOIN auth.users u ON u.id = p.id
     WHERE p.propietario_id = $1
     ORDER BY p.nombre_completo`,
    [propietarioId]
  );
  return rows;
}

async function crear({ propietarioId, email, password, nombreCompleto, rol }) {
  const rolFinal = rol === 'admin' ? 'admin' : 'vendedor';

  const { rows } = await db.query(
    'SELECT crear_usuario_empleado($1, $2, $3, $4, $5) AS usuario_id',
    [propietarioId, email, password, nombreCompleto, rolFinal]
  );

  return {
    id: rows[0].usuario_id,
    email,
    nombreCompleto,
    rol: rolFinal,
  };
}

async function actualizarEstado(propietarioId, id, activo) {
  const { rows } = await db.query(
    'UPDATE profiles SET activo = $1 WHERE id = $2 AND propietario_id = $3 RETURNING id, activo',
    [activo, id, propietarioId]
  );
  return rows[0] || null;
}

async function resetearPassword(propietarioId, id, nuevaPassword) {
  const { rows } = await db.query(
    `SELECT u.email FROM profiles p
     JOIN auth.users u ON u.id = p.id
     WHERE p.id = $1 AND p.propietario_id = $2`,
    [id, propietarioId]
  );
  const empleado = rows[0];

  if (!empleado) {
    throw Object.assign(new Error('Empleado no encontrado'), { status: 404 });
  }

  await db.query('SELECT resetear_password($1, $2)', [empleado.email, nuevaPassword]);
}

module.exports = { listar, crear, actualizarEstado, resetearPassword };