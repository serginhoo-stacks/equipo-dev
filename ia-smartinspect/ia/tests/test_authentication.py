from __future__ import annotations

from fastapi.testclient import TestClient

from ia import config
from ia.routes import chat as chat_route
from ia.security.authentication import get_current_user
from ia.server import app


class FakeResponse:
    status_code = 200

    @staticmethod
    def json():
        return {"id": "11111111-1111-4111-8111-111111111111", "email": "test@example.invalid"}


class FakeAsyncClient:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.headers = None
        self.url = None
        self.__class__.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url, headers=None, **kwargs):
        self.url = url
        self.headers = headers
        return FakeResponse()


def test_validates_bearer_token_with_supabase_auth(monkeypatch):
    from ia.security import authentication

    app.dependency_overrides.pop(get_current_user, None)
    monkeypatch.setattr(config, "SUPABASE_URL", "https://project.example.invalid")
    monkeypatch.setattr(config, "SUPABASE_API_KEY", "public-test-key")
    monkeypatch.setattr(authentication.httpx, "AsyncClient", FakeAsyncClient)

    async def fake_chat_completion(messages, **kwargs):
        return "Resposta de teste."

    monkeypatch.setattr(chat_route, "chat_completion", fake_chat_completion)
    FakeAsyncClient.instances.clear()
    with TestClient(app) as client:
        response = client.post(
            "/api/chat-ia",
            headers={"Authorization": "Bearer valid-test-token"},
            json={"mensagem": "Teste"},
        )

    assert response.status_code == 200
    assert response.json() == {"resposta": "Resposta de teste."}
    call = FakeAsyncClient.instances[0]
    assert call.url.endswith("/auth/v1/user")
    assert call.headers["Authorization"] == "Bearer valid-test-token"
    assert call.headers["apikey"] == "public-test-key"


def test_rejects_missing_bearer_token_before_network(monkeypatch):
    from ia.security import authentication

    app.dependency_overrides.pop(get_current_user, None)
    monkeypatch.setattr(config, "SUPABASE_URL", "https://project.example.invalid")
    monkeypatch.setattr(config, "SUPABASE_API_KEY", "public-test-key")
    FakeAsyncClient.instances.clear()
    with TestClient(app) as client:
        response = client.post("/api/chat-ia", json={"mensagem": "Teste"})
    assert response.status_code == 401
    assert response.json()["erro"] == "Sessão necessária."
    assert not FakeAsyncClient.instances
