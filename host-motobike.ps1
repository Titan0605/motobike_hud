# 1. Pedir permisos de Administrador automáticamente
if (-Not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Se necesitan permisos de Administrador para configurar el Firewall."
    Write-Host "Reiniciando el script con privilegios elevados..."
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# 2. Configurar la regla del Firewall (verifica si ya existe para evitar errores)
Write-Host "Verificando regla de Firewall para Vite (Puerto 5173)..." -ForegroundColor Cyan
$rule = Get-NetFirewallRule -DisplayName "Vite 5173 Inbound" -ErrorAction SilentlyContinue

if (-not $rule) {
    New-NetFirewallRule -DisplayName "Vite 5173 Inbound" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Private | Out-Null
    Write-Host "Regla de Firewall creada con éxito." -ForegroundColor Green
} else {
    Write-Host "La regla de Firewall ya existe. Omitiendo..." -ForegroundColor Yellow
}

# 3. Navegar a la carpeta del proyecto del HUD
# Se usa $env:USERPROFILE para ir a tu escritorio sin importar el nombre de tu usuario
$projectPath = "$env:USERPROFILE\Desktop\repositories\motobike_hud"
Write-Host "Navegando a: $projectPath" -ForegroundColor Cyan
Set-Location -Path $projectPath

# 4. Construir el proyecto
Write-Host "Construyendo el proyecto (npm run build)..." -ForegroundColor Cyan
npm run build

# 5. Iniciar el servidor host
Write-Host "Iniciando el servidor en 0.0.0.0:5173..." -ForegroundColor Green
npm run preview -- --host 0.0.0.0 --port 5173

# Pausa final por si ocurre algún error antes de cerrar la ventana
pause