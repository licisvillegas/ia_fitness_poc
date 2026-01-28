
import os
import sys
import re
from pymongo import MongoClient
from bson.objectid import ObjectId
import certifi
from dotenv import load_dotenv

# Cargar entorno
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

def parse_markdown_file(filepath):
    """Parses the markdown file and returns a list of dictionaries."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = content.split("---")
    exercises = []

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        exercise_data = {}
        lines = block.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            if line.startswith("id:"):
                exercise_data["id"] = line.split(":", 1)[1].strip()
            elif line.startswith("name:"):
                exercise_data["name"] = line.split(":", 1)[1].strip()
            elif line.startswith("description:"):
                exercise_data["description"] = line.split(":", 1)[1].strip()
            elif line.startswith("alternative_names:"):
                alts = line.split(":", 1)[1].strip()
                if alts and alts.lower() != "(ninguno)":
                    exercise_data["alternative_names"] = [
                        name.strip() for name in alts.split(",") if name.strip()
                    ]
                else:
                    exercise_data["alternative_names"] = []

        if "id" in exercise_data and exercise_data["id"]:
            exercises.append(exercise_data)

    return exercises

def update_database(exercises):
    """Updates the MongoDB collection with the parsed data."""
    if not MONGO_URI or not MONGO_DB:
        print("❌ Error: Faltan credenciales en .env")
        return

    client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
    db = client[MONGO_DB]
    collection = db.exercises

    updated_count = 0
    errors = 0

    print(f"🔍 Procesando {len(exercises)} ejercicios...")

    for ex in exercises:
        try:
            oid = ObjectId(ex["id"])
            
            update_fields = {}
            if "description" in ex and ex["description"]:
                update_fields["description"] = ex["description"]
            
            if "alternative_names" in ex:
                 # Ensure we don't overwrite existing alt names if we want to merge, 
                 # but the requirement says "update", so we might overwrite or merge.
                 # User said "usar... para actualizar", usually implies setting the value.
                 # However, usually we want to ADD to alt names.
                 # But looking at the file, it seems the user provided the FULL list of desired alt names.
                 # So we will SET it.
                 update_fields["alternative_names"] = ex["alternative_names"]

            if update_fields:
                collection.update_one({"_id": oid}, {"$set": update_fields})
                updated_count += 1
                
        except Exception as e:
            print(f"❌ Error actualizando {ex.get('name', 'ID ' + ex.get('id', '?'))}: {e}")
            errors += 1

    print(f"✨ Actualización completada.")
    print(f"   ✅ Actualizados: {updated_count}")
    print(f"   ❌ Errores: {errors}")

if __name__ == "__main__":
    filepath = "exercises_audit_filled_refined.md"
    if not os.path.exists(filepath):
        print(f"❌ Error: El archivo '{filepath}' no existe.")
    else:
        data = parse_markdown_file(filepath)
        update_database(data)
