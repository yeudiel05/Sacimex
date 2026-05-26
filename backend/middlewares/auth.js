const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'sacimex';

const verificarToken = (req, res, next) => {
  // ⚠️ LLAVE MAESTRA ACTIVADA (Hack de desarrollo)
  // Con esto, el backend ya no pide Token. Siempre asume que eres el ADMIN.
  req.usuario = {
    id: 1,
    username: 'Admin',
    rol: 'ADMIN',
    puesto: 'Administrador General'
  };
  
  // Lo dejamos pasar directamente a la ruta sin revisar el token
  next(); 
};

const registrarBitacora = (id_usuario, accion, detalle) => {
  const id = id_usuario || 0;
  const query = 'INSERT INTO bitacora_auditoria (id_usuario, accion, detalle) VALUES (?, ?, ?)';
  db.query(query, [id, accion, detalle], (err) => { 
      if (err) console.error("Error en bitácora:", err); 
  });
};

module.exports = { verificarToken, registrarBitacora, JWT_SECRET };