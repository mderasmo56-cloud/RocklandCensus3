# Deployment Guide (FastAPI + Cloudflare Pages)

## Backend (FastAPI)
1) Set env vars:
   - `CENSUS_API_KEY`
   - `OPENAI_API_KEY`
   - `ALLOWED_ORIGINS` (comma-separated, e.g. `https://your-pages-domain.pages.dev,http://localhost:5173`)
2) Install and run locally:
   ```bash
   pip install -r requirements.txt
   uvicorn app:app --reload --port 8000
   ```
3) Containerize (optional):
   ```bash
   docker build -t rockland-api .
   docker run -p 8000:8000 --env-file .env rockland-api
   ```
4) Deploy to a Python-friendly host (Railway/Fly/Render/EC2). Expose port 8000 and keep the env vars set.

## Cloudflare Pages (Frontend)
1) In `frontend/`, install and build:
   ```bash
   npm install
   npm run build
   ```
2) Set Pages build config:
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `frontend`
3) Pages env vars:
   - `VITE_API_BASE_URL` → your deployed FastAPI URL (e.g. `https://api.example.com`)
4) After deploy, verify the UI can call `GET /api/health` and `GET /api/zip-data` via the configured base URL.

## CORS checklist
- Backend `ALLOWED_ORIGINS` must include:
  - Your Pages domain (e.g. `https://your-site.pages.dev`)
  - Local dev origin (`http://localhost:5173`)

## Smoke tests
- `GET {API_BASE}/api/health` returns `status: "ok"` and shows keys present.
- `GET {API_BASE}/api/zip-data?zips=10901,10952` returns data records.
- `POST {API_BASE}/api/ai-report` with a small ZIP list returns `ai_summary`.
- Frontend loads on Pages and renders data + AI narrative.
