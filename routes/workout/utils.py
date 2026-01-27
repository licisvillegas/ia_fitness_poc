from datetime import datetime, timedelta
from bson import ObjectId
import extensions
from extensions import logger
from utils.cache import cache_get, cache_set

def get_db():
    return extensions.db

def _get_body_parts_map(db):
    cache_key = "body_parts_map"
    cached = cache_get(cache_key)
    if cached:
        return cached

    parts = list(db.body_parts.find({}, {"key": 1, "label": 1, "label_es": 1}))
    mapping = {}
    for p in parts:
        key = (p.get("key") or "").strip()
        if not key:
            continue
        label = (p.get("label") or "").strip()
        label_es = (p.get("label_es") or "").strip()
        mapping[key.lower()] = key
        if label:
            mapping[label.lower()] = key
        if label_es:
            mapping[label_es.lower()] = key
    cache_set(cache_key, mapping, 300)
    return mapping

# --- SHARED HELPERS ---
def hydrate_routines_with_substitutes(routines, db):
    """
    Recursively finds all substitute/equivalent IDs in a list of routines (or items),
    fetches their details in bulk, and replaces the IDs with populated objects.
    Modifies the routines list in-place.
    """
    if not routines: return

    # Helper to collect IDs
    def collect_ids(items, ids_set):
        for item in items:
            if item.get("item_type") == "group" and "items" in item:
                collect_ids(item["items"], ids_set)
            else:
                subs = item.get("substitutes") or item.get("equivalents") or []
                for s in subs:
                    # Handle both strings and objects with ID
                    sid = None
                    if isinstance(s, dict):
                         sid = s.get("exercise_id") or s.get("_id") or s.get("id") or s.get("$oid")
                    elif isinstance(s, (str, ObjectId)):
                         sid = s
                    
                    if sid: ids_set.add(str(sid))

    # Helper to populate
    def populate(items, lookup_map):
        for item in items:
            if item.get("item_type") == "group" and "items" in item:
                populate(item["items"], lookup_map)
            else:
                subs = item.get("substitutes") or item.get("equivalents") or []
                if not subs: continue
                
                new_subs = []
                for s in subs:
                    sid = None
                    if isinstance(s, dict):
                         sid = s.get("exercise_id") or s.get("_id") or s.get("id") or s.get("$oid")
                    elif isinstance(s, (str, ObjectId)):
                         sid = str(s)
                    
                    if sid and str(sid) in lookup_map:
                        new_subs.append(lookup_map[str(sid)])
                    elif sid:
                         # Keep placeholder with error marker
                         new_subs.append({
                            "_id": str(sid), 
                            "name": f"No encontrado ({str(sid)[-6:]})", 
                            "body_part": "Desconocido", 
                            "equipment": "other",
                            "_is_missing": True
                        })
                
                if new_subs:
                    item["substitutes"] = new_subs

    # 1. Collect all Unique IDs across ALL routines
    all_ids = set()
    for r in routines:
        if "items" in r:
            collect_ids(r["items"], all_ids)
            
    # 2. Bulk Fetch
    if not all_ids: return

    found_map = {}
    query_ids = []
    for i in all_ids:
        if ObjectId.is_valid(i): query_ids.append(ObjectId(i))
        else: query_ids.append(i)
        
    cursor = db.exercises.find({"_id": {"$in": query_ids}})
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        found_map[doc["_id"]] = doc
        
    # 3. Apply changes
    for r in routines:
        if "items" in r:
            populate(r["items"], found_map)
