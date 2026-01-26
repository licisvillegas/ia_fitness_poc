
import certifi
from pymongo import MongoClient
import os

# Hardcoded URI
MONGO_URI = os.getenv("MONGO_URI")

def list_muscles():
    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client['ia_fitness_db']
        collection = db['exercises']
        
        muscles = collection.distinct('primary_muscle')
        print(f"Total unique values: {len(muscles)}")
        for m in sorted(list(muscles)):
             print(f"'{m}'")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_muscles()
