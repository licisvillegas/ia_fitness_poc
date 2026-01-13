"""
Script de verificacion para agentes OpenAI.

Que hace:
- Carga variables de entorno desde .env (si python-dotenv esta disponible).
- Ejecuta varios agentes con payloads minimos.
- Muestra el backend activo y un resumen de la salida.

Uso:
- python scripts/test_agents_openai.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, Optional

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    pass

from ai_agents.reasoning_agent import ReasoningAgent as LegacyReasoningAgent  # noqa: E402
from ai_agents.reasoning_agent import ReasoningAgent  # noqa: E402
from ai_agents.body_assessment_agent import BodyAssessmentAgent  # noqa: E402
from ai_agents.meal_plan_agent import MealPlanAgent  # noqa: E402


def _print_result(name: str, backend: str, result: Dict[str, Any]) -> None:
    print(f"\n[{name}] backend: {backend}")
    print(f"keys: {list(result.keys())}")
    print(json.dumps(result, ensure_ascii=False, indent=2)[:1200])


def _apply_force_backend(force_backend: Optional[str]) -> Dict[str, Optional[str]]:
    original = {"OPENAI_API_KEY": os.getenv("OPENAI_API_KEY")}
    if force_backend == "mock":
        if "OPENAI_API_KEY" in os.environ:
            os.environ.pop("OPENAI_API_KEY", None)
        os.environ["OPENAI_API_KEY"] = ""
    return original


def _restore_env(original: Dict[str, Optional[str]]) -> None:
    if "OPENAI_API_KEY" in original:
        if original["OPENAI_API_KEY"] is None:
            os.environ.pop("OPENAI_API_KEY", None)
        else:
            os.environ["OPENAI_API_KEY"] = original["OPENAI_API_KEY"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test for OpenAI agents.")
    parser.add_argument(
        "--force-backend",
        choices=["mock", "openai"],
        help="Force mock or openai behavior for this run.",
    )
    args = parser.parse_args()

    if args.force_backend == "openai" and not os.getenv("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY is not set; openai backend may fallback to mock.")

    original_env = _apply_force_backend(args.force_backend)
    try:
        _run()
    finally:
        _restore_env(original_env)


def _run() -> None:
    # Payloads minimos para validar llamada OpenAI.
    reasoning_payload = {
        "progress": [
            {"body_fat": 22.0, "performance": 70, "nutrition_adherence": 85},
            {"body_fat": 21.8, "performance": 72, "nutrition_adherence": 88},
        ]
    }
    body_payload = {
        "sex": "male",
        "age": 30,
        "goal": "definicion",
        "measurements": {
            "weight_kg": 78,
            "height_cm": 178,
            "waist": 86,
            "neck": 40,
            "hip": 98,
        },
    }
    meal_payload = {
        "total_kcal": 2200,
        "meals": 4,
        "macros": {"protein": 160, "carbs": 250, "fat": 70},
    }

    agents = [
        ("ReasoningAgent (ai_agents)", ReasoningAgent(), reasoning_payload),
        ("ReasoningAgent (agents)", LegacyReasoningAgent(), reasoning_payload),
        ("BodyAssessmentAgent", BodyAssessmentAgent(), body_payload),
        ("MealPlanAgent", MealPlanAgent(), meal_payload),
    ]

    for name, agent, payload in agents:
        result = agent.run(payload)
        _print_result(name, agent.backend(), result)


if __name__ == "__main__":
    main()
