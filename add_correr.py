from app import create_app
import extensions
from datetime import datetime

app = create_app()

with app.app_context():
    db = extensions.db
    if db is None:
        print("DB not connected in extension, trying init_db")
        extensions.init_db(app) # Should be handled by create_app but just in case
        db = extensions.db

    # Check if Correr exists
    existing = db.exercises.find_one({"name": "Correr"})
    if existing:
        print(f"Correr already exists with ID: {existing['_id']}")
        # Update substitutes just in case
        subs = [
            "69540d1da8ba1aef8c50fd17", # Intervalos
            "6965ac3cb0ce8cfe7dc8e5a9", # Eliptica
            "6965ac93b0ce8cfe7dc8e5aa", # Nadar
            "6965abecb0ce8cfe7dc8e5a8"  # Trotar
        ]
        db.exercises.update_one({"_id": existing["_id"]}, {"$set": {"substitutes": subs}})
        print("Updated substitutes for existing Correr.")
    else:
        print("Creating 'Correr'...")
        new_ex = {
            "name": "Correr",
            "exercise_name": "Correr", # Duplicate for safety as catalog checks both
            "body_part": "cardio",
            "exercise_type": "cardio", # API uses this or 'type'
            "type": "cardio",
            "equipment": "bodyweight", 
            "description": "Correr a ritmo constante.",
            "video_url": "",
            "substitutes": [
                "69540d1da8ba1aef8c50fd17", # Intervalos
                "6965ac3cb0ce8cfe7dc8e5a9", # Eliptica
                "6965ac93b0ce8cfe7dc8e5aa", # Nadar
                "6965abecb0ce8cfe7dc8e5a8"  # Trotar
            ],
            "is_custom": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        res = db.exercises.insert_one(new_ex)
        print(f"Created 'Correr' with ID: {res.inserted_id}")

    # Verify
    c = db.exercises.find_one({"name": "Correr"})
    print(f"Verify: {c['name']} - Subs: {len(c.get('substitutes', []))}")
