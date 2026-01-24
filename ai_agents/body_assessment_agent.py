"""Agente de evaluación corporal para IA Fitness.

Este agente recibe mediciones antropométricas y observaciones sobre fotos
recientes del usuario para generar un informe estructurado con:
- Estimación de composición corporal (grasa, masa magra, músculo esquelético).
- Evaluación de proporciones (relación cintura-altura, cintura-cadera, etc.).
- Resumen narrativo y recomendaciones prácticas alineadas al objetivo.
- Observaciones rápidas sobre las fotos enviadas.

Al igual que el resto de agentes del paquete, intenta usar OpenAI cuando la
variable de entorno ``OPENAI_API_KEY`` está presente y cae en un backend mock
determinístico cuando no lo está. El mock utiliza reglas heurísticas basadas en
las medidas para permitir pruebas locales sin dependencia externa.
"""

from __future__ import annotations

import json
import math
import os
from typing import Any, Dict, List, Optional


def build_body_assessment_prompt(context_json: str) -> str:
    """Construye el prompt del agente para evaluación corporal."""

    return f"""
SYSTEM: Eres un coach de fitness y nutrición especializado en recomposición
corporal. Devuelves SIEMPRE JSON válido.

INSTRUCCIONES:

Eres un agente de inteligencia artificial especializado en análisis de composición corporal humana.

Tu tarea es calcular e interpretar:
- Porcentaje de grasa corporal
- Masa grasa (kg)
- Masa libre de grasa (LBM)
- Masa muscular estimada (kg)
- Porcentaje de masa muscular

Debes utilizar fórmulas científicas diferenciadas por sexo y entregar resultados claros, numéricos y bien explicados.

────────────────────────────────────────
DATOS DE ENTRADA REQUERIDOS:
- Sexo (hombre / mujer)
- Peso (kg)
- Estatura (cm)
- Circunferencia de cintura (cm)
- Circunferencia de cuello (cm)
- Circunferencia de cadera (cm) → solo requerido para mujeres

────────────────────────────────────────
PASO 1 — CÁLCULO DEL % DE GRASA CORPORAL (FÓRMULA US NAVY)

Si sexo = hombre:
% Grasa corporal =
86.010 × log10(cintura − cuello)
− 70.041 × log10(estatura)
+ 36.76

Si sexo = mujer:
% Grasa corporal =
163.205 × log10(cintura + cadera − cuello)
− 97.684 × log10(estatura)
− 78.387

(Todas las medidas en centímetros)

────────────────────────────────────────
PASO 2 — MASA GRASA (kg)
Masa grasa = Peso × (% grasa corporal / 100)

────────────────────────────────────────
PASO 3 — MASA LIBRE DE GRASA (LBM)
LBM = Peso − Masa grasa

────────────────────────────────────────
PASO 4 — ESTIMACIÓN DE MASA MUSCULAR SEGÚN SEXO

Usa los siguientes rangos fisiológicos realistas:

Si sexo = hombre:
- Entrenado: 50–55% de la LBM
- Promedio: 45–50% de la LBM

Si sexo = mujer:
- Entrenada: 40–45% de la LBM
- Promedio: 35–40% de la LBM

Masa muscular = LBM × factor seleccionado

────────────────────────────────────────
PASO 5 — PORCENTAJE DE MASA MUSCULAR
% Masa muscular = (Masa muscular / Peso) × 100

────────────────────────────────────────
FORMATO DE SALIDA:
Entrega los resultados estructurados así:

- Porcentaje de grasa corporal: X %
- Masa grasa: X kg
- Masa libre de grasa (LBM): X kg
- Masa muscular estimada: X kg
- Porcentaje de masa muscular: X %

Además incluye:
- Breve interpretación (ej. atlético, promedio, alto % de grasa, etc.)
- Comparación contra estándares fitness si el usuario lo solicita.

Sé preciso, científico y profesional. Evita motivación innecesaria salvo que se solicite explícitamente.


- Analiza medidas antropométricas y observaciones de fotos.
- Estima porcentaje de grasa corporal, masa magra y masa muscular esquelética.
- Evalúa proporciones (cintura-altura, cintura-cadera, simetría visual).
- Usa los calculos del campo "calculations" en CONTEXTO_JSON cuando existan.
- No recalcules % grasa ni masa magra si ya vienen calculados; respeta el sexo indicado.
- Resume hallazgos clave en tono profesional.
- Genera recomendaciones concretas según objetivo (definición/volumen/mantenimiento).
- Añade observaciones puntuales sobre las fotos recibidas (Análisis de proporciones y simetría visual)
- Describe los ragos corporales en términos objetivos de las fotos recibidas.
- En las fotos identifica postura, alineación y balance corporal.
- En photo_feedback, describe la forma fisica con detalle: musculos, definicion, volumen, y partes del cuerpo (hombros, pecho, brazos, abdomen, espalda, gluteos, piernas).
- Incluye referencia a la vista cuando exista (frontal/lateral/espalda) y menciona simetria y postura.
- Usa 4-8 bullets concretos, sin consejos genericos ni instrucciones de toma de foto.


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
    "focus": "definicion" | "volumen" | "mantenimiento",
    "actions": [string]
  }},
  "photo_feedback": [string]
}}
"""


