const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ─── Multer para comprobante de pago ─────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => cb(null, `solicitud-${req.params.id}-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// =====================================================================
// FUNCIONES AUXILIARES (NÚMEROS A LETRAS)
// =====================================================================
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
        letras += (millones === 1 ? 'UN MILLÓN ' : convertirGrupo(millones) + 'MILLONES ');
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

// =====================================================================
// CEREBRO DE AUTORIZACIONES
// =====================================================================
function calcularNivelesRequeridos(monto) {
    return parseFloat(monto) > 100000 ? 3 : 2; 
}

function obtenerRolEsperado(monto, nivelActual) {
    if (nivelActual === 0) return 'REVISOR';
    if (nivelActual === 1) return 'AUTORIZADOR_1';
    if (nivelActual === 2 && parseFloat(monto) > 100000) return 'AUTORIZADOR_2';
    return null; 
}

function formatMoney(n) {
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =====================================================================
// RUTAS
// =====================================================================

router.get('/', verificarToken, (req, res) => {
    const miRol = req.usuario.rol;
    const miId  = req.usuario.id;

    let query = `
        SELECT 
            s.id, s.folio, s.concepto_id, s.unidad_negocio, s.monto, 
            s.estatus, s.nivel_actual, s.niveles_requeridos,
            s.fecha_solicitud, s.comprobante_pago_path,
            p.nombre_razon_social AS solicitante_nombre
        FROM solicitudes_recursos s
        JOIN usuarios u ON s.solicitante_id = u.id
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
    `;

    if (!['ADMIN', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA'].includes(miRol)) {
        query += ` WHERE s.solicitante_id = ${db.escape(miId)}`;
    }
    query += ' ORDER BY s.fecha_solicitud DESC';

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.get('/pendientes', verificarToken, (req, res) => {
    const miRol = req.usuario.rol;
    const rolANivel = { 'REVISOR': 0, 'AUTORIZADOR_1': 1, 'AUTORIZADOR_2': 2 };
    
    const nivelRol = rolANivel[miRol];
    if (nivelRol === undefined && miRol !== 'ADMIN') return res.json({ success: true, data: [] });

    let query = `
        SELECT s.id, s.folio, s.concepto_id, s.unidad_negocio, s.monto,
               s.estatus, s.nivel_actual, s.niveles_requeridos, s.fecha_solicitud,
               p.nombre_razon_social AS solicitante_nombre
        FROM solicitudes_recursos s
        JOIN usuarios u ON s.solicitante_id = u.id
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        WHERE s.estatus NOT IN ('PAGADO', 'RECHAZADO', 'AUTORIZADO_FINAL')
    `;

    if (miRol !== 'ADMIN') {
        query += ` AND s.nivel_actual = ${db.escape(nivelRol)}`;
    }
    query += ' ORDER BY s.fecha_solicitud ASC';

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// ─── GET DETALLE DE SOLICITUD (Corregido a la estructura real de BD) ───
router.get('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    
    // Aquí hacemos el JOIN a proveedores, y OTRO JOIN a personas para sacar el nombre y RFC del proveedor
    const querySolicitud = `
        SELECT s.*, 
               p.nombre_razon_social AS solicitante_nombre,
               pprov.nombre_razon_social AS proveedor_nombre, 
               pprov.rfc AS proveedor_rfc,
               prov.banco AS proveedor_banco,
               prov.numero_cuenta AS proveedor_cuenta, 
               prov.cuenta_bancaria AS proveedor_clabe
        FROM solicitudes_recursos s
        JOIN usuarios u ON s.solicitante_id = u.id
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
        LEFT JOIN personas pprov ON prov.id_persona = pprov.id
        WHERE s.id = ?
    `;
    
    const queryFirmas = `
        SELECT b.comentarios as comentario, b.fecha_firma, b.accion, b.etapa_firma,
               p.nombre_razon_social AS aprobador, e.puesto AS aprobador_puesto
        FROM historial_firmas_pago b 
        JOIN usuarios u ON b.id_usuario = u.id 
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        WHERE b.id_solicitud = ?
        ORDER BY b.fecha_firma ASC
    `;
    
    db.query(querySolicitud, [id], (err, resSol) => {
        if (err) {
            console.error('🔥 ERROR SQL SOLICITUD:', err.message);
            return res.status(500).json({ success: false, message: 'Falla BD Solicitud: ' + err.message });
        }
        if (resSol.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada en la BD' });
        }
        
        db.query(queryFirmas, [id], (err2, resFirmas) => {
            if (err2) {
                console.error('🔥 ERROR SQL FIRMAS:', err2.message);
                return res.status(500).json({ success: false, message: 'Falla BD Firmas: ' + err2.message });
            }
            res.json({ success: true, solicitud: resSol[0], firmas: resFirmas });
        });
    });
});

// ─── GET PDF (Corregido a la estructura real de BD) ───
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
               prov.banco AS proveedor_banco,
               prov.numero_cuenta AS proveedor_cuenta, 
               prov.cuenta_bancaria AS proveedor_clabe
        FROM solicitudes_recursos s
        JOIN usuarios u ON s.solicitante_id = u.id
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
        LEFT JOIN personas pprov ON prov.id_persona = pprov.id
        WHERE s.id = ?
    `;

    const queryFirmas = `
        SELECT hf.etapa_firma, hf.fecha_firma, hf.accion,
               p.nombre_razon_social AS aprobador, e.puesto AS aprobador_puesto, u.ruta_firma_png
        FROM historial_firmas_pago hf
        JOIN usuarios u ON hf.id_usuario = u.id
        JOIN empleados e ON u.id_empleado = e.id_persona
        JOIN personas p ON e.id_persona = p.id
        WHERE hf.id_solicitud = ?
        ORDER BY hf.fecha_firma ASC
    `;

    db.query(querySolicitud, [id], (err, solRows) => {
        if (err) {
            console.error('🔥 ERROR PDF SQL SOLICITUD:', err.message);
            return res.status(500).json({ success: false, message: 'Falla BD Solicitud PDF: ' + err.message });
        }
        if (solRows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada para PDF' });
        
        db.query(queryFirmas, [id], (err2, firmas) => {
            if (err2) {
                console.error('🔥 ERROR PDF SQL FIRMAS:', err2.message);
                return res.status(500).json({ success: false, message: 'Falla BD Firmas PDF: ' + err2.message });
            }
            try {
                generarPDFSolicitud(res, solRows[0], firmas || []);
            } catch (pdfErr) {
                console.error('🔥 ERROR GENERANDO ARCHIVO PDF:', pdfErr);
                res.status(500).json({ success: false, message: 'Error al generar documento PDF' });
            }
        });
    });
});

