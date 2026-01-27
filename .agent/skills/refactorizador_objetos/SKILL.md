---
name: refactorizador_objetos
description: Skill para refactorizar objetos, modularizar código, identificar componentes reutilizables y asegurar documentación clara en español con codificación UTF-8.
---

# Skill de Refactorización de Objetos

Este skill proporciona directrices y pasos específicos para la refactorización de objetos y la modularización de código dentro del proyecto. Su objetivo es mejorar la mantenibilidad, legibilidad y reutilización del código, asegurando que todos los comentarios y documentación se mantengan en español y utilicen codificación UTF-8.

## Directrices Principales

1.  **Modularización**:
    *   Divide objetos grandes o clases complejas en componentes más pequeños y manejables.
    *   Sigue el principio de responsabilidad única (SRP).
    *   Si una función o método supera las 50 líneas, evalúa su división.

2.  **Identificación de Componentes Reutilizables**:
    *   Busca patrones comunes que puedan extraerse a utilidades (`utils/`) o componentes compartidos.
    *   Prefiere la composición sobre la herencia cuando sea posible.

3.  **Documentación y Comentarios**:
    *   **Idioma**: Todo el contenido debe estar en **Español**.
    *   **Claridad**: Explica el *porqué* además del *qué*.
    *   **Docstrings**: Utiliza el formato estándar del lenguaje (ej. PEP 257 para Python) pero redactado en español.
    *   **Codificación**: Asegura que el archivo se guarde en **UTF-8** para soportar tildes y caracteres especiales.

4.  **Estándares de Código**:
    *   Nombres de variables y funciones descriptivos en español (o inglés si es el estándar del proyecto, pero prioriza la consistencia con el código existente).
    *   Elimina código muerto o comentado que ya no sea necesario.

## Proceso de Refactorización

Cuando se te pida refactorizar un objeto:
1.  **Análisis**: Identifica las responsabilidades actuales del objeto.
2.  **Propuesta**: Antes de cambiar código, propone una estructura modular (puede ser en un plan de implementación).
3.  **Ejecución**: 
    *   Extrae lógica a nuevos módulos/archivos si es necesario.
    *   Actualiza las referencias e importaciones.
    *   Agrega comentarios detallados en español.
4.  **Verificación**: Asegura que la funcionalidad original se mantenga intacta.

## Ejemplo de Comentarios (UTF-8)

```python
def calcular_promedio_fitness(datos_usuario):
    """
    Calcula el promedio de rendimiento basado en los datos del usuario.
    
    Args:
        datos_usuario (dict): Diccionario con las métricas de entrenamiento.
        
    Returns:
        float: El promedio calculado.
    """
    # Lógica de cálculo...
    pass
```
