# Propuesta de Implementación MCP (Model Context Protocol)

Este plan describe cómo integrar un servidor MCP en el proyecto "Synapse Fit" para exponer sus funcionalidades (Base de datos y Agentes) a asistentes de IA externos (como Claude Desktop, IDEs, etc.).

## 🎯 Objetivo
Crear un servidor MCP local (`mcp_server.py`) que actúe como puente entre la lógica del backend existente y clientes MCP.

## 🏗 Arquitectura Propuesta

El servidor será un script de Python independiente que:
1.  **Carga configuración**: Reutiliza [config.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/config.py) y `.env`.
2.  **Conecta BD**: Inicializa `extensions.db` usando la lógica existente.
3.  **Define Herramientas (Tools)**: Expone funciones clave como herramientas MCP.

### Herramientas Candidatas

| Herramienta | Descripción | Argumentos |
| :--- | :--- | :--- |
| [get_user_profile](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/utils/db_helpers.py#63-85) | Obtiene datos completos del usuario (perfil, estado). | `user_id` |
| `get_user_routines` | Lista las rutinas asignadas al usuario. | `user_id` |
| `run_ai_agent` | Ejecuta uno de los agentes internos (Nutrition, Routine, Assessment). | `agent_name`, `context` |
| `get_workout_history` | Obtiene historial de sesiones de entrenamiento. | `user_id`, `limit` |

## 🛠 Cambios Necesarios

### 1. Nuevas Dependencias
Agregar `mcp` al entorno virtual:
```bash
pip install mcp
```

### 2. Nuevo Archivo `mcp_server.py`
Crear este archivo en la raíz del proyecto. Estructura básica:

```python
from mcp.server.fastmcp import FastMCP
import extensions
from config import Config
from flask import Flask

# 1. Inicializar App Context mínimo para reutilizar lógica de extensions.py
app = Flask(__name__)
app.config.from_object(Config)
extensions.init_db(app)

# 2. Definir Servidor MCP
mcp = FastMCP("Synapse Fit")

@mcp.tool()
def get_user_profile(user_id: str):
    """Obtiene perfil completo del usuario"""
    from utils.db_helpers import get_user_profile
    return get_user_profile(user_id)

@mcp.tool()
def run_ai_agent(agent_name: str, params: dict):
    """Ejecuta un agente de IA (meal_plan, body_assessment, routine)"""
    # Lógica para importar e instanciar el agente dinámicamente
    pass

if __name__ == "__main__":
    mcp.run()
```

### 3. Integración con Agentes
Los agentes en `ai_agents/` ya están desacoplados (reciben JSON/Dict y devuelven JSON/Dict), por lo que su integración es directa.

## ✅ Ventajas
- **Reutilización**: No duplicamos lógica de conexión a BD ni de agentes.
- **Interoperabilidad**: Permite interactuar con la DB y los agentes desde una interfaz de chat externa que soporte MCP.
- **Seguridad**: Se ejecuta localmente bajo las mismas credenciales que la app.

## 📝 Plan de Acción
1.  Instalar librería `mcp`.
2.  Crear `mcp_server.py` con 2-3 herramientas iniciales.
3.  Probar ejecución local.
4.  Documentar configuración para clientes (ej. claude_desktop_config.json).
