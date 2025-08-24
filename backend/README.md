# ECOLAV Backend

Stack: Node.js + Express + TypeScript + Prisma (MySQL)

Setup:
- Copie .env.example para .env e configure `DATABASE_URL` e `PORT` (padrão 4000)
- Instale deps: `npm i`
- Gere client: `npm run prisma:generate`
- Crie migrações: `npm run prisma:migrate --name init`
- Dev: `npm run dev`

Endpoints iniciais:
- GET /health
- CRUD básico de /clients