router.post('/crear', verificarToken, (req, res) => {
    const { concepto_id, unidad_negocio, monto, descripcion, id_proveedor, forma_pago } = req.body;
    const solicitante_id = req.usuario.id;
    const montoNum = parseFloat(monto) || 0;
    const niveles = calcularNivelesRequeridos(montoNum);

    const anio = new Date().getFullYear();
    const folioBase = `SAC-TSR-RCS-${anio}`;

    const query = `
        INSERT INTO solicitudes_recursos 
        (solicitante_id, concepto_id, descripcion, monto, unidad_negocio, 
         id_proveedor, forma_pago, estatus, nivel_actual, niveles_requeridos) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 0, ?)
    `;

    db.query(query, [
        solicitante_id, concepto_id, descripcion, montoNum,
        unidad_negocio, id_proveedor || null, forma_pago || 'TRANSFERENCIA', niveles
    ], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
        const solicitudId = result.insertId;
        const folio = `${folioBase}-${String(solicitudId).padStart(5, '0')}`;
        db.query('UPDATE solicitudes_recursos SET folio = ? WHERE id = ?', [folio, solicitudId], () => {
            res.json({ success: true, id: solicitudId, folio, message: 'Solicitud registrada' });
        });
    });
});

router.post('/autorizar/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { comentario } = req.body;
    const miRol = req.usuario.rol;
    const miUsuarioId = req.usuario.id;

    db.query('SELECT monto, nivel_actual, estatus FROM solicitudes_recursos WHERE id = ?', [id], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ success: false });

        const sol = rows[0];
        if (['PAGADO', 'RECHAZADO'].includes(sol.estatus)) return res.status(400).json({ success: false });

        const rolEsperado = obtenerRolEsperado(sol.monto, sol.nivel_actual);
        if (!rolEsperado) return res.status(400).json({ success: false, message: 'Ya firmada' });

        if (miRol !== 'ADMIN' && miRol !== rolEsperado) {
            return res.status(403).json({ success: false, message: `Se requiere rol: ${rolEsperado}` });
        }

        const nuevoNivel = sol.nivel_actual + 1;
        const siguienteRol = obtenerRolEsperado(sol.monto, nuevoNivel);
        const nuevoEstatus = siguienteRol ? `AUTORIZADO_${nuevoNivel}` : 'AUTORIZADO_FINAL';

        db.beginTransaction(err3 => {
            if (err3) return res.status(500).json({ success: false });

            const queryFirma = `
                INSERT INTO historial_firmas_pago 
                (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios)
                VALUES (?, ?, ?, 'FIRMADO', 'APROBADO', ?)
            `;
            db.query(queryFirma, [id, miUsuarioId, rolEsperado, comentario || 'Aprobado'], (err4) => {
                if (err4) return db.rollback(() => res.status(500).json({ success: false }));
                db.query('UPDATE solicitudes_recursos SET estatus = ?, nivel_actual = ? WHERE id = ?', [nuevoEstatus, nuevoNivel, id], (err5) => {
                    if (err5) return db.rollback(() => res.status(500).json({ success: false }));
                    db.commit(err6 => {
                        if (err6) return db.rollback(() => res.status(500).json({ success: false }));
                        registrarBitacora(miUsuarioId, 'AUTORIZAR', `Firma nivel ${nuevoNivel} en sol #${id}`);
                        res.json({ success: true, nuevo_estatus: nuevoEstatus, message: 'Autorizado' });
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

    db.query('SELECT monto, nivel_actual FROM solicitudes_recursos WHERE id = ?', [id], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ success: false });
        const sol = rows[0];
        const rolEsperado = obtenerRolEsperado(sol.monto, sol.nivel_actual);

        if (miRol !== 'ADMIN' && miRol !== rolEsperado) return res.status(403).json({ success: false });

        db.query(`INSERT INTO historial_firmas_pago (id_solicitud, id_usuario, etapa_firma, estatus_firma, accion, comentarios) VALUES (?, ?, ?, 'RECHAZADO', 'RECHAZADO', ?)`, 
        [id, req.usuario.id, rolEsperado || 'REVISOR', motivo || 'Rechazado'], () => {
            db.query('UPDATE solicitudes_recursos SET estatus = "RECHAZADO" WHERE id = ?', [id], () => {
                res.json({ success: true, message: 'Solicitud rechazada' });
            });
        });
    });
});

router.post('/comprobante/:id', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false });

    const ruta = `uploads/${req.file.filename}`;
    db.query('UPDATE solicitudes_recursos SET comprobante_pago_path = ?, estatus = "PAGADO", fecha_pago = NOW() WHERE id = ?', [ruta, id], () => {
        res.json({ success: true, message: 'Pago registrado' });
    });
});

