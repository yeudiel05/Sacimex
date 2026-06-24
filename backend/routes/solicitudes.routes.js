const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer'); 

// =====================================================================
// CONFIGURACION DE NODEMAILER
// =====================================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
        user: 'ordazruudvan@gmail.com', 
        pass: 'ejci wnas ugjg yans' 
    }
});

const enviarCorreo = async (destinatario, asunto, mensajeHTML) => {
    if (!destinatario) return; 
    try {
        await transporter.sendMail({
            from: '"Sistema de Recursos" <ordazruudvan@gmail.com>',
            to: destinatario,
            subject: asunto,
            html: mensajeHTML
        });
        console.log(`Correo enviado a: ${destinatario}`);
    } catch (error) {
        console.error('Error al enviar correo:', error);
    }
};

const getEmailByRol = (rolBuscado) => {
    return new Promise((resolve) => {
        const query = `
            SELECT p.email_contacto 
            FROM usuarios u 
            LEFT JOIN empleados e ON u.id_empleado = e.id_persona 
            LEFT JOIN personas p ON e.id_persona = p.id 
            WHERE u.rol = ? AND u.estatus_activo = 1 LIMIT 1
        `;
        db.query(query, [rolBuscado], (err, results) => {
            if (!err && results.length > 0) resolve(results[0].email_contacto);
            else resolve(null);
        });
    });
};

// =====================================================================
// FUNCIONES AUXILIARES E INTELIGENCIA DE DEPARTAMENTOS
// =====================================================================
const cleanStr = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

// Limpiador Inteligente: Extrae la raíz del departamento para evitar fallos por acentos o conectores
const getCoreDepto = (str) => {
    if (!str) return 'OTRO';
    const d = cleanStr(str);
    if (d.includes('TI') || d.includes('SISTEMA') || d.includes('TECNOLOGIA')) return 'TI';
    if (d.includes('DHO') || d.includes('HUMANO') || d.includes('CAPITAL')) return 'DHO';
    if (d.includes('GERENCIA') || d.includes('DIRECCION')) return 'GERENCIA';
    return d;
};

