/**
 * food_exchanges.js
 * Maneja la búsqueda interactiva de intercambios alimentarios.
 */

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('foodSearchInput');
    const resultsContainer = document.getElementById('exchangeResults');
    const emptyState = document.getElementById('exchangeEmpty');
    const loadingState = document.getElementById('exchangeLoading');

    const suggestionsContainer = document.getElementById('foodSearchSuggestions');
    const baseFoodName = document.getElementById('baseFoodName');
    const baseFoodIcon = document.getElementById('baseFoodIcon');
    const baseFoodGroup = document.getElementById('baseFoodGroup');
    const baseQuantityInput = document.getElementById('baseQuantityInput');

    // --- nutritional data ---
    const NUTRIENT_DATA = [
        { id: "V", nutrients: { energy_kcal: 25, carbs_g: 4, protein_g: 2, fat_g: 0 }, aliases: ["v", "ver", "verdura", "verduras", "vegetal", "vegetales"] },
        { id: "F", nutrients: { energy_kcal: 60, carbs_g: 15, protein_g: 0, fat_g: 0 }, aliases: ["f", "fr", "fruta", "frutas"] },
        { id: "C_sg", nutrients: { energy_kcal: 70, carbs_g: 15, protein_g: 2, fat_g: 0 }, aliases: ["c", "cer sg", "cereales sg", "cereales sin grasa", "cereal sin grasa", "tubérculo", "tuberculo"] },
        { id: "C_cg", nutrients: { energy_kcal: 115, carbs_g: 15, protein_g: 2, fat_g: 5 }, aliases: ["cer cg", "cereales cg", "cereales con grasa", "cereal con grasa", "c.c.g", "c cg"] },
        { id: "Leg", nutrients: { energy_kcal: 120, carbs_g: 20, protein_g: 8, fat_g: 1 }, aliases: ["leg", "leguminosa", "leguminosas", "legumbre", "legumbres"] },
        { id: "AOA_MB", nutrients: { energy_kcal: 40, carbs_g: 0, protein_g: 7, fat_g: 1 }, aliases: ["aoamb", "aoa mb", "muy bajo aporte", "aoa muy bajo aporte", "origen animal muy bajo", "origen animal muy bajo aporte grasa", "aoa muy bajo aporte de grasa"] },
        { id: "AOA_B", nutrients: { energy_kcal: 55, carbs_g: 0, protein_g: 7, fat_g: 3 }, aliases: ["aoa b", "aoab", "bajo aporte", "aoa bajo aporte", "origen animal bajo", "origen animal bajo aporte grasa", "aoa bajo aporte de grasa"] },
        { id: "AOA_MOD", nutrients: { energy_kcal: 75, carbs_g: 0, protein_g: 7, fat_g: 5 }, aliases: ["aoa mod", "aoamod", "moderado aporte", "aoa moderado aporte", "origen animal moderado", "origen animal moderado aporte grasa", "aoa moderado aporte de grasa"] },
        { id: "AOA_A", nutrients: { energy_kcal: 100, carbs_g: 0, protein_g: 7, fat_g: 8 }, aliases: ["aoa a", "aoaa", "alto aporte", "aoa alto aporte", "origen animal alto", "origen animal alto aporte grasa", "aoa alto aporte de grasa"] },
        { id: "AyG_sp", nutrients: { energy_kcal: 45, carbs_g: 0, protein_g: 0, fat_g: 5 }, aliases: ["ayg s/p", "ayg sp", "grasas", "grasa", "aceites y grasas", "grasas sin proteina", "grasas sin proteína", "aceites y grasas sin proteína"] },
        { id: "AyG_cp", nutrients: { energy_kcal: 70, carbs_g: 3, protein_g: 3, fat_g: 5 }, aliases: ["ayg c/p", "ayg cp", "grasas con proteína", "grasas con proteina", "aceites y grasas con proteína"] },
        { id: "L_desc", nutrients: { energy_kcal: 95, carbs_g: 12, protein_g: 9, fat_g: 2 }, aliases: ["leche descremada", "l desc", "lacteo descremado", "lácteo descremado", "leche y sustitutos descremada"] },
        { id: "L_ent", nutrients: { energy_kcal: 150, carbs_g: 12, protein_g: 9, fat_g: 8 }, aliases: ["leche entera", "l ent", "lacteo entero", "lácteo entero", "leche y sustitutos entera"] },
        { id: "Az_sg", nutrients: { energy_kcal: 40, carbs_g: 10, protein_g: 0, fat_g: 0 }, aliases: ["azúcares", "azucar", "az sg", "azúcar", "azucares", "azúcar sin grasa"] },
        { id: "Az_cg", nutrients: { energy_kcal: 85, carbs_g: 10, protein_g: 0, fat_g: 5 }, aliases: ["az cg", "azúcar con grasa", "azucar con grasa", "azucares con grasa"] }
    ];

    function getNutrientsForGroup(groupName) {
        if (!groupName) return null;
        const normalized = groupName.toLowerCase().trim();
        // Intentar match exacto o parcial
        return NUTRIENT_DATA.find(g => g.aliases.some(alias => normalized === alias || normalized.includes(alias) || alias.includes(normalized)));
    }

    function formatNutrientInfo(nutrients, factor) {
        if (!nutrients || isNaN(factor)) return '';
        const kcal = Math.round(nutrients.energy_kcal * factor);
        const prot = (nutrients.protein_g * factor).toFixed(1).replace('.0', '');
        const fat = (nutrients.fat_g * factor).toFixed(1).replace('.0', '');
        const carbs = (nutrients.carbs_g * factor).toFixed(1).replace('.0', '');

        return `<i class="fas fa-fire-alt text-warning me-1"></i>${kcal} kcal <span class="text-secondary opacity-50 mx-1">|</span> <span class="text-light">P:${prot}</span> <span class="text-secondary opacity-50 mx-1">|</span> <span class="text-light">G:${fat}</span> <span class="text-secondary opacity-50 mx-1">|</span> <span class="text-light">C:${carbs}</span>`;
    }
    const baseUnitLabel = document.getElementById('baseUnitLabel');
    const baseOriginalAmount = document.getElementById('baseOriginalAmount');
    const equivalentsGrid = document.getElementById('equivalentsGrid');

    if (!searchInput) return;

    let debounceTimer;
    let currentData = null; // Guardar data actual para recalcular

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            hideSuggestions();
            resultsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            loadingState.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            performSearch(query);
        }, 400);
    });

    baseQuantityInput.addEventListener('input', () => {
        if (currentData) updateUI(currentData);
    });

    // Cerrar sugerencias si se hace click fuera
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            hideSuggestions();
        }
    });

    async function performSearch(query, exact = false) {
        if (!exact) {
            loadingState.style.display = 'block';
            emptyState.style.display = 'none';
        }

        try {
            const exactParam = exact ? '&exact=true' : '';
            const response = await fetch(`/api/nutrition/find-equivalents?q=${encodeURIComponent(query)}${exactParam}&_t=${Date.now()}`);
            const data = await response.json();

            if (response.ok) {
                if (data.multiple_matches) {
                    showSuggestions(data.matches);
                    loadingState.style.display = 'none';
                } else {
                    hideSuggestions();
                    currentData = data;

                    // Extraer solo la parte numérica para el input (ej. "1/3" de "1/3 pza")
                    const baseQtyStr = data.alimento_solicitado.cantidad || "";
                    const numericMatch = baseQtyStr.match(/^[\d\s\/]+/);
                    baseQuantityInput.value = numericMatch ? numericMatch[0].trim() : "1";

                    updateUI(data);
                }
            } else {
                hideSuggestions();
                showEmpty();
            }
        } catch (error) {
            console.error('Error al buscar equivalentes:', error);
            hideSuggestions();
            showEmpty();
        } finally {
            if (!exact) loadingState.style.display = 'none';
        }
    }

    function showSuggestions(matches) {
        suggestionsContainer.innerHTML = '';
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span class="suggestion-name">${match.nombre}</span>
                <span class="suggestion-group">${match.grupo}</span>
            `;
            div.addEventListener('click', () => {
                searchInput.value = match.nombre;
                hideSuggestions();
                performSearch(match.nombre, true);
            });
            suggestionsContainer.appendChild(div);
        });
        suggestionsContainer.style.display = 'block';
    }

    function hideSuggestions() {
        suggestionsContainer.style.display = 'none';
    }

    function updateUI(data) {
        const base = data.alimento_solicitado;
        const options = data.opciones_intercambio;

        const baseParsed = parseQuantity(base.cantidad);
        const userInputParsed = parseQuantity(baseQuantityInput.value);
        const userInput = userInputParsed.value;

        // El factor se basa en cuánto del "alimento estándar" está pidiendo el usuario
        const factor = baseParsed.value > 0 ? (userInput / baseParsed.value) : 1;

        // Actualizar Alimento Base
        baseFoodName.textContent = base.nombre;
        baseFoodGroup.textContent = base.grupo;
        baseOriginalAmount.textContent = base.cantidad;
        baseUnitLabel.textContent = baseParsed.unit;

        if (baseFoodIcon) {
            baseFoodIcon.textContent = getEmojiForType(base.grupo || base.tipo);
        }

        // Limpiar y llenar grid de equivalentes
        equivalentsGrid.innerHTML = '';

        if (options && options.length > 0) {
            options.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'equivalent-item';

                const emoji = getEmojiForType(opt.tipo || opt.grupo);
                const optParsed = parseQuantity(opt.cantidad);

                // Formatear medida original (default) de forma bonita (Referencia)
                const originalFormatted = formatDisplayValue(optParsed.value, false);

                // Calculamos el valor proporcional
                const calculatedValue = (optParsed.value * factor);
                // Formatear RESULTADO con redondeo práctico a .5 o entero
                const formattedCalc = formatDisplayValue(calculatedValue, true);

                // Obtener Info Nutricional Estimada
                // PRIORIDAD: Grupo > Tipo. AOA B está en grupo.
                let nutrients = getNutrientsForGroup(opt.grupo);
                if (!nutrients) nutrients = getNutrientsForGroup(opt.tipo);

                const nutrientInfoHtml = nutrients ?
                    `<div class="nutrient-info mt-2 pt-2 border-top border-light w-100 small d-flex justify-content-center align-items-center border-opacity-10" style="font-size: 0.75rem;">
                        <span class="me-1 opacity-75" style="font-size: 0.7rem;">Aprox:</span> ${formatNutrientInfo(nutrients.nutrients, factor)}
                    </div>` : '';

                item.innerHTML = `
                    <div class="equivalent-icon">${emoji}</div>
                    <div class="eq-amount">
                        ${originalFormatted} 
                        <span class="small opacity-75 ms-1">${optParsed.unit}</span>
                    </div>
                    <span class="eq-name">${opt.nombre}</span>
                    <div class="calculated-result">
                        <span class="calc-label">Tu medida</span>
                        <div class="calc-value">
                            ${formattedCalc} 
                            <span class="ms-1">${optParsed.unit}</span>
                        </div>
                    </div>
                    ${nutrientInfoHtml}
                `;
                equivalentsGrid.appendChild(item);
            });

            // --- Actualizar Nutrientes del Alimento Base ---
            const baseNutrients = getNutrientsForGroup(base.grupo) || getNutrientsForGroup(base.tipo);
            const baseNutrientInfoDiv = document.getElementById('baseNutrientInfo');
            const baseNutrientValuesDiv = document.getElementById('baseNutrientValues');

            if (baseNutrients && baseNutrientInfoDiv && baseNutrientValuesDiv) {
                baseNutrientInfoDiv.style.display = 'block';
                // Usamos formato diff para el base card (texto blanco)
                baseNutrientValuesDiv.innerHTML = formatNutrientInfo(baseNutrients.nutrients, factor, true);
            } else if (baseNutrientInfoDiv) {
                baseNutrientInfoDiv.style.display = 'none';
            }
        } else {
            equivalentsGrid.innerHTML = '<p class="text-muted small">No se encontraron intercambios directos.</p>';
        }

        resultsContainer.style.display = 'block';
        emptyState.style.display = 'none';
    }

    /**
     * Parsea una cadena de cantidad (ej. "1 1/2 taza", "30g", "1/3 pza")
     */
    function parseQuantity(str) {
        if (!str) return { value: 0, unit: '' };

        // Manejar formatos como "1/2 taza / 60g" -> tomamos el primero
        // Evitamos romper fracciones como "1/2" usando un split que requiera espacios alrededor de la barra
        const primary = str.split(/\s+\/\s+/)[0].trim();

        // Regex para extraer número (incluyendo espacios y fracciones) y unidad
        const match = primary.match(/^([\d\s\/\.,]+)?\s*(.*)$/);
        if (!match) return { value: 0, unit: primary };

        let numStr = (match[1] || "1").trim();
        let unit = (match[2] || "").trim();

        let val = 0;
        try {
            // Manejar fracciones mixtas "1 1/2"
            if (numStr.includes(' ')) {
                const parts = numStr.split(/\s+/);
                val = parseFloat(parts[0]);
                if (parts[1] && parts[1].includes('/')) {
                    const frac = parts[1].split('/');
                    val += parseFloat(frac[0]) / parseFloat(frac[1]);
                }
            } else if (numStr.includes('/')) {
                const frac = numStr.split('/');
                val = parseFloat(frac[0]) / parseFloat(frac[1]);
            } else {
                // Reemplazamos coma por punto para soporte de decimales europeos/latinos
                val = parseFloat(numStr.replace(',', '.'));
            }
        } catch (e) {
            val = 1;
        }

        return { value: isNaN(val) ? 0 : val, unit: unit };
    }

    /**
     * Formatea un valor decimal.
     * Si isResult es true, redondea al .5 o entero más cercano para practicidad.
     * Si isResult es false, usa el formato de fracciones bonitas para referencia.
     */
    function formatDisplayValue(val, isResult = false) {
        if (val === 0) return "0";

        if (isResult) {
            // Redondear al 0.5 más cercano (ej. 1.33 -> 1.5, 1.75 -> 2.0)
            const roundedValue = Math.round(val * 2) / 2;

            // Si es entero, mostrar sin decimales
            if (roundedValue % 1 === 0) return roundedValue.toString();

            // Si tiene .5, mostrar con un decimal
            return roundedValue.toFixed(1);
        }

        // --- Formato para Medidas de Referencia (Fracciones Bonitas) ---
        if (val % 1 === 0) return val.toString(); // Entero puro

        const whole = Math.floor(val);
        const decimal = val - whole;

        // Aproximar a fracciones comunes
        const fractions = [
            { n: 1, d: 8, v: 0.125 },
            { n: 1, d: 4, v: 0.25 },
            { n: 1, d: 3, v: 0.3333 },
            { n: 1, d: 2, v: 0.5 },
            { n: 2, d: 3, v: 0.6666 },
            { n: 3, d: 4, v: 0.75 }
        ];

        let bestFrac = null;
        for (const f of fractions) {
            if (Math.abs(decimal - f.v) < 0.03) {
                bestFrac = f;
                break;
            }
        }

        if (bestFrac) {
            const wholeHtml = whole > 0 ? `<span class="fraction-whole">${whole}</span>` : '';
            return `
                <div class="fraction-display">
                    ${wholeHtml}
                    <div class="fraction-part">
                        <span class="fraction-numerator">${bestFrac.n}</span>
                        <span class="fraction-denominator">${bestFrac.d}</span>
                    </div>
                </div>`;
        }

        // Si no es una fracción común, mostrar decimal redondeado
        return val.toFixed(1).replace(/\.0$/, '');
    }

    function showEmpty() {
        resultsContainer.style.display = 'none';
        emptyState.style.display = 'block';
    }

    function getEmojiForType(tipo) {
        if (!tipo) return '🍴';

        const t = tipo.toLowerCase();

        // Mapeo específico por prioridades
        if (t.includes('aoa') || t.includes('animal') || t.includes('carne') || t.includes('pollo')) return '🍗';
        if (t.includes('ver') || t === 'v' || t.startsWith('v ')) return '🥦';
        if (t.includes('fruta') || t === 'f' || t === 'fr' || t.startsWith('f ')) return '🍓';
        if (t.includes('cer') || t === 'c' || t.startsWith('c ')) return '🍞';
        if (t.includes('legum') || t.includes('frijol')) return '🫘';
        if (t.includes('lác') || t.includes('leche') || t === 'l') return '🥛';
        if (t.includes('gras') || t.includes('ayg') || t.includes('aceite')) return '🥑';
        if (t.includes('azú') || t.includes('postre')) return '🍰';

        return '🍴';
    }

    // --- nutritional data removed from bottom ---
});
