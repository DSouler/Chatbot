$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$python = "C:/Users/quan2/AppData/Local/Programs/Python/Python313/python.exe"

# ============================================================
#  Helper: doi container healthy/running (timeout 60s)
# ============================================================
function Wait-Container {
    param(
        [string]$Name,
        [int]$TimeoutSec = 60,
        [switch]$Healthy          # doi trang thai healthy thay vi running
    )
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        if ($Healthy) {
            $health = docker inspect --format "{{.State.Health.Status}}" $Name 2>$null
            if ($health -eq "healthy") { return $true }
        } else {
            $state = docker inspect --format "{{.State.Status}}" $Name 2>$null
            if ($state -eq "running") { return $true }
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    return $false
}

# Helper: kiem tra port dang LISTENING
function Test-Port {
    param([int]$Port)
    $r = netstat -ano | Select-String "0.0.0.0:$Port.*LISTENING"
    return [bool]$r
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VChatbot - Khoi dong tat ca dich vu"    -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
#  1. Docker Desktop - dam bao Docker daemon dang chay
# ============================================================
Write-Host "==> [1/5] Kiem tra Docker daemon..." -ForegroundColor Cyan
$dockerOk = docker info 2>$null
if (-not $?) {
    Write-Host "  Docker chua chay. Dang khoi dong Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    $waited = 0
    while ($waited -lt 120) {
        Start-Sleep -Seconds 3
        $waited += 3
        docker info 2>$null | Out-Null
        if ($?) { break }
    }
    if (-not $?) {
        Write-Host "  [FAIL] Khong the khoi dong Docker Desktop. Hay mo thu cong." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  [OK] Docker daemon dang chay" -ForegroundColor Green

# ============================================================
#  2. Docker Compose - Postgres, Qdrant, Kong
# ============================================================
Write-Host ""
Write-Host "==> [2/5] Khoi dong Docker containers (Postgres, Qdrant, Kong)..." -ForegroundColor Cyan
Push-Location "$root\auth-service"
docker-compose up -d 2>&1 | Out-Null
Pop-Location

# Dam bao cac container thiet yeu dang chay
$containers = @(
    @{ Name = "vchatbot-postgres"; Healthy = $false },
    @{ Name = "vchatbot-qdrant";   Healthy = $false },
    @{ Name = "kong-postgres";     Healthy = $true  },
    @{ Name = "kong-gateway";      Healthy = $true  }
)

foreach ($c in $containers) {
    $name = $c.Name
    # Neu container bi exited/created -> start lai
    $status = docker inspect --format "{{.State.Status}}" $name 2>$null
    if ($status -and $status -ne "running") {
        docker start $name 2>&1 | Out-Null
    }

    if ($c.Healthy) {
        $ok = Wait-Container -Name $name -Healthy -TimeoutSec 90
    } else {
        $ok = Wait-Container -Name $name -TimeoutSec 30
    }

    if ($ok) {
        Write-Host "  [OK] $name dang chay" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $name chua san sang sau timeout" -ForegroundColor Yellow
    }
}

# Cho them de Postgres accept connections
Write-Host "  Cho Postgres san sang nhan ket noi..." -ForegroundColor Yellow
$pgReady = $false
for ($i = 0; $i -lt 15; $i++) {
    $r = docker exec vchatbot-postgres pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Start-Sleep -Seconds 2
}
if ($pgReady) {
    Write-Host "  [OK] Postgres san sang" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Postgres chua san sang, tiep tuc..." -ForegroundColor Yellow
}

# ============================================================
#  3. Auth Service (port 8093)
# ============================================================
Write-Host ""
$authPort = 8093
if (Test-Port $authPort) {
    Write-Host "==> [3/5] Auth Service da chay tren port $authPort" -ForegroundColor Green
} else {
    Write-Host "==> [3/5] Khoi dong Auth Service (port $authPort)..." -ForegroundColor Cyan
    Start-Process powershell -WorkingDirectory "$root\auth-service" -ArgumentList "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'Auth Service'; & '$python' -m uvicorn main:app --host 0.0.0.0 --port $authPort --reload"
}

# ============================================================
#  4. BE Chatbot (port 8096)
# ============================================================
$bePort = 8096
if (Test-Port $bePort) {
    Write-Host "==> [4/5] BE Chatbot da chay tren port $bePort" -ForegroundColor Green
} else {
    Write-Host "==> [4/5] Khoi dong BE Chatbot (port $bePort)..." -ForegroundColor Cyan
    Start-Process powershell -WorkingDirectory "$root\BE" -ArgumentList "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'BE Chatbot'; & '$python' -m uvicorn app:app --host 0.0.0.0 --port $bePort --reload"
}

# ============================================================
#  5. FE - Vite dev server (port 5173)
# ============================================================
$fePort = 5173
if (Test-Port $fePort) {
    Write-Host "==> [5/5] FE da chay tren port $fePort" -ForegroundColor Green
} else {
    Write-Host "==> [5/5] Khoi dong FE (Vite dev server)..." -ForegroundColor Cyan
    Start-Process powershell -WorkingDirectory "$root\FE" -ArgumentList "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'FE Vite'; npm run dev"
}

# ============================================================
#  Tong ket
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Tat ca dich vu da duoc khoi dong!"     -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Docker Containers:" -ForegroundColor White
Write-Host "    Postgres (app)  : localhost:5433"
Write-Host "    Postgres (kong) : localhost:5434"
Write-Host "    Qdrant          : localhost:6333"
Write-Host "    Kong Gateway    : localhost:8000 (proxy) | localhost:8002 (manager)"
Write-Host ""
Write-Host "  Application Services:" -ForegroundColor White
Write-Host "    Auth Service    : http://localhost:$authPort"
Write-Host "    BE Chatbot      : http://localhost:$bePort"
Write-Host "    FE              : http://localhost:$fePort/Chatbot/"
