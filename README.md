# EchoSuggest

AI-powered product recommendation platform (hybrid content + collaborative filtering). **Phase 1**: FastAPI + MongoDB + React. **Phase 2**: **TF-IDF** content similarity (`content.py`). **Phase 3**: **SVD** collaborative filtering (`collaborative.py`, SciPy). **Phase 4**: **Hybrid** blending (`hybrid.py`), **Redis** response caching, and **Precision@K** holdout evaluation (`/api/v1/evaluate/precision-at-k`). **Phase 5**: **Cold-start** popular/trending fallbacks (`cold_start.py`) used directly and as hybrid backup. **Phase 6**: **Analytics** (impressions/clicks), **precompute jobs** (trending windows in Redis), **metrics** summary, optional **category** on cold-start; **Figma-style** browse UI (design tokens, rails, poster cards). **Phase 7**: **Redis caches** for content + collaborative + hybrid (TTL `RECOMMEND_CACHE_TTL_SECONDS`), **cold-start fast path** from precomputed `w7`/`w30` snapshots, **batch hybrid** (`POST /recommendations/batch/hybrid`), optional **background precompute** (`PRECOMPUTE_SCHEDULE_SECONDS`), optional **admin API key** for `POST /jobs/precompute`. **Phase 8**: **JWT auth** (`POST /auth/register`, `POST /auth/login`), **persisted users** in MongoDB (`users` collection), **profile** `GET/PATCH /users/me` (Bearer token); browse UI login/register and **Use for rails** to set the recommendation `user_id` to the signed-in account id. **Phase 10**: **Saved list** per user (`user_saved_products` collection; `GET /me/saved`, `POST /me/saved`, `DELETE /me/saved/{product_id}` with Bearer), **catalog filters** on `GET /products` (`q`, `category`, `min_price`, `max_price`, `tag`); browse UI **Search catalog** + **Save** on poster cards and a **Your saved list** rail.

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
- Auth: `POST /api/v1/auth/register`, `POST /api/v1/auth/login` (returns `access_token` + `user`)
- Account: `GET /api/v1/users/me`, `PATCH /api/v1/users/me` (header `Authorization: Bearer <token>`)
- Health: `GET http://localhost:8000/api/v1/health`
- Mongo ping: `GET http://localhost:8000/api/v1/db/ping`
- Products: `POST /api/v1/products`, `POST /api/v1/products/bulk`, `GET /api/v1/products` (optional `q`, `category`, `min_price`, `max_price`, `tag`), `GET /api/v1/products/{id}`
- Saved (auth): `GET /api/v1/me/saved?expand=true|false`, `POST /api/v1/me/saved` body `{ "product_id": "..." }`, `DELETE /api/v1/me/saved/{product_id}`
- Interactions: `POST /api/v1/interactions`, `GET /api/v1/interactions`
- Content similar: `GET /api/v1/recommendations/content/{product_id}?top_k=10` (Redis cache when available)
- Collaborative (SVD / matrix factorization): `GET /api/v1/recommendations/collaborative/{user_id}?top_k=10` (Redis cache when available)
- Hybrid: `GET /api/v1/recommendations/hybrid/{user_id}?top_k=10&w_collaborative=0.6&w_content=0.4` (cached in **Redis** when available)
- Batch hybrid: `POST /api/v1/recommendations/batch/hybrid` — JSON body `{ "user_ids": ["u1","u2"], "top_k": 10, "w_collaborative": 0.6, "w_content": 0.4, "max_pool": 200 }` (up to **25** users; one CF load + one content fit)
- Cold-start: `GET /api/v1/recommendations/cold-start?mode=trending&window_days=30&top_k=10` (optional `category=`)
- Analytics: `POST /api/v1/analytics/track`, `GET /api/v1/analytics/overview?days=7`
- Jobs: `POST /api/v1/jobs/precompute` (optional header `X-API-Key` if `ADMIN_API_KEY` is set), `GET /api/v1/jobs/status`
- Metrics: `GET /api/v1/metrics/summary?days=7`
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

Open [http://localhost:5173](http://localhost:5173). The browse experience uses **hero + content rails** (Figma-style tokens in `frontend/src/styles/figma-tokens.css`): trending, content-similar, hybrid, collaborative; **Search catalog** (title/description + category); when signed in, **Save** on cards and **Your saved list**; header **Log in / Register** (JWT in `localStorage`); **Use for rails** sets the Profile id to your account **ObjectId**. Dev panel: health, **metrics**, **precompute**, **Precision@K**.

## Verification

| Check | Expected |
|--------|----------|
| `GET /api/v1/health` | `{"status":"ok"}` |
| `GET /api/v1/db/ping` | `{"mongodb":"ok"}` |
| After seeding | Content, collaborative, hybrid, cold-start return ranked items |
| Redis up | Repeated hybrid / content / collaborative calls hit cache (see server logs) |
| Precompute | Trending `GET /cold-start?window_days=7|30` can read Redis snapshots after a job |
| Frontend | All panels load without CORS errors |
| Auth | Register → Bearer works on `GET /users/me`; set **Profile** to user id after **Use for rails** for personalized CF/hybrid |
| Phase 10 | Signed in → Save on a card → `GET /me/saved` returns it; `GET /products?q=...` narrows the catalog |

## Project layout

```text
backend/app/
  api/v1/        health, auth, users, me, products, interactions, recommendations, evaluate, analytics, jobs, metrics
  cache/         Redis client for hybrid cache + precompute keys
  schemas/       Pydantic models
  services/recommendations/  content, collaborative, hybrid, cold_start
  services/evaluation/       Precision@K holdout
  services/analytics/        event overview
  services/jobs/             precompute trending
  services/users.py        registration, auth helpers
  services/saved_products.py  user saved list
  core/security.py         JWT + bcrypt
frontend/src/    React browse UI, auth store, analytics helper, figma-tokens
docker-compose.yml MongoDB + Redis
```

Set a non-zero `PRECOMPUTE_SCHEDULE_SECONDS` to run precompute on an interval inside the API process (no separate worker).

## Next phases

**Phase 9** (not implemented here): dedicated job worker (Celery/RQ), refresh tokens or OAuth2, stricter production settings (HTTPS-only cookies, rate limits, secrets rotation).

**Phase 11**: Full-text search index (Atlas Search or Elasticsearch), social sharing, or export of saved lists.

