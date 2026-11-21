param(
  [string]$ServerUrl = "https://lafincaweb.vercel.app",
  [string]$PrinterIp = "",
  [int]$LanPort = 4545
)

$ErrorActionPreference = "Stop"
$pass = 0
$warn = 0
$fail = 0

function Report-Check($status, $name, $detail) {
  if ($status -eq "PASS") {
    $script:pass++
    Write-Host "[PASS] $name - $detail" -ForegroundColor Green
  } elseif ($status -eq "WARN") {
    $script:warn++
    Write-Host "[WARN] $name - $detail" -ForegroundColor Yellow
  } else {
    $script:fail++
    Write-Host "[FAIL] $name - $detail" -ForegroundColor Red
  }
}

$base = $ServerUrl.TrimEnd("/")

# 1. Health Endpoint
try {
  $health = Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 8
  if ($health.ok) {
    Report-Check "PASS" "API Health" "BD OK ($($health.dbLatencyMs) ms) | Auth: $($health.checks.authEnforcement)"
  } else {
    Report-Check "FAIL" "API Health" "Estado degradado: $($health.error)"
  }
} catch {
  Report-Check "FAIL" "API Health" $_.Exception.Message
}

# 2. Bloqueo RBAC sin cookie en /api/pos
try {
  $null = Invoke-WebRequest -Uri "$base/api/pos" -TimeoutSec 8 -UseBasicParsing
  Report-Check "FAIL" "Seguridad /api/pos" "Respondio 200 sin sesion (revisar AUTH_ENFORCEMENT)"
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  if ($code -eq 401 -or $code -eq 403) {
    Report-Check "PASS" "Seguridad /api/pos" "Bloqueo activo sin sesion (HTTP $code)"
  } else {
    Report-Check "WARN" "Seguridad /api/pos" "HTTP inesperado: $code"
  }
}

# 3. Servicio LAN local Tauri
try {
  $lan = Invoke-RestMethod -Uri "http://127.0.0.1:$LanPort/lan/health" -TimeoutSec 3
  if ($lan.ok) {
    Report-Check "PASS" "Servidor LAN local" "Activo en 127.0.0.1:$LanPort"
  } else {
    Report-Check "WARN" "Servidor LAN local" "Respuesta inesperada"
  }
} catch {
  Report-Check "WARN" "Servidor LAN local" "No responde en :$LanPort (abre ELIANA POS primero)"
}

# 4. Regla de Firewall para puerto LAN
try {
  $fw = Get-NetFirewallPortFilter | Where-Object { $_.LocalPort -eq "$LanPort" }
  if ($fw) {
    Report-Check "PASS" "Windows Firewall" "Regla encontrada para puerto TCP $LanPort"
  } else {
    Report-Check "WARN" "Windows Firewall" "Sin regla para TCP $LanPort. Ejecuta como Admin: New-NetFirewallRule -DisplayName 'Eliana POS LAN' -Direction Inbound -Protocol TCP -LocalPort $LanPort -Action Allow -Profile Private"
  }
} catch {
  Report-Check "WARN" "Windows Firewall" "No se pudo consultar firewall"
}

# 5. Impresora termica TCP :9100 (si se indico IP)
if ($PrinterIp -ne "") {
  $pHost = ($PrinterIp -split ":")[0]
  $pPort = if ($PrinterIp -match ":(\d+)$") { [int]$matches[1] } else { 9100 }
  $tcp = Test-NetConnection -ComputerName $pHost -Port $pPort -WarningAction SilentlyContinue
  if ($tcp.TcpTestSucceeded) {
    Report-Check "PASS" "Impresora TCP" "Conexion exitosa a ${pHost}:${pPort}"
  } else {
    Report-Check "FAIL" "Impresora TCP" "Sin conexion a ${pHost}:${pPort}"
  }
}

Write-Host ""
Write-Host "Resumen Smoke Test -> PASS: $pass | WARN: $warn | FAIL: $fail" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }
