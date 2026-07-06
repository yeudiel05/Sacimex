const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const db = require('../db');
const { verificarToken, registrarBitacora, JWT_SECRET } = require('../middlewares/auth');

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  
  const query = `
    SELECT u.*, e.puesto, e.departamento 
    FROM usuarios u 
    LEFT JOIN empleados e ON u.id_empleado = e.id_persona 
    WHERE u.username = ? AND u.estatus_activo = TRUE
  `;
  
  db.query(query, [usuario], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error servidor' });
    
    if (results.length > 0) {
      const user = results[0];
      let passwordCorrecta = false;
      let necesitaMigracion = false;

      const isHashed = user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'));

      if (isHashed) {
        passwordCorrecta = await bcrypt.compare(password, user.password_hash);
      } else {
        passwordCorrecta = (password === user.password_hash);
        necesitaMigracion = passwordCorrecta; 
      }

      if (passwordCorrecta) {
        if (necesitaMigracion) {
          try {
            const salt = await bcrypt.genSalt(10);
            const nuevoHash = await bcrypt.hash(password, salt);
            
            const updateQuery = 'UPDATE usuarios SET password_hash = ? WHERE id = ?';
            db.query(updateQuery, [nuevoHash, user.id], (updErr) => {
              if (updErr) console.error(`Error al migrar contraseña de ${user.username}:`, updErr);
              else console.log(`Contraseña de ${user.username} encriptada exitosamente.`);
            });
          } catch (hashErr) {
            console.error('Error al generar el hash en la migración', hashErr);
          }
        }

        const payload = { 
            id: user.id, 
            username: user.username, 
            rol: user.rol,
            puesto: user.puesto || 'Sin Puesto',
            puedeSolicitar: user.puede_solicitar || 0
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        
        registrarBitacora(user.id, 'LOGIN', `El usuario ${user.username} inició sesión`);
        
        res.json({ 
            success: true, 
            message: 'Login exitoso', 
            token, 
            rol: user.rol,
            username: user.username,
            departamento: user.departamento || '',
            puesto: user.puesto || 'Sin Puesto',
            puedeSolicitar: user.puede_solicitar || 0,
            nombre: user.nombre_completo || user.username
        });
        
      } else {
        registrarBitacora(0, 'LOGIN_FALLIDO', `Fallo de contraseña con usuario: ${usuario}`);
        res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
      }
    } else {
      registrarBitacora(0, 'LOGIN_FALLIDO', `Fallo: usuario no encontrado: ${usuario}`);
      res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
  });
});

router.post('/logout', verificarToken, (req, res) => {
    registrarBitacora(req.usuario.id, 'LOGOUT', `El usuario ${req.usuario.username} cerró sesión`);
    res.json({ success: true, message: 'Sesión terminada y registrada.' });
});

module.exports = router;