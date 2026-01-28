
import os
import sys
import argparse
from pymongo import MongoClient
from dotenv import load_dotenv
from openai import OpenAI
import certifi

# Cargar entorno
load_dotenv()

# Configuración
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not MONGO_URI or not MONGO_DB:
    print("❌ Error: MONGO_URI y MONGO_DB deben estar definidos en .env")
    sys.exit(1)

if not OPENAI_API_KEY:
    print("❌ Error: OPENAI_API_KEY debe estar definido en .env")
    sys.exit(1)

client = OpenAI(api_key=OPENAI_API_KEY)
mongo_client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
db = mongo_client[MONGO_DB]
exercises_collection = db.exercises

def generate_info(exercise_name):
    """
    Genera descripción en español y traducción del nombre usando OpenAI.
    """
    prompt = f"""
    Eres un entrenador experto. Para el ejercicio "{exercise_name}":
    1. Provee una descripción DETALLADA en ESPAÑOL de cómo se ejecuta correctamente (técnica, postura, movimiento). Max 100 palabras.
    2. Si el nombre "{exercise_name}" está en inglés, dame su traducción común al español. Si ya está en español o no tiene traducción clara, repite el nombre original.
    
    Responde en formato JSON estrictamente:
    {{
        "description": "...",
        "spanish_name": "..."
    }}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": "You are a helpful fitness assistant. Output JSON only."}, 
                      {"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"  ❌ Error consultando OpenAI: {e}")
        return None

import json

def process_exercises(force_update=False):
    print("🔍 Iniciando actualización de ejercicios...")
    
    # query = {} if force_update else {"description": {"$in": [None, ""]}}
    # User pidió recorrer "la colección", asumiremos que quiere revisar todos, 
    # pero para ahorrar, poremos un flag. Por defecto revisaremos si falta descripción.
    
    # Sin embargo, el prompt dice "llenar el campo description", implicando que podría estar vacío. 
    # Y "si... inglés... agregar a alternative_names".
    
    cursor = exercises_collection.find({})
    count = exercises_collection.count_documents({})
    print(f"📋 Total ejercicios encontrados: {count}")
    
    updated_count = 0
    
    for ex in cursor:
        name = ex.get("name")
        curr_desc = ex.get("description", "")
        
        # Criterio simple: si ya tiene descripción larga (>20 chars) y no forzamos, saltar.
        if not force_update and curr_desc and len(curr_desc) > 20:
            print(f"⏩ Saltando '{name}' (ya tiene descripción).")
            continue
            
        print(f"🤖 Procesando '{name}'...")
        
        data_str = generate_info(name)
        if not data_str:
            continue
            
        try:
            data = json.loads(data_str)
            new_desc = data.get("description")
            spanish_name = data.get("spanish_name")
            
            update_fields = {}
            if new_desc:
                update_fields["$set"] = {"description": new_desc}
                
            update_ops = {}
            if update_fields:
                update_ops.update(update_fields)
            
            # Logic for alternative_names
            if spanish_name and spanish_name.lower() != name.lower():
                # $addToSet para no duplicar
                update_ops["$addToSet"] = {"alternative_names": spanish_name}
            
            if update_ops:
                exercises_collection.update_one({"_id": ex["_id"]}, update_ops)
                print(f"  ✅ Actualizado: {name}")
                if spanish_name and spanish_name.lower() != name.lower():
                   print(f"     + Alt Name: {spanish_name}")
                updated_count += 1
                
        except json.JSONDecodeError:
            print("  ❌ Error decodificando JSON de DB.")
            
    print(f"✨ Proceso finalizado. Total actualizados: {updated_count}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Forzar actualización de todos los ejercicios aunque tengan descripción")
    args = parser.parse_args()
    
    process_exercises(force_update=args.force)
