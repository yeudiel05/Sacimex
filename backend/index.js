require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'sacimex';

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

// =====================================================================
// RUTAS DE LOGIN
// =====================================================================
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

// =====================================================================
// SPRINT 1: RUTAS DEL MÓDULO DE CLIENTES
// =====================================================================
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

// =====================================================================
// SPRINT 2: MÓDULO DE INVERSORES
// =====================================================================

// 1. Obtener todos los inversores activos
app.get('/api/inversores', verificarToken, (req, res) => {
  const query = `
    SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, 
           p.telefono, p.email_contacto AS email, i.clabe_bancaria, i.banco, 
           i.origen_fondos, i.estatus_activo
    FROM PERSONAS p
    INNER JOIN INVERSORES i ON p.id = i.id_persona
    WHERE p.eliminado = FALSE
    ORDER BY p.id DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener inversores' });
    res.json({ success: true, data: results });
  });
});

// 2. Registrar un nuevo inversor
app.post('/api/inversores', verificarToken, (req, res) => {
  const { tipo_persona, nombre, rfc, direccion, telefono, email, clabe_bancaria, banco, origen_fondos } = req.body;

  if (!telefono || telefono.length !== 10) return res.status(400).json({ success: false, message: 'El teléfono debe tener 10 dígitos.' });
  if (!clabe_bancaria || clabe_bancaria.length !== 18) return res.status(400).json({ success: false, message: 'La CLABE interbancaria debe tener 18 dígitos.' });

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });
    
    const queryPersona = 'INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(queryPersona, [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
      if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error: Posible RFC duplicado.' }));
      
      const idNuevaPersona = resultPersona.insertId;
      
      const queryInversor = 'INSERT INTO INVERSORES (id_persona, clabe_bancaria, banco, origen_fondos, estatus_activo) VALUES (?, ?, ?, ?, 1)';
      db.query(queryInversor, [idNuevaPersona, clabe_bancaria, banco, origen_fondos], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error al registrar los datos bancarios.' }));
        
        db.commit(err => {
          if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error al confirmar guardado.' }));
          
          registrarBitacora(req.usuario.id, 'CREAR_INVERSOR', `Se registró al inversor ${nombre} con RFC ${rfc}`);
          res.json({ success: true, message: 'Inversor registrado exitosamente.' });
        });
      });
    });
  });
});

// 3. Cambiar estatus de un inversor (1 Activo / 0 Inactivo)
app.put('/api/inversores/:id_persona/estatus', verificarToken, (req, res) => {
  const { id_persona } = req.params;
  const { estatus_activo } = req.body; 

  db.query('UPDATE INVERSORES SET estatus_activo = ? WHERE id_persona = ?', [estatus_activo, id_persona], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al actualizar estatus' });
    
    const estadoTxt = estatus_activo ? 'ACTIVO' : 'INACTIVO';
    registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS_INVERSOR', `Estatus del inversor ID ${id_persona} cambió a ${estadoTxt}`);
    res.json({ success: true, message: 'Estatus actualizado' });
  });
});

// 3.5 Editar un inversor existente
app.put('/api/inversores/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const { tipo_persona, nombre, rfc, direccion, telefono, email, clabe_bancaria, banco, origen_fondos } = req.body;

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });
    
    db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?',
      [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error al actualizar datos personales.' }));
        
        db.query('UPDATE INVERSORES SET clabe_bancaria=?, banco=?, origen_fondos=? WHERE id_persona=?',
          [clabe_bancaria, banco, origen_fondos, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error al actualizar datos bancarios.' }));
            
            db.commit(err => {
              if (err) return db.rollback(() => res.status(500).json({ success: false }));
              registrarBitacora(req.usuario.id, 'EDITAR_INVERSOR', `Se actualizaron los datos del inversor ID ${id}`);
              res.json({ success: true, message: 'Inversor actualizado exitosamente.' });
            });
          });
      });
  });
});

// 3.6 Eliminar un inversor (Borrado Lógico)
app.delete('/api/inversores/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ success: false });
    registrarBitacora(req.usuario.id, 'BORRADO_LOGICO', `Inversor ID ${id} eliminado`);
    res.json({ success: true, message: 'Inversor eliminado correctamente' });
  });
});

// =====================================================================
// SPRINT 2: RUTAS DE CONTRATOS Y TASAS
// =====================================================================

// 4. Obtener el catálogo de tasas activas
app.get('/api/tasas', verificarToken, (req, res) => {
  db.query('SELECT * FROM CATALOGO_TASAS WHERE estatus_activo = 1', (err, results) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true, data: results });
  });
});

// 5. Obtener los contratos de un inversor específico
app.get('/api/contratos/:id_inversor', verificarToken, (req, res) => {
  const query = `
      SELECT c.*, t.nombre_tasa, t.tasa_anual_esperada 
      FROM CONTRATOS_INVERSION c
      JOIN CATALOGO_TASAS t ON c.id_tasa = t.id
      WHERE c.id_inversor = ? ORDER BY c.fecha_inicio DESC
  `;
  db.query(query, [req.params.id_inversor], (err, results) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true, data: results });
  });
});

// 6. Crear un nuevo contrato
app.post('/api/contratos', verificarToken, (req, res) => {
  const { id_inversor, id_tasa, monto_inicial, frecuencia_pagos, reinversion_automatica, fecha_inicio, fecha_fin } = req.body;
  const query = 'INSERT INTO CONTRATOS_INVERSION (id_inversor, id_tasa, monto_inicial, frecuencia_pagos, reinversion_automatica, fecha_inicio, fecha_fin, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, "ACTIVO")';
  
  db.query(query, [id_inversor, id_tasa, monto_inicial, frecuencia_pagos, reinversion_automatica, fecha_inicio, fecha_fin], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error al crear el contrato.' });
      registrarBitacora(req.usuario.id, 'CREAR_CONTRATO', `Contrato creado para inversor ID ${id_inversor} por $${monto_inicial}`);
      res.json({ success: true, message: 'Contrato de inversión activado exitosamente.' });
  });
});

// =====================================================================
// SPRINT 2: RUTAS DE BENEFICIARIOS
// =====================================================================

// 7. Obtener beneficiarios de un inversor
app.get('/api/beneficiarios/:id_inversor', verificarToken, (req, res) => {
  db.query('SELECT * FROM BENEFICIARIOS WHERE id_inversor = ?', [req.params.id_inversor], (err, results) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true, data: results });
  });
});

// 8. Registrar un nuevo beneficiario (Con doble validación matemática del 100%)
app.post('/api/beneficiarios', verificarToken, (req, res) => {
  const { id_inversor, nombre_completo, parentesco, porcentaje, fecha_nacimiento } = req.body;
  
  // Validamos en la BD cuánto porcentaje ya tiene asignado este inversor
  db.query('SELECT SUM(porcentaje) as total FROM BENEFICIARIOS WHERE id_inversor = ?', [id_inversor], (err, results) => {
      const totalActual = parseFloat(results[0].total) || 0;
      const nuevoTotal = totalActual + parseFloat(porcentaje);
      
      if (nuevoTotal > 100) {
          return res.status(400).json({ success: false, message: `No puedes exceder el 100%. Actualmente tienes ${totalActual}% asignado.` });
      }

      const query = 'INSERT INTO BENEFICIARIOS (id_inversor, nombre_completo, parentesco, porcentaje, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [id_inversor, nombre_completo, parentesco, porcentaje, fecha_nacimiento || null], (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Error al registrar beneficiario.' });
          registrarBitacora(req.usuario.id, 'AGREGAR_BENEFICIARIO', `Se agregó beneficiario a inversor ID ${id_inversor}`);
          res.json({ success: true, message: 'Beneficiario registrado exitosamente.' });
      });
  });
});

// 9. Eliminar un beneficiario
app.delete('/api/beneficiarios/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM BENEFICIARIOS WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ success: false });
      registrarBitacora(req.usuario.id, 'ELIMINAR_BENEFICIARIO', `Beneficiario ID ${req.params.id} eliminado`);
      res.json({ success: true });
  });
});

// =====================================================================
// SPRINT 2: RUTAS DE MOVIMIENTOS (ESTADO DE CUENTA)
// =====================================================================

// 10. Obtener historial de movimientos de un inversor (todos sus contratos)
app.get('/api/movimientos/:id_inversor', verificarToken, (req, res) => {
  const query = `
      SELECT m.*, c.id as contrato_id 
      FROM MOVIMIENTOS_INVERSION m
      JOIN CONTRATOS_INVERSION c ON m.id_contrato = c.id
      WHERE c.id_inversor = ?
      ORDER BY m.fecha_movimiento DESC
  `;
  db.query(query, [req.params.id_inversor], (err, results) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true, data: results });
  });
});

// 11. Registrar un nuevo movimiento con comprobante
app.post('/api/movimientos', verificarToken, upload.single('comprobante'), (req, res) => {
  const { id_contrato, tipo, monto } = req.body;
  
  if (!id_contrato || !tipo || !monto) {
      return res.status(400).json({ success: false, message: 'Faltan datos obligatorios.' });
  }

  // Si se subió un archivo, guardamos su ruta
  let recibo_comprobante = null;
  if (req.file) {
      recibo_comprobante = `uploads/${req.file.filename}`;
  }

  const query = 'INSERT INTO MOVIMIENTOS_INVERSION (id_contrato, tipo, monto, recibo_comprobante, estatus_movimiento) VALUES (?, ?, ?, ?, "COMPLETADO")';
  
  db.query(query, [id_contrato, tipo, monto, recibo_comprobante], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error al registrar el movimiento.' });
      
      registrarBitacora(req.usuario.id, 'REGISTRAR_MOVIMIENTO', `Se registró un ${tipo} de $${monto} en el contrato #${id_contrato}`);
      res.json({ success: true, message: 'Movimiento registrado correctamente.' });
  });
});

