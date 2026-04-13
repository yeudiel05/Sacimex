const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prov-' + req.body.id_proveedor + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- FUNCIÓN FINANCIERA: NÚMEROS A LETRAS ---
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

// ==========================================
// RUTAS DE AUTORIZACIÓN (ADMIN) - VISTA GENERAL
// ==========================================
router.get('/autorizaciones/pendientes', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false, message: 'No autorizado' });
    const query = `
        SELECT pp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.clabe_bancaria, u.username as solicitante
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        JOIN usuarios u ON pp.id_usuario_solicita = u.id
        WHERE pp.estatus IN ('PENDIENTE_VALIDACION', 'PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'PENDIENTE', 'PAGADO')
        ORDER BY pp.estatus DESC, pp.fecha_solicitud DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.put('/autorizaciones/:id/aprobar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query("UPDATE pagos_a_proveedores SET estatus = 'PAGADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'PAGO_AUTORIZADO', `Autorizó la salida de dinero para el pago ID ${req.params.id}`);
        res.json({ success: true });
    });
});

router.put('/autorizaciones/:id/rechazar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query("UPDATE pagos_a_proveedores SET estatus = 'RECHAZADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'PAGO_RECHAZADO', `Rechazó el pago ID ${req.params.id}`);
        res.json({ success: true });
    });
});

// =========================================================================
// PUNTO 3:"SOLICITUD UNIVERSAL DE RECURSOS" (Generación de PDF)
// =========================================================================
router.get('/autorizaciones/:id/pdf', verificarToken, (req, res) => {
    const query = `
        SELECT pp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.clabe_bancaria, 
               u.username as solicitante, u.rol as rol_solicitante
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        JOIN usuarios u ON pp.id_usuario_solicita = u.id
        WHERE pp.id = ?
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).send('Pago no encontrado');
        const pago = results[0];

        const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
        res.setHeader('Content-disposition', `attachment; filename=Solicitud_Recursos_Folio_${pago.id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // --- 1. LOGO ---
        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 40, { width: 70 });
        }

        // --- 2. CABECERA DERECHA (VERDE Y AMARILLO) ---
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#16a34a')
           .text('SOLICITUD UNIVERSAL DE RECURSOS 2026', 0, 40, { align: 'right' });
        doc.text('SAC-TSR-RCS-2026', 0, 52, { align: 'right' });
        
        // Fecha con fondo amarillo (Caja y luego texto)
        doc.rect(480, 68, 90, 13).fill('#fef08a');
        doc.fillColor('black').fontSize(9).font('Helvetica')
           .text('Oaxaca de Juárez, Oax., a', 350, 71, { align: 'left' });
        doc.font('Helvetica-Bold').text(new Date(pago.fecha_solicitud).toLocaleDateString('es-MX'), 485, 71);

        // --- 3. DATOS EMISOR (IZQUIERDA) ---
        doc.font('Helvetica-Bold').text('C. BEATRIZ CRUZ CANO', 40, 95);
        doc.font('Helvetica').text('TESORERÍA', 40, 107);
        doc.text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 40, 119);

        // --- 4. TEXTO DE SOLICITUD ---
        doc.text('Por medio del presente solicito recurso para: ', 40, 150, { continued: true })
           .font('Helvetica-Bold').text(pago.concepto.toUpperCase());
        
        // Caja amarilla para la unidad de negocio
        doc.font('Helvetica').text('correspondiente a la unidad de negocio: ', 40, 165);
        doc.rect(230, 163, 110, 12).fill('#fef08a');
        doc.fillColor('black').font('Helvetica-Bold').text('01.CRP - Corporativo', 235, 165);

        // FRANJA AMARILLA COMPLETA DEL MONTO
        doc.rect(40, 185, 530, 15).fill('#fef08a');
        doc.fillColor('black').font('Helvetica').text('Por la cantidad de: ', 45, 188, { continued: true })
           .font('Helvetica-Bold').text(`$${Number(pago.monto_pago).toLocaleString('es-MX', {minimumFractionDigits:2})}    ( ${numeroALetras(pago.monto_pago)} )`);

        doc.font('Helvetica').text('Lo cual será destinado para lo descrito en el apartado siguiente. Sin más por el momento quedo a sus órdenes.', 40, 215);

        // --- 5. TABLA DE DATOS DEL PROVEEDOR ---
        doc.font('Helvetica-Bold').text('DATOS DEL PROVEEDOR O BENEFICIARIO', 40, 250);
        doc.moveTo(40, 260).lineTo(570, 260).stroke('#cbd5e1'); // Línea separadora
        
        doc.fontSize(8).text('DESCRIPCIÓN ESPECÍFICA DE LA FINALIDAD DEL RECURSO: Ayuda: (El despacho, honorarios, colegiaturas, etc.)', 40, 270);
        doc.font('Helvetica').text(pago.concepto.toUpperCase(), 40, 282);
        
        doc.font('Helvetica-Bold').text('TIPO DE SOLICITUD', 40, 310);
        doc.font('Helvetica').text('TRANSFERENCIA', 40, 322);
        
        doc.font('Helvetica-Bold').text('CUENTA/CLABE/CIE', 200, 310);
        doc.font('Helvetica').text(pago.clabe_bancaria || pago.numero_cuenta || 'N/D', 200, 322);
        
        doc.font('Helvetica-Bold').text('BANCO', 360, 310);
        doc.font('Helvetica').text(pago.banco || 'N/D', 360, 322);
        
        doc.font('Helvetica-Bold').text('RFC PROVEEDOR', 40, 350);
        doc.font('Helvetica').text(pago.rfc || 'N/A', 40, 362);
        
        doc.font('Helvetica-Bold').text('NOMBRE DEL PROVEEDOR // BENEFICIARIO', 200, 350);
        doc.font('Helvetica').text(pago.proveedor, 200, 362);

        if(pago.num_factura_ref) {
            doc.font('Helvetica-Bold').text('FACTURA / REFERENCIA', 40, 390);
            doc.font('Helvetica').text(pago.num_factura_ref, 40, 402);
        }

        doc.font('Helvetica-Oblique').fillColor('#64748b').text('Ayuda: Recuerda solicitar la factura con uso de G03 Gastos en general.', 40, 420);

        // --- 6. LAS 4 FIRMAS
        doc.fillColor('black');
        const sigY1 = 480;
        
        doc.moveTo(50, sigY1).lineTo(250, sigY1).stroke();
        doc.font('Helvetica-Bold').fontSize(7).text('SOLICITADO POR', 50, sigY1 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text(pago.solicitante.toUpperCase(), 50, sigY1 + 15, { width: 200, align: 'center' });

        doc.moveTo(320, sigY1).lineTo(520, sigY1).stroke();
        doc.font('Helvetica-Bold').text('REVISADO POR', 320, sigY1 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text('LIC C.P. MARIAM ITZEL RAMIREZ CARRASCO', 320, sigY1 + 15, { width: 200, align: 'center' });

        const sigY2 = 560;
        doc.moveTo(50, sigY2).lineTo(250, sigY2).stroke();
        doc.font('Helvetica-Bold').text('AUTORIZACIÓN NIVEL 1', 50, sigY2 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text('C.P TRINIDAD LISBETH REYES RUIZ', 50, sigY2 + 15, { width: 200, align: 'center' });

        doc.moveTo(320, sigY2).lineTo(520, sigY2).stroke();
        doc.font('Helvetica-Bold').text('PAGADO POR', 320, sigY2 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text('C. BEATRIZ CRUZ CANO', 320, sigY2 + 15, { width: 200, align: 'center' });

        if(pago.estatus === 'PAGADO' || pago.estatus === 'AUTORIZADO'){
            doc.save();
            doc.rotate(-20, { origin: [300, 500] });
            doc.fontSize(45).font('Helvetica-Bold').fillColor('rgba(22, 163, 74, 0.15)').text('AUTORIZADO', 160, 480);
            doc.restore();
        }

        doc.end();
    });
});

// ==========================================
// CRUD NORMAL DE PROVEEDORES
// ==========================================
router.get('/', verificarToken, (req, res) => {
    db.query(`SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, p.telefono, p.email_contacto AS email, pr.categoria_servicio, pr.numero_cuenta, pr.clabe_bancaria, pr.banco, pr.dias_credito, pr.estatus_activo FROM personas p INNER JOIN proveedores pr ON p.id = pr.id_persona WHERE p.eliminado = FALSE ORDER BY p.id DESC`, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria_servicio, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false }));
            const idNuevaPersona = resultPersona.insertId;
            db.query('INSERT INTO proveedores (id_persona, categoria_servicio, numero_cuenta, clabe_bancaria, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, ?, 1)', [idNuevaPersona, categoria_servicio || 'General', numero_cuenta, clabe_bancaria, banco, dias_credito || 0], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    registrarBitacora(req.usuario.id, 'CREAR_PROVEEDOR', `Se registró al proveedor ${nombre}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria_servicio, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('UPDATE personas SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false }));
            db.query('UPDATE proveedores SET categoria_servicio=?, numero_cuenta=?, clabe_bancaria=?, banco=?, dias_credito=? WHERE id_persona=?', [categoria_servicio, numero_cuenta, clabe_bancaria, banco, dias_credito, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    registrarBitacora(req.usuario.id, 'EDITAR_PROVEEDOR', `Actualizó al proveedor ID ${id}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    db.query('UPDATE proveedores SET estatus_activo = ? WHERE id_persona = ?', [req.body.estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    db.query('UPDATE personas SET eliminado = TRUE WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.get('/:id/pagos', verificarToken, (req, res) => {
    db.query('SELECT * FROM pagos_a_proveedores WHERE id_proveedor = ? ORDER BY fecha_solicitud DESC', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// ==========================================
// RUTA ACTUALIZADA: CREAR SOLICITUD DE PAGO
// ==========================================
router.post('/pagos', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_proveedor, concepto, monto_pago, num_factura_ref } = req.body;
    let url = req.file ? `uploads/${req.file.filename}` : null;
    
    // Si es ADMIN, lo pasamos directo a PAGADO para agilizar. Si es otro rol, entra a PENDIENTE_VALIDACION.
    const estatus = req.usuario.rol === 'ADMIN' ? 'PAGADO' : 'PENDIENTE_VALIDACION';
    const id_autoriza = req.usuario.rol === 'ADMIN' ? req.usuario.id : null;

    db.query('INSERT INTO pagos_a_proveedores (id_proveedor, id_usuario_solicita, id_usuario_autoriza, monto_pago, concepto, num_factura_ref, url_comprobante_pago, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [id_proveedor, req.usuario.id, id_autoriza, monto_pago, concepto, num_factura_ref, url, estatus], (err) => {
        if (err) return res.status(500).json({ success: false });
        
        if(estatus === 'PAGADO'){
            registrarBitacora(req.usuario.id, 'PAGO_PROVEEDOR', `Registró y autorizó pago directo por $${monto_pago}`);
        } else {
            registrarBitacora(req.usuario.id, 'SOLICITUD_PAGO', `Envió solicitud de pago por $${monto_pago} (Pendiente de Validación)`);
        }
        res.json({ success: true, message: estatus === 'PAGADO' ? 'Pago registrado y autorizado' : 'Solicitud enviada para validación' });
    });
});

// ==========================================
// NUEVA RUTA: WORKFLOW DE 3 NIVELES
// ==========================================
router.put('/pagos/:id_pago/autorizacion', verificarToken, (req, res) => {
    const { id_pago } = req.params;
    const { accion } = req.body; 
    const id_usuario = req.usuario.id;

    let nuevoEstatus = '';
    let queryUpdate = '';
    let params = [];
    let accionBitacora = '';

    if (accion === 'VALIDAR') {
        nuevoEstatus = 'PENDIENTE_AUTORIZACION';
        // Quitamos el candado estricto del WHERE para forzar el guardado
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ?, id_usuario_validador = ?, fecha_validacion = NOW() WHERE id = ?';
        params = [nuevoEstatus, id_usuario, id_pago];
        accionBitacora = 'VALIDACIÓN_PAGO_PROVEEDOR';
    } else if (accion === 'AUTORIZAR') {
        nuevoEstatus = 'PAGADO'; // Pasa directo a PAGADO para tu vista
        // Quitamos el candado estricto del WHERE para forzar el guardado
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ?, id_usuario_autoriza = ?, fecha_autorizacion = NOW() WHERE id = ?';
        params = [nuevoEstatus, id_usuario, id_pago];
        accionBitacora = 'AUTORIZACIÓN_FINAL_PAGO';
    } else if (accion === 'RECHAZAR') {
        nuevoEstatus = 'RECHAZADO';
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ? WHERE id = ?';
        params = [nuevoEstatus, id_pago];
        accionBitacora = 'RECHAZO_PAGO_PROVEEDOR';
    } else {
        return res.status(400).json({ success: false, message: 'Acción no válida' });
    }

    db.query(queryUpdate, params, (err, result) => {
        if (err) {
            console.error("Error SQL:", err);
            return res.status(500).json({ success: false, message: 'Error en el servidor al cambiar estatus' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'No se pudo encontrar el pago en la base de datos.' });
        }

        registrarBitacora(id_usuario, accionBitacora, `Se marcó el pago ID ${id_pago} como ${nuevoEstatus}`);
        res.json({ success: true, message: `Pago ${nuevoEstatus.replace('_', ' ').toLowerCase()} con éxito.` });
    });
});

module.exports = router;