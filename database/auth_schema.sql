-- Extensión de la base de datos para autenticación

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    departamento VARCHAR(50) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
    activo INTEGER NOT NULL DEFAULT 1,
    fecha_ultimo_acceso DATETIME,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    fecha_expiracion DATETIME NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activa INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(nombre_usuario);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON sesiones(fecha_expiracion);

-- Insertar usuarios predeterminados
INSERT OR IGNORE INTO usuarios (nombre_usuario, email, password_hash, nombre_completo, departamento, rol) VALUES
('admin', 'admin@bodega.cl', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Administrador Sistema', 'Sistemas', 'admin'),
('juan.garcia', 'juan.garcia@bodega.cl', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Juan García', 'Construcción', 'usuario'),
('carlos.lopez', 'carlos.lopez@bodega.cl', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Carlos López', 'Mantenimiento', 'usuario'),
('maria.rodriguez', 'maria.rodriguez@bodega.cl', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'María Rodríguez', 'Construcción', 'supervisor'),
('pedro.martinez', 'pedro.martinez@bodega.cl', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Pedro Martínez', 'Jardinería', 'usuario');

-- NOTA: Las contraseñas están hasheadas con bcrypt. Para testing:
-- Todos los usuarios tienen la contraseña temporal: "temporal123"
-- Se debe cambiar al primer inicio de sesión