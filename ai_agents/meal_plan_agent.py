"""
Agente de planificación de comidas (nutrition plan) para IA Fitness.

Genera un reparto de kcal y macros por comida del día (desayuno, almuerzo,
comida/merienda, cena, etc.) a partir de:
- kcal objetivo diarias
- macros diarias (opcional)
- número de comidas/día
- preferencias y exclusiones

Si no hay OpenAI disponible, usa un backend mock determinístico que reparte
calorías y macros y sugiere alimentos ejemplo genéricos.
"""

from __future__ import annotations

import os
import json
from typing import Any, Dict, Optional, List


def build_meal_prompt(context_json: str) -> str:
    return f"""
SYSTEM: Eres un nutricionista deportivo certificado. Devuelve SOLO JSON válido.

Objetivo: crear un plan diario de comidas (n={ '{meals}' }) a partir de kcal y macros objetivo.
Incluye reparto por comida y ejemplos de alimentos por comida, con cantidades.

CONTEXTO_JSON:
{context_json}

Formato de salida (SOLO JSON):
{{
  "total_kcal": int,
  "meals": [
    {{"name": "Desayuno"|"Almuerzo"|"Comida"|"Merienda"|"Cena"|string,
      "kcal": int,
      "macros": {{"protein": int, "carbs": int, "fat": int}},
      "items": [{{"food": string, "qty": string, "kcal": int}}]
    }}
  ],
  "tips": [string]
}}
"""


class MealPlanAgent:
    def __init__(self, model: Optional[str] = None) -> None:
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.init_error = None

        import logging
        logger = logging.getLogger("ai_fitness")

        self._use_openai = bool(self.api_key)
        if self._use_openai:
            try:
                from openai import OpenAI  # type: ignore
                self._client = OpenAI(api_key=self.api_key)
                logger.info(f"MealPlanAgent initialized with OpenAI model: {self.model}")
            except Exception as e:
                self.init_error = str(e)
                logger.error(f"Failed to initialize OpenAI client in MealPlanAgent: {e}")
                self._use_openai = False
                self._client = None
        else:
            self.init_error = "OPENAI_API_KEY missing"
            logger.warning("MealPlanAgent: OPENAI_API_KEY not found or empty. Using mock.")
            self._client = None

    def backend(self) -> str:
        return f"openai:{self.model}" if self._use_openai else "mock"

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] MealPlanAgent start | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            getattr(self, "init_error", None),
        )
        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_meal_prompt(context_str)
        if self._use_openai:
            try:
                return self._run_openai(prompt)
            except Exception:
                return self._run_mock(context)
        return self._run_mock(context)

    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(
                "[AgentRun] MealPlanAgent openai call | model=%s",
                self.model,
            )
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres nutricionista. Devuelve SOLO JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            logger.info(
                "[AgentRun] MealPlanAgent openai success | content_len=%s",
                len(content),
            )
            return json.loads(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"MealPlanAgent OpenAI call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"openai_error: {str(e)}"})

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] MealPlanAgent mock fallback | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            getattr(self, "init_error", None),
        )
        total_kcal = int(float(context.get("total_kcal", 2200)))
        meals = int(context.get("meals", 4) or 4)
        meals = max(3, min(6, meals))

        macros = context.get("macros") or {}
        p = float(macros.get("protein", 160) or 160)
        c = float(macros.get("carbs", 250) or 250)
        f = float(macros.get("fat", 70) or 70)

        # Reparto por comida (heurística)
        if meals == 3:
            split = [0.3, 0.4, 0.3]
            names = ["Desayuno", "Comida", "Cena"]
        elif meals == 4:
            split = [0.25, 0.35, 0.15, 0.25]
            names = ["Desayuno", "Comida", "Snack", "Cena"]
        elif meals == 5:
            split = [0.22, 0.3, 0.12, 0.16, 0.2]
            names = ["Desayuno", "Comida", "Snack", "Merienda", "Cena"]
        else:
            # 6 comidas
            split = [0.2, 0.25, 0.1, 0.15, 0.1, 0.2]
            names = ["Desayuno", "Media mañana", "Comida", "Snack", "Merienda", "Cena"]

        total_ratio = sum(split)
        split = [x / total_ratio for x in split]

        meals_out: List[Dict[str, Any]] = []
        for i, r in enumerate(split):
            mkcal = round(total_kcal * r)
            mp = round(p * r)
            mc = round(c * r)
            mf = round(f * r)
            items = [
                {"food": "Avena + Yogur griego + Fruta", "qty": "1 taza + 150 g + 1", "kcal": mkcal//2},
                {"food": "Huevos/Pollo/Pescado (según comida)", "qty": "120-160 g", "kcal": mkcal - mkcal//2},
            ]
            meals_out.append({
                "name": names[i] if i < len(names) else f"Comida {i+1}",
                "kcal": mkcal,
                "macros": {"protein": mp, "carbs": mc, "fat": mf},
                "items": items,
            })

        return {
            "total_kcal": total_kcal,
            "meals": meals_out,
            "tips": [
                "Ajusta por saciedad y preferencia sin exceder calorías.",
                "Hidrátate y prioriza proteína en cada comida.",
            ],
        }

