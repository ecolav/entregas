Ecolav Monorepo

Structure:
- `project/`: Frontend (Vite + React + TS)
- `backend/`: API (Node + Express + Prisma MySQL)

Local development
1. Frontend
   - cd project
   - npm i
   - npm run dev
2. Backend
   - cd backend
   - copy `ENV_EXAMPLE` to `.env` and configure `DATABASE_URL`, `JWT_SECRET`, `PORT`
   - npm i
   - npm run prisma:generate
   - npm run prisma:migrate --name init
   - npm run dev

Build and deploy
1. Build frontend: `cd project && npm run build` (output in `project/dist`)
2. Start backend: `cd backend && npm run prestart && npm start`
3. Optionally serve SPA from backend by copying `project/dist` to `backend/public` and setting `SERVE_SPA=true`

GitHub
- Frontend deploy via GitHub Pages: push to `main`; set repo Settings → Pages → Source: GitHub Actions
- Configure secret `VITE_API_URL` for the Pages build to point to your backend
- Backend CI runs on pushes/PRs to `backend/**`

HostGator (www.rouparia.textilecolav.com.br)
1) DNS
   - Crie um CNAME de `www` apontando para o host do seu plano HostGator (ou use o gerenciador de domínios da hospedagem)
2) Deploy por GitHub Actions (FTP)
   - Configure os secrets do repositório:
     - `FTP_SERVER` (ex.: `ftp.seudominio.com`)
     - `FTP_USERNAME`
     - `FTP_PASSWORD`
     - `FTP_SERVER_DIR` (ex.: `public_html/` ou `public_html/rouparia/`)
     - `VITE_API_URL` (URL do backend)
   - Rode o workflow `Deploy Frontend to HostGator via FTP` (em Actions) ou faça push na `main`
3) Apache SPA fallback
   - O arquivo `project/public/.htaccess` garante fallback para `index.html` em rotas do SPA

Environment variables
- Backend (`backend/.env`):
  - DATABASE_URL=mysql://user:pass@host:3306/dbname
  - JWT_SECRET=change-me
  - PORT=4000
  - SERVE_SPA=true
- Frontend (`project/.env`):
  - VITE_API_URL=https://your-api-host

Notes
- Uploads are served from `/uploads` on the backend.
- First admin can be bootstrapped via POST `/auth/bootstrap-admin` or by `prestart` init.

