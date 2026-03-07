const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT u.id as id_usuario, u.username, u.rol, u.estatus_activo, 
               e.puesto, e.departamento, 
               p.id as id_persona, p.nombre_razon_social AS nombre, p.email_contacto AS email, p.telefono, p.rfc
        FROM usuarios u
        INNER JOIN empleados e ON u.id_empleado = e.id_persona
        INNER JOIN personas p ON e.id_persona = p.id
        WHERE p.eliminado = FALSE
        ORDER BY u.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { nombre, rfc, telefono, email, puesto, departamento, username, password, rol } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });

        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, telefono, email_contacto) VALUES ("FISICA", ?, ?, ?, ?)',
            [nombre, rfc, telefono, email], (err, resultPersona) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error: El RFC ya existe o datos inválidos.' }));

                const idPersona = resultPersona.insertId;

                db.query('INSERT INTO empleados (id_persona, puesto, departamento, fecha_ingreso) VALUES (?, ?, ?, CURDATE())',
                    [idPersona, puesto, departamento], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error al registrar empleado.' }));

                        db.query('INSERT INTO usuarios (id_empleado, username, password_hash, rol) VALUES (?, ?, ?, ?)',
                            [idPersona, username, password, rol], (err) => {
                                if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error: El Nombre de Usuario ya está en uso.' }));

                                db.commit(err => {
                                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                                    registrarBitacora(req.usuario.id, 'CREAR_USUARIO', `Se creó el usuario ${username} con rol ${rol}`);
                                    res.json({ success: true, message: 'Usuario creado exitosamente.' });
                                });
                            });
                    });
            });
    });
});

router.put('/:id_usuario', verificarToken, (req, res) => {
    const { id_usuario } = req.params;
    const { nombre, rfc, telefono, email, puesto, departamento, username, password, rol, id_persona } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('UPDATE personas SET nombre_razon_social=?, rfc=?, telefono=?, email_contacto=? WHERE id=?',
            [nombre, rfc, telefono, email, id_persona], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'RFC duplicado.' }));

                db.query('UPDATE empleados SET puesto=?, departamento=? WHERE id_persona=?',
                    [puesto, departamento, id_persona], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        let queryUser = 'UPDATE usuarios SET username=?, rol=? WHERE id=?';
                        let paramsUser = [username, rol, id_usuario];

                        if (password && password.trim() !== '') {
                            queryUser = 'UPDATE usuarios SET username=?, rol=?, password_hash=? WHERE id=?';
                            paramsUser = [username, rol, password, id_usuario];
                        }

                        db.query(queryUser, paramsUser, (err) => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Usuario ya en uso.' }));

                            db.commit(err => {
                                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                                registrarBitacora(req.usuario.id, 'EDITAR_USUARIO', `Se editó al usuario ID ${id_usuario}`);
                                res.json({ success: true, message: 'Usuario actualizado correctamente.' });
                            });
                        });
                    });
            });
    });
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE usuarios SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.delete('/:id_persona', verificarToken, (req, res) => {
    db.query('UPDATE personas SET eliminado = TRUE WHERE id = ?', [req.params.id_persona], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

module.exports = router;