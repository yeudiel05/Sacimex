const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const { autorizar, autorizarModulo } = require('../middlewares/autorizar');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');

// --- Consultas a bitacora_auditoria con detalle tecnico opcional -----------
// Diseño simple-pero-completo: el "detalle" que ve cualquier persona es una
// frase en español (ej. "El usuario treyes inició sesión"). El detalle
// técnico (IP, método HTTP, ruta) vive en columnas aparte (ip_address,
// metodo_http, ruta) y se entrega también en la respuesta, pero el frontend
// lo muestra oculto/expandible, no mezclado en la frase principal.
//
// Si la migración SQL todavía no corrió (columnas nuevas no existen), se cae
// automáticamente a la consulta clásica sin romper la pantalla.

let columnasTecnicasDisponibles = null; // null = sin probar, true/false = ya se sabe

const SELECT_BASE = `
    SELECT b.id, b.accion, b.detalle, b.fecha,
           IFNULL(u.username, 'SISTEMA') AS usuario,
           b.ip_address, b.metodo_http, b.ruta
    FROM bitacora_auditoria b
    LEFT JOIN usuarios u ON b.id_usuario = u.id
`;

const SELECT_CON_TECNICO = `
    SELECT b.id, b.accion, b.detalle,
           COALESCE(b.fecha_ms, b.fecha) AS fecha,
           b.ip_address, b.metodo_http, b.ruta,
           b.modulo, b.nombre_completo, b.rol_usuario,
           IFNULL(u.username, 'SISTEMA') AS usuario
    FROM bitacora_auditoria b
    LEFT JOIN usuarios u ON b.id_usuario = u.id
`;

function consultarBitacora(whereYOrden, params, callback) {
    const intentarConTecnico = columnasTecnicasDisponibles !== false;
    const query = (intentarConTecnico ? SELECT_CON_TECNICO : SELECT_BASE) + whereYOrden;

    db.query(query, params, (err, results) => {
        if (err && intentarConTecnico) {
            // Todavia no se corrió la migración SQL: reintentamos sin las columnas nuevas.
            columnasTecnicasDisponibles = false;
            const queryClasico = SELECT_BASE + whereYOrden;
            return db.query(queryClasico, params, callback);
        }
        if (!err) columnasTecnicasDisponibles = true;
        callback(err, results);
    });
}

router.get('/', verificarToken, autorizarModulo('auditoria', ['ADMIN'], 'puede_ver'), (req, res) => {
    const { usuario, modulo, accion, fechaInicio, fechaFin, limit = 500 } = req.query;

    let where = ' WHERE 1=1';
    const params = [];

    if (usuario) {
        where += ' AND (u.username LIKE ? OR b.nombre_completo LIKE ?)';
        params.push(`%${usuario}%`, `%${usuario}%`);
    }
    if (modulo)  { where += ' AND b.modulo = ?';  params.push(modulo); }
    if (accion)  { where += ' AND b.accion LIKE ?'; params.push(`%${accion}%`); }
    if (fechaInicio) { where += ' AND b.fecha >= ?'; params.push(`${fechaInicio} 00:00:00`); }
    if (fechaFin)    { where += ' AND b.fecha <= ?'; params.push(`${fechaFin} 23:59:59`); }

    const orden = ` ORDER BY b.fecha DESC LIMIT ${parseInt(limit) || 500}`;

    consultarBitacora(where + orden, params, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al obtener la bitácora.' });
        res.json({ success: true, data: results });
    });
});

