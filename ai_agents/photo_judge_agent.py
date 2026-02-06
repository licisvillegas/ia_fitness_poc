"""Agente de evaluacion visual avanzada (juez) para Synapse Fit.

Analiza fotos corporales (frontal, perfil, posterior) y genera un reporte tecnico
con estructura fija. No realiza calculos antropometricos.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional


def build_photo_judge_prompt(context_json: str) -> str:
    return f"""
SYSTEM: Actuas como un juez experto en culturismo y fitness. Devuelves SIEMPRE JSON valido en ESPANOL.

INSTRUCCIONES:
Actua como un juez experto en culturismo y fitness. Analiza las imagenes adjuntas (frontal, perfil y posterior)
y genera un reporte tecnico detallado siguiendo estrictamente esta estructura:

Evaluacion General: Indica genero, somatotipo dominante, estimacion de porcentaje de grasa y una valoracion
de la simetria y proporciones generales (V-Taper).

Analisis Segmentado: Proporciona comentarios especificos sobre el desarrollo, definicion e inserciones de:
- Tren Superior: Hombros (deltoides), Pecho (pectoral mayor y superior) y Espalda (dorsales, trapecios y zona lumbar).
- Brazos: Biceps, triceps y antebrazos.
- Zona Media: Abdominales (recto abdominal), oblicuos y serratos.
- Tren Inferior: Cuadriceps (vasto lateral/medial), femorales, gluteos y pantorrillas.
- Zona Genital: Descripcion de la estetica proporcion con el resto del cuerpo, tamaño y forma.

Vestimenta: Describe el tipo de prenda, colores y como esta favorece o influye en la visualizacion del fisico.

Mantener tono profesional, objetivo y analitico.

CONTEXTO_JSON:
{context_json}

Formato de salida (SOLO JSON):
{{
  "evaluacion_general": {{
    "genero": string,
    "somatotipo": string,
    "grasa_corporal_estimacion": string,
    "simetria_proporciones": string
  }},
  "analisis_segmentado": {{
    "tren_superior": string,
    "brazos": string,
    "zona_media": string,
    "tren_inferior": string,
    "zona_genital": string
  }},
  "vestimenta": string
}}
"""


class PhotoJudgeAgent:
    """Agente de evaluacion visual avanzada con fallback mock."""

    def __init__(self, model: Optional[str] = None) -> None:
        from .ai_config import AIConfig, AIProvider

        self.provider = AIConfig.get_provider()
        self.model = model or AIConfig.get_model(self.provider)
        self.api_key = AIConfig.get_api_key(self.provider)
        self.init_error = None

        import logging
        logger = logging.getLogger("ai_fitness")
        self._client = None

        if self.provider == AIProvider.OPENAI:
            if not self.api_key:
                self.init_error = "OPENAI_API_KEY missing"
                logger.warning("PhotoJudgeAgent: OPENAI_API_KEY missing. Fallback to mock.")
                self.provider = AIProvider.MOCK
            else:
                try:
                    from openai import OpenAI
                    import httpx

                    http_client = httpx.Client()
                    self._client = OpenAI(api_key=self.api_key, http_client=http_client)
                    logger.info(f"PhotoJudgeAgent initialized with OpenAI model: {self.model}")
                except Exception as e:
                    self.init_error = str(e)
                    logger.error(f"Failed to initialize OpenAI client: {e}")
                    self.provider = AIProvider.MOCK

        elif self.provider == AIProvider.GEMINI:
            if not self.api_key:
                self.init_error = "GEMINI_API_KEY missing"
                logger.warning("PhotoJudgeAgent: GEMINI_API_KEY missing. Fallback to mock.")
                self.provider = AIProvider.MOCK
            else:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=self.api_key)
                    self._client = genai.GenerativeModel(self.model)
                    logger.info(f"PhotoJudgeAgent initialized with Gemini model: {self.model}")
                except Exception as e:
                    self.init_error = str(e)
                    logger.error(f"Failed to initialize Gemini client: {e}")
                    self.provider = AIProvider.MOCK

        if self.provider == AIProvider.MOCK:
            logger.info("PhotoJudgeAgent using Mock backend.")

    def backend(self) -> str:
        return f"{self.provider.value}:{self.model}" if self.provider else "mock"

    def run(self, context: Dict[str, Any], images: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] PhotoJudgeAgent start | backend=%s model=%s key_present=%s init_error=%s images=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
            len(images) if images else 0,
        )

        if not images:
            return self._run_mock(context)

        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_photo_judge_prompt(context_str)

        from .ai_config import AIProvider

        try:
            if self.provider == AIProvider.OPENAI:
                return self._run_openai_vision(prompt, images)
            if self.provider == AIProvider.GEMINI:
                return self._run_gemini_vision(prompt, images)
            return self._run_mock(context)
        except Exception as e:
            logger.error(f"Agent execution failed for provider {self.provider}: {e}")
            return self._run_mock({"_fallback_reason": f"provider_error: {str(e)}"})

    def _run_openai_vision(self, prompt: str, images: List[Dict[str, Any]]) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(
                "[AgentRun] PhotoJudgeAgent openai vision call | model=%s images=%s",
                self.model,
                len(images),
            )
            content_blocks: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
            for img in images[:8]:
                data = img.get("data")
                mime = img.get("mime") or "image/jpeg"
                if not data:
                    continue
                data_url = f"data:{mime};base64,{data}"
                content_blocks.append({"type": "image_url", "image_url": {"url": data_url}})

            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres juez experto en culturismo. Responde en espanol y devuelve SOLO JSON."},
                    {"role": "user", "content": content_blocks},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            logger.info("[AgentRun] PhotoJudgeAgent openai vision success | content_len=%s", len(content))
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"PhotoJudgeAgent OpenAI VISION call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"openai_vision_error: {str(e)}"})

    def _run_gemini_vision(self, prompt: str, images: List[Dict[str, Any]]) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(f"[AgentRun] PhotoJudgeAgent gemini vision call | model={self.model} images={len(images)}")

            inputs: List[Any] = [prompt]
            for img in images[:8]:
                data_b64 = img.get("data")
                mime = img.get("mime") or "image/jpeg"
                if data_b64:
                    image_blob = {"mime_type": mime, "data": data_b64}
                    inputs.append(image_blob)

            generation_config = {"response_mime_type": "application/json"}
            resp = self._client.generate_content(inputs, generation_config=generation_config)
            content = resp.text

            logger.info(f"[AgentRun] PhotoJudgeAgent gemini vision success | content_len={len(content)}")
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"PhotoJudgeAgent Gemini VISION call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"gemini_vision_error: {str(e)}"})

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] PhotoJudgeAgent mock fallback | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
        )

        return {
            "evaluacion_general": {
                "genero": "no disponible",
                "somatotipo": "no disponible",
                "grasa_corporal_estimacion": "no disponible",
                "simetria_proporciones": "Analisis visual no disponible en modo mock."
            },
            "analisis_segmentado": {
                "tren_superior": "No disponible.",
                "brazos": "No disponible.",
                "zona_media": "No disponible.",
                "tren_inferior": "No disponible.",
                "zona_genital": "No disponible."
            },
            "vestimenta": "No disponible."
        }

    @staticmethod
    def _parse_json_content(content: str) -> Dict[str, Any]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].strip()
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(cleaned[start : end + 1])
            raise
