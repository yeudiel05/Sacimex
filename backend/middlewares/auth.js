const jwt = require('jsonwebtoken'); // <-- Importante, necesitamos la librería de JWT
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'sacimex';

const verificarToken = (req, res, next) => {
  // 1. Recibimos el token del encabezado que manda React
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Si no hay token, bloqueamos el paso
  if (!token) {
      return res.status(403).json({ success: false, message: 'No enviaste token de seguridad' });
  }

  // 2. Desencriptamos el token con la palabra secreta ('sacimex')
  jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
      if (err) {
          return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
      }
      
      // 3. ¡LA MAGIA REAL! Le pasamos al sistema la identidad VERDADERA del usuario
      req.usuario = usuarioDecodificado; 
      next(); // Lo dejamos pasar a la ruta
  });
};

const registrarBitacora = (id_usuario, accion, detalle) => {
  const id = id_usuario || 0;
  const query = 'INSERT INTO bitacora_auditoria (id_usuario, accion, detalle) VALUES (?, ?, ?)';
  db.query(query, [id, accion, detalle], (err) => { 
      if (err) console.error("Error en bitácora:", err); 
  });
};

module.exports = { verificarToken, registrarBitacora, JWT_SECRET };