import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load env variables explicitly
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
print(f"DEBUG: Loading .env from {env_path}")
loaded = load_dotenv(env_path, override=True) # Force override
# Manual fallback for loading env
try:
    print(f"DEBUG: Opening .env at {env_path}")
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('MONGO_URI='):
                val = line.split('=', 1)[1]
                # Remove quotes if present
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                os.environ['MONGO_URI'] = val
                print("DEBUG: Manually set MONGO_URI from .env")
            elif line.startswith('MONGO_DB='):
                val = line.split('=', 1)[1]
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                     val = val[1:-1]
                os.environ['MONGO_DB'] = val
                print("DEBUG: Manually set MONGO_DB from .env")
except Exception as e:
    print(f"DEBUG: Manual .env read failed: {e}")

# Check before import
print(f"DEBUG: Pre-import MONGO_URI string len={len(os.getenv('MONGO_URI', ''))}")
from app import create_app
import extensions

def broadcast():
    app = create_app()
    
    # Force overrides if config failed
    uri = os.environ.get('MONGO_URI')
    db_name = os.environ.get('MONGO_DB')
    if uri:
        app.config['MONGO_URI'] = uri
        app.config['MONGO_ENABLED'] = True # Force enable
        if db_name:
             app.config['MONGO_DB'] = db_name
        print(f"DEBUG: Forced app.config['MONGO_URI'], DB={db_name}")
    
    with app.app_context():
        # Re-initialize DB with correct config
        print("DEBUG: Re-initializing DB...")
        db = extensions.init_db(app)
        
        if db is None:
            print("Error: DB setup failed even after re-init.")
            return

        # Notification payload
        title = "Más herramientas para tu meta"
        msg = (
            "Si ya ingresaste tus datos para tu evaluación, ahora podrás notar cambios importantes en la aplicación.\n"
            "Uno de ellos es que ya cuentas con tres opciones de plan de alimentación y un buscador de alimentos equivalentes para mayor flexibilidad.\n\n"
            "Si estás probando la aplicación, agradeceremos mucho tus comentarios para seguir mejorando tu experiencia."
        )
        notif_type = "info" # Options: info, success, warning, error
        link = "/nutrition"
        
        # 1. Get all users
        print("Fetching users...")
        users = list(db.users.find({}, {"_id": 1}))
        print(f"Found {len(users)} users.")

        if not users:
            print("No users found.")
            return

        # 2. Bulk Insert
        notifications_docs = []
        now = datetime.utcnow()
        
        for u in users:
            doc = {
                "user_id": u["_id"], # ObjectId
                "title": title,
                "message": msg,
                "type": notif_type,
                "link": link,
                "read": False,
                "created_at": now
            }
            notifications_docs.append(doc)

        if notifications_docs:
            res = db.notifications.insert_many(notifications_docs)
            print(f"Successfully inserted {len(res.inserted_ids)} notifications.")
        else:
            print("No documents to insert.")

if __name__ == "__main__":
    broadcast()
