---
name: creador_objetos
description: Skill para crear nuevos objetos y componentes siguiendo convenciones de modularidad, coherencia temática y documentación en español con UTF-8.
---

# Skill de Creación de Objetos

Este skill guía al agente en la creación de nuevos componentes, módulos y objetos dentro del proyecto, asegurando que se integren de forma cohesiva y sigan los estándares establecidos.

## Directrices de Creación

1.  **Ubicación y Estructura**:
    *   **Componentes UI**: Colocar fragmentos HTML en `templates/components/`.
    *   **Estilos**: Agregar CSS específico en `static/css/` (preferiblemente archivos modulares como `dashboard.css`).
    *   **Lógica JS**: Colocar archivos JavaScript en `static/js/`.
    *   **Backend**: Crear rutas en `routes/` usando `Flask Blueprint`.

2.  **Coherencia Temática y Contraste**:
    *   Utilizar **siempre** las variables de `static/css/theme.css` (ej: `var(--bg-card)`, `var(--primary)`).
    *   Asegurar que los nuevos elementos tengan un contraste adecuado tanto en modo claro como oscuro.
    *   Mantener el estilo "premium" con bordes redondeados (`border-radius: 12px` o `15px`) y transiciones suaves.

3.  **Modularización**:
    *   Si el nuevo objeto contiene lógica compleja, separarla en un archivo `.js` o `.py` dedicado.
    *   Identificar partes que puedan ser reutilizadas por otros componentes y extraerlas a `utils/` o componentes genéricos.

4.  **Documentación e Idioma**:
    *   **Idioma**: Todo el texto visible para el usuario, placeholders, mensajes de error y comentarios de código deben estar en **Español**.
    *   **Comentarios**: Explicar la funcionalidad de componentes complejos.
    *   **Codificación**: Guardar archivos obligatoriamente en **UTF-8**.

## Checklist de Validación Post-Creación

Antes de dar por terminada la creación de un objeto, verifica:
- [ ] ¿El archivo tiene codificación UTF-8?
- [ ] ¿Los nombres siguen la convención del proyecto (`snake_case` para archivos, `camelCase` para JS)?
- [ ] ¿Se han utilizado las variables de `theme.css`?
- [ ] ¿Toda la documentación y comentarios están en español?
- [ ] ¿Se ha registrado la nueva ruta o componente en los archivos principales (ej: `app.py`)?

## Ejemplos de Estructura Coherente

### Componente HTML
```html
<div class="card bg-card border-theme" style="border-radius: 12px;">
    <div class="card-body">
        <h5 class="text-primary">Título en Español</h5>
        <p class="text-secondary">Descripción clara del componente.</p>
    </div>
</div>
```

### Script JavaScript
```javascript
/**
 * Inicializa el nuevo componente de ejemplo.
 * Codificación: UTF-8
 */
function inicializarNuevoComponente() {
    // Lógica en español...
}
```
