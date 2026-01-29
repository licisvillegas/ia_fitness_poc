import json
import threading
import uuid
import time
from datetime import datetime
from flask import Blueprint, request, jsonify
import extensions
from extensions import logger
from config import Config

try:
    from pywebpush import webpush, WebPushException
except Exception:  # pragma: no cover - optional dependency at runtime
    webpush = None
    WebPushException = Exception

# In-memory store for scheduled tasks (POC only - not persistent across restarts/workers)
SCHEDULED_TASKS = {}

push_bp = Blueprint("push", __name__, url_prefix="/api/push")


def _get_db():
    return extensions.db


def _get_user_id():
    return request.cookies.get("user_session")


def _get_subscription_payload(raw_data):
    if not isinstance(raw_data, dict):
        return None
    return raw_data.get("subscription") or raw_data


def _send_push_notification_sync(user_id, title, body, url):
    """
    Synchronous helper to send push notification.
    Expects to be called WITHIN an active application context.
    """
    print(f"--- [DEBUG] Executing Scheduled Push for {user_id} ---", flush=True)
    
    # Imports needed locally for this function's logic
    import tempfile
    import os
    import base64
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    try:
        db = extensions.db
        if db is None:
            print(f"--- [DEBUG] DB not ready for user {user_id} ---", flush=True)
            logger.warning(f"Scheduled Push Failed: DB not ready for user {user_id}")
            return
            
        payload = json.dumps({"title": title, "body": body, "url": url})
        
        # Fetch subscriptions
        subs = list(db.push_subscriptions.find({"user_id": user_id}))
        
        if not subs:
            print(f"--- [DEBUG] No subscriptions found for {user_id} ---", flush=True)
            logger.info(f"Scheduled Push: No subscriptions for {user_id}")
            return

        # Prepare VAPID Key in a secure temporary file
        # We switch to TraditionalOpenSSL (SEC1) format to avoid ASN.1 errors with py-vapid
        vapid_file_path = None
        try:
            key_str = Config.VAPID_PRIVATE_KEY
            if not key_str:
                logger.error("VAPID_PRIVATE_KEY not configured")
                return

            pem_bytes = None
            if "-----BEGIN" in key_str:
                 # Already PEM string, convert to bytes
                 pem_bytes = key_str.encode('utf-8') if isinstance(key_str, str) else key_str
            else:
                 # Convert base64url to PEM bytes
                 try:
                     key_str_padded = key_str + '=' * (-len(key_str) % 4)
                     private_value = int.from_bytes(base64.urlsafe_b64decode(key_str_padded), 'big')
                     curve = ec.SECP256R1()
                     private_key = ec.derive_private_key(private_value, curve)
                     
                     # Use TraditionalOpenSSL to minimize ASN.1 parsing issues
                     pem_bytes = private_key.private_bytes(
                         encoding=serialization.Encoding.PEM,
                         format=serialization.PrivateFormat.TraditionalOpenSSL,
                         encryption_algorithm=serialization.NoEncryption()
                     )
                 except Exception as conv_err:
                     print(f"--- [DEBUG] VAPID Conversion Error: {conv_err} ---", flush=True)
                     return

            # Write to temp file
            # delete=False because we need to close it before passing path to pywebpush on Windows
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pem') as tf:
                tf.write(pem_bytes)
                vapid_file_path = tf.name

            sent = 0
            rem = 0
            
            for sub in subs:
                sub_info = sub.get("subscription") or {
                    "endpoint": sub.get("endpoint"),
                    "keys": sub.get("keys") or {},
                }
                try:
                    webpush(
                        subscription_info=sub_info,
                        data=payload,
                        vapid_private_key=vapid_file_path,
                        vapid_claims={"sub": Config.VAPID_SUBJECT},
                    )
                    sent += 1
                except WebPushException as exc:
                    status_code = getattr(getattr(exc, "response", None), "status_code", None)
                    if status_code in (404, 410):
                        try:
                            # Prune invalid subscriptions
                            db.push_subscriptions.delete_one(
                                {"user_id": user_id, "endpoint": sub.get("endpoint")}
                            )
                            rem += 1
                        except Exception:
                            pass
                    logger.warning(f"Scheduled Push Error: {exc}")
                except Exception as exc:
                    logger.warning(f"Scheduled Push Generic Error: {exc}")
                    
            print(f"--- [DEBUG] Push Result: Sent {sent}, Removed {rem} ---", flush=True)
            logger.info(f"Scheduled Push Executed: Sent {sent}, Removed {rem} for user {user_id}")

        except Exception as conv_err:
             print(f"--- [DEBUG] VAPID Key Error: {conv_err} ---", flush=True)
             logger.error(f"VAPID Key Error: {conv_err}")
             return

        finally:
            # Clean up temp file
            if vapid_file_path and os.path.exists(vapid_file_path):
                try:
                    os.unlink(vapid_file_path)
                except Exception:
                    pass
        
    except Exception as e:
        print(f"--- [DEBUG] Push Critical Error: {e} ---", flush=True)
        logger.error(f"Scheduled Push Critical Error: {e}")

# Removed helper _get_vapid_private_key as it is now integrated safely above

    
# In _send_push_notification_sync
# We need to monkeypatch or call it carefully
# Actually, I will just rewrite the loop part in the function above via replace



