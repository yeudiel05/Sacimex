/**
 * Middleware de autorización por rol.
 * Uso: router.get('/ruta', verificarToken, autorizar('ADMIN', 'CONTADOR'), handler)
 * 
 * Siempre debe ir DESPUÉS de verificarToken, nunca antes.
 * ADMIN siempre tiene acceso, sin importar los roles especificados.
 */
const autorizar = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    // ADMIN tiene acceso a todo
    if (req.usuario.rol === 'ADMIN') return next();
    
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ 
        success: false, 
        message: `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(', ')}` 
      });
    }
    next();
  };
};

module.exports = { autorizar };