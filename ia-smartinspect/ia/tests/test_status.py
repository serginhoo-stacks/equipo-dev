from __future__ import annotations

from ia import server


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_authenticated_ia_status(client, monkeypatch):
    expected = {
        "ollama_disponivel": False,
        "chat_modelo": "qwen3-vl:2b-instruct",
        "chat_modelo_disponivel": False,
        "modelo_visao": "qwen3-vl:2b-instruct",
        "modelo_visao_disponivel": False,
        "modelos_instalados": [],
    }

    async def fake_status():
        return expected

    monkeypatch.setattr(server, "get_status", fake_status)
    response = client.get("/api/ia/status")
    assert response.status_code == 200
    assert response.json() == expected
