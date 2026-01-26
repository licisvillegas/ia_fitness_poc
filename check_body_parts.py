
import os
from pymongo import MongoClient
import certifi

# Hardcoded URI from .env for simplicity in# Configuración
MONGO_URI = os.getenv("MONGO_URI")

def check_body_parts():
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['ia_fitness_db']
        
        # Get all defined body parts
        body_parts_collection = db['body_parts']
        defined_parts = list(body_parts_collection.find({}, {'key': 1, 'label_en': 1, 'label_es': 1, '_id': 0}))
        defined_keys = {p.get('key') for p in defined_parts if p.get('key')}
        
        print(f"Found {len(defined_keys)} defined body parts in 'body_parts' collection:")
        for p in defined_parts:
            print(f" - {p.get('key')} ({p.get('label_es')})")
            
        # Get all body parts used in exercises
        exercises_collection = db['exercises']
        used_parts = exercises_collection.distinct('body_part')
        
        print(f"\nFound {len(used_parts)} distinct body parts used in 'exercises' collection:")
        for p in used_parts:
            print(f" - {p}")
            
        # Compare
        missing = [p for p in used_parts if p not in defined_keys and p is not None]
        
        print("\n--- Verification Results ---")
        if not missing:
            print("SUCCESS: All body parts used in 'exercises' are defined in 'body_parts'.")
        else:
            print("WARNING: The following body parts are used in 'exercises' but NOT defined in 'body_parts':")
            for m in missing:
                print(f" - {m}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_body_parts()
