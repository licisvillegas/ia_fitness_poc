"""
Script para verificar datos en workout_sessions collection
"""
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import certifi
from datetime import datetime

load_dotenv()

try:
    mongo_uri = os.getenv("MONGO_URI")
    client = MongoClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000
    )
    
    db = client[os.getenv("MONGO_DB")]
    
    print("=" * 60)
    print("VERIFICACIÓN DE WORKOUT_SESSIONS")
    print("=" * 60)
    
    # Count total documents
    total_sessions = db.workout_sessions.count_documents({})
    print(f"\nTotal de sesiones en workout_sessions: {total_sessions}")
    
    if total_sessions > 0:
        print("\n--- Primeras 5 sesiones ---")
        sessions = list(db.workout_sessions.find().limit(5))
        for i, session in enumerate(sessions, 1):
            print(f"\nSesión {i}:")
            print(f"  user_id: {session.get('user_id')}")
            print(f"  routine_id: {session.get('routine_id')}")
            print(f"  total_volume: {session.get('total_volume')}")
            print(f"  created_at: {session.get('created_at')}")
            print(f"  start_time: {session.get('start_time')}")
            print(f"  sets count: {len(session.get('sets', []))}")
        
        # Group by user_id
        print("\n--- Sesiones por usuario ---")
        pipeline = [
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        user_counts = list(db.workout_sessions.aggregate(pipeline))
        for uc in user_counts:
            print(f"  user_id: {uc['_id']} -> {uc['count']} sesiones")
    else:
        print("\n⚠️  No hay sesiones en la colección workout_sessions")
        print("Esto explica por qué el 'Historial de Sesiones' está vacío.")
    
    print("\n" + "=" * 60)
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
