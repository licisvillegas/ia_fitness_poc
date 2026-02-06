"""Wrapper legacy para evaluacion corporal.

Este wrapper conserva la interfaz histórica de BodyAssessmentAgent y delega
en los nuevos agentes especializados:
- BodyMetricsAgent (calculos y recomendaciones)
- PhotoAssessmentAgent (analisis visual de fotos)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .body_metrics_agent import BodyMetricsAgent
from .photo_assessment_agent import PhotoAssessmentAgent


class BodyAssessmentAgent:
    """Compatibilidad legacy: une metricas y fotos en un solo output."""

    def __init__(self, model: Optional[str] = None) -> None:
        self._metrics = BodyMetricsAgent(model=model)
        self._photos = PhotoAssessmentAgent(model=model)

    def backend(self) -> str:
        metrics_backend = self._metrics.backend()
        photos_backend = self._photos.backend()
        if metrics_backend == photos_backend:
            return metrics_backend
        return f"{metrics_backend}+{photos_backend}"

    def run(self, context: Dict[str, Any], images: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        metrics_output = self._metrics.run(context)
        photo_output = self._photos.run(context, images=images)
        return _merge_outputs(metrics_output, photo_output)


def _merge_outputs(metrics_output: Dict[str, Any], photo_output: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    combined = dict(metrics_output or {})
    if not photo_output:
        combined.setdefault("photo_feedback", [])
        return combined

    if photo_output.get("photo_feedback") is not None:
        combined["photo_feedback"] = photo_output.get("photo_feedback")

    if photo_output.get("proportions") and photo_output["proportions"].get("symmetry_notes"):
        proportions = combined.get("proportions") or {}
        proportions["symmetry_notes"] = photo_output["proportions"]["symmetry_notes"]
        combined["proportions"] = proportions

        body_props = combined.get("body_proportions") or {}
        body_props["symmetry_analysis"] = photo_output["proportions"]["symmetry_notes"]
        combined["body_proportions"] = body_props

    return combined
