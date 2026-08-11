// backend/utils/motorAutorizacion.js
//
// Motor único de autorización con soporte de tipo_flujo.
// Cada flujo (solicitudes, viaticos) tiene sus propias reglas en matriz_autorizacion.

const db = require('../db');

/**
 * Decide si un usuario puede firmar un nivel de autorización.
 *
 * @param {object} opts
 * @param {object} opts.usuario
 * @param {number} opts.nivel                     - nivel_actual de la solicitud
 * @param {string} [opts.tipoFlujo]               - 'solicitudes' | 'viaticos' (default: 'solicitudes')
 * @param {number|null} [opts.idDepartamentoVoBo] - solo para nivel -1 (visto bueno)
 * @param {function} callback                     - (err, { puede: boolean, etiqueta: string })
 */
function puedeFirmar({ usuario, nivel, tipoFlujo = 'solicitudes', idDepartamentoVoBo = null }, callback) {
  if (usuario.rol === 'ADMIN') {
    return callback(null, { puede: true, etiqueta: 'ADMIN' });
  }

  // Nivel -1 = Visto Bueno (solo solicitudes de recursos)
  if (nivel === -1) {
    const puede = idDepartamentoVoBo != null && usuario.id_departamento === idDepartamentoVoBo;
    return callback(null, { puede, etiqueta: 'VISTO BUENO' });
  }

  // Nivel 0 en adelante: consulta matriz filtrada por tipo_flujo
  const sql = `
    SELECT m.id_usuario, m.etiqueta_nivel, r.nombre_rol
    FROM matriz_autorizacion m
    LEFT JOIN catalogo_roles r ON m.id_rol = r.id
    WHERE m.nivel = ?
      AND m.tipo_flujo = ?
      AND m.estatus_activo = 1
      AND (m.id_departamento = ? OR m.id_departamento IS NULL)
    ORDER BY (m.id_departamento IS NULL) ASC
    LIMIT 1
  `;

  db.query(sql, [nivel, tipoFlujo, usuario.id_departamento], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) {
      return callback(null, { puede: false, etiqueta: `NIVEL ${nivel} (sin regla en ${tipoFlujo})` });
    }

    const regla = rows[0];

    // Nivel 0 de viáticos = Jefe Inmediato: sin rol fijo en BD.
    // El motor no puede saber aquí si el usuario es el jefe correcto
    // (eso lo valida la ruta comparando nombre_completo vs jefe_inmediato).
    // Solo devolvemos puede=true si el flujo es viaticos y nivel=0 SIN rol asignado,
    // para que la ruta haga la validación del nombre.
    if (tipoFlujo === 'viaticos' && nivel === 0 && !regla.id_rol && !regla.id_usuario) {
      // Dejar pasar al motor de la ruta — ella filtra por nombre_completo
      return callback(null, { puede: true, etiqueta: regla.etiqueta_nivel, esJefeNivel: true });
    }

    if (regla.id_usuario) {
      return callback(null, {
        puede: usuario.id === regla.id_usuario,
        etiqueta: regla.etiqueta_nivel
      });
    }

    return callback(null, {
      puede: usuario.rol === regla.nombre_rol,
      etiqueta: regla.etiqueta_nivel
    });
  });
}

/**
 * Devuelve el nombre del rol que debe firmar un nivel dado (para notificaciones).
 */
function obtenerRolDeNivel(nivel, idDepartamento, callback, tipoFlujo = 'solicitudes') {
  const sql = `
    SELECT r.nombre_rol
    FROM matriz_autorizacion m
    LEFT JOIN catalogo_roles r ON m.id_rol = r.id
    WHERE m.nivel = ?
      AND m.tipo_flujo = ?
      AND m.estatus_activo = 1
      AND (m.id_departamento = ? OR m.id_departamento IS NULL)
    ORDER BY (m.id_departamento IS NULL) ASC
    LIMIT 1
  `;
  db.query(sql, [nivel, tipoFlujo, idDepartamento], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(null, null);
    callback(null, rows[0].nombre_rol || null);
  });
}

/**
 * Versión Promise de puedeFirmar.
 */
function puedeFirmarAsync(opts) {
  return new Promise((resolve, reject) => {
    puedeFirmar(opts, (err, resultado) => err ? reject(err) : resolve(resultado));
  });
}

module.exports = { puedeFirmar, puedeFirmarAsync, obtenerRolDeNivel };