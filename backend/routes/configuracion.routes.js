const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// ==========================================
// APIS DE CATÁLOGO DE CONCEPTOS DE PAGO
// ==========================================

router.get('/conceptos', verificarToken, (req, res) => {
    db.query('SELECT * FROM conceptos_pago ORDER BY id ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/conceptos', verificarToken, (req, res) => {
    const { clave, descripcion, uso_cfdi, metodo_pago, requiere_vobo, area_visto_bueno } = req.body;
    db.query('INSERT INTO conceptos_pago (clave, descripcion, uso_cfdi, metodo_pago, requiere_vobo, area_visto_bueno) VALUES (?, ?, ?, ?, ?, ?)', 
    [clave, descripcion, uso_cfdi || null, metodo_pago || null, requiere_vobo ? 1 : 0, requiere_vobo ? area_visto_bueno : null], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'La clave ya existe o hubo un error.' });
        registrarBitacora(req.usuario.id, 'CREAR_CONCEPTO', `Creo la cuenta de gasto: ${descripcion}`);
        res.json({ success: true, message: 'Concepto creado exitosamente.' });
    });
});

router.put('/conceptos/:clave', verificarToken, (req, res) => {
    const { descripcion, uso_cfdi, metodo_pago, requiere_vobo, area_visto_bueno } = req.body;
    db.query(`UPDATE conceptos_pago 
              SET descripcion = ?, 
                  uso_cfdi = COALESCE(?, uso_cfdi), 
                  metodo_pago = COALESCE(?, metodo_pago), 
                  requiere_vobo = ?, 
                  area_visto_bueno = ? 
              WHERE clave = ?`, 
    [descripcion, uso_cfdi, metodo_pago, requiere_vobo ? 1 : 0, requiere_vobo ? area_visto_bueno : null, req.params.clave], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_CONCEPTO', `Modifico la cuenta de gasto: ${descripcion}`);
        res.json({ success: true, message: 'Concepto actualizado.' });
    });
});

router.put('/conceptos/:clave/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE conceptos_pago SET estatus_activo = ? WHERE clave = ?', [estatus_activo, req.params.clave], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al cambiar estatus' });
        registrarBitacora(req.usuario.id, 'ESTATUS_CONCEPTO', `Cambio estatus del concepto ${req.params.clave} a ${estatus_activo ? 'Activo' : 'Inactivo'}`);
        res.json({ success: true, message: 'Estatus actualizado' });
    });
});

router.delete('/conceptos/:clave', verificarToken, (req, res) => {
    db.query('DELETE FROM conceptos_pago WHERE clave = ?', [req.params.clave], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este concepto ya fue usado en solicitudes pasadas.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_CONCEPTO', `Elimino la cuenta de gasto con clave: ${req.params.clave}`);
        res.json({ success: true, message: 'Concepto eliminado.' });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE BANCOS
// ==========================================

router.get('/bancos', verificarToken, (req, res) => {
    db.query('SELECT * FROM catalogo_bancos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/bancos', verificarToken, (req, res) => {
    const { nombre } = req.body;
    db.query('INSERT INTO catalogo_bancos (nombre) VALUES (?)', [nombre.toUpperCase().trim()], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El banco ya existe o hubo un error.' });
        registrarBitacora(req.usuario.id, 'CREAR_BANCO', `Agrego el banco al catalogo: ${nombre}`);
        res.json({ success: true, message: 'Banco agregado exitosamente.' });
    });
});

router.put('/bancos/:id', verificarToken, (req, res) => {
    const { nombre } = req.body;
    db.query('UPDATE catalogo_bancos SET nombre = ? WHERE id = ?', [nombre.toUpperCase().trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_BANCO', `Modifico el banco ID ${req.params.id} a: ${nombre}`);
        res.json({ success: true, message: 'Banco actualizado.' });
    });
});

router.put('/bancos/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_bancos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_BANCO', `Cambio estatus del banco ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`);
        res.json({ success: true });
    });
});

router.delete('/bancos/:id', verificarToken, (req, res) => {
    db.query('DELETE FROM catalogo_bancos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este banco ya esta asignado a cuentas o proveedores.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_BANCO', `Elimino un banco del catalogo (ID: ${req.params.id})`);
        res.json({ success: true, message: 'Banco eliminado.' });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE DEPARTAMENTOS / AREAS
// ==========================================

router.get('/departamentos', verificarToken, (req, res) => {
    db.query('SELECT * FROM catalogo_departamentos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/departamentos', verificarToken, (req, res) => {
    const { nombre } = req.body;
    db.query('INSERT INTO catalogo_departamentos (nombre) VALUES (?)', [nombre.toUpperCase().trim()], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El departamento ya existe.' });
        registrarBitacora(req.usuario.id, 'CREAR_DEPTO', `Agrego el departamento: ${nombre}`);
        res.json({ success: true, message: 'Departamento agregado exitosamente.' });
    });
});

router.put('/departamentos/:id', verificarToken, (req, res) => {
    const { nombre } = req.body;
    db.query('UPDATE catalogo_departamentos SET nombre = ? WHERE id = ?', [nombre.toUpperCase().trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_DEPTO', `Modifico el depto ID ${req.params.id} a: ${nombre}`);
        res.json({ success: true, message: 'Departamento actualizado.' });
    });
});

router.put('/departamentos/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_departamentos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_DEPTO', `Cambio estatus del departamento ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`);
        res.json({ success: true });
    });
});

