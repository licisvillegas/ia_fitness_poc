"""
Agente Generador de Rutinas de Entrenamiento para Synapse Fit.

Qué hace:
- Genera rutinas de entrenamiento completas en formato JSON estricto.
- Se adapta al nivel del usuario (Principiante, Intermedio, Avanzado).
- Aplica principios de periodización y selección de ejercicios basada en evidencia.
- Soporta técnicas de intensidad (Dropsets, Rest Pause, etc.) según el nivel.

Cómo está configurado:
- Utiliza `OPENAI_API_KEY` y el modelo definido en `OPENAI_MODEL` (default gpt-4o).
- Si no hay API KEY, hace fallback a un mock (útil para desarrollo/test).
"""

import json
import os
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("ai_fitness")

def build_routine_prompt(level: str, goal: str, frequency: str, equipment: str) -> str:
    """Construye el System Prompt para el agente de rutinas."""
    return f"""
# ROL
Actúa como un Entrenador Experto en Hipertrofia y Arquitecto de Software Deportivo. Tu objetivo es generar rutinas de entrenamiento dinámicas en formato JSON estricto, adaptadas al nivel del usuario basándote en principios de biomecánica y periodización.

# VARIABLES DE ENTRADA
- Nivel de Usuario: {level}
- Objetivo: {goal}
- Días Disponibles: {frequency}
- Equipo Disponible: {equipment}

# LÓGICA Y REGLAS (Basado en Evidencia)

1.  **Clasificación de Nivel:**
    * **Principiante:** Enfoque en sobrecarga progresiva lineal, aprendizaje motor y adherencia. Series simples, descanso completo. Frecuencia recomendada 2-3 días.
    * **Intermedio:** Introducción de ondulación y periodización básica. Uso de biseries/superseries para eficiencia. Frecuencia recomendada 3-4 días.
    * **Avanzado:** Alta especificidad y gestión de fatiga. Uso mandatorio de técnicas de intensidad (Dropsets, Clusters, SST, Rest Pause) para romper estancamientos. Frecuencia 4-6 días.

2.  **Selección de Técnicas (Técnicas de Intensidad):**
    * Usa "Series Simples" para ejercicios compuestos pesados (Squat, Deadlift) para evitar lesiones por fatiga excesiva.
    * Para Intermedios/Avanzados, inyecta técnicas según el contexto:
        * *Superseries/Triseries:* Para densidad metabólica.
        * *Rest Pause / Doggcrapp:* Para ir más allá del fallo (Avanzados).
        * *Dropsets / Stripping:* Para estrés metabólico en aislamiento.
        * *SST (Sarcoplasma Stimulating Training):* Solo para avanzados en ejercicios seguros.
        * *Tempo/TUT:* Define el tiempo excéntrico, isométrico y concéntrico (ej. 3010).

3.  **Descansos (Periodos de Descanso):**
    * Fuerza/Básicos (1-3 reps): 3-5 minutos.
    * Hipertrofia (6-12 reps): 1-2 minutos.
    * Metabólico/Resistencia (>15 reps): <1 minuto.
    * Biseries: 0-10s entre ejercicios, descanso largo al final.

# FORMATO DE SALIDA (Esquema JSON)
Genera UNICAMENTE un objeto JSON. No incluyas texto conversacional fuera del JSON.

{{
  "routineName": "String",
  "difficulty": "String",
  "microcyclePhase": "String (e.g., Acumulación, Intensificación)",
  "sessions": [
    {{
      "day": "String (e.g., Lunes - Torso)",
      "exercises": [
        {{
          "order": 1,
          "name": "String",
          "muscleGroup": "String",
          "sets": 3,
          "reps": "String (e.g., '8-12' o 'Fallo')",
          "rpe": "Integer (1-10) o null",
          "tempo": "String (e.g., '3010') o null",
          "restSeconds": 60,
          "technique": "String (e.g., 'Normal', 'Drop Set', 'Biserie')",
          "notes": "String (Instrucción específica)"
        }}
      ]
    }}
  ]
}}
"""

class RoutineAgent:
    """Envoltorio del agente que puede llamar a OpenAI o un mock local para Rutinas."""

    def __init__(self, model: Optional[str] = None) -> None:
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.init_error = None
        
        self._use_openai = bool(self.api_key)
        if self._use_openai:
            try:
                from openai import OpenAI
                import httpx
                # Corrección para error de argumento proxies
                http_client = httpx.Client()
                self._client = OpenAI(api_key=self.api_key, http_client=http_client)
                logger.info(f"RoutineAgent initialized with OpenAI model: {self.model}")
            except Exception as e:
                self.init_error = str(e)
                logger.error(f"Failed to initialize OpenAI client for RoutineAgent: {e}")
                self._use_openai = False
                self._client = None
        else:
            self.init_error = "OPENAI_API_KEY missing"
            logger.warning("RoutineAgent: OPENAI_API_KEY not found. Using mock.")
            self._client = None

    def backend(self) -> str:
        """Indica el backend activo."""
        if self._use_openai:
            return f"openai:{self.model}"
        return f"mock ({self.init_error})" if self.init_error else "mock"

    def run(self, level: str, goal: str, frequency: str, equipment: str) -> Dict[str, Any]:
        """Ejecuta el agente y devuelve JSON estructurado."""
        logger.info(
            "[AgentRun] RoutineAgent start | backend=%s model=%s args=(%s, %s, %s, %s)",
            self.backend(), self.model, level, goal, frequency, equipment
        )
        
        prompt = build_routine_prompt(level, goal, frequency, equipment)

        if self._use_openai:
            return self._run_openai(prompt)
        return self._run_mock(level, goal, frequency)

    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        try:
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Eres un arquitecto de software deportivo y entrenador experto. Devuelve solo JSON válido."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or "{}"
            result = json.loads(content)
            
            logger.info("[AgentRun] RoutineAgent openai success")
            return result
        except Exception as e:
            logger.error(f"RoutineAgent OpenAI call failed: {e}", exc_info=True)
            return self._run_mock("Unknown", "ErrorFallback", "3")

    def _run_mock(self, level: str, goal: str, frequency: str) -> Dict[str, Any]:
        """Mock simple para pruebas o fallback."""
        logger.info("[AgentRun] RoutineAgent running mock fallback")
        return {
            "routineName": f"Rutina Mock {level} - {goal}",
            "difficulty": level,
            "microcyclePhase": "Acumulación (Mock)",
            "sessions": [
                {
                    "day": "Día 1 - Full Body Mock",
                    "exercises": [
                        {
                            "order": 1,
                            "name": "Sentadilla Copa (Mock)",
                            "muscleGroup": "Piernas",
                            "sets": 3,
                            "reps": "12-15",
                            "rpe": 7,
                            "tempo": "3010",
                            "restSeconds": 90,
                            "technique": "Normal",
                            "notes": "Enfoque en técnica"
                        },
                        {
                            "order": 2,
                            "name": "Flexiones",
                            "muscleGroup": "Pecho",
                            "sets": 3,
                            "reps": "Al fallo",
                            "rpe": 9,
                            "tempo": "2010",
                            "restSeconds": 60,
                            "technique": "Normal",
                            "notes": "Pecho al suelo"
                        }
                    ]
                }
            ]
        }
