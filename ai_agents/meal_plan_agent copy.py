"""
Agente de planificación de comidas (nutrition plan) para IA Fitness - V3.

Mejoras v3:
- Desglose granular: Cada alimento tiene sus propias Kcal y Macros (P/C/F) explícitos.
- Cálculo inverso en Mock: Calcula gramos de comida basados en requerimientos y devuelve la data exacta.
- Estructura JSON reforzada para visualización detallada.
"""

from __future__ import annotations

import os
import json
import logging
import random
from typing import Any, Dict, Optional, List

# Logger configuration
logger = logging.getLogger("ai_fitness")

# --- BASE DE DATOS HEURÍSTICA CON VALORES NUTRICIONALES (por 100g aprox) ---
# Usada para calcular gramos y macros en el modo Mock
MOCK_DB_V3 = {
    "proteins": {
        "breakfast": [
            {"name": "Claras de huevo", "p": 11, "c": 1, "f": 0},
            {"name": "Huevos enteros", "p": 13, "c": 1, "f": 11},
            {"name": "Yogur Griego 0%", "p": 10, "c": 4, "f": 0},
        ],
        "main": [
            {"name": "Pechuga de pollo", "p": 23, "c": 0, "f": 1}, # Cocido/Plancha
            {"name": "Ternera magra", "p": 20, "c": 0, "f": 5},
            {"name": "Pescado blanco (Merluza/Bacalao)", "p": 18, "c": 0, "f": 1},
            {"name": "Lata de Atún al natural", "p": 24, "c": 0, "f": 1},
            {"name": "Tofu firme", "p": 15, "c": 2, "f": 8},
        ],
        "snack": [
            {"name": "Batido de Whey Protein", "p": 80, "c": 5, "f": 2}, # Por 100g de polvo (se ajustará la dosis)
            {"name": "Queso fresco batido", "p": 8, "c": 4, "f": 0},
            {"name": "Pavo en lonchas", "p": 19, "c": 1, "f": 2},
        ]
    },
    "carbs": {
        "breakfast": [
            {"name": "Avena en copos", "p": 13, "c": 60, "f": 7},
            {"name": "Pan integral", "p": 9, "c": 45, "f": 3},
            {"name": "Fruta (Plátano/Manzana)", "p": 1, "c": 22, "f": 0},
        ],
        "main": [
            {"name": "Arroz blanco/basmati (peso en seco)", "p": 7, "c": 78, "f": 1},
            {"name": "Pasta integral (peso en seco)", "p": 12, "c": 70, "f": 2},
            {"name": "Patata asada/cocida", "p": 2, "c": 17, "f": 0},
            {"name": "Boniato", "p": 2, "c": 20, "f": 0},
            {"name": "Quinoa", "p": 14, "c": 64, "f": 6},
        ],
        "snack": [
            {"name": "Tortitas de arroz/maíz", "p": 8, "c": 80, "f": 2},
            {"name": "Fruta variada", "p": 1, "c": 15, "f": 0},
        ]
    },
    "fats": [
        {"name": "Aceite de Oliva Virgen Extra", "p": 0, "c": 0, "f": 100},
        {"name": "Aguacate", "p": 2, "c": 9, "f": 15},
        {"name": "Nueces/Almendras", "p": 20, "c": 10, "f": 50},
        {"name": "Crema de Cacahuete", "p": 25, "c": 20, "f": 50},
    ]
}

def build_meal_prompt(context_json: str) -> str:
    return f"""
SYSTEM: Eres un nutricionista deportivo de precisión.
Objetivo: Generar un plan de comidas donde CADA INGREDIENTE tenga sus calorías y macros desglosados.

REGLAS DE FORMATO (JSON ESTRICTO):
1. Devuelve SOLO JSON.
2. Estructura `items` obligatoria para cada comida:
   "items": [
      {{
         "food": "Nombre del alimento",
         "qty": "Cantidad (ej. 150g, 2 rebanadas)",
         "kcal": int (Calorías DE ESTE alimento),
         "macros": {{ "p": int, "c": int, "f": int }} (Gramos de Prot/Carb/Grasa DE ESTE alimento)
      }}
   ]

REGLAS NUTRICIONALES:
- Prioriza proteína en desayuno, comida y cena.
- Los snacks deben ser sencillos.
- Asegura que la suma de kcal de los items coincida con el total de la comida.

CONTEXTO DEL USUARIO:
{context_json}
"""

