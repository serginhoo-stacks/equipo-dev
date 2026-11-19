from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from ia.security.authentication import AuthenticatedUser, get_current_user
from ia.server import app


@pytest.fixture

def client() -> TestClient:
    test_user = AuthenticatedUser(
        user_id="11111111-1111-4111-8111-111111111111",
        email="tester@example.invalid",
        access_token="test-only-token",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
