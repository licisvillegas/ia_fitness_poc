
import os
import certifi
from pymongo import MongoClient

# Hardcoded URI# Configuración
MONGO_URI = os.getenv("MONGO_URI")

# Mapping definition based on analysis
# Source (exercises.body_part) -> Target (body_parts.key)
MAPPING = {
    "Core": "Core",
    "Full Body": "Full Body",
    "Cardio": "Cardio",

    # English Keys (Already normalized)
    "Chest": "Chest",
    "Back": "Back",
    "Legs": "Legs",
    "Shoulders": "Shoulders",
    "Biceps": "Biceps",
    "Triceps": "Triceps",

    # Chest
    "pectorales": "Chest",
    "pecho y tríceps": "Chest",
    "core y pecho": "Chest", # Putting mainly under Chest based on user intent likely
    
    # Back
    "dorsales": "Back",
    "espalda baja": "Back",
    "espalda": "Back",

    # Legs
    "cuádriceps": "Legs",
    "isquiotibiales": "Legs",
    "glúteos": "Legs",
    "pantorrillas": "Legs",
    
    # Shoulders
    "deltoides": "Shoulders",
    "deltoides posteriores": "Shoulders",
    "hombros": "Shoulders",
    "deltoides laterales": "Shoulders",
    
    # Arms
    "tríceps": "Triceps",
    "bíceps": "Biceps",
    "antebrazos": "Forearms",
    
    # Core
    "abdominales": "Core",
    "oblicuos": "Core",
    "abdomen": "Core",
    
    # Cardio
    "cardio": "Cardio",
    "Conditioning": "Cardio",
    
    # Full Body
    "full body": "Full Body",
    "cuerpo completo": "Full Body",
    "Mobility": "Full Body",
    
    # Misc / Other
    # If not found, will be logged
}

def normalize_exercises():
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['ia_fitness_db']
        collection = db['exercises']
        
        print("Starting normalization...")
        
        # 1. Get all unique body_parts to verify coverage
        unique_parts = collection.distinct("body_part")
        print(f"Found {len(unique_parts)} unique body_part values.")
        
        updates_count = 0
        skipped_count = 0
        unknown_values = set()
        
        for part in unique_parts:
            if not part:
                continue
                
            clean_part = part.lower().strip()
            # Try exact match first
            target_key = MAPPING.get(part) or MAPPING.get(clean_part)
            
            # Simple fuzzy matching if not found
            if not target_key:
                if "pecho" in clean_part: target_key = "Chest"
                elif "espalda" in clean_part: target_key = "Back"
                elif "pierna" in clean_part or "glúteo" in clean_part: target_key = "Legs"
                elif "hombro" in clean_part or "deltoid" in clean_part: target_key = "Shoulders"
                elif "bíceps" in clean_part: target_key = "Biceps"
                elif "tríceps" in clean_part: target_key = "Triceps"
                elif "abd" in clean_part or "core" in clean_part: target_key = "Core"
                elif "cardio" in clean_part: target_key = "Cardio"
            
            if target_key:
                # Update all documents with this body_part
                result = collection.update_many(
                    {"body_part": part},
                    {"$set": {"body_part_key": target_key}}
                )
                print(f"Mapped '{part}' -> '{target_key}' ({result.modified_count} docs updated)")
                updates_count += result.modified_count
            else:
                print(f"WARNING: Could not map '{part}'")
                unknown_values.add(part)
                skipped_count += 1
                
        print("\n--- Summary ---")
        print(f"Total documents updated: {updates_count}")
        print(f"Unmapped types: {len(unknown_values)}")
        if unknown_values:
            print(f"Unmapped values: {unknown_values}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    normalize_exercises()
