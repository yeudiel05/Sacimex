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

// ==========================================
// UTILERÍAS
// ==========================================

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

function formatMoney(n) { 
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

// ==========================================
// RUTAS CRUD (FONDEADORES)
// ==========================================

router.get('/', verificarToken, (req, res) => {
  const query = `
    SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, 
           p.telefono, p.email_contacto AS email, i.clabe_bancaria, i.numero_cuenta, i.banco, 
           i.origen_fondos, i.estatus_activo, i.limite_credito
    FROM PERSONAS p INNER JOIN INVERSORES i ON p.id = i.id_persona
    WHERE p.eliminado = FALSE ORDER BY p.id DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.post('/', verificarToken, (req, res) => {
  const { 
      nombre, apellidos, rfc, direccion, telefono, email, 
      clabe_bancaria, numero_cuenta, banco, origen_fondos, limite_credito,
      ben_nombre, ben_parentesco, ben_telefono 
  } = req.body;

  const nombreCompleto = `${nombre} ${apellidos}`.trim();
  const rfcFinal = rfc ? rfc.toUpperCase() : 'XAXX010101000';

  db.beginTransaction(err => {
    if (err) {
        console.error("❌ Error al iniciar transacción:", err);
        return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
    
    db.query('INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)',
      ['FISICA', nombreCompleto, rfcFinal, direccion, telefono, email], (err, resultPersona) => {
        if (err) {
            console.error("❌ Error en INSERT PERSONAS:", err.sqlMessage || err);
            return db.rollback(() => res.status(500).json({ success: false, message: `Error en Personas: ${err.sqlMessage}` }));
        }
        
        const idNuevaPersona = resultPersona.insertId;
        
        db.query('INSERT INTO INVERSORES (id_persona, clabe_bancaria, numero_cuenta, banco, origen_fondos, estatus_activo, limite_credito) VALUES (?, ?, ?, ?, ?, 1, ?)',
          [idNuevaPersona, clabe_bancaria, numero_cuenta, banco, origen_fondos || 'AHORRO PERSONAL', limite_credito || 0], (err) => {
            if (err) {
                console.error("❌ Error en INSERT INVERSORES:", err.sqlMessage || err);
                return db.rollback(() => res.status(500).json({ success: false, message: `Error en Inversores: ${err.sqlMessage}` }));
            }
            
            if (ben_nombre) {
                db.query('INSERT INTO BENEFICIARIOS (id_inversor, nombre_completo, parentesco, telefono, porcentaje) VALUES (?, ?, ?, ?, 100)', 
                [idNuevaPersona, ben_nombre, ben_parentesco, ben_telefono], (err) => {
                    if (err) {
                        console.error("❌ Error en INSERT BENEFICIARIOS:", err.sqlMessage || err);
                        return db.rollback(() => res.status(500).json({ success: false, message: `Error en Beneficiarios: ${err.sqlMessage}` }));
                    }
                    commitFondeador();
                });
            } else {
                commitFondeador();
            }

            function commitFondeador() {
                db.commit(err => {
                  if (err) {
                      console.error("❌ Error en COMMIT:", err.sqlMessage || err);
                      return db.rollback(() => res.status(500).json({ success: false, message: "Error al guardar todo." }));
                  }
                  
                  try {
                      registrarBitacora(req.usuario.id, 'CREAR_FONDEADOR', `Se registró al fondeador: ${nombreCompleto} con límite de ${formatMoney(limite_credito)}`);
                  } catch (bitErr) {
                      console.error("⚠️ Aviso: Fondeador guardado, pero falló la bitácora:", bitErr);
                  }
                  
                  res.json({ success: true, message: 'Fondeador registrado exitosamente.' });
                });
            }
          });
      });
  });
});

router.put('/:id_persona/estatus', verificarToken, (req, res) => {
  const { id_persona } = req.params;
  const { estatus_activo } = req.body;

  db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_persona], (err, results) => {
      if (err || results.length === 0) return res.status(500).json({ success: false });
      const nombreFondeador = results[0].nombre_razon_social;
      
      db.query('UPDATE INVERSORES SET estatus_activo = ? WHERE id_persona = ?', [estatus_activo, id_persona], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Cambió el estatus a ${estatus_activo ? 'Activo' : 'Inactivo'} del fondeador: ${nombreFondeador}`);
        res.json({ success: true });
      });
  });
});

