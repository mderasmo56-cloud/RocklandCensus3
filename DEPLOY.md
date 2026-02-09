# Deployment Guide (FastAPI + Cloudflare Pages)

## Run locally (AI narrative + Fetch data)
1) **Terminal 1 – Backend** (required for AI narrative and Fetch data):
   ```powershell
   # Windows PowerShell – set your keys first
   $env:CENSUS_API_KEY="your_census_api_key"
   $env:OPENAI_API_KEY="your_openai_api_key"
   $env:ALLOWED_ORIGINS="http://localhost:5173"
   uvicorn app:app --reload --port 8000
   ```
   Leave this running. Get keys: [Census](https://api.census.gov/data/key_signup.html), [OpenAI](https://platform.openai.com/api-keys).
2) **Terminal 2 – Frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```
   Open http://localhost:5173. The frontend proxies `/api` to the backend. **AI narrative** may take 30–90 seconds (Census + OpenAI).

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

## Cloudflare Pages (Frontend + Functions Worker)
1) In `frontend/`, install and build locally if you want to test:
   ```bash
   npm install
   npm run build
   ```
2) Pages build config:
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - If the UI requires a deploy command field, reuse `npm run build`.
3) Pages/Functions env vars (set in dashboard):
   - `CENSUS_API_KEY`
   - `OPENAI_API_KEY`
   - `ALLOWED_ORIGIN` → your Pages domain (add `http://localhost:5173` if needed for local dev)
   - `VITE_API_BASE_URL` → leave empty for same-origin `/api` (Pages Functions). If using a separate Worker URL, set that URL instead.
4) After deploy, verify:
   - `GET /api/health`
   - `GET /api/zip-data?zips=10901,10952`
   - `POST /api/ai-report` with a small ZIP list
   - UI loads and buttons “Fetch data” / “AI narrative” work without CORS errors.

## CORS checklist
- Worker/Functions `ALLOWED_ORIGIN` must include your Pages domain (e.g. `https://your-site.pages.dev`) and `http://localhost:5173` for local dev if needed.

## Production (Cloudflare Pages + Worker API)
- The frontend on Pages uses the Worker API automatically when the site is on `*.pages.dev` or `rocklandcensusinsights.com` (no env var needed).
- **Worker** (rocklandcensus): In Variables and Secrets set **ALLOWED_ORIGIN** to a comma-separated list, e.g. `https://rocklandcensusinsights.com,https://rocklandcensus3.pages.dev,http://localhost:5173`.
- **Worker** must have **CENSUS_API_KEY** and **OPENAI_API_KEY** set.
- Redeploy the Worker after changing env vars.

## Smoke tests
- `GET {BASE}/api/health` returns `status: "ok"` and shows keys present.
- `GET {BASE}/api/zip-data?zips=10901,10952` returns data records.
- `POST {BASE}/api/ai-report` with a small ZIP list returns `ai_summary`.
- Frontend loads on Pages and renders data + AI narrative.
