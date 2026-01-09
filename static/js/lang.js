(function () {
  // Diccionario global mínimo. Añade más claves según se necesite.
  const dict = {
    'chat_hi': { es: '¡Hola! 👋 Soy tu Coach AI Fitness. ¿En qué puedo ayudarte hoy?', en: 'Hi! 👋 I\'m your AI Fitness Coach. How can I help you today?' },
    'chat_eat': { es: '🍎 Te recomiendo alimentos ricos en proteínas y carbohidratos complejos antes del entrenamiento.', en: '🍎 I recommend foods rich in protein and complex carbs before training.' },
    'chat_routine': { es: '🏋️‍♂️ Puedes revisar tu rutina personalizada en el Dashboard. ¡Recuerda calentar antes de entrenar!', en: '🏋️‍♂️ Check your personalized routine on the Dashboard. Remember to warm up!' },
    'chat_motivation': { es: '🔥 La constancia vence al talento. ¡Hoy es un gran día para entrenar!', en: '🔥 Consistency beats talent. Today is a great day to train!' },
    'chat_thanks': { es: '💪 ¡Siempre aquí para ayudarte! Sigue con tu plan.', en: '💪 Always here to help! Keep following your plan.' },
    'chat_contact': { es: '📩 Puedes dejar tu duda y te contactaremos desde el portal principal.', en: '📩 Leave your question and we will contact you from the main portal.' },
    'chat_default': { es: '🤖 No estoy seguro de eso, pero puedo ayudarte con alimentación, rutinas o motivación.', en: '🤖 I\'m not sure about that, but I can help with nutrition, routines or motivation.' },
    'hero_title': { es: 'Tu Entrenador Inteligente', en: 'Your Smart Coach' },
    'hero_p': { es: 'Genera tu plan personalizado de alimentación y entrenamiento con IA.', en: 'Generate your personalized nutrition and training plan with AI.' },
    'cta_start': { es: 'Comenzar Ahora', en: 'Get Started' },
    'nav_dashboard': { es: 'Dashboard', en: 'Dashboard' },
    'nav_plan': { es: 'Mi Plan', en: 'My Plan' },
    'nav_nutrition': { es: 'Nutrición', en: 'Nutrition' },
    'nav_home': { es: 'Inicio', en: 'Home' },
    'form_userid': { es: 'ID de Usuario', en: 'User ID' },
    'placeholder_userid': { es: 'Ej. usr_001', en: 'e.g. usr_001' },
    'form_weight': { es: 'Peso (kg)', en: 'Weight (kg)' },
    'form_goal': { es: 'Objetivo', en: 'Goal' },
    'opt_select': { es: 'Selecciona...', en: 'Select...' },
    'opt_gain': { es: 'Ganar músculo', en: 'Gain muscle' },
    'opt_lose': { es: 'Perder grasa', en: 'Lose fat' },
    'opt_maintain': { es: 'Mantener', en: 'Maintain' },
    'btn_generate': { es: 'Generar Plan', en: 'Generate Plan' },
    'loading_plan': { es: 'Generando tu plan personalizado...', en: 'Generating your personalized plan...' },
    'plan_ok': { es: '✔  Plan generado con éxito', en: '✔  Plan generated successfully' },
    'plan_error': { es: '❌ Ocurrió un error al generar el plan.', en: '❌ An error occurred while generating the plan.' },
    'footer': { es: '© 2025 AI Fitness | Desarrollado por Ismael Villegas', en: '© 2025 AI Fitness | Developed by Ismael Villegas' }
  };

  dict['ai_fitness_dashboard_de_progreso'] = { es: 'AI Fitness | Dashboard de Progreso', en: 'AI Fitness | Dashboard de Progreso' };
  dict['es'] = { es: 'ES', en: 'ES' };
  dict['en'] = { es: 'EN', en: 'EN' };
  dict['2025_ai_fitness_dashboard_de_progreso_inteligente'] = { es: '© 2025 AI Fitness | Dashboard de Progreso Inteligente', en: '© 2025 AI Fitness | Dashboard de Progreso Inteligente' };
  dict['ai_fitness_tu_entrenador_inteligente'] = { es: 'AI Fitness | Tu Entrenador Inteligente', en: 'AI Fitness | Tu Entrenador Inteligente' };
  dict['coach_ai_fitness'] = { es: '🤖 Coach AI Fitness', en: '🤖 Coach AI Fitness' };
  dict['enviar'] = { es: 'Enviar', en: 'Enviar' };
  dict['cargando'] = { es: 'Cargando...', en: 'Cargando...' };
  dict['ai_fitness_nutrición_inteligente'] = { es: 'AI Fitness | Nutrición Inteligente', en: 'AI Fitness | Smart Nutrition' };
  dict['avena_proteica'] = { es: 'Avena Proteica', en: 'Protein Oats' };
  dict['avena_proteína_en_polvo_banana_y_canela_ideal_para_comenzar_'] = { es: 'Avena, proteína en polvo, banana y canela. Ideal para comenzar el día lleno de energía.', en: 'Oats, protein powder, banana and cinnamon. Ideal to start the day full of energy.' };
  dict['bowl_de_pollo_y_quinoa'] = { es: 'Bowl de Pollo y Quinoa', en: 'Chicken & Quinoa Bowl' };
  dict['combinación_equilibrada_de_proteínas_granos_y_vegetales_para'] = { es: 'Combinación equilibrada de proteínas, granos y vegetales para recuperación muscular.', en: 'Balanced mix of proteins, grains and vegetables for muscle recovery.' };
  dict['wrap_de_atún'] = { es: 'Wrap de Atún', en: 'Tuna Wrap' };
  dict['rico_en_proteínas_y_omega-3_ideal_como_almuerzo_rápido_y_sal'] = { es: 'Rico en proteínas y omega-3, ideal como almuerzo rápido y saludable.', en: 'Rich in protein and omega-3, ideal as a quick, healthy lunch.' };
  dict['alimento_base'] = { es: 'Alimento Base', en: 'Base Food' };
  dict['valor_nutricional_aproximado'] = { es: 'Valor Nutricional Aproximado', en: 'Approximate Nutritional Value' };
  dict['1_taza_de_arroz_cocido'] = { es: '1 taza de arroz cocido', en: '1 cup cooked rice' };
  dict['1_taza_de_quinoa_cocida'] = { es: '1 taza de quinoa cocida', en: '1 cup cooked quinoa' };
  dict['similar_en_calorías_más_proteína_y_fibra'] = { es: 'Similar en calorías, más proteína y fibra', en: 'Similar calories, more protein and fiber' };
  dict['100g_de_carne_magra'] = { es: '100g de carne magra', en: '100g lean meat' };
  dict['100g_de_pollo_o_tofu_firme'] = { es: '100g de pollo o tofu firme', en: '100g chicken or firm tofu' };
  dict['misma_proteína_menos_grasa_saturada'] = { es: 'Misma proteína, menos grasa saturada', en: 'Same protein, less saturated fat' };
  dict['1_yogurt_natural'] = { es: '1 yogurt natural', en: '1 natural yogurt' };
  dict['1_yogurt_griego_sin_azúcar'] = { es: '1 yogurt griego sin azúcar', en: '1 sugar-free Greek yogurt' };
  dict['mayor_proteína_menor_azúcar'] = { es: 'Mayor proteína, menor azúcar', en: 'Higher protein, lower sugar' };
  dict['1_cucharada_de_mantequilla'] = { es: '1 cucharada de mantequilla', en: '1 tbsp butter' };
  dict['1_cucharada_de_aguacate_triturado'] = { es: '1 cucharada de aguacate triturado', en: '1 tbsp mashed avocado' };
  dict['grasa_más_saludable_monoinsaturada'] = { es: 'Grasa más saludable (monoinsaturada)', en: 'Healthier fat (monounsaturated)' };
  dict['1_pan_blanco'] = { es: '1 pan blanco', en: '1 white bread slice' };
  dict['1_pan_integral_o_de_centeno'] = { es: '1 pan integral o de centeno', en: '1 wholegrain or rye slice' };
  dict['más_fibra_y_saciedad'] = { es: 'Más fibra y saciedad', en: 'More fiber and satiety' };
  dict['2025_ai_fitness_nutrición_inteligente_y_educación_alimentari'] = { es: '© 2025 AI Fitness | Nutrición Inteligente y Educación Alimentaria', en: '© 2025 AI Fitness | Nutrición Inteligente y Educación Alimentaria' };
  dict['ai_fitness_plan_de_alimentación_y_entrenamiento'] = { es: 'AI Fitness | Plan de Alimentación y Entrenamiento', en: 'AI Fitness | Plan de Alimentación y Entrenamiento' };
  dict['una_alimentación_adecuada_no_solo_mejora_tu_rendimiento_físi'] = { es: 'Una alimentación adecuada no solo mejora tu rendimiento físico, sino que también impulsa tu bienestar mental y tu capacidad de recuperación. En AI Fitness creemos que cada cuerpo es único, y por eso nuestros planes están diseñados con inteligencia artificial para adaptarse a ti.', en: 'Una alimentación adecuada no solo mejora tu rendimiento físico, sino que también impulsa tu bienestar mental y tu capacidad de recuperación. En AI Fitness creemos que cada cuerpo es único, y por eso nuestros planes están diseñados con inteligencia artificial para adaptarse a ti.' };
  dict['balance_correcto_de_macronutrientes_proteínas_carbohidratos_'] = { es: 'Balance correcto de macronutrientes (proteínas, carbohidratos y grasas).', en: 'Balance correcto de macronutrientes (proteínas, carbohidratos y grasas).' };
  dict['planificación_personalizada_según_tus_objetivos_y_nivel_de_a'] = { es: 'Planificación personalizada según tus objetivos y nivel de actividad.', en: 'Planificación personalizada según tus objetivos y nivel de actividad.' };
  dict['recomendaciones_de_alimentos_naturales_y_saludables'] = { es: 'Recomendaciones de alimentos naturales y saludables.', en: 'Recomendaciones de alimentos naturales y saludables.' };
  dict['pecho_y_tríceps'] = { es: 'Pecho y Tríceps', en: 'Chest & Triceps' };
  dict['fortalece_tu_tren_superior_con_ejercicios_compuestos_como_pr'] = { es: 'Fortalece tu tren superior con ejercicios compuestos como press de banca, fondos y flexiones. Desarrolla masa muscular y potencia en tus empujes.', en: 'Strengthen your upper body with compound exercises like bench press, dips and push-ups. Build muscle mass and pushing power.' };
  dict['espalda_y_bíceps'] = { es: 'Espalda y Bíceps', en: 'Back & Biceps' };
  dict['rutinas_centradas_en_dominadas_remos_y_curls_para_mejorar_la'] = { es: 'Rutinas centradas en dominadas, remos y curls para mejorar la postura, la fuerza y la definición de la espalda.', en: 'Routines focused on pull-ups, rows and curls to improve posture, strength and back definition.' };
  dict['piernas_y_glúteos'] = { es: 'Piernas y Glúteos', en: 'Legs & Glutes' };
  dict['ejercicios_de_fuerza_como_sentadillas_peso_muerto_y_zancadas'] = { es: 'Ejercicios de fuerza como sentadillas, peso muerto y zancadas para potenciar la estabilidad y la potencia del tren inferior.', en: 'Strength exercises like squats, deadlifts and lunges to boost lower-body stability and power.' };
  dict['hombros_y_core'] = { es: 'Hombros y Core', en: 'Shoulders & Core' };
  dict['desarrolla_equilibrio_y_fuerza_funcional_con_ejercicios_para'] = { es: 'Desarrolla equilibrio y fuerza funcional con ejercicios para el abdomen, la espalda baja y los hombros.', en: 'Develop balance and functional strength with exercises for the abs, lower back and shoulders.' };
  dict['entrenamiento_full_body'] = { es: 'Entrenamiento Full Body', en: 'Full Body Training' };
  dict['sesiones_completas_que_activan_todos_los_grupos_musculares_p'] = { es: 'Sesiones completas que activan todos los grupos musculares. Perfecto para mantenerte en forma cuando dispones de poco tiempo.', en: 'Full sessions that activate all muscle groups. Perfect for staying fit when you have little time.' };
  dict['2025_ai_fitness_alimentación_y_entrenamiento_inteligente'] = { es: '© 2025 AI Fitness | Alimentación y Entrenamiento Inteligente', en: '© 2025 AI Fitness | Alimentación y Entrenamiento Inteligente' };
  // Plan page extra keys
  dict['nutrition_intro'] = { es: 'Una alimentación adecuada no solo mejora tu rendimiento físico, sino que también impulsa tu bienestar mental y tu capacidad de recuperación. En AI Fitness creemos que cada cuerpo es único, y por eso nuestros planes están diseñados con inteligencia artificial para adaptarse a ti.', en: 'A proper diet not only improves your physical performance but also boosts your mental well-being and recovery capacity. At AI Fitness we believe every body is unique, and our plans are AI-designed to adapt to you.' };
  // the list items keys already exist earlier; ensure they map (they do) but re-add safe defaults if missing
  dict['pecho_y_tríceps'] = dict['pecho_y_tríceps'] || { es: 'Pecho y Tríceps', en: 'Chest & Triceps' };
  dict['fortalece_tu_tren_superior_con_ejercicios_compuestos_como_pr'] = dict['fortalece_tu_tren_superior_con_ejercicios_compuestos_como_pr'] || { es: 'Fortalece tu tren superior con ejercicios compuestos como press de banca, fondos y flexiones. Desarrolla masa muscular y potencia en tus empujes.', en: 'Strengthen your upper body with compound exercises like bench press, dips and push-ups. Build muscle mass and pushing power.' };
  dict['espalda_y_bíceps'] = dict['espalda_y_bíceps'] || { es: 'Espalda y Bíceps', en: 'Back & Biceps' };
  dict['rutinas_centradas_en_dominadas_remos_y_curls_para_mejorar_la'] = dict['rutinas_centradas_en_dominadas_remos_y_curls_para_mejorar_la'] || { es: 'Rutinas centradas en dominadas, remos y curls para mejorar la postura, la fuerza y la definición de la espalda.', en: 'Routines focused on pull-ups, rows and curls to improve posture, strength and back definition.' };
  dict['piernas_y_glúteos'] = dict['piernas_y_glúteos'] || { es: 'Piernas y Glúteos', en: 'Legs & Glutes' };
  dict['ejercicios_de_fuerza_como_sentadillas_peso_muerto_y_zancadas'] = dict['ejercicios_de_fuerza_como_sentadillas_peso_muerto_y_zancadas'] || { es: 'Ejercicios de fuerza como sentadillas, peso muerto y zancadas para potenciar la estabilidad y la potencia del tren inferior.', en: 'Strength exercises like squats, deadlifts and lunges to boost lower body stability and power.' };
  dict['hombros_y_core'] = dict['hombros_y_core'] || { es: 'Hombros y Core', en: 'Shoulders & Core' };
  dict['desarrolla_equilibrio_y_fuerza_funcional_con_ejercicios_para'] = dict['desarrolla_equilibrio_y_fuerza_funcional_con_ejercicios_para'] || { es: 'Desarrolla equilibrio y fuerza funcional con ejercicios para el abdomen, la espalda baja y los hombros.', en: 'Develop balance and functional strength with exercises for the abs, lower back and shoulders.' };
  dict['entrenamiento_full_body'] = dict['entrenamiento_full_body'] || { es: 'Entrenamiento Full Body', en: 'Full Body Training' };
  dict['sesiones_completas_que_activan_todos_los_grupos_musculares_p'] = dict['sesiones_completas_que_activan_todos_los_grupos_musculares_p'] || { es: 'Sesiones completas que activan todos los grupos musculares. Perfecto para mantenerte en forma cuando dispones de poco tiempo.', en: 'Full sessions that activate all muscle groups. Perfect for staying fit when you have little time.' };
  // Página: Dashboard
  dict['dashboard_hero_title'] = { es: 'Monitorea tu evolución', en: 'Monitor your progress' };
  dict['dashboard_hero_p'] = { es: 'Selecciona tu usuario, carga tus datos y observa tu progreso en tiempo real.', en: 'Select your user, upload your data and view your progress in real time.' };
  dict['stat_weight_title'] = { es: 'Peso Actual', en: 'Current Weight' };
  dict['stat_fat_title'] = { es: 'Grasa Corporal', en: 'Body Fat' };
  dict['stat_performance_title'] = { es: 'Rendimiento', en: 'Performance' };
  dict['stat_tmb_title'] = { es: 'Tasa Metabólica Basal', en: 'Basal Metabolic Rate' };
  dict['stat_diet_title'] = { es: 'Consumo Energético Total', en: 'Total Energy Expenditure' };
  dict['stat_nutrition_title'] = { es: 'Nutrición', en: 'Nutrition' };
  dict['stat_last_label'] = { es: 'Último registro', en: 'Latest record' };
  dict['no_data'] = { es: 'Sin datos disponibles', en: 'No data available' };

  // Mensajes y etiquetas adicionales
  dict['data_loaded'] = { es: '✔  Datos cargados correctamente.', en: '✔  Data loaded successfully.' };
  dict['chart_weight'] = { es: 'Peso (kg)', en: 'Weight (kg)' };
  dict['chart_fat'] = { es: 'Grasa (%)', en: 'Body Fat (%)' };
  dict['chart_performance'] = { es: 'Rendimiento (%)', en: 'Performance (%)' };
  dict['chart_nutrition'] = { es: 'TMB (%)', en: 'Nutrition Adherence (%)' };

  // Página: Nutrition
  dict['nutrition_hero_title'] = { es: 'Nutrición Inteligente para un Rendimiento Óptimo', en: 'Smart Nutrition for Optimal Performance' };
  dict['nutrition_hero_p'] = { es: 'Descubre recetas saludables y aprende a equilibrar tus alimentos con equivalencias precisas.', en: 'Discover healthy recipes and learn to balance your foods with precise equivalences.' };
  dict['recipes_title'] = { es: 'Recetas Fitness', en: 'Fitness Recipes' };
  dict['recipes_sub'] = { es: 'Fáciles, nutritivas y llenas de energía para acompañar tus entrenamientos.', en: 'Easy, nutritious and energy-packed recipes to support your workouts.' };
  dict['equivalences_title'] = { es: 'Equivalencias de Alimentos', en: 'Food Equivalences' };
  dict['equivalences_sub'] = { es: 'Comprende cómo sustituir alimentos sin perder el equilibrio nutricional.', en: 'Understand how to substitute foods without losing nutritional balance.' };
  // Table headers and recipe items
  dict['avena_proteica'] = dict['avena_proteica'] || { es: 'Avena Proteica', en: 'Protein Oats' };
  dict['avena_proteína_en_polvo_banana_y_canela_ideal_para_comenzar_'] = dict['avena_proteína_en_polvo_banana_y_canela_ideal_para_comenzar_'] || { es: 'Avena, proteína en polvo, banana y canela. Ideal para comenzar el día lleno de energía.', en: 'Oats, protein powder, banana and cinnamon. Ideal to start the day full of energy.' };
  dict['bowl_de_pollo_y_quinoa'] = dict['bowl_de_pollo_y_quinoa'] || { es: 'Bowl de Pollo y Quinoa', en: 'Chicken & Quinoa Bowl' };
  dict['combinación_equilibrada_de_proteínas_granos_y_vegetales_para'] = dict['combinación_equilibrada_de_proteínas_granos_y_vegetales_para'] || { es: 'Combinación equilibrada de proteínas, granos y vegetales para recuperación muscular.', en: 'Balanced mix of proteins, grains and vegetables for muscle recovery.' };
  dict['wrap_de_atún'] = dict['wrap_de_atún'] || { es: 'Wrap de Atún', en: 'Tuna Wrap' };
  dict['rico_en_proteínas_y_omega-3_ideal_como_almuerzo_rápido_y_sal'] = dict['rico_en_proteínas_y_omega-3_ideal_como_almuerzo_rápido_y_sal'] || { es: 'Rico en proteínas y omega-3, ideal como almuerzo rápido y saludable.', en: 'Rich in protein and omega-3, ideal as a quick and healthy lunch.' };
  dict['alimento_base'] = dict['alimento_base'] || { es: 'Alimento Base', en: 'Base Food' };
  dict['equivalencia'] = dict['equivalencia'] || { es: 'Equivalencia', en: 'Equivalent' };
  dict['valor_nutricional_aproximado'] = dict['valor_nutricional_aproximado'] || { es: 'Valor Nutricional Aproximado', en: 'Approximate Nutritional Value' };
  dict['1_taza_de_arroz_cocido'] = dict['1_taza_de_arroz_cocido'] || { es: '1 taza de arroz cocido', en: '1 cup cooked rice' };
  dict['1_taza_de_quinoa_cocida'] = dict['1_taza_de_quinoa_cocida'] || { es: '1 taza de quinoa cocida', en: '1 cup cooked quinoa' };
  dict['similar_en_calorías_más_proteína_y_fibra'] = dict['similar_en_calorías_más_proteína_y_fibra'] || { es: 'Similar en calorías, más proteína y fibra', en: 'Similar calories, more protein and fiber' };
  dict['100g_de_carne_magra'] = dict['100g_de_carne_magra'] || { es: '100g de carne magra', en: '100g lean meat' };
  dict['100g_de_pollo_o_tofu_firme'] = dict['100g_de_pollo_o_tofu_firme'] || { es: '100g de pollo o tofu firme', en: '100g chicken or firm tofu' };
  dict['misma_proteína_menos_grasa_saturada'] = dict['misma_proteína_menos_grasa_saturada'] || { es: 'Misma proteína, menos grasa saturada', en: 'Same protein, less saturated fat' };
  dict['1_yogurt_natural'] = dict['1_yogurt_natural'] || { es: '1 yogurt natural', en: '1 natural yogurt' };
  dict['1_yogurt_griego_sin_azúcar'] = dict['1_yogurt_griego_sin_azúcar'] || { es: '1 yogurt griego sin azúcar', en: '1 sugar-free Greek yogurt' };
  dict['mayor_proteína_menor_azúcar'] = dict['mayor_proteína_menor_azúcar'] || { es: 'Mayor proteína, menor azúcar', en: 'Higher protein, lower sugar' };
  dict['1_cucharada_de_mantequilla'] = dict['1_cucharada_de_mantequilla'] || { es: '1 cucharada de mantequilla', en: '1 tbsp butter' };
  dict['1_cucharada_de_aguacate_triturado'] = dict['1_cucharada_de_aguacate_triturado'] || { es: '1 cucharada de aguacate triturado', en: '1 tbsp mashed avocado' };
  dict['grasa_más_saludable_monoinsaturada'] = dict['grasa_más_saludable_monoinsaturada'] || { es: 'Grasa más saludable (monoinsaturada)', en: 'Healthier fat (monounsaturated)' };
  dict['1_pan_blanco'] = dict['1_pan_blanco'] || { es: '1 pan blanco', en: '1 white bread slice' };
  dict['1_pan_integral_o_de_centeno'] = dict['1_pan_integral_o_de_centeno'] || { es: '1 pan integral o de centeno', en: '1 wholegrain or rye slice' };
  dict['más_fibra_y_saciedad'] = dict['más_fibra_y_saciedad'] || { es: 'Más fibra y saciedad', en: 'More fiber and satiety' };

  // Fix/override some remaining entries where English was left equal to Spanish
  dict['ai_fitness_dashboard_de_progreso'] = { es: 'AI Fitness | Dashboard de Progreso', en: 'AI Fitness | Progress Dashboard' };
  dict['2025_ai_fitness_dashboard_de_progreso_inteligente'] = { es: '© 2025 AI Fitness | Dashboard de Progreso Inteligente', en: '© 2025 AI Fitness | Smart Progress Dashboard' };
  dict['ai_fitness_tu_entrenador_inteligente'] = { es: 'AI Fitness | Tu Entrenador Inteligente', en: 'AI Fitness | Your Smart Coach' };
  dict['coach_ai_fitness'] = { es: '🤖 Coach AI Fitness', en: '🤖 AI Fitness Coach' };
  dict['enviar'] = { es: 'Enviar', en: 'Send' };
  dict['cargando'] = { es: 'Cargando...', en: 'Loading...' };
  dict['2025_ai_fitness_nutrición_inteligente_y_educación_alimentari'] = { es: '© 2025 AI Fitness | Nutrición Inteligente y Educación Alimentaria', en: '© 2025 AI Fitness | Smart Nutrition & Food Education' };
  dict['ai_fitness_plan_de_alimentación_y_entrenamiento'] = { es: 'AI Fitness | Plan de Alimentación y Entrenamiento', en: 'AI Fitness | Nutrition & Training Plan' };
  dict['una_alimentación_adecuada_no_solo_mejora_tu_rendimiento_físi'] = {
    es: 'Una alimentación adecuada no solo mejora tu rendimiento físico, sino que también impulsa tu bienestar mental y tu capacidad de recuperación. En AI Fitness creemos que cada cuerpo es único, y por eso nuestros planes están diseñados con inteligencia artificial para adaptarse a ti.',
    en: 'A proper diet not only improves your physical performance but also boosts your mental well-being and recovery capacity. At AI Fitness we believe every body is unique, and our plans are AI-designed to adapt to you.'
  };
  dict['balance_correcto_de_macronutrientes_proteínas_carbohidratos_'] = {
    es: 'Balance correcto de macronutrientes (proteínas, carbohidratos y grasas).',
    en: 'Correct balance of macronutrients (protein, carbohydrates and fats).'
  };
  dict['planificación_personalizada_según_tus_objetivos_y_nivel_de_a'] = {
    es: 'Planificación personalizada según tus objetivos y nivel de actividad.',
    en: 'Personalized planning according to your goals and activity level.'
  };
  dict['recomendaciones_de_alimentos_naturales_y_saludables'] = {
    es: 'Recomendaciones de alimentos naturales y saludables.',
    en: 'Recommendations for natural and healthy foods.'
  };
  dict['2025_ai_fitness_alimentación_y_entrenamiento_inteligente'] = { es: '© 2025 AI Fitness | Alimentación y Entrenamiento Inteligente', en: '© 2025 AI Fitness | Smart Nutrition & Training' };

  // Página: Plan
  dict['plan_hero_title'] = { es: 'Plan de Alimentación y Entrenamiento', en: 'Nutrition and Training Plan' };
  dict['plan_hero_p'] = { es: 'Descubre cómo equilibrar tu nutrición y potenciar tus resultados físicos.', en: 'Discover how to balance your nutrition and boost your physical results.' };
  dict['nutrition_importance_title'] = { es: 'La importancia de una buena alimentación', en: 'The importance of good nutrition' };
  dict['workouts_title'] = { es: 'Entrenamientos por Grupo Muscular', en: 'Workouts by Muscle Group' };
  // Cardio workout translations
  dict['cardio'] = { es: 'Cardio', en: 'Cardio' };
  dict['ejercicios_cardio_caminadora_eliptica_natacion'] = {
    es: 'Ejercicios de cardio como caminadora, elíptica y natación para mejorar la resistencia y la salud cardiovascular.',
    en: 'Cardio exercises like treadmill, elliptical and swimming to improve endurance and cardiovascular health.'
  };

  // Buttons, loading and labels
  dict['btn_load_progress'] = { es: 'Cargar progreso', en: 'Load progress' };
  dict['loading_data'] = { es: 'Cargando datos...', en: 'Loading data...' };
  dict['select_user_label'] = { es: 'Selecciona tu ID de usuario', en: 'Select your User ID' };
  dict['generate_section_title'] = { es: 'Genera tu Plan', en: 'Generate your Plan' };
  // Common auth actions
  dict['logout'] = { es: 'Cerrar sesión', en: 'Log out' };

  // Página: Auth
  dict['auth_left_title'] = { es: 'Impulsa tu progreso', en: 'Boost your progress' };
  dict['auth_left_subtitle'] = { es: 'Entrena y alimentate con un plan inteligente.', en: 'Train and eat with an intelligent plan.' };
  dict['auth_tab_login'] = { es: 'Iniciar sesion', en: 'Sign in' };
  dict['auth_tab_register'] = { es: 'Registrarse', en: 'Sign up' };
  dict['auth_identifier_label'] = { es: 'Correo o usuario', en: 'Email or username' };
  dict['auth_identifier_ph'] = { es: 'correo@dominio.com o usuario', en: 'email@domain.com or username' };
  dict['auth_password_label'] = { es: 'Contrasena', en: 'Password' };
  dict['auth_password_ph'] = { es: '********', en: '********' };
  dict['auth_remember'] = { es: 'Recordarme', en: 'Remember me' };
  dict['auth_forgot'] = { es: 'Olvidaste tu contrasena?', en: 'Forgot your password?' };
  dict['auth_enter'] = { es: 'Entrar', en: 'Sign in' };
  dict['auth_name_label'] = { es: 'Nombre', en: 'Name' };
  dict['auth_name_ph'] = { es: 'Tu nombre', en: 'Your name' };
  dict['auth_username_label'] = { es: 'Usuario', en: 'Username' };
  dict['auth_username_ph'] = { es: 'MiUsuario', en: 'MyUsername' };
  dict['auth_email_label'] = { es: 'Correo electronico', en: 'Email' };
  dict['auth_email_ph'] = { es: 'correo@dominio.com', en: 'email@domain.com' };
  dict['auth_password_min_ph'] = { es: 'Minimo 8 caracteres', en: 'At least 8 characters' };
  dict['auth_password_confirm_label'] = { es: 'Confirmar contrasena', en: 'Confirm password' };
  dict['auth_password_confirm_ph'] = { es: 'Repite tu contrasena', en: 'Repeat your password' };
  dict['auth_create_account'] = { es: 'Crear cuenta', en: 'Create account' };
  dict['auth_terms_intro'] = { es: 'Al registrarte aceptas nuestros ', en: 'By signing up you accept our ' };
  dict['auth_terms'] = { es: 'Terminos', en: 'Terms' };
  dict['auth_and'] = { es: 'y', en: 'and' };
  dict['auth_privacy'] = { es: 'Privacidad', en: 'Privacy' };
  dict['auth_user_not_registered'] = { es: 'Usuario no registrado.', en: 'User not registered.' };


  function t(key) {
    const lang = document.documentElement.lang || localStorage.getItem('ai_fitness_lang') || 'es';
    return (dict[key] && dict[key][lang]) || '';
  }

  function updateButtons(lang) {
    // Debug log
    // console.log('[lang.js] updateButtons:', lang);

    // Select all buttons with these IDs (handles potential duplicates)
    const esBtns = document.querySelectorAll('[id="lang-es"]');
    const enBtns = document.querySelectorAll('[id="lang-en"]');

    esBtns.forEach(btn => {
      btn.classList.remove('active');
      if (lang === 'es') btn.classList.add('active');
    });

    enBtns.forEach(btn => {
      btn.classList.remove('active');
      if (lang === 'en') btn.classList.add('active');
    });
  }

  function translatePage(lang) {
    const navDashboard = document.getElementById('nav-dashboard');
    const navPlan = document.getElementById('nav-plan');
    const navNutrition = document.getElementById('nav-nutrition');
    const navHome = document.getElementById('nav-home');
    const navAbout = document.getElementById('nav-about');
    if (navDashboard) { navDashboard.textContent = t('nav_dashboard'); navDashboard.setAttribute('data-i18n', 'nav_dashboard'); }
    if (navPlan) { navPlan.textContent = t('nav_plan'); navPlan.setAttribute('data-i18n', 'nav_plan'); }
    if (navNutrition) { navNutrition.textContent = t('nav_nutrition'); navNutrition.setAttribute('data-i18n', 'nav_nutrition'); }
    if (navHome) { navHome.textContent = t('nav_home'); navHome.setAttribute('data-i18n', 'nav_home'); }
    if (navAbout) { navAbout.textContent = t('nav_about'); navAbout.setAttribute('data-i18n', 'nav_about'); }
    // Smart redirect for Home and brand: if logged in -> /dashboard; else -> /
    try {
      const brand = document.querySelector('.navbar .navbar-brand');
      const homeLink = document.getElementById('nav-home');
      const bind = (el) => {
        if (!el || el.getAttribute('data-smart-nav') === '1') return;
        el.setAttribute('data-smart-nav', '1');
        el.addEventListener('click', (e) => {
          try { e.preventDefault(); } catch (_) { }
          const hasUser = !!getCurrentUser();
          window.location.href = hasUser ? '/dashboard' : '/';
        });
      };
      bind(brand);
      bind(homeLink);
    } catch (e) { /* ignore */ }

    // Ensure active nav button sits before auth controls, which are before the language selector
    try {
      const navContainer = document.querySelector('.navbar .d-flex.align-items-center');
      if (navContainer) {
        // Ensure a stable container for auth controls
        const authControls = ensureAuthControlsContainer(navContainer);
        const btnGroup = navContainer.querySelector('.btn-group.ms-3');
        const links = Array.from(navContainer.querySelectorAll('a.btn.btn-sm'))
          .filter(a => !btnGroup || !btnGroup.contains(a));
        const activeBtn = links.find(a => a.classList.contains('btn-primary'));
        if (activeBtn) {
          // Ensure all outline links come before the active button
          links.filter(a => a !== activeBtn).forEach(a => navContainer.insertBefore(a, activeBtn));
          // Place active button just before the auth controls container
          navContainer.insertBefore(activeBtn, authControls);
        }
        // Render user chip and logout if logged in
        renderAuthChip(navContainer);
      }
    } catch (e) { /* ignore ordering issues */ }

    // Hero
    const heroTitle = document.getElementById('hero-title');
    const heroP = document.getElementById('hero-p');
    const cta = document.getElementById('cta-start');
    if (heroTitle) heroTitle.textContent = t('hero_title');
    if (heroP) heroP.textContent = t('hero_p');
    if (cta) cta.textContent = t('cta_start');

    // Form labels and placeholders
    const labelUid = document.getElementById('label-userid');
    const uidInput = document.getElementById('userId');
    const labelWeight = document.getElementById('label-weight');
    const labelGoal = document.getElementById('label-goal');
    const optSelect = document.getElementById('opt-select');
    const optGain = document.getElementById('opt-gain');
    const optLose = document.getElementById('opt-lose');
    const optMaintain = document.getElementById('opt-maintain');
    const btnGen = document.getElementById('btn-generate');
    const loadingText = document.getElementById('loading-text');
    if (labelUid) labelUid.textContent = t('form_userid');
    if (uidInput) uidInput.placeholder = t('placeholder_userid');
    if (labelWeight) labelWeight.textContent = t('form_weight');
    if (labelGoal) labelGoal.textContent = t('form_goal');
    if (optSelect) optSelect.textContent = t('opt_select');
    if (optGain) optGain.textContent = t('opt_gain');
    if (optLose) optLose.textContent = t('opt_lose');
    if (optMaintain) optMaintain.textContent = t('opt_maintain');
    if (btnGen) btnGen.textContent = t('btn_generate');
    if (loadingText) loadingText.textContent = t('loading_plan');

    // Footer
    const footer = document.getElementById('footer-text');
    if (footer) footer.textContent = t('footer');

    // Dashboard specific
    const dashHeroTitle = document.querySelector('#stats') ? document.querySelector('.hero h1') : null;
    const dashHeroP = document.querySelector('#stats') ? document.querySelector('.hero p') : null;
    if (dashHeroTitle) dashHeroTitle.textContent = t('dashboard_hero_title');
    if (dashHeroP) dashHeroP.textContent = t('dashboard_hero_p');

    const statWeightTitle = document.querySelector('#stats h5');
    if (statWeightTitle) statWeightTitle.textContent = t('stat_weight_title');
    // other stat headings (we target by their position)
    const statHeadings = document.querySelectorAll('#stats .stat-card h5');
    if (statHeadings && statHeadings.length >= 4) {
      statHeadings[0].textContent = t('stat_weight_title');
      statHeadings[1].textContent = t('stat_fat_title');
      statHeadings[2].textContent = t('stat_tmb_title');
      statHeadings[3].textContent = t('stat_diet_title');
    }
    // overlays
    const overlays = ['weight', 'fat', 'performance', 'nutrition'];
    overlays.forEach(id => {
      const el = document.getElementById(`msg-${id}`);
      if (el) el.textContent = t('no_data');
    });

    // Controls and labels
    const loadBtn = document.getElementById('loadDataBtn');
    if (loadBtn) loadBtn.textContent = t('btn_load_progress');
    const loadingEl = document.querySelector('#loading p');
    if (loadingEl) loadingEl.textContent = t('loading_data');
    const selectUserLabel = document.querySelector('.container label.fw-bold');
    if (selectUserLabel) selectUserLabel.textContent = t('select_user_label');

    // Index / Generate section
    let genTitle = document.querySelector('#form-section h2');
    if (!genTitle) genTitle = document.getElementById('generate-section-title');
    if (genTitle) genTitle.textContent = t('generate_section_title');

    // Nutrition page
    const nutritionHeroTitle = document.querySelector('.hero h1');
    const nutritionHeroP = document.querySelector('.hero p');
    if (nutritionHeroTitle && document.querySelector('section.recipes')) {
      nutritionHeroTitle.textContent = t('nutrition_hero_title');
      nutritionHeroP.textContent = t('nutrition_hero_p');
    }
    const recipesTitle = document.querySelector('.recipes .fw-bold');
    if (recipesTitle) recipesTitle.textContent = t('recipes_title');
    const recipesSub = document.querySelector('.recipes .text-secondary');
    if (recipesSub) recipesSub.textContent = t('recipes_sub');
    const eqTitle = document.querySelector('.equivalences h2');
    const eqSub = document.querySelector('.equivalences p');
    if (eqTitle) eqTitle.textContent = t('equivalences_title');
    if (eqSub) eqSub.textContent = t('equivalences_sub');

    // Plan page
    if (document.querySelector('section.workouts') || document.querySelector('.nutrition')) {
      const planHeroTitle = document.querySelector('.hero h1');
      const planHeroP = document.querySelector('.hero p');
      if (planHeroTitle) planHeroTitle.textContent = t('plan_hero_title');
      if (planHeroP) planHeroP.textContent = t('plan_hero_p');
      const nutritionImportance = document.querySelector('.nutrition h2');
      if (nutritionImportance) nutritionImportance.textContent = t('nutrition_importance_title');
      const workoutsTitle = document.querySelector('.workouts h2');
      if (workoutsTitle) workoutsTitle.textContent = t('workouts_title');
    }

    // Auth page
    // Left panel
    const authLeftTitle = document.getElementById('auth-left-title');
    if (authLeftTitle) authLeftTitle.textContent = t('auth_left_title');
    const authLeftSubtitle = document.getElementById('auth-left-subtitle');
    if (authLeftSubtitle) authLeftSubtitle.textContent = t('auth_left_subtitle');
    // Tabs
    const authTabLogin = document.getElementById('auth-tab-login');
    if (authTabLogin) authTabLogin.textContent = t('auth_tab_login');
    const authTabRegister = document.getElementById('auth-tab-register');
    if (authTabRegister) authTabRegister.textContent = t('auth_tab_register');
    // Login identifiers
    const lblAuthIdentifier = document.getElementById('label-auth-identifier');
    if (lblAuthIdentifier) lblAuthIdentifier.textContent = t('auth_identifier_label');
    const inAuthIdentifier = document.getElementById('auth-identifier');
    if (inAuthIdentifier) inAuthIdentifier.placeholder = t('auth_identifier_ph');
    const lblAuthPassword = document.getElementById('label-auth-password');
    if (lblAuthPassword) lblAuthPassword.textContent = t('auth_password_label');
    const inAuthPassword = document.getElementById('auth-password');
    if (inAuthPassword) inAuthPassword.placeholder = t('auth_password_ph');
    const authRememberLabel = document.getElementById('auth-remember-label');
    if (authRememberLabel) authRememberLabel.textContent = t('auth_remember');
    const authForgotLink = document.getElementById('auth-forgot-link');
    if (authForgotLink) authForgotLink.textContent = t('auth_forgot');
    const authEnterBtn = document.getElementById('auth-enter-btn');
    if (authEnterBtn) authEnterBtn.textContent = t('auth_enter');
    // Register fields
    const lblAuthName = document.getElementById('label-auth-name');
    if (lblAuthName) lblAuthName.textContent = t('auth_name_label');
    const inAuthName = document.getElementById('auth-name');
    if (inAuthName) inAuthName.placeholder = t('auth_name_ph');
    const lblAuthUsername = document.getElementById('label-auth-username');
    if (lblAuthUsername) lblAuthUsername.textContent = t('auth_username_label');
    const inAuthUsername = document.getElementById('auth-username');
    if (inAuthUsername) inAuthUsername.placeholder = t('auth_username_ph');
    const lblAuthEmail = document.getElementById('label-auth-email');
    if (lblAuthEmail) lblAuthEmail.textContent = t('auth_email_label');
    const inAuthEmail = document.getElementById('auth-email');
    if (inAuthEmail) inAuthEmail.placeholder = t('auth_email_ph');
    const lblAuthPasswordConfirm = document.getElementById('label-auth-password-confirm');
    if (lblAuthPasswordConfirm) lblAuthPasswordConfirm.textContent = t('auth_password_confirm_label');
    const inAuthPasswordConfirm = document.getElementById('auth-password-confirm');
    if (inAuthPasswordConfirm) inAuthPasswordConfirm.placeholder = t('auth_password_confirm_ph');
    const authPasswordMinHelp = document.getElementById('auth-password-min-help');
    if (authPasswordMinHelp) authPasswordMinHelp.textContent = t('auth_password_min_ph');
    const authCreateBtn = document.getElementById('auth-create-btn');
    if (authCreateBtn) authCreateBtn.textContent = t('auth_create_account');
    // Terms & privacy snippet
    const authTermsIntro = document.getElementById('auth-terms-intro');
    if (authTermsIntro) authTermsIntro.textContent = t('auth_terms_intro');
    const authTermsLink = document.getElementById('auth-terms-link');
    if (authTermsLink) authTermsLink.textContent = t('auth_terms');
    const authAnd = document.getElementById('auth-and');
    if (authAnd) authAnd.textContent = t('auth_and');
    const authPrivacyLink = document.getElementById('auth-privacy-link');
    if (authPrivacyLink) authPrivacyLink.textContent = t('auth_privacy');
    const authUserNotRegistered = document.getElementById('auth-user-not-registered');
    if (authUserNotRegistered) authUserNotRegistered.textContent = t('auth_user_not_registered');

    // Generic: any element annotated with data-i18n will be translated
    const i18nEls = document.querySelectorAll('[data-i18n]');
    if (i18nEls && i18nEls.length) {
      i18nEls.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        if (el.placeholder !== undefined && el.tagName.toLowerCase() === 'input') {
          el.placeholder = t(key);
        } else {
          el.textContent = t(key);
        }
      });
    }

    // Dashboard: stat-last labels and message
    const statLasts = document.querySelectorAll('[id^="stat-last"]');
    if (statLasts) statLasts.forEach(el => el.textContent = t('stat_last_label'));
    const messageEl = document.getElementById('message');
    if (messageEl) {
      const txt = (messageEl.textContent || '').trim();
      if (txt.includes('Datos cargados') || txt.includes('Data loaded') || txt.startsWith('✔ ')) {
        messageEl.textContent = t('data_loaded');
      }
    }

    // Update chart labels if the page exposes an update function
    if (window.updateChartLabels) {
      try { window.updateChartLabels(); } catch (e) { /* ignore */ }
    }
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('ai_fitness_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function ensureAuthControlsContainer(navContainer) {
    const btnGroup = navContainer.querySelector('.btn-group.ms-3');
    let container = document.getElementById('auth-controls');
    if (!container) {
      container = document.createElement('span');
      container.id = 'auth-controls';
      container.className = 'd-inline-flex align-items-center ms-2 me-1';
      if (btnGroup) navContainer.insertBefore(container, btnGroup);
      else navContainer.appendChild(container);
    } else if (btnGroup && container.nextSibling !== btnGroup) {
      // Keep container anchored immediately before language selector
      navContainer.insertBefore(container, btnGroup);
    }
    return container;
  }

  function renderAuthChip(navContainer) {
    try {
      const user = getCurrentUser();
      // Use dedicated container for stable placement
      const controls = ensureAuthControlsContainer(navContainer);
      // Existing elements
      let userChip = document.getElementById('user-chip');
      let logoutBtn = document.getElementById('logout-btn');

      if (!user || (!user.username && !user.name && !user.email)) {
        // Remove if exists
        if (userChip && userChip.parentElement) userChip.parentElement.removeChild(userChip);
        if (logoutBtn && logoutBtn.parentElement) logoutBtn.parentElement.removeChild(logoutBtn);
        return;
      }

      // Build display name
      const display = user.username ? `@${user.username}` : (user.name || user.email || '');

      if (!userChip) {
        userChip = document.createElement('span');
        userChip.id = 'user-chip';
        userChip.className = 'text-light small ms-3 me-2';
        userChip.style.whiteSpace = 'nowrap';
        controls.appendChild(userChip);
      }
      userChip.textContent = display;

      if (!logoutBtn) {
        logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.type = 'button';
        logoutBtn.className = 'btn btn-sm btn-outline-light';
        // minimal icon using emoji to avoid extra deps
        logoutBtn.textContent = '⏻';
        logoutBtn.title = t('logout');
        logoutBtn.setAttribute('aria-label', t('logout'));
        controls.appendChild(logoutBtn);
        logoutBtn.addEventListener('click', () => {
          try { localStorage.removeItem('ai_fitness_user'); } catch (_) { }
          // Re-render UI
          renderAuthChip(navContainer);
          // Redirect to home or auth
          try { window.location.href = '/'; } catch (_) { }
        });
      } else {
        logoutBtn.title = t('logout');
        logoutBtn.setAttribute('aria-label', t('logout'));
      }
    } catch (e) { /* ignore */ }
  }

  function setLang(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem('ai_fitness_lang', lang);
    updateButtons(lang);
    translatePage(lang);
  }

  // Public API for other scripts
  window.i18n = { t, setLang, translatePage };
  // Backwards-compatible globals used across existing templates
  window.t = t;
  window.setLang = setLang;
  window.translatePage = translatePage;

  // Traducción para placeholder del chat flotante
  try { dict['placeholder_chat'] = { es: 'Escribe tu pregunta...', en: 'Type your question...' }; } catch (e) { }

  // About page translations
  try {
    dict['nav_about'] = { es: 'Acerca de', en: 'About' };
    dict['about_hero_title'] = { es: 'Conoce AI Fitness', en: 'Meet AI Fitness' };
    dict['about_hero_p'] = { es: 'Nuestra misión es ayudarte a entrenar y comer mejor con IA.', en: 'Our mission is to help you train and eat better with AI.' };
    dict['about_mission_title'] = { es: 'Misión', en: 'Mission' };
    dict['about_mission_p'] = { es: 'Empoderar a cada persona con planes claros y seguimiento práctico para lograr cambios sostenibles.', en: 'Empower everyone with clear plans and practical tracking to achieve sustainable change.' };
    dict['about_values_title'] = { es: 'Valores', en: 'Values' };
    dict['about_value_1'] = { es: 'Consistencia sobre perfección', en: 'Consistency over perfection' };
    dict['about_value_2'] = { es: 'Claridad y simplicidad', en: 'Clarity and simplicity' };
    dict['about_value_3'] = { es: 'Datos para tomar mejores decisiones', en: 'Data for better decisions' };
    dict['about_features_title'] = { es: 'Qué ofrece AI Fitness', en: 'What AI Fitness Offers' };
    dict['about_feat_1_t'] = { es: 'Plan personalizado', en: 'Personalized plan' };
    dict['about_feat_1_p'] = { es: 'Nutrición y entrenamiento ajustados a tus objetivos.', en: 'Nutrition and training tailored to your goals.' };
    dict['about_feat_2_t'] = { es: 'Seguimiento', en: 'Tracking' };
    dict['about_feat_2_p'] = { es: 'Dashboard con métricas clave y progreso.', en: 'Dashboard with key metrics and progress.' };
    dict['about_feat_3_t'] = { es: 'Recomendaciones', en: 'Recommendations' };
    dict['about_feat_3_p'] = { es: 'Tips de alimentación y rutinas basadas en datos.', en: 'Food and routine tips based on data.' };
  } catch (e) { }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      const path = (window.location && window.location.pathname) || '/';
      if (path !== '/') {
        const rawUser = localStorage.getItem('ai_fitness_user');
        if (!rawUser) {
          try { window.location.replace('/'); } catch (e) { window.location.href = '/'; }
          return; // stop initializing on protected pages when not logged in
        }
      }
    } catch (e) { /* ignore */ }
    const stored = localStorage.getItem('ai_fitness_lang') || 'es';
    // apply
    setLang(stored);

    const esBtns = document.querySelectorAll('[id="lang-es"]');
    const enBtns = document.querySelectorAll('[id="lang-en"]');

    esBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setLang('es');
      });
    });

    enBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setLang('en');
      });
    });
  });

})();