router.put('/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  const { tipo_persona, nombre, rfc, direccion, telefono, email, clabe_bancaria, numero_cuenta, banco, origen_fondos, limite_credito } = req.body;
  
  db.beginTransaction(err => {
    if (err) return res.status(500).json({ success: false });
    db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
      if (err) return db.rollback(() => res.status(500).json({ success: false }));
      
      db.query('UPDATE INVERSORES SET clabe_bancaria=?, numero_cuenta=?, banco=?, origen_fondos=?, limite_credito=? WHERE id_persona=?', [clabe_bancaria, numero_cuenta, banco, origen_fondos, limite_credito, id], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ success: false }));
        db.commit(err => {
          if (err) return db.rollback(() => res.status(500).json({ success: false }));
          registrarBitacora(req.usuario.id, 'EDITAR_FONDEADOR', `Actualizó los datos del fondeador: ${nombre}. Nuevo límite: ${formatMoney(limite_credito)}`);
          res.json({ success: true, message: 'Fondeador actualizado.' });
        });
      });
    });
  });
});

router.delete('/:id', verificarToken, (req, res) => {
  const id = req.params.id;
  db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id], (err, results) => {
      if (err || results.length === 0) return res.status(500).json({ success: false });
      const nombreFondeador = results[0].nombre_razon_social;
      
      db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'ELIMINAR_FONDEADOR', `Eliminó del directorio al fondeador: ${nombreFondeador}`);
        res.json({ success: true });
      });
  });
});

// ==========================================
// TASAS Y CONTRATOS DE INVERSIÓN
// ==========================================

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
  const { id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion, reinversion_automatica, fecha_inicio, fecha_fin, plan_json } = req.body;
  
  db.query('INSERT INTO CONTRATOS_INVERSION (id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion, plan_json, reinversion_automatica, fecha_inicio, fecha_fin, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "ACTIVO")',
    [id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion || 'frances', plan_json || null, reinversion_automatica, fecha_inicio, fecha_fin], (err) => {
      if (err) {
          console.error("Error al guardar contrato estático:", err);
          return res.status(500).json({ success: false, message: 'Error de servidor' });
      }
      res.json({ success: true });
    });
});

router.post('/inversion', verificarToken, (req, res) => {
    const { id_inversor, id_tasa, monto_inicial, frecuencia_pagos, plazo_meses, tipo_amortizacion, plan_json, fecha_inicio } = req.body;

    const fInicio = fecha_inicio ? new Date(fecha_inicio + 'T12:00:00') : new Date();
    const fFin = new Date(fInicio);
    fFin.setMonth(fInicio.getMonth() + parseInt(plazo_meses || 12));

    db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_inversor], (err, results) => {
        const nombreFondeador = (results && results.length > 0) ? results[0].nombre_razon_social : 'Fondeador Desconocido';

        const query = `
            INSERT INTO CONTRATOS_INVERSION 
            (id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion, plan_json, fecha_inicio, fecha_fin, estatus) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')
        `;

        db.query(query, [
            id_inversor, 
            id_tasa, 
            monto_inicial, 
            frecuencia_pagos, 
            tipo_amortizacion || 'frances', 
            plan_json || null, 
            fInicio.toISOString().split('T')[0], 
            fFin.toISOString().split('T')[0]
        ], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Error al registrar la inversión' });
            }
            registrarBitacora(req.usuario.id, 'NUEVA_INVERSION', `Inversión de $${monto_inicial} registrada para: ${nombreFondeador}`);
            res.json({ success: true, message: 'Fondeo registrado correctamente' });
        });
    });
});

// ==========================================
// BENEFICIARIOS Y MOVIMIENTOS
// ==========================================

