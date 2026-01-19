"""
Shared cache helper with optional Redis backend and in-memory fallback.
"""
import json
import os
import threading
from datetime import datetime

_lock = threading.Lock()
_redis_client = None
_memory_cache = {}

def _get_redis_client():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    with _lock:
        if _redis_client is not None:
            return _redis_client
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            _redis_client = None
            return None
        try:
            import redis
            _redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
        except Exception:
            _redis_client = None
        return _redis_client

def cache_get(key):
    client = _get_redis_client()
    if client:
        try:
            raw = client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception:
            pass

    entry = _memory_cache.get(key)
    if not entry:
        return None
    if entry["expires_at"] < datetime.utcnow().timestamp():
        _memory_cache.pop(key, None)
        return None
    return entry["value"]

def cache_set(key, value, ttl_seconds):
    client = _get_redis_client()
    if client:
        try:
            client.setex(key, int(ttl_seconds), json.dumps(value))
            return
        except Exception:
            pass
    _memory_cache[key] = {
        "value": value,
        "expires_at": datetime.utcnow().timestamp() + ttl_seconds,
    }

def cache_delete(key):
    client = _get_redis_client()
    if client:
        try:
            client.delete(key)
        except Exception:
            pass
    _memory_cache.pop(key, None)
