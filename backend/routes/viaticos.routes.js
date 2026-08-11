const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const { autorizar } = require('../middlewares/autorizar');
const { puedeAutorizarViaticos } = require('../utils/motorAutorizacion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, path.join(__dirname, '../uploads')); },
    filename: function (req, file, cb) {
        cb(null, 'viatico-' + req.params.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const formatMoney = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

router.get('/perfil', verificarToken, (req, res) => {
    const query = `SELECT e.puesto, e.departamento, e.unidad_negocio AS ubicacion FROM usuarios u JOIN empleados e ON u.id_empleado = e.id_persona WHERE u.id = ?`;
    db.query(query, [req.usuario.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        const perfil = results.length > 0 ? results[0] : { puesto: '', departamento: '', ubicacion: '' };
        res.json({ success: true, perfil });
    });
});

router.post('/', verificarToken, (req, res) => {
    const id_usuario = req.usuario.id;
    const { 
        puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo,
        fecha_salida, fecha_regreso, dias_comision, medio_transporte,
        monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado,
        desglose_dias // array: [{fecha, categoria, subcategoria, monto}]
    } = req.body;
    const num = (valor) => parseFloat(valor) || 0;

    const query = `INSERT INTO solicitudes_viaticos 
        (id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo, 
         fecha_salida, fecha_regreso, dias_comision, medio_transporte, 
         monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo,
        fecha_salida, fecha_regreso, parseInt(dias_comision) || 0, medio_transporte,
        num(monto_alimentos), num(monto_hospedaje), num(monto_pasajes), num(monto_taxis), num(monto_gasolina), num(monto_otros), num(total_solicitado)
    ];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const id_solicitud = result.insertId;

        // Guardar desglose por días si viene en el body
        if (desglose_dias && Array.isArray(desglose_dias) && desglose_dias.length > 0) {
            const filas = desglose_dias
                .filter(d => d.monto && parseFloat(d.monto) > 0)
                .map(d => [id_solicitud, d.fecha, d.categoria, d.subcategoria || null, parseFloat(d.monto) || 0]);
            if (filas.length > 0) {
                db.query(
                    'INSERT INTO viaticos_desglose_dias (id_solicitud, fecha, categoria, subcategoria, monto) VALUES ?',
                    [filas],
                    (errD) => { if (errD) console.error('Error guardando desglose:', errD.message); }
                );
            }
        }

        registrarBitacora(id_usuario, 'SOLICITUD_VIATICOS', `Solicitó viáticos por $${num(total_solicitado).toFixed(2)} para ${destino}`, req);
        res.json({ success: true, message: 'Solicitud enviada correctamente', id: id_solicitud });
    });
});

router.get('/:id/desglose', verificarToken, (req, res) => {
    db.query(
        'SELECT * FROM viaticos_desglose_dias WHERE id_solicitud = ? ORDER BY fecha ASC, categoria ASC',
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: rows });
        }
    );
});

router.get('/mis-solicitudes', verificarToken, (req, res) => {
    db.query('SELECT * FROM solicitudes_viaticos WHERE id_usuario = ? ORDER BY fecha_solicitud DESC', [req.usuario.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// GET /todas — para DHO: ve todas las pendientes de su autorización
// GET /pendientes-jefe — para cualquier usuario: ve las de sus subordinados
router.get('/pendientes-jefe', verificarToken, (req, res) => {
    // El jefe ve solicitudes PENDIENTES donde él es el jefe_inmediato según el sistema
    db.query(
        `SELECT sv.*, p.nombre_razon_social AS nombre_solicitante, e.puesto AS puesto_solicitante
         FROM solicitudes_viaticos sv
         JOIN usuarios u ON sv.id_usuario = u.id
         JOIN empleados e ON u.id_empleado = e.id_persona
         JOIN personas p ON e.id_persona = p.id
         JOIN empleados ej ON ej.id_persona = (SELECT id_empleado FROM usuarios WHERE id = ?)
         WHERE sv.estatus = 'PENDIENTE'
         AND UPPER(TRIM(e.jefe_inmediato)) = UPPER(TRIM((SELECT nombre_razon_social FROM personas WHERE id = ej.id_persona)))
         ORDER BY sv.fecha_solicitud ASC`,
        [req.usuario.id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: rows });
        }
    );
});

router.get('/todas', verificarToken, (req, res) => {
    if (!puedeAutorizarViaticos(req.usuario)) return res.status(403).json({ success: false });
    db.query('SELECT sv.*, u.username as solicitante_usuario FROM solicitudes_viaticos sv JOIN usuarios u ON sv.id_usuario = u.id ORDER BY sv.fecha_solicitud DESC', (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// PUT /:id/autorizar-jefe — Paso 1: el jefe inmediato autoriza
router.put('/:id/autorizar-jefe', verificarToken, (req, res) => {
    const { comentario } = req.body;
    const id = req.params.id;

    // Verificar que la solicitud pertenece a un subordinado del usuario
    db.query(
        `SELECT sv.id, sv.estatus, p.nombre_razon_social AS nombre_solicitante
         FROM solicitudes_viaticos sv
         JOIN usuarios u ON sv.id_usuario = u.id
         JOIN empleados e ON u.id_empleado = e.id_persona
         JOIN personas p ON e.id_persona = p.id
         WHERE sv.id = ? AND sv.estatus = 'PENDIENTE'`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada o ya fue procesada.' });

            db.query(
                `UPDATE solicitudes_viaticos 
                 SET estatus = 'AUTORIZADO_JEFE', id_autorizador_jefe = ?, fecha_auth_jefe = NOW(), comentario_jefe = ?
                 WHERE id = ?`,
                [req.usuario.id, comentario || null, id],
                (errU) => {
                    if (errU) return res.status(500).json({ success: false, message: errU.message });
                    registrarBitacora(req.usuario.id, 'VIATICO_AUTORIZADO', `Autorizó como jefe inmediato el viático #${id}`, req);
                    res.json({ success: true, message: 'Viático autorizado por jefe inmediato. Pendiente de aprobación D.H.O.' });
                }
            );
        }
    );
});

