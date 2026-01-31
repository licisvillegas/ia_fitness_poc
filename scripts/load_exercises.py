
import os
import sys
import json
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

# Add project root to path for local execution if needed, though we can just run from root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

def load_exercises():
    print("🚀 Iniciando carga de ejercicios...")

    if not MONGO_URI or not MONGO_DB:
        print("❌ Error: Faltan credenciales MONGO_URI o MONGO_DB en .env")
        return

    # 1. Connect to MongoDB
    try:
        client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
        db = client[MONGO_DB]
        collection = db.exercises
        print("✅ Conectado a MongoDB Atlas")
    except Exception as e:
        print(f"❌ Error conectando a BD: {e}")
        return

    # 2. Read JSON file
    json_path = os.path.join("docs", "data", "ejercicios.json")
    if not os.path.exists(json_path):
        print(f"❌ Error: No se encuentra el archivo {json_path}")
        return

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            exercises_data = json.load(f)
        print(f"📄 Leídos {len(exercises_data)} ejercicios del JSON.")
    except Exception as e:
        print(f"❌ Error leyendo JSON: {e}")
        return

    # 3. Process and Insert/Upsert
    inserted = 0
    updated = 0
    
    for item in exercises_data:
        # Mapping
        # "category": "Tríceps" -> "type": "Tríceps"
        # "name": "Copa..." -> "name": "Copa..."
        # "description_short": "..." -> "description": "..."
        
        category = item.get("category", "").strip()
        name = item.get("name", "").strip()
        description_short = item.get("description_short", "").strip()

        if not name:
            continue

        doc = {
            "name": name,
            "type": category,          # Mapping category -> type
            "description": description_short  # Mapping description_short -> description
        }

        # Uses name as unique key to prevent duplicates if run multiple times
        result = collection.update_one(
            {"name": name},
            {"$set": doc},
            upsert=True
        )

        if result.upserted_id:
            inserted += 1
        elif result.modified_count > 0:
            updated += 1

    print(f"✨ Proceso finalizado.")
    print(f"   - Insertados: {inserted}")
    print(f"   - Actualizados: {updated}")
    print(f"   - Total en DB: {collection.count_documents({})}")

if __name__ == "__main__":
    load_exercises()
