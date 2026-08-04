require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306
});

db.connect(err => {
  if (err) { 
    console.error('Error conectando a la BD:', err.message, err.code); 
    return; 
  }
  console.log('¡Conexión exitosa a la base de datos de Sacimex!');
});

// Reconexion automatica si se cae la conexion
db.on('error', (err) => {
  console.error('Error en la conexion MySQL:', err.code);
});

module.exports = db;