
import os
import certifi
from pymongo import MongoClient
import datetime
import uuid
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Configuration
MONGO_URI = os.getenv("MONGO_URI") 
MONGO_DB = os.getenv("MONGO_DB", "fitness_app")

if not MONGO_URI:
    print("❌ ERROR: MONGO_URI environment variable not set.")
    exit(1)

# Connect to DB
client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
db = client[MONGO_DB]
print(f"✅ Connected to {MONGO_DB}")

# ==========================================
# 1. EXERCISES LIST (Upsert Logic)
# ==========================================
exercises = [
    # LEG (Day 1)
    {"id": "sumo_squat", "name": "Sentadilla Sumo", "body_part": "quads", "equipment": "barbell"},
    {"id": "smith_squat", "name": "Sentadilla en Multipower (Smith)", "body_part": "quads", "equipment": "machine"},
    {"id": "leg_press", "name": "Prensa de Piernas", "body_part": "quads", "equipment": "machine"},
    {"id": "leg_press_close", "name": "Prensa de Piernas (Pies Juntos)", "body_part": "quads", "equipment": "machine"},
    {"id": "lying_leg_curl", "name": "Curl Femoral Tumbado", "body_part": "hamstrings", "equipment": "machine"},
    {"id": "bulgarian_squat", "name": "Sentadilla Búlgara", "body_part": "quads", "equipment": "dumbbell"}, 
    {"id": "hack_squat", "name": "Sentadilla Hack", "body_part": "quads", "equipment": "machine"},
    {"id": "leg_extension", "name": "Extensión de Cuádriceps", "body_part": "quads", "equipment": "machine"},
    {"id": "calf_raise_1leg", "name": "Elevación de Talón a 1 Pierna", "body_part": "calves", "equipment": "bodyweight"},
    {"id": "calf_press", "name": "Prensa de Pantorrilla", "body_part": "calves", "equipment": "machine"},
    
    # ARMS (Day 2)
    {"id": "lateral_raises", "name": "Elevaciones Laterales", "body_part": "shoulders", "equipment": "dumbbell"},
    {"id": "manual_tricep_ext", "name": "Copa con Polea (Tríceps)", "body_part": "triceps", "equipment": "cable"},
    {"id": "barbell_curl", "name": "Curl con Barra", "body_part": "biceps", "equipment": "barbell"},
    {"id": "shoulder_press_barbell", "name": "Press Militar con Barra", "body_part": "shoulders", "equipment": "barbell"},
    {"id": "french_press", "name": "Press Francés", "body_part": "triceps", "equipment": "barbell"},
    {"id": "hammer_curl", "name": "Curl Martillo", "body_part": "biceps", "equipment": "dumbbell"},
    {"id": "reverse_peck_fly", "name": "Peck Fly Invertido (Pájaros)", "body_part": "shoulders", "equipment": "machine"},
    {"id": "reverse_curl", "name": "Curl Invertido", "body_part": "forearms", "equipment": "barbell"},
    {"id": "california_press", "name": "Press California", "body_part": "triceps", "equipment": "barbell"},

    # LEG/MIX (Day 3)
    {"id": "1leg_femoral_curl", "name": "Curl Femoral a 1 Pierna", "body_part": "hamstrings", "equipment": "machine"},
    {"id": "seated_femoral_curl", "name": "Curl Femoral Sentado", "body_part": "hamstrings", "equipment": "machine"},
    {"id": "deadlift", "name": "Peso Muerto", "body_part": "hamstrings", "equipment": "barbell"},
    {"id": "abductor_machine", "name": "Abductores en Máquina", "body_part": "glutes", "equipment": "machine"},
    {"id": "adductor_machine", "name": "Aductores en Máquina", "body_part": "legs", "equipment": "machine"},

    # CHEST & BACK (Day 4)
    {"id": "incline_bench_press", "name": "Press Inclinado con Barra", "body_part": "chest", "equipment": "barbell"},
    {"id": "lat_pulldown", "name": "Jalón al Frente (Polea Alta)", "body_part": "back", "equipment": "cable"},
    {"id": "bench_press", "name": "Press de Banca Horizontal", "body_part": "chest", "equipment": "barbell"},
    {"id": "cable_fly", "name": "Cristos (Aperturas en Polea)", "body_part": "chest", "equipment": "cable"},
    {"id": "reverse_lat_pulldown", "name": "Jalón Invertido (Supino)", "body_part": "back", "equipment": "cable"},
    {"id": "barbell_row", "name": "Remo con Barra (Pronado)", "body_part": "back", "equipment": "barbell"},
    {"id": "dips", "name": "Fondos en Paralelas", "body_part": "triceps", "equipment": "bodyweight"},
    {"id": "pull_over", "name": "Pull Over", "body_part": "back", "equipment": "dumbbell"},

    # LEG 2 (Day 5)
    {"id": "hip_thrust", "name": "Hip Thrust", "body_part": "glutes", "equipment": "barbell"},
    {"id": "seated_calf_raise", "name": "Costurera (Sólio)", "body_part": "calves", "equipment": "machine"},

    # SHOULDER & ABS (Day 6)
    {"id": "face_pull", "name": "Face Pull (Jalón a la Cara)", "body_part": "shoulders", "equipment": "cable"},
    {"id": "behind_neck_press", "name": "Press Tras Nuca", "body_part": "shoulders", "equipment": "barbell"},
    {"id": "arnold_press", "name": "Press Arnold", "body_part": "shoulders", "equipment": "dumbbell"},
    {"id": "upright_row", "name": "Remo al Mentón (De Pie)", "body_part": "shoulders", "equipment": "barbell"},
    {"id": "incline_crunch", "name": "Crunch en Banco Inclinado", "body_part": "abs", "equipment": "bodyweight"},
    {"id": "incline_leg_raise", "name": "Elevación de Piernas en Banco Inclinado", "body_part": "abs", "equipment": "bodyweight"},
    {"id": "hanging_leg_raise", "name": "Elevación de Piernas Colgado", "body_part": "abs", "equipment": "bodyweight"},
    {"id": "hyperextensions", "name": "Hiperextensiones", "body_part": "back", "equipment": "bodyweight"},
]

