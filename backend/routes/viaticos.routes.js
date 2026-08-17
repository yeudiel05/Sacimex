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
    db.query('SELECT * FROM solicitudes_viaticos WHERE id_usuario = ? ORDER BY fecha_solicitud DESC', [req.usuario.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
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
            if (!['AUTORIZADO_DHO', 'PAGADO', 'RECIBIDO', 'COMPROBADO'].includes(rows[0].estatus)) {
                return res.status(400).json({ success: false, message: 'Solo puedes guardar comprobación en solicitudes autorizadas o con pago en proceso.' });
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