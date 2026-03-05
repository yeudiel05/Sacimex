const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { registrarBitacora, JWT_SECRET } = require('../middlewares/auth');

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const query = 'SELECT * FROM USUARIOS WHERE username = ? AND password_hash = ? AND estatus_activo = TRUE';
  db.query(query, [usuario, password], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error servidor' });
    if (results.length > 0) {
      const user = results[0];
      const token = jwt.sign({ id: user.id, username: user.username, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' });
      registrarBitacora(user.id, 'LOGIN', `El usuario ${user.username} inició sesión`);
      res.json({ success: true, message: 'Login exitoso', token, rol: user.rol });
    } else {
      registrarBitacora(0, 'LOGIN_FALLIDO', `Fallo con usuario: ${usuario}`);
      res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
  });
});

module.exports = router;