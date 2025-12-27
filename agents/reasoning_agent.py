"""
Agente de razonamiento para IA Fitness.

Qué hace:
- Genera ajustes de nutrición y entrenamiento a partir de un contexto JSON
  (p. ej., historial de progreso), devolviendo SOLO un JSON con campos
  estructurados: ajustes de kcal/macros, volumen/cardio, un razonamiento
  resumido y la próxima revisión en días.

Cómo está configurado:
- Si existe la variable de entorno `OPENAI_API_KEY`, intenta usar OpenAI
  (modelo configurable con `OPENAI_MODEL`, por defecto `gpt-4o`).
- Si no hay clave o hay error al llamar a OpenAI, utiliza un backend "mock"
  determinístico (sin red) con heurísticas simples para pruebas locales.

Puntos de extensión:
- Ajusta `build_reasoning_prompt` si quieres cambiar el prompt del agente.
- Modifica `_run_mock` para alterar la lógica offline y facilitar tests.
"""

import json
import os
from typing import Any, Dict, Optional


def build_reasoning_prompt(context_json: str) -> str:
    """Construye el prompt del agente en español.

    Recibe el contexto ya serializado a JSON y devuelve el mensaje
    con las instrucciones del sistema y el formato de salida requerido.
    """
    return f"""
SYSTEM: Eres un entrenador y nutricionista certificado. Actúas como agente autónomo.
Objetivo: mejorar composición corporal manteniendo adherencia y seguridad.

CONTEXTO_JSON:
{context_json}

TAREA:
1) Analiza estancamientos, adherencia y señales de fatiga.
2) Propón ajustes concretos (kcal, macros, volumen/series, cardio, descanso).
3) Explica el porqué en ≤120 palabras.
4) Sugiere fecha de revisión (días).

Devuelve SOLO JSON con:
{{
  "ajustes": {{
    "plan_alimentacion": {{"kcal_obj": int, "kcal_delta": int, "macros": {{"p": int, "c": int, "g": int}}}},
    "plan_entrenamiento": {{"volumen_delta_ratio": float, "cardio": "string"}}
  }},
  "razonamiento_resumido": "string",
  "proxima_revision_dias": int
}}
"""


