from datetime import datetime
from bson import ObjectId
from services.base_service import BaseService
from utils.helpers import compute_age, format_birth_date

class ProfileService(BaseService):
    def list_profiles_paginated(self, page=1, limit=20, search=""):
        query = {}
        if search:
            regex = {"$regex": search, "$options": "i"}
            # Search in users first
            matching_users = list(self.db.users.find({
                "$or": [
                    {"name": regex},
                    {"email": regex},
                    {"username": regex}
                ]
            }, {"user_id": 1}))
            
            user_ids = [u["user_id"] for u in matching_users if u.get("user_id")]
            query = {
                "$or": [
                    {"user_id": {"$in": user_ids}},
                    {"phone": regex}
                ]
            }

        total = self.db.user_profiles.count_documents(query)
        cursor = self.db.user_profiles.find(query).skip((page - 1) * limit).limit(limit)
        
        profiles = []
        for p in cursor:
            user_id = p.get("user_id")
            # Join user info
            u_doc = self.db.users.find_one({"user_id": user_id}, {"name": 1, "email": 1, "username": 1}) or {}
            
            # Join status
            status_doc = self.db.user_status.find_one({"user_id": user_id})
            status = status_doc.get("status", "active") if status_doc else "active"

            profiles.append({
                "user_id": user_id,
                "username": u_doc.get("username"),
                "name": u_doc.get("name"),
                "email": u_doc.get("email"),
                "sex": p.get("sex"),
                "birth_date": format_birth_date(p.get("birth_date")),
                "phone": p.get("phone"),
                "age": compute_age(p.get("birth_date")),
                "status": status
            })
            
        return profiles, total

    def get_full_profile(self, user_id):
        u = self.db.users.find_one({"user_id": user_id})
        if not u: return None
        
        p = self.db.user_profiles.find_one({"user_id": user_id}) or {}
        
        data = {
            "user_id": u.get("user_id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "username": u.get("username"),
            "sex": p.get("sex"),
            "birth_date": format_birth_date(p.get("birth_date")),
            "age": compute_age(p.get("birth_date")),
            "phone": p.get("phone"),
            "height": p.get("height"),
            "weight": p.get("weight"),
            "goals": p.get("goals"),
            "experience": p.get("experience"),
            "injuries": p.get("injuries"),
            "equipment": p.get("equipment"),
            "measurements": p.get("measurements", {})
        }

        # Latest body assessment mixin
        latest_assessment = self.db.body_assessments.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        if latest_assessment:
            inp = latest_assessment.get("input", {})
            if inp.get("measurements"):
                data["measurements"] = inp.get("measurements")
            if inp.get("activity_level"):
                data["activity_level"] = inp.get("activity_level")
            if inp.get("goal"):
                data["goals"] = inp.get("goal")

        return data
