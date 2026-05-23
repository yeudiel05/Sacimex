const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx'); // Importamos la nueva librería

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prov-' + req.body.id_proveedor + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Configuramos un multer en memoria para el Excel (no se guarda en disco)
const uploadExcel = multer({ storage: multer.memoryStorage() });

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
        SELECT pp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.cuenta_bancaria AS clabe_bancaria, u.username as solicitante
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
    db.query('SELECT p.nombre_razon_social FROM pagos_a_proveedores pp JOIN personas p ON pp.id_proveedor = p.id WHERE pp.id = ?', [req.params.id], (err, results) => {
        const proveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Proveedor Desconocido';
        db.query("UPDATE pagos_a_proveedores SET estatus = 'PAGADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'PAGO_AUTORIZADO', `Autorizó la salida de dinero a favor de: ${proveedor}`);
            res.json({ success: true });
        });
    });
});

router.put('/autorizaciones/:id/rechazar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query('SELECT p.nombre_razon_social FROM pagos_a_proveedores pp JOIN personas p ON pp.id_proveedor = p.id WHERE pp.id = ?', [req.params.id], (err, results) => {
        const proveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Proveedor Desconocido';
        db.query("UPDATE pagos_a_proveedores SET estatus = 'RECHAZADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'PAGO_RECHAZADO', `Rechazó el pago solicitado para: ${proveedor}`);
            res.json({ success: true });
        });
    });
});

router.get('/autorizaciones/:id/pdf', verificarToken, (req, res) => {
    const query = `
        SELECT pp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.cuenta_bancaria AS clabe_bancaria, 
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

        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 40, { width: 70 });

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#16a34a').text('SOLICITUD UNIVERSAL DE RECURSOS 2026', 0, 40, { align: 'right' });
        doc.text('SAC-TSR-RCS-2026', 0, 52, { align: 'right' });
        doc.rect(480, 68, 90, 13).fill('#fef08a');
        doc.fillColor('black').fontSize(9).font('Helvetica').text('Oaxaca de Juárez, Oax., a', 350, 71, { align: 'left' });
        doc.font('Helvetica-Bold').text(new Date(pago.fecha_solicitud).toLocaleDateString('es-MX'), 485, 71);

        doc.font('Helvetica-Bold').text('C. BEATRIZ CRUZ CANO', 40, 95);
        doc.font('Helvetica').text('TESORERÍA', 40, 107);
        doc.text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 40, 119);

        doc.text('Por medio del presente solicito recurso para: ', 40, 150, { continued: true }).font('Helvetica-Bold').text(pago.concepto.toUpperCase());
        doc.font('Helvetica').text('correspondiente a la unidad de negocio: ', 40, 165);
        doc.rect(230, 163, 110, 12).fill('#fef08a');
        doc.fillColor('black').font('Helvetica-Bold').text('01.CRP - Corporativo', 235, 165);

        doc.rect(40, 185, 530, 15).fill('#fef08a');
        doc.fillColor('black').font('Helvetica').text('Por la cantidad de: ', 45, 188, { continued: true }).font('Helvetica-Bold').text(`$${Number(pago.monto_pago).toLocaleString('es-MX', {minimumFractionDigits:2})}    ( ${numeroALetras(pago.monto_pago)} )`);

        doc.font('Helvetica').text('Lo cual será destinado para lo descrito en el apartado siguiente.', 40, 215);

        doc.font('Helvetica-Bold').text('DATOS DEL PROVEEDOR O BENEFICIARIO', 40, 250);
        doc.moveTo(40, 260).lineTo(570, 260).stroke('#cbd5e1'); 
        doc.fontSize(8).text('DESCRIPCIÓN ESPECÍFICA DE LA FINALIDAD DEL RECURSO:', 40, 270);
        doc.font('Helvetica').text(pago.concepto.toUpperCase(), 40, 282);
        
        doc.font('Helvetica-Bold').text('TIPO DE SOLICITUD', 40, 310);
        doc.font('Helvetica').text('TRANSFERENCIA', 40, 322);
        
        doc.font('Helvetica-Bold').text('CUENTA/CLABE/CIE', 200, 310);
        doc.font('Helvetica').text(pago.numero_cuenta || pago.clabe_bancaria || 'N/D', 200, 322);
        
        doc.font('Helvetica-Bold').text('BANCO', 360, 310);
        doc.font('Helvetica').text(pago.banco || 'N/D', 360, 322);
        
        doc.font('Helvetica-Bold').text('RFC PROVEEDOR', 40, 350);
        doc.font('Helvetica').text(pago.rfc || 'N/A', 40, 362);
        
        doc.font('Helvetica-Bold').text('NOMBRE DEL PROVEEDOR', 200, 350);
        doc.font('Helvetica').text(pago.proveedor, 200, 362);

        if(pago.num_factura_ref) {
            doc.font('Helvetica-Bold').text('FACTURA / REFERENCIA', 40, 390);
            doc.font('Helvetica').text(pago.num_factura_ref, 40, 402);
        }

        doc.fillColor('black');
        const sigY1 = 480;
        doc.moveTo(50, sigY1).lineTo(250, sigY1).stroke();
        doc.font('Helvetica-Bold').fontSize(7).text('SOLICITADO POR', 50, sigY1 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text(pago.solicitante.toUpperCase(), 50, sigY1 + 15, { width: 200, align: 'center' });

        doc.moveTo(320, sigY1).lineTo(520, sigY1).stroke();
        doc.font('Helvetica-Bold').text('REVISADO POR', 320, sigY1 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text('LIC C.P. MARIAM ITZEL RAMIREZ CARRASCO', 320, sigY1 + 15, { width: 200, align: 'center' });

        if(pago.estatus === 'PAGADO' || pago.estatus === 'AUTORIZADO'){
            doc.save();
            doc.rotate(-20, { origin: [300, 500] });
            doc.fontSize(45).font('Helvetica-Bold').fillColor('rgba(22, 163, 74, 0.15)').text('AUTORIZADO', 160, 480);
            doc.restore();
        }
        doc.end();
        registrarBitacora(req.usuario.id, 'DESCARGA_PDF', `Descargó Solicitud Universal de Pago para: ${pago.proveedor}`);
    });
});

// ==========================================
// NUEVA RUTA: REPORTES DE PAGOS POR VENCER
// ==========================================
router.get('/reportes/pagos-por-vencer', verificarToken, (req, res) => {
    // Calculamos el vencimiento: Fecha de Solicitud + Días de Crédito del proveedor
    const query = `
        SELECT 
            pp.id AS id_pago,
            p.nombre_razon_social AS proveedor,
            pp.concepto,
            pp.monto_pago,
            pp.estatus,
            DATE(pp.fecha_solicitud) as fecha_solicitud,
            pr.dias_credito,
            DATE_ADD(pp.fecha_solicitud, INTERVAL pr.dias_credito DAY) AS fecha_vencimiento,
            DATEDIFF(DATE_ADD(pp.fecha_solicitud, INTERVAL pr.dias_credito DAY), CURDATE()) AS dias_restantes
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        WHERE pp.estatus NOT IN ('PAGADO', 'RECHAZADO')
        ORDER BY fecha_vencimiento ASC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener pagos por vencer:", err);
            return res.status(500).json({ success: false, message: 'Error de base de datos' });
        }
        res.json({ success: true, data: results });
    });
});

