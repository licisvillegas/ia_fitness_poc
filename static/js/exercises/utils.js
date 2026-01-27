(function initExerciseUtils() {
    // Utilidades comunes para formato y URLs
    window.ExercisesUtils = {
        capitalize(value) {
            if (!value) return "";
            return value.charAt(0).toUpperCase() + value.slice(1);
        },
        normalizeEquipmentList(value) {
            if (!value) return [];
            if (Array.isArray(value)) {
                return value.map(v => String(v).trim()).filter(Boolean);
            }
            if (typeof value === "string") {
                return value.split(",").map(v => v.trim()).filter(Boolean);
            }
            return [String(value).trim()].filter(Boolean);
        },
        getEquipmentLabels(value) {
            const list = window.ExercisesUtils.normalizeEquipmentList(value);
            return list.map(item => {
                const key = String(item).toLowerCase();
                const meta = window.ExercisesConsts?.equipmentMeta?.[key];
                return (meta || { label: item }).label;
            });
        },
        getPrimaryEquipment(value) {
            const list = window.ExercisesUtils.normalizeEquipmentList(value);
            return list.length ? String(list[0]).toLowerCase() : "";
        },
        toEmbedUrl(url) {
            const trimmed = (url || "").trim();
            if (!trimmed) return "";
            if (trimmed.includes("youtube.com/watch")) {
                const match = trimmed.match(/[?&]v=([^&]+)/);
                if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
            }
            if (trimmed.includes("youtu.be/")) {
                const match = trimmed.match(/youtu\.be\/([^?&]+)/);
                if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
            }
            return trimmed;
        }
    };
})();
