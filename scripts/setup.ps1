<# 
  setup.ps1 - PowerShell helper for Windows (native)
  - instala dependencias (npm)
  - inicializa DB (opcional)
  - crea backups dir
  - valida conexión a la BD
  - ofrece iniciar servidor
#>
Param()

Set-StrictMode -Version Latest
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Output "== Setup script (PowerShell) - Sistema Bodega =="
Write-Output "Working dir: $Root"

if (Get-Command npm -ErrorAction SilentlyContinue) {
  Write-Output "1) Instalando dependencias (npm install)..."
  npm install
} else {
  Write-Error "npm no encontrado. Instala Node.js y npm primero."
  Exit 1
}

$init = Read-Host "¿Deseas inicializar la base de datos (npm run init-db)? [y/N]"
Write-Output "Nota: La inicialización de la base de datos se omite en este asistente. Usa 'npm run init-db' manualmente si es necesario."

Write-Output "2) Crear carpeta backups si no existe..."
$backups = Join-Path $Root 'backups'
if (-not (Test-Path $backups)) { New-Item -ItemType Directory -Path $backups | Out-Null }

Write-Output "3) Validar conexión a la base de datos (SQLite)..."
$nodeScript = @'\nconst sqlite3 = require(\"sqlite3\").verbose();\nconst path = require(\"path\");\nconst dbPath = path.join(process.cwd(), 'database', 'herramientas.db');\nconst db = new sqlite3.Database(dbPath, (err) => {\n  if (err) { console.error('No se pudo abrir la base de datos:', err.message); process.exit(1); }\n});\ndb.get('SELECT 1 as ok', [], (err, row) => {\n  if (err) { console.error('Error ejecutando consulta de prueba:', err.message); db.close(()=>process.exit(1)); }\n  else { console.log('Conexión a DB OK.'); db.close(()=>process.exit(0)); }\n});\n'@
node -e $nodeScript

$start = Read-Host "¿Iniciar servidor ahora (npm run dev)? [y/N]"
if ($start -match '^(y|si|s)$') {
  npm run dev
} else {
  Write-Output "Listo. Para iniciar: npm run dev"
}

