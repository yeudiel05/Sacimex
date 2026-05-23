const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prov-' + req.body.id_proveedor + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const uploadExcel = multer({ storage: multer.memoryStorage() });

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
        if (c > 0) { if (c === 1 && d === 0 && u === 0) texto += 'Cien '; else texto += centenas[c] + ' '; }
        if (d === 1) texto += decenas[u] + ' ';
        else if (d > 1) { texto += decenasMultiplos[d] + ' '; if (u > 0) texto += 'y ' + unidades[u] + ' '; } 
        else if (u > 0) { if (u === 1) texto += 'Un '; else texto += unidades[u] + ' '; }
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
    } else { textoFinal = convertirGrupo(enteros); }

    return `${textoFinal.toUpperCase()} PESOS ${centavos.toString().padStart(2, '0')}/100 M.N.`;
}

function formatMoney(n) { 
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

// ==========================================
// RUTAS CRUD (PROVEEDORES)
// ==========================================
router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT 
            p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, 
            p.direccion AS ubicacion, p.telefono, p.email_contacto AS email, 
            pr.categoria, pr.numero_cuenta, pr.cuenta_bancaria AS clabe_bancaria, 
            pr.banco, pr.dias_credito, pr.estatus_activo 
        FROM personas p 
        INNER JOIN proveedores pr ON p.id = pr.id_persona 
        WHERE p.eliminado = FALSE 
        ORDER BY p.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al cargar proveedores' });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo al iniciar transacción BD.' });
        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', 
        [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: `El RFC ya existe o formato inválido.` }));
            
            const idNuevaPersona = resultPersona.insertId;
            db.query('INSERT INTO proveedores (id_persona, categoria, numero_cuenta, cuenta_bancaria, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, ?, 1)', 
            [idNuevaPersona, categoria || 'OTROS', numero_cuenta || '', clabe_bancaria || '', banco, dias_credito || 0], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: `Error en BD Proveedores: ${err.message}` }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Fallo al hacer COMMIT.' }));
                    registrarBitacora(req.usuario.id, 'CREAR_PROVEEDOR', `Se registró al proveedor: ${nombre}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo en BD' });
        db.query('UPDATE personas SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', 
        [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: err.message }));
            db.query('UPDATE proveedores SET categoria=?, numero_cuenta=?, cuenta_bancaria=?, banco=?, dias_credito=? WHERE id_persona=?', 
            [categoria || 'OTROS', numero_cuenta || '', clabe_bancaria || '', banco, dias_credito, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: err.message }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    registrarBitacora(req.usuario.id, 'EDITAR_PROVEEDOR', `Actualizó los datos de: ${nombre}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const nombreProveedor = results[0].nombre_razon_social;
        db.query('UPDATE proveedores SET estatus_activo = ? WHERE id_persona = ?', [req.body.estatus_activo, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Cambió estatus a ${req.body.estatus_activo ? 'Activo' : 'Suspendido'} del proveedor: ${nombreProveedor}`);
            res.json({ success: true });
        });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        db.query('UPDATE personas SET eliminado = TRUE WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'ELIMINAR_PROVEEDOR', `Eliminó del directorio al proveedor: ${results[0].nombre_razon_social}`);
            res.json({ success: true });
        });
    });
});

// ==========================================
// FLUJO DE SOLICITUDES DE PAGO Y MOTOR DE REGLAS
// ==========================================

router.get('/:id/pagos', verificarToken, (req, res) => {
    db.query('SELECT * FROM solicitudes_pago WHERE id_proveedor = ? ORDER BY fecha_creacion DESC', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/pagos', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_proveedor, id_concepto, unidad_negocio, justificacion, monto_pago } = req.body;
    let url = req.file ? `uploads/${req.file.filename}` : null;
    
    // Todos entran por revisión
    const estatus = 'PENDIENTE_REVISION';
    
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [id_proveedor], (err, results) => {
        const nombreProveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Desconocido';
        
        // Generar un folio
        const folio = `SOL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        db.query('INSERT INTO solicitudes_pago (folio, id_solicitante, id_proveedor, id_concepto, unidad_negocio, monto_total, justificacion, archivo_factura_pdf, estatus_actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [folio, req.usuario.id, id_proveedor, id_concepto, unidad_negocio, monto_pago, justificacion, url, estatus], (err, insertResult) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            
            registrarBitacora(req.usuario.id, 'SOLICITUD_PAGO', `Envió solicitud de pago ${folio} a favor de: ${nombreProveedor}`);
            res.json({ success: true, message: 'Solicitud enviada al Revisor' });
        });
    });
});

