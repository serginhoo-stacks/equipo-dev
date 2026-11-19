from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ia import config
from ia.routes import chat, images, support
from ia.security.authentication import AuthenticatedUser, get_current_user
from ia.security.validation import enforce_user_rate_limit, rate_limiter
from ia.services.ollama_service import get_status

logger = logging.getLogger("smartinspect.ia")

app = FastAPI(
    title="SmartInspect AI API",
    version="1.0.0",
    description="API local protegida para o SmartInspect AI, SmartInspect Support e análise visual.",
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(config.CORS_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
    max_age=600,
)

app.include_router(chat.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(support.router, prefix="/api")


@app.middleware("http")
async def api_ip_rate_limit(request: Request, call_next):
    """Limita também tentativas sem sessão antes de consultar Supabase Auth."""
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        try:
            await rate_limiter.check(
                f"ip:{client_ip}",
                limit=120,
                window_seconds=config.RATE_LIMIT_WINDOW_SECONDS,
            )
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"erro": exc.detail},
                headers=dict(exc.headers or {}),
            )
    return await call_next(request)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    headers = dict(exc.headers or {})
    return JSONResponse(
        status_code=exc.status_code,
        content={"erro": exc.detail if isinstance(exc.detail, str) else "Requisição não autorizada ou inválida."},
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    # Evita ecoar valores fornecidos pelo cliente em mensagens de validação.
    return JSONResponse(status_code=422, content={"erro": "Dados inválidos ou fora dos limites permitidos."})


@app.exception_handler(Exception)
async def unexpected_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
    # Não registrar corpo, prompt, imagem, token, e-mail ou detalhes do provider.
    logger.exception("Erro interno não tratado na API de IA.")
    return JSONResponse(status_code=500, content={"erro": "Erro interno. Tente novamente mais tarde."})


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check do processo; não consulta nem expõe o Ollama."""
    return {"status": "ok"}


@app.get("/api/ia/status")
async def ia_status(user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, object]:
    await enforce_user_rate_limit(
        user.user_id,
        "status",
        30,
        config.RATE_LIMIT_WINDOW_SECONDS,
    )
    return await get_status()
