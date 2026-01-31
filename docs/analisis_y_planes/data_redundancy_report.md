# Análisis de Redundancia y Relaciones de Datos

Este reporte identifica las duplicidades y oportunidades de sincronización de datos detectadas entre las colecciones de MongoDB.

## 1. Disponibilidad y Frecuencia (Confirmado)
*   **Origen:** `onboarding_submissions.data.days_available` (Número, 1-7)
*   **Destinos:**
    *   `user_preferences.target_frequency`: Preferencia explícita del usuario.
    *   `plans.training_plan.days_per_week`: Configuración activa del plan generado.
*   **Oportunidad:** El onboarding debería inicializar ambos campos para que el plan generado sea consistente con la disponibilidad del usuario.

## 2. Objetivo de Entrenamiento (Alta Redundancia)
*   **Origen:** `onboarding_submissions.data.fitness_goal` ("fat_loss", "muscle_gain", etc.)
*   **Destinos:**
    *   `plans.goal`: El objetivo que rige el plan actual.
    *   `body_assessments.input.goal`: Dato guardado con cada evaluación corporal.
*   **Oportunidad:** `plans.goal` debería heredar directamente del onboarding. `body_assessments` parece duplicar este dato en cada registro (snapshot histórico), lo cual es aceptable, pero la entrada por defecto debería venir del perfil.

## 3. Nivel de Actividad
*   **Origen:** `onboarding_submissions.data.activity_level`
*   **Destino:** `body_assessments.input.activity_level`
*   **Análisis:** `body_assessments` usa este dato para calcular TDEE (Gasto Energético Diario). Actualmente parece que el usuario debe volver a ingresarlo o se selecciona manualmente. Debería pre-llenarse desde el onboarding.

## 4. Datos Demográficos y Físicos
*   **Edad:**
    *   `user_profiles.birth_date`: Fuente de verdad (calculable).
    *   `body_assessments.input.age`: Valor estático guardado. Redundante pero útil como histórico.
*   **Sexo:**
    *   `user_profiles.sex`
    *   `body_assessments.input.sex`
*   **Peso/Altura:**
    *   `onboarding_submissions`: No parece capturar estos datos explícitamente en el primer nivel (según schema detectado).
    *   `body_assessments.input.measurements`: Fuente principal de estos datos (`weight_kg`, `height_cm`).

## 5. Nutrición
*   **Origen:** `onboarding_submissions.data.meals_per_day`
*   **Destino:** `plans.nutrition_plan` (Implícito en la estructura).
*   **Origen:** `onboarding_submissions.data.allergies_intolerances` / `disliked_foods`
*   **Destino:** No se observó un campo explícito en `plans` o `user_preferences` para esto, sugiriendo que estos datos ricos del onboarding podrían estar subutilizados o solo se usan al momento de generar el plan.

## Resumen de Oportunidades de "Herencia Única"
Para mejorar la UX y coherencia de datos sin requerir sincronización bidireccional compleja, se recomienda:
1.  **Onboarding -> User Preferences**: `days_available` -> `target_frequency`.
2.  **Onboarding -> Plan Generation**: Usar `fitness_goal`, `days_available`, `activity_level` directamente para crear el documento `plans`.
3.  **User Profile -> Body Assessment**: Pre-llenar `age`, `sex` desde el perfil al crear una nueva evaluación.
