"""
Middleware de autenticación y perfiles
"""
from flask import request, redirect
import extensions
from extensions import logger


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
    Context processor para inyectar el rol del usuario en todas las plantillas
    """
    user_id = request.cookies.get("user_session")
    user_role = "guest"
    
    if user_id and extensions.db is not None:
        try:
            role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
            if role_doc:
                user_role = role_doc.get("role", "user")
                logger.info(f"DEBUG ROLE: User {user_id} has role {user_role}")
            else:
                user_role = "user"
                logger.info(f"DEBUG ROLE: User {user_id} has no role doc, defaulting to user")
        except Exception as e:
            logger.error(f"Error checking role: {e}")
            pass
    elif extensions.db is None:
        logger.warning("DEBUG ROLE: DB is None in inject_user_role")
    
    return dict(current_user_role=user_role)
