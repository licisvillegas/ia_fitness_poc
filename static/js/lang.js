(function(){
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
    'plan_ok': { es: '✅ Plan generado con éxito', en: '✅ Plan generated successfully' },
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
  dict['stat_nutrition_title'] = { es: 'Adherencia Nutricional', en: 'Nutrition Adherence' };
  dict['stat_last_label'] = { es: 'Último registro', en: 'Latest record' };
  dict['no_data'] = { es: 'Sin datos disponibles', en: 'No data available' };

  // Mensajes y etiquetas adicionales
  dict['data_loaded'] = { es: '✅ Datos cargados correctamente.', en: '✅ Data loaded successfully.' };
  dict['chart_weight'] = { es: 'Peso (kg)', en: 'Weight (kg)' };
  dict['chart_fat'] = { es: 'Grasa (%)', en: 'Body Fat (%)' };
  dict['chart_performance'] = { es: 'Rendimiento (%)', en: 'Performance (%)' };
  dict['chart_nutrition'] = { es: 'Adherencia Nutricional (%)', en: 'Nutrition Adherence (%)' };

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

  // Buttons, loading and labels
  dict['btn_load_progress'] = { es: 'Cargar progreso', en: 'Load progress' };
  dict['loading_data'] = { es: 'Cargando datos...', en: 'Loading data...' };
  dict['select_user_label'] = { es: 'Selecciona tu ID de usuario', en: 'Select your User ID' };
  dict['generate_section_title'] = { es: 'Genera tu Plan', en: 'Generate your Plan' };

  function t(key){
    const lang = document.documentElement.lang || localStorage.getItem('ai_fitness_lang') || 'es';
    return (dict[key] && dict[key][lang]) || '';
  }

  function updateButtons(lang){
    const esBtn = document.getElementById('lang-es');
    const enBtn = document.getElementById('lang-en');
    if (!esBtn || !enBtn) return;
    esBtn.classList.remove('btn-primary'); esBtn.classList.add('btn-outline-light');
    enBtn.classList.remove('btn-primary'); enBtn.classList.add('btn-outline-light');
    if (lang === 'es') { esBtn.classList.remove('btn-outline-light'); esBtn.classList.add('btn-primary'); }
    if (lang === 'en') { enBtn.classList.remove('btn-outline-light'); enBtn.classList.add('btn-primary'); }
  }

  function translatePage(lang){
    // Nav
    const navDashboard = document.getElementById('nav-dashboard');
    const navPlan = document.getElementById('nav-plan');
    const navNutrition = document.getElementById('nav-nutrition');
    const navHome = document.getElementById('nav-home');
    if (navDashboard) navDashboard.textContent = t('nav_dashboard');
    if (navPlan) navPlan.textContent = t('nav_plan');
    if (navNutrition) navNutrition.textContent = t('nav_nutrition');
    if (navHome) navHome.textContent = t('nav_home');

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
      statHeadings[2].textContent = t('stat_performance_title');
      statHeadings[3].textContent = t('stat_nutrition_title');
    }
    // overlays
    const overlays = ['weight','fat','performance','nutrition'];
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
      if (txt.includes('Datos cargados') || txt.includes('Data loaded') || txt.startsWith('✅')) {
        messageEl.textContent = t('data_loaded');
      }
    }

    // Update chart labels if the page exposes an update function
    if (window.updateChartLabels) {
      try { window.updateChartLabels(); } catch (e) { /* ignore */ }
    }
  }

  function setLang(lang){
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

  document.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('ai_fitness_lang') || 'es';
    // apply
    setLang(stored);
    const esBtn = document.getElementById('lang-es');
    const enBtn = document.getElementById('lang-en');
    if (esBtn) esBtn.addEventListener('click', () => setLang('es'));
    if (enBtn) enBtn.addEventListener('click', () => setLang('en'));
  });

})();