class MealPlanAgent:
    def __init__(self, model: Optional[str] = None) -> None:
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.init_error = None

        self._use_openai = bool(self.api_key)
        if self._use_openai:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
                logger.info(f"MealPlanAgent initialized with OpenAI model: {self.model}")
            except Exception as e:
                self.init_error = str(e)
                logger.error(f"Failed to initialize OpenAI: {e}")
                self._use_openai = False
                self._client = None
        else:
            logger.warning("MealPlanAgent: No API Key. Running in GRANULAR MOCK mode.")
            self._client = None

    def backend(self) -> str:
        return f"openai:{self.model}" if self._use_openai else "mock"

    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[AgentRun] Start. Backend: {self.backend()}")
        
        # Validación y defaults
        context.setdefault("total_kcal", 2000)
        context.setdefault("meals", 4)
        
        context_str = json.dumps(context, ensure_ascii=False)
        prompt = build_meal_prompt(context_str)

        if self._use_openai:
            try:
                return self._run_openai(prompt)
            except Exception as e:
                logger.error(f"OpenAI Error: {e}. Falling back to mock.")
                return self._run_mock(context)
        
        return self._run_mock(context)

    def _run_openai(self, prompt: str) -> Dict[str, Any]:
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Eres un API de nutrición. Devuelve JSON con desglose de macros por ingrediente."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2, 
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content
        return json.loads(content)

    def _run_mock(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock v3: Cálculo inverso. 
        1. Define objetivos de macros por comida.
        2. Selecciona alimento principal (fuente proteica). Calcula gramos necesarios para cumplir P.
        3. Selecciona alimento secundario (fuente carbos). Calcula gramos para cumplir C.
        4. Rellena grasas si faltan.
        """
        total_kcal = int(float(context.get("total_kcal", 2200)))
        n_meals = int(context.get("meals", 4))
        n_meals = max(3, min(6, n_meals))

        macros = context.get("macros") or {}
        # Defaults si no hay macros: 30% P, 40% C, 30% F
        p_daily = float(macros.get("protein", total_kcal * 0.3 / 4))
        c_daily = float(macros.get("carbs", total_kcal * 0.4 / 4))
        f_daily = float(macros.get("fat", total_kcal * 0.3 / 9))

        # Configuración de distribución (Ratio Kcal, Nombre, Tipo)
        # Simplificado para v3: Usamos listas de tuplas
        dist_map = {
            3: [(0.35, "Desayuno", "breakfast"), (0.40, "Comida", "main"), (0.25, "Cena", "main")],
            4: [(0.30, "Desayuno", "breakfast"), (0.35, "Comida", "main"), (0.10, "Merienda", "snack"), (0.25, "Cena", "main")],
            5: [(0.25, "Desayuno", "breakfast"), (0.10, "Media Mañana", "snack"), (0.35, "Comida", "main"), (0.10, "Merienda", "snack"), (0.20, "Cena", "main")],
            6: [(0.20, "Desayuno", "breakfast"), (0.10, "Media Mañana", "snack"), (0.30, "Comida", "main"), (0.10, "Merienda", "snack"), (0.20, "Cena", "main"), (0.10, "Recena", "snack")]
        }
        
        selected_config = dist_map.get(n_meals, dist_map[4])
        total_ratio = sum(x[0] for x in selected_config) # Normalización

        meals_out = []
        random.seed(total_kcal + n_meals) # Determinismo

        for ratio, name, m_type in selected_config:
            # 1. Calcular objetivos de la comida
            r_norm = ratio / total_ratio
            target_p = int(p_daily * r_norm)
            target_c = int(c_daily * r_norm)
            target_f = int(f_daily * r_norm)
            target_kcal = int(total_kcal * r_norm)

            # Seguridad: Mínimo 20g de proteína en comidas principales (Tactical Athlete guideline)
            if m_type in ["breakfast", "main"] and target_p < 20:
                target_p = 25

            items = self._generate_granular_items(m_type, target_p, target_c, target_f)

            # Recalcular totales reales basados en la suma de los items generados
            real_kcal = sum(i["kcal"] for i in items)
            real_p = sum(i["macros"]["p"] for i in items)
            real_c = sum(i["macros"]["c"] for i in items)
            real_f = sum(i["macros"]["f"] for i in items)

            meals_out.append({
                "name": name,
                "kcal": real_kcal,
                "macros": {"p": real_p, "c": real_c, "f": real_f},
                "items": items
            })

        return {
            "source": "mock_granular_v3",
            "total_kcal": total_kcal,
            "macros_daily": {"p": int(p_daily), "c": int(c_daily), "f": int(f_daily)},
            "meals": meals_out,
            "tips": ["Pesa los alimentos en crudo a menos que se indique lo contrario.", "Bebe agua en las comidas."]
        }

    def _generate_granular_items(self, m_type: str, target_p: int, target_c: int, target_f: int) -> List[Dict]:
        items = []
        
        # --- 1. FUENTE DE PROTEÍNA ---
        # Seleccionamos un alimento de la DB
        p_options = MOCK_DB_V3["proteins"].get(m_type, MOCK_DB_V3["proteins"]["main"])
        p_food = p_options[random.randint(0, len(p_options)-1)]
        
        # Calculamos cuántos gramos necesitamos para cubrir (casi) todo el target de proteína
        # Formula: (Target_P / P_per_100g) * 100
        # Redondeamos a múltiplos de 5g para que sea realista
        grams_p_food = (target_p / p_food["p"]) * 100
        grams_p_food = max(30, round(grams_p_food / 5) * 5) # Mínimo 30g de producto
        
        # Calculamos aportes reales de este alimento
        p_val = int(p_food["p"] * grams_p_food / 100)
        c_val = int(p_food["c"] * grams_p_food / 100)
        f_val = int(p_food["f"] * grams_p_food / 100)
        kcal_val = (p_val * 4) + (c_val * 4) + (f_val * 9)

        items.append({
            "food": p_food["name"],
            "qty": f"{grams_p_food}g",
            "kcal": kcal_val,
            "macros": {"p": p_val, "c": c_val, "f": f_val}
        })

        # --- 2. FUENTE DE CARBOHIDRATOS ---
        # Restamos lo que ya aportó la proteína
        remaining_c = max(0, target_c - c_val)
        
        if remaining_c > 10: # Solo si vale la pena añadir carbos
            c_options = MOCK_DB_V3["carbs"].get(m_type, MOCK_DB_V3["carbs"]["main"])
            c_food = c_options[random.randint(0, len(c_options)-1)]
            
            # Calculamos gramos
            grams_c_food = (remaining_c / c_food["c"]) * 100
            grams_c_food = max(20, round(grams_c_food / 5) * 5)
            
            # Aportes
            p_c = int(c_food["p"] * grams_c_food / 100)
            c_c = int(c_food["c"] * grams_c_food / 100)
            f_c = int(c_food["f"] * grams_c_food / 100)
            k_c = (p_c * 4) + (c_c * 4) + (f_c * 9)
            
            # Formateo especial para frutas (unidades vs gramos)
            qty_str = f"{grams_c_food}g"
            if "fruta" in c_food["name"].lower() or "plátano" in c_food["name"].lower():
                # Aprox 150g es una pieza mediana
                units = round(grams_c_food / 150, 1)
                if units < 0.8: units = 1
                qty_str = f"{units} pieza(s) (~{grams_c_food}g)"

            items.append({
                "food": c_food["name"],
                "qty": qty_str,
                "kcal": k_c,
                "macros": {"p": p_c, "c": c_c, "f": f_c}
            })
            
            # Actualizamos grasas acumuladas
            f_val += f_c

        # --- 3. FUENTE DE GRASAS (Si falta) ---
        remaining_f = max(0, target_f - f_val)
        if remaining_f > 5: # Solo si faltan más de 5g
            f_options = MOCK_DB_V3["fats"]
            f_food = f_options[random.randint(0, len(f_options)-1)]
            
            grams_f_food = (remaining_f / f_food["f"]) * 100
            grams_f_food = round(grams_f_food / 5) * 5
            
            p_f = int(f_food["p"] * grams_f_food / 100)
            c_f = int(f_food["c"] * grams_f_food / 100)
            f_f = int(f_food["f"] * grams_f_food / 100)
            k_f = (p_f * 4) + (c_f * 4) + (f_f * 9)
            
            items.append({
                "food": f_food["name"],
                "qty": f"{grams_f_food}g",
                "kcal": k_f,
                "macros": {"p": p_f, "c": c_f, "f": f_f}
            })

        return items