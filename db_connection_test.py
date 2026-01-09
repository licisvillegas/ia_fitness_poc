from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

mongo_uri = os.getenv("MONGO_URI")
mongo_db  = os.getenv("MONGO_DB")

print("MONGO_URI:", mongo_uri)
print("MONGO_DB :", mongo_db)

with open("temp_config.txt", "w") as f:
    f.write(f"URI: {mongo_uri}\n")
    f.write(f"DB: {mongo_db}\n")

client = MongoClient(mongo_uri)
db = client[mongo_db]

print("Colecciones:", db.list_collection_names())

