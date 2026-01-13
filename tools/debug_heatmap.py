from app import create_app
from extensions import db
from bson import ObjectId
from datetime import datetime
import json

app = create_app()

def get_db():
    return db.db

def debug_heatmap():
    with app.app_context():
        print(f"MONGO_URI: {app.config.get('MONGO_URI')}")
        print(f"MONGO_DB: {app.config.get('MONGO_DB')}")
        db = get_db()
        print(f"Collections: {db.list_collection_names()}")
        # Dump last 5 sessions to check format
        sessions = list(db.workout_sessions.find().sort("created_at", -1).limit(5))
        
        print(f"Found {len(sessions)} total sessions (showing last 5)")
        
        for s in sessions:
            print(f"User: {s.get('user_id')}, CreatedAt: {s.get('created_at')} (Type: {type(s.get('created_at'))})")
            
        if sessions:
            # Take the user from the most recent session
            uid = sessions[0].get('user_id')
            # Check distinct users
            print(f"Using user {uid} for test")

            tz = "America/Mexico_City" # Assuming this is the user's TZ
            print(f"\nTesting Aggregation for user {uid} with TZ {tz}")
            
            pipeline = [
                {"$match": {"user_id": uid}},
                {"$project": {
                    "dateStr": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": tz}},
                    "original": "$created_at"
                }},
                {"$group": {"_id": "$dateStr", "count": {"$sum": 1}, "samples": {"$push": "$original"}}}
            ]
            
            results = list(db.workout_sessions.aggregate(pipeline))
            print(json.dumps(results, default=str, indent=2))

if __name__ == "__main__":
    debug_heatmap()
