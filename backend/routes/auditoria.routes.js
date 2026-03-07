const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');

router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT b.id, b.accion, b.detalle, b.fecha, 
               IFNULL(u.username, 'SISTEMA') as usuario
        FROM bitacora_auditoria b
        LEFT JOIN usuarios u ON b.id_usuario = u.id
        ORDER BY b.fecha DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al obtener la bitácora.' });
        res.json({ success: true, data: results });
    });
});

router.get('/reporte/pdf', verificarToken, (req, res) => {
    const { fechaInicio, fechaFin } = req.query;

    let query = `
        SELECT b.id, b.accion, b.detalle, b.fecha, 
               IFNULL(u.username, 'SISTEMA') as usuario
        FROM bitacora_auditoria b
        LEFT JOIN usuarios u ON b.id_usuario = u.id
        WHERE 1=1
    `;
    const queryParams = [];

    if (fechaInicio && fechaFin) {
        query += ` AND b.fecha BETWEEN ? AND ?`;
        queryParams.push(`${fechaInicio} 00:00:00`, `${fechaFin} 23:59:59`);
    }

    query += ` ORDER BY b.fecha DESC`;

    db.query(query, queryParams, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en BD' });

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-disposition', `attachment; filename=Auditoria_Sacimex_${fechaInicio || 'Completa'}.pdf`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // --- DISEÑO DEL PDF ---
        doc.fontSize(18).font('Helvetica-Bold').text('Reporte Oficial de Auditoría', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Opciones Sacimex (Control de Accesos y Operaciones)', { align: 'center' });
        doc.moveDown();

        const periodo = (fechaInicio && fechaFin) ? `Del ${fechaInicio} al ${fechaFin}` : 'Histórico Completo';
        doc.fontSize(10).font('Helvetica-Oblique').text(`Periodo evaluado: ${periodo}`, { align: 'center' });
        doc.text(`Fecha de emisión del reporte: ${new Date().toLocaleString('es-MX')}`, { align: 'center' });
        doc.moveDown(2);

        if (results.length === 0) {
            doc.font('Helvetica').fontSize(12).text('No se registraron movimientos en este periodo.', { align: 'center' });
        } else {
            results.forEach(log => {
                doc.fontSize(10).font('Helvetica-Bold').text(`[${new Date(log.fecha).toLocaleString('es-MX')}] Usuario: ${log.usuario}`);
                doc.font('Helvetica-Bold').text(`Acción: `, { continued: true }).font('Helvetica').text(log.accion.replace(/_/g, ' '));
                doc.font('Helvetica-Bold').text(`Detalle: `, { continued: true }).font('Helvetica').text(log.detalle);
                doc.moveDown(0.5);

                doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
                doc.moveDown(0.5);
            });
        }

        doc.end();
        registrarBitacora(req.usuario.id, 'EXPORTAR_AUDITORIA', `Descargó reporte PDF de auditoría (${periodo})`);
    });
});

module.exports = router;