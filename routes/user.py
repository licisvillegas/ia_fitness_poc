from flask import Blueprint, request, jsonify, render_template
from datetime import datetime, timedelta
import os
from werkzeug.security import generate_password_hash, check_password_hash
import cloudinary
import cloudinary.uploader
import extensions
from extensions import logger
from utils.auth_helpers import ensure_user_status
from utils.helpers import parse_birth_date

# Configuracion Cloudinary (perfil)
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

user_bp = Blueprint('user', __name__)

@user_bp.route("/")
def index():
    return render_template("auth.html")

@user_bp.route("/landing")
def landing_page():
    return render_template("landing.html")

@user_bp.route("/dashboard")
def dashboard_page():
    # Redirige al dashboard directamente
    return render_template("dashboard.html")

@user_bp.route("/nutrition")
def nutrition_page():
    return render_template("nutrition.html")



@user_bp.route("/about")
def about_page():
    return render_template("about.html")

@user_bp.route("/contactanos")
def contactanos_page():
    return render_template("contactanos.html")

@user_bp.route("/plan")
def plan_page():
    return render_template("plan.html")

@user_bp.route("/exercises/list")
def exercises_list_page():
    return render_template("exercises_list.html")

@user_bp.route("/glossary")
def glossary_page():
    return render_template("glossary.html")

@user_bp.route("/muscle-map")
def muscle_map_page():
    return render_template("muscle_map.html")

@user_bp.route("/body-morph")
def body_morph_page():
    return render_template("body_morph.html")

@user_bp.route("/offline.html")
def offline_page():
    return render_template("offline.html")

