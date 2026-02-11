from celery_app.celery_config import celery_app
from extensions import db
from ai_agents.routine_agent_mongo import MongoRoutineAgent
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def generate_routine_async(self, level, goal, frequency, equipment, body_parts, include_cardio):
    """
    Task asincrona para generar rutinas usando MongoRoutineAgent.
    """
    try:
        # Re-verificar DB en el contexto del worker
        if db is None:
            raise Exception("Base de datos no disponible en worker")

        agent = MongoRoutineAgent(db)
        result = agent.run(
            level=level,
            goal=goal,
            frequency=frequency,
            equipment=equipment,
            body_parts=body_parts,
            include_cardio=include_cardio,
        )
        return result
    except Exception as e:
        logger.error(f"Error en generate_routine_async: {e}", exc_info=True)
        # Reintentar si es error transitorio? Por ahora solo fail.
        # self.retry(exc=e, countdown=5)
        raise e
