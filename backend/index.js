require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'sacimex_super_secreto_2026';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.body.id_persona + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) { console.error('Error conectando a la BD:', err); return; }
    console.log('¡Conexión exitosa a la base de datos de Sacimex!');
});

const registrarBitacora = (id_usuario, accion, detalle) => {
    const id = id_usuario || 0;
    const query = 'INSERT INTO BITACORA_AUDITORIA (id_usuario, accion, detalle) VALUES (?, ?, ?)';
    db.query(query, [id, accion, detalle], (err) => { if (err) console.error(err); });
};

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Acceso denegado.' });

    jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
        if (err) return res.status(401).json({ success: false, message: 'Token expirado.' });
        req.usuario = usuarioDecodificado;
        next();
    });
};

app.post('/api/login', (req, res) => {
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

app.get('/api/clientes', verificarToken, (req, res) => {
    const query = `
    SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, 
           p.telefono, p.email_contacto AS email, c.limite_credito AS credito, c.estatus, 
           c.tipo_garantia, c.nombre_aval, c.kyc_validado
    FROM PERSONAS p INNER JOIN CLIENTES c ON p.id = c.id_persona
    WHERE p.eliminado = FALSE ORDER BY p.id DESC
  `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

app.post('/api/clientes', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, credito, tipo_garantia, nombre_aval } = req.body;
    if (!telefono || telefono.length !== 10) return res.status(400).json({ success: false, message: 'Teléfono inválido' });

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)',
            [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Posible RFC duplicado' }));

                const idNuevaPersona = resultPersona.insertId;
                db.query('INSERT INTO CLIENTES (id_persona, limite_credito, estatus, tipo_garantia, nombre_aval) VALUES (?, ?, ?, ?, ?)',
                    [idNuevaPersona, credito, 'En revision', tipo_garantia || 'Ninguna', nombre_aval || ''], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        db.commit(err => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false }));
                            registrarBitacora(req.usuario.id, 'CREAR_CLIENTE', `Cliente registrado ID ${idNuevaPersona}`);
                            res.json({ success: true, message: 'Cliente registrado' });
                        });
                    });
            });
    });
});

app.put('/api/clientes/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, credito, tipo_garantia, nombre_aval } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?',
            [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                db.query('UPDATE CLIENTES SET limite_credito=?, tipo_garantia=?, nombre_aval=? WHERE id_persona=?',
                    [credito, tipo_garantia, nombre_aval, id], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        db.commit(err => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false }));
                            registrarBitacora(req.usuario.id, 'EDITAR_CLIENTE', `Editó cliente ID ${id}`);
                            res.json({ success: true, message: 'Cliente actualizado' });
                        });
                    });
            });
    });
});

app.put('/api/clientes/:id_persona/estatus', verificarToken, (req, res) => {
    const { id_persona } = req.params;
    const { estatus } = req.body;
    db.query('UPDATE CLIENTES SET estatus = ? WHERE id_persona = ?', [estatus, id_persona], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Estatus de ID ${id_persona} a ${estatus}`);
        res.json({ success: true });
    });
});

app.delete('/api/clientes/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'BORRADO_LOGICO', `Cliente ID ${id} eliminado`);
        res.json({ success: true });
    });
});

// --- RUTAS EXPEDIENTES ---
app.post('/api/expedientes/upload', verificarToken, upload.single('archivo'), (req, res) => {
    const { id_persona, tipo_documento } = req.body;
    if (!req.file) return res.status(400).json({ success: false });

    const rutaArchivo = `uploads/${req.file.filename}`;
    db.query('INSERT INTO EXPEDIENTES_CLIENTES (id_persona, nombre_archivo, ruta_archivo, tipo_documento) VALUES (?, ?, ?, ?)',
        [id_persona, req.file.originalname, rutaArchivo, tipo_documento], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'SUBIR_DOCUMENTO', `Documento a ID ${id_persona}`);
            res.json({ success: true, message: 'Archivo subido' });
        });
});

app.get('/api/expedientes/:id_persona', verificarToken, (req, res) => {
    const { id_persona } = req.params;
    db.query('SELECT * FROM EXPEDIENTES_CLIENTES WHERE id_persona = ? ORDER BY fecha_subida DESC', [id_persona], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// BORRAR ARCHIVO
app.delete('/api/expedientes/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    db.query('SELECT ruta_archivo FROM EXPEDIENTES_CLIENTES WHERE id = ?', [id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });

        const rutaFisica = path.join(__dirname, results[0].ruta_archivo);

        db.query('DELETE FROM EXPEDIENTES_CLIENTES WHERE id = ?', [id], (err2) => {
            if (err2) return res.status(500).json({ success: false });
            if (fs.existsSync(rutaFisica)) fs.unlinkSync(rutaFisica);

            registrarBitacora(req.usuario.id, 'ELIMINAR_DOCUMENTO', `Documento ID ${id} eliminado`);
            res.json({ success: true });
        });
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`Servidor Backend en puerto ${PORT}`); });