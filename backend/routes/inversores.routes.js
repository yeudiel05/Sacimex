const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.body.id_contrato + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });


router.get('/', verificarToken, (req, res) => {
  const query = `
    SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, 
           p.telefono, p.email_contacto AS email, i.clabe_bancaria, i.banco, 
           i.origen_fondos, i.estatus_activo
    FROM PERSONAS p INNER JOIN INVERSORES i ON p.id = i.id_persona
    WHERE p.eliminado = FALSE ORDER BY p.id DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.post('/', verificarToken, (req, res) => {
  const { tipo_persona, nombre, rfc, direccion, telefono, email, clabe_bancaria, banco, origen_fondos } = req.body;
  db.beginTransaction(err => {
    if (err) return res.status(500).json({ success: false });
    db.query('INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)',
      [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
        if (err) return db.rollback(() => res.status(500).json({ success: false }));
        const idNuevaPersona = resultPersona.insertId;
        db.query('INSERT INTO INVERSORES (id_persona, clabe_bancaria, banco, origen_fondos, estatus_activo) VALUES (?, ?, ?, ?, 1)',
          [idNuevaPersona, clabe_bancaria, banco, origen_fondos], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false }));
            db.commit(err => {
              if (err) return db.rollback(() => res.status(500).json({ success: false }));
              registrarBitacora(req.usuario.id, 'CREAR_INVERSOR', `Se registró al inversor ${nombre}`);
              res.json({ success: true, message: 'Inversor registrado exitosamente.' });
            });
          });
      });
  });
});

router.put('/:id_persona/estatus', verificarToken, (req, res) => {
  db.query('UPDATE INVERSORES SET estatus_activo = ? WHERE id_persona = ?', [req.body.estatus_activo, req.params.id_persona], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

router.put('/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const { tipo_persona, nombre, rfc, direccion, telefono, email, clabe_bancaria, banco, origen_fondos } = req.body;
  db.beginTransaction(err => {
    if (err) return res.status(500).json({ success: false });
    db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
      if (err) return db.rollback(() => res.status(500).json({ success: false }));
      db.query('UPDATE INVERSORES SET clabe_bancaria=?, banco=?, origen_fondos=? WHERE id_persona=?', [clabe_bancaria, banco, origen_fondos, id], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ success: false }));
        db.commit(err => {
          if (err) return db.rollback(() => res.status(500).json({ success: false }));
          res.json({ success: true, message: 'Inversor actualizado.' });
        });
      });
    });
  });
});

router.delete('/:id', verificarToken, (req, res) => {
  db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

router.get('/tasas', verificarToken, (req, res) => {
  db.query('SELECT * FROM CATALOGO_TASAS WHERE estatus_activo = 1', (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.get('/contratos/:id_inversor', verificarToken, (req, res) => {
  db.query('SELECT c.*, t.nombre_tasa, t.tasa_anual_esperada FROM CONTRATOS_INVERSION c JOIN CATALOGO_TASAS t ON c.id_tasa = t.id WHERE c.id_inversor = ? ORDER BY c.fecha_inicio DESC', [req.params.id_inversor], (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.post('/contratos', verificarToken, (req, res) => {
  const { id_inversor, id_tasa, monto_inicial, frecuencia_pagos, reinversion_automatica, fecha_inicio, fecha_fin } = req.body;
  db.query('INSERT INTO CONTRATOS_INVERSION (id_inversor, id_tasa, monto_inicial, frecuencia_pagos, reinversion_automatica, fecha_inicio, fecha_fin, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, "ACTIVO")',
    [id_inversor, id_tasa, monto_inicial, frecuencia_pagos, reinversion_automatica, fecha_inicio, fecha_fin], (err) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true });
    });
});

router.get('/beneficiarios/:id_inversor', verificarToken, (req, res) => {
  db.query('SELECT * FROM BENEFICIARIOS WHERE id_inversor = ?', [req.params.id_inversor], (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.post('/beneficiarios', verificarToken, (req, res) => {
  const { id_inversor, nombre_completo, parentesco, porcentaje, fecha_nacimiento } = req.body;
  db.query('SELECT SUM(porcentaje) as total FROM BENEFICIARIOS WHERE id_inversor = ?', [id_inversor], (err, results) => {
    const nuevoTotal = (parseFloat(results[0].total) || 0) + parseFloat(porcentaje);
    if (nuevoTotal > 100) return res.status(400).json({ success: false, message: `Excede el 100%.` });
    db.query('INSERT INTO BENEFICIARIOS (id_inversor, nombre_completo, parentesco, porcentaje, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)', [id_inversor, nombre_completo, parentesco, porcentaje, fecha_nacimiento || null], (err) => {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true });
    });
  });
});

router.delete('/beneficiarios/:id', verificarToken, (req, res) => {
  db.query('DELETE FROM BENEFICIARIOS WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

router.get('/movimientos/:id_inversor', verificarToken, (req, res) => {
  db.query('SELECT m.*, c.id as contrato_id FROM MOVIMIENTOS_INVERSION m JOIN CONTRATOS_INVERSION c ON m.id_contrato = c.id WHERE c.id_inversor = ? ORDER BY m.fecha_movimiento DESC', [req.params.id_inversor], (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.post('/movimientos', verificarToken, upload.single('comprobante'), (req, res) => {
  const { id_contrato, tipo, monto } = req.body;
  let recibo = req.file ? `uploads/${req.file.filename}` : null;
  db.query('INSERT INTO MOVIMIENTOS_INVERSION (id_contrato, tipo, monto, recibo_comprobante, estatus_movimiento) VALUES (?, ?, ?, ?, "COMPLETADO")', [id_contrato, tipo, monto, recibo], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

router.get('/contratos/:id/pdf', verificarToken, (req, res) => {
  const query = `SELECT c.*, p.nombre_razon_social, p.rfc, p.direccion, i.clabe_bancaria, i.banco, t.nombre_tasa, t.tasa_anual_esperada FROM CONTRATOS_INVERSION c JOIN INVERSORES i ON c.id_inversor = i.id_persona JOIN PERSONAS p ON i.id_persona = p.id JOIN CATALOGO_TASAS t ON c.id_tasa = t.id WHERE c.id = ?`;
  db.query(query, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.status(404).send('No encontrado');
    const contrato = results[0];
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-disposition', `attachment; filename=Contrato_${contrato.id}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);
    doc.fontSize(18).font('Helvetica-Bold').text('CONTRATO DE INVERSIÓN', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Folio: #${contrato.id}`, { align: 'right' });
    doc.text(`Inversor: ${contrato.nombre_razon_social}`);
    doc.text(`Monto: $${contrato.monto_inicial}`);
    doc.end();
  });
});

module.exports = router;