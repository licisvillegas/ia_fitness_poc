"""
Middleware de autenticación y perfiles
"""
from flask import request, redirect
import extensions
from extensions import logger
from utils.cache import cache_get, cache_set

_USER_CTX_TTL_SEC = 60


def check_user_profile():
    """
    Middleware to ensure logged-in users have a profile.
    If not, redirects them to /profile to complete it.
    Excludes static files, auth routes, and admin routes.
    """
    if request.endpoint and "static" in request.endpoint:
        return
    
    # Exclude auth and API routes from redirection loop
    if request.path.startswith("/api/") or \
       request.path.startswith("/login") or \
       request.path.startswith("/logout") or \
       request.path.startswith("/register") or \
       request.path.startswith("/admin") or \
       request.path == "/":
        return
    
    user_id = request.cookies.get("user_session")
    if not user_id:
        return
    
    # If already on profile page, allow access
    if request.path == "/profile":
        return
    
    # Check if user has profile
    if extensions.db is not None:
        try:
            profile = extensions.db.user_profiles.find_one({"user_id": user_id})
            if not profile:
                # User logged in but no profile -> Force redirect
                return redirect("/profile")
        except Exception as e:
            logger.error(f"Error checking profile middleware: {e}")
            pass


def inject_user_role():
    """
    Context processor para inyectar el rol del usuario y datos básicos (user_data) en todas las plantillas.
    Esto asegura que la sidebar muestre la imagen de perfil inmediatamente.
    """
    user_id = request.cookies.get("user_session")
    user_role = "guest"
    user_data = None
    
    if user_id and extensions.db is not None:
        cache_key = f"user_ctx:{user_id}"
        cached = cache_get(cache_key)
        if cached:
            return cached
        try:
            # 1. Fetch User Role
            role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
            if role_doc:
                user_role = role_doc.get("role", "user")
            else:
                user_role = "user"
            
            # 2. Fetch User Basic Data (Name, Username)
            user_doc = extensions.db.users.find_one({"user_id": user_id})
            
            # 3. Fetch User Profile (Image)
            profile_doc = extensions.db.user_profiles.find_one({"user_id": user_id})
            
            if user_doc or profile_doc:
                user_data = {
                    "user_id": user_id,
                    "name": user_doc.get("name") if user_doc else None,
                    "username": user_doc.get("username") if user_doc else None,
                    "email": user_doc.get("email") if user_doc else None,
                    "profile_image_url": profile_doc.get("profile_image_url") if profile_doc else None
                }
                
        except Exception as e:
            logger.error(f"Error checking role/profile context: {e}")
            pass
    
    # Check admin context
    is_impersonating = bool(request.cookies.get("admin_origin_session"))
    from utils.auth_helpers import get_admin_token
    real_token = get_admin_token()
    token_cookie = request.cookies.get("admin_token")
    has_admin_token = bool(token_cookie and token_cookie == real_token)

    payload = dict(
        current_user_role=user_role,
        user_data=user_data,
        is_impersonating=is_impersonating,
        has_admin_token=has_admin_token
    )
    if user_id and extensions.db is not None:
        cache_set(cache_key, payload, _USER_CTX_TTL_SEC)
    return payload


def check_workout_lock():
    """
    Middleware to lock the user into the active workout if one exists.
    Redirects any navigation to /workout/run/<id>.
    Excludes: static, auth, admin, and API calls.
    """
    if request.endpoint and "static" in request.endpoint:
        return

    # Exclude basic paths
    if request.path.startswith("/auth") or \
       request.path.startswith("/admin") or \
       request.path.startswith("/static"):
        return
        
    # Exclude ALL APIs (Global + Workout)
    if "/api/" in request.path:
        return
        
    user_id = request.cookies.get("user_session")
    if not user_id:
        return

    if extensions.db is not None:
        try:
            # Check if user has active_routine_id
            user = extensions.db.users.find_one({"user_id": user_id}, {"active_routine_id": 1})
            if user and user.get("active_routine_id"):
                active_id = user.get("active_routine_id")
                target_url = f"/workout/run/{active_id}"
                
                # If already on the target page, allowed
                if request.path == target_url:
                    return
                
                # Otherwise redirect
                logger.info(f"REDIRECT LOCK: User {user_id} locked to {target_url}")
                return redirect(target_url)
        except Exception as e:
            logger.error(f"Error checking workout lock: {e}")
            pass
