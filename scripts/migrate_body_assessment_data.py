import os
import sys
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Mappings
GOAL_MAP = {
    "definicion": "fat_loss",
    "volumen": "muscle_gain",
    "mantenimiento": "maintenance",
    # English keys stay same
    "fat_loss": "fat_loss",
    "muscle_gain": "muscle_gain",
    "maintenance": "maintenance",
    "strength": "strength"
}

ACTIVITY_MAP = {
    "sedentary": "sedentary",
    "light": "lightly_active",
    "moderate": "moderately_active",
    "strong": "very_active",
    "very_strong": "extra_active",
    "extreme": "extra_active", # Just in case
    # English keys stay same
    "lightly_active": "lightly_active",
    "moderately_active": "moderately_active",
    "very_active": "very_active",
    "extra_active": "extra_active"
}

def migrate():
    # Connect
    uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/ia_fitness_db")
    print(f"Connecting to {uri}...")
    client = MongoClient(uri)
    db = client.get_database() # Uses db from URI usually, or default
    if db.name == 'test': # fallback if URI has no DB
        db = client.ia_fitness_db
    
    print(f"Using database: {db.name}")

    assessments = db.body_assessments.find({})
    count = 0
    updated = 0

    for doc in assessments:
        count += 1
        updates = {}
        unsets = {}
        
        # 1. Input Goal
        input_data = doc.get("input", {})
        old_goal = input_data.get("goal")
        if old_goal and old_goal in GOAL_MAP:
            new_goal = GOAL_MAP[old_goal]
            if new_goal != old_goal:
                updates["input.goal"] = new_goal
        
        # 2. Input Activity
        old_activity = input_data.get("activity_level")
        if old_activity and old_activity in ACTIVITY_MAP:
            new_activity = ACTIVITY_MAP[old_activity]
            if new_activity != old_activity:
                updates["input.activity_level"] = new_activity

        # 3. Output Recommendations Focus
        output_data = doc.get("output", {})
        recs = output_data.get("recommendations", {})
        old_focus = recs.get("focus")
        if old_focus and old_focus in GOAL_MAP:
            new_focus = GOAL_MAP[old_focus]
            if new_focus != old_focus:
                updates["output.recommendations.focus"] = new_focus

        # 4. Energy Expenditure
        energy = output_data.get("energy_expenditure", {})
        
        # 4a. Selected Activity
        sel_activity = energy.get("selected_activity")
        # Handle case where selected_activity might be mapped
        if sel_activity and sel_activity in ACTIVITY_MAP:
            new_sel = ACTIVITY_MAP[sel_activity]
            if new_sel != sel_activity:
                updates["output.energy_expenditure.selected_activity"] = new_sel

        # 4b. TDEE Keys (Rename keys in the dict)
        old_tdee = energy.get("tdee")
        if isinstance(old_tdee, dict):
            new_tdee = {}
            changed_tdee = False
            for k, v in old_tdee.items():
                if k in ACTIVITY_MAP:
                    new_key = ACTIVITY_MAP[k]
                    new_tdee[new_key] = v
                    if new_key != k:
                        changed_tdee = True
                else:
                    new_tdee[k] = v
            
            if changed_tdee:
                updates["output.energy_expenditure.tdee"] = new_tdee

        if updates:
            print(f"Updating doc {doc['_id']} with: {updates.keys()}")
            update_op = {"$set": updates}
            if unsets:
                update_op["$unset"] = unsets
            db.body_assessments.update_one({"_id": doc["_id"]}, update_op)
            updated += 1

    print(f"Migration complete. Scanned {count} docs, Updated {updated} docs.")

if __name__ == "__main__":
    migrate()
