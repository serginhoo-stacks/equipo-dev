from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Header, HTTPException

from ia import config


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None
    access_token: str


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    """Valida o bearer token com Supabase Auth; não decodifica JWT sem verificá-lo."""
    if not config.SUPABASE_URL or not config.SUPABASE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="A autenticação Supabase não está configurada no backend.",
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sessão necessária.")

    access_token = authorization[7:].strip()
    if not access_token or len(access_token) > 8_192:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")

    headers = {
        "apikey": config.SUPABASE_API_KEY,
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(
                f"{config.SUPABASE_URL}/auth/v1/user",
                headers=headers,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="Não foi possível validar a sessão no Supabase.",
        ) from exc

    if response.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail="O serviço de autenticação está indisponível.",
        )

    try:
        payload = response.json()
        user_id = str(UUID(str(payload["id"])))
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.") from None

    email = payload.get("email") if isinstance(payload.get("email"), str) else None
    return AuthenticatedUser(
        user_id=user_id,
        email=email,
        access_token=access_token,
    )
