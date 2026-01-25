"""
Agente generador de rutinas usando ejercicios en MongoDB.
Devuelve rutinas compatibles con la collection `routines`.
"""

import logging
import random
import time
from typing import Any, Dict, List, Optional


logger = logging.getLogger("ai_fitness")


DAY_LABELS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]


def _safe_int(value: Any, default: int = 3) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_goal(goal: str) -> str:
    g = (goal or "").strip().lower()
    if "fuerza" in g:
        return "strength"
    if "grasa" in g or "fat" in g:
        return "fat_loss"
    return "hypertrophy"


def _split_plan(frequency: int) -> List[Dict[str, Any]]:
    if frequency <= 2:
        return [
            {"label": "Full Body A", "parts": ["chest", "back", "legs", "shoulders", "arms", "core"]},
            {"label": "Full Body B", "parts": ["chest", "back", "legs", "shoulders", "arms", "core"]},
        ][:frequency]
    if frequency == 3:
        return [
            {"label": "Push", "parts": ["chest", "shoulders", "triceps"]},
            {"label": "Pull", "parts": ["back", "biceps"]},
            {"label": "Legs", "parts": ["legs", "glutes", "calves", "core"]},
        ]
    if frequency == 4:
        return [
            {"label": "Upper", "parts": ["chest", "back", "shoulders", "arms"]},
            {"label": "Lower", "parts": ["legs", "glutes", "calves", "core"]},
            {"label": "Upper", "parts": ["chest", "back", "shoulders", "arms"]},
            {"label": "Lower", "parts": ["legs", "glutes", "calves", "core"]},
        ]
    if frequency == 5:
        return [
            {"label": "Push", "parts": ["chest", "shoulders", "triceps"]},
            {"label": "Pull", "parts": ["back", "biceps"]},
            {"label": "Legs", "parts": ["legs", "glutes", "calves", "core"]},
            {"label": "Upper", "parts": ["chest", "back", "shoulders", "arms"]},
            {"label": "Lower", "parts": ["legs", "glutes", "calves", "core"]},
        ]
    return [
        {"label": "Push", "parts": ["chest", "shoulders", "triceps"]},
        {"label": "Pull", "parts": ["back", "biceps"]},
        {"label": "Legs", "parts": ["legs", "glutes", "calves", "core"]},
        {"label": "Push", "parts": ["chest", "shoulders", "triceps"]},
        {"label": "Pull", "parts": ["back", "biceps"]},
        {"label": "Legs", "parts": ["legs", "glutes", "calves", "core"]},
    ][:frequency]


def _goal_defaults(goal_key: str) -> Dict[str, Any]:
    if goal_key == "strength":
        return {"sets": 4, "reps": "4-6", "rest": 120}
    if goal_key == "fat_loss":
        return {"sets": 3, "reps": "12-15", "rest": 45}
    return {"sets": 3, "reps": "8-12", "rest": 75}


