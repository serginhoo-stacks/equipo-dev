from pydantic import BaseModel, Field


class ImageAnalysisResponse(BaseModel):
    analise: str = Field(min_length=1)
    resposta: str = Field(min_length=1)


class ImageStatusResponse(BaseModel):
    ollama_disponivel: bool
    modelo_analise: str
    modelo_disponivel: bool
