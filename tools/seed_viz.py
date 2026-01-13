
import os
from pymongo import MongoClient
from datetime import datetime
import uuid

from dotenv import load_dotenv
load_dotenv()

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
mongo_db_name = os.getenv("MONGO_DB", "ia_fitness_db")

client = MongoClient(mongo_uri)
db = client[mongo_db_name]

def seed_data():
    user_id = "test_user_visual"
    
    # Clean up
    db.body_assessments.delete_many({"user_id": user_id})
    
    # Insert Previous Assessment (1 month ago)
    db.body_assessments.insert_one({
        "user_id": user_id,
        "created_at": datetime(2025, 12, 12),
        "input": {
            "measurements": {
                "neck": 38.0,
                "chest": 100.0,
                "arm_relaxed": 34.0,
                "waist": 85.0,
                "hip": 100.0,
                "thigh": 58.0,
                "calf": 38.0,
                "weight_kg": 80.0
            }
        },
        "output": {
            "body_composition": {
                "body_fat_percent": 20.0,
                "muscle_mass_percent": 35.0
            }
        }
    })
    
    # Insert Latest Assessment (Now)
    db.body_assessments.insert_one({
        "user_id": user_id,
        "created_at": datetime(2026, 1, 12),
        "input": {
            "measurements": {
                "neck": 39.0, # +1
                "chest": 102.0, # +2
                "arm_relaxed": 35.0, # +1
                "waist": 83.0, # -2
                "hip": 99.0, # -1
                "thigh": 60.0, # +2
                "calf": 39.0, # +1
                "weight_kg": 79.0
            }
        },
        "output": {
            "body_composition": {
                "body_fat_percent": 18.0, # -2
                "muscle_mass_percent": 36.0 # +1
            }
        }
    })
    
    print(f"Seeded data for user_id: {user_id}")

if __name__ == "__main__":
    seed_data()
