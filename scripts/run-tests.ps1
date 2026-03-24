$ErrorActionPreference = "Stop"

Write-Host "=== Subindo banco de teste ===" -ForegroundColor Cyan
docker compose -f docker/docker-compose.test.yml up -d
Start-Sleep -Seconds 3

Write-Host "=== Rodando migrations ===" -ForegroundColor Cyan
Set-Location backend
$env:DATABASE_URL = "postgresql://omnimail:test_password@localhost:5433/omnimail_test"
npx prisma migrate deploy

Write-Host "=== Testes unitários backend ===" -ForegroundColor Cyan
npm test

Write-Host "=== Testes E2E backend ===" -ForegroundColor Cyan
npm run test:e2e

Write-Host "=== Cobertura backend ===" -ForegroundColor Cyan
npm run test:cov

Write-Host "=== Testes frontend ===" -ForegroundColor Cyan
Set-Location ../frontend
npm test

Write-Host "=== Derrubando banco de teste ===" -ForegroundColor Cyan
Set-Location ..
docker compose -f docker/docker-compose.test.yml down

Write-Host "✅ Todos os testes passaram!" -ForegroundColor Green
