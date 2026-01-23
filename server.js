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
let db = new sqlite3.Database('./database/herramientas.db', (err) => {
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
let auth = new AuthMiddleware(db);

// Inicializar tablas de autenticación
function initializeAuthTables() {
    const fs = require('fs');
    const authSchemaPath = path.join(__dirname, 'database/auth_schema.sql');
    
    if (fs.existsSync(authSchemaPath)) {
        // Sólo ejecutar los inserts de usuarios si la tabla usuarios no existe o está vacía.
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'", [], (err, tableRow) => {
            if (err) {
                console.error('Error comprobando tabla usuarios:', err.message);
                return;
            }

            const authSchema = fs.readFileSync(authSchemaPath, 'utf8');

            if (!tableRow) {
                // Tabla no existe: ejecutar todo el script (crea tabla + inserts)
                db.exec(authSchema, (err2) => {
                    if (err2) {
                        console.error('Error inicializando tablas de autenticación:', err2.message);
                    } else {
                        console.log('Tablas de autenticación inicializadas correctamente (creadas)');
                    }
                });
            } else {
                // Tabla existe: comprobar si tiene filas
                db.get('SELECT COUNT(*) as count FROM usuarios', [], (err3, countRow) => {
                    if (err3) {
                        console.error('Error contando usuarios:', err3.message);
                        return;
                    }

                    if (countRow && countRow.count === 0) {
                        // Ejecutar el script para insertar usuarios por defecto
                        db.exec(authSchema, (err4) => {
                            if (err4) {
                                console.error('Error insertando usuarios por defecto:', err4.message);
                            } else {
                                console.log('Usuarios por defecto insertados');
                            }
                        });
                    } else {
                        console.log('Tabla usuarios ya contiene datos, no se insertan usuarios por defecto');
                    }
                });
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
app.get('/api/herramientas/:id', auth.authenticate(), (req, res) => {
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
app.post('/api/herramientas', auth.authenticate(), auth.authorize(['admin', 'supervisor']), (req, res) => {
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
app.put('/api/herramientas/:id', auth.authenticate(), (req, res) => {
    const { id } = req.params;
    const { codigo, nombre, categoria_id, stock_total, en_bodega, prestadas, estado } = req.body;
    
    const query = `
        UPDATE herramientas 
        SET codigo = ?, nombre = ?, categoria_id = ?, stock_total = ?, 
            en_bodega = ?, prestadas = ?, estado = ?
        WHERE id = ?
    `;
    
    // Obtener valores actuales para calcular en_bodega/prestadas si no vienen en la petición
    req.db.get('SELECT en_bodega as en_bodega_actual, prestadas as prestadas_actual FROM herramientas WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!row) {
            res.status(404).json({ error: 'Herramienta no encontrada' });
            return;
        }

        const enBodegaActual = typeof row.en_bodega_actual === 'number' ? row.en_bodega_actual : 0;
        const prestadasActual = typeof row.prestadas_actual === 'number' ? row.prestadas_actual : 0;

        // Si el cliente no envió en_bodega, ajustarlo razonablemente:
        // - Si stock_total cambia y es menor que en_bodega_actual, limitar en_bodega al nuevo stock_total.
        // - Si no hay stock_total proporcionado, conservar el valor actual.
        let enBodegaFinal;
        if (typeof en_bodega !== 'undefined' && en_bodega !== null) {
            enBodegaFinal = en_bodega;
        } else if (typeof stock_total === 'number') {
            enBodegaFinal = Math.min(enBodegaActual, stock_total);
        } else {
            enBodegaFinal = enBodegaActual;
        }

        const prestadasFinal = (typeof prestadas !== 'undefined' && prestadas !== null) ? prestadas : prestadasActual;

        req.db.run(query, [codigo, nombre, categoria_id, stock_total, enBodegaFinal, prestadasFinal, estado, id], function(err2) {
            if (err2) {
                res.status(500).json({ error: err2.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Herramienta no encontrada' });
                return;
            }
            res.json({ message: 'Herramienta actualizada exitosamente' });
        });
    });
});

// Eliminar herramienta (solo si no tiene préstamos activos)
app.delete('/api/herramientas/:id', auth.authenticate(), auth.authorize(['admin', 'supervisor']), (req, res) => {
    const { id } = req.params;

    // Verificar si existe algún préstamo activo con esta herramienta
    const checkQuery = 'SELECT COUNT(*) as count FROM prestamos WHERE herramienta_id = ? AND estado = "Activo"';
    req.db.get(checkQuery, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (row && row.count > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: herramienta con préstamos activos' });
        }

        const deleteQuery = 'DELETE FROM herramientas WHERE id = ?';
        req.db.run(deleteQuery, [id], function(err2) {
            if (err2) {
                res.status(500).json({ error: err2.message });
                return;
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Herramienta no encontrada' });
            }

            res.json({ message: 'Herramienta eliminada exitosamente' });
        });
    });
});

// ===== EXPORTS =====
// Exportar inventario como CSV (compatible con Excel)
app.get('/export/inventario.csv', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    const query = `
        SELECT h.id, h.codigo, h.nombre, c.nombre as categoria, h.stock_total, h.en_bodega, h.prestadas, h.estado
        FROM herramientas h
        LEFT JOIN categorias c ON h.categoria_id = c.id
        ORDER BY c.nombre, h.nombre
    `;
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).send('Error generando CSV: ' + err.message);
            return;
        }

        // Construir CSV
        const headers = ['id','codigo','nombre','categoria','stock_total','en_bodega','prestadas','estado'];
        const csvLines = [headers.join(',')];
        rows.forEach(r => {
            const esc = v => {
                if (v === null || v === undefined) return '';
                const s = String(v).replace(/"/g, '""');
                return `"${s}"`;
            };
            csvLines.push([r.id, r.codigo, r.nombre, r.categoria, r.stock_total, r.en_bodega, r.prestadas, r.estado].map(esc).join(','));
        });

        const csv = csvLines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inventario.csv"');
        res.send(csv);
    });
});

// Exportar préstamos como CSV
app.get('/export/prestamos.csv', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    const query = `
        SELECT p.id, p.codigo_prestamo, p.herramienta_id, h.nombre as herramienta, p.solicitante_id, s.nombre as solicitante,
               p.cantidad, p.fecha_salida, p.fecha_retorno, p.estado
        FROM prestamos p
        JOIN herramientas h ON p.herramienta_id = h.id
        JOIN solicitantes s ON p.solicitante_id = s.id
        ORDER BY p.fecha_salida DESC
    `;
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).send('Error generando CSV: ' + err.message);
            return;
        }

        const headers = ['id','codigo_prestamo','herramienta_id','herramienta','solicitante_id','solicitante','cantidad','fecha_salida','fecha_retorno','estado'];
        const csvLines = [headers.join(',')];
        rows.forEach(r => {
            const esc = v => {
                if (v === null || v === undefined) return '';
                const s = String(v).replace(/"/g, '""');
                return `"${s}"`;
            };
            csvLines.push([r.id, r.codigo_prestamo, r.herramienta_id, r.herramienta, r.solicitante_id, r.solicitante, r.cantidad, r.fecha_salida, r.fecha_retorno, r.estado].map(esc).join(','));
        });

        const csv = csvLines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="prestamos.csv"');
        res.send(csv);
    });
});

