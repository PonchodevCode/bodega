# Instalación rápida — Sistema de Control de Herramientas

Guía paso a paso para instalar y ejecutar el proyecto en un entorno local (macOS / Linux / Windows WSL).

IMPORTANTE: el proyecto incluye scripts que **eliminan y recrean** la base de datos cuando se ejecuta `npm run init-db`. Haz copia de seguridad si tienes datos que quieras preservar.

---

## Requisitos
- Node.js 14+ (recomendado Node 16+)
- npm (v6+) o yarn
- Git (opcional, para clonar el repositorio)

El proyecto usa SQLite (no necesitas instalar un servidor de base de datos, la librería `sqlite3` ya está en `package.json`).

## Variables de entorno útiles
- `PORT` — puerto donde correrá el servidor (por defecto 3000)
- `JWT_SECRET` — secreto JWT (por defecto: `bodega-secreto-2026` si no se provee)

Puedes exportarlas en tu shell antes de iniciar:

```bash
export PORT=3000
export JWT_SECRET="mi-secreto-super-seguro"
```

En Windows (PowerShell):
```powershell
$env:PORT = "3000"
$env:JWT_SECRET = "mi-secreto-super-seguro"
```

---

## Instalación y ejecución

1. Clonar el repositorio o copiar los archivos al equipo:

```bash
git clone <url-del-repositorio>
cd bodega
```

2. Instalar dependencias:

```bash
npm install
```

3. Inicializar la base de datos (opcional si ya existe `database/herramientas.db`). Este script elimina la base de datos anterior y recrea tablas + datos de ejemplo:

```bash
npm run init-db
```

Salida esperada: mensajes indicando que la DB fue creada e insertados los datos de ejemplo.

4. Iniciar servidor (modo desarrollo con reinicio automático):

```bash
npm run dev
```

O iniciar en modo producción:

```bash
npm start
```

5. Abrir en el navegador:

```
http://localhost:3000
```

O si cambiaste `PORT`:

```
http://localhost:<PORT>
```

---

## Credenciales de ejemplo
Los usuarios de ejemplo se insertan al inicializar la extensión de auth. Para testing las contraseñas son:

- Usuario admin: `admin` / contraseña: `temporal123`  
- Otros usuarios (ej. `juan.garcia`, `carlos.lopez`, `maria.rodriguez`, `pedro.martinez`) también usan `temporal123`.

Las contraseñas en la base de datos están hasheadas (bcrypt) — en el código actual para demo se permite `temporal123` como contraseña de prueba. Cambia la lógica en `server.js` / `middleware/auth.js` para producción.

---

## Estructura importante
- `server.js` — servidor Express (API + servido de `public/`)
- `public/` — archivos estáticos (frontend)
- `database/schema.sql` — esquema de la base de datos
- `database/seed.sql` — datos iniciales de ejemplo
- `database/herramientas.db` — archivo SQLite generado
- `scripts/init-db.js` — recrea la base de datos desde `schema.sql` + `seed.sql`
- `middleware/` — autenticación y autorización

---

## Debugging y problemas comunes

- Error 401 "Token no proporcionado":
  - Verifica que el login se realiza correctamente y que el cliente guarda `authToken` en `localStorage`.
  - En DevTools → Network, revisa la petición `POST /api/auth/login` y la respuesta.
  - Asegúrate de que las llamadas API incluyen el header `Authorization: Bearer <token>`.

- Si la UI aparece en blanco o faltan botones:
  - Revisa la consola del navegador para errores JS.
  - Comprueba que el servidor sirve correctamente los archivos estáticos (ver `app.use(express.static(...))` en `server.js`).
  - Asegúrate de haber inicializado la base de datos con `npm run init-db`.

- Re crear la base de datos:
  ```bash
  npm run init-db
  ```
  Esto eliminará `database/herramientas.db` y lo reconstruirá desde `schema.sql` + `seed.sql`.

---

## Personalizar y desplegar

- Para desplegar en un servidor, exporta `PORT` y `JWT_SECRET`, instala dependencias y utiliza un proceso manager (pm2, systemd, docker).
- Consideraciones de producción:
  - Usar HTTPS
  - Configurar CORS de forma restrictiva
  - No usar contraseñas de prueba en producción
  - Hacer backups periódicos del archivo `database/herramientas.db`

---

Si quieres, genero también un `docker-compose.yml` básico para correr la app en contenedor. ¿Deseas que lo añada?  

---

## Exportaciones y backups (implementado)

- Exportar inventario (Excel/CSV): `GET /export/inventario.csv`  
  - Requiere autenticación (token) y rol `admin` o `supervisor`. Devuelve un CSV descargable.
- Exportar préstamos (Excel/CSV): `GET /export/prestamos.csv`  
  - Requiere autenticación (token) y rol `admin` o `supervisor`. Devuelve un CSV descargable.
- Backup manual: `POST /backup`  
  - Requiere autenticación (token) y rol `admin` o `supervisor`. Crea una copia en `backups/`.
- Backup automático: el servidor crea backups periódicos cada 24 horas por defecto.  
  - Cambiar intervalo con `BACKUP_INTERVAL_MS` (milisegundos).

Notas:
- Los CSV generados son compatibles con Excel (se generan con comillas y escapado).
- Para exportar a PDF concreto (layout de impresión), puedo añadir generación server-side (puppeteer / wkhtmltopdf) si lo deseas.
