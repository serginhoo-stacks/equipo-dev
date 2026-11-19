from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SupportRequest(BaseModel):
    mensagem: str = Field(min_length=3, max_length=5_000)
    empresa_id: UUID | None = None

    @field_validator("mensagem", mode="before")
    @classmethod
    def trim_message(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("A mensagem não pode ficar vazia.")
        return value


class SupportTriage(BaseModel):
    categoria: Literal[
        "acesso", "obras", "inspecoes", "imoveis", "estoque", "equipe",
        "relatorios", "suporte", "configuracoes", "pagamento", "outro",
    ]
    urgencia: Literal["baixa", "media", "alta"]
    encaminhar_humano: bool
    resumo: str = Field(min_length=1, max_length=800)
    resposta_sugerida: str = Field(min_length=1, max_length=3_000)


class SupportResponse(SupportTriage):
    resposta: str
