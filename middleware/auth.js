const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthMiddleware {
    constructor(db) {
        this.db = db;
        this.jwtSecret = process.env.JWT_SECRET || 'bodega-secreto-2026';
        this.sessionTimeout = 15 * 60 * 1000; // 15 minutos en milisegundos
    }

    // Hash de contraseña
    async hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }

    // Verificar contraseña
    async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    // Generar token JWT
    generateToken(usuario) {
        const payload = {
            id: usuario.id,
            nombre_usuario: usuario.nombre_usuario,
            rol: usuario.rol
        };
        
        return jwt.sign(payload, this.jwtSecret, { 
            expiresIn: '15m',
            issuer: 'sistema-bodega',
            subject: usuario.id.toString()
        });
    }

    // Verificar token JWT
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            return null;
        }
    }

    // Crear sesión en base de datos
    async createSession(usuarioId, token, ipAddress, userAgent) {
        const fechaExpiracion = new Date(Date.now() + this.sessionTimeout).toISOString();
        
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO sesiones (usuario_id, token, fecha_expiracion, ip_address, user_agent, activa)
                VALUES (?, ?, ?, ?, ?, 1)
            `;
            
            this.db.run(query, [usuarioId, token, fechaExpiracion, ipAddress, userAgent], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, token });
                }
            });
        });
    }

    // Verificar sesión activa
    async verifySession(token) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT s.*, u.nombre_usuario, u.nombre_completo, u.rol, u.departamento
                FROM sesiones s
                JOIN usuarios u ON s.usuario_id = u.id
                WHERE s.token = ? AND s.activa = 1 AND s.fecha_expiracion > datetime('now')
            `;
            
            this.db.get(query, [token], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Eliminar sesión (logout)
    async invalidateSession(token) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE sesiones SET activa = 0 WHERE token = ?';
            
            this.db.run(query, [token], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Limpiar sesiones expiradas
    async cleanupExpiredSessions() {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE sesiones 
                SET activa = 0 
                WHERE fecha_expiracion <= datetime('now') AND activa = 1
            `;
            
            this.db.run(query, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Middleware para proteger rutas
    authenticate() {
        return async (req, res, next) => {
            try {
                // Limpiar sesiones expiradas
                await this.cleanupExpiredSessions();

                const token = req.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return res.status(401).json({ 
                        error: 'Token no proporcionado',
                        redirect: '/login.html'
                    });
                }

                // Verificar token JWT
                const decoded = this.verifyToken(token);
                if (!decoded) {
                    return res.status(401).json({ 
                        error: 'Token inválido o expirado',
                        redirect: '/login.html'
                    });
                }

                // Verificar sesión en base de datos
                const session = await this.verifySession(token);
                if (!session) {
                    return res.status(401).json({ 
                        error: 'Sesión no válida o expirada',
                        redirect: '/login.html'
                    });
                }

                // Agregar información del usuario a la request
                req.usuario = {
                    id: session.usuario_id,
                    nombre_usuario: session.nombre_usuario,
                    nombre_completo: session.nombre_completo,
                    rol: session.rol,
                    departamento: session.departamento,
                    token: token
                };

                next();
            } catch (error) {
                console.error('Error en autenticación:', error);
                res.status(500).json({ 
                    error: 'Error en autenticación',
                    redirect: '/login.html'
                });
            }
        };
    }

    // Middleware para verificar roles
    authorize(rolesPermitidos = []) {
        return (req, res, next) => {
            if (!req.usuario) {
                return res.status(401).json({ error: 'No autenticado' });
            }

            if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(req.usuario.rol)) {
                return res.status(403).json({ 
                    error: 'No tienes permisos para realizar esta acción' 
                });
            }

            next();
        };
    }
}

module.exports = AuthMiddleware;