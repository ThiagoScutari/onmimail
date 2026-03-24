#!/bin/bash
set -e

echo "=== Subindo banco de teste ==="
docker compose -f docker/docker-compose.test.yml up -d
sleep 3

echo "=== Rodando migrations ==="
cd backend
DATABASE_URL=postgresql://omnimail:test_password@localhost:5433/omnimail_test npx prisma migrate deploy

echo "=== Testes unitários backend ==="
npm test

echo "=== Testes E2E backend ==="
npm run test:e2e

echo "=== Cobertura backend ==="
npm run test:cov

echo "=== Testes frontend ==="
cd ../frontend
npm test

echo "=== Derrubando banco de teste ==="
cd ..
docker compose -f docker/docker-compose.test.yml down

echo "✅ Todos os testes passaram!"
