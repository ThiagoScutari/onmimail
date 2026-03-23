# Omnimail (Scutari & Co)

Monitor de e-mails contábeis para evitar perda de prazos fiscais.

## Como rodar o ambiente de desenvolvimento (PostgreSQL)

1. Crie uma cópia do `.env.example` com o nome `.env` e preencha as variáveis de ambiente necessárias (como a senha do banco `DB_PASSWORD`).
2. Suba o Docker Compose:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```
3. O PostgreSQL estará disponível na porta `5432` e o pgAdmin na porta `5050`.

## Proteção e Qualidade

O projeto possui verificação automática via Husky acionada antes de qualquer commit:
- **Gitleaks**: Busca autônoma por hardcodes e strings proibidas impedindo vazamentos de `APP_SECRET` ou `DB_PASSWORD`.
- **ESlint e Prettier**: Formatação via `lint-staged` na raiz.
