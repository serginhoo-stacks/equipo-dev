from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ia import config
from ia.schemas.image_schema import ImageAnalysisResponse
from ia.security.authentication import AuthenticatedUser, get_current_user
from ia.security.permissions import ensure_company_access
from ia.security.validation import enforce_user_rate_limit
from ia.services.image_service import InvalidImage, analyze_image
from ia.services.ollama_service import OllamaUnavailable

router = APIRouter(tags=["Análise de imagens"])


@router.post("/analisar-imagem", response_model=ImageAnalysisResponse)
async def analyze_construction_image(
    imagem: UploadFile = File(...),
    empresa_id: UUID | None = Form(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
) -> ImageAnalysisResponse:
    await enforce_user_rate_limit(
        user.user_id,
        "image",
        config.IMAGE_RATE_LIMIT,
        config.RATE_LIMIT_WINDOW_SECONDS,
    )
    if empresa_id is not None:
        await ensure_company_access(user, empresa_id)

    if not imagem.content_type:
        raise HTTPException(status_code=415, detail="Formato de imagem não informado.")

    try:
        content = await imagem.read(config.MAX_IMAGE_BYTES + 1)
        if len(content) > config.MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="A imagem excede o limite de 10 MB.",
            )
        report = await analyze_image(content, imagem.content_type)
    except InvalidImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OllamaUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="O serviço de análise de imagem está indisponível.",
        ) from exc
    finally:
        await imagem.close()

    # Mantém compatibilidade com a página existente; nenhum arquivo é persistido.
    return ImageAnalysisResponse(analise=report, resposta=report)
