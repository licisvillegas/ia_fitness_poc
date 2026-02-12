# ======================================================
# Configuración central de Swagger / OpenAPI 3.0
# Para uso con Flasgger en Synapse Fit
# ======================================================

SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: rule.rule.startswith("/api") or rule.rule.startswith("/auth") or rule.rule == "/health",
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
    "auth": {},  # Evita "None is not defined" en JS (template usa config.get('auth'))
    "openapi": "3.0.3", # Importante para evitar swager: 2.0 automatico
}

SWAGGER_TEMPLATE = {
    "openapi": "3.0.3",
    "info": {
        "title": "Synapse Fit API",
        "description": (
            "API REST de **Synapse Fit** — plataforma de fitness con IA.\n\n"
            "### Autenticación\n"
            "La mayoría de endpoints requieren una cookie `user_session` (obtenida vía `/auth/login`).\n"
            "Los endpoints admin requieren cookie `admin_token` (obtenida vía `/auth/admin/login`).\n\n"
            "### Categorías\n"
            "- **Auth**: Registro, login y administración de sesiones\n"
            "- **User**: Perfil, métricas y body assessments\n"
            "- **Routines**: Generación IA, guardado y catálogo de rutinas\n"
            "- **Exercises**: Catálogo de ejercicios\n"
            "- **Notifications**: Sistema de notificaciones\n"
            "- **Admin**: Gestión de usuarios, perfiles y asignaciones\n"
            "- **System**: Health check y status\n"
        ),
        "version": "1.0.0",
        "contact": {
            "name": "Synapse Fit Team",
            "url": "https://github.com/licisvillegas/ia_fitness_poc",
        },
    },
    "tags": [
        {"name": "System", "description": "Health check y status del sistema"},
        {"name": "Auth", "description": "Registro, login y sesiones"},
        {"name": "User", "description": "Perfil de usuario, métricas y body assessment"},
        {"name": "Routines", "description": "Generación IA, guardado y catálogo de rutinas"},
        {"name": "Exercises", "description": "Catálogo y gestión de ejercicios"},
        {"name": "Notifications", "description": "Sistema de notificaciones"},
        {"name": "Admin", "description": "Gestión administrativa de usuarios y asignaciones"},
        {"name": "Push", "description": "Web Push notifications"},
    ],
    "components": {
        "securitySchemes": {
            "cookieAuth": {
                "type": "apiKey",
                "in": "cookie",
                "name": "user_session",
                "description": "Cookie de sesión de usuario",
            },
            "adminAuth": {
                "type": "apiKey",
                "in": "cookie",
                "name": "admin_token",
                "description": "Cookie de token de administrador",
            },
        },
        "schemas": {
            "Error": {
                "type": "object",
                "properties": {
                    "error": {"type": "string", "description": "Mensaje de error"},
                },
            },
            "Success": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Mensaje de éxito"},
                },
            },
        },
    },
}
