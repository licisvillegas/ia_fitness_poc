
import os
import sys
from pymongo import MongoClient
import certifi
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB", "fitness_app")

def seed_body_parts():
    if not MONGO_URI:
        print("❌ MONGO_URI not found in environment variables.")
        return

    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client[MONGO_DB]
        collection = db["body_parts"]

        initial_parts = [
            {"key": "Chest", "label_es": "Pecho", "label_en": "Chest"},
            {"key": "Back", "label_es": "Espalda", "label_en": "Back"},
            {"key": "Legs", "label_es": "Piernas", "label_en": "Legs"},
            {"key": "Shoulders", "label_es": "Hombros", "label_en": "Shoulders"},
            {"key": "Biceps", "label_es": "Bíceps", "label_en": "Biceps"},
            {"key": "Triceps", "label_es": "Tríceps", "label_en": "Triceps"},
            {"key": "Forearms", "label_es": "Antebrazos", "label_en": "Forearms"},
            {"key": "Core", "label_es": "Abdomen", "label_en": "Core"},
            {"key": "Full Body", "label_es": "Cuerpo Completo", "label_en": "Full Body"},
            {"key": "Cardio", "label_es": "Cardio", "label_en": "Cardio"}
        ]

        for part in initial_parts:
            # Upsert based on key
            collection.update_one(
                {"key": part["key"]},
                {"$set": part},
                upsert=True
            )
        
        print(f"✔  Body parts seeded successfully into '{MONGO_DB}.body_parts'.")

    except Exception as e:
        print(f"❌ Error seeding body parts: {e}")

if __name__ == "__main__":
    seed_body_parts()
