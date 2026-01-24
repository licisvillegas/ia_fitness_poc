from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from datetime import date, datetime, timedelta
from extensions import get_db, logger

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
