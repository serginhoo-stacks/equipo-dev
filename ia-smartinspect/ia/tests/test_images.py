from __future__ import annotations

import asyncio
import base64
import io

from PIL import Image

from ia.routes import images as images_route
from ia.services import image_service


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), color=(20, 100, 180)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_image_endpoint_uses_current_multipart_contract(client, monkeypatch):
    async def fake_analyze(content, declared_content_type):
        assert content.startswith(b"\x89PNG")
        assert declared_content_type == "image/png"
        return "Descrição visual: imagem de teste."

    monkeypatch.setattr(images_route, "analyze_image", fake_analyze)
    response = client.post(
        "/api/analisar-imagem",
        files={"imagem": ("obra.png", _png_bytes(), "image/png")},
    )
    assert response.status_code == 200
    assert response.json() == {
        "analise": "Descrição visual: imagem de teste.",
        "resposta": "Descrição visual: imagem de teste.",
    }


def test_image_endpoint_rejects_unsupported_type_without_model_call(client, monkeypatch):
    async def should_not_run(*args, **kwargs):
        raise AssertionError("O modelo não deve ser chamado para tipo não permitido.")

    monkeypatch.setattr(image_service, "chat_completion", should_not_run)
    response = client.post(
        "/api/analisar-imagem",
        files={"imagem": ("arquivo.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 422
    assert "formato" in response.json()["erro"].lower()


def test_image_service_normalizes_to_jpeg_before_model(monkeypatch):
    received = {}

    async def fake_chat_completion(messages, **kwargs):
        received.update(kwargs)
        return "Análise de teste."

    monkeypatch.setattr(image_service, "chat_completion", fake_chat_completion)
    result = asyncio.run(image_service.analyze_image(_png_bytes(), "image/png"))
    normalized = base64.b64decode(received["images"][0])
    with Image.open(io.BytesIO(normalized)) as image:
        assert image.format == "JPEG"
        assert image.getexif() == {}
    assert received["model"]
    assert result == "Análise de teste."
