from datetime import datetime, timedelta
import re
from bson import ObjectId

from services.base_service import BaseService
from ai_agents.routine_agent import RoutineAgent
from ai_agents.routine_agent_mongo import MongoRoutineAgent
from utils.db_helpers import log_agent_execution
from utils.helpers import normalize_string_list, normalize_equipment_list, normalize_bool, normalize_body_part
import extensions

class RoutineService(BaseService):
    def generate_routine_sync(self, data):
        """Generación síncrona usando RoutineAgent (Legacy)."""
        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency = data.get("frequency", "4 días")
        equipment = data.get("equipment", "Gimnasio completo")

        agent = RoutineAgent()
        log_agent_execution("start", "RoutineAgent", agent, data, {"endpoint": "RoutineService.generate_routine_sync"})
        result = agent.run(level, goal, frequency, equipment)
        log_agent_execution("end", "RoutineAgent", agent, data, {"endpoint": "RoutineService.generate_routine_sync"})
        return result

    def generate_routine_mongo_sync(self, data):
        """Generación síncrona usando MongoRoutineAgent."""
        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency_raw = data.get("frequency", 4)
        equipment = data.get("equipment", "")
        body_parts = data.get("body_parts")
        include_cardio = bool(data.get("include_cardio", False))

        frequency = self._parse_frequency(frequency_raw)
        
        if body_parts is not None and isinstance(body_parts, list):
            body_parts = [str(p).strip() for p in body_parts if str(p).strip()]

        agent = MongoRoutineAgent(self.db)
        result = agent.run(
            level=level,
            goal=goal,
            frequency=frequency,
            equipment=equipment,
            body_parts=body_parts,
            include_cardio=include_cardio,
        )
        return result

    def start_async_generation(self, data):
        """Inicia tarea de Celery para generación asíncrona.
        Si Celery no está disponible, ejecuta de forma síncrona como fallback.
        """
        try:
            from celery_app.tasks.ai_tasks import generate_routine_async
        except (ImportError, ModuleNotFoundError):
            self.logger.warning("Celery no disponible, ejecutando generación síncrona")
            result = self.generate_routine_mongo_sync(data)
            return {"sync": True, "result": result}

        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency_raw = data.get("frequency", 4)
        equipment = data.get("equipment", "")
        body_parts = data.get("body_parts")
        include_cardio = bool(data.get("include_cardio", False))

        frequency = self._parse_frequency(frequency_raw)
            
        if body_parts is not None and isinstance(body_parts, list):
            body_parts = [str(p).strip() for p in body_parts if str(p).strip()]

        task = generate_routine_async.delay(
            level=level,
            goal=goal,
            frequency=frequency,
            equipment=equipment,
            body_parts=body_parts,
            include_cardio=include_cardio
        )
        return task.id

    def save_routine(self, data, collection="ai_routines"):
        """Guarda una rutina en la colección especificada."""
        if not data:
            return None, "No hay datos para guardar", 400

        # Validaciones de estructura si es ai_routines (formato avanzado)
        if collection == "ai_routines":
            ok, err = self._validate_routine_structure(data)
            if not ok:
                return None, err, 400

        data["created_at"] = datetime.utcnow()
        result = self.db[collection].insert_one(data)
        return str(result.inserted_id), None, 200

    def check_exercises(self, exercise_names):
        """Verifica existencia de ejercicios en el catálogo."""
        results = []
        for name in exercise_names:
            clean_name = name.strip()
            escaped_name = re.escape(clean_name)
            ex = self.db.exercises.find_one({
                "$or": [
                    {"name": {"$regex": rf"^\s*{escaped_name}\s*$", "$options": "i"}},
                    {"alternative_names": {"$regex": rf"^\s*{escaped_name}\s*$", "$options": "i"}},
                ]
            })
            results.append({
                "name": name,
                "exists": bool(ex),
                "exercise_id": str(ex["_id"]) if ex else None
            })
        return results

    def add_exercises_batch(self, exercises_to_add):
        """Agrega un lote de ejercicios al catálogo global."""
        added_count = 0
        for item in exercises_to_add:
            name = item.get("name") if isinstance(item, dict) else item
            if not name: continue
            
            clean_name = name.strip()
            escaped_name = re.escape(clean_name)
            ex = self.db.exercises.find_one({"name": {"$regex": rf"^\s*{escaped_name}\s*$", "$options": "i"}})
            
            if not ex:
                if isinstance(item, dict):
                    new_ex = self._build_exercise_doc(item, name)
                else:
                    new_ex = self._build_exercise_doc({}, name)
                    
                self.db.exercises.insert_one(new_ex)
                added_count += 1
        return added_count

    def _parse_frequency(self, freq_raw):
        if isinstance(freq_raw, str):
            digits = "".join(ch for ch in freq_raw if ch.isdigit())
            return int(digits) if digits else 4
        return int(freq_raw) if freq_raw is not None else 4

    def _validate_routine_structure(self, data):
        items = data.get("items", [])
        if not isinstance(items, list) or not items:
            return False, "La rutina no contiene items"
            
        # ... (Lógica de validación compleja del route copiada aquí)
        exercise_count = 0
        for item in items:
            if not isinstance(item, dict): return False, "Items invalidos"
            item_type = item.get("item_type")
            if item_type == "exercise":
                exercise_count += 1
                if not item.get("exercise_id"): return False, "Ejercicio sin exercise_id"
                
                # Rango rest_seconds
                rs = item.get("rest_seconds")
                if rs is not None:
                    try:
                        if int(rs) < 0 or int(rs) > 600: return False, f"rest_seconds {rs} fuera de rango"
                    except: return False, "rest_seconds invalido"
        
        if exercise_count == 0:
            return False, "La rutina no contiene ejercicios"
            
        return True, None

    def _build_exercise_doc(self, item, name):
        alternative_names = normalize_string_list(item.get("alternative_names") or item.get("alternative names"))
        equipment_list = normalize_equipment_list(item.get("equipment"))
        body_part = normalize_body_part(item.get("body_part", "Other"), self.db)
        
        if not equipment_list: equipment_list = ["dumbbell"]

        return {
            "name": name,
            "body_part": body_part,
            "type": "weight",
            "equipment": equipment_list,
            "description": item.get("description") if item.get("description") else "Agregado automaticamente desde IA Generator",
            "video_url": "",
            "substitutes": [],
            "is_custom": False,
            "alternative_names": alternative_names,
            "pattern": str(item.get("pattern") or "").strip(),
            "plane": str(item.get("plane") or "").strip(),
            "unilateral": normalize_bool(item.get("unilateral"), default=False),
            "primary_muscle": str(item.get("primary_muscle") or "").strip(),
            "level": str(item.get("level") or "").strip(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

    def list_routines(self, collection="ai_routines", limit=50):
        """Lista rutinas básicas de una colección."""
        cursor = self.db[collection].find({}, {
            "routineName": 1, 
            "level": 1, 
            "goal": 1, 
            "created_at": 1
        }).sort("created_at", -1).limit(limit)
        
        routines = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            routines.append(doc)
        return routines

    def get_routine_by_id(self, routine_id, collection="ai_routines"):
        """Busca una rutina por ID."""
        if not ObjectId.is_valid(routine_id):
            return None
            
        doc = self.db[collection].find_one({"_id": ObjectId(routine_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    def delete_routine(self, routine_id, collection="ai_routines"):
        """Elimina una rutina y sus asignaciones relacionadas."""
        if not ObjectId.is_valid(routine_id):
            return False
            
        # Eliminar rutina
        self.db[collection].delete_one({"_id": ObjectId(routine_id)})
        # Eliminar asignaciones vinculadas
        self.db.routine_assignments.delete_many({"routine_id": routine_id})
        return True

    def assign_routine(self, user_id, routine_id, valid_days=30):
        """Asigna una rutina a un usuario."""
        now = datetime.utcnow()
        expires_at = now + timedelta(days=valid_days) if valid_days else None
        
        assignment = {
            "user_id": user_id,
            "routine_id": routine_id,
            "assigned_at": now,
            "expires_at": expires_at,
            "valid_days": valid_days,
            "active": True
        }
        
        # Desactivar previas si existen? (Opcional, depende de lógica de negocio)
        # self.db.routine_assignments.update_many(
        #     {"user_id": user_id, "routine_id": routine_id, "active": True},
        #     {"$set": {"active": False, "replaced_at": now}}
        # )
        
        res = self.db.routine_assignments.insert_one(assignment)
        return str(res.inserted_id)

    def unassign_routine(self, user_id, routine_id):
        """Desactiva una asignación activa."""
        res = self.db.routine_assignments.update_many(
            {"user_id": user_id, "routine_id": routine_id, "active": True},
            {"$set": {"active": False, "unassigned_at": datetime.utcnow()}}
        )
        return res.modified_count > 0

    def list_assignments(self, user_id, active_only=True):
        """Lista asignaciones de rutinas para un usuario."""
        query = {"user_id": user_id}
        if active_only:
            now = datetime.utcnow()
            # Actualizar expiradas al vuelo
            self.db.routine_assignments.update_many(
                {"user_id": user_id, "active": True, "expires_at": {"$lte": now}},
                {"$set": {"active": False, "expired_at": now}}
            )
            query["active"] = True
            query["$or"] = [
                {"expires_at": {"$exists": False}},
                {"expires_at": None},
                {"expires_at": {"$gt": now}}
            ]
            
        cursor = self.db.routine_assignments.find(query).sort("assigned_at", -1)
        results = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("expires_at"), datetime):
                doc["expires_at"] = doc["expires_at"].isoformat()
            if isinstance(doc.get("assigned_at"), datetime):
                doc["assigned_at"] = doc["assigned_at"].isoformat()
            results.append(doc)
        return results

    def update_assignment_validity(self, user_id, routine_id, valid_days):
        """Actualiza la vigencia de una asignación."""
        now = datetime.utcnow()
        new_expires = now + timedelta(days=valid_days) if valid_days else None
        
        res = self.db.routine_assignments.update_many(
            {"user_id": user_id, "routine_id": routine_id, "active": True},
            {"$set": {
                "valid_days": valid_days,
                "expires_at": new_expires,
                "updated_at": now
            }}
        )
        return res.modified_count > 0