router.get('/reporte/pdf', verificarToken, autorizarModulo('auditoria', ['ADMIN'], 'puede_ver'), (req, res) => {
    const { fechaInicio, fechaFin } = req.query;

    let whereYOrden = ' WHERE 1=1';
    const queryParams = [];

    if (fechaInicio && fechaFin) {
        whereYOrden += ' AND b.fecha BETWEEN ? AND ?';
        queryParams.push(`${fechaInicio} 00:00:00`, `${fechaFin} 23:59:59`);
    }
    whereYOrden += ' ORDER BY b.fecha DESC';

    consultarBitacora(whereYOrden, queryParams, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en BD' });

        const periodo = (fechaInicio && fechaFin)
            ? `Del ${fechaInicio} al ${fechaFin}`
            : 'Histórico Completo';

        const doc = new PDFDocument({ size: 'LETTER', margin: 0, layout: 'portrait', bufferPages: true });

        res.setHeader('Content-Disposition', `attachment; filename=Auditoria_Sacimex_${fechaInicio || 'Completa'}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        // ── Paleta institucional ──────────────────────────────────────────
        const C_VERDE    = '#00B050';
        const C_VERDE_O  = '#007A35';   // verde oscuro para subtítulos
        const C_BLANCO   = '#FFFFFF';
        const C_GRIS_BG  = '#F1F5F9';   // filas pares de la tabla
        const C_GRIS_LIN = '#CBD5E1';   // líneas divisorias
        const C_TEXTO    = '#0F172A';   // texto principal
        const C_TEXTO2   = '#475569';   // texto secundario

        const PW   = doc.page.width;    // 612
        const PH   = doc.page.height;   // 792
        const ML   = 40;                // margen izquierdo
        const MR   = 40;                // margen derecho
        const W    = PW - ML - MR;      // 532 ancho útil

        // ── Columnas de la tabla ─────────────────────────────────────────
        // Fecha | Usuario | Acción | Detalle | IP
        const COLS = [
            { label: 'FECHA Y HORA',   w: 90  },
            { label: 'USUARIO',        w: 70  },
            { label: 'ACCIÓN',         w: 105 },
            { label: 'DETALLE',        w: 207 },
            { label: 'IP / EQUIPO',    w: 60  },
        ];

        const ROW_H      = 28;   // altura de fila datos (se extiende si hay texto largo)
        const HEAD_H     = 16;   // altura header tabla
        const HEADER_Y   = 130;  // donde empieza el contenido (bajo el encabezado institucional)
        const FOOTER_H   = 30;   // espacio reservado al pie

        // ── Función: trazar encabezado institucional ──────────────────────
        const logoPath = path.join(__dirname, '../../frontend/src/assets/Logo.png');
        const hayLogo  = fs.existsSync(logoPath);

        const drawPageHeader = () => {
            // Fondo blanco (ya es el default, pero lo declaramos explícitamente)
            doc.rect(0, 0, PW, 130).fill('#FFFFFF');

            // Franja verde delgada en la parte superior (acento institucional)
            doc.rect(0, 0, PW, 5).fill(C_VERDE);

            // Logo a la izquierda
            if (hayLogo) {
                try { doc.image(logoPath, ML, 14, { height: 72, fit: [80, 72] }); } catch (_) {}
            }

            // Nombre institucional centrado en toda la página
            doc.fillColor(C_VERDE_O)
               .font('Helvetica-Bold').fontSize(14)
               .text('OPCIONES SACIMEX SA DE CV SOFOM ENR', ML, 18, { width: W, align: 'center' });
            doc.fillColor(C_TEXTO2)
               .font('Helvetica').fontSize(9)
               .text('Oaxaca de Juárez, Oaxaca — México', ML, 36, { width: W, align: 'center' });
            doc.fillColor(C_TEXTO2)
               .font('Helvetica').fontSize(8)
               .text('Sistema Administrativo de Control Interno', ML, 49, { width: W, align: 'center' });

            // Línea verde divisora
            doc.moveTo(ML, 96).lineTo(PW - MR, 96).lineWidth(1.5).strokeColor(C_VERDE).stroke();

            // Título del reporte centrado
            doc.fillColor(C_VERDE_O).font('Helvetica-Bold').fontSize(13)
               .text('REPORTE OFICIAL DE AUDITORÍA', ML, 104, { width: W, align: 'center' });

            // Línea gris al pie del header
            doc.moveTo(ML, 126).lineTo(PW - MR, 126).lineWidth(0.5).strokeColor(C_GRIS_LIN).stroke();
        };

        // ── Función: pie de página con número ────────────────────────────
        const drawPageFooter = (pageNum, totalPages) => {
            const fy = PH - FOOTER_H;
            doc.moveTo(ML, fy).lineTo(PW - MR, fy).lineWidth(0.5).strokeColor(C_GRIS_LIN).stroke();
            doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(8)
               .text('Opciones Sacimex SA de CV SOFOM ENR — Documento generado por el sistema ERP',
                     ML, fy + 6, { width: W - 80, align: 'left' });
            doc.fillColor(C_TEXTO2).font('Helvetica-Bold').fontSize(8)
               .text(`Página ${pageNum} de ${totalPages}`, PW - MR - 80, fy + 6, { width: 80, align: 'right' });
        };

        // ── Función: encabezado de tabla ──────────────────────────────────
        const drawTableHeader = (ty) => {
            let cx = ML;
            COLS.forEach(col => {
                doc.rect(cx, ty, col.w, HEAD_H).fill(C_VERDE_O);
                doc.fillColor(C_BLANCO).font('Helvetica-Bold').fontSize(6.5)
                   .text(col.label, cx + 3, ty + 4, { width: col.w - 6, align: 'left' });
                cx += col.w;
            });
            return ty + HEAD_H;
        };

        // ── Primera página ────────────────────────────────────────────────
        drawPageHeader();

        // Bloque de info del reporte
        let iy = HEADER_Y + 4;
        doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(9)
           .text(`Periodo evaluado:`, ML, iy, { continued: true })
           .fillColor(C_TEXTO).font('Helvetica-Bold')
           .text(`  ${periodo}`, { continued: false });

        iy += 14;
        const ahora = new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' });
        doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(9)
           .text(`Fecha de emisión:`, ML, iy, { continued: true })
           .fillColor(C_TEXTO).font('Helvetica-Bold')
           .text(`  ${ahora}`, { continued: false });

        iy += 14;
        doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(9)
           .text(`Total de registros:`, ML, iy, { continued: true })
           .fillColor(C_TEXTO).font('Helvetica-Bold')
           .text(`  ${results.length}`, { continued: false });

        iy += 16;

        if (results.length === 0) {
            doc.moveDown(2);
            doc.fillColor(C_TEXTO2).font('Helvetica-Oblique').fontSize(11)
               .text('No se registraron movimientos en este periodo.', ML, iy, { width: W, align: 'center' });
            doc.end();
            return;
        }

        // ── Tabla de registros ────────────────────────────────────────────
        let ty = drawTableHeader(iy);
        let rowIndex = 0;

        const formatFechaPDF = (raw) => {
            if (!raw) return '—';
            const d = new Date(raw);
            if (isNaN(d)) return String(raw).substring(0, 16);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${dd}/${mm}/${yyyy}\n${hh}:${min}`;
        };

        results.forEach(log => {
            // Calcular altura dinámica de la fila según el texto más largo
            const detalle   = (log.detalle || '').substring(0, 180);
            const accion    = (log.accion  || '').replace(/_/g, ' ');
            const usuario   = (log.usuario || 'SISTEMA');
            const ip        = (log.ip_address || '—');
            const fecha     = formatFechaPDF(log.fecha);

            // Estimar cuántas líneas ocupa cada celda
            const estimarLineas = (txt, colW, fz = 7) => {
                const charsPerLine = Math.floor((colW - 6) / (fz * 0.55));
                return Math.max(1, Math.ceil(txt.length / charsPerLine));
            };
            const lineasDetalle  = estimarLineas(detalle, COLS[3].w);
            const lineasAccion   = estimarLineas(accion,  COLS[2].w);
            const lineHeight     = 9.5;
            const rh             = Math.max(ROW_H, Math.max(lineasDetalle, lineasAccion) * lineHeight + 8);

            // ¿Cabe la fila en esta página?
            if (ty + rh > PH - FOOTER_H - 10) {
                doc.addPage({ size: 'LETTER', margin: 0 });
                drawPageHeader();
                ty = drawTableHeader(HEADER_Y + 4);
                rowIndex = 0;
            }

            // Fondo alternado
            const bgColor = (rowIndex % 2 === 0) ? C_BLANCO : C_GRIS_BG;
            doc.rect(ML, ty, W, rh).fill(bgColor);

            // Línea inferior de fila
            doc.moveTo(ML, ty + rh).lineTo(ML + W, ty + rh)
               .lineWidth(0.3).strokeColor(C_GRIS_LIN).stroke();

            // Contenido de cada celda
            const vals = [fecha, usuario, accion, detalle, ip];
            let cx = ML;
            COLS.forEach((col, ci) => {
                doc.fillColor(C_TEXTO).font('Helvetica').fontSize(7)
                   .text(vals[ci], cx + 3, ty + 5, {
                       width: col.w - 6,
                       height: rh - 6,
                       ellipsis: ci === 3 ? false : true,
                       lineBreak: true
                   });
                // separador vertical
                doc.moveTo(cx + col.w, ty).lineTo(cx + col.w, ty + rh)
                   .lineWidth(0.3).strokeColor(C_GRIS_LIN).stroke();
                cx += col.w;
            });

            ty += rh;
            rowIndex++;
        });

        // ── Añadir pies de página a todas las páginas ─────────────────────
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            drawPageFooter(i + 1, totalPages);
        }

        doc.end();
        registrarBitacora(req.usuario.id, 'EXPORTAR_AUDITORIA', `Descargó reporte PDF de auditoría (${periodo})`, req);
    });
});


