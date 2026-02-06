"""Agente de metricas corporales para Synapse Fit.

Calcula composicion corporal, proporciones y recomendaciones a partir de
medidas antropometricas. No realiza analisis visual de fotos.
"""

from __future__ import annotations

import json
import math
from typing import Any, Dict, List, Optional


def build_body_metrics_prompt(context_json: str) -> str:
    """Construye el prompt del agente para calculos corporales."""

    return f"""
SYSTEM: Eres un coach de fitness y nutricion especializado en recomposicion
corporal. Devuelves SIEMPRE JSON valido y en ESPANOL.

INSTRUCCIONES:
Eres un agente de inteligencia artificial especializado en analisis de composicion corporal humana.

Tu tarea es calcular e interpretar:
- Porcentaje de grasa corporal
- Masa grasa (kg)
- Masa libre de grasa (LBM)
- Masa muscular estimada (kg)
- Porcentaje de masa muscular

Debes utilizar formulas cientificas diferenciadas por sexo y entregar resultados claros, numericos y bien explicados.

DATOS DE ENTRADA REQUERIDOS:
- Sexo (hombre / mujer)
- Peso (kg)
- Estatura (cm)
- Circunferencia de cintura (cm)
- Circunferencia de cuello (cm)
- Circunferencia de cadera (cm) -> solo requerido para mujeres

FORMATO DE SALIDA:
Entrega los resultados estructurados asi:
- Porcentaje de grasa corporal: X %
- Masa grasa: X kg
- Masa libre de grasa (LBM): X kg
- Masa muscular estimada: X kg
- Porcentaje de masa muscular: X %

Ademas incluye:
- Breve interpretacion (ej. atletico, promedio, alto % de grasa, etc.)
- Comparacion contra estandares fitness si el usuario lo solicita.

Se preciso, cientifico y profesional. Responde SIEMPRE en espanol. Evita motivacion innecesaria salvo que se solicite explicitamente.

- Analiza medidas antropometricas y contexto.
- Usa los calculos del campo "calculations" en CONTEXTO_JSON cuando existan.
- No recalcules % grasa ni masa magra si ya vienen calculados; respeta el sexo indicado.
- Resume hallazgos clave en tono profesional.
- Genera recomendaciones concretas segun objetivo (definicion/volumen/mantenimiento).

CONTEXTO_JSON:
{context_json}

Formato de salida (SOLO JSON):
{{
  "body_composition": {{
    "body_fat_percent": float,
    "lean_mass_kg": float,
    "fat_mass_kg": float,
    "muscle_mass_kg": float,
    "muscle_mass_percent": float
  }},
  "proportions": {{
    "waist_to_height": float,
    "waist_to_hip": float | null,
    "waist_to_chest": float | null,
    "symmetry_notes": string
  }},
  "summary": string,
  "recommendations": {{
    "focus": "fat_loss" | "muscle_gain" | "maintenance",
    "actions": [string]
  }}
}}
"""


