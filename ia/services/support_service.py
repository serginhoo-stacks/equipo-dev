from __future__ import annotations

import json

from pydantic import ValidationError

from ia.prompts import SUPPORT_SYSTEM_PROMPT
from ia.schemas.support_schema import SupportTriage
from ia.services.ollama_service import OllamaUnavailable, chat_completion


async def classify_support(message: str) -> SupportTriage:
    raw = await chat_completion(
        [
            {"role": "system", "content": SUPPORT_SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        response_format="json",
    )
    try:
        parsed = json.loads(raw)
        return SupportTriage.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError, TypeError):
        # Não inventa um resultado de triagem quando o modelo não respeita o contrato.
        raise OllamaUnavailable("A resposta de triagem não corresponde ao formato esperado.") from None
