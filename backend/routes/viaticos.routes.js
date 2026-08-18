const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const { puedeFirmar, puedeFirmarAsync, obtenerRolDeNivel } = require('../utils/motorAutorizacion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

// ── NODEMAILER (reutiliza la misma config que solicitudes) ─────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
const enviarCorreo = async (to, subject, html) => {
    if (!to) return;
    try { await transporter.sendMail({ from: `"Sacimex Viáticos" <${process.env.SMTP_USER}>`, to, subject, html }); }
    catch (e) { console.error('[Viáticos] Error correo:', e.message); }
};

// ── Niveles fijos de la cadena de viáticos ────────────────────────────────────
//   0 = Jefe Inmediato   1 = D.H.O.   2 = Tesorería (pago)
const NIVELES_VIATICOS = 3; // cuántas firmas se necesitan antes de PAGADO

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, path.join(__dirname, '../uploads')); },
    filename: function (req, file, cb) {
        cb(null, 'viatico-' + req.params.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const formatMoney = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

router.get('/perfil', verificarToken, (req, res) => {
    const queryPerfil = `
        SELECT p.nombre_razon_social AS nombre_completo,
               e.puesto, e.departamento, e.unidad_negocio AS ubicacion,
               e.jefe_inmediato, e.sexo,
               COALESCE(e.unidad_negocio, '') AS area
        FROM usuarios u
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        WHERE u.id = ?`;

    const queryEmpleados = `
        SELECT p.nombre_razon_social AS nombre_completo, e.sexo, e.puesto
        FROM usuarios u
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        WHERE u.estatus_activo = 1
        ORDER BY p.nombre_razon_social ASC`;

    db.query(queryPerfil, [req.usuario.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        const perfil = results.length > 0 ? results[0] : {};
        db.query(queryEmpleados, (err2, empleados) => {
            if (err2) return res.status(500).json({ success: false });
            res.json({ success: true, perfil, empleados: empleados || [] });
        });
    });
});

router.post('/', verificarToken, (req, res) => {
    const id_usuario = req.usuario.id;
    const { 
        puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo,
        fecha_salida, fecha_regreso, dias_comision, medio_transporte,
        monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado,
        desglose_dias
    } = req.body;
    const num = (v) => parseFloat(v) || 0;

    const query = `INSERT INTO solicitudes_viaticos 
        (id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo, 
         fecha_salida, fecha_regreso, dias_comision, medio_transporte, 
         monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado,
         nivel_actual, niveles_requeridos, estatus) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'PENDIENTE')`;

    const values = [
        id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo,
        fecha_salida, fecha_regreso, parseInt(dias_comision) || 0, medio_transporte,
        num(monto_alimentos), num(monto_hospedaje), num(monto_pasajes), num(monto_taxis),
        num(monto_gasolina), num(monto_otros), num(total_solicitado),
        NIVELES_VIATICOS
    ];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const id_solicitud = result.insertId;

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

        // Notificar al nivel 0 (Jefe Inmediato) por correo
        // Nivel 0 de viáticos no tiene rol fijo, la notificación se omite
        // porque el jefe se identifica por nombre, no por rol en la BD.
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
    db.query(
        `SELECT sv.*,
                COALESCE(p.nombre_razon_social, u.username) AS solicitante_nombre_completo,
                e.puesto AS solicitante_puesto_real,
                e.unidad_negocio AS unidad_negocio_real,
                hrc.motivo AS motivo_rechazo
         FROM solicitudes_viaticos sv
         JOIN usuarios u ON sv.id_usuario = u.id
         LEFT JOIN empleados e ON u.id_empleado = e.id_persona
         LEFT JOIN personas p ON e.id_persona = p.id
         LEFT JOIN historial_revision_comprobacion hrc ON hrc.id_solicitud = sv.id
             AND hrc.accion = 'RECHAZADA'
             AND hrc.id = (SELECT MAX(id) FROM historial_revision_comprobacion WHERE id_solicitud = sv.id AND accion = 'RECHAZADA')
         WHERE sv.id_usuario = ?
         ORDER BY sv.fecha_solicitud DESC`,
        [req.usuario.id],
        (err, results) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, data: results });
        }
    );
});

// GET /historial-firmadas — solicitudes que YO he firmado (cualquier nivel)
router.get('/historial-firmadas', verificarToken, (req, res) => {
    db.query(
        `SELECT sv.*,
                COALESCE(p.nombre_razon_social, u.username) AS solicitante_nombre_completo,
                e.puesto AS solicitante_puesto,
                hfv.etapa_firma, hfv.accion, hfv.fecha_firma, hfv.comentarios
         FROM historial_firmas_viaticos hfv
         JOIN solicitudes_viaticos sv ON hfv.id_solicitud = sv.id
         JOIN usuarios u ON sv.id_usuario = u.id
         LEFT JOIN empleados e ON u.id_empleado = e.id_persona
         LEFT JOIN personas p ON e.id_persona = p.id
         WHERE hfv.id_usuario = ?
         ORDER BY hfv.fecha_firma DESC`,
        [req.usuario.id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: rows });
        }
    );
});


// Reemplaza /pendientes-jefe, /todas y la lógica manual de roles.
router.get('/pendientes', verificarToken, async (req, res) => {
    const sql = `
        SELECT sv.*,
               u.username AS solicitante_usuario,
               COALESCE(p.nombre_razon_social, u.username) AS solicitante_nombre_completo,
               e.puesto AS solicitante_puesto
        FROM solicitudes_viaticos sv
        JOIN usuarios u ON sv.id_usuario = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        WHERE sv.estatus NOT IN ('PAGADO', 'RECIBIDO', 'COMPROBADO', 'RECHAZADO')
        ORDER BY sv.fecha_solicitud ASC`;

    db.query(sql, async (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        try {
            const filtradas = [];
            for (const sol of rows) {
                // El propio solicitante siempre ve su solicitud
                if (sol.id_usuario === req.usuario.id) {
                    sol.me_toca_firmar = false;
                    filtradas.push(sol);
                    continue;
                }
                const resultado = await puedeFirmarAsync({ usuario: req.usuario, nivel: sol.nivel_actual, tipoFlujo: 'viaticos' });
                // Nivel 0 = Jefe Inmediato: el motor devuelve esJefeNivel=true
                // pero aquí validamos que el nombre del usuario coincida con jefe_inmediato
                if (resultado.esJefeNivel) {
                    const jefeNombrado = (sol.jefe_inmediato || '').trim().toUpperCase();
                    const nombreUsuario = (req.usuario.nombre_completo || req.usuario.username || '').trim().toUpperCase();
                    if (!jefeNombrado || !nombreUsuario || jefeNombrado !== nombreUsuario) {
                        continue; // No es el jefe correcto de esta solicitud
                    }
                    sol.me_toca_firmar = true;
                    filtradas.push(sol);
                    continue;
                }
                if (resultado.puede) {
                    sol.me_toca_firmar = true;
                    filtradas.push(sol);
                }
            }
            res.json({ success: true, data: filtradas });
        } catch (e) {
            res.status(500).json({ success: false, message: 'Error validando autorización' });
        }
    });
});

