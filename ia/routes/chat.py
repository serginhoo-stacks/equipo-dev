from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ia import config
from ia.prompts import SMARTINSPECT_SYSTEM_PROMPT
from ia.schemas.chat_schema import ChatRequest, ChatResponse
from ia.security.authentication import AuthenticatedUser, get_current_user
from ia.security.permissions import ensure_company_access
from ia.security.validation import enforce_user_rate_limit
from ia.services.ollama_service import OllamaUnavailable, chat_completion

router = APIRouter(tags=["SmartInspect AI"])


@router.post("/chat-ia", response_model=ChatResponse)
async def chat_ia(
    payload: ChatRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ChatResponse:
    await enforce_user_rate_limit(
        user.user_id,
        "chat",
        config.CHAT_RATE_LIMIT,
        config.RATE_LIMIT_WINDOW_SECONDS,
    )
    if payload.empresa_id is not None:
        await ensure_company_access(user, payload.empresa_id)

    try:
        answer = await chat_completion(
            [
                {"role": "system", "content": SMARTINSPECT_SYSTEM_PROMPT},
                {"role": "user", "content": payload.mensagem},
            ],
            model=config.OLLAMA_MODEL,
        )
    except OllamaUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="A IA está indisponível no momento. Tente novamente mais tarde.",
        ) from exc

    return ChatResponse(resposta=answer)
