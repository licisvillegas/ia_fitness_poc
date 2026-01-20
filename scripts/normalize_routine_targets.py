import sys
from pathlib import Path
from flask import Flask

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import Config
import extensions
from utils.routine_utils import normalize_routine_items


def main():
    app = Flask(__name__)
    app.config.from_object(Config)
    db = extensions.init_db(app)
    if db is None:
        print("DB not ready")
        return 1

    updated = 0
    total = 0
    cursor = db.routines.find({}, {"items": 1})
    for doc in cursor:
        total += 1
        items = doc.get("items", [])
        if not isinstance(items, list):
            continue
        original = repr(items)
        normalize_routine_items(items)
        if repr(items) != original:
            db.routines.update_one({"_id": doc["_id"]}, {"$set": {"items": items}})
            updated += 1

    print(f"Routines processed: {total}")
    print(f"Routines updated: {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
