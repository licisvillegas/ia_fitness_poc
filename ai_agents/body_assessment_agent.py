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
- Analiza medidas antropométricas y observaciones de fotos.
- Estima porcentaje de grasa corporal, masa magra y masa muscular esquelética.
- Evalúa proporciones (cintura-altura, cintura-cadera, simetría visual).
- Resume hallazgos clave en tono profesional (≤120 palabras).
- Genera recomendaciones concretas según objetivo (definición/volumen/mantenimiento).
- Añade observaciones puntuales sobre las fotos recibidas.

CONTEXTO_JSON:
{context_json}

Formato de salida (SOLO JSON):
{{
  "body_composition": {{
    "body_fat_percent": float,
    "lean_mass_kg": float,
    "fat_mass_kg": float,
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
    """Agente que combina OpenAI con heurísticas offline."""

    def __init__(self, model: Optional[str] = None) -> None:
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-2025-04-14")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self._use_openai = bool(self.api_key)
        if self._use_openai:
            try:
                from openai import OpenAI  # type: ignore

                self._client = OpenAI(api_key=self.api_key)
            except Exception:
                self._use_openai = False
                self._client = None
        else:
            self._client = None

    def backend(self) -> str:
        return f"openai:{self.model}" if self._use_openai else "mock"

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_body_assessment_prompt(context_str)
        if self._use_openai:
            try:
                return self._run_openai(prompt)
            except Exception:
                return self._run_mock(context)
        return self._run_mock(context)

    # ------------------------------------------------------------------
    # Backends
    # ------------------------------------------------------------------
    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        try:
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres especialista en fitness. Devuelve SOLO JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
            )
            content = resp.choices[0].message.content or "{}"
            return json.loads(content)
        except Exception:
            return self._run_mock({"_fallback_reason": "openai_error"})

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
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

        waist_for_formula = abdomen or waist
        waist_for_ratio = waist or abdomen or waist_for_formula or 80.0

        body_fat = self._estimate_body_fat(
            sex=sex,
            height_cm=height_cm,
            weight=weight,
            waist=waist_for_formula,
            hip=hip,
            neck=neck,
            bmi=bmi,
            age=age,
        )

        fat_mass = max(0.0, weight * (body_fat / 100))
        lean_mass = max(0.0, weight - fat_mass)

        muscle_percent, muscle_notes = self._estimate_muscle_percent(
            sex=sex,
            lean_mass=lean_mass,
            weight=weight,
            height_cm=height_cm,
            arm_relaxed=arm_relaxed,
            arm_flexed=arm_flexed,
            thigh=thigh,
            calf=calf,
        )

        waist_to_height = waist_for_ratio / height_cm if height_cm else None
        waist_to_hip = waist_for_ratio / hip if hip else None
        waist_to_chest = waist_for_ratio / chest if chest else None

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
                "muscle_mass_percent": round(muscle_percent, 1),
            },
            "proportions": {
                "waist_to_height": round(waist_to_height, 3) if waist_to_height else None,
                "waist_to_hip": round(waist_to_hip, 3) if waist_to_hip else None,
                "waist_to_chest": round(waist_to_chest, 3) if waist_to_chest else None,
                "symmetry_notes": symmetry_notes,
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
        weight: float,
        waist: Optional[float],
        hip: Optional[float],
        neck: Optional[float],
        bmi: float,
        age: float,
    ) -> float:
        """Estima % graso utilizando fórmula marina o BMI+edad."""

        try:
            if all(x and x > 0 for x in (waist, neck, height_cm)):
                if sex == "female" and hip and hip > 0:
                    numerator = (waist or 0) + hip - (neck or 0)
                    if numerator > 0:
                        return max(12.0, min(48.0, 163.205 * math.log10(numerator) - 97.684 * math.log10(height_cm) - 78.387))
                else:
                    numerator = (waist or 0) - (neck or 0)
                    if numerator > 0:
                        return max(6.0, min(45.0, 86.010 * math.log10(numerator) - 70.041 * math.log10(height_cm) + 36.76))
        except (ValueError, ZeroDivisionError):
            pass

        # Fallback: fórmula de Deurenberg (BMI + edad)
        sex_flag = 1 if sex != "female" else 0
        body_fat = 1.20 * bmi + 0.23 * age - 10.8 * sex_flag - 5.4
        return float(max(6.0, min(45.0, body_fat)))

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
    ) -> (float, str):
        """Calcula % de músculo esquelético aproximado y nota asociada."""

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

        return percent, note

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

        if not feedback:
            feedback.append(
                "Utiliza fondo neutro, iluminación frontal y postura natural para comparar progresos con precisión."
            )

        return feedback

