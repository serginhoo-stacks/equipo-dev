from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ia import config
from ia.schemas.support_schema import SupportRequest, SupportResponse
from ia.security.authentication import AuthenticatedUser, get_current_user
from ia.security.permissions import ensure_company_access, load_active_memberships
from ia.security.validation import enforce_user_rate_limit
from ia.services.ollama_service import OllamaUnavailable
from ia.services.support_service import classify_support

router = APIRouter(tags=["SmartInspect Support"])


@router.post("/suporte-ia", response_model=SupportResponse)
async def support_triage(
    payload: SupportRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> SupportResponse:
    await enforce_user_rate_limit(
        user.user_id,
        "support",
        config.SUPPORT_RATE_LIMIT,
        config.RATE_LIMIT_WINDOW_SECONDS,
    )

    if payload.empresa_id is not None:
        await ensure_company_access(user, payload.empresa_id)
    else:
        memberships = await load_active_memberships(user)
        if not memberships:
            raise HTTPException(
                status_code=403,
                detail="É necessário ter vínculo ativo com uma empresa para usar o suporte do ERP.",
            )
        if len(memberships) > 1:
            raise HTTPException(
                status_code=400,
                detail="Informe a empresa ativa para contextualizar esta solicitação.",
            )

    try:
        triage = await classify_support(payload.mensagem)
    except OllamaUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="A triagem de suporte está indisponível no momento.",
        ) from exc

    return SupportResponse(
        **triage.model_dump(),
        resposta=triage.resposta_sugerida,
    )