router.get('/beneficiarios/:id_inversor', verificarToken, (req, res) => {
  db.query('SELECT * FROM BENEFICIARIOS WHERE id_inversor = ?', [req.params.id_inversor], (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

router.post('/beneficiarios', verificarToken, (req, res) => {
  const { id_inversor, nombre_completo, parentesco, telefono, porcentaje, fecha_nacimiento } = req.body;
  db.query('SELECT SUM(porcentaje) as total FROM BENEFICIARIOS WHERE id_inversor = ?', [id_inversor], (err, results) => {
    const nuevoTotal = (parseFloat(results[0].total) || 0) + parseFloat(porcentaje);
    if (nuevoTotal > 100) return res.status(400).json({ success: false, message: `Excede el 100%.` });
    
    db.query('INSERT INTO BENEFICIARIOS (id_inversor, nombre_completo, parentesco, telefono, porcentaje, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?)', 
    [id_inversor, nombre_completo, parentesco, telefono || null, porcentaje, fecha_nacimiento || null], (err) => {
      if (err) return res.status(500).json({ success: false });
      
      db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_inversor], (err, resPer) => {
          const nombreFondeador = (resPer && resPer.length > 0) ? resPer[0].nombre_razon_social : 'Desconocido';
          registrarBitacora(req.usuario.id, 'AGREGAR_BENEFICIARIO', `Agregó a ${nombre_completo} como beneficiario de: ${nombreFondeador}`);
          res.json({ success: true });
      });
    });
  });
});

router.delete('/beneficiarios/:id', verificarToken, (req, res) => {
  const { id } = req.params;
  db.query('SELECT nombre_completo FROM BENEFICIARIOS WHERE id = ?', [id], (err, results) => {
      const nombreBen = (results && results.length > 0) ? results[0].nombre_completo : 'Beneficiario';
      
      db.query('DELETE FROM BENEFICIARIOS WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'ELIMINAR_BENEFICIARIO', `Eliminó al beneficiario: ${nombreBen}`);
        res.json({ success: true });
      });
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
    
    db.query('SELECT p.nombre_razon_social FROM CONTRATOS_INVERSION c JOIN PERSONAS p ON c.id_inversor = p.id WHERE c.id = ?', [id_contrato], (err, results) => {
       const nombreFondeador = (results && results.length > 0) ? results[0].nombre_razon_social : 'Desconocido';
       registrarBitacora(req.usuario.id, 'REGISTRAR_MOVIMIENTO', `Registró un movimiento de $${monto} (${tipo}) para: ${nombreFondeador}`);
       res.json({ success: true });
    });
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
        JOIN personas p ON c.id_inversor = p.id
        WHERE c.id = ?
    `;

    db.query(query, [idContrato], (err, results) => {
        if (err) {
            console.error("❌ Error en SQL de Constancia PDF:", err);
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
        }

        const contrato = results[0];

        const fInicio = new Date(contrato.fecha_inicio);
        const fFin = new Date(contrato.fecha_fin);
        const plazoDias = Math.ceil((fFin - fInicio) / (1000 * 60 * 60 * 24));

        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

        res.setHeader('Content-disposition', `attachment; filename=Constancia_Sacimex_${contrato.contrato_id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 50 });
        }

        doc.fontSize(11).font('Helvetica-Bold')
           .text('OPCIONES SACIMEX S.A. DE C.V. SOFOM E.N.R.', 110, 45, { align: 'center' });
        doc.fontSize(10).font('Helvetica-Bold')
           .text('CONSTANCIA DE INVERSIÓN TÍTULOS CLASE III', 110, 60, { align: 'center' });
        
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

        const sigY = doc.y;
        
        doc.moveTo(80, sigY).lineTo(250, sigY).stroke();
        doc.font('Helvetica-Bold').text('INVERSIONISTA', 80, sigY + 5, { width: 170, align: 'center' });
        doc.font('Helvetica').text(`C. ${contrato.inversor.toUpperCase()}`, 80, sigY + 15, { width: 170, align: 'center' });

        doc.moveTo(350, sigY).lineTo(520, sigY).stroke();
        doc.font('Helvetica-Bold').text('PERSONAL AUTORIZADO', 350, sigY + 5, { width: 170, align: 'center' });
        doc.font('Helvetica').text('C. ELIZABETH CRUZ CANO', 350, sigY + 15, { width: 170, align: 'center' });

        doc.end();
        
        try {
            registrarBitacora(req.usuario.id, 'EXPORTAR_CONTRATO', `Descargó constancia del contrato #${contrato.contrato_id} perteneciente a: ${contrato.inversor}`);
        } catch (e) {
            console.error("Aviso: No se pudo registrar en bitácora", e);
        }
    });
});

