#!/usr/bin/env bash
set -euo pipefail

# Interactive setup script for macOS / Linux / Git-Bash
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

print_header() {
  echo
  echo "========================================"
  echo " Sistema Bodega - Setup"
  echo " Working dir: $ROOT_DIR"
  echo "========================================"
  echo
}

install_deps() {
  echo "--- Instalando dependencias (npm install) ---"
  if command -v npm >/dev/null 2>&1; then
    npm install
  else
    echo "ERROR: npm no encontrado. Instala Node.js y npm primero."
    return 1
  fi
}

fix_permissions() {
  echo "--- Ajustando permisos básicos ---"
  mkdir -p "$ROOT_DIR/backups"
  if command -v chmod >/dev/null 2>&1; then
    chmod -R u+rwX "$ROOT_DIR/backups" || true
    chmod -R u+rwX "$ROOT_DIR/database" || true
    echo "Permisos ajustados."
  else
    echo "chmod no disponible; omitiendo ajuste de permisos."
  fi
}

init_db() {
  echo "--- Inicializando base de datos (npm run init-db) ---"
  if command -v npm >/dev/null 2>&1; then
    npm run init-db
  else
    echo "ERROR: npm no encontrado."
    return 1
  fi
}

validate_db() {
  echo "--- Validando conexión a la base de datos ---"
  node - <<'NODE'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(process.cwd(), 'database', 'herramientas.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('No se pudo abrir la base de datos:', err.message); process.exit(1); }
});
db.get('SELECT 1 as ok', [], (err, row) => {
  if (err) { console.error('Error ejecutando consulta de prueba:', err.message); db.close(()=>process.exit(1)); }
  else { console.log('Conexión a DB OK.'); db.close(()=>process.exit(0)); }
});
NODE
}

start_server() {
  echo "--- Iniciando servidor (npm run dev) ---"
  if command -v npm >/dev/null 2>&1; then
    npm run dev
  else
    echo "ERROR: npm no encontrado."
    return 1
  fi
}

full_flow() {
  install_deps
  fix_permissions
  init_db
  validate_db
  start_server
}

show_menu() {
  print_header
  echo "Opciones:"
  echo " 1) Full: instalar deps, corregir permisos, init DB, validar y arrancar servidor"
  echo " 2) Instalar dependencias (npm install)"
  echo " 3) Corregir permisos (backups, database)"
  echo " 4) Inicializar base de datos (npm run init-db)"
  echo " 5) Validar conexión a DB"
  echo " 6) Iniciar servidor (npm run dev)"
  echo " 7) Salir"
  echo
  read -rp "Elige una opción [1-7]: " CHOICE
  case "$CHOICE" in
    1) full_flow ;;
    2) install_deps ;;
    3) fix_permissions ;;
    4) init_db ;;
    5) validate_db ;;
    6) start_server ;;
    7) echo "Saliendo."; exit 0 ;;
    *) echo "Opción inválida."; exit 1 ;;
  esac
}

show_menu