print("--- Upserting Exercises ---")
for ex in exercises:
    ex_id = ex["id"]
    db.exercises.update_one(
        {"exercise_id": ex_id},
        {"$set": {
            "exercise_id": ex_id,
            "name": ex["name"],
            "exercise_name": ex["name"], # Compatibility
            "body_part": ex["body_part"],
            "equipment": ex["equipment"],
            "video_url": "" # Placeholder
        }},
        upsert=True
    )
    print(f"Upserted: {ex['name']}")


# ==========================================
# 2. ROUTINE STRUCTURE
# ==========================================

# Helper structures
def exercise_item(ex_id, sets=3, reps="10-12", note="", rest=60):
    return {
        "item_type": "exercise",
        "exercise_id": ex_id,
        "sets": sets,
        "reps": reps,
        "rest": rest,
        "note": note
    }

def group_item(name, items, note=""):
    return {
        "item_type": "group",
        "name": name,
        "note": note,
        "items": items
    }

routine_items = [
    # --- DAY 1 ---
    group_item("DÍA 1: PIERNA", [
        exercise_item("sumo_squat", 3, "8-10", "Drop Set a 2 pesos (Sin Alternar)", 90),
        
        # Giant Set
        group_item("Triserie: Prensa + Femoral", [
            exercise_item("leg_press", 3, "10", "Pies Adelantados"),
            exercise_item("leg_press_close", 3, "10", "Seguidas, Piernas Juntas"),
            exercise_item("lying_leg_curl", 3, "12-15", "Alternado")
        ], "Realizar seguidos"),

        exercise_item("bulgarian_squat", 3, "8+8", "Drop Set con Isometría: 8 reps, sostener 8s abajo, bajar 33% peso, 8 reps mas, sostener 8s", 90),
        
        group_item("Biserie: Hack + Extensión", [
            exercise_item("hack_squat", 3, "10-12", "Énfasis"),
            exercise_item("leg_extension", 3, "12-15", "Isometría de 2s en contracción")
        ]),

        group_item("Biserie: Pantorrilla", [
            exercise_item("calf_raise_1leg", 4, "15", "A 1 pierna"),
            exercise_item("calf_press", 4, "15-20", "Prensa")
        ])
    ]),

    # --- DAY 2 ---
    group_item("DÍA 2: BRAZO", [
        exercise_item("lateral_raises", 4, "15", "Elevaciones Laterales"),
        exercise_item("manual_tricep_ext", 4, "12-15", "Copa con Polea"),
        exercise_item("barbell_curl", 4, "10-12", "Con Barra"),
        exercise_item("shoulder_press_barbell", 3, "10", "Drop Set con Isometría (Serie Sencilla)"),
        exercise_item("french_press", 3, "10-12"),
        exercise_item("hammer_curl", 3, "12"),
        exercise_item("reverse_peck_fly", 3, "15"),
        exercise_item("reverse_curl", 3, "12-15"),
        exercise_item("california_press", 3, "10-12")
    ]),

    # --- DAY 3 ---
    group_item("DÍA 3: PIERNA COMPLETE", [
        exercise_item("1leg_femoral_curl", 3, "12"),
        exercise_item("leg_press", 3, "12"),
        exercise_item("seated_femoral_curl", 3, "12"),
        exercise_item("smith_squat", 3, "10"),
        exercise_item("deadlift", 3, "8-10"),
        exercise_item("abductor_machine", 3, "15"),
        exercise_item("adductor_machine", 3, "15")
    ]),

    # --- DAY 4 ---
    group_item("DÍA 4: PECHO Y ESPALDA", [
        exercise_item("incline_bench_press", 4, "8-10", "Drop Set con Isometría (Sin alternar)"),
        exercise_item("lat_pulldown", 4, "10-12", "Drop Set con Isometría (Sin alternar)"),
        
        group_item("Biserie: Press + Cristos", [
            exercise_item("bench_press", 3, "10"),
            exercise_item("cable_fly", 3, "12-15", "Cristos")
        ]),

        group_item("Biserie: Jalón Inverso + Remo", [
            exercise_item("reverse_lat_pulldown", 3, "10-12"),
            exercise_item("barbell_row", 3, "10-12", "Pronado")
        ]),

        group_item("Biserie: Fondos + Pull Over", [
            exercise_item("dips", 3, "Fallo"),
            exercise_item("pull_over", 3, "12-15")
        ]),
    ]),

    # --- DAY 5 ---
    group_item("DÍA 5: PIERNA (Énfasis Femoral)", [
        exercise_item("seated_femoral_curl", 4, "12", "Drop Set con Isometría (Sin alternar)"),
        exercise_item("bulgarian_squat", 3, "8+8", "Drop Set con Isometría: 8 reps, sostener 8s, bajar peso, 8 reps, sostener 8s"),
        exercise_item("hack_squat", 3, "10", "Sin alternar"),
        
        group_item("Biserie: Prensa + Hip Thrust", [
            exercise_item("leg_press", 3, "12"),
            exercise_item("hip_thrust", 3, "10-12", "Isometría 2s en contracción")
        ]),

        group_item("Biserie: Pantorrilla", [
            exercise_item("calf_press", 4, "15", "Drop Set a 3 pesos"),
            exercise_item("seated_calf_raise", 4, "15-20", "Costurera")
        ])
    ]),

    # --- DAY 6 ---
    group_item("DÍA 6: HOMBRO Y ABS", [
        group_item("Biserie: Cara + Tras Nuca", [
            exercise_item("face_pull", 3, "15"),
            exercise_item("behind_neck_press", 3, "10-12")
        ]),
        group_item("Biserie: Peck Fly + Arnold", [
            exercise_item("reverse_peck_fly", 3, "15", "Invertido"),
            exercise_item("arnold_press", 3, "10-12")
        ]),
        group_item("Biserie: Remo + Elevaciones", [
            exercise_item("upright_row", 3, "12", "Abierto y Cerrado"),
            exercise_item("lateral_raises", 3, "15")
        ]),
        group_item("Biserie: Abdomen 1", [
            exercise_item("incline_crunch", 3, "20", "Drop Set con Isometría"),
            exercise_item("incline_leg_raise", 3, "15")
        ]),
        group_item("Biserie: Abdomen 2", [
            exercise_item("hanging_leg_raise", 3, "12", "Lateral"),
            exercise_item("hyperextensions", 3, "15", "Con peso")
        ])
    ])
]

new_routine = {
    "name": "Rutina Hipertrofia 6 Días (Frecuencia Alta)",
    "description": "Rutina intensa de 6 días con técnicas avanzadas como Drop Sets e Isometrías.",
    "created_at": datetime.datetime.utcnow(),
    "items": routine_items,
    "user_id": "6931cf1adeba6b26a5fb524e" # Hardcoded for the current user session seen in logs
}

print("--- Inserting Routine ---")
result = db.routines.insert_one(new_routine)
print(f"✅ Routine Created! ID: {result.inserted_id}")
