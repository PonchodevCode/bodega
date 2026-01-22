# Sistema de Control de Herramientas de Bodega

Sistema web completo para el control y gestión de herramientas en una bodega, basado en el archivo Excel "Control Herramientas Bodega.xlsx".

## 🚀 Características Principales

### 📊 Dashboard
- Resumen general con estadísticas en tiempo real
- Herramientas totales, disponibles y prestadas
- Préstamos activos recientes
- Indicadores visuales con tarjetas y contadores

### 📦 Inventario
- Control completo de herramientas
- Registro por código, nombre, categoría y stock
- Visualización de disponibilidad con barras de progreso
- Búsqueda y filtrado de herramientas
- Estados: Activo, Inactivo, Mantenimiento

### 🔄 Gestión de Préstamos
- Registro de préstamos con fecha de salida y retorno
- Asignación a solicitantes por departamento
- Control de cantidades disponibles
- Estados: Activo, Completado
- Observaciones y notas

### ↩️ Gestión de Devoluciones
- Registro de devoluciones con cálculo automático de días de uso
- Estado de herramientas devueltas (Buena, Regular, Dañada, Perdida)
- Vinculación automática con préstamos
- Actualización automática de inventario

### 📈 Reportes y Estadísticas
- Resumen general por herramienta
- Porcentajes de disponibilidad
- Historial completo de movimientos
- Datos filtrables y exportables

## 🛠️ Instalación

### Prerrequisitos
- Node.js 14+ 
- npm o yarn
- SQLite3 (incluido en el proyecto)

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   cd bodega
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Inicializar base de datos**
   ```bash
   npm run init-db
   ```

4. **Iniciar servidor**
   ```bash
   npm run dev
   ```

5. **Abrir en navegador**
   ```
   http://localhost:3000
   ```

## 📁 Estructura del Proyecto

```
bodega/
├── database/
│   ├── schema.sql          # Estructura de la base de datos
│   ├── seed.sql           # Datos iniciales de ejemplo
│   └── herramientas.db    # Base de datos SQLite (creada automáticamente)
├── scripts/
│   └── init-db.js         # Script de inicialización de DB
├── public/
│   ├── index.html         # Interfaz principal
│   └── app.js            # Lógica del frontend
├── server.js              # Servidor backend con API REST
├── package.json           # Dependencias del proyecto
└── README.md             # Este archivo
```

## 🔧 Tecnologías Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **SQLite3** - Base de datos ligera
- **Moment.js** - Manejo de fechas

### Frontend
- **Bootstrap 5** - Framework CSS
- **Font Awesome** - Iconos
- **JavaScript vanilla** - Lógica del cliente
- **API REST** - Comunicación con backend

## 📋 Funcionalidades Detalladas

### Gestión de Inventario
- ✅ Registro de herramientas con código único
- ✅ Categorización por tipo
- ✅ Control de stock total y disponible
- ✅ Seguimiento de herramientas prestadas
- ✅ Estados de herramientas

### Sistema de Préstamos
- ✅ Registro de préstamos con código único
- ✅ Asignación a solicitantes
- ✅ Control automático de disponibilidad
- ✅ Fechas de salida y retorno estimado
- ✅ Observaciones personalizadas

### Sistema de Devoluciones
- ✅ Vinculación automática con préstamos
- ✅ Cálculo automático de días de uso
- ✅ Evaluación del estado de herramientas
- ✅ Actualización automática de inventario

### Reportes y Análisis
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Reportes de disponibilidad por herramienta
- ✅ Historial completo de movimientos
- ✅ Indicadores visuales con gráficos de progreso

## 🎯 Cómo Usar el Sistema

### 1. Configuración Inicial
El sistema incluye datos de ejemplo listos para usar. Puedes:
- Agregar nuevas categorías
- Registrar herramientas adicionales
- Configurar solicitantes

### 2. Flujo de Trabajo Típico

**Préstamo de Herramienta:**
1. Ir a "Préstamos" → "Nuevo Préstamo"
2. Seleccionar herramienta y solicitante
3. Indicar cantidad y fechas
4. Guardar el préstamo

**Devolución:**
1. Ir a "Préstamos" y buscar el préstamo activo
2. Hacer clic en "Devolver"
3. Indicar cantidad y estado
4. Guardar la devolución

**Consulta de Inventario:**
1. Ir a "Inventario" para ver stock
2. Usar el buscador para filtrar
3. Ver disponibilidad en tiempo real

### 3. Reportes
- En "Reportes" consultar estadísticas
- En "Dashboard" ver resumen general
- Exportar datos (funcionalidad futura)

## 🔮 Mejoras Futuras

- [ ] Sistema de usuarios y roles
- [ ] Notificaciones por email
- [ ] Exportación a PDF/Excel
- [ ] Sistema de mantenimiento preventivo
- [ ] Integración con códigos QR
- [ ] Móviles responsive mejorado
- [ ] Backup automático de datos

## 📞 Soporte

Para problemas o sugerencias:
1. Revisar la consola del navegador para errores
2. Verificar que el servidor esté corriendo correctamente
3. Revisar que la base de datos esté inicializada

## 📝 Licencia

MIT License - Uso libre y gratuito