(function () {
    window.Runner.logic = {};
    const logic = window.Runner.logic;
    const { EQUIPMENT_MAP } = window.Runner.constants;

    logic.getEquipmentMeta = (equipmentKey) => {
        return EQUIPMENT_MAP[equipmentKey] || { label: equipmentKey || "N/A", icon: "fas fa-dumbbell" };
    };

    logic.toEmbedUrl = (url) => {
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
    };

    logic.openVideoModal = (url) => {
        const embedUrl = logic.toEmbedUrl(url);
        if (!embedUrl) return;
        window.dispatchEvent(new CustomEvent("runner:openVideoModal", { detail: { url: embedUrl } }));
    };

    logic.resolveSubstitutes = (substitutes, exerciseLookup) => {
        if (!substitutes || substitutes.length === 0) return [];
        return substitutes
            .map(sub => {
                if (typeof sub === "string" || typeof sub === "number") {
                    return exerciseLookup[String(sub)];
                }
                if (sub && typeof sub === "object") {
                    const oid = sub.$oid || sub.oid;
                    if (oid) return exerciseLookup[String(oid)] || null;
                    const subId = sub._id || sub.exercise_id || sub.id;
                    if (subId != null) return exerciseLookup[String(subId)] || sub;
                    return sub;
                }
                return null;
            })
            .filter(Boolean);
    };

    logic.getExerciseId = (exercise) => {
        if (!exercise) return null;
        const raw = exercise.exercise_id || exercise._id || exercise.id || null;
        if (!raw) return null;
        if (typeof raw === "object") {
            return raw.$oid || raw.oid || null;
        }
        return raw;
    };

    logic.getExerciseWithLookup = (exercise, exerciseLookup) => {
        if (!exercise) return exercise;
        const exId = logic.getExerciseId(exercise);
        if (!exId) return exercise;
        const fromLookup = exerciseLookup[String(exId)];
        if (!fromLookup) return exercise;
        const merged = { ...fromLookup, ...exercise };
        ["substitutes", "equivalents", "equivalent_exercises"].forEach((field) => {
            const lookupVal = fromLookup[field];
            const exerciseVal = exercise[field];
            if (Array.isArray(lookupVal) && lookupVal.length > 0) {
                if (!Array.isArray(exerciseVal) || exerciseVal.length === 0) {
                    merged[field] = lookupVal;
                }
            }
        });
        return merged;
    };

    logic.mergeExerciseForSwap = (original, substitute) => {
        if (!substitute) return original;
        const merged = { ...original, ...substitute };
        const substituteId = logic.getExerciseId(substitute);
        if (substituteId) {
            merged.exercise_id = substituteId;
            merged._id = substitute._id || substituteId;
        }
        merged.exercise_name = substitute.exercise_name || substitute.name || original.exercise_name || original.name;
        merged.name = substitute.exercise_name || substitute.name || original.name || original.exercise_name;
        return merged;
    };

    logic.getRestSeconds = (item) => {
        if (!item) return 60;
        if (item.rest_seconds != null) return item.rest_seconds;
        if (item.rest != null && item.rest !== item.target_time_seconds) return item.rest;
        return 60;
    };

    logic.buildQueue = (routine) => {
        const queue = [];
        const items = Array.isArray(routine.items) ? routine.items : [];
        const isRestItem = (item) => item && (item.item_type === 'rest' || (!item.exercise_id && item.rest_seconds != null));
        const isExerciseItem = (item) => item && item.item_type === 'exercise';
        const isGroupItem = (item) => item && item.item_type === 'group';
        const groupMeta = new Map();

        items.filter(isGroupItem).forEach(group => {
            groupMeta.set(group._id, {
                name: group.group_name || group.name || 'Grupo',
                note: group.note || ''
            });
        });

        const pushRestIfPositive = (restItem, key, labelOverride) => {
            const duration = parseInt(logic.getRestSeconds(restItem));
            if (!duration || duration <= 0) return;
            queue.push({
                id: `rest_${key}_${queue.length}`,
                type: 'rest',
                duration,
                label: labelOverride || restItem.note || 'Descansar'
            });
        };

        const pushWorkStep = (ex, key, setNumber, totalSets, groupInfo) => {
            const exType = (ex.exercise_type || ex.type);
            const hasTimeTarget = ex.target_time_seconds != null || ex.time_seconds != null || ex.time != null;
            const hasRepsTarget = ex.target_reps != null || ex.reps != null;
            const isTime = exType === 'time' || exType === 'cardio' || (hasTimeTarget && !hasRepsTarget);
            queue.push({
                id: `step_${key}_${setNumber}`,
                routineItemId: ex._id || ex.id,
                type: 'work',
                exercise: ex,
                groupName: groupInfo ? groupInfo.name : null,
                groupComment: groupInfo ? groupInfo.note : null,
                setNumber,
                totalSets,
                isTimeBased: isTime,
                target: {
                    weight: ex.weight,
                    reps: ex.target_reps || ex.reps,
                    time: ex.target_time_seconds || ex.time_seconds || ex.time || 60
                }
            });
        };

        const hasExplicitRest = (item) => {
            if (!item) return false;
            if (item.rest_seconds != null) return true;
            if (item.rest != null && item.rest !== item.target_time_seconds) return true;
            return false;
        };

        const addStraightSets = (ex, key, groupInfo, addPostRest) => {
            const exSets = parseInt(ex.target_sets || ex.sets || 1);
            for (let s = 1; s <= exSets; s++) {
                pushWorkStep(ex, key, s, exSets, groupInfo);
                if (s < exSets) {
                    pushRestIfPositive(ex, `${key}_${s}`, 'Descansar');
                }
            }
            if (addPostRest && hasExplicitRest(ex)) {
                pushRestIfPositive(ex, `${key}_post`, 'Descansar');
            }
        };

        const hasEmbeddedGroups = items.some(item => Array.isArray(item.items));
        if (hasEmbeddedGroups) {
            const hasNextWorkAfterIndex = (startIdx) => {
                return items.slice(startIdx + 1).some(item => {
                    if (isRestItem(item)) return false;
                    if (Array.isArray(item.items)) return item.items.some(sub => isExerciseItem(sub));
                    return isExerciseItem(item);
                });
            };

            items.forEach((group, gIdx) => {
                if (isGroupItem(group) && !Array.isArray(group.items)) return;
                if (isRestItem(group)) {
                    pushRestIfPositive(group, gIdx);
                    return;
                }

                const entries = Array.isArray(group.items) ? group.items : [group];
                const exerciseEntries = entries.filter(isExerciseItem);
                const restEntries = entries.filter(isRestItem);
                if (!exerciseEntries.length && restEntries.length) {
                    restEntries.forEach((restItem, rIdx) => pushRestIfPositive(restItem, `${gIdx}_${rIdx}`));
                    return;
                }

                const maxSets = Math.max(...exerciseEntries.map(ex => parseInt(ex.target_sets || ex.sets || 1)));
                const groupInfo = {
                    name: group.name || group.group_name || 'Circuito',
                    note: group.note || ''
                };

                for (let s = 1; s <= maxSets; s++) {
                    entries.forEach((entry, exIdx) => {
                        if (isRestItem(entry)) {
                            pushRestIfPositive(entry, `${gIdx}_${exIdx}_${s}`);
                            return;
                        }
                        if (!isExerciseItem(entry)) return;
                        const exSets = parseInt(entry.target_sets || entry.sets || 1);
                        if (s <= exSets) {
                            pushWorkStep(entry, `${gIdx}_${exIdx}`, s, exSets, groupInfo);
                            const restTime = parseInt(logic.getRestSeconds(entry));
                            if (hasExplicitRest(entry) && restTime > 0) {
                                pushRestIfPositive({ rest_seconds: restTime }, `${gIdx}_${exIdx}_${s}_rest`, 'Descansar');
                            }
                        }
                    });
                }
            });
        } else {
            const groupEntries = new Map();
            const blocks = [];
            const blockIds = new Set();

            const ensureGroupBlock = (groupId) => {
                if (!groupId || blockIds.has(groupId)) return;
                blockIds.add(groupId);
                blocks.push({ type: 'group', id: groupId });
            };

            items.forEach((item, idx) => {
                if (isGroupItem(item)) {
                    ensureGroupBlock(item._id);
                    return;
                }
                if (!isExerciseItem(item) && !isRestItem(item)) return;

                if (item.group_id) {
                    ensureGroupBlock(item.group_id);
                    if (!groupEntries.has(item.group_id)) groupEntries.set(item.group_id, []);
                    groupEntries.get(item.group_id).push(item);
                    return;
                }

                blocks.push({ type: 'entry', entry: item, key: `ungrouped_${idx}` });
            });

            const processedGroups = new Set();
            const hasWorkInBlock = (block) => {
                if (block.type === 'entry') return isExerciseItem(block.entry);
                if (block.type === 'group') {
                    const entries = groupEntries.get(block.id) || [];
                    return entries.some(isExerciseItem);
                }
                return false;
            };
            const hasNextWorkBlock = (blockIdx) => blocks.slice(blockIdx + 1).some(hasWorkInBlock);

            blocks.forEach((block, blockIdx) => {
                if (block.type === 'entry') {
                    const entry = block.entry;
                    if (isRestItem(entry)) {
                        pushRestIfPositive(entry, block.key);
                    } else if (isExerciseItem(entry)) {
                        addStraightSets(entry, block.key, null, hasNextWorkBlock(blockIdx));
                    }
                    return;
                }

                if (processedGroups.has(block.id)) return;
                processedGroups.add(block.id);
                const entries = groupEntries.get(block.id) || [];
                if (!entries.length) return;

                const exerciseEntries = entries.filter(isExerciseItem);
                const restEntries = entries.filter(isRestItem);
                if (!exerciseEntries.length && restEntries.length) {
                    restEntries.forEach((restItem, rIdx) => pushRestIfPositive(restItem, `group_${block.id}_${rIdx}`));
                    return;
                }

                const maxSets = Math.max(...exerciseEntries.map(ex => parseInt(ex.target_sets || ex.sets || 1)));
                const groupInfo = groupMeta.has(block.id)
                    ? groupMeta.get(block.id)
                    : { name: 'Grupo', note: '' };
                for (let s = 1; s <= maxSets; s++) {
                    entries.forEach((entry, entryIdx) => {
                        if (isRestItem(entry)) {
                            pushRestIfPositive(entry, `group_${block.id}_${entryIdx}_${s}`);
                            return;
                        }
                        if (!isExerciseItem(entry)) return;
                        const exSets = parseInt(entry.target_sets || entry.sets || 1);
                        if (s <= exSets) {
                            pushWorkStep(entry, `group_${block.id}_${entryIdx}`, s, exSets, groupInfo);
                            const restTime = parseInt(logic.getRestSeconds(entry));
                            if (hasExplicitRest(entry) && restTime > 0) {
                                pushRestIfPositive(
                                    { rest_seconds: restTime },
                                    `group_${block.id}_${entryIdx}_${s}_rest`,
                                    'Descansar'
                                );
                            }
                        }
                    });

                    // Descansos del grupo se agregan por ejercicio o por items explícitos.
                }
            });
        }

        return queue;
    };
})();
