const express = require('express');
const router = express.Router();
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');

router.get('/', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false, message: 'No autorizado' });

    const fecha = new Date().toISOString().split('T')[0];
    const backupPath = path.join(__dirname, `../Respaldo_Sacimex_${fecha}.sql`);

    try {
        await mysqldump({
            connection: {
                host: 'localhost',
                user: 'root',
                password: '12345',
                database: 'sacimex_db'
            },
            dumpToFile: backupPath,
        });

        res.download(backupPath, `Respaldo_Sacimex_${fecha}.sql`, (err) => {
            if (err) console.error("Error enviando el archivo:", err);
            
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
            }
        });
        
        registrarBitacora(req.usuario.id, 'RESPALDO_BD', 'Descargó una copia completa de la base de datos (.sql)');

    } catch (error) {
        console.error("Error generando respaldo:", error);
        res.status(500).json({ success: false, message: 'Error al generar el respaldo' });
    }
});

module.exports = router;