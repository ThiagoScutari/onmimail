# Deploy — Omnimail

## Pre-requisitos

- Docker 24+
- Docker Compose v2+
- Git

## 1. Gerar segredos

```bash
# APP_SECRET (64 hex chars / 32 bytes)
openssl rand -hex 32

# JWT_SECRET
openssl rand -hex 32

# DB_PASSWORD
openssl rand -base64 24
```

## 2. Configurar ambiente

```bash
cd docker
cp .env.example .env
# Edite .env com os valores gerados acima e credenciais IMAP
```

## 3. Subir o sistema

```bash
docker compose -f docker/docker-compose.prod.yml up -d --build
```

Aguarde todos os containers ficarem healthy:

```bash
docker compose -f docker/docker-compose.prod.yml ps
```

## 4. Rodar seed (primeira execução)

```bash
docker compose -f docker/docker-compose.prod.yml exec backend npx prisma db seed
```

## 5. Verificar saude

```bash
curl http://localhost:3000/health
# Esperado: { "status": "ok", "timestamp": "...", "uptime": ... }
```

## 6. Acessar o sistema

- **Frontend:** http://localhost
- **Backend API:** http://localhost:3000
- **Swagger:** http://localhost:3000/api/docs

## 7. Logs

```bash
# Todos os servicos
docker compose -f docker/docker-compose.prod.yml logs -f

# Apenas backend
docker compose -f docker/docker-compose.prod.yml logs -f backend
```

## 8. Backup do PostgreSQL

```bash
docker compose -f docker/docker-compose.prod.yml exec postgres \
  pg_dump -U omnimail omnimail > backup_$(date +%Y%m%d).sql
```

## 9. Restaurar backup

```bash
cat backup.sql | docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U omnimail omnimail
```

## 10. Atualizar

```bash
git pull
docker compose -f docker/docker-compose.prod.yml up -d --build
```

## 11. Parar o sistema

```bash
docker compose -f docker/docker-compose.prod.yml down
# Com remoção de volumes (APAGA DADOS):
docker compose -f docker/docker-compose.prod.yml down -v
```
