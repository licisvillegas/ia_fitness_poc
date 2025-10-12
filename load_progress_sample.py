# ======================================================
# Script: load_progress_sample.py
# Autor: Ismael Villegas
# Descripción:
# Carga automática de datos de progreso (progress.json)
# a la colección "progress" en MongoDB Atlas.
# ======================================================

import json
from pymongo import MongoClient
from datetime import datetime

# === CONFIGURACIÓN DE CONEXIÓN === #
MONGO_URI="mongodb+srv://1smaelV:fGLlKX8lKwT1SsAa@mongofree.vxtfsny.mongodb.net/?retryWrites=true&w=majority&appName=MongoFree"
DATABASE_NAME = "ia_fitness_db"
COLLECTION_NAME = "progress"

# === CARGA DEL ARCHIVO JSON === #
JSON_FILE = "progress.json"

print("📁 Cargando archivo de progreso...")
with open(JSON_FILE, "r", encoding="utf-8") as file:
    progress_data = json.load(file)

# === FORMATEO Y VALIDACIÓN === #
for doc in progress_data:
    # Validar formato de fecha
    try:
        doc["date"] = datetime.strptime(doc["date"], "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError(f"⚠️ Fecha inválida en documento: {doc}")

print(f"✅ {len(progress_data)} registros listos para insertar.")

# === CONEXIÓN A MONGODB === #
try:
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    print("🔗 Conectado exitosamente a MongoDB Atlas.")
except Exception as e:
    print(f"❌ Error al conectar con MongoDB: {e}")
    exit(1)

# === INSERCIÓN DE DATOS === #
try:
    result = collection.insert_many(progress_data)
    print(f"🎯 {len(result.inserted_ids)} documentos insertados en la colección '{COLLECTION_NAME}'.")
except Exception as e:
    print(f"❌ Error al insertar documentos: {e}")
    exit(1)

# === VALIDACIÓN DE RESULTADOS === #
count = collection.count_documents({})
print(f"📊 Total actual de documentos en la colección: {count}")

# === CIERRE DE CONEXIÓN === #
client.close()
print("✅ Carga finalizada correctamente.")
