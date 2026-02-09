"""
Blueprint de Smart Workout
Maneja dashboard, runner, sesiones y estadísticas de entrenamiento.
Refactorizado en submódulos para mejor mantenibilidad.
"""
from flask import Blueprint

# Crear blueprint
workout_bp = Blueprint('workout', __name__, url_prefix='/workout')

print("LOADING WORKOUT_PY MODULE (PACKAGE)...", flush=True)

# Importar y registrar rutas de los submódulos
# Es importante importar después de definir workout_bp para evitar problemas circulares
# si los submódulos importan workout_bp (aunque en este refactor hemos evitado eso usando decoradores manuales 
# o pasando el app, pero lo más limpio es registrarlos aquí).

# Sin embargo, la forma más común en Flask con Blueprints refactorizados es:
# En el submódulo: @workout_bp.route
# Para eso el submódulo necesita importar workout_bp de aquí.
# Y aquí necesitamos importar el submódulo para que se ejecuten los decoradores.

from . import views
from . import api_exercises
from . import api_routines
from . import api_sessions
from . import api_stats
from . import api_ai

# Registrando rutas de Vistas
workout_bp.add_url_rule('/dashboard', view_func=views.dashboard)
workout_bp.add_url_rule('/exercises', view_func=views.exercises_page)
workout_bp.add_url_rule('/exercises/unified', view_func=views.exercises_unified_page)
workout_bp.add_url_rule('/rm-calculator', view_func=views.rm_calculator_page)
workout_bp.add_url_rule('/routines/builder', view_func=views.user_routine_builder_page)
workout_bp.add_url_rule('/routines/builder-guided', view_func=views.user_routine_builder_guided_page)
workout_bp.add_url_rule('/routines', view_func=views.user_routines_catalog_page)
workout_bp.add_url_rule('/adherence', view_func=views.adherence_dashboard_page)
workout_bp.add_url_rule('/run/<routine_id>', view_func=views.run_routine)
workout_bp.add_url_rule('/watch/<routine_id>', view_func=views.watch_routine)

# Registrando rutas de API Ejercicios
workout_bp.add_url_rule('/api/exercises', view_func=api_exercises.list_public_exercises)
workout_bp.add_url_rule('/api/exercises/<exercise_id>', view_func=api_exercises.api_get_exercise_details)
workout_bp.add_url_rule('/api/exercises/search', view_func=api_exercises.api_search_exercises)
workout_bp.add_url_rule('/api/exercises/filter', view_func=api_exercises.api_filter_exercises)
workout_bp.add_url_rule('/api/body-parts', view_func=api_exercises.api_get_body_parts)
workout_bp.add_url_rule('/api/taxonomy', view_func=api_exercises.api_get_taxonomy)
workout_bp.add_url_rule('/api/exercises/metadata', view_func=api_exercises.api_get_exercise_metadata)

# Registrando rutas de API Rutinas
workout_bp.add_url_rule('/api/routines', view_func=api_routines.api_get_user_routines)
workout_bp.add_url_rule('/api/my-routines', view_func=api_routines.api_list_my_routines)
workout_bp.add_url_rule('/api/my-routines/<routine_id>', view_func=api_routines.api_get_my_routine_detail)
workout_bp.add_url_rule('/api/my-routines/save', view_func=api_routines.api_save_my_routine, methods=['POST'])
workout_bp.add_url_rule('/api/my-routines/<routine_id>/toggle-dash', view_func=api_routines.api_toggle_dashboard_visibility, methods=['POST'])

# Registrando rutas de API Sesiones
workout_bp.add_url_rule('/api/sessions', view_func=api_sessions.api_get_sessions)
workout_bp.add_url_rule('/api/sessions/<session_id>', view_func=api_sessions.api_delete_session, methods=['DELETE'])
workout_bp.add_url_rule('/api/session/start', view_func=api_sessions.api_start_session_endpoint, methods=['POST'])
workout_bp.add_url_rule('/api/session/progress', view_func=api_sessions.api_update_progress, methods=['POST'])
workout_bp.add_url_rule('/api/session/save', view_func=api_sessions.api_save_session, methods=['POST'])
workout_bp.add_url_rule('/api/session/cancel', view_func=api_sessions.api_cancel_session, methods=['POST'])

# Registrando rutas de API Stats
workout_bp.add_url_rule('/api/rm/save', view_func=api_stats.api_save_rm_record, methods=['POST'])
workout_bp.add_url_rule('/api/adherence/config', view_func=api_stats.api_get_adherence_config)
workout_bp.add_url_rule('/api/adherence/config', view_func=api_stats.api_save_adherence_config, methods=['POST'])
workout_bp.add_url_rule('/api/stats/volume', view_func=api_stats.api_stats_volume)
workout_bp.add_url_rule('/api/stats/weekly', view_func=api_stats.api_stats_weekly)
workout_bp.add_url_rule('/api/stats/heatmap', view_func=api_stats.api_stats_heatmap)

# Registrando rutas de API AI
workout_bp.add_url_rule('/api/ai-routines', view_func=api_ai.api_list_ai_routines)
workout_bp.add_url_rule('/api/ai-routines/<routine_id>', view_func=api_ai.api_get_ai_routine_detail)
