from __future__ import annotations

from uuid import UUID

import httpx
from fastapi import HTTPException

from ia import config
from ia.security.authentication import AuthenticatedUser


async def load_active_memberships(user: AuthenticatedUser) -> list[dict[str, str]]:
    """Lê somente os vínculos próprios; a query é enviada com o JWT do usuário, não service_role."""
    if not config.SUPABASE_URL or not config.SUPABASE_API_KEY:
        raise HTTPException(status_code=503, detail="A autorização Supabase não está configurada.")

    headers = {
        "apikey": config.SUPABASE_API_KEY,
        "Authorization": f"Bearer {user.access_token}",
        "Accept": "application/json",
    }
    params = {
        "select": "empresa_id,cargo",
        "usuario_id": f"eq.{user.user_id}",
        "ativo": "eq.true",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(
                f"{config.SUPABASE_URL}/rest/v1/membros_empresa",
                headers=headers,
                params=params,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Não foi possível validar o vínculo empresarial.") from exc

    if response.status_code in (401, 403):
        raise HTTPException(status_code=403, detail="Sem permissão para consultar o vínculo empresarial.")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="O serviço de autorização está indisponível.")

    try:
        rows = response.json()
    except ValueError:
        raise HTTPException(status_code=503, detail="Resposta inválida do serviço de autorização.") from None

    if not isinstance(rows, list):
        raise HTTPException(status_code=503, detail="Resposta inválida do serviço de autorização.")

    memberships: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            company_id = str(UUID(str(row["empresa_id"])))
        except (ValueError, KeyError, TypeError):
            continue
        cargo = row.get("cargo")
        memberships.append({
            "empresa_id": company_id,
            "cargo": cargo if isinstance(cargo, str) else "colaborador",
        })
    return memberships


async def ensure_company_access(user: AuthenticatedUser, company_id: UUID) -> dict[str, str]:
    """Confirma que a empresa solicitada está entre os vínculos ativos do usuário."""
    memberships = await load_active_memberships(user)
    requested = str(company_id)
    for membership in memberships:
        if membership["empresa_id"] == requested:
            return membership
    raise HTTPException(status_code=403, detail="Você não possui acesso ativo a esta empresa.")
