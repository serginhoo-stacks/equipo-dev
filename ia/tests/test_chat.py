from __future__ import annotations

import pytest

from ia.routes import chat as chat_route


@pytest.mark.parametrize("payload", [{"mensagem": "Como registrar uma inspeção?"}, {"message": "Como registrar uma inspeção?"}])
def test_chat_uses_current_contract(client, monkeypatch, payload):
    async def fake_chat_completion(messages, **kwargs):
        assert messages[-1]["content"] == "Como registrar uma inspeção?"
        return "Use a área de inspeções do ERP."

    monkeypatch.setattr(chat_route, "chat_completion", fake_chat_completion)
    response = client.post("/api/chat-ia", json=payload)
    assert response.status_code == 200
    assert response.json() == {"resposta": "Use a área de inspeções do ERP."}


def test_chat_rejects_empty_message(client):
    response = client.post("/api/chat-ia", json={"mensagem": "   "})
    assert response.status_code == 422
    assert response.json() == {"erro": "Dados inválidos ou fora dos limites permitidos."}


def test_chat_rejects_oversized_message(client):
    response = client.post("/api/chat-ia", json={"mensagem": "x" * 5001})
    assert response.status_code == 422
