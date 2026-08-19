const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const { autorizar, autorizarModulo } = require('../middlewares/autorizar');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');

// ── Paleta institucional ────────────────────────────────────────────────────
const C_VERDE    = '#00B050';
const C_VERDE_O  = '#007A35';
const C_BLANCO   = '#FFFFFF';
const C_GRIS_BG  = '#F1F5F9';
const C_GRIS_LIN = '#CBD5E1';
const C_TEXTO    = '#0F172A';
const C_TEXTO2   = '#475569';

const logoPath = path.join(__dirname, '../../frontend/src/assets/Logo.png');

// ── Generador PDF institucional reutilizable ────────────────────────────────
// cols: [{ label, w }]
// rows: [[val, val, ...]] — una entrada por fila
// wrapCol: índice de columna que puede hacer line-break (generalmente la más ancha)
function generarPDFInstitucional({ res, titulo, subtitulo, cols, rows, filename }) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, layout: 'landscape', bufferPages: true });

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const PW = doc.page.width;   // 792 landscape
    const PH = doc.page.height;  // 612 landscape
    const ML = 36;
    const MR = 36;
    const W  = PW - ML - MR;

    const ROW_H    = 22;
    const HEAD_H   = 16;
    const HEADER_Y = 110;  // donde arranca la tabla
    const FOOTER_H = 28;
    const hayLogo  = fs.existsSync(logoPath);

    // ── Encabezado institucional ────────────────────────────────────────────
    const drawPageHeader = () => {
        doc.rect(0, 0, PW, HEADER_Y).fill(C_BLANCO);
        doc.rect(0, 0, PW, 5).fill(C_VERDE);

        if (hayLogo) {
            try { doc.image(logoPath, ML, 12, { height: 62, fit: [70, 62] }); } catch (_) {}
        }

        doc.fillColor(C_VERDE_O)
           .font('Helvetica-Bold').fontSize(13)
           .text('OPCIONES SACIMEX SA DE CV SOFOM ENR', ML, 16, { width: W, align: 'center' });
        doc.fillColor(C_TEXTO2)
           .font('Helvetica').fontSize(8.5)
           .text('Oaxaca de Juárez, Oaxaca — México', ML, 33, { width: W, align: 'center' });
        doc.fillColor(C_TEXTO2)
           .font('Helvetica').fontSize(7.5)
           .text('Sistema Administrativo de Control Interno', ML, 44, { width: W, align: 'center' });

        doc.moveTo(ML, 80).lineTo(PW - MR, 80).lineWidth(1.5).strokeColor(C_VERDE).stroke();

        doc.fillColor(C_VERDE_O).font('Helvetica-Bold').fontSize(12)
           .text(titulo, ML, 87, { width: W, align: 'center' });
        if (subtitulo) {
            doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(8)
               .text(subtitulo, ML, 100, { width: W, align: 'center' });
        }

        doc.moveTo(ML, HEADER_Y - 4).lineTo(PW - MR, HEADER_Y - 4)
           .lineWidth(0.5).strokeColor(C_GRIS_LIN).stroke();
    };

    // ── Pie de página ───────────────────────────────────────────────────────
    const drawPageFooter = (pageNum, totalPages) => {
        const fy = PH - FOOTER_H;
        doc.moveTo(ML, fy).lineTo(PW - MR, fy).lineWidth(0.5).strokeColor(C_GRIS_LIN).stroke();
        doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(7.5)
           .text('Opciones Sacimex SA de CV SOFOM ENR — Documento generado por el sistema ERP',
                 ML, fy + 7, { width: W - 80, align: 'left' });
        doc.fillColor(C_TEXTO2).font('Helvetica-Bold').fontSize(7.5)
           .text(`Página ${pageNum} de ${totalPages}`, PW - MR - 80, fy + 7, { width: 80, align: 'right' });
    };

    // ── Encabezado de tabla ─────────────────────────────────────────────────
    const drawTableHeader = (ty) => {
        let cx = ML;
        cols.forEach(col => {
            doc.rect(cx, ty, col.w, HEAD_H).fill(C_VERDE_O);
            doc.fillColor(C_BLANCO).font('Helvetica-Bold').fontSize(6.5)
               .text(col.label, cx + 3, ty + 4, { width: col.w - 6, align: 'left' });
            cx += col.w;
        });
        return ty + HEAD_H;
    };

    // ── Primera página ──────────────────────────────────────────────────────
    drawPageHeader();

    const ahora = new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' });
    let iy = HEADER_Y + 2;

    // Metadatos breves
    doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(8)
       .text(`Fecha de emisión: `, ML, iy, { continued: true })
       .fillColor(C_TEXTO).font('Helvetica-Bold')
       .text(ahora, { continued: false });

    doc.fillColor(C_TEXTO2).font('Helvetica').fontSize(8)
       .text(`Total de registros: `, ML, iy + 12, { continued: true })
       .fillColor(C_TEXTO).font('Helvetica-Bold')
       .text(`${rows.length}`, { continued: false });

    iy += 26;

    if (rows.length === 0) {
        doc.fillColor(C_TEXTO2).font('Helvetica-Oblique').fontSize(11)
           .text('No hay registros disponibles.', ML, iy + 20, { width: W, align: 'center' });
        const tp = doc.bufferedPageRange().count;
        for (let i = 0; i < tp; i++) { doc.switchToPage(i); drawPageFooter(i + 1, tp); }
        doc.end();
        return;
    }

    // ── Tabla ───────────────────────────────────────────────────────────────
    let ty = drawTableHeader(iy);
    let rowIndex = 0;

    rows.forEach(cellVals => {
        // Altura dinámica: estima líneas de la celda más larga
        const estimar = (txt, colW, fz = 7) => {
            const chars = Math.floor((colW - 6) / (fz * 0.55));
            return Math.max(1, Math.ceil((String(txt || '')).length / chars));
        };
        const maxLines = Math.max(...cellVals.map((v, i) => estimar(v, cols[i].w)));
        const rh = Math.max(ROW_H, maxLines * 9.5 + 6);

        if (ty + rh > PH - FOOTER_H - 6) {
            doc.addPage({ size: 'LETTER', layout: 'landscape', margin: 0 });
            drawPageHeader();
            ty = drawTableHeader(HEADER_Y + 2);
            rowIndex = 0;
        }

        const bgColor = (rowIndex % 2 === 0) ? C_BLANCO : C_GRIS_BG;
        doc.rect(ML, ty, W, rh).fill(bgColor);
        doc.moveTo(ML, ty + rh).lineTo(ML + W, ty + rh)
           .lineWidth(0.3).strokeColor(C_GRIS_LIN).stroke();

        let cx = ML;
        cols.forEach((col, ci) => {
            doc.fillColor(C_TEXTO).font('Helvetica').fontSize(7)
               .text(String(cellVals[ci] ?? '—'), cx + 3, ty + 5, {
                   width: col.w - 6,
                   height: rh - 6,
                   ellipsis: false,
                   lineBreak: true
               });
            doc.moveTo(cx + col.w, ty).lineTo(cx + col.w, ty + rh)
               .lineWidth(0.3).strokeColor(C_GRIS_LIN).stroke();
            cx += col.w;
        });

        ty += rh;
        rowIndex++;
    });

    // ── Pies en todas las páginas ───────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawPageFooter(i + 1, totalPages);
    }

    doc.end();
}

