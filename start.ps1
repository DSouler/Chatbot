$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$python = "C:/Users/quan2/AppData/Local/Programs/Python/Python313/python.exe"

Write-Host "==> Khoi dong Docker (Qdrant + Postgres)..." -ForegroundColor Cyan
Push-Location "$root\BE"
docker-compose up -d
Pop-Location

Write-Host "==> Khoi dong Auth Service (port 8093)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\auth-service'; & '$python' -m uvicorn main:app --host 0.0.0.0 --port 8093 --reload"

Write-Host "==> Khoi dong BE Chatbot (port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\BE'; & '$python' -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"

Write-Host "==> Khoi dong FE (Vite dev server)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\FE'; npm run dev"

Write-Host ""
Write-Host "Tat ca dich vu da duoc khoi dong:" -ForegroundColor Green
Write-Host "  Docker     : chay nen"
Write-Host "  Auth       : http://localhost:8093"
Write-Host "  BE Chatbot : http://localhost:8000"
Write-Host "  FE         : http://localhost:5173"
