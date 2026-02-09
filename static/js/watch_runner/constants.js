(function () {
    window.Runner.constants = {};

    window.Runner.constants.EQUIPMENT_MAP = {
        barbell: { label: "Barra", icon: "fas fa-grip-lines" },
        dumbbell: { label: "Mancuernas", icon: "fas fa-dumbbell" },
        machine: { label: "Maquina", icon: "fas fa-cogs" },
        cable: { label: "Polea", icon: "fas fa-wave-square" },
        bodyweight: { label: "Corporal", icon: "fas fa-running" },
        other: { label: "Otro", icon: "fas fa-toolbox" }
    };

    // Marcador de posición para mapa de partes del cuerpo, si es necesario.
    // En el archivo original se inicializaba vacío.
    window.Runner.constants.BODY_PART_MAP = {};

    window.Runner.constants.translateBodyPart = (bp) => {
        return window.Runner.constants.BODY_PART_MAP[bp] || bp || "N/A";
    };

    window.Runner.constants.NOTIFICATIONS = {
        REST_START: {
            title: "Inicia Descanso",
            pushTitle: "Tiempo Completado",
            pushBody: "Tu descanso ha terminado. ¡A trabajar!"
        },
        REST_END: {
            titleSuccess: "Finalizó Descanso. Inicia ejercicio",
            pushTitle: "Descanso terminado",
            pushBody: "Tu descanso ha terminado. ¡A trabajar!"
        },
        WORK_START: {
            titleInfo: "Inicia ejercicio"
        },
        MOTIVATION_HALF: {
            pushTitle: "Motivación",
            pushBody: (exName) => `Vas a la mitad de ${exName || "tu ejercicio"}. Sigue así.`
        },
        MOTIVATION_2MIN: {
            pushTitle: "Casi terminas",
            pushBody: "Lo estás logrando. Te faltan 2 minutos."
        },
        IDLE_3MIN: {
            pushTitle: "Motivación",
            pushBody: (exName) => `Vamos, sigue con ${exName || "tu ejercicio"}.`
        },
        IDLE_5MIN: {
            pushTitle: "Retoma la rutina",
            pushBody: (exName) => `Sigue con ${exName || "tu ejercicio"} cuando puedas.`
        },
        WORKOUT_FINISHED: {
            titleSuccess: "Fin de la Rutina",
            pushTitle: "Rutina finalizada",
            pushBody: "Buen trabajo. Tu entrenamiento ha terminado."
        },
        WORKOUT_CANCELLED: {
            titleError: "Rutina cancelada"
        }
    };
})();