// PUT /:id/autorizar-dho — Paso 2: D.H.O. da el visto bueno final
router.put('/:id/autorizar-dho', verificarToken, (req, res) => {
    if (!puedeAutorizarViaticos(req.usuario)) {
        return res.status(403).json({ success: false, message: 'Solo D.H.O. puede otorgar la autorización final.' });
    }
    const { comentario } = req.body;
    const id = req.params.id;

    db.query(
        `SELECT id, estatus FROM solicitudes_viaticos WHERE id = ? AND estatus = 'AUTORIZADO_JEFE'`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada o no ha sido autorizada por el jefe.' });

            db.query(
                `UPDATE solicitudes_viaticos 
                 SET estatus = 'AUTORIZADO_DHO', id_autorizador = ?, id_autorizador_dho = ?, fecha_auth_dho = NOW(), comentario_dho = ?
                 WHERE id = ?`,
                [req.usuario.id, req.usuario.id, comentario || null, id],
                (errU) => {
                    if (errU) return res.status(500).json({ success: false, message: errU.message });
                    registrarBitacora(req.usuario.id, 'VIATICO_AUTORIZADO', `D.H.O. otorgó autorización final al viático #${id}`, req);
                    res.json({ success: true, message: 'Viático autorizado por D.H.O. Listo para pago por Tesorería.' });
                }
            );
        }
    );
});

// PUT /:id/estatus — Paso 3: Tesorería marca como PAGADO (backward compat)
router.put('/:id/estatus', verificarToken, (req, res) => {
    const { estatus } = req.body;
    const id = req.params.id;

    // Solo ADMIN y TESORERIA pueden marcar como PAGADO
    if (estatus === 'PAGADO' && req.usuario.rol !== 'ADMIN' && req.usuario.rol !== 'TESORERIA') {
        return res.status(403).json({ success: false, message: 'Solo Tesorería puede marcar como pagado.' });
    }
    // Solo DHO y ADMIN pueden cambiar otros estatus
    if (estatus !== 'PAGADO' && !puedeAutorizarViaticos(req.usuario)) {
        return res.status(403).json({ success: false, message: 'Permisos insuficientes.' });
    }

    db.query(
        'UPDATE solicitudes_viaticos SET estatus = ?, id_autorizador = ? WHERE id = ?',
        [estatus, req.usuario.id, id],
        (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
            registrarBitacora(req.usuario.id, `VIATICO_${estatus}`, `Marcó viático #${id} como ${estatus}`, req);
            res.json({ success: true, message: `Solicitud actualizada a ${estatus}` });
        }
    );
});

router.post('/:id/confirmar-recepcion', verificarToken, upload.single('comprobante_empleado'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Debes adjuntar el comprobante de que recibiste el dinero.' });
    }
    const comprobantePath = `uploads/${req.file.filename}`;
    db.query('SELECT estatus FROM solicitudes_viaticos WHERE id = ? AND id_usuario = ?', [id, req.usuario.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al buscar la solicitud.' });
        if (rows.length === 0) return res.status(403).json({ success: false, message: 'No tienes permiso sobre esta solicitud.' });
        if (rows[0].estatus !== 'PAGADO') {
            return res.status(400).json({ success: false, message: 'Tesorería aun no ha marcado esta solicitud como pagada.' });
        }
        db.query(
            'UPDATE solicitudes_viaticos SET estatus = "RECIBIDO", comprobante_recepcion_path = ? WHERE id = ?', 
            [comprobantePath, id], 
            (errUpdate) => {
                if (errUpdate) return res.status(500).json({ success: false, message: 'Error al guardar la recepcion.' });
                registrarBitacora(req.usuario.id, 'VIATICO_RECIBIDO', `El empleado confirmo recepcion de fondos con comprobante para el viatico #${id}`, req);
                res.json({ success: true, message: 'Recepcion confirmada y documento firmado exitosamente.', url: comprobantePath });
            }
        );
    });
});

// ================================================================
// A. SUBIDA DE COMPROBANTE DE TRANSFERENCIA (POST /:id/comprobante)
// ================================================================
router.post('/:id/comprobante', verificarToken, upload.single('comprobante'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    const urlArchivo = `uploads/${req.file.filename}`;
    db.query('UPDATE solicitudes_viaticos SET url_comprobante_transferencia = ? WHERE id = ?', [urlArchivo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        
        // REGISTRO EN BITACORA - VIATICO TRANSFERIDO
        registrarBitacora(req.usuario.id, 'VIATICO_TRANSFERIDO', `Adjunto comprobante de transferencia bancaria al viatico #${req.params.id}`, req);
        
        res.json({ success: true, url: urlArchivo });
    });
});

router.post('/:id/comprobante-gastos', verificarToken, upload.single('comprobante_gastos'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    db.query(
        'SELECT fecha_regreso, id_usuario, url_comprobante_gastos FROM solicitudes_viaticos WHERE id = ?',
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: 'Error al verificar la solicitud.' });
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
            const sol = rows[0];
            if (sol.id_usuario !== req.usuario.id) {
                return res.status(403).json({ success: false, message: 'No tienes permiso sobre esta solicitud.' });
            }
            const fechaRegreso = new Date(sol.fecha_regreso);
            fechaRegreso.setHours(0, 0, 0, 0);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const diasTranscurridos = Math.floor((hoy - fechaRegreso) / (1000 * 60 * 60 * 24));
            if (diasTranscurridos > 5) {
                return res.status(403).json({
                    success: false,
                    message: 'El plazo para comprobar viaticos ha vencido. Contaba con 5 dias a partir de su fecha de regreso. Los viaticos no comprobados seran descontados de nomina.'
                });
            }
            const urlArchivo = `uploads/${req.file.filename}`;
            db.query(
                'UPDATE solicitudes_viaticos SET url_comprobante_gastos = ?, estatus = "COMPROBADO" WHERE id = ? AND id_usuario = ?',
                [urlArchivo, req.params.id, req.usuario.id],
                (errUpdate) => {
                    if (errUpdate) return res.status(500).json({ success: false });
                    registrarBitacora(req.usuario.id, 'VIATICO_COMPROBADO', `Subio comprobante de gastos para el viatico #${req.params.id}`, req);
                    res.json({ success: true, url: urlArchivo });
                }
            );
        }
    );
});