// EL MOTOR DE AUTORIZACIONES (WORKFLOW ENGINE)
router.put('/pagos/:id_pago/autorizacion', verificarToken, (req, res) => {
    const { id_pago } = req.params;
    const { accion } = req.body; // 'APROBAR' o 'RECHAZAR'
    
    db.query('SELECT * FROM solicitudes_pago WHERE id = ?', [id_pago], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
        const pago = rows[0];
        const monto = parseFloat(pago.monto_total);
        const estatusActual = pago.estatus_actual;

        if (accion === 'RECHAZAR') {
            db.query("UPDATE solicitudes_pago SET estatus_actual = 'RECHAZADO' WHERE id = ?", [id_pago], (err) => {
                registrarBitacora(req.usuario.id, 'RECHAZO_PAGO', `Rechazó la solicitud #${pago.folio}`);
                return res.json({ success: true, message: 'Pago rechazado.' });
            });
            return;
        }

        if (accion === 'APROBAR') {
            // Reglas de negocio (Matriz)
            let workflow = ['PENDIENTE_REVISION', 'PENDIENTE_AUT_1'];
            if (monto > 30000) workflow.push('PENDIENTE_AUT_2');
            if (monto > 100000) workflow.push('PENDIENTE_AUT_3');
            workflow.push('EN_TESORERIA');
            workflow.push('PAGADO');

            let indiceActual = workflow.indexOf(estatusActual);
            if (indiceActual === -1 || indiceActual >= workflow.length - 1) {
                return res.status(400).json({ success: false, message: 'No se puede avanzar esta solicitud.' });
            }

            let nuevoEstatus = workflow[indiceActual + 1];

            db.beginTransaction(err => {
                if (err) return res.status(500).json({ success: false });

                // Avanzar el estatus de la solicitud
                db.query('UPDATE solicitudes_pago SET estatus_actual = ? WHERE id = ?', [nuevoEstatus, id_pago], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));

                    // Guardar en el historial de firmas para el PDF
                    db.query('INSERT INTO historial_firmas_pago (id_solicitud, id_usuario, etapa_firma, estatus_firma) VALUES (?, ?, ?, ?)', 
                    [id_pago, req.usuario.id, estatusActual, 'APROBADO'], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        
                        db.commit(err => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false }));
                            
                            registrarBitacora(req.usuario.id, 'AUTORIZACION_PAGO', `Aprobó la solicitud ${pago.folio} en etapa ${estatusActual}. Avanzó a ${nuevoEstatus}`);
                            res.json({ success: true, message: `Aprobado. Siguiente etapa: ${nuevoEstatus.replace(/_/g, ' ')}` });
                        });
                    });
                });
            });
        }
    });
});