class BodyMetricsAgent:
    """Agente que combina LLM con heuristicas offline para metricas corporales."""

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
                logger.warning("BodyMetricsAgent: OPENAI_API_KEY missing. Fallback to mock.")
                self.provider = AIProvider.MOCK
            else:
                try:
                    from openai import OpenAI
                    import httpx

                    http_client = httpx.Client()
                    self._client = OpenAI(api_key=self.api_key, http_client=http_client)
                    logger.info(f"BodyMetricsAgent initialized with OpenAI model: {self.model}")
                except Exception as e:
                    self.init_error = str(e)
                    logger.error(f"Failed to initialize OpenAI client: {e}")
                    self.provider = AIProvider.MOCK

        elif self.provider == AIProvider.GEMINI:
            if not self.api_key:
                self.init_error = "GEMINI_API_KEY missing"
                logger.warning("BodyMetricsAgent: GEMINI_API_KEY missing. Fallback to mock.")
                self.provider = AIProvider.MOCK
            else:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=self.api_key)
                    self._client = genai.GenerativeModel(self.model)
                    logger.info(f"BodyMetricsAgent initialized with Gemini model: {self.model}")
                except Exception as e:
                    self.init_error = str(e)
                    logger.error(f"Failed to initialize Gemini client: {e}")
                    self.provider = AIProvider.MOCK

        if self.provider == AIProvider.MOCK:
            logger.info("BodyMetricsAgent using Mock backend.")

    def backend(self) -> str:
        return f"{self.provider.value}:{self.model}" if self.provider else "mock"

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] BodyMetricsAgent start | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
        )

        measurements = context.get("measurements") or {}
        weight = self._safe_float(measurements.get("weight_kg"))
        height_cm = self._safe_float(measurements.get("height_cm"))

        waist = self._safe_float(measurements.get("waist"))
        abdomen = self._safe_float(measurements.get("abdomen"))
        chest = self._safe_float(measurements.get("chest"))
        hip = self._safe_float(measurements.get("hip"))
        neck = self._safe_float(measurements.get("neck"))

        def _get_avg(base_key: str) -> Optional[float]:
            val = self._safe_float(measurements.get(base_key))
            if val is not None:
                return val

            left = self._safe_float(measurements.get(f"{base_key}_left"))
            right = self._safe_float(measurements.get(f"{base_key}_right"))

            if left and right:
                return (left + right) / 2
            if left:
                return left
            if right:
                return right
            return None

        arm_relaxed = _get_avg("arm_relaxed")
        arm_flexed = _get_avg("arm_flexed")
        thigh = _get_avg("thigh")
        calf = _get_avg("calf")

        age = self._safe_float(context.get("age"), default=30.0)
        sex = str(context.get("sex", "male")).lower()
        activity_level = context.get("activity_level")

        height_m = height_cm / 100 if height_cm else 1.75
        bmi = weight / (height_m**2) if height_m > 0 else 22.0

        calculated_body_fat = self._estimate_body_fat(
            sex=sex,
            height_cm=height_cm or 175,
            waist=waist,
            abdomen=abdomen,
            hip=hip,
            neck=neck,
            bmi=bmi,
            age=age,
        )

        fat_mass = max(0.0, weight * (calculated_body_fat / 100)) if weight else 0.0
        lean_mass = max(0.0, (weight or 0.0) - fat_mass)

        context["calculations"] = {
            "body_fat_percent": round(calculated_body_fat, 1),
            "lean_mass_kg": round(lean_mass, 1),
            "bmi": round(bmi, 1),
        }

        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_body_metrics_prompt(context_str)

        from .ai_config import AIProvider

        try:
            if self.provider == AIProvider.OPENAI:
                result = self._run_openai(prompt)
            elif self.provider == AIProvider.GEMINI:
                result = self._run_gemini(prompt)
            else:
                result = self._run_mock(context)
        except Exception as e:
            logger.error(f"Agent execution failed for provider {self.provider}: {e}")
            result = self._run_mock({"_fallback_reason": f"provider_error: {str(e)}"})

        if "body_composition" not in result:
            result["body_composition"] = {}

        result["body_composition"]["body_fat_percent"] = round(calculated_body_fat, 1)
        result["body_composition"]["lean_mass_kg"] = round(lean_mass, 1)
        result["body_composition"]["fat_mass_kg"] = round(fat_mass, 1)

        muscle_percent, muscle_mass_kg, muscle_notes = self._estimate_muscle_percent(
            sex=sex,
            lean_mass=lean_mass,
            weight=weight,
            height_cm=height_cm,
            arm_relaxed=arm_relaxed,
            arm_flexed=arm_flexed,
            thigh=thigh,
            calf=calf,
        )
        if (
            "muscle_mass_percent" not in result["body_composition"]
            or result["body_composition"]["muscle_mass_percent"] == 0
        ):
            result["body_composition"]["muscle_mass_percent"] = round(muscle_percent, 1)
        if (
            "muscle_mass_kg" not in result["body_composition"]
            or result["body_composition"]["muscle_mass_kg"] == 0
        ):
            result["body_composition"]["muscle_mass_kg"] = round(muscle_mass_kg, 1)

        waist_metric = waist if (sex == "female" and waist) else (abdomen or waist or 80)
        waist_to_height = waist_metric / height_cm if height_cm else None
        waist_to_hip = waist_metric / hip if hip else None
        waist_to_chest = waist_metric / chest if chest else None

        symmetry_notes = self._build_symmetry_notes(
            waist_to_height, waist_to_hip, waist_to_chest, arm_relaxed, arm_flexed
        )

        if "proportions" not in result:
            result["proportions"] = {}
        result["proportions"]["waist_to_height"] = round(waist_to_height, 3) if waist_to_height else None
        result["proportions"]["waist_to_hip"] = round(waist_to_hip, 3) if waist_to_hip else None
        result["proportions"]["waist_to_chest"] = round(waist_to_chest, 3) if waist_to_chest else None
        result["proportions"]["symmetry_notes"] = result["proportions"].get("symmetry_notes") or symmetry_notes

        result["body_proportions"] = {
            "waist_to_height_ratio": round(waist_to_height, 3) if waist_to_height else None,
            "waist_to_hip_ratio": round(waist_to_hip, 3) if waist_to_hip else None,
            "chest_to_waist_ratio": round(1 / waist_to_chest, 3) if (waist_to_chest and waist_to_chest > 0) else None,
            "symmetry_analysis": result["proportions"].get("symmetry_notes"),
        }

        try:
            if weight and height_cm and age:
                energy = self._calculate_energy_expenditure(
                    sex=sex,
                    weight=weight,
                    height_cm=height_cm,
                    age=age,
                    activity_level=activity_level,
                )
                result["energy_expenditure"] = energy
        except Exception:
            pass

        if "summary" not in result or not result.get("summary"):
            result["summary"] = self._build_summary(
                calculated_body_fat,
                fat_mass,
                lean_mass,
                waist_to_height,
                waist_to_hip,
                waist_to_chest,
                muscle_notes,
            )

        if "recommendations" not in result or not result.get("recommendations"):
            focus = self._infer_focus(sex=sex, body_fat=calculated_body_fat, bmi=bmi, goal=context.get("goal"))
            result["recommendations"] = {
                "focus": focus,
                "actions": self._build_actions(
                    focus=focus,
                    lean_mass=lean_mass,
                    bmi=bmi,
                    waist_to_height=waist_to_height,
                ),
            }

        return result

    # ------------------------------------------------------------------
    # Backends
    # ------------------------------------------------------------------
    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info("[AgentRun] BodyMetricsAgent openai call | model=%s", self.model)
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres especialista en fitness. Responde en espanol, respeta los calculos del contexto y devuelve SOLO JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            logger.info("[AgentRun] BodyMetricsAgent openai success | content_len=%s", len(content))
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"BodyMetricsAgent OpenAI call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"openai_error: {str(e)}"})

    def _run_gemini(self, prompt: str) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(f"[AgentRun] BodyMetricsAgent gemini call | model={self.model}")

            generation_config = {"response_mime_type": "application/json"}
            resp = self._client.generate_content(prompt, generation_config=generation_config)
            content = resp.text

            logger.info(f"[AgentRun] BodyMetricsAgent gemini success | content_len={len(content)}")
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"BodyMetricsAgent Gemini call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"gemini_error: {str(e)}"})

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] BodyMetricsAgent mock fallback | backend=%s model=%s key_present=%s init_error=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
        )
        measurements = context.get("measurements") or {}
        sex = str(context.get("sex", "male")).lower()
        age = self._safe_float(context.get("age"), default=30.0)
        goal = str(context.get("goal", "")).lower() or None

        weight = self._safe_float(measurements.get("weight_kg"), default=70.0)
        height_cm = self._safe_float(measurements.get("height_cm"), default=175.0)
        waist = self._safe_float(measurements.get("waist"))
        abdomen = self._safe_float(measurements.get("abdomen"))
        chest = self._safe_float(measurements.get("chest"))
        hip = self._safe_float(measurements.get("hip"))
        neck = self._safe_float(measurements.get("neck"))
        arm_relaxed = self._safe_float(measurements.get("arm_relaxed"))
        arm_flexed = self._safe_float(measurements.get("arm_flexed"))
        thigh = self._safe_float(measurements.get("thigh"))
        calf = self._safe_float(measurements.get("calf"))

        height_m = height_cm / 100 if height_cm else 1.75
        bmi = weight / (height_m**2) if height_m > 0 else 22.0

        waist_metric = waist if (sex == "female" and waist) else (abdomen or waist or 80.0)

        body_fat = self._estimate_body_fat(
            sex=sex,
            height_cm=height_cm,
            waist=waist,
            abdomen=abdomen,
            hip=hip,
            neck=neck,
            weight=weight,
            bmi=bmi,
            age=age,
        )

        fat_mass = max(0.0, weight * (body_fat / 100))
        lean_mass = max(0.0, weight - fat_mass)

        muscle_percent, muscle_mass_kg, muscle_notes = self._estimate_muscle_percent(
            sex=sex,
            lean_mass=lean_mass,
            weight=weight,
            height_cm=height_cm,
            arm_relaxed=arm_relaxed,
            arm_flexed=arm_flexed,
            thigh=thigh,
            calf=calf,
        )

        waist_to_height = waist_metric / height_cm if height_cm else None
        waist_to_hip = waist_metric / hip if hip else None
        waist_to_chest = waist_metric / chest if chest else None

        symmetry_notes = self._build_symmetry_notes(
            waist_to_height,
            waist_to_hip,
            waist_to_chest,
            arm_relaxed,
            arm_flexed,
        )

        summary = self._build_summary(
            body_fat,
            fat_mass,
            lean_mass,
            waist_to_height,
            waist_to_hip,
            waist_to_chest,
            muscle_notes,
        )

        focus = self._infer_focus(sex=sex, body_fat=body_fat, bmi=bmi, goal=goal)
        recommendations = {
            "focus": focus,
            "actions": self._build_actions(
                focus=focus,
                lean_mass=lean_mass,
                bmi=bmi,
                waist_to_height=waist_to_height,
            ),
        }

        return {
            "body_composition": {
                "body_fat_percent": round(body_fat, 1),
                "lean_mass_kg": round(lean_mass, 1),
                "fat_mass_kg": round(fat_mass, 1),
                "muscle_mass_kg": round(muscle_mass_kg, 1),
                "muscle_mass_percent": round(muscle_percent, 1),
            },
            "proportions": {
                "waist_to_height": round(waist_to_height, 3) if waist_to_height else None,
                "waist_to_hip": round(waist_to_hip, 3) if waist_to_hip else None,
                "waist_to_chest": round(waist_to_chest, 3) if waist_to_chest else None,
                "symmetry_notes": symmetry_notes,
            },
            "body_proportions": {
                "waist_to_height_ratio": round(waist_to_height, 3) if waist_to_height else None,
                "waist_to_hip_ratio": round(waist_to_hip, 3) if waist_to_hip else None,
                "chest_to_waist_ratio": round(1 / waist_to_chest, 3) if (waist_to_chest and waist_to_chest > 0) else None,
                "symmetry_analysis": symmetry_notes,
            },
            "summary": summary,
            "recommendations": recommendations,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
        try:
            if value is None:
                return default
            return float(value)
        except (TypeError, ValueError):
            return default

    def _estimate_body_fat(
        self,
        *,
        sex: str,
        height_cm: float,
        waist: Optional[float],
        abdomen: Optional[float],
        hip: Optional[float],
        neck: Optional[float],
        weight: Optional[float] = None,
        bmi: float = 22.0,
        age: float = 30.0,
    ) -> float:
        h = height_cm
        n = neck

        if sex == "female":
            w = waist if (waist and waist > 0) else abdomen
            p = hip

            if w and p and n and h:
                try:
                    term1 = w + p - n
                    if term1 > 0:
                        log_measure = math.log10(term1)
                        log_h = math.log10(h)

                        density = 1.29579 - 0.35004 * log_measure + 0.22100 * log_h
                        if density > 0:
                            bf = (495.0 / density) - 450.0
                            return max(5.0, min(60.0, bf))
                except Exception:
                    pass
        else:
            a = abdomen if (abdomen and abdomen > 0) else waist

            if a and n and h:
                try:
                    term1 = a - n
                    if term1 > 0:
                        log_measure = math.log10(term1)
                        log_h = math.log10(h)

                        density = 1.0324 - 0.19077 * log_measure + 0.15456 * log_h
                        if density > 0:
                            bf = (495.0 / density) - 450.0
                            return max(3.0, min(50.0, bf))
                except Exception:
                    pass

        sex_flag = 1 if sex != "female" else 0
        body_fat = 1.20 * bmi + 0.23 * age - 10.8 * sex_flag - 5.4
        return float(max(5.0, min(50.0, body_fat)))

    def _estimate_muscle_percent(
        self,
        *,
        sex: str,
        lean_mass: float,
        weight: float,
        height_cm: float,
        arm_relaxed: Optional[float],
        arm_flexed: Optional[float],
        thigh: Optional[float],
        calf: Optional[float],
    ) -> (float, float, str):
        height_m = height_cm / 100 if height_cm else 1.75
        circumferences: List[float] = []
        for measure in (arm_flexed or arm_relaxed, thigh, calf):
            if measure and height_cm:
                circumferences.append(measure / height_cm)

        base_ratio = 0.48 if sex != "female" else 0.45
        if circumferences:
            avg = sum(circumferences) / len(circumferences)
            delta = avg - base_ratio
            adj = max(-0.08, min(0.08, delta * 1.8))
        else:
            bmi = weight / (height_m**2) if height_m > 0 else 22.0
            adj = 0.04 if bmi >= 25 and lean_mass / weight > 0.75 else 0.0

        skeletal_ratio = min(0.62, max(0.4, base_ratio + adj))
        skeletal_mass = lean_mass * skeletal_ratio
        percent = (skeletal_mass / weight * 100) if weight else 0.0

        if percent >= 38:
            note = "Buen desarrollo muscular en extremidades"
        elif percent <= 30:
            note = "Hay margen para ganar masa muscular global"
        else:
            note = "Masa muscular dentro de un rango saludable"

        return percent, skeletal_mass, note

    def _build_symmetry_notes(
        self,
        waist_to_height: Optional[float],
        waist_to_hip: Optional[float],
        waist_to_chest: Optional[float],
        arm_relaxed: Optional[float],
        arm_flexed: Optional[float],
    ) -> str:
        notes: List[str] = []

        if waist_to_height is not None:
            if waist_to_height < 0.45:
                notes.append("Buena relacion cintura-altura (apariencia atletica)")
            elif waist_to_height > 0.53:
                notes.append("Conviene reducir perimetro de cintura para salud y estetica")

        if waist_to_hip is not None:
            if waist_to_hip < 0.85:
                notes.append("Contraste cintura-cadera favorable")
            elif waist_to_hip > 0.92:
                notes.append("Trabaja gluteos y zona media para mejorar proporcion cintura-cadera")

        if waist_to_chest is not None:
            if waist_to_chest < 0.75:
                notes.append("Buena forma en V desde torso")
            elif waist_to_chest > 0.85:
                notes.append("Refuerza pectoral/espalda para mejorar relacion cintura-pecho")

        if arm_flexed and arm_relaxed:
            delta = arm_flexed - arm_relaxed
            if delta < 2:
                notes.append("Mayor tono de biceps/triceps puede mejorar contraste brazo")
            elif delta > 4:
                notes.append("Buen pico de biceps en contraccion")

        if not notes:
            notes.append("Proporciones generales equilibradas")

        return "; ".join(notes)

    def _build_summary(
        self,
        body_fat: float,
        fat_mass: float,
        lean_mass: float,
        waist_to_height: Optional[float],
        waist_to_hip: Optional[float],
        waist_to_chest: Optional[float],
        muscle_notes: str,
    ) -> str:
        parts: List[str] = []
        parts.append(
            f"Grasa estimada en {body_fat:.1f}% (~{fat_mass:.1f} kg) con masa magra de {lean_mass:.1f} kg."
        )

        if waist_to_height is not None:
            parts.append(f"Relacion cintura-altura {waist_to_height:.2f}.")
        if waist_to_hip is not None:
            parts.append(f"Cintura/cadera {waist_to_hip:.2f}.")
        if waist_to_chest is not None:
            parts.append(f"Cintura/pecho {waist_to_chest:.2f}.")

        parts.append(muscle_notes + ".")

        return " ".join(parts)[:400]

    def _infer_focus(
        self,
        *,
        sex: str,
        body_fat: float,
        bmi: float,
        goal: Optional[str],
    ) -> str:
        if goal in {"fat_loss", "muscle_gain", "maintenance"}:
            return goal

        high_bf = 25.0 if sex != "female" else 32.0
        low_bf = 12.0 if sex != "female" else 20.0

        if body_fat >= high_bf:
            return "fat_loss"
        if body_fat <= low_bf:
            if bmi < 22:
                return "muscle_gain"
            return "maintenance"
        return "maintenance"

    def _build_actions(
        self,
        *,
        focus: str,
        lean_mass: float,
        bmi: float,
        waist_to_height: Optional[float],
    ) -> List[str]:
        actions: List[str] = []

        if focus == "fat_loss":
            actions.append(
                "Aplica deficit calorico moderado (15-20% bajo mantenimiento) manteniendo >=2 g/kg de proteina."
            )
            actions.append("Incluye entrenamiento de fuerza 3-4 veces/semana con enfasis en compuestos y core.")
            if waist_to_height and waist_to_height > 0.5:
                actions.append("Anade 2-3 sesiones de cardio LISS 30' o HIIT corto para apoyar reduccion de cintura.")
        elif focus == "muscle_gain":
            actions.append("Usa superavit ligero (200-300 kcal) priorizando proteina y carbohidratos post entreno.")
            actions.append("Programa sobrecarga progresiva en torso y tren inferior 4-5 veces/semana.")
            if lean_mass < 55:
                actions.append("Anade trabajo accesorio de brazos/hombros para resaltar proporciones.")
        else:
            actions.append("Manten ingesta calorica cercana a mantenimiento con reparto equilibrado de macros.")
            actions.append("Conserva rutina de fuerza 3-4 veces/semana y movilidad 1-2 veces/semana.")
            if bmi > 26:
                actions.append("Vigila perimetro de cintura y pasos diarios >=8k para control metabolico.")

        actions.append("Re-evalua medidas y fotos en 6-8 semanas para ajustar estrategia.")
        return actions

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

    def _calculate_energy_expenditure(
        self, *, sex: str, weight: float, height_cm: float, age: float, activity_level: Optional[str] = None
    ) -> Dict[str, Any]:
        base = (10 * weight) + (6.25 * height_cm) - (5 * age)
        if sex == "female":
            tmb = base - 161
        else:
            tmb = base + 5

        tmb = round(tmb, 0)

        tdee_map = {
            "sedentary": round(tmb * 1.2, 0),
            "lightly_active": round(tmb * 1.375, 0),
            "moderately_active": round(tmb * 1.55, 0),
            "very_active": round(tmb * 1.725, 0),
            "extra_active": round(tmb * 1.9, 0),
        }

        selected_tdee = None
        if activity_level and activity_level in tdee_map:
            selected_tdee = tdee_map[activity_level]

        return {
            "tmb": tmb,
            "tdee": tdee_map,
            "selected_activity": activity_level,
            "selected_tdee": selected_tdee,
        }
