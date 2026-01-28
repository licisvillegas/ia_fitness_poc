(function initExerciseConsts() {
    // Constantes de UI: paginacion, etiquetas y iconos
    window.ExercisesConsts = {
        pageSize: 24,
        equipmentMeta: {
            barbell: { label: "Barra", icon: "fas fa-grip-lines" },
            dumbbell: { label: "Mancuerna", icon: "fas fa-dumbbell" },
            machine: { label: "M\u00e1quina", icon: "fas fa-cogs" },
            cable: { label: "Polea", icon: "fas fa-wave-square" },
            band: { label: "Banda", icon: "fas fa-link" },
            bench: { label: "Banco", icon: "fas fa-chair" },
            bodyweight: { label: "Corporal", icon: "fas fa-running" },
            other: { label: "Otro", icon: "fas fa-toolbox" }
        },
        typeMeta: {
            weight: "Peso",
            time: "Tiempo",
            cardio: "Cardio",
            reps: "Repeticiones"
        },
        muscleIcons: [
            { key: 'chest', img: 'pec.png', label: 'Pecho' },
            { key: 'back', img: 'esp.png', label: 'Espalda' },
            { key: 'shoulders', img: 'hom.png', label: 'Hombro' },
            { key: 'biceps', img: 'bic.png', label: 'B\u00edceps' },
            { key: 'triceps', img: 'tri.png', label: 'Tr\u00edceps' },
            { key: 'quadriceps', img: 'cua.png', label: 'Pierna' },
            { key: 'core', img: 'abs.png', label: 'Abdomen' },
            { key: 'glutes', img: 'glu.png', label: 'Gl\u00fateos' }
        ]
    };
})();
