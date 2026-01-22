// Middleware de autenticación simplificado - solo JWT

class AuthMiddleware {
    constructor(db) {
        this.db = db;
        this.jwtSecret = process.env.JWT_SECRET || 'bodega-secreto-2026';
        this.sessionTimeout = 15 * 60 * 1000; // 15 minutos en milisegundos
    }

    // Generar token JWT
    generateToken(usuario) {
        const jwt = require('jsonwebtoken');
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
        const jwt = require('jsonwebtoken');
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            return null;
        }
    }

    // Crear sesión en base de datos (opcional para logging)
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

    // Middleware para proteger rutas (simplificado)
    authenticate() {
        return async (req, res, next) => {
            try {
                const token = req.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return res.status(401).json({ 
                        error: 'Token no proporcionado',
                        redirect: '/login.html'
                    });
                }

                // Verificar solo el JWT (sin verificar en BD)
                const decoded = this.verifyToken(token);
                if (!decoded) {
                    return res.status(401).json({ 
                        error: 'Token inválido o expirado',
                        redirect: '/login.html'
                    });
                }

                // Obtener información del usuario desde el payload
                req.usuario = {
                    id: decoded.id,
                    nombre_usuario: decoded.nombre_usuario,
                    rol: decoded.rol,
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