// Exportar reporte completo a XLSX (3 hojas)
const ExcelJS = require('exceljs');
app.get('/export/report.xlsx', auth.authenticate(), auth.authorize(['admin','supervisor']), async (req, res) => {
    try {
        // Inventario
        const invQuery = `
            SELECT h.id, h.codigo, h.nombre, c.nombre as categoria, h.stock_total, h.en_bodega, h.prestadas, h.estado
            FROM herramientas h
            LEFT JOIN categorias c ON h.categoria_id = c.id
            ORDER BY c.nombre, h.nombre
        `;
        const prestamosQuery = `
            SELECT p.id, p.codigo_prestamo, p.herramienta_id, h.nombre as herramienta, p.solicitante_id, s.nombre as solicitante,
                   p.cantidad, p.fecha_salida, p.fecha_retorno, p.estado
            FROM prestamos p
            JOIN herramientas h ON p.herramienta_id = h.id
            JOIN solicitantes s ON p.solicitante_id = s.id
            ORDER BY p.fecha_salida DESC
        `;
        const devolucionesQuery = `
            SELECT d.id, d.codigo_devolucion, d.prestamo_id, d.herramienta_id, d.cantidad, d.fecha_devolucion, d.dias_uso, d.estado_herramienta, d.observaciones
            FROM devoluciones d
            ORDER BY d.fecha_devolucion DESC
        `;

        const invRows = await new Promise((resolve, reject) => {
            req.db.all(invQuery, [], (err, rows) => err ? reject(err) : resolve(rows));
        });
        const prestRows = await new Promise((resolve, reject) => {
            req.db.all(prestamosQuery, [], (err, rows) => err ? reject(err) : resolve(rows));
        });
        const devRows = await new Promise((resolve, reject) => {
            req.db.all(devolucionesQuery, [], (err, rows) => err ? reject(err) : resolve(rows));
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema Bodega';
        workbook.created = new Date();

        const wsInv = workbook.addWorksheet('Inventario');
        wsInv.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Codigo', key: 'codigo', width: 15 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Categoria', key: 'categoria', width: 20 },
            { header: 'Stock Total', key: 'stock_total', width: 12 },
            { header: 'En Bodega', key: 'en_bodega', width: 12 },
            { header: 'Prestadas', key: 'prestadas', width: 10 },
            { header: 'Estado', key: 'estado', width: 12 }
        ];
        invRows.forEach(r => wsInv.addRow(r));

        const wsPrest = workbook.addWorksheet('Prestamos');
        wsPrest.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Codigo', key: 'codigo_prestamo', width: 18 },
            { header: 'Herramienta', key: 'herramienta', width: 30 },
            { header: 'Solicitante', key: 'solicitante', width: 25 },
            { header: 'Cantidad', key: 'cantidad', width: 10 },
            { header: 'Fecha Salida', key: 'fecha_salida', width: 18 },
            { header: 'Fecha Retorno', key: 'fecha_retorno', width: 18 },
            { header: 'Estado', key: 'estado', width: 12 }
        ];
        prestRows.forEach(r => wsPrest.addRow(r));

        const wsDev = workbook.addWorksheet('Devoluciones');
        wsDev.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Codigo Devolucion', key: 'codigo_devolucion', width: 20 },
            { header: 'Prestamo ID', key: 'prestamo_id', width: 12 },
            { header: 'Herramienta ID', key: 'herramienta_id', width: 12 },
            { header: 'Cantidad', key: 'cantidad', width: 10 },
            { header: 'Fecha Devolucion', key: 'fecha_devolucion', width: 18 },
            { header: 'Dias Uso', key: 'dias_uso', width: 10 },
            { header: 'Estado Herramienta', key: 'estado_herramienta', width: 16 },
            { header: 'Observaciones', key: 'observaciones', width: 40 }
        ];
        devRows.forEach(r => wsDev.addRow(r));

        const buffer = await workbook.xlsx.writeBuffer();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `report-${timestamp}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('Error generando XLSX:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===== BACKUP AUTOMÁTICO =====
const fs = require('fs');
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g,'-');
    const src = path.join(__dirname, 'database', 'herramientas.db');
    const dest = path.join(backupsDir, `herramientas-${timestamp}.db`);
    fs.copyFile(src, dest, err => {
        if (err) {
            console.error('Error creando backup:', err);
        } else {
            console.log('Backup creado:', dest);
        }
    });
}

// Exponer endpoint para crear backup manualmente
app.post('/backup', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    try {
        backupDatabase();
        res.json({ message: 'Backup iniciado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar backups disponibles (admin)
app.get('/backups', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    fs.readdir(backupsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const backups = files
            .filter(f => f.endsWith('.db'))
            .map(f => {
                const stat = fs.statSync(path.join(backupsDir, f));
                return { file: f, size: stat.size, mtime: stat.mtime };
            })
            .sort((a,b) => b.mtime - a.mtime);
        res.json(backups);
    });
});

// Restaurar backup (admin) - recibe { filename }
app.post('/restore', auth.authenticate(), auth.authorize(['admin']), (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'filename requerido' });
        const src = path.join(backupsDir, filename);
        if (!fs.existsSync(src)) return res.status(404).json({ error: 'Backup no encontrado' });

        // Cerrar conexión actual
        db.close((closeErr) => {
            if (closeErr) {
                console.error('Error cerrando DB antes de restore:', closeErr);
                return res.status(500).json({ error: closeErr.message });
            }

            const dest = path.join(__dirname, 'database', 'herramientas.db');
            fs.copyFile(src, dest, (copyErr) => {
                if (copyErr) {
                    console.error('Error copiando backup:', copyErr);
                    return res.status(500).json({ error: copyErr.message });
                }

                // Reabrir DB
                db = new sqlite3.Database(dest, (openErr) => {
                    if (openErr) {
                        console.error('Error reabriendo DB tras restore:', openErr);
                        return res.status(500).json({ error: openErr.message });
                    }
                    // Recreate auth middleware with new db
                    auth = new AuthMiddleware(db);
                    console.log('Backup restaurado y DB reabierta desde', filename);
                    res.json({ message: 'Backup restaurado correctamente' });
                });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Programar backup automático cada 24 horas (86400000 ms)
const BACKUP_INTERVAL_MS = process.env.BACKUP_INTERVAL_MS ? parseInt(process.env.BACKUP_INTERVAL_MS,10) : 24 * 60 * 60 * 1000;
setInterval(() => {
    console.log('Iniciando backup periódico de la base de datos...');
    backupDatabase();
}, BACKUP_INTERVAL_MS);

// ===== RUTAS DE CATEGORÍAS =====

app.get('/api/categorias', auth.authenticate(), (req, res) => {
    req.db.all('SELECT * FROM categorias ORDER BY nombre', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Crear nueva categoría (admin|supervisor)
app.post('/api/categorias', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre de categoría requerido' });

    const query = 'INSERT INTO categorias (nombre) VALUES (?)';
    req.db.run(query, [nombre], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: 'Categoría creada exitosamente' });
    });
});

// Actualizar categoría (admin|supervisor)
app.put('/api/categorias/:id', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const query = 'UPDATE categorias SET nombre = ? WHERE id = ?';
    req.db.run(query, [nombre, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json({ message: 'Categoría actualizada exitosamente' });
    });
});

// Eliminar categoría (admin|supervisor) - solo si no hay herramientas asociadas
app.delete('/api/categorias/:id', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    const { id } = req.params;
    const checkQuery = 'SELECT COUNT(*) as count FROM herramientas WHERE categoria_id = ?';
    req.db.get(checkQuery, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row && row.count > 0) return res.status(400).json({ error: 'No se puede eliminar: categoría con herramientas asociadas' });

        const delQuery = 'DELETE FROM categorias WHERE id = ?';
        req.db.run(delQuery, [id], function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
            res.json({ message: 'Categoría eliminada exitosamente' });
        });
    });
});

// ===== RUTAS DE PRESTAMOS =====

app.get('/api/prestamos', auth.authenticate(), (req, res) => {
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

app.get('/api/prestamos/activos', auth.authenticate(), (req, res) => {
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

app.post('/api/prestamos', auth.authenticate(), (req, res) => {
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

app.get('/api/devoluciones', auth.authenticate(), (req, res) => {
    const query = 'SELECT * FROM vista_historial_devoluciones ORDER BY fecha_devolucion DESC';
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/devoluciones', auth.authenticate(), (req, res) => {
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

app.get('/api/solicitantes', auth.authenticate(), (req, res) => {
    req.db.all('SELECT * FROM solicitantes ORDER BY nombre', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/solicitantes', auth.authenticate(), (req, res) => {
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

// Eliminar solicitante (evitar si tiene préstamos)
app.delete('/api/solicitantes/:id', auth.authenticate(), auth.authorize(['admin','supervisor']), (req, res) => {
    const { id } = req.params;
    console.log(`DELETE /api/solicitantes/${id} requested by user:`, req.usuario?.id);
    // Verificar si existen préstamos activos asociados (solo bloquea si hay préstamos en estado 'Activo')
    const checkQuery = 'SELECT COUNT(*) as count FROM prestamos WHERE solicitante_id = ? AND estado = "Activo"';
    req.db.get(checkQuery, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row && row.count > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: solicitante con préstamos activos' });
        }

        const delQuery = 'DELETE FROM solicitantes WHERE id = ?';
        req.db.run(delQuery, [id], function(err2) {
            if (err2) {
                res.status(500).json({ error: err2.message });
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Solicitante no encontrado' });
            }
            res.json({ message: 'Solicitante eliminado exitosamente' });
        });
    });
});

// ===== RUTA PARA REGISTRO DE USUARIOS/LOGIN SIMPLE =====

app.post('/api/registro', auth.authenticate(), (req, res) => {
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

app.get('/api/resumen', auth.authenticate(), (req, res) => {
    const query = 'SELECT * FROM vista_resumen_inventario ORDER BY categoria, nombre';
    
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/estadisticas', auth.authenticate(), (req, res) => {
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
app.post('/api/auth/login', async (req, res) => {
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
app.get('/api/auth/verify', auth.authenticate(), (req, res) => {
    res.json({
        valid: true,
        usuario: req.usuario
    });
});

// Logout
app.post('/api/auth/logout', auth.authenticate(), async (req, res) => {
    try {
        await auth.invalidateSession(req.usuario.token);
        res.json({ message: 'Sesión cerrada exitosamente' });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
});

// Obtener información del usuario actual
app.get('/api/auth/me', auth.authenticate(), (req, res) => {
    res.json({ usuario: req.usuario });
});

// Cambiar contraseña
app.post('/api/auth/change-password', auth.authenticate(), async (req, res) => {
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

// ===== RUTAS DE USUARIOS (administración) =====
// Listar usuarios (admin)
app.get('/api/usuarios', auth.authenticate(), auth.authorize(['admin']), (req, res) => {
    const query = 'SELECT id, nombre_usuario, email, nombre_completo, departamento, rol, activo, fecha_creacion FROM usuarios ORDER BY nombre_completo';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Obtener usuario por ID (admin)
app.get('/api/usuarios/:id', auth.authenticate(), auth.authorize(['admin']), (req, res) => {
    const { id } = req.params;
    console.log(`GET /api/usuarios/${id} requested by user:`, req.usuario?.id);
    const query = 'SELECT id, nombre_usuario, email, nombre_completo, departamento, rol, activo, fecha_creacion FROM usuarios WHERE id = ?';
    req.db.get(query, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(row);
    });
});

// Eliminar usuario (admin) - no permitir eliminarse a sí mismo
app.delete('/api/usuarios/:id', auth.authenticate(), auth.authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`DELETE /api/usuarios/${id} requested by user:`, req.usuario?.id);
        if (req.usuario && req.usuario.id.toString() === id.toString()) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
        }

        const delQuery = 'DELETE FROM usuarios WHERE id = ?';
        req.db.run(delQuery, [id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            res.json({ message: 'Usuario eliminado exitosamente' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar usuario (admin)
app.put('/api/usuarios/:id', auth.authenticate(), auth.authorize(['admin']), (req, res) => {
    const { id } = req.params;
    const { nombre_completo, email, departamento, rol, activo } = req.body;

    // No permitir que un admin se quite sus propios privilegios a sí mismo
    if (req.usuario && req.usuario.id.toString() === id.toString() && rol && rol !== req.usuario.rol) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }

    const query = `
        UPDATE usuarios
        SET nombre_completo = ?, email = ?, departamento = ?, rol = ?, activo = ?
        WHERE id = ?
    `;

    req.db.run(query, [nombre_completo, email, departamento, rol, activo ? 1 : 0, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario actualizado exitosamente' });
    });
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