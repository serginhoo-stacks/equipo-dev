from __future__ import annotations

from typing import Any

import httpx

from ia import config


class OllamaUnavailable(RuntimeError):
    """Ollama indisponível, modelo ausente ou resposta inválida."""


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    images: list[str] | None = None,
    response_format: str | None = None,
    timeout_seconds: int | None = None,
) -> str:
    selected_model = model or config.OLLAMA_MODEL
    if not selected_model:
        raise OllamaUnavailable("Modelo não configurado.")

    request_messages = [dict(message) for message in messages]
    if images:
        if not request_messages or request_messages[-1].get("role") != "user":
            raise ValueError("Imagens devem acompanhar a última mensagem do usuário.")
        request_messages[-1]["images"] = images

    payload: dict[str, Any] = {
        "model": selected_model,
        "messages": request_messages,
        "stream": False,
    }
    if response_format:
        payload["format"] = response_format

    try:
        async with httpx.AsyncClient(
            timeout=timeout_seconds or config.OLLAMA_TIMEOUT_SECONDS,
            follow_redirects=False,
        ) as client:
            response = await client.post(
                f"{config.OLLAMA_BASE_URL}/api/chat",
                json=payload,
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise OllamaUnavailable("O Ollama excedeu o tempo limite.") from exc
    except httpx.HTTPStatusError as exc:
        # Não propagar o corpo do Ollama, que pode incluir prompts ou dados da requisição.
        raise OllamaUnavailable(f"O Ollama respondeu HTTP {exc.response.status_code}.") from exc
    except httpx.RequestError as exc:
        raise OllamaUnavailable("Não foi possível conectar ao Ollama.") from exc

    try:
        data = response.json()
        content = data["message"]["content"]
    except (ValueError, KeyError, TypeError):
        raise OllamaUnavailable("O Ollama retornou uma resposta inválida.") from None

    if not isinstance(content, str) or not content.strip():
        raise OllamaUnavailable("O Ollama não retornou conteúdo.")
    return content.strip()


async def get_status() -> dict[str, Any]:
    """Confere a API /api/tags e a presença dos modelos configurados."""
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.get(f"{config.OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
        payload = response.json()
        model_rows = payload.get("models", []) if isinstance(payload, dict) else []
        installed = {
            item.get("name")
            for item in model_rows
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        }
        # Ollama pode exibir nome com ou sem :latest.
        def is_installed(name: str) -> bool:
            return name in installed or (":" not in name and f"{name}:latest" in installed)

        chat_available = is_installed(config.OLLAMA_MODEL)
        vision_available = is_installed(config.OLLAMA_VISION_MODEL)
        return {
            "ollama_disponivel": True,
            "chat_modelo": config.OLLAMA_MODEL,
            "chat_modelo_disponivel": chat_available,
            "modelo_visao": config.OLLAMA_VISION_MODEL,
            "modelo_visao_disponivel": vision_available,
            "modelos_instalados": sorted(installed),
        }
    except (httpx.HTTPError, ValueError, TypeError):
        return {
            "ollama_disponivel": False,
            "chat_modelo": config.OLLAMA_MODEL,
            "chat_modelo_disponivel": False,
            "modelo_visao": config.OLLAMA_VISION_MODEL,
            "modelo_visao_disponivel": False,
            "modelos_instalados": [],
        }
