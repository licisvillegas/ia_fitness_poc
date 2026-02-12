from extensions import logger, db

class BaseService:
    """Clase base para todos los servicios, provee acceso dinámico a DB y logger."""
    
    @property
    def db(self):
        from extensions import db
        return db

    @property
    def logger(self):
        from extensions import logger
        return logger
