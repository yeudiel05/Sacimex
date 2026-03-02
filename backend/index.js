require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('¡Conexión exitosa a la base de datos de Sacimex!');
});

// --- NUEVA RUTA DE LOGIN ---
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;

  const query = 'SELECT * FROM USUARIOS WHERE username = ? AND password_hash = ? AND estatus_activo = TRUE';
  
  db.query(query, [usuario, password], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Error en el servidor' });
    }

    if (results.length > 0) {
      res.json({ success: true, message: 'Login exitoso', rol: results[0].rol });
    } else {
      res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo puerto ${PORT}`);
});