@push_bp.get("/vapid-public-key")
def get_vapid_public_key():
    if not Config.VAPID_PUBLIC_KEY:
        return jsonify({"error": "VAPID public key not configured"}), 503
    return jsonify({"publicKey": Config.VAPID_PUBLIC_KEY}), 200


@push_bp.post("/subscribe")
def subscribe():
    user_id = _get_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = _get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503

    data = request.get_json(silent=True) or {}
    subscription = _get_subscription_payload(data)
    if not subscription:
        return jsonify({"error": "Missing subscription"}), 400

    endpoint = (subscription.get("endpoint") or "").strip()
    keys = subscription.get("keys") or {}
    p256dh = (keys.get("p256dh") or "").strip()
    auth = (keys.get("auth") or "").strip()

    if not endpoint or not p256dh or not auth:
        return jsonify({"error": "Invalid subscription data"}), 400

    now = datetime.utcnow()
    doc = {
        "user_id": user_id,
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
        "subscription": subscription,
        "updated_at": now,
    }

    db.push_subscriptions.update_one(
        {"user_id": user_id, "endpoint": endpoint},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    print(f"--- [DEBUG] Subscribed user {user_id} ---", flush=True)
    return jsonify({"success": True}), 200


@push_bp.post("/unsubscribe")
def unsubscribe():
    user_id = _get_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = _get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503

    data = request.get_json(silent=True) or {}
    subscription = _get_subscription_payload(data)
    endpoint = ""
    if subscription:
        endpoint = (subscription.get("endpoint") or "").strip()
    if not endpoint:
        endpoint = (data.get("endpoint") or "").strip()
    if not endpoint:
        return jsonify({"error": "Missing endpoint"}), 400

    db.push_subscriptions.delete_one({"user_id": user_id, "endpoint": endpoint})
    return jsonify({"success": True}), 200


@push_bp.post("/send")
def send_push():
    user_id = _get_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if webpush is None:
        return jsonify({"error": "pywebpush not installed"}), 503

    if not Config.VAPID_PUBLIC_KEY or not Config.VAPID_PRIVATE_KEY:
        return jsonify({"error": "VAPID keys not configured"}), 503

    db = _get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "AI Fitness").strip()
    body = (data.get("body") or "").strip()
    url = (data.get("url") or "/").strip()

    print(f"--- [DEBUG] Instant Push Requested for {user_id}: {title} ---", flush=True)

    # Re-use _send_push_notification_sync since we are in context
    # But wait, _send_push_notification_sync assumes we are IN context.
    # However, its implementation was changed above to EXPECT context.
    # So we can just call it directly since THIS route is in context.
    _send_push_notification_sync(user_id, title, body, url)

    return jsonify({"success": True}), 200


@push_bp.post("/schedule")
def schedule_push():
    from flask import current_app # Import here to ensure availability
    
    user_id = _get_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if webpush is None:
        return jsonify({"error": "pywebpush not installed"}), 503

    data = request.get_json(silent=True) or {}
    delay = data.get("delay", 0)
    title = data.get("title", "Timer Finished")
    body = data.get("body", "Time is up!")
    url = data.get("url", "/")
    
    # Validation
    try:
        delay = float(delay)
    except ValueError:
        return jsonify({"error": "Invalid delay"}), 400
        
    if delay <= 0:
        return jsonify({"error": "Delay must be positive"}), 400

    # Create task ID
    task_id = str(uuid.uuid4())
    
    # Capture the real app object to pass to the thread
    # This prevents import errors or context issues in the thread
    app_obj = current_app._get_current_object()

    def task_wrapper():
        # Remove self from tasks
        SCHEDULED_TASKS.pop(task_id, None)
        # Push App Context
        with app_obj.app_context():
            _send_push_notification_sync(user_id, title, body, url)

    # Schedule timer
    # Note: threading.Timer runs in a separate thread.
    print(f"--- [DEBUG] Scheduling Push ID {task_id} in {delay}s for {user_id} ---", flush=True)
    timer = threading.Timer(delay, task_wrapper)
    SCHEDULED_TASKS[task_id] = timer
    timer.start()
    
    logger.info(f"Scheduled push {task_id} for user {user_id} in {delay}s")
    
    return jsonify({"success": True, "task_id": task_id}), 200


@push_bp.post("/cancel-schedule")
def cancel_scheduled_push():
    user_id = _get_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json(silent=True) or {}
    task_id = data.get("task_id")
    
    if not task_id:
        return jsonify({"error": "Missing task_id"}), 400
        
    timer = SCHEDULED_TASKS.pop(task_id, None)
    if timer:
        timer.cancel()
        logger.info(f"Cancelled push task {task_id} for user {user_id}")
        return jsonify({"success": True}), 200
    else:
        # It might have already executed or doesn't exist
        return jsonify({"error": "Task not found or already executed"}), 404


@push_bp.post("/client-log")
def client_log():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "No message")
    level = data.get("level", "INFO")
    user_id = _get_user_id() or "Anonymous"
    
    print(f"--- [CLIENT LOG] [{user_id}] {level}: {message} ---", flush=True)
    return jsonify({"success": True}), 200
