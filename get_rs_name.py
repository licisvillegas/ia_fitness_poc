from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
mongo_uri = os.getenv("MONGO_URI")

# Try to connect to one shard directly to get rs name
shard = "ac-ggoxipx-shard-00-00.vxtfsny.mongodb.net:27017"
# We need the credentials.
# The URI in .env is srv, let's parse it manually or just use the one I saw.
user = "1smaelV"
passw = "fGLlKX8lKwT1SsAa"

direct_uri = f"mongodb://{user}:{passw}@{shard}/?ssl=true&authSource=admin"
client = MongoClient(direct_uri, serverSelectionTimeoutMS=5000)
try:
    status = client.admin.command('replSetGetStatus')
    print("RS Name:", status.get('set'))
except Exception as e:
    print("Error:", e)
