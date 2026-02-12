from datetime import datetime, timedelta
from bson import ObjectId
from services.base_service import BaseService
from utils.helpers import normalize_user_status
from utils.auth_helpers import ensure_user_status, USER_STATUS_DEFAULT
from extensions import logger

class UserService(BaseService):
    def get_user_by_id(self, user_id, fields=None):
        """Busca un usuario por user_id o _id."""
        if not user_id: return None
        
        query = {"user_id": user_id}
        if ObjectId.is_valid(user_id):
            query = {"$or": [{"user_id": user_id}, {"_id": ObjectId(user_id)}]}
            
        return self.db.users.find_one(query, fields)

    def get_user_status(self, user_id):
        """Obtiene el estado actual y vigencia del usuario."""
        status_doc = self.db.user_status.find_one({"user_id": user_id})
        if not status_doc:
            # Fallback a ensure_user_status si no existe doc
            status = ensure_user_status(user_id, default_status=USER_STATUS_DEFAULT)
            return {"status": status, "valid_until": None}
            
        return {
            "status": status_doc.get("status", "pending"),
            "valid_until": status_doc.get("valid_until"),
            "updated_at": status_doc.get("updated_at")
        }

    def update_status(self, user_id, status=None, validity_days=None, validity_date=None):
        """Actualiza el estado y vigencia de un usuario."""
        update_st = {}
        
        if status:
            norm_status = normalize_user_status(status)
            if norm_status:
                update_st["status"] = norm_status
                update_st["updated_at"] = datetime.utcnow()

        if validity_days is not None:
            try:
                days = int(validity_days)
                if days > 0:
                    update_st["valid_until"] = datetime.utcnow() + timedelta(days=days)
                    if not status: update_st["status"] = "active"
            except: pass
        elif validity_date is not None:
            if validity_date:
                try:
                    update_st["valid_until"] = datetime.strptime(validity_date, "%Y-%m-%d")
                except: pass
            else:
                update_st["valid_until"] = None

        if update_st:
            self.db.user_status.update_one(
                {"user_id": user_id},
                {"$set": update_st},
                upsert=True
            )
        return True

    def get_user_role(self, user_id):
        """Obtiene el rol del usuario."""
        role_doc = self.db.user_roles.find_one({"user_id": user_id})
        return role_doc.get("role", "user") if role_doc else "user"

    def update_role(self, user_id, new_role):
        """Actualiza el rol del usuario."""
        self.db.user_roles.update_one(
            {"user_id": user_id},
            {"$set": {"role": new_role}},
            upsert=True
        )
        return True

    def get_coach_list(self):
        """Obtiene lista de coaches/admins para filtros."""
        roles_cursor = self.db.user_roles.find({"role": {"$in": ["coach", "admin"]}})
        coach_ids = [r["user_id"] for r in roles_cursor]
        if not coach_ids: return []
        
        coaches = self.db.users.find(
            {"user_id": {"$in": coach_ids}},
            {"user_id": 1, "name": 1, "username": 1}
        ).sort("name", 1)
        return list(coaches)

    def list_users_paginated(self, page=1, limit=20, search="", filter_status=None, filter_coach_id=None, user_role="admin"):
        """Lista usuarios con paginación, búsqueda y filtros."""
        query = {}
        
        # Filtro por coach si el rol es coach o se especifica uno
        if user_role == "coach" or filter_coach_id:
            query["coach_id"] = filter_coach_id

        # Filtro por estado
        if filter_status:
            status_matches = self.db.user_status.find({"status": filter_status}, {"user_id": 1})
            status_user_ids = [s["user_id"] for s in status_matches]
            if not status_user_ids:
                return [], 0
            query["user_id"] = {"$in": status_user_ids}

        # Búsqueda textual
        if search:
            regex = {"$regex": search, "$options": "i"}
            search_or = [
                {"name": regex},
                {"email": regex},
                {"username": regex},
                {"user_id": search}
            ]
            if "user_id" in query:
                # Intersect user_id from status filter with search user_id if needed?
                # Actually, status filter uses $in: status_user_ids.
                # Búsqueda $or covers user_id too.
                # We can just AND them.
                query = {"$and": [query, {"$or": search_or}]}
            else:
                query["$or"] = search_or

        total = self.db.users.count_documents(query)
        cursor = self.db.users.find(query, {
            "user_id": 1, "name": 1, "email": 1, "username": 1, "created_at": 1, 
            "coach_id": 1, "own_referral_code": 1
        }).sort("created_at", -1).skip((page - 1) * limit).limit(limit)

        users = []
        for u in cursor:
            uid = str(u.get("user_id") or u["_id"])
            
            # Mixin con status
            status_info = self.get_user_status(uid)
            u["status"] = status_info["status"]
            u["valid_until"] = status_info["valid_until"]
            
            # Mixin con role
            u["role"] = self.get_user_role(uid)
            
            u["_id"] = str(u["_id"])
            users.append(u)
            
        # Resolver coach_id → coach_name en batch
        coach_ids = list({u["coach_id"] for u in users if u.get("coach_id")})
        if coach_ids:
            coach_docs = self.db.users.find(
                {"user_id": {"$in": coach_ids}},
                {"user_id": 1, "name": 1, "username": 1}
            )
            coach_map = {}
            for c in coach_docs:
                coach_map[c["user_id"]] = c.get("name") or c.get("username") or c["user_id"]
            for u in users:
                if u.get("coach_id") and u["coach_id"] in coach_map:
                    u["coach_name"] = coach_map[u["coach_id"]]
            
        return users, total

    def search_users(self, term, limit=5):
        """Busca usuarios por nombre, email, username o user_id para autocompletado."""
        if not term:
            return []
        regex = {"$regex": term, "$options": "i"}
        query = {"$or": [
            {"name": regex},
            {"email": regex},
            {"username": regex},
            {"user_id": term}
        ]}
        cursor = self.db.users.find(query, {
            "user_id": 1, "name": 1, "email": 1, "username": 1, "_id": 0
        }).limit(limit)
        return list(cursor)

    def create_user(self, user_data, role="user", status="active", validity_days=None):
        """Crea un usuario completo con rol y estado."""
        # Generar hash si hay password
        password = user_data.get("password")
        if password:
            from werkzeug.security import generate_password_hash
            user_data["password_hash"] = generate_password_hash(password)
            del user_data["password"]

        user_data["created_at"] = datetime.utcnow()
        user_data["username_lower"] = user_data.get("username", "").lower()

        # Insertar en users
        res = self.db.users.insert_one(user_data)
        user_id = user_data.get("user_id") or str(res.inserted_id)

        # Establecer rol
        self.update_role(user_id, role)

        # Establecer estado
        self.update_status(user_id, status=status, validity_days=validity_days)

        return user_id

    def update_user(self, user_id, data):
        """Actualiza información de usuario, rol y estado de forma centralizada."""
        update_fields = {}
        
        # Básicos
        for field in ["name", "email", "username", "coach_id", "own_referral_code"]:
            if field in data:
                update_fields[field] = data[field]
                if field == "username":
                    update_fields["username_lower"] = data[field].lower()

        # Password
        if "password" in data and data["password"]:
            from werkzeug.security import generate_password_hash
            update_fields["password_hash"] = generate_password_hash(data["password"])

        if update_fields:
            self.db.users.update_one({"user_id": user_id}, {"$set": update_fields})

        # Rol
        if "role" in data:
            self.update_role(user_id, data["role"])

        # Estado / Vigencia
        if any(k in data for k in ["status", "validity_days", "validity_date"]):
            self.update_status(
                user_id, 
                status=data.get("status"), 
                validity_days=data.get("validity_days"), 
                validity_date=data.get("validity_date")
            )
        
        return True

    def delete_user(self, user_id):
        """Eliminación en cascada centralizada de un usuario."""
        # Lista de colecciones a limpiar
        collections = [
            "users", "user_roles", "user_status", "user_profiles",
            "plans", "progress", "meal_plans", "ai_adjustments", "body_assessments"
        ]
        for coll in collections:
            self.db[coll].delete_many({"user_id": user_id})
        return True
