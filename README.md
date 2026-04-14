# 🚀 EchoSuggest — AI Recommendation Engine

EchoSuggest — a lightweight, modular recommender (TF‑IDF content + SVD collaborative, optional hybrid + Redis cache) with a TypeScript (Vite + React) frontend and a Python (FastAPI) backend providing evaluation tools and demo data.


---


## ✨ Highlights
- ⚡ FastAPI endpoints for content, collaborative, hybrid, and cold-start recommendations  
- 🧠 Content similarity (TF‑IDF style) and SVD-based collaborative filtering  
- 🔁 Hybrid blending & Redis caching for low-latency responses  
- 🧪 Offline evaluation: Precision@K holdout tooling  
- 🐳 Docker Compose for local MongoDB + Redis development  
- 🧩 Frontend prototype (Vite + React + TypeScript) for UI integration


---


## 📌 Quick links
- API docs: http://localhost:8000/docs.  
- Frontend (dev): http://localhost:5173  
- Dev services: MongoDB → localhost:27017, Redis → localhost:6380


---


## 🛠 Tech stack
- Backend: Python 3.12+, FastAPI, Uvicorn, Motor (MongoDB)  
- ML / Data: numpy, pandas, scikit-learn, scipy  
- Cache: Redis  
- Frontend: TypeScript, React, Vite (Zustand, framer-motion, axios)  
- Dev: ESLint, Tailwind, TypeScript  
- Infra: Docker, docker-compose


---


## 🗂 Project structure
```
.
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── api/
│       │   └── v1/                    # health.py, products.py, interactions.py, recommendations.py, evaluate.py
│       ├── cache/                     # redis client
│       ├── core/                      # config (pydantic settings)
│       ├── db/                        # mongodb connection & indexes
│       ├── schemas/                   # pydantic models
│       └── services/
│           └── recommendations/       # content.py, collaborative.py, hybrid.py, cold_start.py
│           └── evaluation/            # holdout precision@k
│           └── scripts/               # seed_demo_products.py, seed_demo_interactions.py
├── frontend/
│   ├── package.json
│   └── src/                           # React + TypeScript UI
├── docker-compose.yml
├── .env.example
└── README.md
```


---


## 🚀 Local development — quickstart

1. Clone the repo
```bash
git clone https://github.com/im-vishu/EchoSuggest.git
cd EchoSuggest
```

2. Start data services (MongoDB + Redis)
```bash
docker compose up -d
```
- MongoDB host port: 27017  
- Redis host port: 6380 (container 6379)

3. Backend (development)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows PowerShell
pip install -r requirements.txt
cp .env.example .env             # edit if necessary
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Open the API docs: http://localhost:8000/docs

4. Frontend (development)
```bash
cd frontend
npm install
npm run dev
```
- Vite dev server: http://localhost:5173

5. Seed demo data (optional — recommended for trying recommendation)
```bash
cd backend
python scripts/seed_demo_products.py
python scripts/seed_demo_interactions.py
```

---


## 🔍 API overview (prefix: /api/v1)

Health
- GET /health — service status
- GET /db/ping — MongoDB ping

Products
- POST /products, POST /products/bulk
- GET /products, GET /products/{product_id}

Interactions
- POST /interactions
- GET /interactions?user_id=&product_id=

Recommendations
- GET /recommendations/content/{product_id}?top_k=
- GET /recommendations/collaborative/{user_id}?top_k=
- GET /recommendations/hybrid/{user_id}?top_k=&w_collaborative=&w_content=
- GET /recommendations/cold-start?mode=trending|popular&window_days=&top_k=

Evaluation
- GET /evaluate/precision-at-k?k=&max_users=

Example
GET /api/v1/recommendations/content/<PRODUCT_ID>?top_k=5  
→ JSON array: [{ "product_id": "...", "score": 0.xx }, ...]


---


## 🔧 Environment configuration

backend/.env.example (recommended development values)
```env
MONGODB_URI=mongodb://echosuggest:echosuggest_dev@localhost:27017/?authSource=admin
MONGODB_DB_NAME=echosuggest
REDIS_URL=redis://localhost:6380/0
API_V1_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
RECOMMEND_CACHE_TTL_SECONDS=300
```
Top-level .env.example is used by docker-compose for Mongo root credentials.

---

## 🐳 Docker & deployment notes
- Backend Dockerfile: backend/Dockerfile (base: python:3.12-slim)  
- Build & run example:
```bash
docker build -t echosuggest-backend:latest -f backend/Dockerfile backend
docker run -p 8000:8000 --env-file backend/.env echosuggest-backend:latest
```
- docker-compose.yml ships MongoDB + Redis for local dev. To fully containerize, extend it to run backend and frontend services as well.


---


## 🐞 Troubleshooting

- Mongo/Redis: run `docker compose ps` and verify ports match your .env  
- Empty collaborative results: seed interactions (backend/scripts) or post events  
- Port in use: backend=8000, frontend=5173 — stop the process or change ports


---


## 🧪 Tests & CI
- Add pytest for backend unit & integration tests
- Add GitHub Actions: lint, pytest, build (frontend + backend)


---


## 🤝 Contributing

We welcome contributions! 🙌
1. Fork the repository  
2. Create a branch: `git checkout -b feature/your-feature`  
3. Implement changes and add tests  
4. Run linting & tests  
5. Open a pull request with a clear description

Please include tests for any new recommendation logic and update docs when adding endpoints.


---


## 📄 License
MIT


---


## ✉️ Contact
EchoSuggest © 2026 — Created by im-vishu  