// ==========================================
// CRUD NORMAL DE PROVEEDORES
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
        if (err) {
            console.error("ERROR EN CONSULTA GET:", err);
            return res.status(500).json({ success: false, message: 'Error al cargar proveedores' });
        }
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo al iniciar transacción BD.' });
        
        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', 
        [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
            if (err) {
                console.error("ERROR MYSQL PERSONAS:", err);
                return db.rollback(() => res.status(500).json({ success: false, message: `El RFC ya existe o formato inválido.` }));
            }
            
            const idNuevaPersona = resultPersona.insertId;
            const catLimpia = categoria || 'OTROS';
            
            db.query('INSERT INTO proveedores (id_persona, categoria, numero_cuenta, cuenta_bancaria, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, ?, 1)', 
            [idNuevaPersona, catLimpia, numero_cuenta || '', clabe_bancaria || '', banco, dias_credito || 0], (err) => {
                if (err) {
                    console.error("ERROR MYSQL PROVEEDORES:", err);
                    return db.rollback(() => res.status(500).json({ success: false, message: `Error en BD Proveedores: ${err.message}` }));
                }
                
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
            
            const catLimpia = categoria || 'OTROS';

            db.query('UPDATE proveedores SET categoria=?, numero_cuenta=?, cuenta_bancaria=?, banco=?, dias_credito=? WHERE id_persona=?', 
            [catLimpia, numero_cuenta || '', clabe_bancaria || '', banco, dias_credito, id], (err) => {
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
            registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Cambió el estatus a ${req.body.estatus_activo ? 'Activo' : 'Suspendido'} del proveedor: ${nombreProveedor}`);
            res.json({ success: true });
        });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const nombreProveedor = results[0].nombre_razon_social;
        db.query('UPDATE personas SET eliminado = TRUE WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'ELIMINAR_PROVEEDOR', `Eliminó del directorio al proveedor: ${nombreProveedor}`);
            res.json({ success: true });
        });
    });
});

router.get('/:id/pagos', verificarToken, (req, res) => {
    db.query('SELECT * FROM pagos_a_proveedores WHERE id_proveedor = ? ORDER BY fecha_solicitud DESC', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/pagos', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_proveedor, concepto, monto_pago, num_factura_ref } = req.body;
    let url = req.file ? `uploads/${req.file.filename}` : null;
    const estatus = req.usuario.rol === 'ADMIN' ? 'PAGADO' : 'PENDIENTE_VALIDACION';
    const id_autoriza = req.usuario.rol === 'ADMIN' ? req.usuario.id : null;

    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [id_proveedor], (err, results) => {
        const nombreProveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Desconocido';
        db.query('INSERT INTO pagos_a_proveedores (id_proveedor, id_usuario_solicita, id_usuario_autoriza, monto_pago, concepto, num_factura_ref, url_comprobante_pago, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id_proveedor, req.usuario.id, id_autoriza, monto_pago, concepto, num_factura_ref, url, estatus], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if(estatus === 'PAGADO'){
                registrarBitacora(req.usuario.id, 'PAGO_PROVEEDOR', `Registró y autorizó pago directo a favor de: ${nombreProveedor}`);
            } else {
                registrarBitacora(req.usuario.id, 'SOLICITUD_PAGO', `Envió solicitud de pago para validación a favor de: ${nombreProveedor}`);
            }
            res.json({ success: true, message: estatus === 'PAGADO' ? 'Pago registrado y autorizado' : 'Solicitud enviada para validación' });
        });
    });
});

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
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ?, id_usuario_validador = ?, fecha_validacion = NOW() WHERE id = ?';
        params = [nuevoEstatus, id_usuario, id_pago];
        accionBitacora = 'VALIDACIÓN_PAGO';
    } else if (accion === 'AUTORIZAR') {
        nuevoEstatus = 'PAGADO'; 
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ?, id_usuario_autoriza = ?, fecha_autorizacion = NOW() WHERE id = ?';
        params = [nuevoEstatus, id_usuario, id_pago];
        accionBitacora = 'AUTORIZACIÓN_FINAL';
    } else if (accion === 'RECHAZAR') {
        nuevoEstatus = 'RECHAZADO';
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ? WHERE id = ?';
        params = [nuevoEstatus, id_pago];
        accionBitacora = 'RECHAZO_PAGO';
    } else {
        return res.status(400).json({ success: false, message: 'Acción no válida' });
    }

    db.query(queryUpdate, params, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: 'Pago no encontrado.' });

        db.query('SELECT pp.concepto, pp.monto_pago, p.nombre_razon_social FROM pagos_a_proveedores pp JOIN personas p ON pp.id_proveedor = p.id WHERE pp.id = ?', [id_pago], (err, row) => {
            if (!err && row.length > 0) {
                const estatusLegible = nuevoEstatus.replace('_', ' ');
                registrarBitacora(id_usuario, accionBitacora, `Marcó como ${estatusLegible} el pago de $${row[0].monto_pago} a favor de: ${row[0].nombre_razon_social}`);
            }
            res.json({ success: true });
        });
    });
});


// ==========================================
// RUTA PARA IMPORTAR PROVEEDORES DESDE EXCEL
// ==========================================
router.post('/importar', verificarToken, uploadExcel.single('archivo_excel'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }

    try {
        // Leer el archivo de Excel cargado en memoria
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; // Usar la primera hoja
        const sheet = workbook.Sheets[sheetName];
        
        // Convertir la hoja a formato JSON
        const data = xlsx.utils.sheet_to_json(sheet);
        
        if (data.length === 0) {
            return res.status(400).json({ success: false, message: 'El archivo Excel está vacío' });
        }

        let procesados = 0;
        let errores = 0;

        // Recorrer cada fila del Excel
        for (const row of data) {
            // Validar que las columnas existan en el excel tal y como me las diste
            const rfc_original = row['RFC'] ? row['RFC'].toString().trim().toUpperCase() : null;
            const nombre = row['NOMBRE'] ? row['NOMBRE'].toString().trim() : null;

            if (!rfc_original || !nombre) {
                errores++;
                continue; // Saltar si falta algún dato crítico
            }

            // Calcular Tipo de Persona: Moral (12 caracteres) Física (13 caracteres)
            let tipo_persona = 'MORAL';
            if (rfc_original.length === 13) {
                tipo_persona = 'FISICA';
            }

            // Intentar guardarlo (Si falla porque el RFC ya existe, lo contamos como error pero seguimos)
            try {
                await new Promise((resolve, reject) => {
                    db.beginTransaction(err => {
                        if (err) return reject(err);

                        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', 
                        [tipo_persona, nombre, rfc_original, '', '', ''], (err, resultPersona) => {
                            if (err) return db.rollback(() => reject(err));
                            
                            const idNuevaPersona = resultPersona.insertId;
                            
                            db.query('INSERT INTO proveedores (id_persona, categoria, numero_cuenta, cuenta_bancaria, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, ?, 1)', 
                            [idNuevaPersona, 'OTROS', '', '', '', 0], (err) => {
                                if (err) return db.rollback(() => reject(err));
                                
                                db.commit(err => {
                                    if (err) return db.rollback(() => reject(err));
                                    resolve();
                                });
                            });
                        });
                    });
                });
                procesados++;
            } catch (err) {
                // Posiblemente RFC duplicado
                errores++;
            }
        }

        registrarBitacora(req.usuario.id, 'IMPORTAR_PROVEEDORES', `Importó proveedores desde Excel: ${procesados} exitosos, ${errores} con errores o duplicados.`);
        
        res.json({ 
            success: true, 
            message: `Proceso completado. Proveedores importados: ${procesados}. Errores/Duplicados omitidos: ${errores}.` 
        });

    } catch (error) {
        console.error("Error al procesar Excel:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error al intentar leer el archivo Excel.' });
    }
});

module.exports = router;