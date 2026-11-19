"""Configuração do backend SmartInspect AI.

Carrega apenas ia/.env (se existir); não importa o .env da raiz do repositório.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().with_name(".env"), override=False)


def _int_env(name: str, default: int, minimum: int = 1) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"Configuração inválida: {name} deve ser inteiro.") from exc
    if value < minimum:
        raise RuntimeError(f"Configuração inválida: {name} deve ser maior ou igual a {minimum}.")
    return value


def _csv_env(name: str, default: str) -> tuple[str, ...]:
    return tuple(item.strip().rstrip("/") for item in os.getenv(name, default).split(",") if item.strip())


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
# Use apenas a chave pública anon/publishable. Nunca configure service_role neste serviço.
SUPABASE_API_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or ""
).strip()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip().rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3-vl:2b-instruct").strip()
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", OLLAMA_MODEL).strip()
OLLAMA_TIMEOUT_SECONDS = _int_env("OLLAMA_TIMEOUT_SECONDS", 120)

CORS_ORIGINS = _csv_env(
    "CORS_ORIGINS",
    "https://www.smartinspect.com.br,https://smartinspect.com.br,http://localhost:5500,http://127.0.0.1:5500",
)

MAX_IMAGE_BYTES = _int_env("MAX_IMAGE_BYTES", 10 * 1024 * 1024)
MAX_IMAGE_PIXELS = _int_env("MAX_IMAGE_PIXELS", 20_000_000)
RATE_LIMIT_WINDOW_SECONDS = _int_env("RATE_LIMIT_WINDOW_SECONDS", 60)
CHAT_RATE_LIMIT = _int_env("CHAT_RATE_LIMIT", 20)
IMAGE_RATE_LIMIT = _int_env("IMAGE_RATE_LIMIT", 5)
SUPPORT_RATE_LIMIT = _int_env("SUPPORT_RATE_LIMIT", 20)
