from pymongo import MongoClient
import os
import sys
from dotenv import load_dotenv
import certifi

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("[ERROR] MONGO_URI not found")
    sys.exit(1)

# So we must create a dummy app.
from flask import Flask
from extensions import init_db

app = Flask(__name__)
app.config["MONGO_URI"] = MONGO_URI
app.config["MONGO_DB"] = os.getenv("MONGO_DB", "synapse_fit")
app.config["MONGO_ENABLED"] = True

print("Initializing DB...")
try:
    db = init_db(app)
except Exception as e:
    print(f"[ERROR] init_db exception: {e}")
    sys.exit(1)

if db is None:
    print("[ERROR] init_db returned None")
    sys.exit(1)

client = db.client

print(f"[INFO] Max Pool Size: {client.max_pool_size} (Expected 100)")
print(f"[INFO] Min Pool Size: {client.min_pool_size} (Expected 10)")
print(f"[INFO] Max Idle Time MS: {client.max_idle_time_ms} (Expected 45000)")

if client.max_pool_size == 100 and client.min_pool_size == 10 and client.max_idle_time_ms == 45000:
    print("[SUCCESS] Connection pooling configured correctly!")
else:
    print("[FAILURE] Settings mismatch!")
    sys.exit(1)
