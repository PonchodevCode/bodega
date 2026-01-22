-- Datos iniciales para el Sistema de Control de Herramientas de Bodega

INSERT INTO categorias (nombre) VALUES 
('Palas'),
('Picos'),
('Martillos'),
('Azadones'),
('Machuelas'),
('Llaves'),
('Sierras'),
('Destornilladores');

INSERT INTO herramientas (codigo, nombre, categoria_id, stock_total, en_bodega, prestadas, estado) VALUES 
-- Palas
('PA-001', 'Pala Recta Grande', 1, 10, 8, 2, 'Activo'),
('PA-002', 'Pala Triangular', 1, 8, 6, 2, 'Activo'),
('PA-003', 'Pala Angosta', 1, 5, 5, 0, 'Activo'),

-- Picos
('PI-001', 'Pico Punta', 2, 6, 4, 2, 'Activo'),
('PI-002', 'Pico Plano', 2, 4, 4, 0, 'Activo'),

-- Martillos
('MA-001', 'Martillo Grande', 3, 8, 7, 1, 'Activo'),
('MA-002', 'Martillo Pequeño', 3, 12, 11, 1, 'Activo'),

-- Azadones
('AZ-001', 'Azadón', 4, 6, 5, 1, 'Activo');

INSERT INTO solicitantes (nombre, departamento, telefono, email) VALUES 
('Juan García', 'Construcción', '555-0101', 'juan.garcia@empresa.com'),
('Carlos López', 'Mantenimiento', '555-0102', 'carlos.lopez@empresa.com'),
('María Rodríguez', 'Construcción', '555-0103', 'maria.rodriguez@empresa.com'),
('Pedro Martínez', 'Jardinería', '555-0104', 'pedro.martinez@empresa.com'),
('Ana Santos', 'Mantenimiento', '555-0105', 'ana.santos@empresa.com');

INSERT INTO prestamos (codigo_prestamo, herramienta_id, solicitante_id, cantidad, fecha_salida, observaciones) VALUES 
('PRES-001', 1, 1, 2, '2026-01-15', 'En Uso - Obra A'),
('PRES-002', 2, 2, 2, '2026-01-18', 'Limpieza de terreno'),
('PRES-003', 4, 3, 2, '2026-01-16', 'Excavación fundación'),
('PRES-004', 8, 4, 1, '2026-01-20', 'Preparación de terreno'),
('PRES-005', 7, 5, 1, '2026-01-19', 'Reparación estructura');

INSERT INTO devoluciones (codigo_devolucion, prestamo_id, herramienta_id, cantidad, fecha_devolucion, dias_uso, estado_herramienta) VALUES 
('DEV-001', 1, 1, 1, '2026-01-14', 4, 'Buena'),
('DEV-002', 2, 1, 1, '2026-01-15', 5, 'Buena'),
('DEV-003', 3, 4, 1, '2026-01-14', 2, 'Buena'),
('DEV-004', 4, 8, 1, '2026-01-18', 3, 'Buena');