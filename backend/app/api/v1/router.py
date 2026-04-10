from fastapi import APIRouter

from app.api.v1 import evaluate, health, interactions, products, recommendations

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(products.router)
api_router.include_router(interactions.router)
api_router.include_router(recommendations.router)
api_router.include_router(evaluate.router)
