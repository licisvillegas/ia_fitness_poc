
import os
from dotenv import load_dotenv
import certifi
from pymongo import MongoClient

load_dotenv()

# Configuración
MONGO_URI = os.getenv("MONGO_URI")

TAXONOMY_DATA = [
    # --- TREN SUPERIOR ---
    {
        "_id": "chest",
        "name": "Pecho",
        "name_en": "Chest",
        "section": {"id": "upper_body", "name": "Tren Superior"},
        "muscles": [
            {"id": "pectoral_major", "name": "Pectoral mayor"},
            {"id": "pectoral_minor", "name": "Pectoral menor"},
            {"id": "serratus", "name": "Serrato"}
        ]
    },
    {
        "_id": "back",
        "name": "Espalda",
        "name_en": "Back",
        "section": {"id": "upper_body", "name": "Tren Superior"},
        "muscles": [
            {"id": "latissimus_dorsi", "name": "Dorsal ancho"},
            {"id": "trapezius", "name": "Trapecio"},
            {"id": "rhomboids", "name": "Romboides"},
            {"id": "erector_spinae", "name": "Erectores espinales"},
            {"id": "teres_major", "name": "Redondo mayor"}
        ]
    },
    {
        "_id": "shoulders",
        "name": "Hombros",
        "name_en": "Shoulders",
        "section": {"id": "upper_body", "name": "Tren Superior"},
        "muscles": [
            {"id": "deltoid_anterior", "name": "Deltoides anterior"},
            {"id": "deltoid_lateral", "name": "Deltoides lateral"},
            {"id": "deltoid_posterior", "name": "Deltoides posterior"},
            {"id": "rotator_cuff", "name": "Manguito rotador"}
        ]
    },
    {
        "_id": "arms",
        "name": "Brazos",
        "name_en": "Arms",
        "section": {"id": "upper_body", "name": "Tren Superior"},
        "muscles": [
            {"id": "biceps", "name": "Bíceps"},
            {"id": "triceps", "name": "Tríceps"},
            {"id": "brachialis", "name": "Braquial"},
            {"id": "forearms", "name": "Antebrazos"}
        ]
    },
    
    # --- TREN INFERIOR ---
    {
        "_id": "legs",
        "name": "Piernas",
        "name_en": "Legs",
        "section": {"id": "lower_body", "name": "Tren Inferior"},
        "muscles": [
            {"id": "glutes", "name": "Glúteos"},
            {"id": "quadriceps", "name": "Cuádriceps"},
            {"id": "hamstrings", "name": "Isquiotibiales"},
            {"id": "calves", "name": "Gemelos"},
            {"id": "adductors", "name": "Aductores"},
            {"id": "abductors", "name": "Abductores"}
        ]
    },
    
    # --- CORE ---
    {
        "_id": "core",
        "name": "Zona Media",
        "name_en": "Core",
        "section": {"id": "core", "name": "Core"},
        "muscles": [
            {"id": "rectus_abdominis", "name": "Recto abdominal"},
            {"id": "obliques", "name": "Oblicuos"},
            {"id": "transverse_abdominis", "name": "Transverso abdominal"},
            {"id": "lumbar", "name": "Lumbar"}
        ]
    },
    
    # --- CARDIO / OTROS ---
    {
        "_id": "cardio",
        "name": "Cardio",
        "name_en": "Cardio",
        "section": {"id": "cardio", "name": "Cardio"},
        "muscles": [
            {"id": "heart", "name": "Corazón"}, # Symbolic
            {"id": "full_body_cardio", "name": "Cuerpo Completo (Cardio)"}
        ]
    },
     {
        "_id": "full_body",
        "name": "Cuerpo Completo",
        "name_en": "Full Body",
        "section": {"id": "full_body", "name": "Full Body"},
        "muscles": [
             {"id": "full_system", "name": "Sistema Completo"}
        ]
    }
]

def seed_taxonomy():
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['ia_fitness_db']
        collection = db['muscle_taxonomy']
        
        print("Seeding muscle_taxonomy...")
        
        # Clear existing to ensure clean state based on new definition
        collection.delete_many({})
        
        result = collection.insert_many(TAXONOMY_DATA)
        print(f"Inserted {len(result.inserted_ids)} taxonomy groups.")
        
        # Verify
        count = collection.count_documents({})
        print(f"Total documents in muscle_taxonomy: {count}")
        
    except Exception as e:
        print(f"Error seeding taxonomy: {e}")

if __name__ == "__main__":
    seed_taxonomy()