// =========================================================================
// RUTA WYSIWYG: RECIBE LA TABLA YA CALCULADA DESDE REACT Y CREA EL PDF ESTILIZADO
// =========================================================================
router.post('/contratos/:id/tabla-amortizacion/generar-pdf', verificarToken, (req, res) => {
    const idContrato = req.params.id;
    const { tablaData, fondeador, montoInicial, tasa, sistema } = req.body;

    if (!tablaData || !Array.isArray(tablaData)) {
        return res.status(400).json({ success: false, message: 'Faltan los datos de la tabla.' });
    }

    try {
        // Colores Sacimex y diseño
        const COLOR_PRIMARIO_VERDE = '#0F6B38'; // Un verde corporativo profesional
        const COLOR_TEXTO_HEADER = '#FFFFFF';
        const COLOR_LINEAS = '#CBD5E1'; // Gris claro para líneas
        const COLOR_SHADING_FILAS = '#F8FAFC'; // Gris muy claro para filas alternas

        const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 30 });
        res.setHeader('Content-disposition', `attachment; filename=Amortizacion_Contrato_${idContrato}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // --- ENCABEZADO ESTILIZADO CON LOGO ---
        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 30, 30, { width: 60 });
        }
        
        doc.fontSize(14).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO_VERDE)
           .text('OPCIONES SACIMEX S.A. DE C.V. SOFOM E.N.R.', 100, 35);
        doc.fontSize(10).font('Helvetica').fillColor('black')
           .text('TABLA DE AMORTIZACIÓN DE FONDEO', 100, 52);
        doc.moveDown(1);
        doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).strokeColor(COLOR_LINEAS).stroke();
        doc.moveDown(1);

        // --- SECCIÓN DE INFORMACIÓN DEL CRÉDITO (TIPO GRID EXCEL) ---
        const startY = doc.y;
        const infoRowHeight = 18;

        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        
        // Columna Izquierda
        doc.text('EMPRESA:', 30, startY);
        doc.font('Helvetica').text('OPCIONES SACIMEX S.A. DE C.V.', 120, startY);
        
        doc.font('Helvetica-Bold').text('CRÉDITO:', 30, startY + infoRowHeight);
        doc.font('Helvetica').text(String(idContrato).padStart(5, '0'), 120, startY + infoRowHeight);
        
        doc.font('Helvetica-Bold').text('MONTO:', 30, startY + (infoRowHeight * 2));
        doc.font('Helvetica').text(formatMoney(montoInicial), 120, startY + (infoRowHeight * 2));

        doc.font('Helvetica-Bold').text('FONDEADOR:', 30, startY + (infoRowHeight * 3));
        doc.font('Helvetica').text(fondeador || 'N/A', 120, startY + (infoRowHeight * 3));

        // Columna Derecha
        const rightColX = 400;
        doc.font('Helvetica-Bold').text('MONEDA:', rightColX, startY);
        doc.font('Helvetica').text('MXN', rightColX + 110, startY);

        doc.font('Helvetica-Bold').text('TASA DE INT.:', rightColX, startY + infoRowHeight);
        doc.font('Helvetica').text(`${tasa}% Anual`, rightColX + 110, startY + infoRowHeight);

        doc.font('Helvetica-Bold').text('FECHA DISPOSICIÓN:', rightColX, startY + (infoRowHeight * 2));
        doc.font('Helvetica').text(tablaData[0] ? tablaData[0].fechaStr : 'S/N', rightColX + 110, startY + (infoRowHeight * 2));

        doc.font('Helvetica-Bold').text('SISTEMA:', rightColX, startY + (infoRowHeight * 3));
        doc.font('Helvetica').text(sistema.toUpperCase(), rightColX + 110, startY + (infoRowHeight * 3));

        doc.moveDown(2);
        let currentY = doc.y + 10;

        // --- TABLA DE AMORTIZACIÓN ESTILIZADA ---
        const colWidths = [35, 75, 85, 85, 85, 70, 85, 85, 40];
        const startX = 35;
        const headers = ['NO. PAGO', 'VENCIMIENTO', 'ABONO PRINCIPAL', 'ANTICIPO CAP.', 'INT. ORDINARIO', 'IVA', 'TOTAL PERIODO', 'SALDO INSOLUTO', 'DÍAS'];
        
        const drawTableHeader = (y) => {
            doc.rect(30, y - 6, doc.page.width - 60, 22).fillAndStroke(COLOR_PRIMARIO_VERDE, COLOR_PRIMARIO_VERDE);
            doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_TEXTO_HEADER);
            let x = startX;
            headers.forEach((h, i) => { 
                doc.text(h, x, y, { width: colWidths[i] - 5, align: i === 0 || i === 8 ? 'center' : 'right' }); 
                x += colWidths[i];
            });
            return y + 22;
        };

        currentY = drawTableHeader(currentY);
        doc.font('Helvetica').fontSize(8).fillColor('black');

        // --- DIBUJAR FILAS ---
        tablaData.forEach((row, rowIndex) => {
            let x = startX;
            const isAlternateRow = rowIndex % 2 === 1;

            if (isAlternateRow) {
                doc.rect(30, currentY - 4, doc.page.width - 60, 16).fill(COLOR_SHADING_FILAS);
            }

            const vals = [
                row.numero, 
                row.fechaStr, 
                formatMoney(row.abono), 
                formatMoney(row.anticipo), 
                formatMoney(row.interes), 
                formatMoney(row.iva), 
                formatMoney(row.pagoTotal), 
                formatMoney(row.saldoFinal),
                row.dias,
            ];
            
            doc.fillColor('black');
            vals.forEach((v, i) => { 
                doc.text(String(v), x, currentY, { width: colWidths[i] - 5, align: i === 0 || i === 8 ? 'center' : 'right' }); 
                x += colWidths[i]; 
            });
            currentY += 16;
            
            // Salto de página automático
            if (currentY > doc.page.height - 60) { 
                doc.addPage({layout:'landscape', margin:30}); 
                doc.fillColor(COLOR_PRIMARIO_VERDE).fontSize(10).font('Helvetica-Bold').text('CONTINUACIÓN - CONTRATO #' + String(idContrato).padStart(5, '0'), 30, 30, { align: 'center' });
                currentY = drawTableHeader(60);
                doc.font('Helvetica').fontSize(8).fillColor('black');
            }
        });

        // --- FILA DE TOTALES ESTILIZADA ---
        doc.rect(30, currentY - 4, doc.page.width - 60, 20).fill('#E2E8F0');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        
        doc.text('TOTALES:', startX, currentY, { width: colWidths[0] + colWidths[1] - 5, align: 'right' });
        
        const totalAbono = tablaData.reduce((acc, curr) => acc + curr.abono, 0);
        const totalAnticipo = tablaData.reduce((acc, curr) => acc + curr.anticipo, 0);
        const totalInteresOrd = tablaData.reduce((acc, curr) => acc + curr.interes, 0);
        const totalIva = tablaData.reduce((acc, curr) => acc + curr.iva, 0);
        const totalPagoGral = tablaData.reduce((acc, curr) => acc + curr.pagoTotal, 0);
        const totalDias = tablaData.reduce((acc, curr) => acc + curr.dias, 0);

        let tx = startX + colWidths[0] + colWidths[1];
        doc.text(formatMoney(totalAbono), tx, currentY, { width: colWidths[2] - 5, align: 'right' }); tx += colWidths[2];
        doc.text(formatMoney(totalAnticipo), tx, currentY, { width: colWidths[3] - 5, align: 'right' }); tx += colWidths[3];
        doc.text(formatMoney(totalInteresOrd), tx, currentY, { width: colWidths[4] - 5, align: 'right' }); tx += colWidths[4];
        doc.text(formatMoney(totalIva), tx, currentY, { width: colWidths[5] - 5, align: 'right' }); tx += colWidths[5];
        
        doc.fillColor(COLOR_PRIMARIO_VERDE);
        doc.text(formatMoney(totalPagoGral), tx, currentY, { width: colWidths[6] - 5, align: 'right' }); tx += colWidths[6];
        
        doc.fillColor('black');
        doc.text('-', tx, currentY, { width: colWidths[7] - 5, align: 'right' }); tx += colWidths[7];
        doc.text(String(totalDias), tx, currentY, { width: colWidths[8] - 5, align: 'center' });

        doc.end();
        
        try {
            registrarBitacora(req.usuario.id, 'EXPORTAR_AMORTIZACION_ESTILIZADA', `Descargó tabla interactiva estilizada del contrato #${idContrato}`);
        } catch (e) {
            console.error("Aviso: No se pudo registrar en bitácora", e);
        }
    } catch (pdfError) {
        console.error("Error al generar PDF:", pdfError);
        res.status(500).json({ success: false, message: 'Error interno al generar PDF' });
    }
});

module.exports = router;