// ── GET /todas — historial completo (solo ADMIN) ───────────────────────────────
router.get('/todas', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query(
        `SELECT sv.*,
                u.username AS solicitante_usuario,
                COALESCE(p.nombre_razon_social, u.username) AS solicitante_nombre_completo,
                e.puesto AS solicitante_puesto
         FROM solicitudes_viaticos sv
         JOIN usuarios u ON sv.id_usuario = u.id
         LEFT JOIN empleados e ON u.id_empleado = e.id_persona
         LEFT JOIN personas p ON e.id_persona = p.id
         ORDER BY sv.fecha_solicitud DESC`,
        (err, results) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, data: results });
        }
    );
});

// ── POST /autorizar/:id — firma del nivel actual (Jefe → D.H.O. → Tesorería) ─
router.post('/autorizar/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { comentario } = req.body;

    db.query(
        'SELECT id, nivel_actual, niveles_requeridos, estatus, total_solicitado, destino FROM solicitudes_viaticos WHERE id = ?',
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if (!rows.length) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
            const sol = rows[0];

            if (['PAGADO', 'RECIBIDO', 'COMPROBADO', 'RECHAZADO'].includes(sol.estatus)) {
                return res.status(400).json({ success: false, message: 'Esta solicitud ya fue procesada.' });
            }

            puedeFirmar({ usuario: req.usuario, nivel: sol.nivel_actual, tipoFlujo: 'viaticos' }, (errMotor, resultado) => {
                if (errMotor) return res.status(500).json({ success: false, message: 'Error validando autorización.' });
                if (!resultado.puede) return res.status(403).json({ success: false, message: `No tienes permiso para firmar el nivel actual (${sol.nivel_actual}).` });

                const etiqueta = (resultado.etiqueta || `NIVEL ${sol.nivel_actual}`).toUpperCase();
                const nuevoNivel = sol.nivel_actual + 1;

                // Cuando se cubren todos los niveles → PAGADO (Tesorería es el último nivel)
                let nuevoEstatus;
                if (nuevoNivel >= sol.niveles_requeridos) {
                    nuevoEstatus = 'PAGADO';
                } else {
                    nuevoEstatus = `AUTORIZADO_N${sol.nivel_actual}`; // AUTORIZADO_N0, AUTORIZADO_N1 …
                }

                db.beginTransaction(errTx => {
                    if (errTx) return res.status(500).json({ success: false });

                    // Registrar firma en historial compartido con solicitudes de recursos
                    db.query(
                        `INSERT INTO historial_firmas_viaticos
                            (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios)
                         VALUES (?, ?, ?, 'FIRMADO', 'APROBADO', ?)`,
                        [id, req.usuario.id, etiqueta, comentario || 'Aprobado'],
                        (errF) => {
                            if (errF) return db.rollback(() => res.status(500).json({ success: false, message: errF.message }));

                            db.query(
                                'UPDATE solicitudes_viaticos SET estatus = ?, nivel_actual = ? WHERE id = ?',
                                [nuevoEstatus, nuevoNivel, id],
                                (errU) => {
                                    if (errU) return db.rollback(() => res.status(500).json({ success: false, message: errU.message }));

                                    db.commit(async errC => {
                                        if (errC) return db.rollback(() => res.status(500).json({ success: false }));

                                        registrarBitacora(req.usuario.id, 'VIATICO_AUTORIZADO',
                                            `Firmó etapa ${etiqueta} del viático #${id} → ${nuevoEstatus}`, req);

                                        const msgMap = {
                                            AUTORIZADO_N0: 'Autorizado por Jefe Inmediato. Pendiente revisión D.H.O.',
                                            AUTORIZADO_N1: 'Autorizado por D.H.O. Pendiente pago de Tesorería.',
                                            PAGADO:        'Pago registrado por Tesorería. El empleado debe confirmar recepción.'
                                        };
                                        res.json({ success: true, nuevo_estatus: nuevoEstatus, message: msgMap[nuevoEstatus] || 'Firmado correctamente.' });

                                        // Notificar al siguiente nivel si no es el último
                                        if (nuevoEstatus !== 'PAGADO') {
                                            obtenerRolDeNivel(nuevoNivel, req.usuario.id_departamento, async (errRol, rol) => {
                                                if (errRol || !rol) return;
                                                db.query(
                                                    `SELECT p.email_contacto FROM usuarios u
                                                     LEFT JOIN empleados e ON u.id_empleado = e.id_persona
                                                     LEFT JOIN personas p ON e.id_persona = p.id
                                                     WHERE u.rol = ? AND u.estatus_activo = 1 LIMIT 1`,
                                                    [rol],
                                                    (errM, mRows) => {
                                                        if (errM || !mRows[0]?.email_contacto) return;
                                                        enviarCorreo(mRows[0].email_contacto,
                                                            `Viático #${id} pendiente de tu autorización`,
                                                            `<p>El viático #${id} a <strong>${sol.destino}</strong> por <strong>$${parseFloat(sol.total_solicitado).toFixed(2)}</strong> llegó a tu nivel para aprobación. Ingresa al sistema para firmarlo.</p>`
                                                        );
                                                    }
                                                );
                                            }, 'viaticos');
                                        } else {
                                            // Notificar al empleado que ya fue pagado
                                            db.query(
                                                `SELECT p.email_contacto FROM solicitudes_viaticos sv
                                                 JOIN usuarios u ON sv.id_usuario = u.id
                                                 LEFT JOIN empleados e ON u.id_empleado = e.id_persona
                                                 LEFT JOIN personas p ON e.id_persona = p.id
                                                 WHERE sv.id = ? LIMIT 1`,
                                                [id],
                                                (errE, eRows) => {
                                                    if (errE || !eRows[0]?.email_contacto) return;
                                                    enviarCorreo(eRows[0].email_contacto,
                                                        `Tu viático #${id} fue pagado — confirma recepción`,
                                                        `<p>Tu viático a <strong>${sol.destino}</strong> ha sido procesado. Ingresa al sistema y sube tu comprobante bancario para confirmar que recibiste el dinero.</p>`
                                                    );
                                                }
                                            );
                                        }
                                    });
                                }
                            );
                        }
                    );
                });
            });
        }
    );
});

