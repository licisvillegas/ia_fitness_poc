
import os
import sys
from pymongo import MongoClient
import certifi
from dotenv import load_dotenv

# Cargar entorno
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

def export_missing():
    print("🔍 Buscando ejercicios sin descripción...")
    
    if not MONGO_URI or not MONGO_DB:
        print("Error: Faltan credenciales en .env")
        return

    client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
    db = client[MONGO_DB]
    collection = db.exercises

    # Buscar TODOS los ejercicios
    cursor = collection.find({})
    
    found_count = 0
    filename = "exercises_audit.md"
    
    with open(filename, "w", encoding="utf-8") as f:
        f.write("# Auditoría Completa de Ejercicios\n\n")
        
        for ex in cursor:
            oid = str(ex.get("_id", ""))
            name = ex.get("name", "SIN NOMBRE")
            alt_names = ex.get("alternative_names", [])
            alt_names_str = ', '.join(alt_names) if alt_names else ''
            
            f.write(f"id: {oid}\n")
            f.write(f"name: {name}\n")
            f.write(f"description: \n")
            f.write(f"alternative_names: {alt_names_str}\n")
            f.write("\n---\n\n")
            found_count += 1
            
    print(f"✨ Reporte generado en '{filename}'. Total ejercicios listados: {found_count}")

if __name__ == "__main__":
    export_missing()
