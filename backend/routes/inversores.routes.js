const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.body.id_contrato + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

function numeroALetras(num) {
    const unidades = ['Cero', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];
    const decenas = ['Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciseis', 'Diecisiete', 'Dieciocho', 'Diecinueve'];
    const decenasMultiplos = ['', '', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
    const centenas = ['', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'];

    function convertirGrupo(n) {
        let texto = '';
        let c = Math.floor(n / 100);
        let d = Math.floor((n % 100) / 10);
        let u = n % 10;

        if (c > 0) {
            if (c === 1 && d === 0 && u === 0) texto += 'Cien ';
            else texto += centenas[c] + ' ';
        }
        if (d === 1) texto += decenas[u] + ' ';
        else if (d > 1) {
            texto += decenasMultiplos[d] + ' ';
            if (u > 0) texto += 'y ' + unidades[u] + ' ';
        } else if (u > 0) {
            if (u === 1) texto += 'Un ';
            else texto += unidades[u] + ' ';
        }
        return texto.trim();
    }

    let enteros = Math.floor(num);
    let centavos = Math.round((num - enteros) * 100);
    let textoFinal = '';

    if (enteros === 0) textoFinal = 'Cero';
    else if (enteros > 999) {
        let miles = Math.floor(enteros / 1000);
        let resto = enteros % 1000;
        if (miles === 1) textoFinal += 'Mil ';
        else textoFinal += convertirGrupo(miles) + ' Mil ';
        if (resto > 0) textoFinal += convertirGrupo(resto);
    } else {
        textoFinal = convertirGrupo(enteros);
    }

    const centavosTexto = centavos.toString().padStart(2, '0');
    return `${textoFinal.toUpperCase()} PESOS ${centavosTexto}/100 M.N.`;
}

// ==========================================
// RUTAS CRUD
// ==========================================

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

// =========================================================================
// RUTA GENERADORA DE CONSTANCIA DE INVERSIÓN EN PDF
// =========================================================================
router.get('/contratos/:id/pdf', verificarToken, (req, res) => {
    const idContrato = req.params.id;

    const query = `
        SELECT c.id as contrato_id, c.monto_inicial, c.fecha_inicio, c.fecha_fin, 
               t.nombre_tasa, t.tasa_anual_esperada,
               p.nombre_razon_social as inversor, p.direccion, p.rfc
        FROM contratos_inversion c
        JOIN catalogo_tasas t ON c.id_tasa = t.id
        JOIN inversores i ON c.id_inversor = i.id_persona
        JOIN personas p ON i.id_persona = p.id
        WHERE c.id = ?
    `;

    db.query(query, [idContrato], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ success: false, message: 'Error o contrato no encontrado' });
        }

        const contrato = results[0];

        // Calcular días de plazo
        const fInicio = new Date(contrato.fecha_inicio);
        const fFin = new Date(contrato.fecha_fin);
        const plazoDias = Math.ceil((fFin - fInicio) / (1000 * 60 * 60 * 24));

        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

        res.setHeader('Content-disposition', `attachment; filename=Constancia_Sacimex_${contrato.contrato_id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // --- 1. LOGO Y CABECERA ---
        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 50 });
        }

        doc.fontSize(11).font('Helvetica-Bold')
           .text('OPCIONES SACIMEX S.A. DE C.V. SOFOM E.N.R.', 110, 45, { align: 'center' });
        doc.fontSize(10).font('Helvetica-Bold')
           .text('CONSTANCIA DE INVERSIÓN TÍTULOS CLASE III', 110, 60, { align: 'center' });
        
        // --- 2. TABLA DE DATOS DEL CONTRATO ---
        doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
        
        let currentY = 100;
        doc.text('SUCURSAL:', 50, currentY);
        doc.font('Helvetica').text('01.CORPORATIVO', 120, currentY);
        doc.font('Helvetica-Bold').text('NÚMERO DE CONSTANCIA:', 320, currentY);
        doc.font('Helvetica').text(String(contrato.contrato_id).padStart(5, '0'), 460, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('FECHA DE DEPÓSITO:', 50, currentY);
        doc.font('Helvetica').text(fInicio.toLocaleDateString('es-MX'), 170, currentY);
        doc.font('Helvetica-Bold').text('FECHA DE VENCIMIENTO:', 320, currentY);
        doc.font('Helvetica').text(fFin.toLocaleDateString('es-MX'), 460, currentY);

        currentY += 20;
        doc.font('Helvetica-Bold').text('NOMBRE:', 50, currentY);
        doc.font('Helvetica').text(contrato.inversor.toUpperCase(), 110, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('DOMICILIO:', 50, currentY);
        doc.font('Helvetica').text(contrato.direccion.toUpperCase(), 110, currentY, { width: 450 });

        currentY += 30;

        // --- 3. DATOS DE LA OPERACIÓN ---
        doc.rect(50, currentY, 510, 15).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').text('DATOS DE LA OPERACIÓN', 50, currentY + 4, { align: 'center' });
        
        currentY += 25;
        doc.fillColor('black'); 
        doc.font('Helvetica-Bold').text('MONTO DE INVERSIÓN:', 50, currentY);
        doc.font('Helvetica').text(`$${Number(contrato.monto_inicial).toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 175, currentY);
        
        doc.font('Helvetica-Bold').text('TASA NOMINAL:', 280, currentY);
        doc.font('Helvetica').text(`${contrato.tasa_anual_esperada}% Anual`, 360, currentY);
        
        doc.font('Helvetica-Bold').text('PLAZO:', 440, currentY);
        doc.font('Helvetica').text(`${plazoDias} Días`, 480, currentY);

        currentY += 20;
        doc.font('Helvetica-Bold').text('CANTIDAD CON LETRA:', 50, currentY);
        doc.font('Helvetica').text(numeroALetras(contrato.monto_inicial), 175, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('MONTO DE INTERÉS A RECIBIR AL VENCIMIENTO:', 50, currentY);
        doc.font('Helvetica').text('DE ACUERDO AL ESTADO DE CUENTA MENSUAL FECHA CORTE DIA CADA MES.', 305, currentY, { width: 255 });

        currentY += 30;
        doc.x = 50;
        doc.y = currentY;

        // --- 4. CLÁUSULAS Y LEGALES ---
        doc.font('Helvetica').fontSize(8);
        
        doc.text(`LA PRESENTE CONSTANCIA DE INVERSIÓN QUE SE EMITE A FAVOR DE C. `, 50, doc.y, { continued: true, align: 'justify', width: 510 });
        doc.font('Helvetica-Bold').text(`${contrato.inversor.toUpperCase()} `, { continued: true });
        doc.font('Helvetica').text(`(EN ADELANTE "INVERSIONISTA") POR CONDUCTO DE OPCIONES SACIMEX® S.A. DE C.V. SOFOM E.N.R. (EN ADELANTE "SACIMEX®") SE SUJETARÁ A LAS SIGUIENTES:`);
        doc.moveDown(1);

        doc.font('Helvetica-Bold').text('CLÁUSULAS', 50, doc.y, { width: 510, align: 'center' });
        doc.moveDown(0.5);

        const clausulas = [
            "LA CANTIDAD DEPOSITADA DE LA PRESENTE CONSTANCIA SOLO PODRÁ RETIRARSE HASTA SU VENCIMIENTO.",
            "EN LA SUCURSAL DONDE EL (LA) INVERSIONISTA DEPOSITE, SERÁ EL LUGAR DONDE DEBE RETIRAR EL DEPÓSITO.",
            "LA PRESENTE CONSTANCIA NO SERÁ NEGOCIABLE, EN FORMA ALGUNA, POR LO CUAL EL IMPORTE DEL MISMO, ASÍ COMO LOS INTERESES CORRESPONDIENTES, ÚNICAMENTE LE SERÁN ENTREGADOS AL TITULAR, APODERADO, O BENEFICIARIO EN CASO DE FALLECIMIENTO DEL (LA) INVERSIONISTA.",
            "LA PRESENTE CONSTANCIA SERÁ FIRMADA POR EL (LA) INVERSIONISTA EN DUPLICADO, QUEDANDO EL ORIGINAL PARA EL (LA) INVERSIONISTA, SALVO EN CASO DE GARANTIZAR CRÉDITOS AUTOMÁTICOS.",
            "LOS PORCENTAJES DE INTERÉS SERÁN FIJADOS POR EL CONSEJO DE ADMINISTRACIÓN O EN SU CASO POR EL COMITÉ DE CRÉDITO SEGÚN CORRESPONDA, NOTIFICANDO A EL INVERSIONISTA, POR MEDIO DE CIRCULAR O EN AVISO QUE SE FIJARÁ EN LAS OFICINAS DE SACIMEX®.",
            "EL BENEFICIARIO DEBERÁ SER MAYOR DE EDAD CUMPLIDOS AL MOMENTO DE LA FIRMA DEL CONTRATO Y LA PRESENTE CONSTANCIA Y DEBERÁ PRESENTAR SU IDENTIFICACIÓN OFICIAL AL MOMENTO DE EJERCER SU DERECHO.",
            "LOS INTERESES SERÁN PAGADOS TOTALMENTE AL DEPOSITANTE AL VENCIMIENTO DE LA CONSTANCIA, SI A LA FECHA DEL VENCIMIENTO EL (LA) INVERSIONISTA NO SE PRESENTA, SÉ REINVERTIRÁ LA CANTIDAD DEPOSITADA MÁS EL RENDIMIENTO TOTAL AL MISMO PLAZO Y A LA TASA DE INTERÉS VIGENTE.",
            "TODO LO RELATIVO A LOS DERECHOS Y OBLIGACIONES QUE SE DERIVEN DE ESTA CONSTANCIA SE CUMPLIRÁN DE ACUERDO A LO ESTABLECIDO EN EL CONTRATO DE INVERSIÓN A PLAZO FIJO CELEBRADO ENTRE EL (LA) INVERSIONISTA Y SACIMEX®."
        ];

        doc.font('Helvetica').fontSize(8);
        clausulas.forEach((texto, i) => {
            doc.text(`${i + 1}.- ${texto}`, 50, doc.y, { width: 510, align: 'justify', paragraphGap: 2 });
        });

        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(8).text(`DE LO ANTES EXPUESTO, AMBAS PARTES CONOCEN EL ALCANCE Y VALOR LEGAL DE LA PRESENTE CONSTANCIA, POR LO QUE UNA VEZ LEÍDO EL CONTENIDO DE LA MISMA EL DÍA ${new Date().toLocaleDateString('es-MX').toUpperCase()} PROCEDEN A FIRMARLA.`, 50, doc.y, { width: 510, align: 'justify' });

        doc.moveDown(3);

        // --- 5. FIRMAS ---
        const sigY = doc.y;
        
        doc.moveTo(80, sigY).lineTo(250, sigY).stroke();
        doc.font('Helvetica-Bold').text('INVERSIONISTA', 80, sigY + 5, { width: 170, align: 'center' });
        doc.font('Helvetica').text(`C. ${contrato.inversor.toUpperCase()}`, 80, sigY + 15, { width: 170, align: 'center' });

        doc.moveTo(350, sigY).lineTo(520, sigY).stroke();
        doc.font('Helvetica-Bold').text('PERSONAL AUTORIZADO', 350, sigY + 5, { width: 170, align: 'center' });
        doc.font('Helvetica').text('C. ELIZABETH CRUZ CANO', 350, sigY + 15, { width: 170, align: 'center' });

        doc.end();
        
        registrarBitacora(req.usuario.id, 'EXPORTAR_CONTRATO', `Descargó constancia de inversión del contrato #${contrato.contrato_id}`);
    });
});

module.exports = router;