from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from ia.routes import support as support_route
from ia.schemas.support_schema import SupportTriage


COMPANY_ID = UUID("22222222-2222-4222-8222-222222222222")


def test_support_returns_triage_for_member_company(client, monkeypatch):
    async def fake_company_access(user, requested_company):
        assert requested_company == COMPANY_ID
        return {"empresa_id": str(COMPANY_ID), "cargo": "admin"}

    async def fake_classify(message):
        assert message == "Não consigo acessar as inspeções."
        return SupportTriage(
            categoria="acesso",
            urgencia="media",
            encaminhar_humano=True,
            resumo="Relato de falha de acesso à área de inspeções.",
            resposta_sugerida="Confira se sua sessão está ativa e tente novamente.",
        )

    monkeypatch.setattr(support_route, "ensure_company_access", fake_company_access)
    monkeypatch.setattr(support_route, "classify_support", fake_classify)
    response = client.post(
        "/api/suporte-ia",
        json={"mensagem": "Não consigo acessar as inspeções.", "empresa_id": str(COMPANY_ID)},
    )
    assert response.status_code == 200
    assert response.json()["categoria"] == "acesso"
    assert response.json()["encaminhar_humano"] is True
    assert response.json()["resposta"] == "Confira se sua sessão está ativa e tente novamente."


def test_support_blocks_user_without_company_membership(client, monkeypatch):
    async def no_memberships(user):
        return []

    monkeypatch.setattr(support_route, "load_active_memberships", no_memberships)
    response = client.post("/api/suporte-ia", json={"mensagem": "Preciso de ajuda com o ERP."})
    assert response.status_code == 403
    assert "vínculo ativo" in response.json()["erro"]


def test_support_rejects_other_company(client, monkeypatch):
    async def own_company_only(user, requested_company):
        raise HTTPException(status_code=403, detail="Você não possui acesso ativo a esta empresa.")

    monkeypatch.setattr(support_route, "ensure_company_access", own_company_only)
    response = client.post(
        "/api/suporte-ia",
        json={
            "mensagem": "Ajuda, por favor.",
            "empresa_id": "33333333-3333-4333-8333-333333333333",
        },
    )
    assert response.status_code == 403