// Modificado para usar la inteligencia de búsqueda
const getEmailByDepto = (deptoBuscado) => {
    return new Promise((resolve) => {
        const query = `
            SELECT p.email_contacto, e.departamento 
            FROM usuarios u 
            LEFT JOIN empleados e ON u.id_empleado = e.id_persona 
            LEFT JOIN personas p ON e.id_persona = p.id 
            WHERE u.estatus_activo = 1
        `;
        db.query(query, (err, results) => {
            if (!err && results.length > 0) {
                const targetCore = getCoreDepto(deptoBuscado);
                const match = results.find(r => getCoreDepto(r.departamento) === targetCore && r.email_contacto);
                resolve(match ? match.email_contacto : null);
            } else {
                resolve(null);
            }
        });
    });
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
        const id = req.params.id || 'nueva';
        cb(null, `solicitud-${id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

function numeroALetras(num) {
    const unidades = ['','UN ','DOS ','TRES ','CUATRO ','CINCO ','SEIS ','SIETE ','OCHO ','NUEVE '];
    const decenas  = ['DIEZ ','ONCE ','DOCE ','TRECE ','CATORCE ','QUINCE ','DIECISEIS ','DIECISIETE ','DIECIOCHO ','DIECINUEVE ','VEINTE ','TREINTA ','CUARENTA ','CINCUENTA ','SESENTA ','SETENTA ','OCHENTA ','NOVENTA '];
    const centenas = ['','CIENTO ','DOSCIENTOS ','TRESCIENTOS ','CUATROCIENTOS ','QUINIENTOS ','SEISCIENTOS ','SETECIENTOS ','OCHOCIENTOS ','NOVECIENTOS '];

    let entero = Math.floor(num);
    let centavos = Math.round((num - entero) * 100);
    if(entero === 0) return 'CERO PESOS ' + centavos.toString().padStart(2, '0') + '/100 M.N.';

    function convertirGrupo(n) {
        let output = '';
        if (n === 100) return 'CIEN ';
        output += centenas[Math.floor(n / 100)];
        n = n % 100;
        if (n < 10) output += unidades[n];
        else if (n < 20) output += decenas[n - 10];
        else if (n === 20) output += 'VEINTE ';
        else if (n < 30) output += 'VEINTI' + unidades[n - 20];
        else {
            output += decenas[Math.floor(n / 10) + 8];
            if (n % 10 !== 0) output += 'Y ' + unidades[n % 10];
        }
        return output;
    }

    let letras = '';
    if (entero >= 1000000) {
        let millones = Math.floor(entero / 1000000);
        letras += (millones === 1 ? 'UN MILLON ' : convertirGrupo(millones) + 'MILLONES ');
        entero = entero % 1000000;
    }
    if (entero >= 1000) {
        let miles = Math.floor(entero / 1000);
        letras += (miles === 1 ? 'MIL ' : convertirGrupo(miles) + 'MIL ');
        entero = entero % 1000;
    }
    if (entero > 0) letras += convertirGrupo(entero);
    
    return letras.trim() + ' PESOS ' + centavos.toString().padStart(2, '0') + '/100 M.N.';
}

function calcularNivelesRequeridos(monto) {
    const m = parseFloat(monto) || 0;
    if (m <= 30000) return 2;  
    return 3;                  
}

function formatMoney(n) {
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =====================================================================
// RUTAS PRINCIPALES DE SOLICITUDES
// =====================================================================

router.get('/', verificarToken, (req, res) => {
    const miRol = req.usuario.rol;
    const miId  = req.usuario.id;

    db.query('SELECT e.departamento AS depto_emp FROM usuarios u LEFT JOIN empleados e ON u.id_empleado = e.id_persona WHERE u.id = ?', [miId], (errD, rowsD) => {
        if (errD) return res.status(500).json({ success: false, message: 'Error interno' });

        const miDeptoRaw = (rowsD && rowsD.length > 0) ? (rowsD[0].depto_emp || '') : '';
        const miDeptoCore = getCoreDepto(miDeptoRaw);

        let query = `
            SELECT 
                s.id, s.folio, s.concepto_id, s.unidad_negocio, s.monto, 
                s.estatus, s.nivel_actual, s.niveles_requeridos,
                s.fecha_solicitud, s.comprobante_pago_path,
                p.nombre_razon_social AS solicitante_nombre
            FROM solicitudes_recursos s
            LEFT JOIN usuarios u ON s.solicitante_id = u.id
            LEFT JOIN empleados e ON u.id_empleado = e.id_persona
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN conceptos_pago cp ON (
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR 
                s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR 
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
            )
        `;

        if (!['ADMIN', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA'].includes(miRol)) {
            if (miDeptoCore === 'TI') {
                query += ` WHERE s.solicitante_id = ${db.escape(miId)} OR cp.area_visto_bueno LIKE '%TI%' OR cp.area_visto_bueno LIKE '%SISTEMA%'`;
            } else if (miDeptoCore === 'DHO') {
                query += ` WHERE s.solicitante_id = ${db.escape(miId)} OR cp.area_visto_bueno LIKE '%DHO%' OR cp.area_visto_bueno LIKE '%HUMANO%'`;
            } else if (miDeptoRaw !== '') {
                query += ` WHERE s.solicitante_id = ${db.escape(miId)} OR cp.area_visto_bueno = ${db.escape(miDeptoRaw)}`;
            } else {
                query += ` WHERE s.solicitante_id = ${db.escape(miId)}`;
            }
        }
        query += ' ORDER BY s.fecha_solicitud DESC';

        db.query(query, (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: results });
        });
    });
});

router.get('/pendientes', verificarToken, (req, res) => {
    const miRol = req.usuario.rol;
    const miId = req.usuario.id;
    
    db.query('SELECT e.departamento AS depto_emp FROM usuarios u LEFT JOIN empleados e ON u.id_empleado = e.id_persona WHERE u.id = ?', [miId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Error interno al verificar permisos de departamento' });
        
        const miDeptoCore = getCoreDepto((rows && rows.length > 0) ? rows[0].depto_emp : '');
        const rolANivel = { 'REVISOR': 0, 'AUTORIZADOR_1': 1, 'AUTORIZADOR_2': 2 };
        const nivelRol = rolANivel[miRol];

        let query = `
            SELECT s.id, s.folio, s.concepto_id, s.unidad_negocio, s.monto,
                   s.estatus, s.nivel_actual, s.niveles_requeridos, s.fecha_solicitud,
                   s.solicitante_id,
                   p.nombre_razon_social AS solicitante_nombre,
                   cp.area_visto_bueno
            FROM solicitudes_recursos s
            LEFT JOIN usuarios u ON s.solicitante_id = u.id
            LEFT JOIN empleados e ON u.id_empleado = e.id_persona
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN conceptos_pago cp ON (
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR 
                s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR 
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
            )
            WHERE s.estatus NOT IN ('PAGADO', 'RECHAZADO')
            ORDER BY s.fecha_solicitud ASC
        `;

        db.query(query, (err2, results) => {
            if (err2) return res.status(500).json({ success: false, message: err2.message });
            
            const filtradas = [];

            results.forEach(sol => {
                const areaReqCore = getCoreDepto(sol.area_visto_bueno);
                let me_toca_firmar = false;
                let visible = false;

                if (miRol === 'ADMIN') {
                    me_toca_firmar = true;
                    visible = true;
                } else {
                    if (miRol === 'TESORERIA' && sol.estatus === 'AUTORIZADO_FINAL') {
                        visible = true; me_toca_firmar = true;
                    } else if (sol.estatus === 'AUTORIZADO_FINAL' && sol.solicitante_id !== miId && miRol !== 'TESORERIA') {
                        visible = false;
                    } else {
                        if (sol.solicitante_id === miId) visible = true;
                        
                        if (sol.nivel_actual === nivelRol) {
                            visible = true; me_toca_firmar = true;
                        }
                        
                        // Magia: El backend decide si es tu departamento
                        if (sol.nivel_actual === -1 && miDeptoCore === areaReqCore && miDeptoCore !== 'OTRO') {
                            visible = true; me_toca_firmar = true;
                        }
                    }
                }

                if (visible) {
                    sol.me_toca_firmar = me_toca_firmar; // <--- ESTO SALVA AL FRONTEND
                    filtradas.push(sol);
                }
            });

            res.json({ success: true, data: filtradas });
        });
    });
});

router.get('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const miId = req.usuario.id;
    const miRol = req.usuario.rol;

    db.query('SELECT e.departamento AS depto_emp FROM usuarios u LEFT JOIN empleados e ON u.id_empleado = e.id_persona WHERE u.id = ?', [miId], (errDep, resDep) => {
        if (errDep) return res.status(500).json({ success: false, message: 'Error interno al verificar departamento' });
        
        const miDeptoCore = getCoreDepto((resDep && resDep.length > 0) ? resDep[0].depto_emp : '');

        const querySolicitud = `
            SELECT s.*, 
                   p.nombre_razon_social AS solicitante_nombre,
                   pprov.nombre_razon_social AS proveedor_nombre, 
                   pprov.rfc AS proveedor_rfc,
                   pprov.email_contacto AS proveedor_correo,
                   prov.banco AS proveedor_banco, 
                   prov.numero_cuenta AS proveedor_cuenta, 
                   prov.numero_cuenta AS proveedor_clabe,
                   cp.descripcion AS concepto_desc, 
                   cp.clave AS concepto_clave,
                   cp.requiere_vobo, cp.area_visto_bueno
            FROM solicitudes_recursos s
            LEFT JOIN usuarios u ON s.solicitante_id = u.id
            LEFT JOIN empleados e ON u.id_empleado = e.id_persona
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
            LEFT JOIN personas pprov ON prov.id_persona = pprov.id
            LEFT JOIN conceptos_pago cp ON (
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR 
                s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR 
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
            )
            WHERE s.id = ?
        `;
        
        const queryFirmas = `
            SELECT b.comentarios as comentario, b.fecha_firma, b.accion, b.etapa_firma,
                   p.nombre_razon_social AS aprobador, e.puesto AS aprobador_puesto
            FROM historial_firmas_pago b 
            LEFT JOIN usuarios u ON b.id_usuario = u.id 
            LEFT JOIN empleados e ON u.id_empleado = e.id_persona
            LEFT JOIN personas p ON e.id_persona = p.id
            WHERE b.id_solicitud = ?
            ORDER BY b.fecha_firma ASC
        `;
        
        db.query(querySolicitud, [id], (errSol, resSol) => {
            if (errSol) return res.status(500).json({ success: false, message: errSol.message });
            if (resSol.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
            
            const sol = resSol[0];
            const areaReqCore = getCoreDepto(sol.area_visto_bueno);
            let me_toca_firmar = false;

            if (!['PAGADO', 'RECHAZADO', 'AUTORIZADO_FINAL'].includes(sol.estatus)) {
                if (miRol === 'ADMIN') {
                    me_toca_firmar = true;
                } else {
                    if (sol.nivel_actual === -1 && miDeptoCore === areaReqCore && miDeptoCore !== 'OTRO') me_toca_firmar = true;
                    if (sol.nivel_actual === 0 && miRol === 'REVISOR') me_toca_firmar = true;
                    if (sol.nivel_actual === 1 && miRol === 'AUTORIZADOR_1') me_toca_firmar = true;
                    if (sol.nivel_actual === 2 && miRol === 'AUTORIZADOR_2') me_toca_firmar = true;
                }
            }
            sol.me_toca_firmar = me_toca_firmar;
            
            db.query(queryFirmas, [id], (err2, resFirmas) => {
                if (err2) return res.status(500).json({ success: false, message: err2.message });
                res.json({ success: true, solicitud: sol, firmas: resFirmas });
            });
        });
    });
});

router.post('/crear', verificarToken, upload.single('cotizacion'), (req, res) => {
    try {
        const { concepto_id, monto, descripcion, id_proveedor, forma_pago, fecha_limite_pago, unidad_negocio } = req.body;
        
        const solicitante_id = req.usuario.id;
        const miRol = req.usuario.rol;
        const montoNum = parseFloat(monto) || 0;
        const niveles = calcularNivelesRequeridos(montoNum);

        const anio = new Date().getFullYear();
        const folioBase = `SAC-TSR-RCS-${anio}`;

        const idProvFinal = (id_proveedor === '' || id_proveedor === null || id_proveedor === 'null') ? null : id_proveedor;
        const fechaLimiteFinal = (fecha_limite_pago === '' || fecha_limite_pago === null || fecha_limite_pago === 'null') ? null : fecha_limite_pago;

        // MAGIA: Capturamos el archivo de cotización si el usuario lo subió
        const cotizacionPath = req.file ? `uploads/${req.file.filename}` : null;

        db.query(`
            SELECT e.unidad_negocio 
            FROM usuarios u 
            JOIN empleados e ON u.id_empleado = e.id_persona 
            WHERE u.id = ?
        `, [solicitante_id], (errUsuario, rowsUsuario) => {
            if (errUsuario || rowsUsuario.length === 0) {
                return res.status(500).json({ success: false, message: 'No se pudo verificar tu unidad de negocio.' });
            }

            const unidadRealDelEmpleado = rowsUsuario[0].unidad_negocio;
            let unidad_negocio_final = unidad_negocio;
            
            if (miRol !== 'ADMIN') {
                unidad_negocio_final = unidadRealDelEmpleado || '01.CRP - Corporativo'; 
            }

            // MAGIA: Agregamos cotizacion_path al INSERT
            const query = `
                INSERT INTO solicitudes_recursos 
                (solicitante_id, concepto_id, descripcion, monto, unidad_negocio, 
                 id_proveedor, forma_pago, estatus, nivel_actual, niveles_requeridos, fecha_limite_pago, cotizacion_path) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 0, ?, ?, ?)
            `;

            db.query(query, [
                solicitante_id, concepto_id, descripcion, montoNum,
                unidad_negocio_final, idProvFinal, forma_pago || 'TRANSFERENCIA', niveles, fechaLimiteFinal, cotizacionPath
            ], async (err, result) => {
                if (err) {
                    console.error("Error BD en Crear Solicitud:", err);
                    return res.status(500).json({ success: false, message: err.sqlMessage || err.message });
                }
                
                const solicitudId = result.insertId;
                const folio = `${folioBase}-${String(solicitudId).padStart(5, '0')}`;
                
                db.query('UPDATE solicitudes_recursos SET folio = ? WHERE id = ?', [folio, solicitudId], async () => {
                    res.json({ success: true, id: solicitudId, folio, message: 'Solicitud registrada correctamente' });
                    
                    // =====================================================
                    // CORREO 1: AVISAR AL REVISOR QUE HAY UNA NUEVA SOLICITUD
                    // =====================================================
                    const emailRevisor = await getEmailByRol('REVISOR');
                    if (emailRevisor) {
                        const mensaje = `
                            <h3 style="color: #0f172a;">Nueva Solicitud por Validar</h3>
                            <p>Se ha generado una nueva solicitud de recursos en el sistema y está pendiente de tu validación (Revisor).</p>
                            <ul>
                                <li><strong>Folio:</strong> ${folio}</li>
                                <li><strong>Monto:</strong> ${formatMoney(montoNum)}</li>
                                <li><strong>Unidad:</strong> ${unidad_negocio_final}</li>
                            </ul>
                            <p>Por favor, ingresa al sistema para revisarla.</p>
                        `;
                        enviarCorreo(emailRevisor, `Nueva Solicitud Recibida: ${folio}`, mensaje);
                    }
                });
            });
        });

    } catch (catastrofe) {
        console.error("Error catastrófico en Crear Solicitud:", catastrofe);
        res.status(500).json({ success: false, message: String(catastrofe) });
    }
});

router.post('/autorizar/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { comentario } = req.body;
    const miRol = req.usuario.rol;
    const miUsuarioId = req.usuario.id;

    db.query(`
        SELECT s.folio, s.monto, s.nivel_actual, s.estatus, s.niveles_requeridos, cp.area_visto_bueno 
        FROM solicitudes_recursos s 
        LEFT JOIN conceptos_pago cp ON (
            s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR 
            s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR 
            s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
        )
        WHERE s.id = ?
    `, [id], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ success: false, message: "No encontrada" });
        const sol = rows[0];

        if (['PAGADO', 'RECHAZADO'].includes(sol.estatus)) return res.status(400).json({ success: false, message: "Ya procesada" });

        db.query('SELECT e.departamento AS depto_emp FROM usuarios u LEFT JOIN empleados e ON u.id_empleado = e.id_persona WHERE u.id = ?', [miUsuarioId], (errD, rowsD) => {
            if (errD) return res.status(500).json({ success: false, message: 'Error interno al verificar departamento' });

            const miDeptoCore = getCoreDepto((rowsD && rowsD.length > 0) ? rowsD[0].depto_emp : '');
            const areaReqCore = getCoreDepto(sol.area_visto_bueno);
            
            let puede = false;
            let etapaFirma = '';

            if (sol.nivel_actual === -1 && (miRol === 'ADMIN' || (miDeptoCore === areaReqCore && miDeptoCore !== 'OTRO'))) { 
                puede = true; etapaFirma = 'VISTO BUENO'; 
            } else if (sol.nivel_actual === 0 && (miRol === 'REVISOR' || miRol === 'ADMIN')) { 
                puede = true; etapaFirma = 'REVISOR'; 
            } else if (sol.nivel_actual === 1 && (miRol === 'AUTORIZADOR_1' || miRol === 'ADMIN')) { 
                puede = true; etapaFirma = 'AUTORIZADOR_1'; 
            } else if (sol.nivel_actual === 2 && (miRol === 'AUTORIZADOR_2' || miRol === 'ADMIN')) { 
                puede = true; etapaFirma = 'AUTORIZADOR_2'; 
            }

            if (!puede) return res.status(403).json({ success: false, message: `No tienes permisos en el nivel actual` });

            const nuevoNivel = sol.nivel_actual + 1;
            let nuevoEstatus;
            let rolNotificar = '';

            if (sol.nivel_actual === -1) {
                nuevoEstatus = 'PENDIENTE';
                rolNotificar = 'REVISOR';
            } else if (nuevoNivel >= sol.niveles_requeridos) {
                nuevoEstatus = 'AUTORIZADO_FINAL';
                rolNotificar = 'TESORERIA';
            } else {
                nuevoEstatus = `AUTORIZADO_${nuevoNivel}`;
                rolNotificar = nuevoNivel === 1 ? 'AUTORIZADOR_1' : 'AUTORIZADOR_2';
            }

            db.beginTransaction(err3 => {
                if (err3) return res.status(500).json({ success: false });

                const queryFirma = `
                    INSERT INTO historial_firmas_pago 
                    (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios)
                    VALUES (?, ?, ?, 'FIRMADO', 'APROBADO', ?)
                `;
                db.query(queryFirma, [id, miUsuarioId, etapaFirma, comentario || 'Aprobado'], (err4) => {
                    if (err4) return db.rollback(() => res.status(500).json({ success: false }));
                    db.query('UPDATE solicitudes_recursos SET estatus = ?, nivel_actual = ? WHERE id = ?', [nuevoEstatus, nuevoNivel, id], (err5) => {
                        if (err5) return db.rollback(() => res.status(500).json({ success: false }));
                        db.commit(async err6 => {
                            if (err6) return db.rollback(() => res.status(500).json({ success: false }));
                            registrarBitacora(miUsuarioId, 'AUTORIZAR', `Firma etapa ${etapaFirma} en sol #${id}`);
                            res.json({ success: true, nuevo_estatus: nuevoEstatus, message: 'Autorizado correctamente' });

                            if (rolNotificar) {
                                const emailSiguiente = await getEmailByRol(rolNotificar);
                                if (emailSiguiente) {
                                    const isTeso = rolNotificar === 'TESORERIA';
                                    const titulo = isTeso ? 'Solicitud Lista para Pago' : 'Autorizacion Requerida';
                                    const cuerpo = isTeso ? 'Una solicitud completo su autorizacion y esta lista para pago.' : 'Una solicitud avanzo y requiere tu firma.';
                                    enviarCorreo(emailSiguiente, `${titulo} - Folio ${sol.folio}`, `<h3>${titulo}</h3><p>${cuerpo}</p>`);
                                }
                            }
                        });
                    });
                });
            });
        });
    });
});

