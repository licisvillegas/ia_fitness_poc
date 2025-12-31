"""
Validadores y normalizadores de datos
"""
from datetime import datetime
from typing import Optional
from extensions import logger


def normalize_user_status(status: Optional[str]) -> str:
    """Normaliza el status del usuario a valores válidos"""
    valid_statuses = {"active", "inactive", "suspended", "pending"}
    if not status or status.lower() not in valid_statuses:
        return "active"
    return status.lower()


def parse_birth_date(birth_date_str: Optional[str]) -> Optional[datetime]:
    """
    Parsea una fecha de nacimiento desde string a datetime.
    Soporta formatos: YYYY-MM-DD, DD/MM/YYYY
    """
    if not birth_date_str:
        return None
    
    try:
        # Intentar formato ISO (YYYY-MM-DD)
        return datetime.strptime(birth_date_str, "%Y-%m-%d")
    except ValueError:
        try:
            # Intentar formato DD/MM/YYYY
            return datetime.strptime(birth_date_str, "%d/%m/%Y")
        except ValueError:
            logger.warning(f"Formato de fecha inválido: {birth_date_str}")
            return None


def format_birth_date(birth_date: Optional[datetime]) -> Optional[str]:
    """Formatea una fecha de nacimiento a string ISO"""
    if isinstance(birth_date, datetime):
        return birth_date.strftime("%Y-%m-%d")
    return None


def compute_age(birth_date: Optional[datetime]) -> Optional[int]:
    """Calcula la edad a partir de la fecha de nacimiento"""
    if not isinstance(birth_date, datetime):
        return None
    
    today = datetime.now()
    age = today.year - birth_date.year
    
    # Ajustar si aún no ha cumplido años este año
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    
    return age


def normalize_measurements(data: dict) -> dict:
    """
    Normaliza mediciones corporales asegurando tipos correctos
    """
    normalized = {}
    
    # Campos numéricos
    numeric_fields = ['height', 'weight', 'chest', 'waist', 'hips', 'arms', 'legs']
    for field in numeric_fields:
        if field in data:
            try:
                normalized[field] = float(data[field])
            except (ValueError, TypeError):
                logger.warning(f"Valor inválido para {field}: {data[field]}")
    
    # Campos de texto
    text_fields = ['sex', 'activity_level', 'goal']
    for field in text_fields:
        if field in data:
            normalized[field] = str(data[field]).strip()
    
    return normalized


def sanitize_photos(photos: Optional[list]) -> list:
    """
    Sanitiza lista de fotos, asegurando que sean strings base64 válidos
    """
    if not photos or not isinstance(photos, list):
        return []
    
    sanitized = []
    for photo in photos:
        if isinstance(photo, str) and photo.strip():
            # Verificar que sea base64 válido (simplificado)
            if photo.startswith('data:image'):
                sanitized.append(photo)
            else:
                logger.warning("Foto con formato inválido ignorada")
    
    return sanitized
