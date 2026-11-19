from __future__ import annotations

from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    mensagem: str = Field(
        validation_alias=AliasChoices("mensagem", "message"),
        min_length=1,
        max_length=5_000,
    )
    empresa_id: UUID | None = None

    @field_validator("mensagem", mode="before")
    @classmethod
    def trim_message(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("A mensagem não pode ficar vazia.")
        return value


class ChatResponse(BaseModel):
    resposta: str
