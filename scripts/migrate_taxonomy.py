
import os
import certifi
from pymongo import MongoClient

# Configuración
MONGO_URI = os.getenv("MONGO_URI")

# Derived from analysis and user request
MUSCLE_MAPPING = {
    # Legs
    "cuádriceps": "quadriceps",
    "isquiotibiales": "hamstrings",
    "gastrocnemio": "calves",
    "sóleo": "calves",
    "tobillo": "calves",
    "aductores": "adductors",
    "glúteos": "glutes",
    "glúteo medio": "glutes",
    "cadera": "glutes", # Approximation

    # Chest
    "pectoral mayor": "pectoral_major",
    "pectorales": "pectoral_major", # Default to major

    # Back
    "dorsal ancho": "latissimus_dorsi",
    "columna torácica": "erector_spinae",
    
    # Shoulders
    "deltoide lateral": "deltoid_lateral",
    "deltoides": "deltoid_anterior", # Default
    "hombros": "deltoid_anterior", # Default

    # Arms
    "bíceps": "biceps",
    "tríceps": "triceps",
    "muñeca": "forearms",

    # Core
    "recto abdominal": "rectus_abdominis",

    # Cardio / Full Body
    "sistema cardiovascular": "heart",
    "movilidad general": "full_system"
}

def migrate_taxonomy():
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['ia_fitness_db']
        collection = db['exercises']
        taxonomy_col = db['muscle_taxonomy']
        
        # Load taxonomy for lookups
        taxonomy_docs = list(taxonomy_col.find({}))
        taxonomy_map = {} # muscle_id -> {section, group, muscle}
        
        for group in taxonomy_docs:
            for muscle in group.get("muscles", []):
                taxonomy_map[muscle["id"]] = {
                    "section_id": group["section"]["id"],
                    "group_id": group["_id"],
                    "muscle_id": muscle["id"]
                }
        
        print(f"Loaded {len(taxonomy_map)} taxonomy definitions.")
        
        updates_count = 0
        exercises = list(collection.find({}, {"primary_muscle": 1, "body_part_key": 1}))
        
        for ex in exercises:
            p_musc = str(ex.get("primary_muscle", "")).lower().strip()
            bp_key = ex.get("body_part_key")
            
            # 1. Try mapping the primary muscle
            target_ids = []
            if p_musc in MUSCLE_MAPPING:
                target_ids.append(MUSCLE_MAPPING[p_musc])
            
            # 2. Fallback to body_part_key if simple mapping fails or specific muscle not found
            if not target_ids and bp_key:
                # Map broad keys to a default muscle in that group
                if bp_key == "Chest": target_ids.append("pectoral_major")
                elif bp_key == "Back": target_ids.append("latissimus_dorsi")
                elif bp_key == "Legs": target_ids.append("quadriceps") # Generic leg
                elif bp_key == "Shoulders": target_ids.append("deltoid_anterior")
                elif bp_key == "Biceps": target_ids.append("biceps")
                elif bp_key == "Triceps": target_ids.append("triceps")
                elif bp_key == "Core": target_ids.append("rectus_abdominis")
                elif bp_key == "Cardio": target_ids.append("heart")
                elif bp_key == "Full Body": target_ids.append("full_system")
            
            if target_ids:
                muscle_id = target_ids[0]
                tax_info = taxonomy_map.get(muscle_id)
                
                if tax_info:
                    new_taxonomy = {
                        "section_id": tax_info["section_id"],
                        "group_id": tax_info["group_id"],
                        "muscle_id": muscle_id
                    }
                    
                    collection.update_one(
                        {"_id": ex["_id"]},
                        {"$set": {"taxonomy": new_taxonomy}}
                    )
                    updates_count += 1
                else:
                    print(f"Warning: Muscle ID '{muscle_id}' mapped but not found in taxonomy collection. (Ex: {ex.get('primary_muscle')})")
            else:
                 # Last resort: Try to find a group that matches the body_part_key to at least set section/group
                 if bp_key:
                     group_doc = next((g for g in taxonomy_docs if g["_id"] == bp_key.lower().replace(" ", "_")), None)
                     # Try loosely matching keys like "Shoulders" -> "shoulders"
                     if not group_doc:
                          group_doc = next((g for g in taxonomy_docs if g["name_en"].lower() == bp_key.lower()), None)

                     if group_doc:
                         # Default to the first muscle of the group just to have valid taxonomy structure
                         first_muscle = group_doc["muscles"][0]["id"]
                         new_taxonomy = {
                            "section_id": group_doc["section"]["id"],
                            "group_id": group_doc["_id"],
                            "muscle_id": first_muscle # Defaulting
                        }
                         collection.update_one(
                            {"_id": ex["_id"]},
                            {"$set": {"taxonomy": new_taxonomy}}
                         )
                         updates_count += 1

        print(f"Migration completed. Updated {updates_count}/{len(exercises)} exercises.")

    except Exception as e:
        print(f"Error migrating taxonomy: {e}")

if __name__ == "__main__":
    migrate_taxonomy()
