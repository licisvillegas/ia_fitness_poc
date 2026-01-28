from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from datetime import date, datetime, timedelta
from extensions import get_db, logger
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, conint, field_validator, ValidationError

onboarding_bp = Blueprint('onboarding', __name__, url_prefix='/onboarding')

# --- LOGIC & MODELS ---

class HealthComplianceManager:
    def __init__(self):
        # Preguntas oficiales del PAR-Q+ (2023)
        self.standard_questions = [
            (1, "¿Alguna vez su médico le ha dicho que tiene problemas cardíacos o hipertensión?"),
            (2, "¿Siente dolor en el pecho en reposo o al hacer actividad física?"),
            (3, "¿Pierde el equilibrio por mareos o ha perdido el conocimiento en los últimos 12 meses?"),
            (4, "¿Tiene alguna enfermedad crónica diagnosticada (aparte de corazón/presión)?"),
            (5, "¿Toma medicación para alguna enfermedad crónica?"),
            (6, "¿Tiene alguna lesión ósea/articular que podría empeorar con el ejercicio?"),
            (7, "¿Su médico le ha dicho que solo debe hacer ejercicio bajo supervisión?")
        ]

    def create_blank_par_q(self):
        """Genera el cuestionario vacío para enviar al Frontend"""
        return [{"q_id": i, "question_text": text, "answer_yes": False} 
                for i, text in self.standard_questions]

    def evaluate_submission(self, responses):
        """
        Evalúa las respuestas del usuario.
        Regla: Si hay al menos un 'SÍ' (True), el usuario NO es apto automáticamente sin revisión médica.
        """
        # responses es una lista de dicts: {q_id, answer}
        has_risk_factor = any(r.get("answer") is True for r in responses)
        
        # La validez es de 12 meses si todo está bien
        expiration_date = (date.today() + timedelta(days=365)).isoformat()
        
        return {
            "is_cleared": not has_risk_factor,
            "valid_until": expiration_date if not has_risk_factor else None,
            "status": "CLEARED" if not has_risk_factor else "PENDING_CLEARANCE"
        }

manager = HealthComplianceManager()

# --- NEW ONBOARDING MODELS (PYDANTIC) ---

class FitnessGoal(str, Enum):
    FAT_LOSS = "fat_loss"
    MUSCLE_GAIN = "muscle_gain"
    MAINTENANCE = "maintenance"
    STRENGTH = "strength"

class ExperienceLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class TrainingLocation(str, Enum):
    GYM = "gym"
    HOME_BASIC = "home_basic"
    HOME_BODYWEIGHT = "home_bodyweight"
    PARK = "park"

class SessionDuration(str, Enum):
    MIN_30 = "30_min"
    MIN_45 = "45_min"
    MIN_60 = "60_min"
    MIN_90 = "90_min"

class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHTLY_ACTIVE = "lightly_active"
    MODERATELY_ACTIVE = "moderately_active"
    VERY_ACTIVE = "very_active"

class InjuryType(str, Enum):
    NONE = "none"
    KNEE = "knee"
    LOWER_BACK = "lower_back"
    SHOULDER = "shoulder"
    WRIST = "wrist"
    OTHER = "other"

class OnboardingSubmission(BaseModel):
    """
    Modelo para validar los datos recibidos del formulario de onboarding.
    """

    # Paso 1: Objetivos
    fitness_goal: FitnessGoal
    experience_level: ExperienceLevel

    # Paso 2: Logística
    training_location: TrainingLocation
    # Validamos que los días sean entre 1 y 7
    days_available: int = Field(..., ge=1, le=7, description="Días disponibles para entrenar")
    session_duration: SessionDuration
    preferred_time: Optional[str] = None # Opcional

    # Paso 3: Salud y Estilo
    activity_level: ActivityLevel
    injuries: List[InjuryType] = Field(default_factory=lambda: [InjuryType.NONE])
    injuries_details: Optional[str] = None
    habits: Optional[List[str]] = []

    # Paso 4: Nutrición
    # Validamos entre 2 y 6 comidas
    meals_per_day: int = Field(..., ge=2, le=6) 
    allergies_intolerances: Optional[List[str]] = []
    disliked_foods: Optional[List[str]] = []

    # --- Validaciones Personalizadas (Lógica de Negocio) ---

    @field_validator('injuries_details')
    def validate_injuries_details(cls, v, info):
        """
        Si el usuario marcó 'Other' en lesiones, los detalles son obligatorios.
        """
        values = info.data
        injuries = values.get('injuries', [])
        
        # Si 'other' está en la lista de lesiones y no hay detalles...
        if InjuryType.OTHER in injuries and not v:
            raise ValueError('Debes especificar los detalles de tu lesión si seleccionaste "Otra".')
        return v

    class Config:
        # Esto permite que los Enums se muestren como strings en la documentación (Swagger/OpenAPI)
        use_enum_values = True
        json_schema_extra = {
            "example": {
                "fitness_goal": "muscle_gain",
                "experience_level": "intermediate",
                "training_location": "gym",
                "days_available": 4,
                "session_duration": "60_min",
                "activity_level": "sedentary",
                "injuries": ["knee"],
                "injuries_details": "Molestia leve al correr",
                "meals_per_day": 3
            }
        }

