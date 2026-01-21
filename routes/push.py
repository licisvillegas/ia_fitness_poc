"""
Web Push endpoints (subscribe, unsubscribe, send test)
"""
import json
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

push_bp = Blueprint("push", __name__, url_prefix="/api/push")


def _get_db():
    return extensions.db


def _get_user_id():
    return request.cookies.get("user_session")


def _get_subscription_payload(raw_data):
    if not isinstance(raw_data, dict):
        return None
    return raw_data.get("subscription") or raw_data


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

    payload = json.dumps({"title": title, "body": body, "url": url})

    subs = list(db.push_subscriptions.find({"user_id": user_id}))
    if not subs:
        return jsonify({"error": "No subscriptions"}), 404

    sent = 0
    removed = 0

    for sub in subs:
        sub_info = sub.get("subscription") or {
            "endpoint": sub.get("endpoint"),
            "keys": sub.get("keys") or {},
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=Config.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": Config.VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                try:
                    db.push_subscriptions.delete_one(
                        {"user_id": user_id, "endpoint": sub.get("endpoint")}
                    )
                    removed += 1
                except Exception:
                    pass
            logger.warning(f"Web Push failed: {exc}")
        except Exception as exc:
            logger.warning(f"Web Push error: {exc}")

    return jsonify({"success": True, "sent": sent, "removed": removed}), 200