// Bitacora TECNICA de accesos: literalmente cada peticion al API (incluidas lecturas),
// capturada automaticamente por el middleware logAccesos.js sin depender de logs manuales.
// Solo ADMIN puede consultarla: es informacion muy detallada (IP, ruta, duracion, etc).
router.get('/accesos', verificarToken, autorizarModulo('auditoria', ['ADMIN'], 'puede_ver'), (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'No tienes permiso para ver la bitacora tecnica de accesos.' });
    }

    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const porPagina = Math.min(parseInt(req.query.porPagina) || 100, 500);
    const offset = (pagina - 1) * porPagina;

    const filtros = [];
    const params = [];
    if (req.query.usuario) {
        filtros.push('usuario LIKE ?');
        params.push(`%${req.query.usuario}%`);
    }
    if (req.query.fechaInicio && req.query.fechaFin) {
        filtros.push('fecha BETWEEN ? AND ?');
        params.push(`${req.query.fechaInicio} 00:00:00`, `${req.query.fechaFin} 23:59:59`);
    }
    const whereClause = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    const queryConteo = `SELECT COUNT(*) AS total FROM bitacora_accesos ${whereClause}`;
    const queryDatos = `SELECT id, id_usuario, usuario, metodo_http, ruta, ip_address, status_code, duracion_ms, fecha
                         FROM bitacora_accesos ${whereClause}
                         ORDER BY fecha DESC LIMIT ? OFFSET ?`;

    db.query(queryConteo, params, (errConteo, resultConteo) => {
        if (errConteo) {
            return res.status(500).json({
                success: false,
                message: 'La bitacora de accesos aun no esta disponible. Corre la migracion SQL (sql/2026_07_ampliar_bitacora.sql).'
            });
        }
        db.query(queryDatos, [...params, porPagina, offset], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: 'Error al consultar la bitacora de accesos.' });
            res.json({
                success: true,
                data: results,
                total: resultConteo[0].total,
                pagina,
                porPagina,
                totalPaginas: Math.ceil(resultConteo[0].total / porPagina)
            });
        });
    });
});

module.exports = router;