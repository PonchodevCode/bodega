#!/usr/bin/env bash
set -euo pipefail

# setup.sh - cross-platform helper (works on macOS / Linux / Git-Bash on Windows)
# - instala dependencias (npm)
# - inicializa DB (opcional)
# - corrige permisos básicos
# - valida conexión a la BD
# - ofrece iniciar el servidor

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Setup script for Sistema Bodega =="
echo "Working dir: $ROOT_DIR"

echo
echo "1) Instalando dependencias (npm install)..."
if command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "ERROR: npm no encontrado. Instala Node.js y npm primero."
  exit 1
fi

echo
read -rp "¿Deseas inicializar la base de datos (npm run init-db)? [y/N]: " INIT_DB
if [[ "${INIT_DB,,}" == "y" || "${INIT_DB,,}" == "si" || "${INIT_DB}" == "S" ]]; then
  echo "Inicializando base de datos..."
  npm run init-db
else
  echo "Omitiendo inicialización de DB."
fi

echo
echo "2) Crear carpeta de backups si no existe y ajustar permisos..."
mkdir -p "$ROOT_DIR/backups"
if command -v chmod >/dev/null 2>&1; then
  chmod -R u+rwX "$ROOT_DIR/backups" || true
  chmod -R u+rwX "$ROOT_DIR/database" || true
fi

echo
echo "3) Validar conexión a la base de datos (SQLite)..."
node - <<'NODE' || {
console.error("ERROR: La validación de BD falló."); exit 1
}
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.cwd(), 'database', 'herramientas.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('No se pudo abrir la base de datos:', err.message);
    process.exit(1);
  }
});
db.get('SELECT 1 as ok', [], (err, row) => {
  if (err) {
    console.error('Error ejecutando consulta de prueba:', err.message);
    db.close(()=>process.exit(1));
  } else {
    console.log('Conexión a DB OK.');
    db.close(()=>process.exit(0));
  }
});
NODE

echo
read -rp "¿Iniciar servidor ahora en modo desarrollo (npm run dev)? [y/N]: " START_SRV
if [[ "${START_SRV,,}" == "y" || "${START_SRV,,}" == "si" || "${START_SRV}" == "S" ]]; then
  echo "Iniciando servidor (npm run dev)..."
  npm run dev
else
  echo "Hecho. Para iniciar servidor manualmente: npm run dev"
fi

