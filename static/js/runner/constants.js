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

    // Body part map placeholder, if needed. 
    // In the original file it was initialized empty.
    window.Runner.constants.BODY_PART_MAP = {};

    window.Runner.constants.translateBodyPart = (bp) => {
        return window.Runner.constants.BODY_PART_MAP[bp] || bp || "N/A";
    };
})();