// ── POST /rechazar/:id ────────────────────────────────────────────────────────
router.post('/rechazar/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    db.query('SELECT nivel_actual FROM solicitudes_viaticos WHERE id = ?', [id], (err, rows) => {
        if (err || !rows.length) return res.status(404).json({ success: false, message: 'No encontrada.' });
        const sol = rows[0];

        puedeFirmar({ usuario: req.usuario, nivel: sol.nivel_actual, tipoFlujo: 'viaticos' }, (errMotor, resultado) => {
            if (errMotor) return res.status(500).json({ success: false });
            if (!resultado.puede && req.usuario.rol !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'No tienes permiso para rechazar en este nivel.' });
            }
            const etiqueta = (resultado.etiqueta || `NIVEL ${sol.nivel_actual}`).toUpperCase();
            db.query(
                `INSERT INTO historial_firmas_viaticos (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios)
                 VALUES (?, ?, ?, 'RECHAZADO', 'RECHAZADO', ?)`,
                [id, req.usuario.id, etiqueta, motivo || 'Rechazado'],
                () => {
                    db.query('UPDATE solicitudes_viaticos SET estatus = "RECHAZADO" WHERE id = ?', [id], () => {
                        registrarBitacora(req.usuario.id, 'VIATICO_RECHAZADO', `Rechazó viático #${id}. Motivo: ${motivo || 'No especificado'}`, req);
                        res.json({ success: true, message: 'Solicitud rechazada.' });
                    });
                }
            );
        });
    });
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
                // Solo avanza a COMPROBADO si venía de RECIBIDO; si ya está más adelante no lo retrocede.
                `UPDATE solicitudes_viaticos
                 SET url_comprobante_gastos = ?,
                     estatus = IF(estatus = 'RECIBIDO', 'COMPROBADO', estatus)
                 WHERE id = ? AND id_usuario = ?`,
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
    const { responsable, nombre_proveedor_header, fecha_inicial, fecha_final,
            lugar, recursos_otorgados, fondo_fijo, unidad_negocio,
            objeto, personas_adicionales, total_dias, partidas } = req.body;

    db.query('SELECT id, estatus FROM solicitudes_viaticos WHERE id = ? AND id_usuario = ?',
        [idSolicitud, req.usuario.id], (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: 'Error BD.' });
            if (!rows.length) return res.status(403).json({ success: false, message: 'Sin acceso.' });
            if (!['AUTORIZADO_DHO','PAGADO','RECIBIDO','COMPROBADO','COMPROBACION_RECHAZADA'].includes(rows[0].estatus))
                return res.status(400).json({ success: false, message: 'Estado no válido para comprobación.' });

            const totalComprobado = (partidas||[]).reduce((s,p) => s + (parseFloat(p.importe)||0), 0);
            const pendiente = (parseFloat(recursos_otorgados)||0) - totalComprobado;

            db.query(
                `INSERT INTO comprobacion_gastos
                    (id_solicitud,responsable,nombre_proveedor,fecha_inicial,fecha_final,lugar,
                     recursos_otorgados,fondo_fijo,unidad_negocio,objeto,personas_adicionales,total_dias,total_comprobado,pendiente)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE
                    responsable=VALUES(responsable), nombre_proveedor=VALUES(nombre_proveedor),
                    fecha_inicial=VALUES(fecha_inicial), fecha_final=VALUES(fecha_final),
                    lugar=VALUES(lugar), recursos_otorgados=VALUES(recursos_otorgados),
                    fondo_fijo=VALUES(fondo_fijo), unidad_negocio=VALUES(unidad_negocio),
                    objeto=VALUES(objeto), personas_adicionales=VALUES(personas_adicionales),
                    total_dias=VALUES(total_dias),
                    total_comprobado=VALUES(total_comprobado), pendiente=VALUES(pendiente)`,
                [idSolicitud, responsable, nombre_proveedor_header,
                 fecha_inicial||null, fecha_final||null, lugar,
                 parseFloat(recursos_otorgados)||0, fondo_fijo, unidad_negocio, objeto,
                 parseInt(personas_adicionales)||0, parseInt(total_dias)||0,
                 totalComprobado, pendiente],
                (errU) => {
                    if (errU) return res.status(500).json({ success: false, message: errU.sqlMessage });
                    db.query('SELECT id FROM comprobacion_gastos WHERE id_solicitud=?', [idSolicitud], (errS, compRows) => {
                        if (errS || !compRows.length) return res.status(500).json({ success: false });
                        const idComp = compRows[0].id;
                        db.query('DELETE FROM comprobacion_partidas WHERE id_comprobacion=?', [idComp], (errD) => {
                            if (errD) return res.status(500).json({ success: false });
                            const validas = (partidas||[]).filter(p => p.importe || p.descripcion || p.nombre_proveedor);
                            if (!validas.length) {
                                registrarBitacora(req.usuario.id,'COMPROBACION_GUARDADA',`Viático #${idSolicitud} sin partidas`,req);
                                return res.json({ success: true, message: 'Comprobación guardada.' });
                            }
                            const vals = validas.map(p => [idComp, p.fecha||null, parseFloat(p.importe)||0,
                                p.folio_fiscal||'', (p.rfc_proveedor||'').toUpperCase(),
                                p.nombre_proveedor||'', p.rubro||'Otros gastos', p.descripcion||'',
                                parseFloat(p.tipo_cambio)||1.00]);
                            db.query('INSERT INTO comprobacion_partidas (id_comprobacion,fecha,importe,folio_fiscal,rfc_proveedor,nombre_proveedor,rubro,descripcion,tipo_cambio) VALUES ?',
                                [vals], (errI) => {
                                    if (errI) return res.status(500).json({ success: false, message: errI.sqlMessage });
                                    db.query(`UPDATE solicitudes_viaticos SET estatus=IF(estatus='RECIBIDO','COMPROBADO',estatus) WHERE id=?`, [idSolicitud], ()=>{});
                                    registrarBitacora(req.usuario.id,'COMPROBACION_GUARDADA',`Viático #${idSolicitud} — ${vals.length} partidas`,req);
                                    res.json({ success: true, message: 'Comprobación guardada correctamente.' });
                                });
                        });
                    });
                }
            );
        }
    );
});

// ==============================================================================
// REVISIÓN DE COMPROBACIONES — CONTABILIDAD (id_departamento = 4)
// ==============================================================================
router.get('/comprobaciones-pendientes', verificarToken, (req, res) => {
    if (parseInt(req.usuario.id_departamento) !== 4 && req.usuario.rol !== "ADMIN" && req.usuario.rol !== "AUTORIZADOR_1" && req.usuario.rol !== "REVISOR") {
        return res.status(403).json({ success: false, message: 'Solo Contabilidad puede revisar comprobaciones.' });
    }
    db.query(
        `SELECT sv.id, sv.estatus, sv.destino, sv.motivo, sv.total_solicitado,
                sv.fecha_salida, sv.fecha_regreso, sv.dias_comision,
                cg.id AS id_comprobacion, cg.total_comprobado, cg.pendiente,
                cg.fecha_registro AS fecha_comprobacion,
                COALESCE(p.nombre_razon_social, u.username) AS solicitante_nombre,
                e.puesto AS solicitante_puesto, e.departamento,
                hrc.accion AS ultima_accion, hrc.motivo AS ultimo_motivo
         FROM solicitudes_viaticos sv
         JOIN comprobacion_gastos cg ON cg.id_solicitud = sv.id
         JOIN usuarios u ON sv.id_usuario = u.id
         LEFT JOIN empleados e ON u.id_empleado = e.id_persona
         LEFT JOIN personas p ON e.id_persona = p.id
         LEFT JOIN historial_revision_comprobacion hrc ON hrc.id_solicitud = sv.id
             AND hrc.id = (SELECT MAX(id) FROM historial_revision_comprobacion WHERE id_solicitud = sv.id)
         WHERE sv.estatus IN ('COMPROBADO','COMPROBACION_RECHAZADA')
         ORDER BY cg.fecha_registro DESC`,
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: rows });
        }
    );
});

