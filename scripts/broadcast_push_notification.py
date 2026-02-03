import sys
import os
import time

# 1. ROBUST ENV LOADING (Must be BEFORE imports)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))

print(f"DEBUG: Pre-loading .env from {env_path}")
try:
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if '=' in line:
                key, val = line.split('=', 1)
                # Remove quotes
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                os.environ[key] = val
except Exception as e:
    print(f"DEBUG: Manual .env read failed: {e}")

# Check critical keys
print(f"DEBUG: MONGO_URI present? {bool(os.environ.get('MONGO_URI'))}")
print(f"DEBUG: VAPID_PRIVATE_KEY present? {bool(os.environ.get('VAPID_PRIVATE_KEY'))}")

# 2. IMPORTS
from app import create_app
import extensions
# Import the sync sender helper. 
# We generally avoid importing routes in scripts due to circular deps, but let's try.
# If this fails, we replicate logic.
from routes.push import _send_push_notification_sync

def broadcast_push():
    app = create_app()
    
    # Force overrides 
    uri = os.environ.get('MONGO_URI')
    db_name = os.environ.get('MONGO_DB')
    
    if uri:
        app.config['MONGO_URI'] = uri
        app.config['MONGO_ENABLED'] = True
        if db_name: app.config['MONGO_DB'] = db_name
    
    with app.app_context():
        # Re-initialize DB 
        print("DEBUG: Re-initializing DB...")
        db = extensions.init_db(app)
        if db is None:
            print("Error: DB setup failed.")
            return

        # 3. GET SUBSCRIPTIONS
        # We want to send to ALL unique users, or all endpoints?
        # Typically one push per subscription (a user might have desktop + mobile).
        subscriptions = list(db.push_subscriptions.find({}))
        print(f"Found {len(subscriptions)} push subscriptions.")

        if not subscriptions:
            print("No subscriptions found.")
            return

        # 4. SEND
        title = "Más herramientas para tu meta"
        body = "Descubre las nuevas opciones de nutrición y calculadora de equivalencias."
        url = "/nutrition"
        
        sent_count = 0
        error_count = 0
        
        for sub in subscriptions:
            user_id = str(sub.get("user_id")) # user_id stored as ObjectId usually, but route handles string?
            # _send_push_notification_sync expects user_id to look up subscriptions?
            # NO. `_send_push_notification_sync` takes `user_id` and looks up subscriptions INSIDE itself.
            # This means if I call it with `user_id`, it will send to ALL subscriptions for that user.
            
            # So I should iterate UNIQUE users, not subscriptions.
            pass

        # Optimized approach: Get distinct user_ids
        user_ids = db.push_subscriptions.distinct("user_id")
        print(f"Found {len(user_ids)} unique users with subscriptions.")
        
        for uid in user_ids:
            try:
                # Convert ObjectId to string if needed, route usually handles it strict or not?
                # _send_push_notification_sync queries by: db.push_subscriptions.find({"user_id": user_id})
                # If DB has ObjectId, we must pass ObjectId or string depending on how it was stored.
                # In routes/push.py: subscribe() uses `_get_user_id()` which returns string from cookie.
                # But it calls `db.push_subscriptions.update_one({"user_id": user_id}...)`
                # So it stores STRINGS in `user_id` field if the cookie is string.
                # Let's check a sample or assume string.
                # `db.push_subscriptions.distinct("user_id")` will return exactly what is stored.
                
                _send_push_notification_sync(
                    user_id=uid, 
                    title=title, 
                    body=body, 
                    url=url,
                    context="broadcast",
                    meta={"type": "broadcast"}
                )
                sent_count += 1
                # Small delay to be nice to VAPID? Not strictly necessary for 20 users.
            except Exception as e:
                print(f"Error sending to {uid}: {e}")
                error_count += 1

        print(f"Broadcast complete. Processed {sent_count} users. Errors: {error_count}")

if __name__ == "__main__":
    broadcast_push()