// ==============================================================================
// COMPROBACION UNIVERSAL DE GASTOS — GUARDAR (empleado)
// ==============================================================================
router.post('/:id/comprobacion-universal', verificarToken, (req, res) => {
    const idSolicitud = req.params.id;
    const {
        responsable, nombre_proveedor_header, fecha_inicial, fecha_final,
        lugar, recursos_otorgados, fondo_fijo, unidad_negocio,
        objeto, personas_adicionales, partidas
    } = req.body;

    db.query(
        'SELECT id, estatus FROM solicitudes_viaticos WHERE id = ? AND id_usuario = ?',
        [idSolicitud, req.usuario.id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: 'Error BD.' });
            if (rows.length === 0) return res.status(403).json({ success: false, message: 'No tienes acceso a esta solicitud.' });
            if (!['RECIBIDO', 'COMPROBADO'].includes(rows[0].estatus)) {
                return res.status(400).json({ success: false, message: 'Solo puedes guardar comprobacion en solicitudes RECIBIDAS.' });
            }

            const totalComprobado = (partidas || []).reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
            const pendiente = (parseFloat(recursos_otorgados) || 0) - totalComprobado;

            db.query(
                `INSERT INTO comprobacion_gastos 
                    (id_solicitud, responsable, nombre_proveedor, fecha_inicial, fecha_final, lugar, recursos_otorgados, fondo_fijo, unidad_negocio, objeto, personas_adicionales, total_comprobado, pendiente)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    responsable = VALUES(responsable),
                    nombre_proveedor = VALUES(nombre_proveedor),
                    fecha_inicial = VALUES(fecha_inicial),
                    fecha_final = VALUES(fecha_final),
                    lugar = VALUES(lugar),
                    recursos_otorgados = VALUES(recursos_otorgados),
                    fondo_fijo = VALUES(fondo_fijo),
                    unidad_negocio = VALUES(unidad_negocio),
                    objeto = VALUES(objeto),
                    personas_adicionales = VALUES(personas_adicionales),
                    total_comprobado = VALUES(total_comprobado),
                    pendiente = VALUES(pendiente)`,
                [
                    idSolicitud, responsable, nombre_proveedor_header,
                    fecha_inicial || null, fecha_final || null,
                    lugar, parseFloat(recursos_otorgados) || 0, fondo_fijo,
                    unidad_negocio, objeto, parseInt(personas_adicionales) || 0,
                    totalComprobado, pendiente
                ],
                (errUpsert) => {
                    if (errUpsert) return res.status(500).json({ success: false, message: 'Error al guardar comprobacion: ' + errUpsert.sqlMessage });

                    db.query('SELECT id FROM comprobacion_gastos WHERE id_solicitud = ?', [idSolicitud], (errSelect, compRows) => {
                        if (errSelect || compRows.length === 0) return res.status(500).json({ success: false });
                        const idComprobacion = compRows[0].id;

                        db.query('DELETE FROM comprobacion_partidas WHERE id_comprobacion = ?', [idComprobacion], (errDel) => {
                            if (errDel) return res.status(500).json({ success: false });

                            const partidasValidas = (partidas || []).filter(p => p.importe || p.descripcion || p.nombre_proveedor);

                            if (partidasValidas.length === 0) {
                                registrarBitacora(req.usuario.id, 'COMPROBACION_GUARDADA', `Comprobacion de viatico #${idSolicitud} guardada (sin partidas)`, req);
                                return res.json({ success: true, message: 'Comprobacion guardada.' });
                            }

                            const valores = partidasValidas.map(p => [
                                idComprobacion,
                                p.fecha || null,
                                parseFloat(p.importe) || 0,
                                p.folio_fiscal || '',
                                (p.rfc_proveedor || '').toUpperCase(),
                                p.nombre_proveedor || '',
                                p.rubro || 'Otros gastos',
                                p.descripcion || ''
                            ]);

                            db.query(
                                'INSERT INTO comprobacion_partidas (id_comprobacion, fecha, importe, folio_fiscal, rfc_proveedor, nombre_proveedor, rubro, descripcion) VALUES ?',
                                [valores],
                                (errIns) => {
                                    if (errIns) return res.status(500).json({ success: false, message: 'Error al guardar partidas.' });
                                    registrarBitacora(req.usuario.id, 'COMPROBACION_GUARDADA', `Comprobacion de viatico #${idSolicitud} guardada con ${partidasValidas.length} partidas`, req);
                                    res.json({ success: true, message: 'Comprobacion guardada correctamente.' });
                                }
                            );
                        });
                    });
                }
            );
        }
    );
});

// ==============================================================================
// COMPROBACION UNIVERSAL DE GASTOS — OBTENER (empleado y D.H.O.)
// ==============================================================================
router.get('/:id/comprobacion-universal', verificarToken, (req, res) => {
    const idSolicitud = req.params.id;
    db.query('SELECT * FROM comprobacion_gastos WHERE id_solicitud = ?', [idSolicitud], (err, compRows) => {
        if (err) return res.status(500).json({ success: false });
        if (compRows.length === 0) return res.json({ success: true, data: null });
        const comp = compRows[0];
        db.query('SELECT * FROM comprobacion_partidas WHERE id_comprobacion = ? ORDER BY id ASC', [comp.id], (errP, partidas) => {
            if (errP) return res.status(500).json({ success: false });
            res.json({ success: true, data: { ...comp, partidas } });
        });
    });
});