router.post('/:id/revisar-comprobacion', verificarToken, (req, res) => {
    if (parseInt(req.usuario.id_departamento) !== 4 && req.usuario.rol !== "ADMIN" && req.usuario.rol !== "AUTORIZADOR_1" && req.usuario.rol !== "REVISOR") {
        return res.status(403).json({ success: false, message: 'Solo Contabilidad puede revisar comprobaciones.' });
    }
    const { accion, motivo } = req.body;
    if (!['APROBADA','RECHAZADA'].includes(accion))
        return res.status(400).json({ success: false, message: 'Acción inválida.' });
    if (accion === 'RECHAZADA' && !motivo?.trim())
        return res.status(400).json({ success: false, message: 'Debes indicar el motivo del rechazo.' });

    db.query('SELECT id, estatus FROM solicitudes_viaticos WHERE id = ?', [req.params.id], (err, rows) => {
        if (err || !rows.length) return res.status(404).json({ success: false, message: 'No encontrada.' });
        if (!['COMPROBADO','COMPROBACION_RECHAZADA'].includes(rows[0].estatus))
            return res.status(400).json({ success: false, message: 'No tiene comprobación pendiente de revisión.' });

        db.query(
            'INSERT INTO historial_revision_comprobacion (id_solicitud, id_revisor, accion, motivo) VALUES (?,?,?,?)',
            [req.params.id, req.usuario.id, accion, motivo || null],
            (errH) => {
                if (errH) return res.status(500).json({ success: false, message: errH.message });
                if (accion === 'RECHAZADA') {
                    db.query(`UPDATE solicitudes_viaticos SET estatus='COMPROBACION_RECHAZADA' WHERE id=?`,
                        [req.params.id], (errU) => {
                            if (errU) return res.status(500).json({ success: false });
                            registrarBitacora(req.usuario.id, 'COMPROBACION_RECHAZADA', `Rechazó comprobación #${req.params.id}: ${motivo}`, req);
                            res.json({ success: true, message: 'Comprobación rechazada.' });
                        });
                } else {
                    registrarBitacora(req.usuario.id, 'COMPROBACION_APROBADA', `Aprobó comprobación #${req.params.id}`, req);
                    res.json({ success: true, message: 'Comprobación aprobada.' });
                }
            }
        );
    });
});

router.get('/:id/comprobacion-universal', verificarToken, (req, res) => {
    const idSolicitud = req.params.id;
    db.query('SELECT * FROM comprobacion_gastos WHERE id_solicitud = ?', [idSolicitud], (err, compRows) => {
        if (err) return res.status(500).json({ success: false });
        if (compRows.length === 0) return res.json({ success: true, data: null });
        const comp = compRows[0];
        db.query('SELECT * FROM comprobacion_partidas WHERE id_comprobacion = ? ORDER BY id ASC', [comp.id], (errP, partidas) => {
            if (errP) return res.status(500).json({ success: false });
            // Traer historial de revisiones de contabilidad
            db.query(
                `SELECT hrc.accion, hrc.motivo, hrc.fecha_revision,
                        COALESCE(p.nombre_razon_social, u.username) AS revisor_nombre
                 FROM historial_revision_comprobacion hrc
                 JOIN usuarios u ON hrc.id_revisor = u.id
                 LEFT JOIN empleados e ON u.id_empleado = e.id_persona
                 LEFT JOIN personas p ON e.id_persona = p.id
                 WHERE hrc.id_solicitud = ?
                 ORDER BY hrc.fecha_revision ASC`,
                [idSolicitud],
                (errH, historial) => {
                    if (errH) historial = [];
                    res.json({ success: true, data: { ...comp, partidas, historial: historial || [] } });
                }
            );
        });
    });
});