router.post('/rechazar/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;
    const miRol = req.usuario.rol;

    db.query(`
        SELECT s.monto, s.nivel_actual, cp.area_visto_bueno 
        FROM solicitudes_recursos s 
        LEFT JOIN conceptos_pago cp ON (
            s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR 
            s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR 
            s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
        )
        WHERE s.id = ?
    `, [id], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ success: false });
        const sol = rows[0];

        db.query('SELECT e.departamento AS depto_emp FROM usuarios u LEFT JOIN empleados e ON u.id_empleado = e.id_persona WHERE u.id = ?', [req.usuario.id], (errD, rowsD) => {
            if (errD) return res.status(500).json({ success: false, message: 'Error interno al verificar departamento' });
            
            const miDeptoCore = getCoreDepto((rowsD && rowsD.length > 0) ? rowsD[0].depto_emp : '');
            const areaReqCore = getCoreDepto(sol.area_visto_bueno);
            
            let puede = false;
            let etapaFirma = '';

            if (sol.nivel_actual === -1 && (miRol === 'ADMIN' || (miDeptoCore === areaReqCore && miDeptoCore !== 'OTRO'))) { puede = true; etapaFirma = 'VISTO BUENO'; }
            if (sol.nivel_actual === 0 && (miRol === 'REVISOR' || miRol === 'ADMIN')) { puede = true; etapaFirma = 'REVISOR'; }
            if (sol.nivel_actual === 1 && (miRol === 'AUTORIZADOR_1' || miRol === 'ADMIN')) { puede = true; etapaFirma = 'AUTORIZADOR_1'; }
            if (sol.nivel_actual === 2 && (miRol === 'AUTORIZADOR_2' || miRol === 'ADMIN')) { puede = true; etapaFirma = 'AUTORIZADOR_2'; }

            if (!puede && miRol !== 'ADMIN') return res.status(403).json({ success: false });

            db.query(`INSERT INTO historial_firmas_pago (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios) VALUES (?, ?, ?, 'RECHAZADO', 'RECHAZADO', ?)`, 
            [id, req.usuario.id, etapaFirma || 'REVISOR', motivo || 'Rechazado'], () => {
                db.query('UPDATE solicitudes_recursos SET estatus = "RECHAZADO" WHERE id = ?', [id], () => {
                    res.json({ success: true, message: 'Solicitud rechazada' });
                });
            });
        });
    });
});