@user_bp.get("/api/user/body_assessment/latest")
def api_latest_body_assessment():
    user_id = request.args.get("user_id") or request.cookies.get("user_session")
    if not user_id:
        return jsonify({"error": "No autenticado"}), 401
    if extensions.db is None:
        return jsonify({"error": "DB no disponible"}), 503

    def pick_value(source, keys):
        for key in keys:
            if source and key in source and source.get(key) is not None:
                return source.get(key)
        return None

    def to_float(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    try:
        latest = extensions.db.body_assessments.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        if not latest:
            return jsonify({"measurements": {}}), 200

        inp = latest.get("input") or {}
        meas = inp.get("measurements") or {}
        out = latest.get("output") or {}
        body_comp = out.get("body_composition") or {}

        weight = pick_value(meas, ["weight_kg", "weight"]) or inp.get("weight")
        body_fat = pick_value(body_comp, ["body_fat_percent"]) or pick_value(meas, ["body_fat_percent", "body_fat"])

        data = {
            "weight_kg": to_float(weight),
            "body_fat_percent": to_float(body_fat),
            "measurements": {
                "chest": to_float(pick_value(meas, ["chest", "torax", "pecho"])),
                "neck": to_float(pick_value(meas, ["neck", "cuello"])),
                "waist": to_float(pick_value(meas, ["waist", "cintura", "abdomen"])),
                "hip": to_float(pick_value(meas, ["hip", "hips", "cadera"])),
                "shoulders": to_float(pick_value(meas, ["shoulders", "hombros"])),
                "biceps_left": to_float(pick_value(meas, ["biceps_left", "arm_flexed_left", "arm_relaxed_left", "arm_left", "biceps_izq"])),
                "biceps_right": to_float(pick_value(meas, ["biceps_right", "arm_flexed_right", "arm_relaxed_right", "arm_right", "biceps_der"])),
                "forearm_left": to_float(pick_value(meas, ["forearm_left", "forearm_izq", "antebrazo_izq"])),
                "forearm_right": to_float(pick_value(meas, ["forearm_right", "forearm_der", "antebrazo_der"])),
                "thigh_left": to_float(pick_value(meas, ["thigh_left", "thigh_izq", "muslo_izq"])),
                "thigh_right": to_float(pick_value(meas, ["thigh_right", "thigh_der", "muslo_der"])),
                "calf_left": to_float(pick_value(meas, ["calf_left", "calf_izq", "pantorrilla_izq"])),
                "calf_right": to_float(pick_value(meas, ["calf_right", "calf_der", "pantorrilla_der"])),
            }
        }

        return jsonify(data), 200

    except Exception as e:
        logger.error(f"Error fetching latest body assessment: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@user_bp.route("/profile")
def profile_page():
    user_id = request.cookies.get("user_session")
    user_context = {}
    if user_id and extensions.db is not None:
        try:
            u = extensions.db.users.find_one({"user_id": user_id})
            if u:
                user_context = {
                   "user_id": user_id,
                   "name": u.get("name"),
                   "email": u.get("email"),
                   "username": u.get("username"),
                   "own_referral_code": u.get("own_referral_code"), # For admins/coaches
                   "coach_id": u.get("coach_id"),
                   "role": "user"
                }

                # Lookup Coach Name if exists
                if u.get("coach_id"):
                     c_doc = extensions.db.users.find_one({"user_id": u["coach_id"]}, {"name":1, "username":1})
                     if c_doc:
                         user_context["coach_name"] = c_doc.get("name") or c_doc.get("username")
                
                # Fetch Status & Validity
                status_doc = extensions.db.user_status.find_one({"user_id": user_id})
                if status_doc:
                    user_context["status"] = status_doc.get("status")
                    vu = status_doc.get("valid_until")
                    if vu:
                        if isinstance(vu, datetime):
                            user_context["valid_until"] = vu.strftime("%Y-%m-%d")
                        else:
                            user_context["valid_until"] = str(vu)

                role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
                if role_doc:
                    user_context["role"] = role_doc.get("role")
                
                p = extensions.db.user_profiles.find_one({"user_id": user_id})
                if p:
                    bdate = p.get("birth_date")
                    if bdate and hasattr(bdate, "strftime"):
                         bdate = bdate.strftime("%Y-%m-%d")
                    elif bdate:
                         bdate = str(bdate)

                    user_context.update({
                        "sex": p.get("sex"),
                        "birth_date": bdate,
                        "phone": p.get("phone"),
                        "profile_image_url": p.get("profile_image_url"),
                        "has_profile": True
                    })
                    print(f"DEBUG PROFILE CONTEXT: {user_context}", flush=True)
                else:
                    user_context["has_profile"] = False
                    print(f"DEBUG PROFILE: No profile found for {user_id}", flush=True)
        except Exception as e:
            logger.error(f"Error loading profile context: {e}")
            pass

    return render_template("profile.html", user_data=user_context)

@user_bp.route("/payment")
def payment_page():
    return render_template("payment.html")

@user_bp.post("/api/contact/comments")
def api_contact_comments():
    """Recibe comentarios desde Contactanos y los guarda en MongoDB."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
        if extensions.db is None:
            return jsonify({"error": "DB no disponible"}), 503

        data = request.get_json() or {}
        comment = (data.get("comment") or "").strip()
        subject = (data.get("subject") or "").strip()
        contact_email = (data.get("contact_email") or "").strip() or None

        if not comment:
            return jsonify({"error": "El comentario es obligatorio"}), 400
        if len(comment) > 2000:
            return jsonify({"error": "El comentario es demasiado largo"}), 400
        if subject and len(subject) > 200:
            return jsonify({"error": "El asunto es demasiado largo"}), 400

        doc = {
            "user_id": user_id,
            "subject": subject or None,
            "comment": comment,
            "contact_email": contact_email,
            "created_at": datetime.utcnow(),
        }

        extensions.db.contact_comments.insert_one(doc)
        return jsonify({"message": "Comentario enviado"}), 200

    except Exception as e:
        logger.error(f"Error guardando comentario de contacto: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@user_bp.post("/api/user/payments/simulate")
def api_simulate_payment():
    """Simula un pago y activa al usuario con vigencia segun el producto."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
        if extensions.db is None:
            return jsonify({"error": "DB no disponible"}), 503

        data = request.get_json() or {}
        product = (data.get("product") or data.get("plan") or "").strip().lower()
        map_days = {
            "30": 30,
            "90": 90,
            "180": 180,
            "365": 365,
            "anual": 365,
            "annual": 365
        }
        days = map_days.get(product)
        if not days:
            return jsonify({"error": "Producto invalido"}), 400

        valid_until = datetime.utcnow() + timedelta(days=days)
        now = datetime.utcnow()

        extensions.db.user_status.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "status": "active",
                    "valid_until": valid_until,
                    "updated_at": now,
                    "last_payment": {
                        "product": product,
                        "days": days,
                        "paid_at": now
                    }
                },
                "$setOnInsert": {
                    "created_at": now
                }
            },
            upsert=True
        )

        return jsonify({
            "message": "Pago simulado y usuario activado",
            "valid_until": valid_until.strftime("%Y-%m-%d"),
            "days": days
        }), 200

    except Exception as e:
        logger.error(f"Error simulando pago: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@user_bp.post("/api/user/change_password")
def api_user_change_password():
    """
    Permite al usuario cambiar su contraseña.
    Requiere: current_password, new_password
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
            
        data = request.get_json()
        current_password = data.get("current_password")
        new_password = data.get("new_password")
        
        if not current_password or not new_password:
            return jsonify({"error": "Faltan datos (actual y nueva contraseña)"}), 400
            
        if len(new_password) < 6:
            return jsonify({"error": "La nueva contraseña debe tener al menos 6 caracteres"}), 400

        if extensions.db is None:
             return jsonify({"error": "DB no disponible"}), 503

        # Verify old password
        user = extensions.db.users.find_one({"user_id": user_id})
        if not user:
             return jsonify({"error": "Usuario no encontrado"}), 404
             
        if not check_password_hash(user["password_hash"] if "password_hash" in user else user.get("password", ""), current_password):
            return jsonify({"error": "La contraseña actual es incorrecta"}), 403
            
        # Update with new password
        new_hash = generate_password_hash(new_password)
        extensions.db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": new_hash}})
        
        logger.info(f"Usuario {user_id} cambió su contraseña exitosamente")
        return jsonify({"message": "Contraseña actualizada correctamente"}), 200

    except Exception as e:
        logger.error(f"Error cambiando password: {e}")
        return jsonify({"error": "Error interno"}), 500


@user_bp.post("/api/user/profile/save")
def api_user_profile_save():
    """Actualiza perfil del usuario autenticado."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
        
        data = request.get_json() or {}
        name = data.get("name")
        sex = (data.get("sex") or "").strip().lower() or None
        birth_date_raw = data.get("birth_date")
        phone = (data.get("phone") or "").strip() or None

        if sex and sex not in ["male", "female", "other"]:
            return jsonify({"error": "Sexo invalido"}), 400

        birth_dt = parse_birth_date(birth_date_raw)
        if birth_date_raw and birth_dt is None:
            return jsonify({"error": "Fecha de nacimiento invalida. Usa YYYY-MM-DD"}), 400

        updates = {
            "sex": sex,
            "birth_date": birth_dt,
            "phone": phone,
            "updated_at": datetime.utcnow(),
        }

        if extensions.db is not None:
             extensions.db.user_profiles.update_one(
                {"user_id": user_id},
                {"$set": updates, "$setOnInsert": {"created_at": datetime.utcnow(), "user_id": user_id}},
                upsert=True,
            )
             if name is not None:
                extensions.db.users.update_one({"user_id": user_id}, {"$set": {"name": name}})
        
        print(f"DEBUG SAVE PROFILE: user={user_id} updates={updates}", flush=True)
        return jsonify({"message": "Perfil actualizado", "user_id": user_id}), 200

    except Exception as e:
        logger.error(f"Error guardando perfil usuario: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@user_bp.post("/api/user/profile/image")
def api_user_profile_image():
    """Sube la imagen de perfil del usuario y guarda la URL."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401

        if not os.getenv("CLOUDINARY_CLOUD_NAME"):
            return jsonify({"error": "Cloudinary no configurado"}), 503

        if "image" not in request.files:
            return jsonify({"error": "Falta el archivo de imagen"}), 400

        file_storage = request.files.get("image")
        if not file_storage or not file_storage.filename:
            return jsonify({"error": "Archivo de imagen invalido"}), 400

        if not (file_storage.mimetype or "").startswith("image/"):
            return jsonify({"error": "Formato de imagen invalido"}), 400

        folder = f"ia_fitness/profile/user/{user_id}"
        upload_result = cloudinary.uploader.upload(
            file_storage,
            folder=folder,
            resource_type="image"
        )
        secure_url = upload_result.get("secure_url")
        if not secure_url:
            return jsonify({"error": "No se pudo subir la imagen"}), 500

        if extensions.db is not None:
            extensions.db.user_profiles.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "profile_image_url": secure_url,
                        "updated_at": datetime.utcnow()
                    },
                    "$setOnInsert": {"created_at": datetime.utcnow(), "user_id": user_id}
                },
                upsert=True,
            )

        return jsonify({"message": "Imagen actualizada", "profile_image_url": secure_url}), 200

    except Exception as e:
        logger.error(f"Error subiendo imagen de perfil: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@user_bp.route("/get_user_plan/<user_id>", methods=["GET"])
def get_user_plan(user_id):
    try:
        if extensions.db is None:
             return jsonify({"error": "DB no inicializada"}), 503
        plan = extensions.db.plans.find_one({"user_id": user_id}, sort=[("created_at", -1)])
        if not plan:
            return jsonify({"error": "No se encontró un plan para este usuario"}), 404
        plan["_id"] = str(plan["_id"])
        # Serializar fechas
        if plan.get("created_at"):
            plan["created_at"] = (plan["created_at"].isoformat() + "Z") if isinstance(plan["created_at"], datetime) else str(plan["created_at"])
        if plan.get("activated_at"):
            plan["activated_at"] = (plan["activated_at"].isoformat() + "Z") if isinstance(plan["activated_at"], datetime) else str(plan["activated_at"])

        return jsonify(plan), 200
    except Exception as e:
        logger.error(f"Error al obtener plan de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener el plan"}), 500


@user_bp.route("/plans/<user_id>/active")
def get_user_active_plan(user_id):
    """Obtiene el plan activo del usuario (Workout + Nutrition)."""
    # Verify auth (optional or strict based on middleware)
    # user_session = request.cookies.get("user_session")
    # if not user_session: return jsonify({"error": "Unauthorized"}), 401
    
    if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
    
    try:
        plan = extensions.db.plans.find_one({"user_id": user_id, "active": True})
        if not plan:
            return jsonify({"error": "No hay plan activo"}), 404
        
        plan["_id"] = str(plan["_id"])
        return jsonify(plan), 200
    except Exception as e:
        logger.error(f"Error fetching active plan: {e}")
        return jsonify({"error": "Internal Error"}), 500

@user_bp.route("/get_progress/<user_id>", methods=["GET"])
def get_progress(user_id):
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503

        limit = request.args.get("limit")
        days = request.args.get("days")
        start = request.args.get("start")
        end = request.args.get("end")

        date_filter = {}
        if days:
            try:
                cutoff = datetime.utcnow() - timedelta(days=int(days))
                date_filter["$gte"] = cutoff
            except (TypeError, ValueError):
                pass
        if start:
            try:
                date_filter["$gte"] = datetime.fromisoformat(start.replace("Z", "+00:00"))
            except Exception:
                pass
        if end:
            try:
                date_filter["$lte"] = datetime.fromisoformat(end.replace("Z", "+00:00"))
            except Exception:
                pass

        assess_query = {"user_id": user_id}
        if date_filter:
            assess_query["created_at"] = date_filter

        # 1. Fetch Body Assessments (Legacy Progress removed)
        # We project only needed fields to match progress structure
        assess_cursor = extensions.db.body_assessments.find(
            assess_query,
            {"created_at": 1, "input": 1, "output": 1}
        )
        if limit:
            try:
                assess_cursor = assess_cursor.sort("created_at", -1).limit(int(limit))
            except (TypeError, ValueError):
                pass
        assess_records = []
        for a in assess_cursor:
            # Normalize assessment to progress format
            
            # Date
            created = a.get("created_at")
            if not created: continue
            
            # Weight
            inp = a.get("input") or {}
            meas = inp.get("measurements") or {}
            w = meas.get("weight_kg")
            if not w: w = inp.get("weight")
            
            # Body Fat (Same priority logic as latest_metrics)
            bf = None
            out = a.get("output") or {}
            bc = out.get("body_composition") or {}
            
            if bc.get("body_fat_percent"):
                bf = bc.get("body_fat_percent")
            elif out.get("body_fat_percent"):
                bf = out.get("body_fat_percent")
            elif meas.get("body_fat_percent"):
                bf = meas.get("body_fat_percent")
            elif meas.get("body_fat"):
                bf = meas.get("body_fat")
                
            # TMB & TDEE (from output.energy_expenditure)
            tmb = None
            tdee = None
            energy = out.get("energy_expenditure") or {}
            if energy.get("tmb"):
                tmb = energy.get("tmb")
            if energy.get("selected_tdee"):
                tdee = energy.get("selected_tdee")

            # Only add if we have at least weight or body_fat, or it's a valid record we want to show
            # It's better to show it if it has date
            assess_records.append({
                "_id": str(a["_id"]),
                "user_id": user_id,
                "date": created, # Keep as object for sorting first
                "weight_kg": w,
                "body_fat": bf,
                "tmb": tmb,
                "tdee": tdee,
                "performance": None, # Assessments don't usually have this
                "nutrition_adherence": None 
            })
            
        # 3. Merge and Normalize Dates
        # 3. Use only Assessment Records
        all_records = assess_records
        
        # Helper to get datetime for sorting
        def get_dt(r):
            d = r.get("date")
            if isinstance(d, datetime): return d
            if isinstance(d, str):
                try: return datetime.fromisoformat(d.replace("Z", "+00:00"))
                except: pass
                try: return datetime.strptime(d, "%Y-%m-%d")
                except: pass
            return datetime.min

        all_records.sort(key=get_dt)
        
        # Final formatting for JSON
        for r in all_records:
            r["_id"] = str(r["_id"])
            # Ensure tmb and tdee keys exist
            if "tmb" not in r: r["tmb"] = None
            if "tdee" not in r: r["tdee"] = None
            
            if r.get("date") and isinstance(r["date"], datetime):
                r["date"] = r["date"].strftime("%Y-%m-%d") # Use consistent YYYY-MM-DD for charts
            
        if not all_records:
            return jsonify([]), 200
            
        return jsonify(all_records), 200
        
    except Exception as e:
        logger.error(f"Error al obtener progreso de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener progreso"}), 500

@user_bp.get("/api/user/my_profile")
def get_my_profile_aggregated():
    """Endpoint agregado para precargar formularios del usuario."""
    user_id = request.cookies.get("user_session")
    if not user_id:
         return jsonify({"error": "No autenticado"}), 401
    
    if extensions.db is None:
         return jsonify({"error": "DB not ready"}), 503

    try:
        # 1. Basic User Info
        user_doc = extensions.db.users.find_one({"user_id": user_id}) or {}
        
        # 2. Profile Info
        profile_doc = extensions.db.user_profiles.find_one({"user_id": user_id}) or {}
        
        # 3. Active Plan Goal/Activity
        plan_doc = extensions.db.plans.find_one({"user_id": user_id, "active": True}) or {}
        
        # 4. Latest Measurements (from body_assessments or progress)
        measurements = {}
        latest_input = {}
        # Try latest assessment
        last_assess = extensions.db.body_assessments.find_one(
            {"user_id": user_id}, sort=[("created_at", -1)]
        )
        if last_assess and "input" in last_assess:
             latest_input = last_assess["input"] or {}
             if "measurements" in latest_input:
                 measurements = latest_input["measurements"]
        
        # Calculate Age
        age = None
        if profile_doc.get("birth_date"):
            dob = profile_doc["birth_date"]
            if isinstance(dob, datetime):
                today = datetime.utcnow()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        # Construct Response
        data = {
            "user_id": user_id,
            "name": user_doc.get("name") or user_doc.get("username"),
            "email": user_doc.get("email"),
            "sex": profile_doc.get("sex"),
            "profile_image_url": profile_doc.get("profile_image_url"),
            "age": age,
            "phone": profile_doc.get("phone"),
            "goal": plan_doc.get("goal") or user_doc.get("goal") or user_doc.get("goals"), # Fallback to user doc
            "activity_level": plan_doc.get("activity_level"), # Note: Plan might not check activity level, checking input logic usually relies on creation input.
            "notes": None, # Could fetch from last plan or assessment
            "measurements": measurements
        }

        if latest_input.get("goal") or latest_input.get("goals"):
            data["goal"] = latest_input.get("goal") or latest_input.get("goals")
        if latest_input.get("activity_level"):
            data["activity_level"] = latest_input.get("activity_level")
        
        return jsonify(data), 200
        
    except Exception as e:
        logger.error(f"Error fetching my_profile for {user_id}: {e}", exc_info=True)
        return jsonify({"error": "Error interno fetching profile"}), 500

@user_bp.get("/api/user/<user_id>/latest_metrics")
def api_get_user_latest_metrics(user_id):
    """
    Obtiene las métricas más recientes (peso, grasa) desde body_assessments.
    Prioridad: body_assessments > progress (legacy)
    """
    try:
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503

        # Buscar última evaluación corporal
        last_assess = extensions.db.body_assessments.find_one(
            {"user_id": user_id}, 
            sort=[("created_at", -1)]
        )
        
        metrics = {}
        
        if last_assess:
            # Intentar extraer de input.measurements (formato normalizado)
            inp = last_assess.get("input", {})
            meas = inp.get("measurements", {})
            
            # Peso
            if meas.get("weight_kg"):
                metrics["weight_kg"] = meas.get("weight_kg")
            elif inp.get("weight"): # Fallback estructura antigua
                metrics["weight_kg"] = inp.get("weight")
                
            # Grasa (body_fat_percent)
            # Prioridad 1: Output del Agente (body_composition.body_fat_percent)
            out = last_assess.get("output", {})
            body_comp = out.get("body_composition", {})
            
            if body_comp.get("body_fat_percent"):
                 metrics["body_fat"] = body_comp.get("body_fat_percent")
            elif out.get("body_fat_percent"):
                 metrics["body_fat"] = out.get("body_fat_percent")

            # TMB (energy_expenditure.tmb) & TDEE (energy_expenditure.selected_tdee)
            energy = out.get("energy_expenditure", {})
            if energy.get("tmb"):
                metrics["tmb"] = energy.get("tmb")
            if energy.get("selected_tdee"):
                metrics["tdee"] = energy.get("selected_tdee")
            # Prioridad 2: Input del Usuario (Normalizado)
            elif meas.get("body_fat_percent"):
                 metrics["body_fat"] = meas.get("body_fat_percent")
            # Prioridad 3: Legacy fields
            elif meas.get("body_fat"):
                 metrics["body_fat"] = meas.get("body_fat")
        
        return jsonify(metrics), 200

    except Exception as e:
        logger.error(f"Error fetching latest metrics for {user_id}: {e}")
        return jsonify({"error": "Internal Error"}), 500

@user_bp.route("/tracking")
def body_tracking_page():
    embed = request.args.get("embed") in ("1", "true", "yes")
    user_id = request.args.get("user_id") or request.cookies.get("user_session")
    user_data = {"measurements": {}, "stats": {}}

    if user_id and extensions.db is not None:
        try:
            assessments = list(
                extensions.db.body_assessments.find(
                    {"user_id": user_id},
                    {"created_at": 1, "input": 1, "output": 1}
                ).sort("created_at", -1).limit(2)
            )

            latest = assessments[0] if assessments else None
            previous = assessments[1] if len(assessments) > 1 else None

            latest_input = (latest or {}).get("input") or {}
            latest_meas = latest_input.get("measurements") or {}
            prev_input = (previous or {}).get("input") or {}
            prev_meas = prev_input.get("measurements") or {}

            def format_change_data(curr, prev, unit):
                if curr is None or prev is None:
                    return {"text": "", "trend": "neutral"}
                try:
                    delta = float(curr) - float(prev)
                except (TypeError, ValueError):
                    return {"text": "", "trend": "neutral"}
                
                if abs(delta) < 0.1:
                    # Neutral but with + sign as requested: (+) = (0.0)
                    return {"text": f"+0.0{unit}", "trend": "neutral"}
                
                if delta > 0:
                    return {"text": f"+{abs(delta):.1f}{unit}", "trend": "pos"}
                else:
                    return {"text": f"-{abs(delta):.1f}{unit}", "trend": "neg"}

            def map_measure(key, value, unit="cm"):
                prev_val = prev_meas.get(key)
                
                # Fallback: if specific key (e.g. thigh_left) not in prev, try singular (thigh)
                if prev_val is None:
                    singular_key = key.replace("_left", "").replace("_right", "")
                    prev_val = prev_meas.get(singular_key)

                data = format_change_data(value, prev_val, unit)
                return {"value": value, "change": data["text"], "trend": data["trend"]}

            # Determine Arm key fallback
            arm_key = "arm_flexed"
            
            # Helper to check if any variant exists
            def has_any(base):
                return (latest_meas.get(base) is not None or 
                        latest_meas.get(f"{base}_left") is not None or 
                        latest_meas.get(f"{base}_right") is not None)

            if has_any("arm_relaxed") and not has_any("arm_flexed"):
                 arm_key = "arm_relaxed"
            
            # Fallback to Biceps if generic arm is missing
            if not has_any(arm_key) and latest_meas.get("biceps") is not None:
                 arm_key = "biceps" 

            mapping = {
                "cuello": ("neck", "cm"),
                "torax": ("chest", "cm"),
                "cintura": ("waist", "cm"),
                "cadera": ("hip", "cm"),
                "hombros": ("shoulders", "cm"),
                
                # Bilaterales (con fallbacks)
                "biceps_izq": (f"{arm_key}_left", "cm"),
                "biceps_der": (f"{arm_key}_right", "cm"),
                
                "muslo_izq": ("thigh_left", "cm"),
                "muslo_der": ("thigh_right", "cm"),
                
                "pantorrilla_izq": ("calf_left", "cm"),
                "pantorrilla_der": ("calf_right", "cm"),
                
                "antebrazo_izq": ("forearm_left", "cm"),
                "antebrazo_der": ("forearm_right", "cm"),
            }
            
            # Helper to find value with fallback to singular
            for label_key, (source_key, unit) in mapping.items():
                value = latest_meas.get(source_key)
                
                # Try singular fallback if specific side is missing
                if value is None:
                    # e.g. "thigh_left" -> "thigh"
                    singular_key = source_key.replace("_left", "").replace("_right", "")
                    value = latest_meas.get(singular_key)

                # Default to 0 if missing so label appears (clickable)
                if value is None:
                    value = 0

                # Format value to remove .0 if integer
                try:
                    formatted_val = float(value)
                    if formatted_val.is_integer():
                        formatted_val = int(formatted_val)
                except (ValueError, TypeError):
                    formatted_val = value

                user_data["measurements"][label_key] = map_measure(source_key, formatted_val, unit)

            # Stats (peso, grasa, musculo, agua, imc)
            stats = {}
            weight = latest_meas.get("weight_kg")
            prev_weight = prev_meas.get("weight_kg")
            
            # Ensure weight is not None for display
            display_weight = weight if weight is not None else 0.0
            
            w_data = format_change_data(display_weight, prev_weight, "kg")
            stats["peso"] = {
                "value": display_weight,
                "unit": "kg",
                "change": w_data["text"],
                "trend": w_data["trend"]
            }

            latest_out = (latest or {}).get("output") or {}
            prev_out = (previous or {}).get("output") or {}
            latest_comp = latest_out.get("body_composition") or {}
            prev_comp = prev_out.get("body_composition") or {}

            body_fat = latest_comp.get("body_fat_percent")
            if body_fat is None:
                 body_fat = latest_meas.get("body_fat_percent")
            prev_fat = prev_comp.get("body_fat_percent") or prev_meas.get("body_fat_percent")
            
            # Default to 0.0 to ensure display
            if body_fat is None:
                body_fat = 0.0

            bf_data = format_change_data(body_fat, prev_fat, "%")
            stats["grasa"] = {
                "value": body_fat,
                "unit": "%",
                "change": bf_data["text"],
                "trend": bf_data["trend"]
            }

            muscle = latest_comp.get("muscle_mass_percent")
            if muscle is None:
                muscle = latest_meas.get("muscle_mass_percent")
            prev_muscle = prev_comp.get("muscle_mass_percent") or prev_meas.get("muscle_mass_percent")
            
            # Default to 0.0
            if muscle is None:
                muscle = 0.0

            m_data = format_change_data(muscle, prev_muscle, "%")
            stats["musculo"] = {
                "value": muscle,
                "unit": "%",
                "change": m_data["text"],
                "trend": m_data["trend"]
            }
            
            # Water (Estimation: often ~73% of lean mass or just 100 - fat in simplistic models, 
            # but usually provided by scale or user input. If strict calc needed: 
            # TBW = Weight * (100 - Fat%) * 0.73 roughly. 
            # For now, check if context or measurements have it, else derive simple approximation or skip)
            # Water
            water = latest_input.get("measurements", {}).get("water_percent")
            prev_water = prev_meas.get("water_percent")
            # Default to 0.0 to ensure input/display row exists
            if water is None:
                water = 0.0
            
            wa_data = format_change_data(water, prev_water, "%")
            stats["agua"] = {
                "value": water,
                "unit": "%",
                "change": wa_data["text"],
                "trend": wa_data["trend"]
            }

            bmi = (latest_input.get("calculations") or {}).get("bmi")
            if bmi is None:
                bmi = 0.0
            
            stats["imc"] = {"value": bmi, "unit": "", "change": "", "trend": "neutral"}

            if stats:
                user_data["stats"] = stats
        except Exception as e:
            logger.error(f"Error loading tracking data for {user_id}: {e}")

    return render_template("body_tracking.html", data=user_data, embed=embed)

@user_bp.post("/api/user/measurement/save")
def save_measurement_mock():
    try:
        data = request.json
        # Here we would save to DB
        return jsonify({"status": "success", "message": f"Medida guardada", "data": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
