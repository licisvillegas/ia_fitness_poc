from functools import wraps
from flask import request, jsonify
from pydantic import ValidationError, BaseModel
from typing import Type, TypeVar, Any

T = TypeVar('T', bound=BaseModel)

def validate_request(schema: Type[T]):
    """
    Decorador para validar el cuerpo de una petición JSON usando Pydantic.
    
    Si la validación tiene éxito, inyecta la instancia del esquema validado
    en `request.validated_data`.
    Si falla, retorna un 400 Bad Request con los detalles del error.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                if request.method == "GET":
                    # Para GET, validamos los query parameters
                    payload = request.args.to_dict()
                else:
                    if not request.is_json:
                        return jsonify({
                            "error": "Content-Type must be application/json",
                            "code": "invalid_content_type"
                        }), 415
                    payload = request.get_json()
                
                # Validar y parsear el payload
                validated_data = schema.model_validate(payload)
                
                # Inyectar datos validados en el objeto request
                request.validated_data = validated_data
                
                return f(*args, **kwargs)
            
            except ValidationError as e:
                # Formatear errores de Pydantic para la respuesta API
                return jsonify({
                    "error": "Validation failed",
                    "code": "validation_error",
                    "details": e.errors(include_url=False, include_context=False)
                }), 400
            
            except Exception as e:
                return jsonify({
                    "error": "An unexpected error occurred during validation",
                    "code": "internal_validation_error",
                    "message": str(e)
                }), 500
                
        return wrapper
    return decorator
