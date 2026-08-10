/**
 * Middleware de autorización por rol + permisos granulares.
 *
 * Prioridad:
 *  1. ADMIN → acceso total siempre.
 *  2. Si el usuario tiene fila en permisos_usuario para el modulo → esa fila manda.
 *  3. Sin fila → se aplica la lista de rolesPermitidos del rol.
 */
const db = require('../db');

// ── Por rol (sin consultar BD) ────────────────────────────────────────────────
const autorizar = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    if (req.usuario.rol === 'ADMIN') return next();
    if (rolesPermitidos.includes(req.usuario.rol)) return next();
    return res.status(403).json({
      success: false,
      message: `Acceso denegado. Roles requeridos: ${rolesPermitidos.join(', ')}`
    });
  };
};

// ── Por módulo (consulta permisos_usuario, con fallback a rol) ─────────────────
// Uso: autorizarModulo('clientes', ['ADMIN','CONTADOR'], 'puede_ver')
//   modulo           → clave del módulo (ej. 'clientes')
//   rolesFallback    → roles que tienen acceso por defecto si no hay permiso granular
//   accion           → columna a revisar: 'puede_ver' | 'puede_crear' | 'puede_editar' | 'puede_eliminar'
const autorizarModulo = (modulo, rolesFallback = [], accion = 'puede_ver') => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    if (req.usuario.rol === 'ADMIN') return next();

    // Consultar si este usuario tiene permiso granular para el módulo
    db.query(
      `SELECT puede_ver, puede_crear, puede_editar, puede_eliminar
       FROM permisos_usuario
       WHERE id_usuario = ? AND modulo = ?`,
      [req.usuario.id, modulo],
      (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Error verificando permisos' });

        if (rows.length > 0) {
          // Tiene regla granular → esa regla manda
          if (rows[0][accion]) return next();
          return res.status(403).json({
            success: false,
            message: `No tienes permiso de "${accion.replace('puede_', '')}" en ${modulo}`
          });
        }

        // Sin regla granular → fallback al rol
        if (rolesFallback.includes(req.usuario.rol)) return next();
        return res.status(403).json({
          success: false,
          message: `Acceso denegado al módulo ${modulo}`
        });
      }
    );
  };
};

// ── puedeAutorizarViaticos ────────────────────────────────────────────────────
function puedeAutorizarViaticos(usuario) {
  return usuario.rol === 'ADMIN' || usuario.rol === 'D.H.O';
}

module.exports = { autorizar, autorizarModulo, puedeAutorizarViaticos };