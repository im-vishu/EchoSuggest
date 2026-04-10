# EchoSuggest

AI-powered product recommendation platform (hybrid content + collaborative filtering). **Phase 1**: FastAPI + MongoDB + React. **Phase 2**: **TF-IDF** content similarity (`content.py`). **Phase 3**: **SVD** collaborative filtering (`collaborative.py`, SciPy). **Phase 4**: **Hybrid** blending (`hybrid.py`), **Redis** response caching, and **Precision@K** holdout evaluation (`/api/v1/evaluate/precision-at-k`). **Phase 5**: **Cold-start** popular/trending fallbacks (`cold_start.py`) used directly and as hybrid backup.

## Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- Docker Desktop (or Docker Engine + Compose)

## 1. Start data services

From the repository root:

```powershell
docker compose up -d
```

This starts **MongoDB** on port `27017` and **Redis** on host port `6380` (container `6379`) to avoid clashing with a local Redis on `6379`.

## 2. Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health: `GET http://localhost:8000/api/v1/health`
- Mongo ping: `GET http://localhost:8000/api/v1/db/ping`
- Products: `POST /api/v1/products`, `POST /api/v1/products/bulk`, `GET /api/v1/products`, `GET /api/v1/products/{id}`
- Interactions: `POST /api/v1/interactions`, `GET /api/v1/interactions`
- Content similar: `GET /api/v1/recommendations/content/{product_id}?top_k=10`
- Collaborative (SVD / matrix factorization): `GET /api/v1/recommendations/collaborative/{user_id}?top_k=10`
- Hybrid: `GET /api/v1/recommendations/hybrid/{user_id}?top_k=10&w_collaborative=0.6&w_content=0.4` (cached in **Redis** when available)`n- Cold-start: `GET /api/v1/recommendations/cold-start?mode=trending&window_days=30&top_k=10`
- Offline metric: `GET /api/v1/evaluate/precision-at-k?k=10&max_users=100` (last-event holdout per user; can be slow)

**Demo data** (with the API running):

```powershell
cd backend
python scripts/seed_demo_products.py
python scripts/seed_demo_interactions.py
```

SVD needs enough overlap: at least **5** interactions, **2+** users, **2+** items (see `collaborative.py` thresholds).

The default `.env` matches Docker Compose credentials (`echosuggest` / `echosuggest_dev`, `authSource=admin`).

## 3. Frontend (Vite + React)

In a second terminal:

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The UI shows health, catalog, **content** neighbors, **collaborative**, **hybrid**, **cold-start trending** lists, and a **Precision@K** check button.

## Verification

| Check | Expected |
|--------|----------|
| `GET /api/v1/health` | `{"status":"ok"}` |
| `GET /api/v1/db/ping` | `{"mongodb":"ok"}` |
| After seeding | Content, collaborative, hybrid, cold-start return ranked items |
| Redis up | Repeated hybrid calls hit cache (see server logs) |
| Frontend | All panels load without CORS errors |

## Project layout

```text
backend/app/
  api/v1/        health, products, interactions, recommendations, evaluate
  cache/         Redis client for hybrid JSON cache
  schemas/       Pydantic models
  services/recommendations/  content, collaborative, hybrid
  services/evaluation/       Precision@K holdout
frontend/src/    React UI, API types
docker-compose.yml MongoDB + Redis
```

## Next phase

**Phase 6**: User-tracking driven trending windows, scheduled precompute jobs, and latency tuning.


