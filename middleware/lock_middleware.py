from flask import request, render_template, redirect, url_for
from extensions import db
from datetime import datetime

# Rutas exentas del bloqueo
EXEMPT_ROUTES = [
    'static', 
    'auth.auth_login_api', 
    'auth.auth_logout',
    'auth.auth_register', 
    'user.landing_page',
    'user.index', # Login Page
    'integrations', # API integrations (e.g., Apple Health) should be public
]

EXEMPT_PREFIXES = [
    '/static',
    '/api/public',
    '/api/user/payments',
    '/auth',
    '/landing',
    '/payment',
    '/api/integrations',
    '/health',
    '/apidocs',
    '/apispec',
    '/flasgger_static'
]

def check_account_lock():
    # 1. Ignorar si es ruta exenta (por endpoint o prefijo)
    # Check Endpoint
    if request.endpoint and any(request.endpoint == ex or request.endpoint.startswith(ex + '.') for ex in EXEMPT_ROUTES):
        return None
    
    # Check Path
    path = request.path
    if any(path.startswith(pre) for pre in EXEMPT_PREFIXES) or path == "/":
        return None

    # 2. Verificar Sesión
    user_id = request.cookies.get("user_session")
    if not user_id:
        # Si no hay sesión y NO es ruta exenta, redirigir a Login
        return redirect("/")

    if db is None: 
        return None

    # 3. Consultar Estado y Vigencia
    try:
        status_doc = db.user_status.find_one({"user_id": user_id})
        
        # Default status if not found? Assume active or pending? 
        # Si no existe doc, asumimos "active" para evitar bloqueo accidental masivo, 
        # o "pending" si somos estrictos. El sistema actual crea el doc al registrar.
        if not status_doc:
            return None 

        status = status_doc.get("status", "active")
        valid_until = status_doc.get("valid_until")

        # If validity exists and is still future, auto-activate even if status is stale.
        parsed_valid_until = None
        if valid_until:
             if isinstance(valid_until, str):
                 try:
                    parsed_valid_until = datetime.fromisoformat(valid_until)
                 except:
                    parsed_valid_until = None
             elif isinstance(valid_until, datetime):
                 parsed_valid_until = valid_until
        if parsed_valid_until:
             now = datetime.utcnow()
             if parsed_valid_until > now and status != "active":
                 db.user_status.update_one(
                     {"user_id": user_id},
                     {"$set": {"status": "active", "updated_at": now}}
                 )
                 return None

        # A. Chequeo de Estado
        if status != "active":
            # EXCEPCIÓN: Si es "pending", permitir Onboarding y Profile
            if status == "pending":
                allowed_pending_prefixes = [
                    '/onboarding', 
                    '/profile',
                    '/api/onboarding',
                    '/api/user', # Needed for saving profile/password
                    '/api/push', # Notifications
                    '/payment',
                    '/api/user/payments'
                ]
                if any(path.startswith(pre) for pre in allowed_pending_prefixes):
                    return None

            # Si NO es activo (y no cumplió excepción) -> BLOQUEAR
            return render_template("lock_screen.html", status=status), 403

        # B. Chequeo de Vigencia (si es active pero expiró)
        if valid_until:
             if isinstance(valid_until, str):
                 try:
                    valid_until = datetime.fromisoformat(valid_until)
                 except:
                    pass # Ignore parse error
             
             if isinstance(valid_until, datetime):
                 now = datetime.utcnow()
                 # Si la fecha de validez es anterior a ahora -> EXPIRADO
                 if valid_until < now:
                     # Actualizar estado a expired para persistencia (opcional, pero util)
                     db.user_status.update_one({"user_id": user_id}, {"$set": {"status": "expired"}})
                     return render_template("lock_screen.html", status="expired"), 403

    except Exception as e:
        print(f"Error in lock middleware: {e}")
        # En caso de error de DB, mejor no bloquear para no tumbar el sitio, o un error 500
        pass

    return None
