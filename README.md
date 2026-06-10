# KABC: 퇴근 후 플레이볼 - Tech Demo 0.0.1

웹 기반 사회인 야구 운영/경기 로직 검증용 테크데모입니다.

## Local Development

Backend:

```powershell
python backend/manage.py migrate
python backend/manage.py seed_demo
python backend/manage.py runserver 127.0.0.1:8010
```

Frontend:

```powershell
npm.cmd --prefix frontend install
npm.cmd --prefix frontend run dev
```

Open `http://127.0.0.1:5173`.

## Railway Deployment

Deploy this repository as two separate Railway services.

### Backend Service

- Root directory: `backend`
- Builder: Nixpacks
- Start command is defined in `backend/railway.json`.
- Add a PostgreSQL database service and set `DATABASE_URL`.

Recommended variables:

```text
DEBUG=False
SECRET_KEY=<strong random secret>
ALLOWED_HOSTS=.railway.app,.up.railway.app,<backend-domain>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>
CSRF_TRUSTED_ORIGINS=https://<frontend-domain>
```

The backend seeds demo league data automatically when `/api/state/` is first requested and no teams exist.

### Frontend Service

- Root directory: `frontend`
- Builder: Nixpacks
- Build/start commands are defined in `frontend/railway.json`.

Required variable:

```text
VITE_API_BASE_URL=https://<backend-domain>
```

Do not deploy from the repository root. The root `package.json` is only a local convenience script runner.
