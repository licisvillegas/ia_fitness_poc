from flask import Blueprint, jsonify, request, g
from datetime import datetime, timezone
from bson import ObjectId
import extensions
from extensions import logger

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

@notifications_bp.before_request
def require_user():
    user_id = request.cookies.get("user_session")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    # Store in g for convenience within blueprint
    g.user_id = user_id

@notifications_bp.route('/pending', methods=['GET'])
def get_pending_notifications():
    """Returns a list of unread notifications for the current user."""
    try:
        user_id = g.user_id
        
        # Find unread notifications
        query = {
            "user_id": ObjectId(user_id),
            "read": False
        }
        
        # Sort by newest first
        if extensions.db is None:
             raise Exception("Database not initialized")
        cursor = extensions.db.notifications.find(query).sort("created_at", -1).limit(20)
        
        notifications = []
        for n in cursor:
            notifications.append({
                "id": str(n["_id"]),
                "title": n.get("title", "Notificación"),
                "message": n.get("message", ""),
                "type": n.get("type", "info"),
                "created_at": n.get("created_at", datetime.now()).isoformat(),
                "link": n.get("link", None)
            })
            
        return jsonify({
            "count": len(notifications),
            "notifications": notifications
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return jsonify({"error": "Internal Error"}), 500

@notifications_bp.route('/mark-read', methods=['POST'])
def mark_read():
    """Marks one or all notifications as read."""
    try:
        user_id = g.user_id
        data = request.json or {}
        
        if data.get("all"):
            # Mark all as read
            if extensions.db is None:
                 raise Exception("Database not initialized")
            result = extensions.db.notifications.update_many(
                {"user_id": ObjectId(user_id), "read": False},
                {"$set": {"read": True}}
            )
            return jsonify({"success": True, "modified": result.modified_count}), 200
            
        notification_id = data.get("notification_id")
        if notification_id:
            # Mark single as read
            if extensions.db is None:
                 raise Exception("Database not initialized")
            result = extensions.db.notifications.update_one(
                {"_id": ObjectId(notification_id), "user_id": ObjectId(user_id)},
                {"$set": {"read": True}}
            )
            return jsonify({"success": True, "modified": result.modified_count}), 200
            
        return jsonify({"error": "Missing notification_id or all flag"}), 400
        
    except Exception as e:
        logger.error(f"Error marking notifications as read: {e}")
        return jsonify({"error": "Internal Error"}), 500