router.post('/comprobante/:id', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id } = req.params;
    const miUsuarioId = req.usuario.id;

    if (!req.file) return res.status(400).json({ success: false });

    const ruta = `uploads/${req.file.filename}`;
    db.query('UPDATE solicitudes_recursos SET comprobante_pago_path = ?, estatus = "PAGADO", fecha_pago = NOW() WHERE id = ?', [ruta, id], () => {
        const queryFirma = `
            INSERT INTO historial_firmas_pago 
            (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios)
            VALUES (?, ?, 'PAGADO', 'FIRMADO', 'APROBADO', 'Comprobante de pago subido')
        `;
        db.query(queryFirma, [id, miUsuarioId], () => {
            registrarBitacora(miUsuarioId, 'SUBIR_COMPROBANTE', `Comprobante de pago subido para solicitud #${id}`);
            res.json({ success: true, message: 'Pago registrado' });

            const querySol = `
                SELECT s.folio, s.monto, p.email_contacto 
                FROM solicitudes_recursos s
                LEFT JOIN usuarios u ON s.solicitante_id = u.id
                LEFT JOIN empleados e ON u.id_empleado = e.id_persona
                LEFT JOIN personas p ON e.id_persona = p.id
                WHERE s.id = ? LIMIT 1
            `;
            db.query(querySol, [id], (err, rows) => {
                if (!err && rows.length > 0 && rows[0].email_contacto) {
                    const solData = rows[0];
                    enviarCorreo(solData.email_contacto, `Tu Solicitud ha sido Pagada: ${solData.folio}`, `<h3>Solicitud Liquidada</h3><p>Tu solicitud por ${formatMoney(solData.monto)} ha sido pagada.</p>`);
                }
            });
        });
    });
});

