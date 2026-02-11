"""
Configuración centralizada de la aplicación Synapse Fit
"""
import os
from dotenv import load_dotenv

# Cargar variables de entorno PRIMERO
load_dotenv()


class Config:
    """Configuración base de la aplicación"""
    
    # Flask
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    # === CONFIGURACIÓN DE SEGURIDAD Y ENTORNO ===
    # SECRET_KEY: Clave crítica para firmar sesiones y cookies.
    # PRODUCCIÓN: Generar una clave segura con `python scripts/generate_secret_key.py` y agregarla al .env.
    # DESARROLLO: Puede usarse la clave por defecto, pero la app fallará en modo producción si no se cambia.
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

    # DEBUG: Controla el modo de depuración y recarga automática.
    # PRODUCCIÓN: Debe ser False.
    # DESARROLLO: Establecer FLASK_DEBUG=True en .env para ver errores y hot-reloading.
    # Por defecto es False (seguro por defecto).
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    
    # Celery / Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    @staticmethod
    def init_app(app):
        """Inicializa configuración específica de la app"""
        # Validación de seguridad para producción
        if not app.config.get('DEBUG'):
            default_key = "dev-secret-key-change-in-production"
            if app.config.get('SECRET_KEY') == default_key:
                raise ValueError(
                    "🔴 CRÍTICO: SECRET_KEY debe configurarse en producción!\n"
                    "Genera una con: python scripts/generate_secret_key.py"
                )
    
    # MongoDB
    MONGO_URI = os.getenv("MONGO_URI")
    MONGO_DB = os.getenv("MONGO_DB")
    MONGO_ENABLED = os.getenv("MONGO_ENABLED", "true").lower() == "true"
    
    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
    
    # User Status
    USER_STATUS_VALUES = {"active", "inactive", "suspended", "pending"}
    USER_STATUS_DEFAULT = "active"
    
    # Admin
    ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
    ADMIN_IDLE_TIMEOUT_SECONDS = int(os.getenv("ADMIN_IDLE_TIMEOUT_SECONDS", "900"))
    
    # Server
    HOST = "0.0.0.0"
    PORT = int(os.getenv("PORT", "5000"))
    
    # CORS
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000").split(",")

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:no-reply@localhost")
    PUSH_PRUNE_INVALID = os.getenv("PUSH_PRUNE_INVALID", "1") not in ("0", "false", "False")
    
    @staticmethod
    def init_app(app):
        """Inicializa configuración específica de la app"""
        pass


class DevelopmentConfig(Config):
    """Configuración para desarrollo"""
    DEBUG = True


class ProductionConfig(Config):
    """Configuración para producción"""
    DEBUG = False


# Configuración por defecto
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
