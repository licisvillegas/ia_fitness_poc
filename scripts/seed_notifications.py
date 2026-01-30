
import os
import sys
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

# Ensure we can find packages if needed, though this is a standalone script
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load env manually or assume environment variables are set
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print("Error: MONGO_URI not found in environment variables.")
    sys.exit(1)

def seed_notifications():
    client = MongoClient(MONGO_URI)
    db_name = os.getenv("MONGO_DB", "ia_fitness_db")
    db = client.get_database(db_name)
    
    # Target User
    user_id_str = "6931cf1adeba6b26a5fb524e"
    try:
        user_oid = ObjectId(user_id_str)
    except:
        print(f"Invalid user_id: {user_id_str}")
        return

    notifications = [
        {
            "user_id": user_oid,
            "title": "Bienvenido a Notificaciones",
            "message": "Este es un ejemplo de una notificación informativa.",
            "type": "info",
            "read": False,
            "created_at": datetime.now(),
            "link": None
        },
        {
            "user_id": user_oid,
            "title": "¡Récord Superado!",
            "message": "Has completado 10 entrenamientos este mes.",
            "type": "success",
            "read": False,
            "created_at": datetime.now(),
            "link": "/dashboard"
        },
        {
            "user_id": user_oid,
            "title": "Suscripción por vencer",
            "message": "Tu plan actual finaliza en 3 días. Renueva para no perder acceso.",
            "type": "warning",
            "read": False,
            "created_at": datetime.now(),
            "link": "/plan"
        }
    ]

    print(f"Connecting to {MONGO_URI.split('@')[-1]}...")
    
    col = db.notifications
    result = col.insert_many(notifications)
    
    print(f"Inserted {len(result.inserted_ids)} notifications for user {user_id_str}.")
    client.close()

if __name__ == "__main__":
    seed_notifications()
