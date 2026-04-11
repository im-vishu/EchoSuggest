from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    auth,
    evaluate,
    health,
    interactions,
    jobs,
    me,
    metrics,
    products,
    recommendations,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(me.router)
api_router.include_router(products.router)
api_router.include_router(interactions.router)
api_router.include_router(recommendations.router)
api_router.include_router(evaluate.router)
api_router.include_router(analytics.router)
api_router.include_router(jobs.router)
api_router.include_router(metrics.router)