// =====================================================================
// SPRINT 2: GENERACIÓN DE PDF LEGAL (CONTRATOS)
// =====================================================================

// 12. Generar PDF de Contrato
app.get('/api/contratos/:id/pdf', verificarToken, (req, res) => {
  const idContrato = req.params.id;

  const query = `
      SELECT c.*, p.nombre_razon_social, p.rfc, p.direccion, i.clabe_bancaria, i.banco, t.nombre_tasa, t.tasa_anual_esperada 
      FROM CONTRATOS_INVERSION c
      JOIN INVERSORES i ON c.id_inversor = i.id_persona
      JOIN PERSONAS p ON i.id_persona = p.id
      JOIN CATALOGO_TASAS t ON c.id_tasa = t.id
      WHERE c.id = ?
  `;

  db.query(query, [idContrato], (err, results) => {
      if (err || results.length === 0) return res.status(404).send('Contrato no encontrado');

      const contrato = results[0];

      // Creamos el documento PDF
      const doc = new PDFDocument({ margin: 50 });
      
      // Le decimos al navegador que esto es un archivo descargable
      res.setHeader('Content-disposition', `attachment; filename=Contrato_Inversion_${contrato.id.toString().padStart(4, '0')}.pdf`);
      res.setHeader('Content-type', 'application/pdf');

      // Enviamos el PDF en tiempo real a la web
      doc.pipe(res);

      // --- DISEÑO DEL DOCUMENTO LEGAL ---
      doc.fontSize(18).font('Helvetica-Bold').text('CONTRATO DE INVERSIÓN', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(10).font('Helvetica').text(`Folio de Contrato: #${contrato.id.toString().padStart(4, '0')}`, { align: 'right' });
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-MX')}`, { align: 'right' });
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica-Bold').text('1. PARTES CONTRATANTES');
      doc.font('Helvetica').text(`Por una parte, OPCIONES SACIMEX (La Institución), y por la otra, el INVERSOR:`);
      doc.moveDown();
      doc.text(`Nombre / Razón Social: ${contrato.nombre_razon_social}`);
      doc.text(`RFC: ${contrato.rfc}`);
      doc.text(`Dirección: ${contrato.direccion}`);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('2. CONDICIONES DE LA INVERSIÓN');
      doc.font('Helvetica').text(`Monto del Capital: $${Number(contrato.monto_inicial).toLocaleString('es-MX')} MXN`);
      doc.text(`Producto Contratado: ${contrato.nombre_tasa} (${contrato.tasa_anual_esperada}% de rendimiento anual)`);
      doc.text(`Frecuencia de Pago de Intereses: ${contrato.frecuencia_pagos}`);
      doc.text(`Fecha de Inicio: ${new Date(contrato.fecha_inicio).toLocaleDateString('es-MX')}`);
      doc.text(`Fecha de Vencimiento: ${new Date(contrato.fecha_fin).toLocaleDateString('es-MX')}`);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('3. DATOS BANCARIOS DEL INVERSOR');
      doc.font('Helvetica').text(`Institución Bancaria: ${contrato.banco}`);
      doc.text(`CLABE Interbancaria: ${contrato.clabe_bancaria}`);
      doc.moveDown(4);

      // --- ÁREA DE FIRMAS ---
      doc.font('Helvetica-Bold').text('FIRMAS DE CONFORMIDAD', { align: 'center' });
      doc.moveDown(4);

      // Líneas de firma
      const finalY = doc.y;
      doc.text('__________________________________', 50, finalY, { width: 200, align: 'center' });
      doc.text('__________________________________', 350, finalY, { width: 200, align: 'center' });
      doc.moveDown();
      doc.font('Helvetica').fontSize(10);
      doc.text('OPCIONES SACIMEX', 50, doc.y, { width: 200, align: 'center' });
      doc.text(contrato.nombre_razon_social, 350, doc.y - 12, { width: 200, align: 'center' });

      // Finalizar PDF
      doc.end();
      
      registrarBitacora(req.usuario.id, 'DESCARGAR_CONTRATO', `Se descargó el PDF del contrato #${contrato.id}`);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`Servidor Backend corriendo en el puerto ${PORT}`); });