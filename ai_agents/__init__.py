"""Paquete de agentes inteligentes para Synapse Fit.

Incluye:
- :class:`~ai_agents.reasoning_agent.ReasoningAgent` para ajustes de
  nutrición y entrenamiento.
- :class:`~ai_agents.meal_plan_agent.MealPlanAgent` para planes diarios de
  comidas.
- :class:`~ai_agents.body_assessment_agent.BodyAssessmentAgent` para
  evaluaciones corporales basadas en medidas y fotos.

Cada agente puede trabajar con OpenAI (si hay ``OPENAI_API_KEY``) o con un
backend mock determinístico para pruebas locales.
"""

