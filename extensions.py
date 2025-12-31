"""
Extensiones Flask y objetos compartidos
"""
import logging
import certifi
from pymongo import MongoClient
from config import Config

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ai_fitness")

# MongoDB client y database (se inicializan en init_app)
mongo_client = None
db = None


def init_db(app):
    """Inicializa la conexión a MongoDB"""
    global mongo_client, db
    
    try:
        mongo_uri = app.config.get('MONGO_URI')
        if not mongo_uri:
            raise ValueError("❌ No se encontró la variable MONGO_URI en el entorno")
        
        # Configurar conexión segura con certificados válidos
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
        logger.info("✅ Conexión segura con MongoDB Atlas establecida correctamente")
        
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
        
        logger.info("✅ Índices creados: plans.user_id+created_at, ai_adjustments.user_id+created_at")
        
    except Exception as e:
        logger.warning(f"No se pudieron crear índices: {e}")
