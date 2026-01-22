const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const moment = require('moment');
const path = require('path');
const AuthMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a la base de datos
const db = new sqlite3.Database('./database/herramientas.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite');
        // Inicializar tablas de autenticación
        initializeAuthTables();
    }
});

// Middleware para manejar errores de base de datos
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Inicializar sistema de autenticación
const auth = new AuthMiddleware(db);

// Inicializar tablas de autenticación
function initializeAuthTables() {
    const fs = require('fs');
    const authSchemaPath = path.join(__dirname, 'database/auth_schema.sql');
    
    if (fs.existsSync(authSchemaPath)) {
        const authSchema = fs.readFileSync(authSchemaPath, 'utf8');
        db.exec(authSchema, (err) => {
            if (err) {
                console.error('Error inicializando tablas de autenticación:', err.message);
            } else {
                console.log('Tablas de autenticación inicializadas correctamente');
            }
        });
    }
}

// ===== RUTAS DE HERRAMIENTAS =====

// Obtener todas las herramientas
app.get('/api/herramientas', auth.authenticate(), (req, res) => {
    const query = `
        SELECT h.*, c.nombre as categoria_nombre 
        FROM herramientas h 
        LEFT JOIN categorias c ON h.categoria_id = c.id
        ORDER BY c.nombre, h.nombre
    `;
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Obtener herramienta por ID
auth.authenticate(), app.get /api/herramientas/:id', auth.authenticate(), (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT h.*, c.nombre as categoria_nombre 
        FROM herramientas h 
        LEFT JOIN categorias c ON h.categoria_id = c.id 
        WHERE h.id = ?
    `;
    
    req.db.get(query, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Herramienta no encontrada' });
            return;
        }
        res.json(row);
    });
});

// Crear nueva herramienta
auth.authenticate(), app.post /api/herramientas', auth.authenticate(), auth.authorize(['admin', 'supervisor']), (req, res) => {
    const { codigo, nombre, categoria_id, stock_total, estado = 'Activo' } = req.body;
    
    if (!codigo || !nombre || !categoria_id || !stock_total) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const query = `
        INSERT INTO herramientas (codigo, nombre, categoria_id, stock_total, en_bodega, prestadas, estado)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    `;
    
    req.db.run(query, [codigo, nombre, categoria_id, stock_total, stock_total, estado], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            id: this.lastID, 
            message: 'Herramienta creada exitosamente' 
        });
    });
});

// Actualizar herramienta
auth.authenticate(), app.put /api/herramientas/:id', (req, res) => {
    const { id } = req.params;
    const { codigo, nombre, categoria_id, stock_total, en_bodega, prestadas, estado } = req.body;
    
    const query = `
        UPDATE herramientas 
        SET codigo = ?, nombre = ?, categoria_id = ?, stock_total = ?, 
            en_bodega = ?, prestadas = ?, estado = ?
        WHERE id = ?
    `;
    
    req.db.run(query, [codigo, nombre, categoria_id, stock_total, en_bodega, prestadas, estado, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Herramienta no encontrada' });
            return;
        }
        res.json({ message: 'Herramienta actualizada exitosamente' });
    });
});

// ===== RUTAS DE CATEGORÍAS =====

auth.authenticate(), app.get /api/categorias', (req, res) => {
    req.db.all('SELECT * FROM categorias ORDER BY nombre', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// ===== RUTAS DE PRESTAMOS =====

auth.authenticate(), app.get /api/prestamos', (req, res) => {
    const query = `
        SELECT p.*, h.nombre as herramienta_nombre, h.codigo as herramienta_codigo,
               s.nombre as solicitante_nombre, s.departamento
        FROM prestamos p
        JOIN herramientas h ON p.herramienta_id = h.id
        JOIN solicitantes s ON p.solicitante_id = s.id
        ORDER BY p.fecha_salida DESC
    `;
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

auth.authenticate(), app.get /api/prestamos/activos', (req, res) => {
    const query = `
        SELECT p.*, h.nombre as herramienta_nombre, h.codigo as herramienta_codigo,
               s.nombre as solicitante_nombre, s.departamento
        FROM prestamos p
        JOIN herramientas h ON p.herramienta_id = h.id
        JOIN solicitantes s ON p.solicitante_id = s.id
        WHERE p.estado = 'Activo'
        ORDER BY p.fecha_salida DESC
    `;
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

auth.authenticate(), app.post /api/prestamos', (req, res) => {
    const { 
        herramienta_id, solicitante_id, cantidad, 
        fecha_salida, fecha_retorno, observaciones 
    } = req.body;
    
    if (!herramienta_id || !solicitante_id || !cantidad || !fecha_salida) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Generar código de préstamo único
    const codigo_prestamo = `PRES-${Date.now()}`;
    
    req.db.serialize(() => {
        req.db.run('BEGIN TRANSACTION');
        
        // Insertar préstamo
        const query = `
            INSERT INTO prestamos 
            (codigo_prestamo, herramienta_id, solicitante_id, cantidad, 
             fecha_salida, fecha_retorno, observaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        req.db.run(query, [codigo_prestamo, herramienta_id, solicitante_id, cantidad, 
                           fecha_salida, fecha_retorno, observaciones], function(err) {
            if (err) {
                req.db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Actualizar stock de herramienta
            const updateQuery = `
                UPDATE herramientas 
                SET en_bodega = en_bodega - ?, prestadas = prestadas + ?
                WHERE id = ? AND en_bodega >= ?
            `;
            
            req.db.run(updateQuery, [cantidad, cantidad, herramienta_id, cantidad], function(err2) {
                if (err2 || this.changes === 0) {
                    req.db.run('ROLLBACK');
                    res.status(400).json({ error: 'No hay suficiente stock disponible' });
                    return;
                }
                
                req.db.run('COMMIT');
                res.json({ 
                    id: this.lastID, 
                    codigo_prestamo,
                    message: 'Préstamo registrado exitosamente' 
                });
            });
        });
    });
});

