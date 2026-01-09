from pymongo import MongoClient

user = "1smaelV"
passw = "fGLlKX8lKwT1SsAa"
hosts = "ac-ggoxipx-shard-00-00.vxtfsny.mongodb.net:27017,ac-ggoxipx-shard-00-01.vxtfsny.mongodb.net:27017,ac-ggoxipx-shard-00-02.vxtfsny.mongodb.net:27017"
rs = "atlas-635brp-shard-0"
db_name = "ia_fitness_db"

uri = f"mongodb://{user}:{passw}@{hosts}/{db_name}?ssl=true&replicaSet={rs}&authSource=admin&retryWrites=true&w=majority&appName=MongoFree"

print("Testing Non-SRV URI...")
client = MongoClient(uri, serverSelectionTimeoutMS=10000)
try:
    db = client[db_name]
    collections = db.list_collection_names()
    print("Success! Collections:", collections)
except Exception as e:
    print("Failed:", e)