// ==============================================================================
// B. PDF DE LA COMPROBACION UNIVERSAL DE GASTOS (D.H.O.)
// ==============================================================================
router.get('/:id/comprobacion-universal/pdf', verificarToken, (req, res) => {
    const idSolicitud = req.params.id;

    const querySolicitud = `
        SELECT sv.id, sv.destino,
               p.nombre_razon_social AS solicitante_nombre,
               e.puesto AS solicitante_puesto,
               e.unidad_negocio AS solicitante_unidad,
               e.empresa_maestra AS solicitante_empresa,
               u.ruta_firma_png AS solicitante_firma
        FROM solicitudes_viaticos sv
        LEFT JOIN usuarios u ON sv.id_usuario = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        WHERE sv.id = ?
    `;

    db.query(querySolicitud, [idSolicitud], (errSol, solRows) => {
        if (errSol) return res.status(500).json({ success: false, message: 'Error servidor' });
        if (solRows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        const sol = solRows[0];

        db.query('SELECT * FROM comprobacion_gastos WHERE id_solicitud = ?', [idSolicitud], (err, compRows) => {
            if (err) return res.status(500).json({ success: false, message: 'Error servidor' });
            if (compRows.length === 0) return res.status(404).json({ success: false, message: 'Este viatico aun no tiene comprobacion de gastos registrada.' });
            const comp = compRows[0];

            db.query('SELECT * FROM comprobacion_partidas WHERE id_comprobacion = ? ORDER BY id ASC', [comp.id], (errP, partidas) => {
                if (errP) return res.status(500).json({ success: false, message: 'Error servidor' });

                const doc = new PDFDocument({ size: 'LETTER', margin: 30, autoFirstPage: true });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename=Comprobacion_${sol.id}.pdf`);
                doc.pipe(res);

                // REGISTRO EN BITACORA - EXPORTAR PDF COMPROBACION
                registrarBitacora(req.usuario.id, 'EXPORTAR_PDF_COMPROBACION', `Descargo reporte PDF de Comprobacion Universal del viatico #${sol.id}`, req);

                const COLOR_TEXTO_AZUL = '#0000FF';
                const COLOR_VERDE_TITULO = '#008000';
                const BG_VERDE_CLARO = '#eaffea';
                const BG_GRIS = '#f1f5f9';
                const anio = new Date().getFullYear();

                const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';

                const drawCell = (x, cy, w, h, text, fill, textColor = '#000', font = 'Helvetica', size = 8, align = 'left', noBorder = false) => {
                    if (fill) doc.rect(x, cy, w, h).fill(fill);
                    if (!noBorder) doc.rect(x, cy, w, h).stroke('#000');
                    if (text !== undefined && text !== null && text !== '') {
                        doc.fillColor(textColor).font(font).fontSize(size);
                        const textHeight = doc.heightOfString(String(text), { width: w });
                        const textY = cy + (h - textHeight) / 2;
                        const isCentered = align === 'center' || align === 'right';
                        doc.text(String(text), isCentered ? x : x + 5, textY, { width: w - (isCentered ? 0 : 5), align: align });
                    }
                };

                // --- ENCABEZADO CON LOGOS OFICIALES ---
                const logoPath = path.join(__dirname, '../../frontend/src/assets/Logo.png');
                if (fs.existsSync(logoPath)) {
                    try { doc.image(logoPath, 30, 25, { width: 50 }); } catch (e) {}
                }

                doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR_VERDE_TITULO)
                    .text('COMPROBACION UNIVERSAL DE GASTOS', 90, 28, { width: 380 });
                doc.font('Helvetica').fontSize(9).fillColor('#000')
                    .text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 90, 44, { width: 380 });
                if (sol.solicitante_empresa) {
                    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#475569')
                        .text(sol.solicitante_empresa, 90, 56, { width: 380 });
                }

                doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
                    .text(`SAC-TRS-GST-${anio}`, 0, 30, { align: 'right', width: 552 });

                let y = 80;
                doc.moveTo(30, y).lineTo(552, y).strokeColor('#cbd5e1').stroke();
                y += 12;

                // --- DATOS GENERALES ---
                const tX = 30, colA = 110, colB = 156, colC = 110, colD = 156, rowH = 16;

                drawCell(tX, y, colA, rowH, 'Responsable:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA, y, colB, rowH, sol.solicitante_nombre || comp.responsable || '', BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                drawCell(tX + colA + colB, y, colC, rowH, 'Nombre proveedor:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB + colC, y, colD, rowH, comp.nombre_proveedor || '', BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                y += rowH;

                drawCell(tX, y, colA, rowH, 'Fecha inicial:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA, y, colB, rowH, fmtFecha(comp.fecha_inicial), BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                drawCell(tX + colA + colB, y, colC, rowH, 'Fecha final:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB + colC, y, colD, rowH, fmtFecha(comp.fecha_final), BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                y += rowH;

                drawCell(tX, y, colA, rowH, 'Lugar:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA, y, colB, rowH, comp.lugar || sol.destino || '', BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                drawCell(tX + colA + colB, y, colC, rowH, 'Fondo fijo:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB + colC, y, colD, rowH, comp.fondo_fijo || '', BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                y += rowH;

                drawCell(tX, y, colA, rowH, 'Recursos otorgados $:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA, y, colB, rowH, formatMoney(comp.recursos_otorgados), BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                drawCell(tX + colA + colB, y, colC, rowH, 'Unidad de negocio:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB + colC, y, colD, rowH, comp.unidad_negocio || '', BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                y += rowH;

                drawCell(tX, y, colA, rowH, 'Objeto:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA, y, colB, rowH, comp.objeto || '', BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                drawCell(tX + colA + colB, y, colC, rowH, 'Personas adicionales:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB + colC, y, colD, rowH, comp.personas_adicionales ?? 0, BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                y += rowH;

                drawCell(tX, y, colA, rowH, 'Comprobado $:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA, y, colB, rowH, formatMoney(comp.total_comprobado), '#dcfce7', '#16a34a', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB, y, colC, rowH, 'Pendiente $:', BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                drawCell(tX + colA + colB + colC, y, colD, rowH, formatMoney(comp.pendiente), comp.pendiente > 0 ? '#fee2e2' : '#dcfce7', comp.pendiente > 0 ? '#ef4444' : '#16a34a', 'Helvetica-Bold', 8, 'left');
                y += rowH + 14;

                // --- TABLA DE PARTIDAS ---
                doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_VERDE_TITULO).text('DETALLE DE GASTOS COMPROBADOS', 30, y);
                y += 16;

                const colsPartidas = [
                    { label: 'Fecha', w: 55 },
                    { label: 'Importe', w: 60 },
                    { label: 'Folio Fiscal', w: 90 },
                    { label: 'RFC Proveedor', w: 70 },
                    { label: 'Nombre Proveedor', w: 100 },
                    { label: 'Rubro', w: 60 },
                    { label: 'Descripcion', w: 87 },
                ];
                const headerH = 16;
                let cx = 30;
                colsPartidas.forEach(c => {
                    drawCell(cx, y, c.w, headerH, c.label, '#1e293b', '#fff', 'Helvetica-Bold', 7.5, 'center');
                    cx += c.w;
                });
                y += headerH;

                const PAGE_BOTTOM = 740;
                const rowHP = 15;

                partidas.forEach((p, idx) => {
                    if (y + rowHP > PAGE_BOTTOM) {
                        doc.addPage();
                        y = 40;
                        cx = 30;
                        colsPartidas.forEach(c => {
                            drawCell(cx, y, c.w, headerH, c.label, '#1e293b', '#fff', 'Helvetica-Bold', 7.5, 'center');
                            cx += c.w;
                        });
                        y += headerH;
                    }
                    const fill = idx % 2 === 0 ? '#fff' : '#f8fafc';
                    cx = 30;
                    drawCell(cx, y, 55, rowHP, fmtFecha(p.fecha), fill, '#000', 'Helvetica', 7.5, 'center'); cx += 55;
                    drawCell(cx, y, 60, rowHP, formatMoney(p.importe), fill, '#000', 'Helvetica', 7.5, 'right'); cx += 60;
                    drawCell(cx, y, 90, rowHP, p.folio_fiscal || '', fill, '#000', 'Helvetica', 7, 'left'); cx += 90;
                    drawCell(cx, y, 70, rowHP, p.rfc_proveedor || '', fill, '#000', 'Helvetica', 7, 'left'); cx += 70;
                    drawCell(cx, y, 100, rowHP, p.nombre_proveedor || '', fill, '#000', 'Helvetica', 7, 'left'); cx += 100;
                    drawCell(cx, y, 60, rowHP, p.rubro || '', fill, '#000', 'Helvetica', 7, 'left'); cx += 60;
                    drawCell(cx, y, 87, rowHP, p.descripcion || '', fill, '#000', 'Helvetica', 7, 'left');
                    y += rowHP;
                });

                drawCell(30, y, 285, rowHP, '', null, '#000', 'Helvetica', 7, 'left', true);
                drawCell(315, y, 60, rowHP, 'TOTAL', '#1e293b', '#fff', 'Helvetica-Bold', 8, 'center');
                drawCell(375, y, 177, rowHP, formatMoney(comp.total_comprobado), '#dcfce7', '#16a34a', 'Helvetica-Bold', 9, 'left');
                y += rowHP + 14;

                // --- TOTALES POR RUBRO ---
                if (y + 90 > PAGE_BOTTOM) { doc.addPage(); y = 40; }
                doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_VERDE_TITULO).text('TOTALES POR RUBRO', 30, y);
                y += 16;

                const RUBROS = ['Hospedaje', 'Alimentos', 'Transporte', 'Otros gastos'];
                const totalPorRubro = (rubro) => partidas.filter(p => p.rubro === rubro).reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
                const wRub = 130, hRub = 16;
                let xRub = 30;
                RUBROS.forEach(r => {
                    drawCell(xRub, y, wRub, hRub, r, BG_GRIS, '#000', 'Helvetica-Bold', 8, 'left');
                    drawCell(xRub, y + hRub, wRub, hRub, formatMoney(totalPorRubro(r)), BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 8, 'left');
                    xRub += wRub;
                });
                y += hRub * 2 + 25;

                // --- PIE / FIRMA ---
                if (y + 90 > PAGE_BOTTOM) { doc.addPage(); y = 40; }
                const wSign = 220;
                const xSign = (doc.page.width - wSign) / 2;
                doc.font('Helvetica').fontSize(9).fillColor('#000').text('Presentado por:', xSign, y, { width: wSign, align: 'center' });
                y += 8;

                if (sol.solicitante_firma) {
                    const pathFirmaSol = path.join(__dirname, '../', sol.solicitante_firma);
                    if (fs.existsSync(pathFirmaSol)) {
                        try { doc.image(pathFirmaSol, xSign + 60, y, { width: 100, height: 30 }); } catch (e) {}
                    }
                }
                y += 36;

                doc.moveTo(xSign, y).lineTo(xSign + wSign, y).strokeColor('#000').stroke();
                y += 4;
                doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO_AZUL)
                    .text((sol.solicitante_nombre || comp.responsable || '').toUpperCase(), xSign, y, { width: wSign, align: 'center' });
                y += 10;
                doc.font('Helvetica').fontSize(8).fillColor('#475569')
                    .text(sol.solicitante_puesto || '', xSign, y, { width: wSign, align: 'center' });
                y += 20;

                doc.font('Helvetica-Oblique').fontSize(7).fillColor('#94a3b8')
                    .text('Documento generado por D.H.O. — Opciones Sacimex SA de CV SOFOM ENR', 30, y, { width: 522, align: 'center' });

                doc.end();
            });
        });
    });
});

// ==============================================================================
// C. PDF DEL OFICIO DE COMISION
// ==============================================================================
router.get('/:id/pdf', verificarToken, (req, res) => {
    const query = `
        SELECT sv.*,
               p.nombre_razon_social  AS solicitante_nombre,
               e.puesto               AS solicitante_puesto,
               e.unidad_negocio       AS solicitante_unidad,
               e.empresa_maestra      AS solicitante_empresa,
               u.ruta_firma_png       AS solicitante_firma,
               p_jefe.nombre_razon_social AS jefe_nombre,
               e_jefe.puesto              AS jefe_puesto,
               e_jefe.empresa_maestra     AS jefe_empresa,
               u_jefe.ruta_firma_png      AS jefe_firma,
               p_dho.nombre_razon_social  AS dho_nombre,
               e_dho.puesto               AS dho_puesto,
               e_dho.empresa_maestra      AS dho_empresa,
               u_dho.ruta_firma_png       AS dho_firma
        FROM solicitudes_viaticos sv
        LEFT JOIN usuarios u      ON sv.id_usuario = u.id
        LEFT JOIN empleados e     ON u.id_empleado = e.id_persona
        LEFT JOIN personas p      ON e.id_persona = p.id
        LEFT JOIN usuarios u_jefe    ON sv.id_autorizador_jefe = u_jefe.id
        LEFT JOIN empleados e_jefe   ON u_jefe.id_empleado = e_jefe.id_persona
        LEFT JOIN personas p_jefe    ON e_jefe.id_persona = p_jefe.id
        LEFT JOIN usuarios u_dho     ON sv.id_autorizador_dho = u_dho.id
        LEFT JOIN empleados e_dho    ON u_dho.id_empleado = e_dho.id_persona
        LEFT JOIN personas p_dho     ON e_dho.id_persona = p_dho.id
        WHERE sv.id = ?
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ success: false, message: 'No encontrado' });
        
        const sol = results[0];

        // Segunda consulta para traer los gastos por día y armar el desgloseMap
        db.query('SELECT * FROM viaticos_desglose_dias WHERE id_solicitud = ?', [req.params.id], (errD, desgloseRows) => {
            
            const desgloseMap = {};
            
            // Si hay resultados, armamos el mapa
            if (!errD && desgloseRows) {
                desgloseRows.forEach(row => {
                    const fecha = new Date(row.fecha).toISOString().split('T')[0];
                    if (!desgloseMap[fecha]) desgloseMap[fecha] = {};
                    
                    if (row.categoria) desgloseMap[fecha][row.categoria.toLowerCase()] = row.monto;
                    if (row.subcategoria) desgloseMap[fecha][row.subcategoria.toLowerCase()] = row.monto;
                });
            }

            const doc = new PDFDocument({ size: 'LETTER', margin: 25, autoFirstPage: true });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Comision_${sol.id}.pdf`);
            doc.pipe(res);

            // REGISTRO EN BITACORA - EXPORTAR OFICIO DE COMISION
            registrarBitacora(req.usuario.id, 'EXPORTAR_OFICIO_COMISION', `Descargo Oficio de Comision del viatico #${sol.id}`, req);

            const COLOR_TEXTO_AZUL = '#0000FF';
            const COLOR_VERDE_TITULO = '#008000';
            const BG_VERDE_CLARO = '#eaffea';
            let y = 30;

            const drawCell = (x, cy, w, h, text, fill, textColor = '#000', font = 'Helvetica', size = 8, align = 'left', noBorder = false) => {
                if (fill) doc.rect(x, cy, w, h).fill(fill);
                if (!noBorder) doc.rect(x, cy, w, h).stroke('#000');
                if (text) {
                    doc.fillColor(textColor).font(font).fontSize(size);
                    const textHeight = doc.heightOfString(text, { width: w });
                    const textY = cy + (h - textHeight) / 2;
                    const isCentered = align === 'center' || align === 'right';
                    doc.text(text, isCentered ? x : x + 5, textY, { width: w - (isCentered ? 0 : 5), align: align });
                }
            };

            const anio = new Date(sol.fecha_solicitud || Date.now()).getFullYear();
            doc.font('Helvetica-Bold').fontSize(14).fillColor(COLOR_VERDE_TITULO).text(`OFICIO DE COMISION ${anio}`, 0, y, { align: 'center' });
            doc.fontSize(10).text(`SAC-TSR-CMS-${anio}`, 0, y, { align: 'right', underline: true });
            
            y += 20;
            doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO_AZUL).text(sol.solicitante_nombre?.toUpperCase() || 'NOMBRE DEL COLABORADOR', 30, y);
            y += 10;
            doc.font('Helvetica-Bold').fillColor('#000').text(`${sol.solicitante_unidad || ''} - ${sol.solicitante_puesto || ''}`, 30, y);
            y += 10;
            doc.font('Helvetica-Oblique').fillColor(COLOR_TEXTO_AZUL).text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 30, y);
            y += 10;
            doc.text(sol.solicitante_empresa || 'Integracion Activa Especializada Ragar SA de CV', 30, y);

            const f = new Date(sol.fecha_solicitud || Date.now());
            const diasSemana = ['dom','lun','mar','mie','jue','vie','sab'];
            const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
            const fechaStr = `${diasSemana[f.getDay()]} ${f.getDate().toString().padStart(2, '0')} de ${meses[f.getMonth()]} del ${f.getFullYear().toString().substr(-2)}`;
            
            doc.font('Helvetica-Bold').fillColor('#000').fontSize(9).text('Fecha', 380, y - 14);
            drawCell(420, y - 20, 132, 14, fechaStr, BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 9, 'center', true);
            doc.font('Helvetica').fontSize(8).fillColor('#FF0000').text('Fecha (dd/mm/aa)', 420, y - 6, { width: 132, align: 'center' });
            y += 15;

            const tX = 30, tW1 = 70, tW2 = 452, rowH1 = 16;
            const fSalida = new Date(sol.fecha_salida).toLocaleDateString('es-MX', {timeZone: 'UTC'});
            const fRegreso = new Date(sol.fecha_regreso).toLocaleDateString('es-MX', {timeZone: 'UTC'});
            
            drawCell(tX, y, tW1, rowH1, 'Lugar:', null, '#000', 'Helvetica-Bold', 9, 'left');
            drawCell(tX+tW1, y, tW2, rowH1, (sol.destino || '').toUpperCase(), BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 9, 'left');
            y += rowH1;
            drawCell(tX, y, tW1, rowH1, 'Periodo:', null, '#000', 'Helvetica-Bold', 9, 'left');
            drawCell(tX+tW1, y, tW2, rowH1, `DEL ${fSalida} AL ${fRegreso}`, BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 9, 'left');
            y += rowH1;
            drawCell(tX, y, tW1, rowH1, 'Objetivo:', null, '#000', 'Helvetica-Bold', 9, 'left');
            drawCell(tX+tW1, y, tW2, rowH1, (sol.motivo || '').toUpperCase(), BG_VERDE_CLARO, COLOR_TEXTO_AZUL, 'Helvetica', 9, 'left');
            y += 20;

            const textoDespedida = 'Por lo anterior debera solicitar a la gerencia de finanzas los viaticos en los formatos autorizados. Al finalizar la comision debera requisitar la "Comprobacion universal de gastos" (SAC-GTSR-GST) en un maximo de 3 (TRES) dias posterior a su termino, so pena de cargo a nomina.\nSin mas por el momento le envio un cordial saludo.\n';
            doc.font('Helvetica').fontSize(9).fillColor('#000').text(textoDespedida, 30, y, { width: 522, align: 'justify' });
            y += doc.heightOfString(textoDespedida, { width: 522 }) + 20;

            // ── FIRMAS SUPERIORES: Solicitante | Jefe Inmediato ──────────────────
            const cargarFirmaViatic = (rutaRel, x, yPos, w=100, h=30) => {
                if (!rutaRel) return;
                const paths = [path.join(__dirname, '../', rutaRel), path.join(__dirname, '../../', rutaRel)];
                const ruta = paths.find(p => fs.existsSync(p));
                if (ruta) { try { doc.image(ruta, x, yPos, { width: w, height: h }); } catch(e) {} }
            };

            const wF2 = 200, gapF2 = 60;
            const x2A = (doc.page.width - (wF2*2 + gapF2)) / 2;
            const x2B = x2A + wF2 + gapF2;

            doc.font('Helvetica').fontSize(9).fillColor('#000')
               .text('Atentamente', x2A, y, { width: wF2, align: 'center' })
               .text('Autoriza (Jefe Inmediato)', x2B, y, { width: wF2, align: 'center' });

            cargarFirmaViatic(sol.solicitante_firma, x2A + 50, y + 12);
            cargarFirmaViatic(sol.jefe_firma, x2B + 50, y + 12);

            y += 50;
            doc.moveTo(x2A, y).lineTo(x2A + wF2, y).stroke();
            doc.moveTo(x2B, y).lineTo(x2B + wF2, y).stroke();
            y += 4;

            doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXTO_AZUL)
               .text(sol.solicitante_nombre?.toUpperCase() || '---', x2A, y, { width: wF2, align: 'center' })
               .text(sol.jefe_nombre?.toUpperCase() || sol.jefe_inmediato?.toUpperCase() || 'PENDIENTE', x2B, y, { width: wF2, align: 'center' });
            y += 10;
            doc.font('Helvetica-BoldOblique').fillColor('#000')
               .text(sol.solicitante_puesto || '', x2A, y, { width: wF2, align: 'center' })
               .text(sol.jefe_puesto || 'Jefe Inmediato', x2B, y, { width: wF2, align: 'center' });
            y += 10;
            doc.font('Helvetica')
               .text(sol.solicitante_empresa || '', x2A, y, { width: wF2, align: 'center' })
               .text(sol.jefe_empresa || '', x2B, y, { width: wF2, align: 'center' });
            y += 20;

            doc.font('Helvetica').fontSize(9).fillColor('#000').text('Personas adicionales autorizadas:', 30, y);
            y += 12;
            drawCell(30, y, 522, 40, '', BG_VERDE_CLARO, '#000', 'Helvetica', 8, 'left', true); 
            const accArr = sol.nombres_acompanantes ? sol.nombres_acompanantes.split(',') : [];
            let curY = y + 5;
            for(let i=1; i<=4; i++) { doc.text(`${i}.- ${accArr[i-1] ? accArr[i-1].trim() : ''}`, 60, curY); curY += 8; }
            curY = y + 5;
            for(let i=5; i<=8; i++) { doc.text(`${i}.- ${accArr[i-1] ? accArr[i-1].trim() : ''}`, 320, curY); curY += 8; }
            y += 45; 
            doc.moveTo(30, y).lineTo(552, y).dash(2, { space: 2 }).stroke(); doc.undash();
            y += 10;

            const colMain = 130, colSub = 80, colDay = 44, colTotal = 84, rowH = 13; 
            let gy = y;

            drawCell(30, gy, colMain, rowH, 'EXCLUSIVO FINANZAS', '#FFFF00', '#FF0000', 'Helvetica-Bold', 8, 'center');
            const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
            let rx = 30 + colMain;
            for(let i=0; i<7; i++) { drawCell(rx, gy, colDay, rowH, dias[i], '#fff', '#000', 'Helvetica-Bold', 8, 'center'); rx += colDay; }
            drawCell(rx, gy, colTotal, rowH, 'TOTAL', '#fff', '#000', 'Helvetica-Bold', 8, 'center');
            gy += rowH;

            // Generar fechas del viaje para columnas Lun-Dom
            const fechasSol = [];
            const dIni = new Date(sol.fecha_salida);
            const dFin = new Date(sol.fecha_regreso);
            for (let d = new Date(dIni); d <= dFin; d.setDate(d.getDate() + 1)) {
                fechasSol.push(new Date(d).toISOString().split('T')[0]);
            }
            
            // Función para obtener monto de una categoría en un día
            const getMonto = (cat) => fechasSol.reduce((s, f) => s + ((desgloseMap[f] || {})[cat] || 0), 0);
            const getMontoFecha = (f, cat) => (desgloseMap[f] || {})[cat] || 0;

            // Hospedaje
            drawCell(30, gy, colMain, rowH, 'Hospedaje', null, '#000', 'Helvetica-Bold', 8, 'left');
            rx = 30 + colMain;
            for(let i=0; i<7; i++) {
                const diaLabel = dias[i].toLowerCase();
                const fechaDia = fechasSol.find(f => new Date(f+'T00:00:00').getDay() === i);
                const val = fechaDia ? getMontoFecha(fechaDia, 'hospedaje') : 0;
                drawCell(rx, gy, colDay, rowH, val > 0 ? formatMoney(val) : '', BG_VERDE_CLARO, '#000', 'Helvetica', 7, 'right');
                rx += colDay;
            }
            const totalHosp = getMonto('hospedaje') || sol.monto_hospedaje || 0;
            doc.lineWidth(2);
            drawCell(rx, gy, colTotal, rowH, totalHosp > 0 ? formatMoney(totalHosp) : '', null, '#000', 'Helvetica', 8, 'right');
            doc.lineWidth(1);
            gy += rowH;

            drawCell(30, gy, 50, rowH*3, 'Transporte', null, '#000', 'Helvetica-Bold', 8, 'center');
            const drawSubRow = (label, catKey, montoFallback = 0) => {
                drawCell(80, gy, colSub, rowH, label, null, '#000', 'Helvetica', 8, 'left');
                rx = 30 + colMain;
                let totalCat = 0;
                for(let i=0; i<7; i++) {
                    const fechaDia = fechasSol.find(f => new Date(f+'T00:00:00').getDay() === i);
                    const val = fechaDia && catKey ? getMontoFecha(fechaDia, catKey) : 0;
                    totalCat += val;
                    drawCell(rx, gy, colDay, rowH, val > 0 ? formatMoney(val) : '', BG_VERDE_CLARO, '#000', 'Helvetica', 7, 'right');
                    rx += colDay;
                }
                const total = totalCat > 0 ? totalCat : montoFallback;
                doc.lineWidth(2); drawCell(rx, gy, colTotal, rowH, total > 0 ? formatMoney(total) : '', null, '#000', 'Helvetica', 8, 'right'); doc.lineWidth(1);
                gy += rowH;
            };

            drawCell(30, gy, 50, rowH*3, 'Transporte', null, '#000', 'Helvetica-Bold', 8, 'center');
            drawSubRow('Aereo', 'aereo');
            drawSubRow('Terrestre', 'terrestre');
            drawSubRow('Vehiculo', 'vehiculo', (sol.monto_gasolina || 0) + (sol.monto_taxis || 0));

            drawCell(30, gy, 50, rowH*3, 'Alimentos', null, '#000', 'Helvetica-Bold', 8, 'center');
            drawSubRow('Almuerzo', 'almuerzo');
            drawSubRow('Comida', 'comida', sol.monto_alimentos);
            drawSubRow('Cena', 'cena');

            drawCell(30, gy, 50, rowH, 'Comunicacion', null, '#000', 'Helvetica-Bold', 7, 'center');
            drawSubRow('Tarjeta', 'comunicacion');
            
            drawCell(30, gy, colMain, rowH, 'Otros', null, '#000', 'Helvetica-Bold', 8, 'left');
            rx = 30 + colMain;
            const totalOtros = getMonto('otros') || sol.monto_otros || 0;
            for(let i=0; i<7; i++) {
                const fechaDia = fechasSol.find(f => new Date(f+'T00:00:00').getDay() === i);
                const val = fechaDia ? getMontoFecha(fechaDia, 'otros') : 0;
                drawCell(rx, gy, colDay, rowH, val > 0 ? formatMoney(val) : '', BG_VERDE_CLARO, '#000', 'Helvetica', 7, 'right'); rx += colDay;
            }
            doc.lineWidth(2); drawCell(rx, gy, colTotal, rowH, totalOtros > 0 ? formatMoney(totalOtros) : '', null, '#000', 'Helvetica', 8, 'right'); doc.lineWidth(1); gy += rowH;

            drawCell(30, gy, colMain, rowH, 'Especifique', null, '#000', 'Helvetica', 8, 'left');
            rx = 30 + colMain;
            const totalEsp = getMonto('especifique') || 0;
            for(let i=0; i<7; i++) {
                const fechaDia = fechasSol.find(f => new Date(f+'T00:00:00').getDay() === i);
                const val = fechaDia ? getMontoFecha(fechaDia, 'especifique') : 0;
                drawCell(rx, gy, colDay, rowH, val > 0 ? formatMoney(val) : '', BG_VERDE_CLARO, '#000', 'Helvetica', 7, 'right'); rx += colDay;
            }
            doc.lineWidth(2); drawCell(rx, gy, colTotal, rowH, totalEsp > 0 ? formatMoney(totalEsp) : '', null, '#000', 'Helvetica', 8, 'right'); doc.lineWidth(1); gy += rowH;

            doc.lineWidth(2);
            let anchoMerge = colMain + (colDay*7);
            drawCell(30, gy, anchoMerge, 18, 'TOTAL', null, '#000', 'Helvetica-Bold', 9, 'left');
            drawCell(30+colMain, gy, colDay*2, 18, ''); drawCell(30+colMain+(colDay*2), gy, colDay*2, 18, ''); drawCell(30+colMain+(colDay*4), gy, colDay*3, 18, '');
            drawCell(30+anchoMerge, gy, colTotal, 18, formatMoney(sol.total_solicitado), null, '#000', 'Helvetica-Bold', 9, 'right');
            doc.lineWidth(1);
            gy += 20;

            doc.font('Helvetica').fontSize(8).fillColor('#000').text('Notas (Antes o despues de impresion).', 30, gy);
            doc.font('Helvetica').fontSize(8).fillColor('#FF0000').text('¡Para imprimir. Ver instrucciones en 5 pasos aqui!', 200, gy);
            gy += 12;
            drawCell(30, gy, 522, 25, '', BG_VERDE_CLARO, '#000', 'Helvetica', 8, 'left', true);
            gy += 35; 

            // ── FIRMAS INFERIORES: D.H.O. | Tesorería | Recibió ──────────────
            const wF3 = 150, gapF3 = 18;
            const totalW3 = wF3*3 + gapF3*2;
            const xF3A = (doc.page.width - totalW3) / 2; // DHO
            const xF3B = xF3A + wF3 + gapF3;              // Tesorería  
            const xF3C = xF3B + wF3 + gapF3;              // Recibió

            doc.font('Helvetica').fontSize(9).fillColor('#000')
               .text('Otorgó (D.H.O.)', xF3A, gy, { width: wF3, align: 'center' })
               .text('Quien Paga (Tesorería)', xF3B, gy, { width: wF3, align: 'center' })
               .text('Recibió', xF3C, gy, { width: wF3, align: 'center' });

            cargarFirmaViatic(sol.dho_firma, xF3A + 25, gy + 12, 100, 28);

            // Firma de tesorería: si está pagado se muestra la firma del autorizador
            if (['AUTORIZADO_DHO','PAGADO','RECIBIDO','COMPROBADO'].includes(sol.estatus)) {
                cargarFirmaViatic(sol.autorizador_firma, xF3B + 25, gy + 12, 100, 28);
            }

            // Firma de recepción del empleado
            if (['RECIBIDO','COMPROBADO'].includes(sol.estatus)) {
                cargarFirmaViatic(sol.solicitante_firma, xF3C + 25, gy + 12, 100, 28);
            }

            const yLineaFirma = gy + 50;
            [xF3A, xF3B, xF3C].forEach(x => doc.moveTo(x, yLineaFirma).lineTo(x + wF3, yLineaFirma).stroke());

            const yTexto = yLineaFirma + 4;
            const textoRecibio = ['RECIBIDO','COMPROBADO'].includes(sol.estatus)
                ? (sol.solicitante_nombre?.toUpperCase() || '') : 'PENDIENTE DE RECEPCIÓN';

            doc.font('Helvetica').fontSize(7).fillColor(COLOR_TEXTO_AZUL)
               .text(sol.dho_nombre?.toUpperCase() || 'PENDIENTE D.H.O.', xF3A, yTexto, { width: wF3, align: 'center' })
               .text(['AUTORIZADO_DHO','PAGADO','RECIBIDO','COMPROBADO'].includes(sol.estatus) ? (sol.autorizador_nombre?.toUpperCase() || '---') : 'PENDIENTE TESORERÍA', xF3B, yTexto, { width: wF3, align: 'center' })
               .text(textoRecibio, xF3C, yTexto, { width: wF3, align: 'center' });

            const yPuesto = yTexto + 9;
            doc.font('Helvetica-BoldOblique').fillColor('#000').fontSize(7)
               .text(sol.dho_puesto || 'D.H.O / FINANZAS', xF3A, yPuesto, { width: wF3, align: 'center' })
               .text(sol.autorizador_puesto || 'Tesorería', xF3B, yPuesto, { width: wF3, align: 'center' })
               .text(`${sol.solicitante_unidad || ''} - ${sol.solicitante_puesto || ''}`, xF3C, yPuesto, { width: wF3, align: 'center' });

            const yEmpresa = yPuesto + 9;
            doc.font('Helvetica').fontSize(7)
               .text(sol.dho_empresa || 'Opciones Sacimex SA de CV SOFOM ENR', xF3A, yEmpresa, { width: wF3, align: 'center' })
               .text(sol.autorizador_empresa || 'Opciones Sacimex SA de CV SOFOM ENR', xF3B, yEmpresa, { width: wF3, align: 'center' })
               .text(sol.solicitante_empresa || '', xF3C, yEmpresa, { width: wF3, align: 'center' });

            doc.end();
        });
    });
});

module.exports = router;