# --- ROUTES ---

@onboarding_bp.route('/par-q', methods=['GET'])
def par_q_page():
    """Renderiza la página del cuestionario PAR-Q+."""
    questions = manager.create_blank_par_q()
    return render_template('onboarding_par_q.html', questions=questions)

@onboarding_bp.route('/api/par-q', methods=['POST'])
def submit_par_q():
    """Procesa el cuestionario PAR-Q+."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json()
        responses = data.get('responses', [])
        
        # Validar que todas las preguntas estén respondidas
        if len(responses) != len(manager.standard_questions):
             return jsonify({"error": "Incomplete submission"}), 400

        # Evaluar
        result = manager.evaluate_submission(responses)
        
        # Guardar en DB
        db = get_db()
        par_q_data = {
            "last_updated": date.today().isoformat(),
            "status": result["status"],
            "responses": responses, # Guardamos historial
            "valid_until": result["valid_until"],
            "follow_up_required": not result["is_cleared"]
        }
        
        db.users.update_one(
            {"_id": user_id}, # Asumiendo user_id es el _id o algún campo único
            {"$set": {"par_q_plus": par_q_data}},
            upsert=True # Por seguridad, aunque el usuario debería existir
        )
        
        # Si falló, quizás queramos loguear o alertar
        if not result["is_cleared"]:
            logger.warning(f"User {user_id} flagged with health risks in PAR-Q.")

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Error submitting PAR-Q: {e}")
        return jsonify({"error": str(e)}), 500

# --- NEW WIZARD ROUTES ---

@onboarding_bp.route('/wizard', methods=['GET'])
def wizard_page():
    """Renderiza la página del nuevo formulario de onboarding (Wizard)."""
    # JSON structure provided by the user can be passed here or embedded in the template.
    # Since it's a template, we can pass it as a variable.
    
    onboarding_flow = {
        "version": "1.0",
        "steps": [
            {
                "step_id": 1,
                "title": "Objetivos y Experiencia",
                "description": "Define tu meta y punto de partida.",
                "fields": [
                    {
                        "key": "fitness_goal",
                        "label": "¿Cuál es tu objetivo principal?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            { "value": "fat_loss", "label": "Definición (Bajar grasa)" },
                            { "value": "muscle_gain", "label": "Volumen (Ganar músculo)" },
                            { "value": "maintenance", "label": "Mantenimiento / Recomposición" },
                            { "value": "strength", "label": "Fuerza / Rendimiento" }
                        ]
                    },
                    {
                        "key": "experience_level",
                        "label": "¿Cuánto tiempo llevas entrenando de forma constante?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            { "value": "beginner", "label": "Principiante (0 - 6 meses)" },
                            { "value": "intermediate", "label": "Intermedio (6 meses - 2 años)" },
                            { "value": "advanced", "label": "Avanzado (+2 años)" }
                        ]
                    }
                ]
            },
            {
                "step_id": 2,
                "title": "Logística de Entrenamiento",
                "description": "Adaptamos el plan a tu realidad.",
                "fields": [
                    {
                        "key": "training_location",
                        "label": "¿Dónde entrenarás principalmente?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            { "value": "gym", "label": "Gimnasio Comercial (Equipo completo)" },
                            { "value": "home_basic", "label": "Casa (Mancuernas/Bandas)" },
                            { "value": "home_bodyweight", "label": "Casa (Sin equipo)" },
                            { "value": "park", "label": "Parque / Calistenia" }
                        ]
                    },
                    {
                        "key": "days_available",
                        "label": "¿Cuántos días a la semana puedes entrenar?",
                        "type": "number",
                        "required": True,
                        "min": 1,
                        "max": 7
                    },
                    {
                        "key": "session_duration",
                        "label": "¿Cuánto tiempo tienes por sesión?",
                        "type": "single_select",
                        "required": True,
                        "options": [
                            { "value": "30_min", "label": "30 minutos (Express)" },
                            { "value": "45_min", "label": "45 minutos" },
                            { "value": "60_min", "label": "60 minutos (Estándar)" },
                            { "value": "90_min", "label": "90+ minutos" }
                        ]
                    },
                    {
                        "key": "preferred_time",
                        "label": "¿En qué horario sueles entrenar?",
                        "type": "single_select",
                        "required": False,
                        "options": [
                            { "value": "morning", "label": "Mañana" },
                            { "value": "afternoon", "label": "Tarde" },
                            { "value": "night", "label": "Noche" }
                        ]
                    }
                ]
            },
            {
                "step_id": 3,
                "title": "Salud y Estilo de Vida",
                "description": "Datos vitales para tu seguridad y nutrición.",
                "fields": [
                    {
                        "key": "activity_level",
                        "label": "¿Cómo es tu actividad diaria (fuera del ejercicio)?",
                        "type": "single_select",
                        "required": True,
                        "info_tooltip": "Necesario para calcular tus calorías diarias (NEAT).",
                        "options": [
                            { "value": "sedentary", "label": "Sedentario (Oficina, mucho tiempo sentado)" },
                            { "value": "lightly_active", "label": "Ligeramente activo (Caminar algo, tareas de casa)" },
                            { "value": "moderately_active", "label": "Moderadamente activo (De pie, movimiento constante)" },
                            { "value": "very_active", "label": "Muy activo (Trabajo físico pesado, construcción)" }
                        ]
                    },
                    {
                        "key": "injuries",
                        "label": "¿Tienes lesiones actuales o recientes?",
                        "type": "multi_select",
                        "required": False,
                        "options": [
                            { "value": "none", "label": "Ninguna" },
                            { "value": "knee", "label": "Rodilla" },
                            { "value": "lower_back", "label": "Espalda Baja" },
                            { "value": "shoulder", "label": "Hombro" },
                            { "value": "wrist", "label": "Muñeca" },
                            { "value": "other", "label": "Otra (Especificar)" }
                        ]
                    },
                    {
                        "key": "injuries_details",
                        "label": "Detalles de la lesión (si aplica)",
                        "type": "text_area",
                        "required": False,
                        "dependency": { "key": "injuries", "not_value": "none" }
                    },
                    {
                        "key": "habits",
                        "label": "Hábitos de consumo",
                        "type": "multi_select",
                        "required": False,
                        "options": [
                            { "value": "smoker", "label": "Fumador" },
                            { "value": "alcohol_social", "label": "Alcohol (Social)" },
                            { "value": "alcohol_frequent", "label": "Alcohol (Frecuente)" },
                            { "value": "none", "label": "Ninguno" }
                        ]
                    }
                ]
            },
            {
                "step_id": 4,
                "title": "Nutrición",
                "description": "Personaliza tu plan de alimentación.",
                "fields": [
                    {
                        "key": "meals_per_day",
                        "label": "¿Cuántas comidas prefieres hacer al día?",
                        "type": "number",
                        "required": True,
                        "min": 2,
                        "max": 6,
                        "default": 3
                    },
                    {
                        "key": "allergies_intolerances",
                        "label": "¿Tienes alergias o intolerancias?",
                        "type": "multi_select",
                        "required": False,
                        "options": [
                            { "value": "lactose", "label": "Lactosa" },
                            { "value": "gluten", "label": "Gluten" },
                            { "value": "nuts", "label": "Frutos secos" },
                            { "value": "shellfish", "label": "Mariscos" },
                            { "value": "vegan", "label": "Vegano (Preferencia)" },
                            { "value": "vegetarian", "label": "Vegetariano (Preferencia)" }
                        ]
                    },
                    {
                        "key": "disliked_foods",
                        "label": "Alimentos que NO te gustan",
                        "type": "tags_input",
                        "required": False,
                        "placeholder": "Ej: Brócoli, Pescado, Hígado..."
                    }
                ]
            }
        ]
    }
    
    return render_template('onboarding_wizard.html', onboarding_flow=onboarding_flow)

@onboarding_bp.route('/api/wizard', methods=['POST'])
def submit_wizard():
    """Recibe y valida el formulario completo de onboarding."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.json
        print(f"--- [DEBUG] Received Wizard Data: {data}", flush=True)

        try:
            # Validar con Pydantic
            submission = OnboardingSubmission(**data)
        except ValidationError as e:
            logger.warning(f"Validation Error for user {user_id}: {e.json()}")
            return jsonify({"error": "Validation Failed", "details": e.errors()}), 400

        # Guardar en DB
        db = get_db()
        onboarding_data = submission.model_dump() # Convertir a dict
        
        # Agregamos metadatos
        onboarding_data['updated_at'] = datetime.now()
        onboarding_data['onboarding_completed'] = True

        # 1. Update user flag (for check_onboarding_status middleware)
        db.users.update_one(
            {"user_id": user_id},
            {"$set": {"onboarding_completed": True}},
            upsert=True 
        )

        # 2. Upsert user_profile SKIPPED to avoid duplication
        # We only store the flag in users and the full data in onboarding_submissions
        # Middleware updated to check flag in users collection.

        # 3. Save to specific collection (History/Archive) or just raw submission
        # "guardar en una collection" request satisfied here.
        db.onboarding_submissions.insert_one({
            "user_id": user_id,
            "submission_date": datetime.now(),
            "data": onboarding_data
        })

        return jsonify({"message": "Onboarding completed successfully"}), 200

    except Exception as e:
        logger.error(f"Error submitting Wizard: {e}")
        return jsonify({"error": str(e)}), 500
