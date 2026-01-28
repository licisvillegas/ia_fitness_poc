# Documentación de Agentes de IA - IA Fitness POC

Este documento describe los agentes de inteligencia artificial implementados en el proyecto, sus responsabilidades y cómo se configuran.

## ⚙️ Configuración General
El sistema central de configuración se encuentra en:
- **Archivo**: [ai_agents/ai_config.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/ai_config.py)

### Variables de Entorno Principales
| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `AI_PROVIDER` | Define el proveedor de IA ([openai](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/reasoning_agent.py#151-195), [gemini](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/body_assessment_agent.py#443-463), [mock](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/meal_plan_agent.py#154-227)). | [openai](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/reasoning_agent.py#151-195) |
| `OPENAI_API_KEY` | Clave API para OpenAI (requerida si provider es [openai](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/reasoning_agent.py#151-195)). | - |
| `OPENAI_MODEL` | Modelo de OpenAI a utilizar (ej. `gpt-4o`). | `gpt-4o` |
| `GEMINI_API_KEY` | Clave API para Google Gemini. | - |
| `GEMINI_MODEL` | Modelo de Gemini a utilizar. | `gemini-1.5-flash` |

---

## 🤖 Agentes Disponibles

### 1. BodyAssessmentAgent
*Agente de Evaluación Corporal*
- **Archivo**: [ai_agents/body_assessment_agent.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/body_assessment_agent.py)
- **Función**: 
  - Calcula composición corporal (grasa, masa magra, músculo) usando fórmulas antropométricas (Marina EE.UU.).
  - Analiza proporciones físicas (cintura-altura, simetría).
  - Genera feedback cualitativo sobre fotos del usuario (si se proporcionan y hay API Key).
  - Incluye un fallback "Mock" robusto que realiza los cálculos matemáticos sin necesidad de IA.
- **Configuración Específica**:
  - [build_body_assessment_prompt](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/body_assessment_agent.py#24-155): Función interna que define el prompt del sistema.
  - Soporta modo **Vision/Multimodal** (análisis de imágenes).

### 2. MealPlanAgent
*Agente de Planificación Nutricional*
- **Archivo**: [ai_agents/meal_plan_agent.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/meal_plan_agent.py)
- **Función**:
  - Genera planes de alimentación detallados.
  - Desglosa macronutrientes (proteína, carbohidratos, grasas) y calorías por cada ingrediente.
  - **Modo Mock V3**: Incluye una base de datos local (`MOCK_DB_V3`) para generar dietas matemáticamente precisas sin usar tokens de IA.
- **Configuración Específica**:
  - [build_meal_prompt](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/meal_plan_agent.py#69-94): Define la estructura JSON estricta requerida.
  - `MOCK_DB_V3`: Diccionario interno con valores nutricionales de alimentos comunes para el modo offline.

### 3. ReasoningAgent
*Agente de Razonamiento y Coaching*
- **Archivo**: [ai_agents/reasoning_agent.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/reasoning_agent.py)
- **Función**:
  - Coach estratégico. Analiza el historial de progreso (peso, adherencia, rendimiento).
  - Detecta estancamientos o fatiga y sugiere ajustes concretos (kcal, volumen de entreno, cardio).
  - Decide la fecha de la próxima revisión.
  - El modo Mock implementa una lógica heurística basada en reglas (ej. "si el rendimiento baja, reduce volumen").
- **Configuración Específica**:
  - [build_reasoning_prompt](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/reasoning_agent.py#26-55): Prompt enfocado en análisis de tendencias.

### 4. RoutineAgent
*Agente Generador de Rutinas (LLM)*
- **Archivo**: [ai_agents/routine_agent.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent.py)
- **Función**:
  - Genera rutinas de entrenamiento completas (JSON) usando Modelos de Lenguaje (LLM).
  - Diseña la rutina desde cero basándose en principios de periodización descritos en el prompt.
  - **Uso**: Endpoint `/api/generate_routine`.
- **Configuración Específica**:
  - [build_routine_prompt](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent.py#22-84): Prompt extenso con reglas de biomecánica y periodización (fuerza, hipertrofia, etc.).

### 5. MongoRoutineAgent
*Agente Generador de Rutinas (Algorítmico/Híbrido)*
- **Archivo**: [ai_agents/routine_agent_mongo.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent_mongo.py)
- **Función**:
  - Genera rutinas seleccionando ejercicios reales existentes en la base de datos MongoDB local.
  - No depende (principalmente) de LLMs; usa lógica algorítmica para armar "splits" (distribuciones) y seleccionar ejercicios según filtros de equipo y grupo muscular.
  - Asegura que los ejercicios sugeridos existan en la DB del usuario.
  - **Uso**: Endpoint `/api/generate_routine_mongo`.
- **Configuración Específica**:
  - [_split_plan](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent_mongo.py#34-69): Define la estructura de días (ej. Push/Pull/Legs) según la frecuencia elegida.
  - [_goal_defaults](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent_mongo.py#71-77): Define series/reps según el objetivo (Fuerza vs Hipertrofia).

## 🔗 Integración
Los agentes se exponen principalmente a través de rutas en `routes/`:
- [routes/ai_body_assessment.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/routes/ai_body_assessment.py) -> Usa [BodyAssessmentAgent](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/body_assessment_agent.py#157-933)
- [routes/nutrition.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/routes/nutrition.py) (o similar) -> Usa [MealPlanAgent](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/meal_plan_agent.py#95-313)
- [routes/ai_reasoning.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/routes/ai_reasoning.py) -> Usa [ReasoningAgent](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/reasoning_agent.py#57-325)
- [routes/ai_routines.py](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/routes/ai_routines.py) -> Usa tanto [RoutineAgent](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent.py#85-190) como [MongoRoutineAgent](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/ai_agents/routine_agent_mongo.py#79-330)
