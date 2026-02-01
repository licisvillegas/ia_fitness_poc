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
    (Versión migrada a body_assessments)
    """
    if not user_id or extensions.db is None:
        return []
    
    # Reutilizamos la lógica del helper principal importándolo o replicando
    # Para evitar dependencia circular limpia, replicamos la lectura básica
    try:
        cursor = extensions.db.body_assessments.find(
            {"user_id": user_id},
            {"created_at": 1, "input": 1, "output": 1}
        ).sort("created_at", -1).limit(30)
        
        progress_list = []
        for p in cursor:
            # Metrics Extraction
            inp = p.get("input") or {}
            meas = inp.get("measurements") or {}
            out = p.get("output") or {}
            bc = out.get("body_composition") or {}

            weight = meas.get("weight_kg") or inp.get("weight")
            
            bf = None
            if bc.get("body_fat_percent"): bf = bc.get("body_fat_percent")
            elif out.get("body_fat_percent"): bf = out.get("body_fat_percent")
            elif meas.get("body_fat_percent"): bf = meas.get("body_fat_percent")
            elif meas.get("body_fat"): bf = meas.get("body_fat")

            muscle_mass = None
            if bc.get("muscle_mass_percent"): muscle_mass = bc.get("muscle_mass_percent")
            elif meas.get("muscle_mass_percent"): muscle_mass = meas.get("muscle_mass_percent")

            progress_item = {
                "date": p.get("created_at").isoformat() if p.get("created_at") else None,
                "weight": weight,
                "body_fat": bf,
                "muscle_mass": muscle_mass,
                "notes": inp.get("notes", "") # assessment notes
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
