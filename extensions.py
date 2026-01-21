import os
import sys
import logging
import certifi
from pymongo import MongoClient
from config import Config

# Configuración de logging global
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("ai_fitness")
logger.info("✔ Aplicación AI Fitness iniciada correctamente")

# Check OpenAI Key Status
openai_key = os.getenv("OPENAI_API_KEY")
if openai_key:
    masked_key = f"{openai_key[:8]}...{openai_key[-4:]}" if len(openai_key) > 12 else "***"
    logger.info(f"✔ OPENAI_API_KEY detectada: {masked_key}")
else:
    logger.warning("⚠ OPENAI_API_KEY no encontrada en variables de entorno. Los agentes usarán MOCK.")

# MongoDB client y database (se inicializan en init_app)
mongo_client = None
db = None


def init_db(app):
    """Inicializa la conexión a MongoDB"""
    global mongo_client, db
    
    try:
        mongo_enabled = app.config.get("MONGO_ENABLED", True)
        if not mongo_enabled:
            logger.warning("MongoDB disabled via MONGO_ENABLED=false; skipping connection.")
            db = None
            return None

        mongo_uri = app.config.get('MONGO_URI')
        if not mongo_uri:
            logger.warning("MONGO_URI not set; skipping MongoDB connection.")
            db = None
            return None

        # Configurar conexion segura con certificados validos
        mongo_client = MongoClient(
            mongo_uri,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=20000,
            socketTimeoutMS=20000,
            connect=False
        )
        
        db = mongo_client[app.config.get('MONGO_DB')]
        logger.info("✔  Conexión segura con MongoDB Atlas establecida correctamente")
        
        return db
        
    except Exception as e:
        logger.error(f"❌ Error al conectar a MongoDB Atlas: {str(e)}", exc_info=True)
        db = None
        return None


def create_indexes(db_instance):
    """Crea índices necesarios en MongoDB"""
    if db_instance is None:
        return
    
    try:
        # Índices principales
        db_instance.plans.create_index([("user_id", 1), ("created_at", -1)])
        
        try:
            db_instance.ai_adjustments.create_index([("user_id", 1), ("created_at", -1)])
        except Exception:
            pass
        
        # Limpiar índices obsoletos
        try:
            existing_indexes = db_instance.users.index_information()
            for idx_name in ("user_id_1", "user_name_lower_1"):
                if idx_name in existing_indexes:
                    db_instance.users.drop_index(idx_name)
                    logger.info(f"Índice obsoleto eliminado: {idx_name}")
        except Exception as drop_err:
            logger.warning(f"No se pudo limpiar índices obsoletos: {drop_err}")
        
        # Índices únicos
        try:
            db_instance.users.create_index("email", unique=True)
        except Exception:
            pass
        
        try:
            db_instance.users.create_index("username_lower", unique=True, sparse=True)
        except Exception:
            pass
        
        try:
            db_instance.user_status.create_index("user_id", unique=True)
        except Exception:
            pass
        
        try:
            db_instance.user_profiles.create_index("user_id", unique=True)
        except Exception:
            pass
        
        logger.info("✔  Índices creados: plans.user_id+created_at, ai_adjustments.user_id+created_at")
        
    except Exception as e:
        logger.warning(f"No se pudieron crear índices: {e}")
