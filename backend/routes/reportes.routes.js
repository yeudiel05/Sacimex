const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const ExcelJS = require('exceljs');

const setupExcelWorksheet = (workbook, sheetName, columns) => {
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true, color: { arg: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { arg: 'FF10D440' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    return worksheet;
};

router.get('/clientes', verificarToken, async (req, res) => {
    const query = `
        SELECT p.nombre_razon_social AS nombre, p.rfc, p.telefono, p.email_contacto, 
               c.limite_credito, c.estatus, c.tipo_garantia 
        FROM personas p 
        INNER JOIN clientes c ON p.id = c.id_persona 
        WHERE p.eliminado = FALSE ORDER BY p.nombre_razon_social ASC
    `;

    db.query(query, async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en BD' });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Opciones Sacimex';

        const worksheet = setupExcelWorksheet(workbook, 'Directorio Clientes', [
            { header: 'NOMBRE / RAZÓN SOCIAL', key: 'nombre', width: 35 },
            { header: 'RFC', key: 'rfc', width: 15 },
            { header: 'TELÉFONO', key: 'telefono', width: 15 },
            { header: 'CORREO', key: 'email_contacto', width: 25 },
            { header: 'LÍMITE CRÉDITO', key: 'limite_credito', width: 18 },
            { header: 'ESTATUS', key: 'estatus', width: 15 },
            { header: 'GARANTÍA', key: 'tipo_garantia', width: 15 }
        ]);

        results.forEach(row => {
            worksheet.addRow({ ...row, limite_credito: Number(row.limite_credito) });
        });

        worksheet.getColumn('limite_credito').numFmt = '"$"#,##0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Clientes_Sacimex.xlsx');

        await workbook.xlsx.write(res);
        registrarBitacora(req.usuario.id, 'EXPORTAR_REPORTE', 'Descargó reporte de Clientes en Excel');
        res.end();
    });
});

router.get('/inversores', verificarToken, async (req, res) => {
    const query = `
        SELECT p.nombre_razon_social AS nombre, p.rfc, p.telefono, i.clabe_bancaria, i.banco, 
               IF(i.estatus_activo=1, 'Activo', 'Inactivo') as estatus 
        FROM personas p 
        INNER JOIN inversores i ON p.id = i.id_persona 
        WHERE p.eliminado = FALSE ORDER BY p.nombre_razon_social ASC
    `;

    db.query(query, async (err, results) => {
        if (err) return res.status(500).json({ success: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = setupExcelWorksheet(workbook, 'Inversores', [
            { header: 'INVERSOR', key: 'nombre', width: 35 },
            { header: 'RFC', key: 'rfc', width: 15 },
            { header: 'TELÉFONO', key: 'telefono', width: 15 },
            { header: 'CLABE', key: 'clabe_bancaria', width: 22 },
            { header: 'BANCO', key: 'banco', width: 20 },
            { header: 'ESTATUS', key: 'estatus', width: 12 }
        ]);

        results.forEach(row => worksheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Inversores_Sacimex.xlsx');
        await workbook.xlsx.write(res);
        registrarBitacora(req.usuario.id, 'EXPORTAR_REPORTE', 'Descargó reporte de Inversores');
        res.end();
    });
});

router.get('/proveedores', verificarToken, async (req, res) => {
    const query = `
        SELECT p.nombre_razon_social AS nombre, p.rfc, p.telefono, pr.categoria, 
               pr.cuenta_bancaria, pr.banco, IF(pr.estatus_activo=1, 'Activo', 'Inactivo') as estatus 
        FROM personas p 
        INNER JOIN proveedores pr ON p.id = pr.id_persona 
        WHERE p.eliminado = FALSE ORDER BY p.nombre_razon_social ASC
    `;

    db.query(query, async (err, results) => {
        if (err) return res.status(500).json({ success: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = setupExcelWorksheet(workbook, 'Proveedores', [
            { header: 'PROVEEDOR / SERVICIO', key: 'nombre', width: 35 },
            { header: 'RFC', key: 'rfc', width: 15 },
            { header: 'CATEGORÍA', key: 'categoria', width: 20 },
            { header: 'TELÉFONO', key: 'telefono', width: 15 },
            { header: 'CUENTA / CLABE', key: 'cuenta_bancaria', width: 22 },
            { header: 'BANCO', key: 'banco', width: 20 },
            { header: 'ESTATUS', key: 'estatus', width: 12 }
        ]);

        results.forEach(row => worksheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Proveedores_Sacimex.xlsx');
        await workbook.xlsx.write(res);
        registrarBitacora(req.usuario.id, 'EXPORTAR_REPORTE', 'Descargó reporte de Proveedores');
        res.end();
    });
});

module.exports = router;