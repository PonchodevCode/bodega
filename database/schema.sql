-- Sistema de Control de Herramientas de Bodega
-- Basado en el archivo Excel "Control Herramientas Bodega.xlsx"

-- Base de datos SQLite

CREATE TABLE categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE herramientas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    categoria_id INTEGER NOT NULL,
    stock_total INTEGER NOT NULL DEFAULT 1,
    en_bodega INTEGER NOT NULL DEFAULT 1,
    prestadas INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE solicitantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(100) NOT NULL,
    departamento VARCHAR(50) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prestamos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_prestamo VARCHAR(20) NOT NULL UNIQUE,
    herramienta_id INTEGER NOT NULL,
    solicitante_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    fecha_salida DATE NOT NULL,
    fecha_retorno DATE,
    observaciones TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (herramienta_id) REFERENCES herramientas(id),
    FOREIGN KEY (solicitante_id) REFERENCES solicitantes(id)
);

CREATE TABLE devoluciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_devolucion VARCHAR(20) NOT NULL UNIQUE,
    prestamo_id INTEGER NOT NULL,
    herramienta_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    fecha_devolucion DATE NOT NULL,
    dias_uso INTEGER,
    estado_herramienta VARCHAR(20) NOT NULL DEFAULT 'Buena',
    observaciones TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prestamo_id) REFERENCES prestamos(id),
    FOREIGN KEY (herramienta_id) REFERENCES herramientas(id)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_herramientas_codigo ON herramientas(codigo);
CREATE INDEX idx_herramientas_categoria ON herramientas(categoria_id);
CREATE INDEX idx_prestamos_codigo ON prestamos(codigo_prestamo);
CREATE INDEX idx_prestamos_herramienta ON prestamos(herramienta_id);
CREATE INDEX idx_prestamos_solicitante ON prestamos(solicitante_id);
CREATE INDEX idx_prestamos_estado ON prestamos(estado);
CREATE INDEX idx_devoluciones_prestamo ON devoluciones(prestamo_id);

-- Vista para resumen de inventario
CREATE VIEW vista_resumen_inventario AS
SELECT 
    h.codigo,
    h.nombre,
    c.nombre AS categoria,
    h.stock_total,
    h.en_bodega,
    h.prestadas,
    CASE 
        WHEN h.stock_total > 0 THEN ROUND((h.en_bodega * 100.0 / h.stock_total), 2)
        ELSE 0
    END AS porcentaje_disponible,
    h.estado,
    COUNT(p.id) AS prestamos_activos
FROM herramientas h
LEFT JOIN categorias c ON h.categoria_id = c.id
LEFT JOIN prestamos p ON h.id = p.herramienta_id AND p.estado = 'Activo'
GROUP BY h.id, h.codigo, h.nombre, c.nombre, h.stock_total, h.en_bodega, h.prestadas, h.estado;

-- Vista para herramientas prestadas actualmente
CREATE VIEW vista_herramientas_prestadas AS
SELECT 
    p.codigo_prestamo,
    h.codigo AS codigo_herramienta,
    h.nombre AS nombre_herramienta,
    c.nombre AS categoria,
    s.nombre AS solicitante,
    s.departamento,
    p.cantidad,
    p.fecha_salida,
    p.fecha_retorno,
    p.observaciones,
    p.estado
FROM prestamos p
JOIN herramientas h ON p.herramienta_id = h.id
JOIN categorias c ON h.categoria_id = c.id
JOIN solicitantes s ON p.solicitante_id = s.id
WHERE p.estado = 'Activo';

-- Vista para historial de devoluciones
CREATE VIEW vista_historial_devoluciones AS
SELECT 
    d.codigo_devolucion,
    p.codigo_prestamo,
    h.codigo AS codigo_herramienta,
    h.nombre AS nombre_herramienta,
    s.nombre AS solicitante,
    d.cantidad,
    p.fecha_salida AS fecha_prestamo,
    d.fecha_devolucion,
    d.dias_uso,
    d.estado_herramienta,
    d.observaciones
FROM devoluciones d
JOIN prestamos p ON d.prestamo_id = p.id
JOIN herramientas h ON d.herramienta_id = h.id
JOIN solicitantes s ON p.solicitante_id = s.id
ORDER BY d.fecha_devolucion DESC;