// ==========================================
// RUTA GENERADORA DE PDF CON FIRMAS (EL FORMATO SAC-TSR-RCS)
// ==========================================
router.get('/autorizaciones/:id/pdf', verificarToken, (req, res) => {
    const query = `
        SELECT sp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.cuenta_bancaria AS clabe_bancaria, 
               u.nombre_completo as solicitante, cp.descripcion as desc_concepto
        FROM solicitudes_pago sp
        JOIN proveedores pr ON sp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        JOIN usuarios_aprobadores u ON sp.id_solicitante = u.id
        JOIN conceptos_pago cp ON sp.id_concepto = cp.id
        WHERE sp.id = ?
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).send('Solicitud no encontrada');
        const pago = results[0];

        // Buscar firmas en el historial para ponerlas en el PDF
        db.query(`
            SELECT h.etapa_firma, u.nombre_completo, u.ruta_firma_png 
            FROM historial_firmas_pago h 
            JOIN usuarios_aprobadores u ON h.id_usuario = u.id 
            WHERE h.id_solicitud = ? AND h.estatus_firma = 'APROBADO'
        `, [req.params.id], (err, firmas) => {
            
            const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
            res.setHeader('Content-disposition', `attachment; filename=Solicitud_${pago.folio}.pdf`);
            res.setHeader('Content-type', 'application/pdf');
            doc.pipe(res);

            const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
            if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 40, { width: 70 });

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#16a34a').text('SOLICITUD UNIVERSAL DE RECURSOS 2026', 0, 40, { align: 'right' });
            doc.text(pago.folio, 0, 52, { align: 'right' });
            
            doc.rect(480, 68, 90, 13).fill('#fef08a');
            doc.fillColor('black').fontSize(9).font('Helvetica').text('Oaxaca de Juárez, Oax., a', 350, 71, { align: 'left' });
            doc.font('Helvetica-Bold').text(new Date(pago.fecha_creacion).toLocaleDateString('es-MX'), 485, 71);

            doc.font('Helvetica-Bold').text('C. BEATRIZ CRUZ CANO', 40, 95);
            doc.font('Helvetica').text('TESORERÍA', 40, 107);
            doc.text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 40, 119);

            doc.text('Por medio del presente solicito recurso para: ', 40, 150, { continued: true }).font('Helvetica-Bold').text(pago.desc_concepto);
            doc.font('Helvetica').text('correspondiente a la unidad de negocio: ', 40, 165);
            doc.rect(230, 163, 110, 12).fill('#fef08a');
            doc.fillColor('black').font('Helvetica-Bold').text(pago.unidad_negocio, 235, 165);

            doc.rect(40, 185, 530, 15).fill('#fef08a');
            doc.fillColor('black').font('Helvetica').text('Por la cantidad de: ', 45, 188, { continued: true }).font('Helvetica-Bold').text(`$${Number(pago.monto_total).toLocaleString('es-MX', {minimumFractionDigits:2})}    ( ${numeroALetras(pago.monto_total)} )`);

            doc.font('Helvetica-Bold').text('DATOS DEL PROVEEDOR O BENEFICIARIO', 40, 250);
            doc.moveTo(40, 260).lineTo(570, 260).stroke('#cbd5e1'); 
            doc.fontSize(8).text('DESCRIPCIÓN ESPECÍFICA DE LA FINALIDAD DEL RECURSO:', 40, 270);
            doc.font('Helvetica').text(pago.justificacion, 40, 282);
            
            doc.font('Helvetica-Bold').text('CUENTA/CLABE', 200, 310);
            doc.font('Helvetica').text(pago.numero_cuenta || pago.clabe_bancaria || 'N/D', 200, 322);
            doc.font('Helvetica-Bold').text('BANCO', 360, 310);
            doc.font('Helvetica').text(pago.banco || 'N/D', 360, 322);
            
            doc.font('Helvetica-Bold').text('NOMBRE DEL PROVEEDOR', 40, 350);
            doc.font('Helvetica').text(pago.proveedor, 40, 362);

            // ZONA DE FIRMAS DIBUJADAS DINÁMICAMENTE DESDE EL HISTORIAL
            const sigY1 = 480;
            doc.fillColor('black');
            doc.moveTo(50, sigY1).lineTo(200, sigY1).stroke();
            doc.font('Helvetica-Bold').fontSize(7).text('SOLICITADO POR', 50, sigY1 + 5, { width: 150, align: 'center' });
            doc.font('Helvetica').text(pago.solicitante.toUpperCase(), 50, sigY1 + 15, { width: 150, align: 'center' });

            if (firmas && firmas.length > 0) {
                let sigXOffset = 250;
                firmas.forEach(firma => {
                    if(firma.ruta_firma_png) {
                        const firmaImg = path.join(__dirname, '../uploads/', firma.ruta_firma_png);
                        if (fs.existsSync(firmaImg)) {
                            // Estampa la firma visualmente justo sobre la línea
                            doc.image(firmaImg, sigXOffset, sigY1 - 40, { width: 80 }); 
                        }
                    }
                    doc.moveTo(sigXOffset, sigY1).lineTo(sigXOffset + 150, sigY1).stroke();
                    doc.font('Helvetica-Bold').text(firma.etapa_firma.replace('PENDIENTE_', ''), sigXOffset, sigY1 + 5, { width: 150, align: 'center' });
                    doc.font('Helvetica').text(firma.nombre_completo, sigXOffset, sigY1 + 15, { width: 150, align: 'center' });
                    sigXOffset += 180;
                });
            }

            if(pago.estatus_actual === 'PAGADO'){
                doc.save();
                doc.rotate(-20, { origin: [300, 500] });
                doc.fontSize(45).font('Helvetica-Bold').fillColor('rgba(22, 163, 74, 0.15)').text('PAGADO', 160, 480);
                doc.restore();
            }
            doc.end();
        });
    });
});

// ==========================================
// RUTAS DE REPORTES E IMPORTACIÓN
// ==========================================
router.get('/reportes/pagos-por-vencer', verificarToken, (req, res) => {
    const query = `
        SELECT sp.id AS id_pago, p.nombre_razon_social AS proveedor, sp.justificacion as concepto, sp.monto_total as monto_pago,
               sp.estatus_actual as estatus, DATE(sp.fecha_creacion) as fecha_solicitud, pr.dias_credito,
               DATE_ADD(sp.fecha_creacion, INTERVAL pr.dias_credito DAY) AS fecha_vencimiento,
               DATEDIFF(DATE_ADD(sp.fecha_creacion, INTERVAL pr.dias_credito DAY), CURDATE()) AS dias_restantes
        FROM solicitudes_pago sp
        JOIN proveedores pr ON sp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        WHERE sp.estatus_actual NOT IN ('PAGADO', 'RECHAZADO')
        ORDER BY fecha_vencimiento ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de base de datos' });
        res.json({ success: true, data: results });
    });
});

