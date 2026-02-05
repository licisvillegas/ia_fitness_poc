# Guía de Configuración: Sincronización iOS (Atajos)

Sigue estos pasos para conectar Apple Health con Synapse Fit usando la app "Atajos" (Shortcuts) de tu iPhone.

## Requisitos
*   iPhone con iOS 14 o superior.
*   App "Atajos" instalada.
*   Tener tu `user_id` de Synapse Fit (lo puedes ver en tu Perfil o URL).

## Paso 1: Crear el Atajo

1.  Abre la app **Atajos** en tu iPhone.
2.  Toca **+** para crear uno nuevo.
3.  Ponle de nombre: `Sync Synapse Fit`.

## Paso 2: Obtener Datos de Salud

Agrega las siguientes acciones buscándolas en el menú inferior:

### Pasos (Steps)
1.  Busca la acción **"Buscar muestras de salud"** (Find Health Samples).
2.  Configura:
    *   Tipo: **Pasos** (Steps).
    *   Filtro: **La fecha es hoy** (Date is today).
    *   Ordenar por: Ninguno.
    *   Límite: Desactivado (recuperar todos).
    *   (Opcional: Puedes usar "Obtener detalles de Salud" para sumar el valor, pero enviaremos el crudo por ahora o el total del día). *Simplificación: Busca "Obtener detalles de muestras de salud" si quieres sumar, o dejémoslo simple.*
    *   **MEJOR OPCIÓN AUTOMÁTICA:** Usa la acción **"Obtener estado de salud actual"** (Get current health sample / steps) si está disponible, o simplemente usa buscar muestras.
    
    *Alternativa más robusta:*
    1.  Acción: **"Buscar muestras de salud"** -> Tipo: Pasos, Fecha: es hoy.
    2.  Acción: **"Calcular estadísticas"** (Calculate Statistics) -> Operación: Suma (Sum).

### Ritmo Cardíaco (Heart Rate)
1.  Acción: **"Buscar muestras de salud"**.
2.  Tipo: **Ritmo cardíaco**.
3.  Filtro: Fecha es hoy.
4.  Límite: Obtener último (Get 1 sample), Ordenar por: Fecha (Newest First).

## Paso 3: Construir el JSON

1.  Busca la acción **"Diccionario"** (Dictionary).
2.  Agrega las siguientes claves:
    *   **Clave:** `user_id` -> **Texto:** `TU_ID_DE_USUARIO_AQUI` (Ej: 65a...)
    *   **Clave:** `metrics` -> **Diccionario** (Nested Dictionary).
        *   Dentro de `metrics`, agrega:
            *   `steps`: Selecciona la **Variable Mágica** del resultado de la suma de pasos.
            *   `heart_rate`: Selecciona la **Variable Mágica** del valor de ritmo cardíaco.

## Paso 4: Enviar al Servidor

1.  Busca la acción **"Obtener contenido de URL"** (Get Contents of URL).
2.  Configura:
    *   **URL:** `http://TU_IP_LOCAL:5000/api/integrations/apple-health` (Si estás en la misma red Wi-Fi) o tu URL de producción (ngrok/deploy).
    *   **Método:** `POST`.
    *   **Encabezados:** Añadir nuevo -> `Content-Type`: `application/json`.
    *   **Cuerpo de la solicitud:** Selecciona **Archivo JSON** y elige la variable del **Diccionario** que creaste en el Paso 3.

## Paso 5: Prueba y Automatización

1.  Dale al botón "Play" (borde inferior derecho) para probar.
2.  Si sale un JSON de respuesta con `status: success`, ¡funciona!
3.  Ve a la pestaña **Automatización** en Atajos.
4.  Crea una "Automatización Personal":
    *   **Evento:** "Hora del día" (e.g., 22:00) o "Al cerrar una app" (e.g., Entrenamiento).
    *   **Acción:** Ejecutar atajo -> Selecciona `Sync Synapse Fit`.
    *   Desactiva "Preguntar antes de ejecutar".

¡Listo! Tu iPhone enviará tus datos automáticamente.
