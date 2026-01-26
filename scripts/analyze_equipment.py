
import os
import certifi
from pymongo import MongoClient

# Configuración
MONGO_URI = os.getenv("MONGO_URI")

# Expected equipment list based on frontend code
EXPECTED_EQUIPMENT = {
    "barbell", "dumbbell", "machine", "cable", "band", "bench", "bodyweight", "other"
}

def analyze_equipment():
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['ia_fitness_db']
        collection = db['exercises']
        
        print("Starting equipment analysis...")
        
        # 1. Get all documents
        exercises = list(collection.find({}, {"name": 1, "equipment": 1, "body_part": 1, "body_part_key": 1}))
        
        unknown_equipment_exercises = []
        body_part_mismatches = []
        
        all_equipment_found = set()
        
        for ex in exercises:
            name = ex.get("name")
            eq_list = ex.get("equipment")
            bp = ex.get("body_part")
            bp_key = ex.get("body_part_key")
            
            # Normalize list
            if isinstance(eq_list, str):
                eq_list = [eq_list]
            elif not eq_list:
                eq_list = []
                
            # Check equipment
            for eq in eq_list:
                eq_norm = str(eq).lower().strip()
                all_equipment_found.add(eq_norm)
                
                if eq_norm not in EXPECTED_EQUIPMENT:
                    unknown_equipment_exercises.append({
                        "id": str(ex.get("_id")),
                        "name": name,
                        "equipment": eq_norm
                    })

            # Check body part (integrity check)
            if not bp_key:
                 body_part_mismatches.append({
                        "id": str(ex.get("_id")),
                        "name": name,
                        "issue": "Missing body_part_key"
                 })
                 
        print(f"Total exercises checked: {len(exercises)}")
        
        print("\n--- Equipment Analysis ---")
        print(f"Unique equipment found: {all_equipment_found}")
        missing_from_expected = EXPECTED_EQUIPMENT - all_equipment_found
        print(f"Expected but unused: {missing_from_expected}")
        
        unknown_found = all_equipment_found - EXPECTED_EQUIPMENT
        if unknown_found:
             print(f"WARNING: Unknown equipment types found: {unknown_found}")
        
        if unknown_equipment_exercises:
            print(f"\nFound {len(unknown_equipment_exercises)} exercises with unknown equipment:")
            # Generate report file content
            report_lines = ["# Reporte de Ejercicios con Equipo Desconocido", ""]
            report_lines.append("| Ejercicio | Equipo Desconocido | ID |")
            report_lines.append("|---|---|---|")
            for item in unknown_equipment_exercises:
                 print(f" - {item['name']}: {item['equipment']}")
                 report_lines.append(f"| {item['name']} | {item['equipment']} | {item['id']} |")
            
            with open("unclassified_exercises.md", "w", encoding="utf-8") as f:
                f.write("\n".join(report_lines))
            print("\nReport generated: unclassified_exercises.md")
        else:
            print("\nAll exercises use valid equipment options.")

        if body_part_mismatches:
             print(f"\nWARNING: Found {len(body_part_mismatches)} exercises with issues:")
             for item in body_part_mismatches:
                 print(f" - {item['name']}: {item['issue']}")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_equipment()