router.post('/importar', verificarToken, uploadExcel.single('archivo_excel'), async (req, res) => {
    // Código de importación sin cambios
    if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        let procesados = 0, errores = 0;

        for (const row of data) {
            const rfc_original = row['RFC'] ? row['RFC'].toString().trim().toUpperCase() : null;
            const nombre = row['NOMBRE'] ? row['NOMBRE'].toString().trim() : null;
            if (!rfc_original || !nombre) { errores++; continue; }

            let tipo_persona = rfc_original.length === 13 ? 'FISICA' : 'MORAL';
            try {
                await new Promise((resolve, reject) => {
                    db.beginTransaction(err => {
                        if (err) return reject(err);
                        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', 
                        [tipo_persona, nombre, rfc_original, '', '', ''], (err, resultPersona) => {
                            if (err) return db.rollback(() => reject(err));
                            db.query('INSERT INTO proveedores (id_persona, categoria, numero_cuenta, cuenta_bancaria, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, ?, 1)', 
                            [resultPersona.insertId, 'OTROS', '', '', '', 0], (err) => {
                                if (err) return db.rollback(() => reject(err));
                                db.commit(err => { if (err) return db.rollback(() => reject(err)); resolve(); });
                            });
                        });
                    });
                });
                procesados++;
            } catch (err) { errores++; }
        }
        res.json({ success: true, message: `Proveedores importados: ${procesados}. Omitidos/Duplicados: ${errores}.` });
    } catch (error) { res.status(500).json({ success: false, message: 'Error procesando Excel' }); }
});

module.exports = router;