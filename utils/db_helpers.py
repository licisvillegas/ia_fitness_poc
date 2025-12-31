"""
Helpers para operaciones de base de datos
"""
from typing import Any, Dict, Optional
import extensions
from extensions import logger
import os


def log_agent_execution(
    stage: str,
    name: str,
    agent: Any,
    payload: Optional[Dict[str, Any]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Log agent execution details without leaking sensitive data."""
    backend = agent.backend() if hasattr(agent, "backend") else "unknown"
    model = getattr(agent, "model", None)
    init_error = getattr(agent, "init_error", None)
    key_present = bool(os.getenv("OPENAI_API_KEY"))
    payload_keys = list(payload.keys()) if isinstance(payload, dict) else None
    meta = {"backend": backend, "model": model, "key_present": key_present, "init_error": init_error}
    if payload_keys is not None:
        meta["payload_keys"] = payload_keys
    if extra:
        meta.update(extra)
    logger.info(f"[AgentRun:{stage}] {name} | {meta}")


def fetch_user_progress_for_agent(user_id: str) -> list:
    """
    Obtiene el historial de progreso del usuario para alimentar agentes de IA.
    Retorna una lista de registros de progreso ordenados por fecha.
    """
    if not user_id or extensions.db is None:
        return []
    
    try:
        progress_cursor = extensions.db.progress.find(
            {"user_id": user_id}
        ).sort("date", -1).limit(30)
        
        progress_list = []
        for p in progress_cursor:
            # Convertir ObjectId y datetime a strings
            progress_item = {
                "date": p.get("date").isoformat() if p.get("date") else None,
                "weight": p.get("weight"),
                "body_fat": p.get("body_fat"),
                "muscle_mass": p.get("muscle_mass"),
                "notes": p.get("notes", "")
            }
            progress_list.append(progress_item)
        
        return progress_list
        
    except Exception as e:
        logger.error(f"Error fetching user progress: {e}")
        return []


def get_user_profile(user_id: str) -> Optional[dict]:
    """Obtiene el perfil completo del usuario"""
    if not user_id or extensions.db is None:
        return None
    
    try:
        user = extensions.db.users.find_one({"user_id": user_id})
        if not user:
            return None
        
        profile = extensions.db.user_profiles.find_one({"user_id": user_id})
        
        return {
            "user_id": user_id,
            "name": user.get("name"),
            "email": user.get("email"),
            "username": user.get("username"),
            "profile": profile if profile else {}
        }
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        return None