// =====================================================================
// GENERADOR PDF
// =====================================================================
router.get('/:id/pdf', verificarToken, (req, res) => {
    const { id } = req.params;

    const querySolicitud = `
        SELECT s.*, s.folio, 
               p.nombre_razon_social AS solicitante_nombre,
               e.puesto AS solicitante_puesto, 
               e.unidad_negocio AS solicitante_unidad,
               u.ruta_firma_png AS solicitante_firma,
               pprov.nombre_razon_social AS proveedor_nombre, 
               pprov.rfc AS proveedor_rfc,
               pprov.email_contacto AS proveedor_correo,
               prov.banco AS proveedor_banco, 
               prov.numero_cuenta AS proveedor_cuenta, 
               prov.numero_cuenta AS proveedor_clabe,
               cp.descripcion AS concepto_desc, 
               cp.clave AS concepto_clave, cp.requiere_vobo, cp.area_visto_bueno
        FROM solicitudes_recursos s
        LEFT JOIN usuarios u ON s.solicitante_id = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
        LEFT JOIN personas pprov ON prov.id_persona = pprov.id
        LEFT JOIN conceptos_pago cp ON (
            s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR 
            s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR 
            s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
        )
        WHERE s.id = ?
    `;

    const queryFirmas = `
        SELECT hf.etapa_firma, hf.fecha_firma, hf.accion,
               p.nombre_razon_social AS aprobador, e.puesto AS aprobador_puesto, u.ruta_firma_png
        FROM historial_firmas_pago hf
        LEFT JOIN usuarios u ON hf.id_usuario = u.id
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        WHERE hf.id_solicitud = ?
        ORDER BY hf.fecha_firma ASC
    `;

    db.query(querySolicitud, [id], (err, solRows) => {
        if (err) {
            console.error(`[GET /solicitudes/${id}/pdf] Error querySolicitud:`, err);
            return res.status(500).json({ success: false, message: 'Error interno en BD al generar PDF' });
        }
        if (solRows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        
        db.query(queryFirmas, [id], (err2, firmas) => {
            if (err2) {
                console.error(`[GET /solicitudes/${id}/pdf] Error queryFirmas:`, err2);
                return res.status(500).json({ success: false });
            }
            generarPDFSolicitud(res, solRows[0], firmas || []);
        });
    });
});

function generarPDFSolicitud(res, sol, firmas) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 30, layout: 'portrait' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${sol.folio || sol.id}.pdf`);
    doc.pipe(res);

    const C_VERDE_TITULO = '#00B050';
    const C_AMARILLO     = '#FFFF00';
    const C_AZUL         = '#0000FF';
    const C_ROJO         = '#FF0000';
    const C_GRIS_BORDE   = '#000000';
    const C_VERDE_CAJA   = '#00B050';

    const W = doc.page.width - 60;
    const LEFT = 30;
    let y = 30;

    const drawCell = (cx, cy, cw, ch, text, fill, textCol, align, bold, size, valigOffset = 4) => {
        if (fill) { doc.rect(cx, cy, cw, ch).fill(fill); }
        doc.rect(cx, cy, cw, ch).stroke(C_GRIS_BORDE);
        if (text) {
            doc.fillColor(textCol || '#000000').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size || 7)
               .text(text, cx + 2, cy + valigOffset, { width: cw - 4, align: align || 'left' });
        }
    };

    doc.font('Helvetica-Bold').fontSize(11).fillColor(C_VERDE_TITULO).text('SOLICITUD UNIVERSAL DE RECURSOS 2026', LEFT, y, { width: W, align: 'center' });
    doc.fontSize(9).text('SAC-TSR-RCS-2026', LEFT, y, { width: W, align: 'right' });
    
    y += 15;
    const fechaText = new Date(sol.fecha_solicitud).toLocaleDateString('es-MX');
    doc.font('Helvetica').fontSize(9).fillColor('#000000').text('Oaxaca de Juarez, Oax., a', LEFT + 350, y);
    drawCell(LEFT + 470, y - 2, 80, 12, fechaText, C_AMARILLO, C_AZUL, 'center', true, 9, 2);
    doc.fontSize(7).fillColor(C_ROJO).text('Fecha (dd/mm/aa)', LEFT + 470, y + 12, { width: 80, align: 'center' });

    y += 10;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('C. BEATRIZ CRUZ CANO\nTESORERIA\nOPCIONES SACIMEX SA DE CV SOFOM ENR', LEFT, y);
    y += 35;
    doc.font('Helvetica-Oblique').fillColor(C_AZUL).text('Servicios integrados EXDAN SA DE CV', LEFT, y);

    y += 20;
    doc.font('Helvetica').fillColor('#000000').fontSize(8).text('Por medio del presente solicito recurso para:', LEFT, y + 3);
    drawCell(LEFT + 195, y, 320, 13, sol.concepto_desc || sol.concepto_id || 'PAGO', C_AMARILLO, C_AZUL, 'left', true, 8, 3);
    doc.fillColor('#000').font('Helvetica').text(sol.concepto_clave || sol.concepto_id, LEFT + 525, y + 3);

    y += 16;
    doc.fillColor('#000000').text('correspondiente a la unidad de negocio:', LEFT, y + 3);
    doc.rect(LEFT + 195, y, 320, 13).lineWidth(2).stroke(C_VERDE_CAJA); 
    doc.rect(LEFT + 195, y, 320, 13).fill(C_AMARILLO);
    doc.lineWidth(1); 
    doc.fillColor(C_AZUL).font('Helvetica-Bold').text(sol.unidad_negocio || 'Corporativo', LEFT + 198, y + 3);

    y += 22;
    doc.fillColor('#000000').font('Helvetica').text('Por la cantidad de:', LEFT, y + 3);
    drawCell(LEFT + 80, y, 80, 13, formatMoney(sol.monto), C_AMARILLO, C_AZUL, 'center', true, 9, 3);
    
    const letrasMonto = numeroALetras(sol.monto);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8).text(letrasMonto, LEFT + 165, y + 3);

    y += 16;
    doc.font('Helvetica').fontSize(8).text('Lo cual sera destinado para lo descrito en el apartado siguiente. Sin mas por el momento quedo a sus ordenes.', LEFT, y);

    y += 22;
    drawCell(LEFT, y, W, 13, 'DATOS DEL PROVEEDOR O BENEFICIARIO', null, '#000000', 'center', true, 9, 3);
    
    y += 13;
    drawCell(LEFT, y, 250, 13, 'DESCRIPCION ESPECIFICA DE LA FINALIDAD DEL RECURSO:', null, '#000000', 'left', true, 7, 4);
    drawCell(LEFT + 250, y, 180, 13, 'Ayuda: (El despacho, honorarios, colegiaturas, etc.)', null, C_ROJO, 'left', false, 7, 4);
    drawCell(LEFT + 430, y, W - 430, 13, 'Fecha de vencimiento', null, C_ROJO, 'center', false, 7, 4);

    y += 13;
    const fechaLimiteText = sol.fecha_limite_pago ? new Date(sol.fecha_limite_pago).toLocaleDateString('es-MX', {timeZone: 'UTC'}) : '---';
    drawCell(LEFT, y, 430, 15, sol.descripcion || '', C_AMARILLO, C_AZUL, 'left', true, 8, 4);
    drawCell(LEFT + 430, y, W - 430, 15, fechaLimiteText, C_AMARILLO, C_AZUL, 'center', true, 8, 4);

    y += 15;
    drawCell(LEFT, y, 120, 13, 'TIPO DE SOLICITUD', null, '#000000', 'left', true, 7, 4);
    drawCell(LEFT + 120, y, 130, 13, 'REFERENCIA', null, '#000000', 'left', true, 7, 4);
    drawCell(LEFT + 250, y, 180, 13, 'CUENTA / CLABE / CIE', null, '#000000', 'left', true, 7, 4);
    drawCell(LEFT + 430, y, W - 430, 13, 'BANCO:', null, '#000000', 'left', true, 7, 4);

    y += 13;
    drawCell(LEFT, y, 120, 15, (sol.forma_pago || 'TRANSFERENCIA').toUpperCase(), C_AMARILLO, C_AZUL, 'left', true, 8, 4);
    drawCell(LEFT + 120, y, 130, 15, '', null, C_AZUL, 'left', true, 8, 4);
    drawCell(LEFT + 250, y, 180, 15, sol.proveedor_clabe || sol.proveedor_cuenta || '---', C_AMARILLO, C_AZUL, 'left', true, 8, 4);
    drawCell(LEFT + 430, y, W - 430, 15, sol.proveedor_banco || '---', C_AMARILLO, C_AZUL, 'left', true, 8, 4);

    y += 15;
    drawCell(LEFT, y, 250, 13, 'NOMBRE DEL PROVEEDOR // BENEFICIARIO', null, '#000000', 'left', true, 7, 4);
    drawCell(LEFT + 250, y, 180, 13, 'RFC PROVEEDOR', null, '#000000', 'left', true, 7, 4);
    drawCell(LEFT + 430, y, W - 430, 13, 'CORREO DEL PROVEEDOR', null, '#000000', 'left', true, 7, 4);

    y += 13;
    drawCell(LEFT, y, 250, 15, sol.proveedor_nombre || '---', null, C_AZUL, 'left', true, 8, 4);
    drawCell(LEFT + 250, y, 180, 15, sol.proveedor_rfc || '---', C_AMARILLO, C_AZUL, 'left', true, 8, 4);
    drawCell(LEFT + 430, y, W - 430, 15, sol.proveedor_correo || '---', null, C_AZUL, 'left', true, 8, 4);

    y += 15;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C_ROJO).text('Ayuda: Recuerda solicitar la factura con uso de G03 - Gastos en general.', LEFT, y + 3);

    y += 20;
    drawCell(LEFT, y, 80, 15, 'SOLO PFF ->', null, C_ROJO, 'center', true, 8, 4);
    drawCell(LEFT + 80, y, 80, 15, 'CAPITAL', null, '#000000', 'center', true, 8, 4);
    drawCell(LEFT + 160, y, 80, 15, '', C_AMARILLO, '#000000', 'center', true, 8, 4);
    drawCell(LEFT + 240, y, 70, 15, 'INTERESES', null, '#000000', 'center', true, 8, 4);
    drawCell(LEFT + 310, y, 70, 15, '', C_AMARILLO, '#000000', 'center', true, 8, 4);
    drawCell(LEFT + 380, y, 60, 15, 'CARGOS', null, '#000000', 'center', true, 8, 4);
    drawCell(LEFT + 440, y, 50, 15, '', C_AMARILLO, '#000000', 'center', true, 8, 4);
    drawCell(LEFT + 490, y, 62, 15, 'TOTAL', null, '#000000', 'center', true, 8, 4);

    y += 30;
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).dash(3, {space: 3}).stroke('#999').undash();

    y += 20;
    const isCheque = (sol.forma_pago || '').toUpperCase() === 'CHEQUE';
    
    if (isCheque) {
        doc.rect(LEFT, y, 180, 16).fillAndStroke(C_VERDE_CAJA, C_VERDE_CAJA);
        doc.fillColor('#FFF').font('Helvetica-Bold').text('POLIZA DE CHEQUE', LEFT, y + 4, {width: 180, align: 'center'});
        doc.fillColor('#000').font('Helvetica').text(`Unidad de negocio: ${sol.unidad_negocio || ''}`, LEFT + 190, y + 4);
        doc.text(fechaText, LEFT + 450, y + 4);

        y += 16;
        doc.rect(LEFT, y, W, 80).stroke(C_VERDE_CAJA);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
        doc.text('LA POLIZA CHEQUE ', LEFT + 40, y + 15);
        doc.font('Helvetica').fontSize(8).text('Datos cuenta: ', LEFT + 40, y + 70);
    } else {
        doc.rect(LEFT, y, 220, 16).fillAndStroke(C_AZUL, C_AZUL);
        doc.fillColor('#FFF').font('Helvetica-Bold').text('DATOS BANCARIOS (TRANSFERENCIA)', LEFT, y + 4, {width: 220, align: 'center'});
        doc.fillColor('#000').font('Helvetica').text(`Unidad de negocio: ${sol.unidad_negocio || ''}`, LEFT + 230, y + 4);
        doc.text(fechaText, LEFT + 450, y + 4);

        y += 16;
        doc.rect(LEFT, y, W, 80).stroke(C_AZUL);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
        doc.text('INFORMACION PARA TRANSFERENCIA ELECTRONICA', LEFT + 40, y + 15);
        
        doc.font('Helvetica-Bold').fontSize(9).text('BANCO:', LEFT + 40, y + 35);
        doc.font('Helvetica').text(sol.proveedor_banco || '---', LEFT + 90, y + 35);
        
        doc.font('Helvetica-Bold').text('NO. CUENTA:', LEFT + 300, y + 35);
        doc.font('Helvetica').text(sol.proveedor_cuenta || '---', LEFT + 370, y + 35);
        
        doc.font('Helvetica-Bold').text('CLABE INTERBANCARIA:', LEFT + 40, y + 55);
        doc.font('Helvetica').text(sol.proveedor_clabe || '---', LEFT + 170, y + 55);

        doc.font('Helvetica-Bold').text('CORREO:', LEFT + 300, y + 55);
        doc.font('Helvetica').text(sol.proveedor_correo || '---', LEFT + 350, y + 55);
    }

    y += 90;
    doc.rect(LEFT, y, 260, 14).fillAndStroke(C_VERDE_CAJA, C_VERDE_CAJA);
    doc.fillColor('#FFF').font('Helvetica-Bold').text('CONCEPTO DE PAGO', LEFT, y + 3, {width: 260, align: 'center'});
    doc.rect(LEFT, y+14, 260, 40).stroke(C_VERDE_CAJA);
    doc.fillColor('#000').font('Helvetica-Oblique').text(isCheque ? sol.concepto_id : 'PAGO POR TRANSFERENCIA ELECTRONICA', LEFT, y + 30, {width: 260, align: 'center'});

    doc.rect(LEFT + 292, y, 260, 14).fillAndStroke(C_VERDE_CAJA, C_VERDE_CAJA);
    doc.fillColor('#FFF').font('Helvetica-Bold').text('NOMBRE Y FIRMA DE RECIBIDO', LEFT + 292, y + 3, {width: 260, align: 'center'});
    doc.rect(LEFT + 292, y+14, 260, 40).stroke(C_VERDE_CAJA);
    doc.fillColor(C_ROJO).font('Helvetica-Oblique').text(isCheque ? '' : 'FIRMA NO REQUERIDA (TRANSFERENCIA)', LEFT + 292, y + 30, {width: 260, align: 'center'});

    y += 90; 
    let fy1 = y + 50; 
    
    const fw = 160; 
    const gap = (W - (fw * 3)) / 2; 

    const drawSignatureBlock = (px, py, title, name, role, firmImgPath, extraTitle) => {
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(7).text(title, px, py - 45, { width: fw, align: 'center' });
        if (firmImgPath) {
            const absPath = path.join(__dirname, '../', firmImgPath);
            if (fs.existsSync(absPath)) {
                try { doc.image(absPath, px + (fw/2) - 25, py - 35, { width: 50, height: 25 }); } catch (imgError) {}
            }
        }
        doc.moveTo(px, py).lineTo(px + fw, py).stroke('#000');
        doc.fillColor(C_AZUL).font('Helvetica-Bold').fontSize(6).text(name || '---', px, py + 4, { width: fw, align: 'center' }); 
        doc.fillColor('#000').font('Helvetica').fontSize(6).text(role || '---', px, py + 12, { width: fw, align: 'center' }); 
        if (extraTitle) doc.fontSize(5).text(extraTitle, px, py + 20, { width: fw, align: 'center' });
    };

    const getFirma = (rolBuscado) => firmas.find(f => f.etapa_firma === rolBuscado && f.accion === 'APROBADO') || {};

    drawSignatureBlock(LEFT, fy1, 'SOLICITADO POR', sol.solicitante_nombre, sol.solicitante_puesto, sol.solicitante_firma, 'Servicios integrados EXDAN SA DE CV');
    
    const reqVobo = sol.requiere_vobo == 1 || sol.requiere_vobo === true || (Buffer.isBuffer(sol.requiere_vobo) && sol.requiere_vobo[0] === 1);
    const vobo = getFirma('VISTO BUENO');
    const voboName = reqVobo ? (vobo.aprobador || 'PENDIENTE DE FIRMA') : 'N/A';
    const voboRole = reqVobo ? (vobo.aprobador_puesto || `VoBo: ${sol.area_visto_bueno}`) : 'N/A';
    drawSignatureBlock(LEFT + fw + gap, fy1, 'VISTO BUENO (SI APLICA)', voboName, voboRole, vobo.ruta_firma_png, '');
    
    const pagado = getFirma('PAGADO');
    const pagoName = sol.estatus === 'PAGADO' ? (pagado.aprobador || 'C. BEATRIZ CRUZ CANO') : '---';
    const pagoRol  = sol.estatus === 'PAGADO' ? (pagado.aprobador_puesto || 'TSR - Coordinador(a) de Tesoreria') : '---';
    drawSignatureBlock(LEFT + (fw + gap)*2, fy1, 'PAGADO POR', pagoName, pagoRol, sol.estatus === 'PAGADO' ? pagado.ruta_firma_png : null, '');

    let fy2 = fy1 + 100; 
    const reqNiveles = calcularNivelesRequeridos(sol.monto);
    
    const rev = getFirma('REVISOR');
    drawSignatureBlock(LEFT, fy2, 'REVISADO POR', rev.aprobador || 'LIC C.P. MARIAM ITZEL RAMIREZ CARRASCO', rev.aprobador_puesto || 'AsCNT - Asistente Contable', rev.ruta_firma_png, 'Servicios integrados EXDAN SA DE CV');

    const aut1 = getFirma('AUTORIZADOR_1');
    drawSignatureBlock(LEFT + fw + gap, fy2, 'AUTORIZACION NIVEL 1', aut1.aprobador || 'C.P TRINIDAD LISBETH REYES RUIZ', aut1.aprobador_puesto || 'GA - Gerente de Administracion (2020)', aut1.ruta_firma_png, 'Servicios integrados EXDAN SA DE CV');

    if (reqNiveles >= 3) {
        const aut2 = getFirma('AUTORIZADOR_2');
        drawSignatureBlock(LEFT + (fw + gap)*2, fy2, 'AUTORIZACION NIVEL 2', aut2.aprobador || 'MBA.CP ISAAC CRUZ CANO', aut2.aprobador_puesto || 'DIRECTOR GENERAL', aut2.ruta_firma_png, 'Servicios integrados EXDAN SA DE CV');
    } else {
        drawSignatureBlock(LEFT + (fw + gap)*2, fy2, 'AUTORIZACION NIVEL 2', 'N/A', 'N/A', null, '');
    }

    doc.end();
}

module.exports = router;