class BodyAssessmentAgent:
    """Agente que combina OpenAI con heurísticas offline.

    Soporta análisis de imágenes cuando hay `OPENAI_API_KEY` disponible.
    """

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
                logger.warning("BodyAssessmentAgent: OPENAI_API_KEY missing. Fallback to mock.")
                self.provider = AIProvider.MOCK
            else:
                try:
                    from openai import OpenAI
                    import httpx
                    # Solución para el error de argumento 'proxies':
                    # Creamos explícitamente el cliente http para evitar la creación interna de cliente de OpenAI
                    # que podría estar usando argumentos obsoletos para versiones más recientes de httpx.
                    http_client = httpx.Client()
                    self._client = OpenAI(api_key=self.api_key, http_client=http_client)
                    logger.info(f"BodyAssessmentAgent initialized with OpenAI model: {self.model}")
                except Exception as e:
                    self.init_error = str(e)
                    logger.error(f"Failed to initialize OpenAI client: {e}")
                    self.provider = AIProvider.MOCK

        elif self.provider == AIProvider.GEMINI:
            if not self.api_key:
                self.init_error = "GEMINI_API_KEY missing"
                logger.warning("BodyAssessmentAgent: GEMINI_API_KEY missing. Fallback to mock.")
                self.provider = AIProvider.MOCK
            else:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=self.api_key)
                    self._client = genai.GenerativeModel(self.model)
                    logger.info(f"BodyAssessmentAgent initialized with Gemini model: {self.model}")
                except Exception as e:
                    self.init_error = str(e)
                    logger.error(f"Failed to initialize Gemini client: {e}")
                    self.provider = AIProvider.MOCK
        
        if self.provider == AIProvider.MOCK:
            logger.info("BodyAssessmentAgent using Mock backend.")

    def backend(self) -> str:
        return f"{self.provider.value}:{self.model}" if self.provider else "mock"

    def run(self, context: Dict[str, Any], images: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] BodyAssessmentAgent start | backend=%s model=%s key_present=%s init_error=%s images=%s",
            self.backend(),
            self.model,
            bool(self.api_key),
            self.init_error,
            len(images) if images else 0,
        )

        # ------------------------------------------------------------------
        # 1. Cálculo Determinístico (Método de la Marina de EE. UU.) y Preparación del Contexto
        # ------------------------------------------------------------------
        measurements = context.get("measurements") or {}
        weight = self._safe_float(measurements.get("weight_kg"))
        height_cm = self._safe_float(measurements.get("height_cm"))
        
        waist = self._safe_float(measurements.get("waist"))
        abdomen = self._safe_float(measurements.get("abdomen"))
        chest = self._safe_float(measurements.get("chest"))
        hip = self._safe_float(measurements.get("hip"))
        neck = self._safe_float(measurements.get("neck"))
        
        # Ayudantes Bilaterales
        def _get_avg(base_key):
             val = self._safe_float(measurements.get(base_key))
             if val is not None: return val
             
             left = self._safe_float(measurements.get(f"{base_key}_left"))
             right = self._safe_float(measurements.get(f"{base_key}_right"))
             
             if left and right: return (left + right) / 2
             if left: return left
             if right: return right
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

        # Cálculo Estricto
        calculated_body_fat = self._estimate_body_fat(
            sex=sex, height_cm=height_cm or 175, waist=waist, abdomen=abdomen, hip=hip, neck=neck, bmi=bmi, age=age
        )

        fat_mass = max(0.0, weight * (calculated_body_fat / 100)) if weight else 0.0
        lean_mass = max(0.0, (weight or 0.0) - fat_mass)
        
        # Inyectar en el prompt
        context["calculations"] = {
             "body_fat_percent": round(calculated_body_fat, 1),
             "lean_mass_kg": round(lean_mass, 1),
             "bmi": round(bmi, 1)
        }
        
        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_body_assessment_prompt(context_str)
        
        # ------------------------------------------------------------------
        # 2. Execution
        # ------------------------------------------------------------------
        # ------------------------------------------------------------------
        # 2. Execution
        # ------------------------------------------------------------------
        from .ai_config import AIProvider
        
        try:
            if self.provider == AIProvider.OPENAI:
                if images:
                    result = self._run_openai_vision(prompt, images)
                else:
                    result = self._run_openai(prompt)
            elif self.provider == AIProvider.GEMINI:
                if images:
                    result = self._run_gemini_vision(prompt, images)
                else:
                    result = self._run_gemini(prompt)
            else:
                result = self._run_mock(context)
        except Exception as e:
            logger.error(f"Agent execution failed for provider {self.provider}: {e}")
            result = self._run_mock({"_fallback_reason": f"provider_error: {str(e)}"})
        
        # ------------------------------------------------------------------
        # 3. Post-Procesamiento y Sobrescritura
        # ------------------------------------------------------------------
        # Asegurar que la composición corporal refleje la fórmula
        if "body_composition" not in result:
            result["body_composition"] = {}
        
        result["body_composition"]["body_fat_percent"] = round(calculated_body_fat, 1)
        result["body_composition"]["lean_mass_kg"] = round(lean_mass, 1)
        result["body_composition"]["fat_mass_kg"] = round(fat_mass, 1)
        
        # Porcentaje Muscular
        muscle_percent, muscle_mass_kg, muscle_notes = self._estimate_muscle_percent(
            sex=sex, lean_mass=lean_mass, weight=weight, height_cm=height_cm,
            arm_relaxed=arm_relaxed, arm_flexed=arm_flexed, thigh=thigh, calf=calf
        )
        if "muscle_mass_percent" not in result["body_composition"] or result["body_composition"]["muscle_mass_percent"] == 0:
             result["body_composition"]["muscle_mass_percent"] = round(muscle_percent, 1)
        if "muscle_mass_kg" not in result["body_composition"] or result["body_composition"]["muscle_mass_kg"] == 0:
             result["body_composition"]["muscle_mass_kg"] = round(muscle_mass_kg, 1)

        # Proporciones
        waist_metric = waist if (sex == "female" and waist) else (abdomen or waist or 80)
        waist_to_height = waist_metric / height_cm if height_cm else None
        waist_to_hip = waist_metric / hip if hip else None
        waist_to_chest = waist_metric / chest if chest else None
        
        symmetry_notes = self._build_symmetry_notes(
            waist_to_height, waist_to_hip, waist_to_chest, arm_relaxed, arm_flexed
        )

        if "proportions" not in result: result["proportions"] = {}
        result["proportions"]["waist_to_height"] = round(waist_to_height, 3) if waist_to_height else None
        result["proportions"]["symmetry_notes"] = result["proportions"].get("symmetry_notes") or symmetry_notes

        # Crear Alias Frontend
        result["body_proportions"] = {
            "waist_to_height_ratio": round(waist_to_height, 3) if waist_to_height else None,
            "waist_to_hip_ratio": round(waist_to_hip, 3) if waist_to_hip else None,
            "chest_to_waist_ratio": round(1/waist_to_chest, 3) if (waist_to_chest and waist_to_chest > 0) else None,
            "symmetry_analysis": result["proportions"].get("symmetry_notes")
        }

        # Gasto Energético
        try:
            if weight and height_cm and age:
                energy = self._calculate_energy_expenditure(
                    sex=sex, weight=weight, height_cm=height_cm, age=age, activity_level=activity_level
                )
                result["energy_expenditure"] = energy
        except Exception:
            pass 
            
        return result

    # ------------------------------------------------------------------
    # Backends
    # ------------------------------------------------------------------
    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(
                "[AgentRun] BodyAssessmentAgent openai call | model=%s",
                self.model,
            )
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres especialista en fitness. Respeta los calculos del contexto y devuelve SOLO JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            logger.info(
                "[AgentRun] BodyAssessmentAgent openai success | content_len=%s",
                len(content),
            )
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"BodyAssessmentAgent OpenAI call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"openai_error: {str(e)}"})

    def _run_openai_vision(self, prompt: str, images: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Llama a OpenAI con contenido multimodal (texto + imágenes base64).

        Espera `images` como lista de dicts: {"data": base64_str, "mime": "image/jpeg", "view": "frontal"}
        """
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(
                "[AgentRun] BodyAssessmentAgent openai vision call | model=%s images=%s",
                self.model,
                len(images),
            )
            content_blocks: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]
            for img in images[:8]:  # limitar a 8 imágenes por llamada
                data = img.get("data")
                mime = img.get("mime") or "image/jpeg"
                if not data:
                    continue
                data_url = f"data:{mime};base64,{data}"
                content_blocks.append({
                    "type": "image_url",
                    "image_url": {"url": data_url}
                })

            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres especialista en fitness. Respeta los calculos del contexto y devuelve SOLO JSON."},
                    {"role": "user", "content": content_blocks},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            logger.info(
                "[AgentRun] BodyAssessmentAgent openai vision success | content_len=%s",
                len(content),
            )
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"BodyAssessmentAgent OpenAI VISION call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"openai_vision_error: {str(e)}"})

    def _run_gemini(self, prompt: str) -> Dict[str, Any]:
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(f"[AgentRun] BodyAssessmentAgent gemini call | model={self.model}")
            
            # Gemini generalmente espera un prompt de texto. Configurar config de generación para JSON.
            generation_config = {"response_mime_type": "application/json"}
            
            # Dado que self._client es una instancia de GenerativeModel
            resp = self._client.generate_content(prompt, generation_config=generation_config)
            content = resp.text
            
            logger.info(f"[AgentRun] BodyAssessmentAgent gemini success | content_len={len(content)}")
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"BodyAssessmentAgent Gemini call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"gemini_error: {str(e)}"})

    def _run_gemini_vision(self, prompt: str, images: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Llama a Gemini con multimodal."""
        try:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.info(f"[AgentRun] BodyAssessmentAgent gemini vision call | model={self.model} images={len(images)}")
            
            inputs = [prompt]
            for img in images[:8]:
                data_b64 = img.get("data")
                mime = img.get("mime") or "image/jpeg"
                if data_b64:
                    # Construir parte para Gemini
                    # google-generativeai espera un dict como {'mime_type':..., 'data':...}
                    # o imagen PIL pura. Como tenemos b64, vamos a formatearlo para la biblioteca.
                    image_blob = {"mime_type": mime, "data": data_b64}
                    inputs.append(image_blob)
            
            generation_config = {"response_mime_type": "application/json"}
            resp = self._client.generate_content(inputs, generation_config=generation_config)
            content = resp.text
            
            logger.info(f"[AgentRun] BodyAssessmentAgent gemini vision success | content_len={len(content)}")
            return self._parse_json_content(content)
        except Exception as e:
            import logging
            logger = logging.getLogger("ai_fitness")
            logger.error(f"BodyAssessmentAgent Gemini VISION call failed: {e}", exc_info=True)
            return self._run_mock({"_fallback_reason": f"gemini_vision_error: {str(e)}"})

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
        import logging
        logger = logging.getLogger("ai_fitness")
        logger.info(
            "[AgentRun] BodyAssessmentAgent mock fallback | backend=%s model=%s key_present=%s init_error=%s",
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

        # ------------------------------------------------------------------
        # Estimaciones antropométricas
        # ------------------------------------------------------------------
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

        photo_feedback = self._build_photo_feedback(context.get("photos"))

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
            # Aliado para Frontend
            "body_proportions": {
                "waist_to_height_ratio": round(waist_to_height, 3) if waist_to_height else None,
                "waist_to_hip_ratio": round(waist_to_hip, 3) if waist_to_hip else None,
                "chest_to_waist_ratio": round(1/waist_to_chest, 3) if (waist_to_chest and waist_to_chest > 0) else None,
                "symmetry_analysis": symmetry_notes
            },
            "summary": summary,
            "recommendations": recommendations,
            "photo_feedback": photo_feedback,
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
        waist: Optional[float],   # Más estrecha (Mujeres)
        abdomen: Optional[float], # Ombligo (Hombres)
        hip: Optional[float],
        neck: Optional[float],
        weight: Optional[float] = None, # No usado para marina pero mantenido para firma comp
        bmi: float = 22.0,
        age: float = 30.0,
    ) -> float:
        """Estima % graso utilizando fórmula marina de EE.UU."""
        
        # Asegurar float limpios
        h = height_cm
        n = neck
        
        # Seleccionar medida basada en sexo e instrucciones
        # Usa el Método Estándar de la Marina de EE. UU. (Métrico) basado en Densidad
        # %BF = (495 / Density) - 450
        
        if sex == "female":
            # MUJERES: Densidad = ...
            w = waist if (waist and waist > 0) else abdomen # Fallback si falta cintura
            p = hip
            
            if w and p and n and h:
                try:
                    # All measurements in cm
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
            # HOMBRES: Densidad = ...
            a = abdomen if (abdomen and abdomen > 0) else waist # Fallback si falta abdomen
            
            if a and n and h:
                try:
                    # All measurements in cm
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

        # Fallback: fórmula de Deurenberg (BMI + edad)
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
        """Calcula % y kg de músculo esquelético aproximado y nota asociada."""

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
            # Sin datos suficientes, aproximación por IMC/masa magra
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
                notes.append("Buena relación cintura-altura (apariencia atlética)")
            elif waist_to_height > 0.53:
                notes.append("Conviene reducir perímetro de cintura para salud y estética")

        if waist_to_hip is not None:
            if waist_to_hip < 0.85:
                notes.append("Contraste cintura-cadera favorable")
            elif waist_to_hip > 0.92:
                notes.append("Trabaja glúteos y zona media para mejorar proporción cintura-cadera")

        if waist_to_chest is not None:
            if waist_to_chest < 0.75:
                notes.append("Buena forma en V desde torso")
            elif waist_to_chest > 0.85:
                notes.append("Refuerza pectoral/espalda para mejorar relación cintura-pecho")

        if arm_flexed and arm_relaxed:
            delta = arm_flexed - arm_relaxed
            if delta < 2:
                notes.append("Mayor tono de bíceps/tríceps puede mejorar contraste brazo")
            elif delta > 4:
                notes.append("Buen pico de bíceps en contracción")

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
            parts.append(f"Relación cintura-altura {waist_to_height:.2f}.")
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
        if goal in {"definicion", "volumen", "mantenimiento"}:
            return goal

        high_bf = 25.0 if sex != "female" else 32.0
        low_bf = 12.0 if sex != "female" else 20.0

        if body_fat >= high_bf:
            return "definicion"
        if body_fat <= low_bf:
            if bmi < 22:
                return "volumen"
            return "mantenimiento"
        return "mantenimiento"

    def _build_actions(
        self,
        *,
        focus: str,
        lean_mass: float,
        bmi: float,
        waist_to_height: Optional[float],
    ) -> List[str]:
        actions: List[str] = []

        if focus == "definicion":
            actions.append("Aplica déficit calórico moderado (15-20% bajo mantenimiento) manteniendo ≥2 g/kg de proteína.")
            actions.append("Incluye entrenamiento de fuerza 3-4 veces/semana con énfasis en compuestos y core.")
            if waist_to_height and waist_to_height > 0.5:
                actions.append("Añade 2-3 sesiones de cardio LISS 30' o HIIT corto para apoyar reducción de cintura.")
        elif focus == "volumen":
            actions.append("Usa superávit ligero (200-300 kcal) priorizando proteína y carbohidratos post entreno.")
            actions.append("Programa sobrecarga progresiva en torso y tren inferior 4-5 veces/semana.")
            if lean_mass < 55:
                actions.append("Añade trabajo accesorio de brazos/hombros para resaltar proporciones.")
        else:  # mantenimiento
            actions.append("Mantén ingesta calórica cercana a mantenimiento con reparto equilibrado de macros.")
            actions.append("Conserva rutina de fuerza 3-4 veces/semana y movilidad 1-2 veces/semana.")
            if bmi > 26:
                actions.append("Vigila perímetro de cintura y pasos diarios ≥8k para control metabólico.")

        actions.append("Re-evalúa medidas y fotos en 6-8 semanas para ajustar estrategia.")
        return actions

    def _build_photo_feedback(self, photos: Any) -> List[str]:
        feedback: List[str] = []
        if isinstance(photos, list):
            for photo in photos:
                if not isinstance(photo, dict):
                    continue
                view = str(photo.get("view", "foto")).strip().lower()
                notes = str(photo.get("notes", "")).strip()
                quality = str(photo.get("quality", "")).strip()

                descriptor = view.capitalize() if view else "Foto"
                if notes:
                    feedback.append(f"{descriptor}: {notes}")
                if quality:
                    feedback.append(f"{descriptor}: {quality}")
                if not notes and not quality:
                    feedback.append(f"{descriptor}: foto recibida (analisis visual no disponible en mock)")

        if not feedback:
            feedback.append(
                "Utiliza fondo neutro, iluminación frontal y postura natural para comparar progresos con precisión."
            )

        return feedback

    @staticmethod
    def _parse_json_content(content: str) -> Dict[str, Any]:
        """Parse JSON content from model responses, handling common wrappers."""
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Strip fenced code blocks if present.
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].strip()
            # Try to locate the first JSON object.
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(cleaned[start : end + 1])
            raise

    def _calculate_energy_expenditure(
        self, *, sex: str, weight: float, height_cm: float, age: float, activity_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calcula TMB (Mifflin-St Jeor) y TDEE para varios niveles de actividad."""
        
        # Mifflin-St Jeor
        # Men: (10 × weight) + (6.25 × height) - (5 × age) + 5
        # Women: (10 × weight) + (6.25 × height) - (5 × age) - 161
        
        base = (10 * weight) + (6.25 * height_cm) - (5 * age)
        if sex == "female":
            tmb = base - 161
        else:
            tmb = base + 5
            
        tmb = round(tmb, 0)
        
        tdee_map = {
            "sedentary": round(tmb * 1.2, 0),       # Poco o ningun ejercicio
            "light": round(tmb * 1.375, 0),         # Ejercicio ligero 1-3 dias
            "moderate": round(tmb * 1.55, 0),       # Ejercicio moderado 3-5 dias
            "strong": round(tmb * 1.725, 0),        # Ejercicio fuerte 6-7 dias
            "very_strong": round(tmb * 1.9, 0)      # Ejercicio muy fuerte / doble sesión
        }

        selected_tdee = None
        if activity_level and activity_level in tdee_map:
            selected_tdee = tdee_map[activity_level]

        return {
            "tmb": tmb,
            "tdee": tdee_map,
            "selected_activity": activity_level,
            "selected_tdee": selected_tdee
        }


