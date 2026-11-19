from __future__ import annotations

import base64
import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from ia import config
from ia.prompts import IMAGE_ANALYSIS_PROMPT
from ia.services.ollama_service import chat_completion

_ALLOWED_FORMATS = {
    "image/jpeg": {"JPEG"},
    "image/png": {"PNG"},
    "image/webp": {"WEBP"},
}


class InvalidImage(ValueError):
    """Formato, tamanho ou conteúdo de imagem não permitido."""


def _decode_and_normalize(content: bytes, expected_formats: set[str]) -> bytes:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                actual_format = source.format
                width, height = source.size
                source.verify()
            if actual_format not in expected_formats:
                raise InvalidImage("O conteúdo não corresponde ao formato declarado.")
            if width < 1 or height < 1 or width * height > config.MAX_IMAGE_PIXELS:
                raise InvalidImage("A resolução da imagem excede o limite permitido.")

            # Decodifica integralmente, aplica orientação e descarta EXIF/outros metadados.
            with Image.open(io.BytesIO(content)) as source:
                source.load()
                image = ImageOps.exif_transpose(source)
                if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                    rgba = image.convert("RGBA")
                    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                    background.alpha_composite(rgba)
                    normalized = background.convert("RGB")
                else:
                    normalized = image.convert("RGB")
                output = io.BytesIO()
                normalized.save(output, format="JPEG", quality=92, optimize=True)
                return output.getvalue()
    except InvalidImage:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning, ValueError):
        raise InvalidImage("O arquivo enviado não é uma imagem válida ou excede os limites.") from None


async def analyze_image(content: bytes, declared_content_type: str) -> str:
    if not content:
        raise InvalidImage("O arquivo está vazio.")
    if len(content) > config.MAX_IMAGE_BYTES:
        raise InvalidImage("A imagem excede o tamanho máximo permitido.")

    expected_formats = _ALLOWED_FORMATS.get(declared_content_type.lower())
    if expected_formats is None:
        raise InvalidImage("Formato não permitido. Use JPEG, PNG ou WebP.")

    normalized_jpeg = _decode_and_normalize(content, expected_formats)
    image_b64 = base64.b64encode(normalized_jpeg).decode("ascii")
    return await chat_completion(
        [
            {"role": "system", "content": IMAGE_ANALYSIS_PROMPT},
            {
                "role": "user",
                "content": "Analise a fotografia anexada conforme as instruções de segurança e limitações.",
            },
        ],
        model=config.OLLAMA_VISION_MODEL,
        images=[image_b64],
    )
