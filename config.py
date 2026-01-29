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
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    
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

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:no-reply@localhost")
    
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