// ── RUTA: Directorio de Clientes ────────────────────────────────────────────
router.get('/clientes', verificarToken, autorizarModulo('reportes', ['ADMIN', 'CONTADOR'], 'puede_ver'), (req, res) => {
    const query = `
        SELECT p.nombre_razon_social, p.rfc, p.telefono, p.email_contacto,
               c.limite_credito, c.estatus, c.tipo_garantia
        FROM personas p
        INNER JOIN clientes c ON p.id = c.id_persona
        WHERE p.eliminado = FALSE ORDER BY p.nombre_razon_social ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en BD' });

        // W landscape = 792 - 36 - 36 = 720
        const cols = [
            { label: 'NOMBRE / RAZÓN SOCIAL', w: 200 },
            { label: 'RFC',                   w:  85 },
            { label: 'TELÉFONO',              w:  75 },
            { label: 'CORREO ELECTRÓNICO',    w: 155 },
            { label: 'LÍM. CRÉDITO',          w:  75 },
            { label: 'ESTATUS',               w:  65 },
            { label: 'GARANTÍA',              w:  65 },
        ]; // 200+85+75+155+75+65+65 = 720

        const rows = results.map(r => [
            r.nombre_razon_social || '—',
            r.rfc || '—',
            r.telefono || '—',
            r.email_contacto || '—',
            r.limite_credito != null
                ? `$${Number(r.limite_credito).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—',
            r.estatus || '—',
            r.tipo_garantia || '—',
        ]);

        const fecha = new Date().toISOString().split('T')[0];
        generarPDFInstitucional({
            res,
            titulo:    'DIRECTORIO DE CLIENTES',
            subtitulo: `Cartera completa de clientes — Exportado el ${fecha}`,
            cols,
            rows,
            filename:  `Clientes_Sacimex_${fecha}.pdf`,
        });

        registrarBitacora(req.usuario.id, 'EXPORTAR_REPORTE', 'Descargó reporte PDF de Clientes', req);
    });
});

