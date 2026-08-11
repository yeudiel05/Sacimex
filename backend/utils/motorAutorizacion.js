// backend/utils/motorAutorizacion.js
//
// Motor único de autorización. Reemplaza los `if (miRol === 'AUTORIZADOR_1')`
// hardcodeados y duplicados en solicitudes.routes.js y viaticos.routes.js.
//
// Requiere que req.usuario traiga `id`, `rol` e `id_departamento`
// (ver el cambio en auth.routes.js para que el login incluya id_departamento
// en el payload del JWT).

const db = require('../db');

/**
 * Decide si un usuario puede firmar un nivel de autorización.
 *
 * @param {object} opts
 * @param {object} opts.usuario                  - normalmente req.usuario
 * @param {number} opts.nivel                     - nivel_actual de la solicitud
 *                                                   (-1 = Visto Bueno, 0 = Revisor, 1..N = Autorizadores)
 * @param {number|null} [opts.idDepartamentoVoBo] - solo para nivel -1: el id_area_visto_bueno
 *                                                   del concepto de pago
 * @param {function} callback                     - (err, { puede: boolean, etiqueta: string })
 */
function puedeFirmar({ usuario, nivel, idDepartamentoVoBo = null }, callback) {
  // ADMIN conserva el comportamiento actual: puede firmar cualquier nivel.
  if (usuario.rol === 'ADMIN') {
    return callback(null, { puede: true, etiqueta: 'ADMIN' });
  }

  // Nivel -1 = Visto Bueno. No usa la matriz: lo firma cualquier persona
  // del departamento dueño del concepto de pago.
  if (nivel === -1) {
    const puede = idDepartamentoVoBo != null && usuario.id_departamento === idDepartamentoVoBo;
    return callback(null, { puede, etiqueta: 'VISTO BUENO' });
  }

  // Nivel 0 en adelante: se resuelve contra matriz_autorizacion.
  // Prioridad: regla especifica del departamento del usuario > regla general (id_departamento NULL).
  const sql = `
    SELECT m.id_usuario, m.etiqueta_nivel, r.nombre_rol
    FROM matriz_autorizacion m
    LEFT JOIN catalogo_roles r ON m.id_rol = r.id
    WHERE m.nivel = ? AND m.estatus_activo = 1
      AND (m.id_departamento = ? OR m.id_departamento IS NULL)
    ORDER BY (m.id_departamento IS NULL) ASC
    LIMIT 1
  `;

  db.query(sql, [nivel, usuario.id_departamento], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) {
      // No hay regla configurada para este nivel: nadie puede firmar
      // (mejor fallar cerrado que dejar pasar por accidente).
      return callback(null, { puede: false, etiqueta: `NIVEL ${nivel} (sin regla configurada)` });
    }

    const regla = rows[0];

    // Excepción puntual: la regla fija a una persona específica.
    if (regla.id_usuario) {
      return callback(null, {
        puede: usuario.id === regla.id_usuario,
        etiqueta: regla.etiqueta_nivel
      });
    }

    // Regla normal: cualquiera con el rol indicado.
    return callback(null, {
      puede: usuario.rol === regla.nombre_rol,
      etiqueta: regla.etiqueta_nivel
    });
  });
}

/**
 * Devuelve el nombre del rol que debe firmar un nivel dado (para saber a
 * quién notificarle por correo que le toca firmar). Generaliza el
 * `rolNotificar = nuevoNivel === 1 ? 'AUTORIZADOR_1' : 'AUTORIZADOR_2'`
 * hardcodeado que había antes.
 *
 * @param {number} nivel
 * @param {number|null} idDepartamento
 * @param {function} callback - (err, nombreRol|null)
 */
function obtenerRolDeNivel(nivel, idDepartamento, callback) {
  const sql = `
    SELECT r.nombre_rol
    FROM matriz_autorizacion m
    LEFT JOIN catalogo_roles r ON m.id_rol = r.id
    WHERE m.nivel = ? AND m.estatus_activo = 1
      AND (m.id_departamento = ? OR m.id_departamento IS NULL)
    ORDER BY (m.id_departamento IS NULL) ASC
    LIMIT 1
  `;
  db.query(sql, [nivel, idDepartamento], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(null, null);
    callback(null, rows[0].nombre_rol || null);
  });
}

/**
 * Igual que puedeFirmar pero como Promesa, para usarse con Promise.all
 * al recorrer listados (un .forEach normal no espera callbacks async).
 */
function puedeFirmarAsync(opts) {
  return new Promise((resolve, reject) => {
    puedeFirmar(opts, (err, resultado) => err ? reject(err) : resolve(resultado));
  });
}

/**
 * Viáticos es un flujo de un solo nivel (lo autoriza D.H.O), a diferencia de
 * solicitudes_recursos que tiene varios niveles. Por eso no usa la matriz de
 * autorización: es solo un chequeo de rol, pero centralizado en un único
 * lugar para no repetir `rol !== 'ADMIN' && rol !== 'D.H.O' && rol !== 'DHO'`
 * en cada ruta (y para no arrastrar la variante 'DHO' que no existe en los
 * datos reales, solo 'D.H.O').
 */
function puedeAutorizarViaticos(usuario) {
  return usuario.rol === 'ADMIN' || usuario.rol === 'D.H.O';
}

module.exports = { puedeFirmar, puedeFirmarAsync, obtenerRolDeNivel, puedeAutorizarViaticos };