class ReasoningAgent:
    """Agent wrapper that can call OpenAI or a local mock.

    If environment variable OPENAI_API_KEY is present, uses OpenAI responses.
    Otherwise falls back to a deterministic mock suitable for offline testing.
    """

    def __init__(self, model: Optional[str] = None) -> None:
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.init_error = None

        import logging
        logger = logging.getLogger("ai_fitness")
        
        self._use_openai = bool(self.api_key)
        if self._use_openai:
            try:
                # Lazy import so the package is optional for tests
                from openai import OpenAI  # type: ignore

                self._client = OpenAI(api_key=self.api_key)
                logger.info(f"ReasoningAgent initialized with OpenAI model: {self.model}")
            except Exception as e:
                # If OpenAI client cannot be initialized, fallback to mock
                self.init_error = str(e)
                logger.error(f"Failed to initialize OpenAI client: {e}")
                self._use_openai = False
                self._client = None
        else:
            self.init_error = "OPENAI_API_KEY missing"
            logger.warning("ReasoningAgent: OPENAI_API_KEY not found or empty. Using mock.")
            self._client = None

    def backend(self) -> str:
        """Indica el backend activo: 'openai:<modelo>' o 'mock'."""
        if self._use_openai:
            return f"openai:{self.model}"
        return f"mock ({self.init_error})" if self.init_error else "mock"

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Run the agent and return structured JSON as dict.

        The context dict should be serializable to JSON. If OpenAI is unavailable,
        produce a deterministic mock using simple heuristics on progress metrics.
        """
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] ReasoningAgentLegacy start | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
        )
        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_reasoning_prompt(context_str)

        if self._use_openai:
            return self._run_openai(prompt)
        return self._run_mock(context)

    # -------------------------
    # Backends
    # -------------------------
    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        """Call OpenAI responses API expecting JSON output."""
        # Using JSON mode via responses API (OpenAI Python SDK v1.x)
        try:
            # We default to text responses; user can switch to responses with JSON tool if desired.
            # Here we nudge with system+user content and parse JSON.
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(
                "[AgentRun] ReasoningAgentLegacy openai call | model=%s",
                self.model,
            )
            with open("agent_debug.log", "a", encoding="utf-8") as f:
                f.write(f"\n[ReasoningAgent] Requesting OpenAI: {self.model}\n")
            
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres un entrenador y nutricionista. Devuelve solo JSON válido."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            
            with open("agent_debug.log", "a", encoding="utf-8") as f:
                  f.write(f"[ReasoningAgent] Success. Content len: {len(content)}\n")
            
            logger.info(
                "[AgentRun] ReasoningAgentLegacy openai success | content_len=%s",
                len(content),
            )
            return json.loads(content)
        except Exception as e:
            # If anything fails, fallback to mock to keep UX smooth
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"ReasoningAgent OpenAI call failed: {e}", exc_info=True)
            
            with open("agent_debug.log", "a", encoding="utf-8") as f:
                f.write(f"[ReasoningAgent] FAIL: {str(e)}\n")

            return self._run_mock({"_fallback_reason": f"openai_error: {str(e)}"})

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Heuristic mock for offline/testing without API calls.

        Rules of thumb:
        - If recent body_fat reduction has stalled or worsened while adherence < 80, decrease kcal by 8-12%.
        - If performance dropped ≥5 points vs previous, reduce training volume by 10-15% and increase rest.
        - If gaining muscle (performance↑ and body_fat stable/↓), small kcal surplus +5-8%.
        - Cardio: add 2x-LISS 25-35' if fat loss stalled; otherwise maintain.
        """
        # Extract last two datapoints if present
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] ReasoningAgentLegacy mock fallback | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
        )
        items = []
        if isinstance(context, dict) and "progress" in context and isinstance(context["progress"], list):
            items = context["progress"][-2:]
        elif isinstance(context, list):
            items = context[-2:]

        def get(v: Dict[str, Any], key: str, default: Optional[float] = None) -> Optional[float]:
            try:
                return float(v.get(key))  # type: ignore[arg-type]
            except Exception:
                return default

        last = items[-1] if items else {}
        prev = items[-2] if len(items) == 2 else {}

        adherence = get(last, "nutrition_adherence", 85) or 85
        bf_last = get(last, "body_fat", None)
        bf_prev = get(prev, "body_fat", bf_last)
        perf_last = get(last, "performance", None)
        perf_prev = get(prev, "performance", perf_last)

        # Defaults
        kcal_obj = 2300
        kcal_delta = 0
        macros = {"p": 160, "c": 250, "g": 70}
        volumen_delta_ratio = 0.0
        cardio = "mantener 2x LISS 25'"
        razon = []
        revision = 10

        # Heuristics
        fat_stall = (bf_last is not None and bf_prev is not None and (bf_last >= bf_prev - 0.1))
        perf_drop = (perf_last is not None and perf_prev is not None and (perf_last - perf_prev) <= -5)
        perf_gain = (perf_last is not None and perf_prev is not None and (perf_last - perf_prev) >= 3)

        if fat_stall and adherence < 80:
            kcal_delta = -250
            razon.append("Ligero recorte calórico por baja adherencia y estancamiento de grasa")
            macros = {"p": 170, "c": 220, "g": 60}
            cardio = "añadir 2-3x LISS 30'"
            revision = 7
        elif perf_drop:
            volumen_delta_ratio = -0.12
            razon.append("Señales de fatiga: reducimos volumen y priorizamos recuperación")
            cardio = "mantener LISS suave 1-2x 20-25'"
            kcal_delta = +150  # pequeño soporte energético si hay fatiga
            revision = 7
        elif perf_gain and (bf_last is None or (bf_prev is not None and bf_last <= bf_prev)):
            kcal_delta = +180
            razon.append("Buen rendimiento estable: pequeño superávit para progresar")
            macros = {"p": 165, "c": 280, "g": 70}
            volumen_delta_ratio = +0.08
            cardio = "opcional LISS 1-2x 20'"
            revision = 10
        else:
            razon.append("Ajuste conservador manteniendo adherencia y seguridad")
            revision = 10

        # Compose response
        return {
            "ajustes": {
                "plan_alimentacion": {
                    "kcal_obj": max(1600, kcal_obj + kcal_delta),
                    "kcal_delta": kcal_delta,
                    "macros": macros,
                },
                "plan_entrenamiento": {
                    "volumen_delta_ratio": round(volumen_delta_ratio, 3),
                    "cardio": cardio,
                },
            },
            "razonamiento_resumido": "; ".join(razon)[:118],
            "proxima_revision_dias": revision,
        }
