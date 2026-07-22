const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');

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
    SELECT b.id, b.accion, b.detalle, b.fecha, IFNULL(u.username, 'SISTEMA') as usuario
    FROM bitacora_auditoria b
    LEFT JOIN usuarios u ON b.id_usuario = u.id
`;

const SELECT_CON_TECNICO = `
    SELECT b.id, b.accion, b.detalle, b.fecha,
           b.ip_address, b.metodo_http, b.ruta,
           IFNULL(u.username, 'SISTEMA') as usuario
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

router.get('/', verificarToken, (req, res) => {
    consultarBitacora(' ORDER BY b.fecha DESC', [], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al obtener la bitácora.' });
        res.json({ success: true, data: results });
    });
});

router.get('/reporte/pdf', verificarToken, (req, res) => {
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
                if (log.ip_address) {
                    doc.font('Helvetica-Bold').text(`Conectado desde: `, { continued: true }).font('Helvetica').text(log.ip_address);
                }
                doc.moveDown(0.5);

                doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
                doc.moveDown(0.5);
            });
        }

        doc.end();
        registrarBitacora(req.usuario.id, 'EXPORTAR_AUDITORIA', `Descargó reporte PDF de auditoría (${periodo})`, req);
    });
});


// Bitacora TECNICA de accesos: literalmente cada peticion al API (incluidas lecturas),
// capturada automaticamente por el middleware logAccesos.js sin depender de logs manuales.
// Solo ADMIN puede consultarla: es informacion muy detallada (IP, ruta, duracion, etc).
router.get('/accesos', verificarToken, (req, res) => {
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