// ===== RUTAS DE DEVOLUCIONES =====

auth.authenticate(), app.get /api/devoluciones', (req, res) => {
    const query = 'SELECT * FROM vista_historial_devoluciones ORDER BY fecha_devolucion DESC';
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

auth.authenticate(), app.post /api/devoluciones', (req, res) => {
    const { prestamo_id, cantidad, fecha_devolucion, estado_herramienta, observaciones } = req.body;
    
    if (!prestamo_id || !cantidad || !fecha_devolucion) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Generar código de devolución único
    const codigo_devolucion = `DEV-${Date.now()}`;
    
    req.db.serialize(() => {
        req.db.run('BEGIN TRANSACTION');
        
        // Obtener información del préstamo
        const prestamoQuery = 'SELECT * FROM prestamos WHERE id = ? AND estado = "Activo"';
        req.db.get(prestamoQuery, [prestamo_id], (err, prestamo) => {
            if (err || !prestamo) {
                req.db.run('ROLLBACK');
                res.status(404).json({ error: 'Préstamo no encontrado o ya devuelto' });
                return;
            }
            
            // Insertar devolución
            const dias_uso = moment(fecha_devolucion).diff(moment(prestamo.fecha_salida), 'days');
            
            const insertQuery = `
                INSERT INTO devoluciones 
                (codigo_devolucion, prestamo_id, herramienta_id, cantidad, 
                 fecha_devolucion, dias_uso, estado_herramienta, observaciones)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            req.db.run(insertQuery, [codigo_devolucion, prestamo_id, prestamo.herramienta_id, 
                                     cantidad, fecha_devolucion, dias_uso, 
                                     estado_herramienta || 'Buena', observaciones], function(err) {
                if (err) {
                    req.db.run('ROLLBACK');
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                // Actualizar stock de herramienta
                const updateQuery = `
                    UPDATE herramientas 
                    SET en_bodega = en_bodega + ?, prestadas = prestadas - ?
                    WHERE id = ?
                `;
                
                req.db.run(updateQuery, [cantidad, cantidad, prestamo.herramienta_id], function(err2) {
                    if (err2) {
                        req.db.run('ROLLBACK');
                        res.status(500).json({ error: err2.message });
                        return;
                    }
                    
                    // Manejar devolución parcial o total
                    if (cantidad >= prestamo.cantidad) {
                        // Devolución completa - marcar préstamo como completado
                        req.db.run('UPDATE prestamos SET estado = "Completado", cantidad = 0 WHERE id = ?', [prestamo_id]);
                    } else {
                        // Devolución parcial - reducir cantidad del préstamo
                        const nuevaCantidad = prestamo.cantidad - cantidad;
                        req.db.run('UPDATE prestamos SET cantidad = ? WHERE id = ?', [nuevaCantidad, prestamo_id]);
                    }
                    
                    req.db.run('COMMIT');
                    res.json({ 
                        id: this.lastID, 
                        codigo_devolucion,
                        message: 'Devolución registrada exitosamente' 
                    });
                });
            });
        });
    });
});

// ===== RUTAS DE SOLICITANTES =====

auth.authenticate(), app.get /api/solicitantes', (req, res) => {
    req.db.all('SELECT * FROM solicitantes ORDER BY nombre', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

auth.authenticate(), app.post /api/solicitantes', (req, res) => {
    const { nombre, departamento, telefono, email } = req.body;
    
    if (!nombre || !departamento) {
        return res.status(400).json({ error: 'Nombre y departamento son requeridos' });
    }
    
    const query = `
        INSERT INTO solicitantes (nombre, departamento, telefono, email)
        VALUES (?, ?, ?, ?)
    `;
    
    req.db.run(query, [nombre, departamento, telefono, email], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            id: this.lastID, 
            message: 'Solicitante creado exitosamente' 
        });
    });
});

// ===== RUTA PARA REGISTRO DE USUARIOS/LOGIN SIMPLE =====

auth.authenticate(), app.post /api/registro', (req, res) => {
    const { nombre, departamento, telefono, email, usuario, password } = req.body;
    
    if (!nombre || !departamento || !usuario || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Primero verificar si el usuario ya existe
    req.db.get('SELECT * FROM solicitantes WHERE nombre = ? OR email = ?', [nombre, email], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (existing) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }
        
        // Insertar nuevo solicitante
        const query = `
            INSERT INTO solicitantes (nombre, departamento, telefono, email)
            VALUES (?, ?, ?, ?)
        `;
        
        req.db.run(query, [nombre, departamento, telefono, email], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ 
                id: this.lastID, 
                message: 'Usuario registrado exitosamente',
                usuario: {
                    id: this.lastID,
                    nombre,
                    departamento,
                    telefono,
                    email
                }
            });
        });
    });
});

// ===== RUTAS DE REPORTES =====

auth.authenticate(), app.get /api/resumen', (req, res) => {
    const query = 'SELECT * FROM vista_resumen_inventario ORDER BY categoria, nombre';
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

auth.authenticate(), app.get /api/estadisticas', (req, res) => {
    const queries = {
        total_herramientas: 'SELECT COUNT(*) as count FROM herramientas',
        herramientas_activas: 'SELECT COUNT(*) as count FROM herramientas WHERE estado = "Activo"',
        herramientas_prestadas: 'SELECT SUM(prestadas) as count FROM herramientas',
        prestamos_activos: 'SELECT COUNT(*) as count FROM prestamos WHERE estado = "Activo"',
        total_devoluciones: 'SELECT COUNT(*) as count FROM devoluciones'
    };
    
    const stats = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        req.db.get(query, [], (err, row) => {
            if (!err && row) {
                stats[key] = row.count;
            }
            
            completed++;
            if (completed === totalQueries) {
                res.json(stats);
            }
        });
    });
});

// ===== RUTAS DE AUTENTICACIÓN =====

// Servir página de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login
auth.authenticate(), app.post /api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }
        
        // Buscar usuario en base de datos
        const query = `
            SELECT id, nombre_usuario, email, password_hash, nombre_completo, 
                   departamento, rol, activo
            FROM usuarios 
            WHERE (nombre_usuario = ? OR email = ?) AND activo = 1
        `;
        
        req.db.get(query, [username, username], async (err, usuario) => {
            if (err) {
                return res.status(500).json({ error: 'Error en el servidor' });
            }
            
            if (!usuario) {
                return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
            }
            
            // Verificar contraseña (para testing: todas las contraseñas son "temporal123")
            let passwordValid = false;
            
            // En producción, usar bcrypt
            // passwordValid = await auth.verifyPassword(password, usuario.password_hash);
            
            // Para testing/demo
            passwordValid = password === 'temporal123';
            
            if (!passwordValid) {
                return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
            }
            
            // Generar token
            const token = auth.generateToken(usuario);
            
            // Crear sesión
            try {
                const ipAddress = req.ip || req.connection.remoteAddress;
                const userAgent = req.get('User-Agent');
                
                await auth.createSession(usuario.id, token, ipAddress, userAgent);
                
                // Actualizar último acceso
                req.db.run(
                    'UPDATE usuarios SET fecha_ultimo_acceso = datetime("now") WHERE id = ?',
                    [usuario.id]
                );
                
                // Responder con token y datos del usuario (sin contraseña)
                const usuarioResponse = {
                    id: usuario.id,
                    nombre_usuario: usuario.nombre_usuario,
                    nombre_completo: usuario.nombre_completo,
                    departamento: usuario.departamento,
                    rol: usuario.rol
                };
                
                res.json({
                    message: 'Login exitoso',
                    token: token,
                    usuario: usuarioResponse
                });
                
            } catch (sessionError) {
                console.error('Error creando sesión:', sessionError);
                res.status(500).json({ error: 'Error al crear sesión' });
            }
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Verificar token
auth.authenticate(), app.get /api/auth/verify', auth.authenticate(), (req, res) => {
    res.json({
        valid: true,
        usuario: req.usuario
    });
});

// Logout
auth.authenticate(), app.post /api/auth/logout', auth.authenticate(), async (req, res) => {
    try {
        await auth.invalidateSession(req.usuario.token);
        res.json({ message: 'Sesión cerrada exitosamente' });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
});

// Obtener información del usuario actual
auth.authenticate(), app.get /api/auth/me', auth.authenticate(), (req, res) => {
    res.json({ usuario: req.usuario });
});

// Cambiar contraseña
auth.authenticate(), app.post /api/auth/change-password', auth.authenticate(), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Ambas contraseñas son requeridas' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }
        
        // Obtener usuario actual
        req.db.get(
            'SELECT password_hash FROM usuarios WHERE id = ?',
            [req.usuario.id],
            async (err, usuario) => {
                if (err || !usuario) {
                    return res.status(500).json({ error: 'Error obteniendo usuario' });
                }
                
                // Para testing, verificar con contraseña temporal
                let currentValid = currentPassword === 'temporal123';
                
                // En producción:
                // currentValid = await auth.verifyPassword(currentPassword, usuario.password_hash);
                
                if (!currentValid) {
                    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
                }
                
                // Generar hash de nueva contraseña
                // const newPasswordHash = await auth.hashPassword(newPassword);
                
                // Para testing, usar un hash simple
                const newPasswordHash = 'hashed-' + newPassword;
                
                // Actualizar contraseña
                req.db.run(
                    'UPDATE usuarios SET password_hash = ?, fecha_actualizacion = datetime("now") WHERE id = ?',
                    [newPasswordHash, req.usuario.id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Error actualizando contraseña' });
                        }
                        
                        res.json({ message: 'Contraseña actualizada exitosamente' });
                    }
                );
            }
        );
        
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// ===== RUTA PRINCIPAL =====

app.get('/', auth.authenticate(), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;