// ==============================================================================
// B. PDF DE LA COMPROBACION UNIVERSAL DE GASTOS (SAC-TRS-GST)
// ==============================================================================
router.get('/:id/comprobacion-universal/pdf', verificarToken, (req, res) => {
    const idSolicitud = req.params.id;

    const querySolicitud = `
        SELECT sv.id, sv.destino, sv.total_solicitado, sv.dias_comision,
               sv.fecha_salida, sv.fecha_regreso,
               p.nombre_razon_social AS solicitante_nombre,
               e.puesto AS solicitante_puesto,
               e.unidad_negocio AS solicitante_unidad,
               e.empresa_maestra AS solicitante_empresa,
               u.ruta_firma_png AS solicitante_firma,
               -- Firma del revisor de contabilidad (última aprobación o cualquier revisión)
               u2.ruta_firma_png AS revisor_firma,
               COALESCE(p2.nombre_razon_social, u2.username) AS revisor_nombre,
               e2.puesto AS revisor_puesto
        FROM solicitudes_viaticos sv
        LEFT JOIN usuarios u ON sv.id_usuario = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN historial_revision_comprobacion hrc ON hrc.id_solicitud = sv.id
            AND hrc.id = (SELECT MAX(id) FROM historial_revision_comprobacion WHERE id_solicitud = sv.id)
        LEFT JOIN usuarios u2 ON hrc.id_revisor = u2.id
        LEFT JOIN empleados e2 ON u2.id_empleado = e2.id_persona
        LEFT JOIN personas p2 ON e2.id_persona = p2.id
        WHERE sv.id = ?`;

    db.query(querySolicitud, [idSolicitud], (errSol, solRows) => {
        if (errSol) return res.status(500).json({ success: false, message: 'Error servidor' });
        if (solRows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        const sol = solRows[0];

        db.query('SELECT * FROM comprobacion_gastos WHERE id_solicitud = ?', [idSolicitud], (err, compRows) => {
            if (err) return res.status(500).json({ success: false });
            if (compRows.length === 0) return res.status(404).json({ success: false, message: 'Este viático aún no tiene comprobación registrada.' });
            const comp = compRows[0];

            db.query('SELECT * FROM comprobacion_partidas WHERE id_comprobacion = ? ORDER BY fecha ASC, id ASC', [comp.id], (errP, partidas) => {
                if (errP) return res.status(500).json({ success: false });

                const doc = new PDFDocument({ size: 'LETTER', margin: 25, autoFirstPage: true });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename=Comprobacion_${sol.id}.pdf`);
                doc.pipe(res);
                registrarBitacora(req.usuario.id, 'EXPORTAR_PDF_COMPROBACION', `PDF comprobación viático #${sol.id}`, req);

                const anio = new Date().getFullYear();
                const AZUL    = '#0000FF';
                const VERDE   = '#008000';
                const BG_VERDE = '#eaffea';
                const BG_GRIS  = '#f1f5f9';
                const BG_DARK  = '#1e293b';
                const L = 25, W = 562;

                const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';
                const fmtMoney = (n) => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

                const cell = (x, cy, w, h, text, fill, color='#000', font='Helvetica', size=7.5, align='left', noBorder=false) => {
                    if (fill) doc.rect(x, cy, w, h).fill(fill);
                    if (!noBorder) doc.rect(x, cy, w, h).stroke('#aaa');
                    if (text !== undefined && text !== null && text !== '') {
                        doc.fillColor(color).font(font).fontSize(size);
                        const th = doc.heightOfString(String(text), { width: w - 4 });
                        const ty = cy + Math.max(0, (h - th) / 2);
                        doc.text(String(text), align === 'left' ? x+3 : x, ty, { width: w - (align==='left'?3:0), align });
                    }
                };

                // ── LOGO ─────────────────────────────────────────────────────
                let y = 25;
                const logoPath = path.join(__dirname, '../../frontend/src/assets/Logo.png');
                if (fs.existsSync(logoPath)) { try { doc.image(logoPath, L, y, { width: 45 }); } catch(e) {} }

                // ── TÍTULO ───────────────────────────────────────────────────
                doc.font('Helvetica-Bold').fontSize(13).fillColor(VERDE)
                   .text('COMPROBACION UNIVERSAL DE GASTOS ' + anio, 75, y + 2, { width: 380 });
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
                   .text(`SAC-TRS-GST-${anio}`, 0, y + 2, { align: 'right', width: W + L });
                doc.font('Helvetica').fontSize(8).fillColor('#000')
                   .text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 75, y + 18);
                y += 40;
                doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#ccc').stroke();
                y += 8;

                // ── DATOS GENERALES ──────────────────────────────────────────
                const cA = 100, cB = 140, cC = 110, cD = 140, rH = 15;

                const fila = (label1, val1, label2, val2) => {
                    cell(L,         y, cA, rH, label1, BG_GRIS, '#000', 'Helvetica-Bold', 7.5, 'left');
                    cell(L+cA,      y, cB, rH, val1,   BG_VERDE, AZUL,  'Helvetica',      7.5, 'left');
                    cell(L+cA+cB,   y, cC, rH, label2, BG_GRIS, '#000', 'Helvetica-Bold', 7.5, 'left');
                    cell(L+cA+cB+cC,y, cD, rH, val2,   BG_VERDE, AZUL,  'Helvetica',      7.5, 'left');
                    y += rH;
                };

                fila('Responsable:',        sol.solicitante_nombre || comp.responsable || '',
                     'Nombres adicionales:', comp.personas_adicionales > 0 ? String(comp.personas_adicionales) : '0');
                fila('Fecha (dd/mm/aa) Ini:',fmtFecha(comp.fecha_inicial),
                     'Final:',               fmtFecha(comp.fecha_final));
                fila('Lugar:',              comp.lugar || sol.destino || '',
                     'Fondo fijo:',          comp.fondo_fijo || 'N/A');
                fila('Recursos otorgados $:',fmtMoney(comp.recursos_otorgados),
                     'Objeto:',              comp.objeto || sol.destino || '');
                fila('Unidad de negocio:',  comp.unidad_negocio || sol.solicitante_unidad || '',
                     'Comprobado $:',        fmtMoney(comp.total_comprobado));

                // Fila especial: Pendiente (color según si sobró o faltó)
                const pendiente = parseFloat(comp.pendiente || 0);
                const pendienteBg = pendiente > 0 ? '#fee2e2' : '#dcfce7';
                const pendienteColor = pendiente > 0 ? '#dc2626' : '#16a34a';
                const pendienteLabel = pendiente > 0 ? 'Pendiente $ (faltó):' : pendiente < 0 ? 'Sobrante $ (devolver):' : 'Pendiente $:';
                cell(L,          y, cA,     rH, 'Total días:',   BG_GRIS, '#000', 'Helvetica-Bold', 7.5, 'left');
                cell(L+cA,       y, cB,     rH, String(comp.total_dias || sol.dias_comision || ''), BG_VERDE, AZUL, 'Helvetica', 7.5, 'left');
                cell(L+cA+cB,    y, cC,     rH, pendienteLabel,  BG_GRIS, '#000', 'Helvetica-Bold', 7.5, 'left');
                cell(L+cA+cB+cC, y, cD,     rH, fmtMoney(Math.abs(pendiente)), pendienteBg, pendienteColor, 'Helvetica-Bold', 7.5, 'left');
                y += rH + 10;

                // ── TABLA DE PARTIDAS ────────────────────────────────────────
                doc.font('Helvetica-Bold').fontSize(9).fillColor(VERDE)
                   .text('DETALLE DE GASTOS COMPROBADOS', L, y);
                y += 12;

                const COLS = [
                    { label: 'Día\n(dd/mm/aa)', w: 50 },
                    { label: 'Importe',         w: 55 },
                    { label: 'Factura o\nFolio Fiscal', w: 75 },
                    { label: 'RFC\nProveedor',  w: 62 },
                    { label: 'Nombre Proveedor', w: 95 },
                    { label: 'Rubro',           w: 60 },
                    { label: 'Descripción',     w: 90 },
                    { label: 'T.C.',            w: 30 },
                    { label: 'Total',           w: 45 },
                ]; // total = 562 ✓
                const HEAD_H = 22;
                let cx = L;
                COLS.forEach(c => {
                    cell(cx, y, c.w, HEAD_H, c.label, BG_DARK, '#fff', 'Helvetica-Bold', 7, 'center');
                    cx += c.w;
                });
                y += HEAD_H;

                const PAGE_BOTTOM = 680;
                const ROW_H = 14;

                const dibujarFila = (p, idx) => {
                    if (y + ROW_H > PAGE_BOTTOM) {
                        // Pie de página antes de saltar
                        doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
                           .text('Continúa en la siguiente página...', L, y + 4);
                        doc.addPage();
                        y = 40;
                        cx = L;
                        COLS.forEach(c => {
                            cell(cx, y, c.w, HEAD_H, c.label, BG_DARK, '#fff', 'Helvetica-Bold', 7, 'center');
                            cx += c.w;
                        });
                        y += HEAD_H;
                    }
                    const bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
                    const imp = parseFloat(p.importe) || 0;
                    const tc  = parseFloat(p.tipo_cambio || 1);
                    cx = L;
                    cell(cx, y, 52,  ROW_H, fmtFecha(p.fecha),         bg, '#000', 'Helvetica', 7, 'center'); cx+=52;
                    cell(cx, y, 52,  ROW_H, fmtMoney(imp),              bg, '#000', 'Helvetica', 7, 'right');  cx+=52;
                    cell(cx, y, 80,  ROW_H, p.folio_fiscal || '',       bg, '#000', 'Helvetica', 6.5, 'left'); cx+=80;
                    cell(cx, y, 68,  ROW_H, p.rfc_proveedor || '',      bg, '#000', 'Helvetica', 6.5, 'left'); cx+=68;
                    cell(cx, y, 100, ROW_H, p.nombre_proveedor || '',   bg, '#000', 'Helvetica', 6.5, 'left'); cx+=100;
                    cell(cx, y, 58,  ROW_H, p.rubro || 'Otros gastos',  bg, '#475569', 'Helvetica', 6.5, 'left'); cx+=58;
                    cell(cx, y, 96,  ROW_H, p.descripcion || '',        bg, '#000', 'Helvetica', 6.5, 'left'); cx+=96;
                    cell(cx, y, 38,  ROW_H, tc.toFixed(2),              bg, '#64748b', 'Helvetica', 7, 'center'); cx+=38;
                    cell(cx, y, 52,  ROW_H, fmtMoney(imp * tc),         bg, '#000', 'Helvetica', 7, 'right');
                    y += ROW_H;
                };

                partidas.forEach((p, i) => dibujarFila(p, i));

                // ── FILA TOTAL ────────────────────────────────────────────────
                const totalComp = parseFloat(comp.total_comprobado || 0);
                cell(L,   y, 510, ROW_H, 'TOTAL COMPROBADO:', BG_DARK, '#fff', 'Helvetica-Bold', 8, 'right');
                cell(L+510, y, 52, ROW_H, fmtMoney(totalComp), '#dcfce7', '#16a34a', 'Helvetica-Bold', 8, 'right');
                y += ROW_H + 10;

                // ── RESUMEN POR RUBRO ─────────────────────────────────────────
                const RUBROS_PDF = ['Transporte','Alimentos','Hospedaje','Reparación','Otros gastos'];
                const totalPorRubro = {};
                RUBROS_PDF.forEach(r => {
                    totalPorRubro[r] = partidas.filter(p => p.rubro === r).reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);
                });

                doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text('Totales por rubro:', L, y);
                y += 10;
                const rW = Math.floor(W / RUBROS_PDF.length);
                cx = L;
                RUBROS_PDF.forEach(r => {
                    cell(cx, y, rW, 13, r, BG_DARK, '#fff', 'Helvetica-Bold', 6.5, 'center');
                    cx += rW;
                });
                y += 13;
                cx = L;
                RUBROS_PDF.forEach(r => {
                    const v = totalPorRubro[r];
                    cell(cx, y, rW, 13, fmtMoney(v), v > 0 ? BG_VERDE : '#fff', v > 0 ? AZUL : '#94a3b8', 'Helvetica-Bold', 7, 'center');
                    cx += rW;
                });
                y += 13;

                // Promedio por persona
                const numPersonas = Math.max(1, 1 + parseInt(comp.personas_adicionales || 0));
                const totalDias2  = Math.max(1, parseInt(comp.total_dias || sol.dias_comision || 1));
                y += 8;
                doc.font('Helvetica').fontSize(7).fillColor('#475569')
                   .text(`Promedio por persona: ${numPersonas} persona(s) — ${totalDias2} día(s)`, L, y);
                y += 10;

                // Solo mostrar rubros que tienen gasto real
                const rubrosConGasto = RUBROS_PDF.filter(r => totalPorRubro[r] > 0);

                ['Por evento','Por día'].forEach(etiq => {
                    const divisor = etiq === 'Por día' ? totalDias2 : 1;
                    if (rubrosConGasto.length === 0) return;
                    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#000').text(etiq + ':', L, y);
                    const partes = rubrosConGasto.map(r => `${r}: ${fmtMoney(totalPorRubro[r] / divisor)}`);
                    doc.font('Helvetica').text(partes.join('   '), L + 55, y, { width: W - 55 });
                    y += 12;
                });

                y += 10;
                doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#e2e8f0').stroke();
                y += 10;

                // ── NOTAS ─────────────────────────────────────────────────────
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text('NOTAS:', L, y);
                y += 10;
                const notaMsg = '*Describe notas adicionales. Este descuento a nómina. Tiene 3 días hábiles (del 01 - mayo - 2021) para egresar. Comprobante Contabilidad SAC-Gastos 2017 MX.13 TCM JAIRO';
                doc.rect(L, y, W, 28).stroke('#aaa');
                doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text(notaMsg, L + 3, y + 4, { width: W - 6 });
                y += 36;

                // Aviso pendiente
                if (Math.abs(pendiente) > 0) {
                    const avisoBg = pendiente > 0 ? '#fee2e2' : '#dcfce7';
                    const avisoTxt = pendiente > 0
                        ? `FALTANTE: ${fmtMoney(Math.abs(pendiente))} — Se descontará de nómina`
                        : `SOBRANTE: ${fmtMoney(Math.abs(pendiente))} — Debe reintegrarse a Tesorería`;
                    doc.rect(L, y, W, 16).fill(avisoBg);
                    doc.font('Helvetica-Bold').fontSize(9).fillColor(pendiente > 0 ? '#dc2626' : '#16a34a')
                       .text(avisoTxt, L, y + 4, { width: W, align: 'center' });
                    y += 24;
                }

                // ── FIRMAS ────────────────────────────────────────────────────
                y += 8;
                const wFirma = 170, gapF = 14;
                const xF1 = L, xF2 = L + wFirma + gapF, xF3 = L + (wFirma + gapF) * 2;

                // Intentar cargar firma del solicitante
                const cargarF = (ruta, x, yPos) => {
                    if (!ruta) return;
                    const paths2 = [path.join(__dirname, '../', ruta), path.join(__dirname, '../../', ruta)];
                    const found = paths2.find(p2 => fs.existsSync(p2));
                    if (found) { try { doc.image(found, x + 35, yPos, { width: 100, height: 28 }); } catch(e) {} }
                };

                cargarF(sol.solicitante_firma, xF1, y);
                cargarF(sol.revisor_firma, xF3, y);

                const yLine = y + 35;
                [xF1, xF3].forEach(x => doc.moveTo(x, yLine).lineTo(x + wFirma, yLine).stroke());

                const yNom = yLine + 4;
                doc.font('Helvetica').fontSize(7).fillColor(AZUL)
                   .text('ENTREGO (iniciales y firmas del responsable y personas adicionales)', xF1, yNom, { width: wFirma * 2 + gapF, align: 'center' })
                   .text('REVISO\n(Contabilidad)', xF3, yNom, { width: wFirma, align: 'center' });

                const yNom2 = yNom + 16;
                doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000')
                   .text((sol.solicitante_nombre || '').toUpperCase(), xF1, yNom2, { width: wFirma, align: 'center' })
                   .text(sol.solicitante_puesto || '', xF1, yNom2 + 10, { width: wFirma, align: 'center' });

                // Nombre y puesto del revisor de contabilidad
                if (sol.revisor_nombre) {
                    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000')
                       .text(sol.revisor_nombre.toUpperCase(), xF3, yNom2, { width: wFirma, align: 'center' })
                       .text(sol.revisor_puesto || 'Contabilidad', xF3, yNom2 + 10, { width: wFirma, align: 'center' });
                }

                doc.font('Helvetica').fontSize(7).fillColor('#475569')
                   .text('Firmas y fecha', xF1, yNom2 + 22, { width: W, align: 'center' });

                // Powered by
                doc.font('Helvetica').fontSize(6).fillColor('#94a3b8')
                   .text('Powered by: Sistema SAC-GTSR-GST', L, doc.page.height - 30, { align: 'right', width: W });

                doc.end();
            });
        });
    });
});

