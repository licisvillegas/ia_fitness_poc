from datetime import datetime
from flask import request
import extensions

def log_audit_event(event_type, user_id=None, details=None, level='info', ip_address=None, user_agent=None):
    """
    Registra un evento de auditoría en la colección 'audit_logs' de MongoDB.
    
    Args:
        event_type (str): Tipo de evento (ej. 'USER_LOGIN', 'LOGIN_FAILED').
        user_id (str, optional): ID del usuario relacionado.
        details (dict, optional): Detalles adicionales del evento.
        level (str, optional): Nivel del log ('info', 'warn', 'error', 'critical').
        ip_address (str, optional): IP del cliente. Si es None, se intenta obtener de request.
        user_agent (str, optional): UA del cliente. Si es None, se intenta obtener de request.
    """
    if extensions.db is None:
        return

    try:
        # Intentar obtener contexto de request si estamos en una petición Flask
        if not ip_address:
            try:
                ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
            except Exception:
                pass
        
        if not user_agent:
            try:
                user_agent = request.headers.get('User-Agent')
            except Exception:
                pass

        doc = {
            "timestamp": datetime.utcnow(),
            "event_type": event_type,
            "level": level,
            "user_id": str(user_id) if user_id else None,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "details": details or {}
        }
        
        extensions.db.audit_logs.insert_one(doc)
    except Exception as e:
        # Fallback seguro para no romper la app si falla el log
        extensions.logger.error(f"Error al escribir audit log: {e}")