router.delete('/departamentos/:id', verificarToken, (req, res) => {
    db.query('DELETE FROM catalogo_departamentos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este departamento esta en uso por usuarios o reglas de VoBo.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_DEPTO', `Elimino un departamento (ID: ${req.params.id})`);
        res.json({ success: true, message: 'Departamento eliminado.' });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE PUESTOS
// ==========================================

router.get('/puestos', verificarToken, (req, res) => {
    db.query('SELECT * FROM catalogo_puestos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/puestos', verificarToken, (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('INSERT INTO catalogo_puestos (nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default) VALUES (?, ?, ?, ?, ?)', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El puesto ya existe.' });
        registrarBitacora(req.usuario.id, 'CREAR_PUESTO', `Agrego el puesto: ${nombre}`);
        res.json({ success: true, message: 'Puesto agregado exitosamente.' });
    });
});

router.put('/puestos/:id', verificarToken, (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('UPDATE catalogo_puestos SET nombre = ?, departamento_default = ?, nivel_default = ?, rol_default = ?, puede_solicitar_default = ? WHERE id = ?', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_PUESTO', `Modifico el puesto ID ${req.params.id} a: ${nombre}`);
        res.json({ success: true, message: 'Puesto actualizado.' });
    });
});

router.put('/puestos/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_puestos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_PUESTO', `Cambio estatus del puesto ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`);
        res.json({ success: true });
    });
});

router.delete('/puestos/:id', verificarToken, (req, res) => {
    db.query('SELECT nombre FROM catalogo_puestos WHERE id = ?', [req.params.id], (err, results) => {
        const nombrePuesto = (results && results.length > 0) ? results[0].nombre : 'Puesto Desconocido';
        
        db.query('DELETE FROM catalogo_puestos WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este puesto esta en uso.' });
            registrarBitacora(req.usuario.id, 'ELIMINAR_PUESTO', `Elimino el puesto: ${nombrePuesto}`);
            res.json({ success: true, message: 'Puesto eliminado.' });
        });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE CATEGORIAS DE PROVEEDOR
// ==========================================

router.get('/categorias', verificarToken, (req, res) => {
    db.query('SELECT * FROM catalogo_categorias_proveedor ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al cargar categorias' });
        res.json({ success: true, data: results });
    });
});

router.post('/categorias', verificarToken, (req, res) => {
    const { nombre } = req.body;
    db.query('INSERT INTO catalogo_categorias_proveedor (nombre) VALUES (?)', [nombre.toUpperCase().trim()], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'La categoria ya existe o hubo un error.' });
        registrarBitacora(req.usuario.id, 'CREAR_CATEGORIA', `Agrego la categoria: ${nombre}`);
        res.json({ success: true, message: 'Categoria agregada exitosamente.' });
    });
});

router.put('/categorias/:id', verificarToken, (req, res) => {
    const { nombre } = req.body;
    db.query('UPDATE catalogo_categorias_proveedor SET nombre = ? WHERE id = ?', [nombre.toUpperCase().trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_CATEGORIA', `Modifico la categoria ID ${req.params.id} a: ${nombre}`);
        res.json({ success: true, message: 'Categoria actualizada.' });
    });
});

router.put('/categorias/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    
    db.query('SELECT nombre FROM catalogo_categorias_proveedor WHERE id = ?', [req.params.id], (err, results) => {
        const nombreCat = (results && results.length > 0) ? results[0].nombre : 'Categoria Desconocida';
        
        db.query('UPDATE catalogo_categorias_proveedor SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'ESTATUS_CATEGORIA', `Cambio estatus de la categoria '${nombreCat}' a ${estatus_activo ? 'Activo' : 'Inactivo'}`);
            res.json({ success: true });
        });
    });
});

router.delete('/categorias/:id', verificarToken, (req, res) => {
    db.query('SELECT nombre FROM catalogo_categorias_proveedor WHERE id = ?', [req.params.id], (err, results) => {
        const nombreCat = (results && results.length > 0) ? results[0].nombre : 'Categoria';
        
        db.query('DELETE FROM catalogo_categorias_proveedor WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque esta categoria esta en uso por algunos proveedores.' });
            registrarBitacora(req.usuario.id, 'ELIMINAR_CATEGORIA', `Elimino la categoria: ${nombreCat}`);
            res.json({ success: true, message: 'Categoria eliminada.' });
        });
    });
});

module.exports = router;