// =====================================================================
// GENERADOR PDF CLON EXCEL
// =====================================================================
function generarPDFSolicitud(res, sol, firmas) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 30, layout: 'portrait' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${sol.folio || sol.id}.pdf`);
    doc.pipe(res);

    const C_VERDE_TITULO = '#008000';
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

    // CABECERA
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C_VERDE_TITULO).text('SOLICITUD UNIVERSAL DE RECURSOS 2026', LEFT, y, { width: W, align: 'center' });
    doc.fontSize(9).text('SAC-TSR-RCS-2026', LEFT, y, { width: W, align: 'right' });
    
    y += 15;
    const fechaText = new Date(sol.fecha_solicitud).toLocaleDateString('es-MX');
    doc.font('Helvetica').fontSize(9).fillColor('#000000').text('Oaxaca de Juárez, Oax., a', LEFT + 350, y);
    drawCell(LEFT + 470, y - 2, 80, 12, fechaText, C_AMARILLO, C_AZUL, 'center', true, 9, 2);
    doc.fontSize(6).fillColor(C_ROJO).text('Fecha (dd/mm/aa)', LEFT + 470, y + 12, { width: 80, align: 'center' });

    y += 10;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text('C. BEATRIZ CRUZ CANO\nTESORERÍA\nOPCIONES SACIMEX SA DE CV SOFOM ENR', LEFT, y);
    y += 30;
    doc.font('Helvetica-Oblique').fillColor(C_AZUL).text('Servicios integrados EXDAN SA DE CV', LEFT, y);

    y += 20;
    doc.font('Helvetica').fillColor('#000000').fontSize(8).text('Por medio del presente solicito recurso para:', LEFT, y + 3);
    drawCell(LEFT + 190, y, 300, 12, sol.concepto_id || 'PAGO', C_AMARILLO, C_AZUL, 'left', true, 8, 2);

    y += 15;
    doc.fillColor('#000000').text('correspondiente a la unidad de negocio:', LEFT, y + 3);
    doc.rect(LEFT + 190, y, 300, 12).lineWidth(2).stroke(C_VERDE_CAJA); 
    doc.rect(LEFT + 190, y, 300, 12).fill(C_AMARILLO);
    doc.lineWidth(1); 
    doc.fillColor(C_AZUL).font('Helvetica-Bold').text(sol.unidad_negocio || 'Corporativo', LEFT + 192, y + 2);

    // MONTO EN LETRAS
    y += 20;
    doc.fillColor('#000000').font('Helvetica').text('Por la cantidad de:', LEFT, y + 3);
    drawCell(LEFT + 80, y, 80, 12, formatMoney(sol.monto), C_AMARILLO, C_AZUL, 'center', true, 9, 2);
    
    const letrasMonto = numeroALetras(sol.monto);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text(letrasMonto, LEFT + 165, y + 3);

    y += 15;
    doc.font('Helvetica').fontSize(8).text('Lo cual será destinado para lo descrito en el apartado siguiente. Sin más por el momento quedo a sus órdenes.', LEFT, y);

    y += 20;
    drawCell(LEFT, y, W, 12, 'DATOS DEL PROVEEDOR O BENEFICIARIO', null, '#000000', 'center', true, 9, 2);
    
    y += 12;
    drawCell(LEFT, y, 250, 12, 'DESCRIPCIÓN ESPECÍFICA DE LA FINALIDAD DEL RECURSO:', null, '#000000', 'left', false, 7, 3);
    drawCell(LEFT + 250, y, 180, 12, 'Ayuda: (El despacho, honorarios, colegiaturas, etc.)', null, C_ROJO, 'left', false, 7, 3);
    drawCell(LEFT + 430, y, W - 430, 12, 'Fecha de vencimiento', null, C_ROJO, 'center', false, 7, 3);

    y += 12;
    drawCell(LEFT, y, 430, 14, sol.descripcion || '', C_AMARILLO, C_AZUL, 'left', true, 8, 3);
    drawCell(LEFT + 430, y, W - 430, 14, '', C_AMARILLO, C_AZUL, 'center', true, 8, 3);

    y += 14;
    drawCell(LEFT, y, 120, 12, 'TIPO DE SOLICITUD', null, '#000000', 'left', true, 7, 3);
    drawCell(LEFT + 120, y, 130, 12, 'REFERENCIA', null, '#000000', 'left', true, 7, 3);
    drawCell(LEFT + 250, y, 180, 12, 'CUENTA / CLABE / CIE', null, '#000000', 'left', true, 7, 3);
    drawCell(LEFT + 430, y, W - 430, 12, 'BANCO:', null, '#000000', 'left', true, 7, 3);

    y += 12;
    drawCell(LEFT, y, 120, 14, (sol.forma_pago || 'TRANSFERENCIA').toUpperCase(), C_AMARILLO, C_AZUL, 'left', true, 8, 3);
    drawCell(LEFT + 120, y, 130, 14, '', null, C_AZUL, 'left', true, 8, 3);
    drawCell(LEFT + 250, y, 180, 14, sol.proveedor_clabe || sol.proveedor_cuenta || '---', null, C_AZUL, 'left', true, 8, 3);
    drawCell(LEFT + 430, y, W - 430, 14, sol.proveedor_banco || '---', C_AMARILLO, C_AZUL, 'left', true, 8, 3);

    y += 14;
    drawCell(LEFT, y, 250, 12, 'NOMBRE DEL PROVEEDOR // BENEFICIARIO', null, '#000000', 'left', true, 7, 3);
    drawCell(LEFT + 250, y, 180, 12, 'RFC PROVEEDOR', null, '#000000', 'left', true, 7, 3);
    drawCell(LEFT + 430, y, W - 430, 12, 'CORREO DEL PROVEEDOR', null, '#000000', 'left', true, 7, 3);

    y += 12;
    drawCell(LEFT, y, 250, 14, sol.proveedor_nombre || '---', null, C_AZUL, 'left', true, 8, 3);
    drawCell(LEFT + 250, y, 180, 14, sol.proveedor_rfc || '---', C_AMARILLO, C_AZUL, 'left', true, 8, 3);
    drawCell(LEFT + 430, y, W - 430, 14, '---', null, C_AZUL, 'left', true, 8, 3);

    y += 14;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C_ROJO).text('Ayuda: Recuerda solicitar la factura con uso de G03 - Gastos en general.', LEFT, y + 3);

    y += 20;
    drawCell(LEFT, y, 80, 14, 'SÓLO PFF ->', null, C_ROJO, 'center', true, 8, 3);
    drawCell(LEFT + 80, y, 80, 14, 'CAPITAL', null, '#000000', 'center', true, 8, 3);
    drawCell(LEFT + 160, y, 80, 14, '', C_AMARILLO, '#000000', 'center', true, 8, 3);
    drawCell(LEFT + 240, y, 70, 14, 'INTERESES', null, '#000000', 'center', true, 8, 3);
    drawCell(LEFT + 310, y, 70, 14, '', C_AMARILLO, '#000000', 'center', true, 8, 3);
    drawCell(LEFT + 380, y, 60, 14, 'CARGOS', null, '#000000', 'center', true, 8, 3);
    drawCell(LEFT + 440, y, 50, 14, '', C_AMARILLO, '#000000', 'center', true, 8, 3);
    drawCell(LEFT + 490, y, 62, 14, 'TOTAL', null, '#000000', 'center', true, 8, 3);

    y += 25;
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).dash(3, {space: 3}).stroke('#999').undash();

    y += 20;
    const isCheque = (sol.forma_pago || '').toUpperCase() === 'CHEQUE';
    doc.rect(LEFT, y, 180, 16).fillAndStroke(C_VERDE_CAJA, C_VERDE_CAJA);
    doc.fillColor('#FFF').font('Helvetica-Bold').text('PÓLIZA DE CHEQUE', LEFT, y + 4, {width: 180, align: 'center'});
    doc.fillColor('#000').font('Helvetica').text(`Unidad de negocio: ${sol.unidad_negocio || ''}`, LEFT + 190, y + 4);
    doc.text(fechaText, LEFT + 450, y + 4);

    y += 16;
    doc.rect(LEFT, y, W, 80).stroke(C_VERDE_CAJA);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
    doc.text('LA PÓLIZA CHEQUE ' + (isCheque ? '' : 'NO APLICA EN TRANSFERENCIA'), LEFT + 40, y + 15);
    doc.font('Helvetica-Oblique').fontSize(9).text(isCheque ? '' : 'NO APLICA', LEFT + 40, y + 35);
    doc.text(isCheque ? '' : 'NO APLICA', LEFT + 40, y + 55);
    doc.font('Helvetica').fontSize(8).text('Datos cuenta:     ' + (isCheque ? '' : 'NO APLICA'), LEFT + 40, y + 70);

    y += 90;
    doc.rect(LEFT, y, 260, 14).fillAndStroke(C_VERDE_CAJA, C_VERDE_CAJA);
    doc.fillColor('#FFF').font('Helvetica-Bold').text('CONCEPTO DE PAGO', LEFT, y + 3, {width: 260, align: 'center'});
    doc.rect(LEFT, y+14, 260, 40).stroke(C_VERDE_CAJA);
    doc.fillColor('#000').font('Helvetica-Oblique').text(isCheque ? sol.concepto_id : 'PÓLIZA CHEQUE NO APLICA EN TRANSFERENCIA', LEFT, y + 30, {width: 260, align: 'center'});

    doc.rect(LEFT + 292, y, 260, 14).fillAndStroke(C_VERDE_CAJA, C_VERDE_CAJA);
    doc.fillColor('#FFF').font('Helvetica-Bold').text('NOMBRE Y FIRMA DE RECIBIDO', LEFT + 292, y + 3, {width: 260, align: 'center'});
    doc.rect(LEFT + 292, y+14, 260, 40).stroke(C_VERDE_CAJA);
    doc.fillColor(C_ROJO).font('Helvetica-Oblique').text(isCheque ? '' : 'PÓLIZA CHEQUE NO APLICA EN TRANSFERENCIA', LEFT + 292, y + 30, {width: 260, align: 'center'});

    // ─── BLOQUE DE FIRMAS (Separación ampliada a 120 para evitar encimes) ───
    y += 80;
    const fw = 160; 
    const gap = (W - (fw * 3)) / 2; 

    const drawSignatureBlock = (px, py, title, name, role, firmImgPath, extraTitle) => {
        doc.moveTo(px, py).lineTo(px + fw, py).stroke('#000');
        if (firmImgPath) {
            const absPath = path.join(__dirname, '../', firmImgPath);
            if (fs.existsSync(absPath)) doc.image(absPath, px + (fw/2) - 35, py - 40, { width: 70, height: 35 });
        }
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(8).text(title, px, py - 60, { width: fw, align: 'center' });
        doc.fillColor(C_AZUL).font('Helvetica-Bold').fontSize(7).text(name || '---', px, py + 4, { width: fw, align: 'center' }); 
        doc.fillColor('#000').font('Helvetica').fontSize(7).text(role || '---', px, py + 14, { width: fw, align: 'center' }); 
        if (extraTitle) doc.text(extraTitle, px, py + 24, { width: fw, align: 'center' });
    };

    const getFirma = (rolBuscado) => firmas.find(f => f.etapa_firma === rolBuscado && f.accion === 'APROBADO') || {};

    let fy = y + 70;
    drawSignatureBlock(LEFT, fy, 'SOLICITADO POR', sol.solicitante_nombre, sol.solicitante_puesto, sol.solicitante_firma, 'Servicios integrados EXDAN SA DE CV');
    drawSignatureBlock(LEFT + fw + gap, fy, 'VISTO BUENO (SI APLICA)', '', '', null, '');
    
    const pagoName = sol.estatus === 'PAGADO' ? 'C. BEATRIZ CRUZ CANO' : '';
    const pagoRol  = sol.estatus === 'PAGADO' ? 'TSR - Coordinador(a) de Tesorería' : '';
    const firmaTesorera = sol.estatus === 'PAGADO' ? (firmas.find(f => f.aprobador_puesto === 'CAJERO' || f.aprobador_puesto === 'TESORERIA')?.ruta_firma_png || null) : null;
    drawSignatureBlock(LEFT + (fw + gap)*2, fy, 'PAGADO POR', pagoName, pagoRol, firmaTesorera, sol.estatus === 'PAGADO' ? 'Servicios integrados EXDAN SA DE CV' : '');

    fy += 120;
    
    const rev = getFirma('REVISOR');
    drawSignatureBlock(LEFT, fy, 'REVISADO POR', rev.aprobador, rev.aprobador_puesto, rev.ruta_firma_png, rev.aprobador ? 'Servicios integrados EXDAN SA DE CV' : '');

    const aut1 = getFirma('AUTORIZADOR_1');
    drawSignatureBlock(LEFT + fw + gap, fy, 'AUTORIZACIÓN NIVEL 1', aut1.aprobador, aut1.aprobador_puesto, aut1.ruta_firma_png, aut1.aprobador ? 'Servicios integrados EXDAN SA DE CV' : '');

    const aut2 = getFirma('AUTORIZADOR_2');
    drawSignatureBlock(LEFT + (fw + gap)*2, fy, 'AUTORIZACIÓN NIVEL 2', aut2.aprobador ? aut2.aprobador : 'N/A', aut2.aprobador_puesto, aut2.ruta_firma_png, '');

    doc.end();
}

module.exports = router;