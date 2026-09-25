"""AI service entrypoint — FastAPI foundation (setup phase, no generation yet)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Event Invitation AI Service",
    description="Setup-phase foundation. AI generation lands in a later phase.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict:
    """Liveness probe: GET /health."""
    return {"status": "ok", "service": "ai-service", "provider": settings.ai_provider or "none"}


# Versioned alias for consistency with the backend: GET /api/v1/health
@app.get("/api/v1/health", tags=["health"])
def health_v1() -> dict:
    return health()


app.include_router(api_router, prefix="/api/v1")