// ==============================================================================
// C. PDF DEL OFICIO DE COMISION
// ==============================================================================
router.get('/:id/pdf', verificarToken, (req, res) => {
    // Query principal: solo datos del solicitante (firmas de autorizadores vienen del historial)
    const query = `
        SELECT sv.*,
               p.nombre_razon_social  AS solicitante_nombre,
               e.puesto               AS solicitante_puesto,
               e.unidad_negocio       AS solicitante_unidad,
               e.empresa_maestra      AS solicitante_empresa,
               u.ruta_firma_png       AS solicitante_firma
        FROM solicitudes_viaticos sv
        LEFT JOIN usuarios u  ON sv.id_usuario = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p  ON e.id_persona = p.id
        WHERE sv.id = ?
    `;

    // Query historial: trae cada firma con nombre, puesto y ruta_firma_png
    const queryHistorial = `
        SELECT hfv.etapa_firma, hfv.accion,
               u.ruta_firma_png,
               COALESCE(p.nombre_razon_social, u.username) AS firmante_nombre,
               e.puesto AS firmante_puesto,
               e.empresa_maestra AS firmante_empresa
        FROM historial_firmas_viaticos hfv
        JOIN usuarios u ON hfv.id_usuario = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        WHERE hfv.id_solicitud = ? AND hfv.accion = 'APROBADO'
        ORDER BY hfv.fecha_firma ASC
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            console.error('[PDF Viático] Error BD:', err.message);
            return res.status(500).json({ success: false, message: 'Error al consultar la solicitud.' });
        }
        if (results.length === 0) return res.status(404).json({ success: false, message: 'No encontrado' });

        const sol = results[0];

        db.query(queryHistorial, [req.params.id], (errH, firmas) => {
            if (errH) firmas = [];

            // Mapear firmas por etapa para acceso fácil en el PDF
            const getFirma = (etiqueta) => firmas.find(f =>
                (f.etapa_firma || '').toUpperCase().includes(etiqueta.toUpperCase())
            ) || {};

            // DEBUG temporal — quitar después de confirmar
            console.log(`[PDF #${req.params.id}] Firmas del historial:`, firmas.map(f => ({
                etapa: f.etapa_firma, nombre: f.firmante_nombre, ruta: f.ruta_firma_png
            })));

            const firmaJefe     = getFirma('JEFE');
            const firmaDHO      = getFirma('D.H.O');
            const firmaTesorero = getFirma('TESOR');

            // Enriquecer sol con datos del historial para compatibilidad con el resto del código
            sol.jefe_nombre      = firmaJefe.firmante_nombre     || sol.jefe_inmediato || '';
            sol.jefe_puesto      = firmaJefe.firmante_puesto     || 'Jefe Inmediato';
            sol.jefe_empresa     = firmaJefe.firmante_empresa    || '';
            sol.jefe_firma       = firmaJefe.ruta_firma_png      || null;
            sol.dho_nombre       = firmaDHO.firmante_nombre      || '';
            sol.dho_puesto       = firmaDHO.firmante_puesto      || 'D.H.O / FINANZAS';
            sol.dho_empresa      = firmaDHO.firmante_empresa     || '';
            sol.dho_firma        = firmaDHO.ruta_firma_png       || null;
            sol.tesorero_nombre  = firmaTesorero.firmante_nombre || '';
            sol.tesorero_puesto  = firmaTesorero.firmante_puesto || 'Tesorería';
            sol.tesorero_empresa = firmaTesorero.firmante_empresa|| '';
            sol.tesorero_firma   = firmaTesorero.ruta_firma_png  || null;

            // Traer los gastos por día y armar el desgloseMap
            db.query('SELECT * FROM viaticos_desglose_dias WHERE id_solicitud = ?', [req.params.id], (errD, desgloseRows) => {
            
            // Helper timezone-safe: MySQL puede devolver Date objects o strings
            const toLocalISO = (val) => {
                if (!val) return '';
                if (typeof val === 'string') return val.split('T')[0];
                const d = new Date(val);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            };

            const desgloseMap = {};
            
            // Si hay resultados, armamos el mapa
            if (!errD && desgloseRows) {
                desgloseRows.forEach(row => {
                    const fecha = toLocalISO(row.fecha);
                    if (!desgloseMap[fecha]) desgloseMap[fecha] = {};
                    if (row.categoria) desgloseMap[fecha][row.categoria.toLowerCase()] = parseFloat(row.monto) || 0;
                    if (row.subcategoria) desgloseMap[fecha][row.subcategoria.toLowerCase()] = parseFloat(row.monto) || 0;
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
            doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO_AZUL)
               .text((sol.jefe_nombre || sol.jefe_inmediato || 'JEFE INMEDIATO').toUpperCase(), 30, y);
            y += 10;
            doc.font('Helvetica-Bold').fillColor('#000')
               .text(sol.jefe_puesto || 'Jefe Inmediato', 30, y);
            y += 10;
            doc.font('Helvetica-Oblique').fillColor(COLOR_TEXTO_AZUL).text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 30, y);
            y += 10;
            doc.text(sol.jefe_empresa || sol.solicitante_empresa || 'Opciones Sacimex SA de CV SOFOM ENR', 30, y);

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

            // Encabezado: solicitante a la izquierda, jefe a la derecha
            doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXTO_AZUL)
               .text(sol.solicitante_nombre?.toUpperCase() || '---', x2A, y, { width: wF2, align: 'center' })
               .text((sol.jefe_nombre || sol.jefe_inmediato || 'PENDIENTE').toUpperCase(), x2B, y, { width: wF2, align: 'center' });
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

            // ════════════════════════════════════════════════════════════════
            // TABULADOR "EXCLUSIVO FINANZAS" — igual al modal de la solicitud
            // ════════════════════════════════════════════════════════════════
            const colMain  = 110;  // columna de concepto
            const colTotal =  70;  // columna total
            const rowH     =  14;  // alto de fila normal
            const rowHHead =  22;  // alto del encabezado (2 líneas: día + número)
            let gy = y;

            // Fechas reales del viaje — se parsean como fecha local (no UTC)
            const fechasSol = [];
            {
                const [y1,m1,d1] = toLocalISO(sol.fecha_salida).split('-').map(Number);
                const [y2,m2,d2] = toLocalISO(sol.fecha_regreso).split('-').map(Number);
                const dIni2 = new Date(y1, m1-1, d1);
                const dFin2 = new Date(y2, m2-1, d2);
                for (let d = new Date(dIni2); d <= dFin2; d.setDate(d.getDate() + 1)) {
                    fechasSol.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
                }
            }
            const numDias   = Math.min(fechasSol.length, 10);
            const anchoUtil = 552 - colMain - colTotal;           // px disponibles para días
            const dw        = Math.floor(anchoUtil / numDias);    // ancho de cada columna día

            const diasSemanaLabels = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            const getMonto      = (cat) => fechasSol.reduce((s, f) => s + ((desgloseMap[f] || {})[cat] || 0), 0);
            const getMontoFecha = (f, cat) => (desgloseMap[f] || {})[cat] || 0;

            // ── Encabezado: "EXCLUSIVO FINANZAS" | Lun/17 … | TOTAL ──────────
            drawCell(30, gy, colMain, rowHHead, 'EXCLUSIVO FINANZAS', '#FFFF00', '#FF0000', 'Helvetica-Bold', 8, 'center');
            let rx = 30 + colMain;
            fechasSol.slice(0, numDias).forEach(f => {
                const d = new Date(f + 'T00:00:00');
                const diaLabel = diasSemanaLabels[d.getDay()];
                const numLabel = String(d.getDate());
                // Fondo alternado claro para facilitar lectura
                drawCell(rx, gy, dw, rowHHead, '', '#f1f5f9', null);
                // Día de semana (arriba)
                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7)
                   .text(diaLabel, rx, gy + 4, { width: dw, align: 'center' });
                // Número del día (abajo)
                doc.font('Helvetica').fontSize(8)
                   .text(numLabel, rx, gy + 13, { width: dw, align: 'center' });
                rx += dw;
            });
            drawCell(rx, gy, colTotal, rowHHead, 'TOTAL', '#1e293b', '#fff', 'Helvetica-Bold', 9, 'center');
            gy += rowHHead;

            // ── Helper: fila diaria (Hospedaje, Alimentos, etc.) ─────────────
            const drawFilaDiaria = (label, catKey, montoFallback = 0, bold = false) => {
                const font  = bold ? 'Helvetica-Bold' : 'Helvetica';
                const bgLbl = bold ? '#f8fafc' : null;
                drawCell(30, gy, colMain, rowH, label, bgLbl, '#000', font, 8, 'left');
                rx = 30 + colMain;
                let totalFila = 0;
                fechasSol.slice(0, numDias).forEach(f => {
                    const val = catKey ? getMontoFecha(f, catKey) : 0;
                    totalFila += val;
                    drawCell(rx, gy, dw, rowH,
                        val > 0 ? formatMoney(val) : '',
                        val > 0 ? BG_VERDE_CLARO : null,
                        '#000', 'Helvetica', 7, 'right');
                    rx += dw;
                });
                const total = totalFila > 0 ? totalFila : montoFallback;
                doc.lineWidth(bold ? 2 : 1);
                drawCell(rx, gy, colTotal, rowH,
                    total > 0 ? formatMoney(total) : '-',
                    bold ? '#f0fdf4' : null,
                    bold ? '#15803d' : '#000', font, 8, 'right');
                doc.lineWidth(1);
                gy += rowH;
                return total;
            };

            // ── Helper: fila de pago único (Transporte) ───────────────────────
            // El monto va solo en la primera columna (primer día del viaje),
            // el resto de columnas vacías, y el total al final.
            const drawFilaUnica = (label, catKey, montoFallback = 0) => {
                drawCell(30, gy, colMain, rowH, label, null, '#000', 'Helvetica', 8, 'left');
                rx = 30 + colMain;
                const total = getMonto(catKey) || montoFallback;
                fechasSol.slice(0, numDias).forEach((_, idx) => {
                    const val = (idx === 0 && total > 0) ? total : 0;
                    drawCell(rx, gy, dw, rowH,
                        val > 0 ? formatMoney(val) : '',
                        val > 0 ? BG_VERDE_CLARO : null,
                        '#000', 'Helvetica', 7, 'right');
                    rx += dw;
                });
                drawCell(rx, gy, colTotal, rowH,
                    total > 0 ? formatMoney(total) : '-',
                    null, '#000', 'Helvetica', 8, 'right');
                gy += rowH;
                return total;
            };

            // ── Filas ─────────────────────────────────────────────────────────
            const tHosp  = drawFilaDiaria('Hospedaje',  'hospedaje',  sol.monto_hospedaje || 0, true);
            const tAlim  = drawFilaDiaria('Alimentos',  'almuerzo',   sol.monto_alimentos || 0, true);
            const tUrban = drawFilaDiaria('Urban',       'urban',      0);
            const tBus   = drawFilaUnica ('Bus/Taxi',    'bus',        0);
            const tPeaje = drawFilaDiaria('Peaje',       'peaje',      sol.monto_otros     || 0);
            const tGas   = drawFilaDiaria('Gasolina',    'gasolina',   sol.monto_gasolina  || 0);

            // ── Fila TOTAL ─────────────────────────────────────────────────────
            doc.lineWidth(2);
            drawCell(30, gy, colMain, rowH + 4, 'TOTAL', '#1e293b', '#fff', 'Helvetica-Bold', 9, 'center');
            rx = 30 + colMain;
            fechasSol.slice(0, numDias).forEach((f, idx) => {
                // Transporte va solo en día 0
                const totalDia = ['hospedaje','almuerzo','urban','bus','peaje','gasolina']
                    .reduce((s, cat) => s + getMontoFecha(f, cat), 0);

                drawCell(rx, gy, dw, rowH + 4,
                    totalDia > 0 ? formatMoney(totalDia) : '',
                    '#dcfce7', '#15803d', 'Helvetica-Bold', 7, 'right');
                rx += dw;
            });
            const gran = sol.total_solicitado || (tHosp + tAlim + tUrban + tBus + tPeaje + tGas);
            drawCell(rx, gy, colTotal, rowH + 4, formatMoney(gran), '#dcfce7', '#15803d', 'Helvetica-Bold', 9, 'right');
            doc.lineWidth(1);
            gy += rowH + 10;

            // ── FIRMAS INFERIORES: D.H.O. | Tesorería | Recibió ──────────────
            const wF3 = 165, gapF3 = 13;
            const totalW3 = wF3*3 + gapF3*2;
            const xF3A = (doc.page.width - totalW3) / 2;
            const xF3B = xF3A + wF3 + gapF3;
            const xF3C = xF3B + wF3 + gapF3;

            doc.font('Helvetica').fontSize(9).fillColor('#000')
               .text('Otorgó (D.H.O.)', xF3A, gy, { width: wF3, align: 'center' })
               .text('Quien Paga (Tesorería)', xF3B, gy, { width: wF3, align: 'center' })
               .text('Recibió', xF3C, gy, { width: wF3, align: 'center' });

            cargarFirmaViatic(sol.dho_firma, xF3A + 32, gy + 12, 100, 28);

            if (['PAGADO','RECIBIDO','COMPROBADO'].includes(sol.estatus)) {
                cargarFirmaViatic(sol.tesorero_firma, xF3B + 32, gy + 12, 100, 28);
            }
            if (['RECIBIDO','COMPROBADO'].includes(sol.estatus)) {
                cargarFirmaViatic(sol.solicitante_firma, xF3C + 32, gy + 12, 100, 28);
            }

            const yLineaFirma = gy + 50;
            [xF3A, xF3B, xF3C].forEach(x => doc.moveTo(x, yLineaFirma).lineTo(x + wF3, yLineaFirma).stroke());

            const yTexto = yLineaFirma + 5;
            const textoRecibio  = ['RECIBIDO','COMPROBADO'].includes(sol.estatus)
                ? (sol.solicitante_nombre?.toUpperCase() || '') : 'PENDIENTE DE RECEPCIÓN';
            const textoTesorero = ['PAGADO','RECIBIDO','COMPROBADO'].includes(sol.estatus)
                ? (sol.tesorero_nombre?.toUpperCase() || '---') : 'PENDIENTE TESORERÍA';

            // Nombre
            doc.font('Helvetica').fontSize(7).fillColor(COLOR_TEXTO_AZUL)
               .text(sol.dho_nombre?.toUpperCase() || 'PENDIENTE D.H.O.', xF3A, yTexto, { width: wF3, align: 'center' })
               .text(textoTesorero, xF3B, yTexto, { width: wF3, align: 'center' })
               .text(textoRecibio,  xF3C, yTexto, { width: wF3, align: 'center' });

            // Puesto
            const yPuesto = yTexto + 11;
            doc.font('Helvetica-BoldOblique').fillColor('#000').fontSize(7)
               .text(sol.dho_puesto || 'D.H.O / FINANZAS', xF3A, yPuesto, { width: wF3, align: 'center' })
               .text(sol.tesorero_puesto || 'Tesorería',    xF3B, yPuesto, { width: wF3, align: 'center' })
               .text(sol.solicitante_puesto || '',           xF3C, yPuesto, { width: wF3, align: 'center' });

            // Empresa
            const yEmpresa = yPuesto + 11;
            doc.font('Helvetica').fontSize(7)
               .text(sol.dho_empresa || 'Opciones Sacimex SA de CV SOFOM ENR',      xF3A, yEmpresa, { width: wF3, align: 'center' })
               .text(sol.tesorero_empresa || 'Opciones Sacimex SA de CV SOFOM ENR', xF3B, yEmpresa, { width: wF3, align: 'center' })
               .text(sol.solicitante_empresa || '',                                  xF3C, yEmpresa, { width: wF3, align: 'center' });

            doc.end();
        }); // cierre desglose_dias
        }); // cierre historial_firmas
    }); // cierre query principal
});

module.exports = router;