// ── RUTA: Padrón de Inversores ───────────────────────────────────────────────
router.get('/inversores', verificarToken, autorizarModulo('reportes', ['ADMIN', 'CONTADOR'], 'puede_ver'), (req, res) => {
    const query = `
        SELECT p.nombre_razon_social, p.rfc, p.telefono,
               COALESCE(NULLIF(i.clabe_bancaria,''), NULLIF(i.numero_cuenta,'')) AS clabe_bancaria,
               i.numero_cuenta,
               i.banco,
               IF(i.estatus_activo=1,'Activo','Inactivo') AS estatus
        FROM personas p
        INNER JOIN inversores i ON p.id = i.id_persona
        WHERE p.eliminado = FALSE ORDER BY p.nombre_razon_social ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });

        // 720 total
        const cols = [
            { label: 'INVERSOR / CAPITALISTA', w: 200 },
            { label: 'RFC',                    w:  85 },
            { label: 'TELÉFONO',               w:  75 },
            { label: 'CLABE / NO. CUENTA',     w: 155 },
            { label: 'BANCO',                  w: 145 },
            { label: 'ESTATUS',                w:  60 },
        ]; // 200+85+75+155+145+60 = 720

        const rows = results.map(r => [
            r.nombre_razon_social || '—',
            r.rfc || '—',
            r.telefono || '—',
            r.clabe_bancaria || r.numero_cuenta || '—',
            r.banco || '—',
            r.estatus || '—',
        ]);

        const fecha = new Date().toISOString().split('T')[0];
        generarPDFInstitucional({
            res,
            titulo:    'PADRÓN DE INVERSORES',
            subtitulo: `Lista completa de capitalistas y datos bancarios — Exportado el ${fecha}`,
            cols,
            rows,
            filename:  `Inversores_Sacimex_${fecha}.pdf`,
        });

        registrarBitacora(req.usuario.id, 'EXPORTAR_REPORTE', 'Descargó reporte PDF de Inversores', req);
    });
});

// ── RUTA: Cuentas por Pagar — Proveedores ───────────────────────────────────
router.get('/proveedores', verificarToken, autorizarModulo('reportes', ['ADMIN', 'CONTADOR'], 'puede_ver'), (req, res) => {
    const query = `
        SELECT p.nombre_razon_social, p.rfc, p.telefono,
               pr.categoria, pr.numero_cuenta, pr.banco,
               IF(pr.estatus_activo=1,'Activo','Inactivo') AS estatus
        FROM personas p
        INNER JOIN proveedores pr ON p.id = pr.id_persona
        WHERE p.eliminado = FALSE ORDER BY p.nombre_razon_social ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });

        // 720 total
        const cols = [
            { label: 'PROVEEDOR / SERVICIO', w: 190 },
            { label: 'RFC',                  w:  85 },
            { label: 'CATEGORÍA',            w: 100 },
            { label: 'TELÉFONO',             w:  75 },
            { label: 'CUENTA / CLABE',       w: 145 },
            { label: 'BANCO',                w:  70 },
            { label: 'ESTATUS',              w:  55 },
        ]; // 190+85+100+75+145+70+55 = 720

        const rows = results.map(r => [
            r.nombre_razon_social || '—',
            r.rfc || '—',
            r.categoria || '—',
            r.telefono || '—',
            r.numero_cuenta || '—',
            r.banco || '—',
            r.estatus || '—',
        ]);

        const fecha = new Date().toISOString().split('T')[0];
        generarPDFInstitucional({
            res,
            titulo:    'CUENTAS POR PAGAR — PROVEEDORES',
            subtitulo: `Directorio de proveedores y cuentas receptoras — Exportado el ${fecha}`,
            cols,
            rows,
            filename:  `Proveedores_Sacimex_${fecha}.pdf`,
        });

        registrarBitacora(req.usuario.id, 'EXPORTAR_REPORTE', 'Descargó reporte PDF de Proveedores', req);
    });
});

module.exports = router;