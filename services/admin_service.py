from datetime import datetime
from bson import ObjectId
from services.base_service import BaseService

class AdminService(BaseService):
    def broadcast_notifications(self, title, message, url="/", notif_type="info", send_in_app=False, send_push=False):
        result_summary = {
            "in_app_count": 0,
            "push_count": 0,
            "push_errors": 0
        }

        # 1. In-App Broadcast
        if send_in_app:
            users = list(self.db.users.find({}, {"_id": 1}))
            notifications = []
            now = datetime.utcnow()
            for u in users:
                notifications.append({
                    "user_id": u["_id"],
                    "title": title,
                    "message": message,
                    "type": notif_type,
                    "link": url,
                    "read": False,
                    "created_at": now
                })
            
            if notifications:
                res = self.db.notifications.insert_many(notifications)
                result_summary["in_app_count"] = len(res.inserted_ids)

        # 2. Web Push Broadcast
        if send_push:
            from routes.push import _send_push_notification_sync
            user_ids = self.db.push_subscriptions.distinct("user_id")
            count = 0
            errs = 0
            for uid in user_ids:
                try:
                    _send_push_notification_sync(
                        user_id=uid,
                        title=title,
                        body=message,
                        url=url,
                        context="admin_broadcast"
                    )
                    count += 1
                except:
                    errs += 1
            result_summary["push_count"] = count
            result_summary["push_errors"] = errs

        return result_summary

    def update_body_assessment(self, doc_id, data):
        if not ObjectId.is_valid(doc_id):
            return False, "ID invalido"
            
        oid = ObjectId(doc_id)
        setter = {"updated_at": datetime.utcnow()}
        
        if "input" in data and isinstance(data["input"], dict):
            setter["input"] = data["input"]
        if "output" in data and isinstance(data["output"], dict):
            setter["output"] = data["output"]
        if "backend" in data:
            setter["backend"] = data["backend"]
            
        # Parse meta dates if provided
        if "meta" in data and isinstance(data["meta"], dict):
            meta = data["meta"]
            for field in ["created_at", "updated_at"]:
                if field in meta:
                    val = meta[field]
                    if isinstance(val, str):
                        try:
                            setter[field] = datetime.fromisoformat(val.replace("Z", "+00:00"))
                        except: pass
        
        res = self.db.body_assessments.update_one({"_id": oid}, {"$set": setter})
        return res.matched_count > 0, None

    def delete_body_assessment(self, doc_id):
        if not ObjectId.is_valid(doc_id):
            return False
        res = self.db.body_assessments.delete_one({"_id": ObjectId(doc_id)})
        return res.deleted_count > 0
