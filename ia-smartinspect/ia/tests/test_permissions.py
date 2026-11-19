from __future__ import annotations

import asyncio

from ia import config
from ia.security.authentication import AuthenticatedUser
from ia.security import permissions


class FakeResponse:
    status_code = 200

    @staticmethod
    def json():
        return [{"empresa_id": "22222222-2222-4222-8222-222222222222", "cargo": "gestor"}]


class FakeAsyncClient:
    def __init__(self, **kwargs):
        self.url = None
        self.headers = None
        self.params = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url, headers=None, params=None, **kwargs):
        self.url = url
        self.headers = headers
        self.params = params
        return FakeResponse()


def test_membership_query_uses_user_jwt_and_rls(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://project.example.invalid")
    monkeypatch.setattr(config, "SUPABASE_API_KEY", "public-test-key")
    fake_client = FakeAsyncClient()

    def factory(**kwargs):
        nonlocal fake_client
        fake_client = FakeAsyncClient(**kwargs)
        return fake_client

    monkeypatch.setattr(permissions.httpx, "AsyncClient", factory)
    user = AuthenticatedUser(
        user_id="11111111-1111-4111-8111-111111111111",
        email="test@example.invalid",
        access_token="user-session-token",
    )
    memberships = asyncio.run(permissions.load_active_memberships(user))

    assert memberships == [{"empresa_id": "22222222-2222-4222-8222-222222222222", "cargo": "gestor"}]
    assert fake_client.url.endswith("/rest/v1/membros_empresa")
    assert fake_client.headers["Authorization"] == "Bearer user-session-token"
    assert fake_client.headers["apikey"] == "public-test-key"
    assert fake_client.params["usuario_id"] == f"eq.{user.user_id}"
    assert fake_client.params["ativo"] == "eq.true"
