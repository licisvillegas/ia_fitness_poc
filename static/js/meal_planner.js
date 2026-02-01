(function () {
    const msg = document.getElementById('nutriMsg');
    const btn = document.getElementById('btnGenMeals');
    const container = document.getElementById('mealsContainer');
    const btnSave = document.getElementById('btnSaveMealPlan');
    // if (!btn) return; // Permitir ejecución sin controles de admin

    // Oculta ejemplos estáticos del template original para evitar confusión
    function hideSampleCards() {
        try {
            const cards = document.querySelectorAll('.daily-plan .meal-card');
            cards.forEach(card => {
                if (!container.contains(card)) {
                    card.style.display = 'none';
                }
            });
        } catch (e) { /* ignore */ }
    }

    function resolveUserId(inputVal) {
        const typed = (inputVal || '').trim();
        try {
            const raw = localStorage.getItem('ai_fitness_user');
            if (raw) {
                const u = JSON.parse(raw);
                const loggedId = String(u.user_id || u._id || '').trim();
                const uname = (u.username || '').trim();
                const email = (u.email || '').trim().toLowerCase();
                if (!typed || typed === uname || typed.toLowerCase() === email) {
                    return loggedId || typed;
                }
            }
        } catch (e) { }
        return typed;
    }

    function renderMeals(data, showSave = true) {
        hideSampleCards();
        const out = data.output || {};

        // --- MULTI-OPTION LOGIC ---
        // Si hay 'options', renderizamos tabs y seleccionamos el primero por defecto
        const options = out.options || [];

        // Limpiamos el contenedor
        container.innerHTML = '';

        // Si hay opciones múltiples, creamos tabs
        if (options.length > 0) {
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'd-flex justify-content-center gap-2 mb-4';

            // Estado interno para saber cual está activo (pestaña)
            let activeIdx = 0;

            function renderTabs() {
                tabsContainer.innerHTML = '';
                options.forEach((opt, idx) => {
                    const btnTab = document.createElement('button');
                    btnTab.className = `btn btn-sm ${idx === activeIdx ? 'btn-primary' : 'btn-outline-primary'}`;
                    btnTab.textContent = opt.name || `Opoción ${idx + 1}`;
                    btnTab.onclick = () => {
                        activeIdx = idx;
                        renderTabs(); // Actualizar estilos botones
                        renderOptionContent(options[idx]); // Renderizar contenido
                    };
                    tabsContainer.appendChild(btnTab);
                });
            }

            container.appendChild(tabsContainer);
            renderTabs();
            renderOptionContent(options[0]); // Render inicial

            if (showSave) {
                btnSave.style.display = 'inline-block';
                // Al guardar, enviamos TODO el objeto data, que incluye options. 
                // El backend lo guardará tal cual.
                btnSave.dataset.payload = JSON.stringify(data);
            }

            // Función interna para renderizar el contenido de UNA opción
            function renderOptionContent(optData) {
                // Borrar contenido previo que NO sea el tabsContainer
                // Estrategia: limpiar todo lo que esté DESPUÉS del tabsContainer
                // O mejor: tener un sub-contenedor para las meals
                let contentBox = document.getElementById('mealsContentBox');
                if (!contentBox) {
                    contentBox = document.createElement('div');
                    contentBox.id = 'mealsContentBox';
                    container.appendChild(contentBox);
                } else {
                    contentBox.innerHTML = '';
                }

                const meals = optData.meals || [];
                let dailySumKcal = 0;

                // Render Summary (Total) Update
                const summaryTotalDiv = document.getElementById('nutritionPlanTotal');
                if (summaryTotalDiv) {
                    // Si la opción tiene total explícito, úsalo
                    const total = optData.total_kcal || optData.kcal;
                    summaryTotalDiv.innerHTML = `Total Opción: <strong>${total || '?'} kcal</strong>`;
                }
                const summaryContainer = document.getElementById('nutritionPlanSummary');
                if (summaryContainer) summaryContainer.style.display = 'flex';

                // Render Cards
                meals.forEach(m => {
                    const card = createMealCard(m);
                    contentBox.appendChild(card);
                    // Sumas para validación (opcional, ya que la opción trae sumas)
                });
            }
            return;
        }

        // --- SINGLE OPTION LEGACY LOGIC ---
        const meals = out.meals || [];
        let dailySumKcal = 0;

        const summaryContainer = document.getElementById('nutritionPlanSummary');
        const summaryTotalDiv = document.getElementById('nutritionPlanTotal');
        if (summaryContainer) summaryContainer.style.display = 'flex';

        meals.forEach(m => {
            const card = createMealCard(m);
            container.appendChild(card);

            // Calculo simple de total visual si no viene
            const displayKcal = (m.total_kcal != null) ? m.total_kcal : ((m.kcal != null && m.kcal !== '-') ? m.kcal : 0);
            dailySumKcal += Number(displayKcal || 0);
        });

        // Mostrar Total Diario
        const targetTotal = out.total_kcal;
        if (summaryTotalDiv) {
            summaryTotalDiv.innerHTML = `Total del día: <strong>${dailySumKcal} kcal</strong><br><span class="text-secondary small fw-normal">(Objetivo: ${targetTotal || '-'})</span>`;
        }

        const tips = out.tips || [];
        if (tips.length) {
            const tipsBox = document.createElement('div');
            tipsBox.className = 'mt-3 text-secondary';
            tipsBox.innerHTML = `<strong>Consejos:</strong> ${tips.join(' · ')}`;
            container.appendChild(tipsBox);
        }

        if (meals.length && showSave) { btnSave.style.display = 'inline-block'; btnSave.dataset.payload = JSON.stringify(data); }
    }

    // Extracted helper to avoid code duplication
    function createMealCard(m) {
        const card = document.createElement('div');
        card.className = 'meal-card';

        const header = document.createElement('div');
        header.className = 'meal-header';
        header.onclick = function () { toggleMealDetails(this); };

        const details = document.createElement('div'); details.className = 'meal-details'; details.style.display = 'none';
        const ul = document.createElement('ul'); ul.className = 'nutrition-list list-group list-group-flush';

        let mealKcalSum = 0;
        let mealP = 0, mealC = 0, mealF = 0;

        (m.items || []).forEach(it => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent';

            const iMacros = it.macros || {};
            const iP = Number(iMacros.p ?? iMacros.protein ?? 0);
            const iC = Number(iMacros.c ?? iMacros.carbs ?? 0);
            const iF = Number(iMacros.f ?? iMacros.fat ?? 0);
            const iKcal = Number(it.kcal || 0);

            mealKcalSum += iKcal;
            mealP += iP; mealC += iC; mealF += iF;

            li.innerHTML = `
            <div>
              <strong>${it.food || ''}</strong>
              <div class="text-muted small">${it.qty || ''}</div>
            </div>
            <div class="text-end small">
              <span class="text-primary">${iKcal} kcal</span>
              <div class="text-secondary" style="font-size:0.8rem">P:${iP} C:${iC} G:${iF}</div>
            </div>
          `;
            ul.appendChild(li);
        });

        const displayKcal = (m.total_kcal != null) ? m.total_kcal : ((m.kcal != null && m.kcal !== '-') ? m.kcal : mealKcalSum);
        const mac = m.macros || {};
        const valC = (mac.c ?? mac.carbs) != null ? (mac.c ?? mac.carbs) : mealC;
        const valP = (mac.p ?? mac.protein) != null ? (mac.p ?? mac.protein) : mealP;
        const valF = (mac.f ?? mac.fat) != null ? (mac.f ?? mac.fat) : mealF;

        const h = document.createElement('h4'); h.className = 'meal-title'; h.textContent = m.name || 'Comida';
        const span = document.createElement('span'); span.textContent = `Calorías totales: ${displayKcal} kcal`;
        const ico = document.createElement('i'); ico.className = 'fas fa-chevron-down';
        header.appendChild(h); header.appendChild(span); header.appendChild(ico);

        const p = document.createElement('div');
        p.className = 'p-3 border-top';
        p.innerHTML = `<i class="fas fa-chart-pie text-secondary me-2"></i>Macronutrientes: <strong>Carbohidratos ${valC}g</strong>, <strong>Proteína ${valP}g</strong>, <strong>Grasa ${valF}g</strong>`;

        details.appendChild(ul); details.appendChild(p);
        card.appendChild(header); card.appendChild(details);
        return card;
    }

    async function generate() {
        const userInput = document.getElementById('nutriUserId');
        const mealsSel = document.getElementById('nutriMeals');
        const prefs = document.getElementById('nutriPrefs').value.trim();
        const exclude = document.getElementById('nutriExclude').value.trim();
        const cuisine = document.getElementById('nutriCuisine').value.trim();
        const uid = resolveUserId(userInput ? userInput.value : '');
        if (!uid) { if (msg) msg.textContent = 'Ingresa un user_id'; return; }
        if (window.showLoader) window.showLoader("Generando plan de comidas...");
        btnSave.style.display = 'none';
        try {
            const params = new URLSearchParams();
            params.set('meals', mealsSel.value);
            if (prefs) params.set('prefs', prefs);
            if (exclude) params.set('exclude', exclude);
            if (cuisine) params.set('cuisine', cuisine);
            const resp = await fetch(`/ai/nutrition/plan/${encodeURIComponent(uid)}?${params.toString()}`);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: 'Error desconocido' }));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const data = await resp.json();
            renderMeals(data, true);
            msg.textContent = '';
        } catch (e) {
            if (msg) msg.textContent = `No se pudo generar el plan: ${e.message}`;
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    }

    if (btn) btn.addEventListener('click', generate);
    if (btnSave) btnSave.addEventListener('click', async () => {
        const payloadStr = btnSave.dataset.payload || '';
        if (!payloadStr) { return; }
        if (window.showLoader) window.showLoader("Guardando y activando plan...");
        try {
            const data = JSON.parse(payloadStr);
            const saveBody = { user_id: data.input?.user_id, backend: data.backend, input: data.input, output: data.output };
            const resp = await fetch('/meal_plans/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveBody) });
            if (!resp.ok) { const err = await resp.json().catch(() => ({ error: 'Error desconocido' })); throw new Error(err.error || `HTTP ${resp.status}`); }
            const resj = await resp.json();
            msg.textContent = 'Plan de nutricion guardado y activado';
            btnSave.style.display = 'none';
        } catch (e) {
            msg.textContent = `No se pudo guardar el plan: ${e.message}`;
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    });

    async function loadActive() {
        try {
            const userInput = document.getElementById('nutriUserId');
            const hidden = document.getElementById('current_user_id');
            let rawVal = '';
            if (userInput && userInput.value.trim()) rawVal = userInput.value;
            else if (hidden && hidden.value.trim()) rawVal = hidden.value;

            const uid = resolveUserId(rawVal);
            if (!uid) {
                if (msg) msg.textContent = 'Ingresa un user_id';
                return;
            }
            if (window.showLoader) window.showLoader("Cargando plan activo...");
            const resp = await fetch(`/meal_plans/${encodeURIComponent(uid)}/active`);
            if (!resp.ok) {
                if (msg) msg.textContent = 'No cuenta con plan de nutrición activo';
                container.innerHTML = '';
                if (btnSave) btnSave.style.display = 'none';
                // Ocultar resumen si no hay plan
                const s = document.getElementById('nutritionPlanSummary');
                if (s) s.style.display = 'none';
                return;
            }
            const doc = await resp.json();
            renderMeals({ backend: doc.backend, input: doc.input, output: doc.output }, false);
            if (msg) msg.textContent = 'Plan de nutrición activo cargado';
        } catch (e) {
            if (msg) msg.textContent = `Error al cargar plan activo: ${e.message}`;
        } finally {
            if (window.hideLoader) window.hideLoader();
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        hideSampleCards();
        try {
            const raw = localStorage.getItem('ai_fitness_user');
            if (raw) {
                const u = JSON.parse(raw);
                const display = (u.username || '').trim();
                const userIdInput = document.getElementById('nutriUserId');
                if (display && userIdInput) { userIdInput.value = display; }
            }
        } catch (e) { }
        loadActive();
    });
})();