class MongoRoutineAgent:
    def __init__(self, db) -> None:
        self.db = db

    def run(
        self,
        level: str,
        goal: str,
        frequency: int,
        equipment: str = "",
        body_parts: Optional[List[str]] = None,
        include_cardio: bool = False,
    ) -> Dict[str, Any]:
        goal_key = _normalize_goal(goal)
        defaults = _goal_defaults(goal_key)
        defaults["goal_key"] = goal_key

        exercises = self._load_exercises(equipment, body_parts)
        if not exercises:
            return {
                "routine_name": "Rutina AI (Mongo)",
                "level": level,
                "goal": goal,
                "days": [],
                "error": "No hay ejercicios disponibles para los filtros seleccionados",
            }

        cardio_pool = [ex for ex in exercises if (ex.get("type") or "") == "cardio"]
        pool = [ex for ex in exercises if (ex.get("type") or "") != "cardio"]

        splits = _split_plan(frequency)
        days = []
        for idx, split in enumerate(splits):
            label = DAY_LABELS[idx % len(DAY_LABELS)]
            day_label = f"{label} - {split['label']}"
            routine = self._build_day_routine(
                day_label,
                split["parts"],
                pool,
                cardio_pool,
                level,
                defaults,
                include_cardio or goal_key == "fat_loss",
            )
            days.append({"day_index": idx + 1, "day_label": label, "routine": routine})

        return {
            "routine_name": "Rutina AI (Mongo)",
            "level": level,
            "goal": goal,
            "days": days,
        }

    def _load_exercises(self, equipment: str, body_parts: Optional[List[str]]) -> List[Dict[str, Any]]:
        if self.db is None:
            return []
        query: Dict[str, Any] = {}
        if equipment:
            query["equipment"] = equipment
        if body_parts:
            query["body_part"] = {"$in": body_parts}
        cursor = self.db.exercises.find(
            query,
            {
                "name": 1,
                "type": 1,
                "equipment": 1,
                "body_part": 1,
                "video_url": 1,
                "substitutes": 1,
            },
        )
        docs = list(cursor)
        for d in docs:
            d["_id"] = str(d["_id"])
        return docs

    def _build_day_routine(
        self,
        day_label: str,
        target_parts: List[str],
        exercises: List[Dict[str, Any]],
        cardio_pool: List[Dict[str, Any]],
        level: str,
        defaults: Dict[str, Any],
        include_cardio: bool,
    ) -> Dict[str, Any]:
        part_map: Dict[str, List[Dict[str, Any]]] = {}
        for ex in exercises:
            key = (ex.get("body_part") or "other").lower()
            part_map.setdefault(key, []).append(ex)

        picked = []
        for part in target_parts:
            options = part_map.get(part.lower(), [])
            if not options:
                continue
            random.shuffle(options)
            picked.append(options[0])

        remaining = [ex for ex in exercises if ex not in picked]
        random.shuffle(remaining)
        max_exercises = 8 if len(target_parts) >= 4 else 7
        while len(picked) < max_exercises and remaining:
            picked.append(remaining.pop(0))

        if include_cardio and cardio_pool:
            picked.append(random.choice(cardio_pool))

        # --- Dynamic Grouping Logic ---
        items = []
        now = int(time.time() * 1000)
        
        # Determine grouping parameters based on Level & Goal
        allow_trisets = False
        group_prob = 0.0 # Chance to start a group at any point
        
        if level == "Principiante":
            group_prob = 0.1
        elif level == "Intermedio":
            group_prob = 0.4
            if "fat_loss" in _normalize_goal(defaults.get("goal_key", "")): 
                 group_prob = 0.6
        elif level == "Avanzado":
            group_prob = 0.6
            if "fat_loss" in _normalize_goal(defaults.get("goal_key", "")):
                group_prob = 0.8
            allow_trisets = True

        idx = 0
        group_counter = 1
        routine_body_parts = []

        while idx < len(picked):
            # Check if we should start a group
            # Conditions:
            # 1. Random chance meets threshold
            # 2. We have at least 2 exercises left to group
            # 3. Current exercise is not cardio (usually keep cardio separate or at end)
            ex_curr = picked[idx]
            is_cardio = (ex_curr.get("type") or "") == "cardio"
            
            remaining_count = len(picked) - idx
            do_group = (not is_cardio) and (remaining_count >= 2) and (random.random() < group_prob)
            
            if do_group:
                # Decide group size: 2 (Biserie) or 3 (Triserie)
                group_size = 2
                if allow_trisets and remaining_count >= 3 and random.random() < 0.3:
                    group_size = 3
                
                group_type = "triserie" if group_size == 3 else "biserie"
                group_name = f"{group_type.capitalize()} {group_counter}"
                group_id = f"group_{now}_{group_counter}"
                
                # Add Group Header
                items.append({
                    "item_type": "group",
                    "_id": group_id,
                    "group_name": group_name,
                    "group_type": group_type,
                    "note": "",
                })

                # Add exercises in the group
                for i in range(group_size):
                    ex = picked[idx + i]
                    item = self._exercise_item(ex, defaults, group_id, now + len(items) + 1)
                    # For exercises inside a group, rest usually applies AFTER the whole group
                    # So internal rest is 0 or minimal, except for the last one if we want valid JSON validation
                    # But usually the 'rest' item handles the actual rest period.
                    item["rest_seconds"] = 0 
                    items.append(item)
                    
                    bp = ex.get("body_part")
                    if bp and bp not in routine_body_parts:
                        routine_body_parts.append(bp)

                # Add Rest after group
                items.append({
                    "item_type": "rest",
                    "_id": f"rest_{now + len(items) + 1}",
                    "rest_seconds": max(30, defaults["rest"] + 30), # Extract extra rest after superset
                    "note": "Descanso entre series",
                    "group_id": group_id,
                })
                
                idx += group_size
                group_counter += 1
            
            else:
                # Straight Set
                ex = picked[idx]
                item = self._exercise_item(ex, defaults, "", now + len(items) + 1)
                items.append(item)
                
                bp = ex.get("body_part")
                if bp and bp not in routine_body_parts:
                    routine_body_parts.append(bp)
                
                # Add Rest if it's not the very last item of the day
                # (Or always add it for consistency, user can ignore last rest)
                if idx < len(picked) - 1:
                    items.append({
                        "item_type": "rest",
                        "_id": f"rest_{now + len(items) + 1}",
                        "rest_seconds": defaults["rest"],
                        "note": "Descanso",
                        "group_id": "",
                    })
                
                idx += 1

        return {
            "name": f"Rutina {day_label}",
            "description": f"{defaults['reps']} | {level}",
            "routine_day": day_label.split(" - ")[0],
            "routine_body_parts": routine_body_parts,
            "items": items,
        }

    def _exercise_item(
        self, ex: Dict[str, Any], defaults: Dict[str, Any], group_id: str, uid: int
    ) -> Dict[str, Any]:
        ex_type = ex.get("type") or "weight"
        rest_seconds = defaults["rest"]
        target_sets = defaults["sets"]
        target_reps = defaults["reps"]
        target_time_seconds = 600
        if ex_type in ("time", "cardio"):
            target_sets = 1
            target_reps = "time"
            rest_seconds = 60
            target_time_seconds = 900
        return {
            "item_type": "exercise",
            "_id": f"temp_{uid}",
            "exercise_id": ex.get("_id"),
            "exercise_name": ex.get("name") or "Ejercicio",
            "exercise_type": ex_type,
            "equipment": ex.get("equipment") or "",
            "video_url": ex.get("video_url") or "",
            "body_part": ex.get("body_part") or "",
            "substitutes": ex.get("substitutes") or [],
            "target_sets": target_sets,
            "target_reps": target_reps,
            "rest_seconds": rest_seconds,
            "target_time_seconds": target_time_seconds,
            "group_id": group_id,
            "comment": "",
        }
