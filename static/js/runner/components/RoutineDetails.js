(function () {
    const { useState, useEffect } = React;
    const { useWorkout } = window.Runner.hooks;
    const { translateBodyPart } = window.Runner.constants;
    const { getEquipmentMeta, getExerciseWithLookup, resolveSubstitutes, getRestSeconds, openVideoModal } = window.Runner.logic;

    window.Runner.components.RoutineDetails = ({ routine }) => {
        const { exerciseLookup, applySubstitute, showConfirm, queue } = useWorkout();
        const [expandedGroups, setExpandedGroups] = useState(new Set());
        const [blocks, setBlocks] = useState([]);

        const toggleGroup = (groupId) => {
            const next = new Set(expandedGroups);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            setExpandedGroups(next);
        };

        useEffect(() => {
            if (!routine || !routine.items) {
                setBlocks([]);
                return;
            }

            const items = Array.isArray(routine.items) ? routine.items : [];
            const isRestItem = (item) => item && (item.item_type === 'rest' || (!item.exercise_id && item.rest_seconds != null));
            const isExerciseItem = (item) => item && item.item_type === 'exercise';
            const isGroupHeader = (item) => item && item.item_type === 'group';
            const buildEntry = (item) => (isRestItem(item) ? { type: 'rest', data: item } : { type: 'exercise', data: item });

            const groupMetaMap = new Map();
            items.forEach(item => {
                if (isGroupHeader(item)) {
                    groupMetaMap.set(item._id || item.id, {
                        name: item.group_name || item.name || "Circuito",
                        note: item.note || item.description || ""
                    });
                }
            });

            const newBlocks = [];
            const blockIds = new Set();
            const groupEntries = new Map();

            const ensureGroupBlock = (groupId) => {
                if (!groupId || blockIds.has(groupId)) return;
                blockIds.add(groupId);
                newBlocks.push({ type: 'group', id: groupId });
            };

            items.forEach((item, idx) => {
                if (item.item_type === 'group' || Array.isArray(item.items)) {
                    if (Array.isArray(item.items) && item.items.length > 0) {
                        const entries = item.items
                            .filter(sub => isExerciseItem(sub) || isRestItem(sub))
                            .map(buildEntry);
                        if (entries.length > 0) {
                            newBlocks.push({
                                type: 'inline_group',
                                item: item,
                                entries: entries
                            });
                        }
                        return;
                    }
                    ensureGroupBlock(item._id || item.id);
                    return;
                }

                if (isExerciseItem(item) || isRestItem(item)) {
                    const gid = item.group_id;
                    if (gid) {
                        ensureGroupBlock(gid);
                        if (!groupEntries.has(gid)) groupEntries.set(gid, []);
                        groupEntries.get(gid).push(buildEntry(item));
                    } else {
                        newBlocks.push({ type: 'ungrouped', entry: buildEntry(item) });
                    }
                }
            });

            const validBlocks = newBlocks.map(block => {
                if (block.type === 'group') {
                    const entries = groupEntries.get(block.id) || [];
                    const meta = groupMetaMap.get(block.id) || { name: "Circuito", note: "" };
                    if (entries.length === 0) return null;
                    return { ...block, entries, name: meta.name, note: meta.note };
                }
                return block;
            }).filter(Boolean);

            const consolidatedBlocks = [];
            let currentUngroupedRequest = null;

            validBlocks.forEach(block => {
                if (block.type === 'ungrouped') {
                    if (!currentUngroupedRequest) {
                        currentUngroupedRequest = { type: 'ungrouped_chunk', entries: [] };
                        consolidatedBlocks.push(currentUngroupedRequest);
                    }
                    currentUngroupedRequest.entries.push(block.entry);
                } else {
                    currentUngroupedRequest = null;
                    consolidatedBlocks.push(block);
                }
            });

            setBlocks(consolidatedBlocks);

        }, [routine]);

        const totalExercises = blocks.reduce((acc, block) => {
            if (block.entries) {
                return acc + block.entries.filter(e => e.type === 'exercise').length;
            }
            return acc;
        }, 0);

        const findStepIndex = (routineItemId) => {
            if (!queue || !routineItemId) return -1;
            return queue.findIndex(step => {
                if (step.type !== 'work') return false;
                return String(step.routineItemId) === String(routineItemId);
            });
        };

        const renderEntry = (entry, key) => {
            if (entry.type === 'rest') {
                const restSeconds = getRestSeconds(entry.data);
                const restLabel = entry.data.note || "Descanso";
                return (
                    <div key={key} className="d-flex justify-content-between align-items-center border border-secondary rounded px-2 py-2 bg-black-trans">
                        <div>
                            <div className="text-white fw-bold">{restLabel}</div>
                            <div className="text-secondary small">Pausa</div>
                        </div>
                        <div className="text-end text-secondary small">
                            <div>{restSeconds}s</div>
                        </div>
                    </div>
                );
            }

            const item = entry.data || {};
            const routineItemId = item._id || item.id;
            const stepIdx = findStepIndex(routineItemId);
            const step = stepIdx !== -1 ? queue[stepIdx] : null;

            const ex = step ? step.exercise : item;
            const mergedEx = getExerciseWithLookup(ex, exerciseLookup);

            const isTime = (mergedEx.exercise_type || mergedEx.type) === 'time' || (mergedEx.exercise_type || mergedEx.type) === 'cardio';
            const name = mergedEx.exercise_name || mergedEx.name || "Ejercicio";
            const bodyPartLabel = translateBodyPart(mergedEx.body_part);
            const equipmentMeta = getEquipmentMeta(mergedEx.equipment);
            const hasVideo = mergedEx.video_url && mergedEx.video_url.trim() !== "";
            const substitutes = resolveSubstitutes(
                mergedEx.substitutes || mergedEx.equivalents || mergedEx.equivalent_exercises || [],
                exerciseLookup
            );
            const subsId = `subs_${key}`;
            const sets = mergedEx.target_sets || mergedEx.sets || 1;
            const reps = mergedEx.target_reps || mergedEx.reps;
            const time = mergedEx.target_time_seconds || mergedEx.time_seconds;
            const restSeconds = getRestSeconds(mergedEx);

            return (
                <div key={key} className="d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <div className="text-white fw-bold">{name}</div>
                            {hasVideo && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    title="Ver video"
                                    onClick={() => openVideoModal(mergedEx.video_url)}
                                >
                                    <i className="fab fa-youtube"></i>
                                </button>
                            )}
                        </div>
                        <div className="text-secondary small d-flex flex-wrap gap-2 mt-1">
                            <span className="badge bg-secondary">{bodyPartLabel}</span>
                            <span className="badge bg-dark border border-secondary text-info">
                                <i className={`${equipmentMeta.icon} me-1`}></i>{equipmentMeta.label}
                            </span>
                        </div>
                        {(mergedEx.comment || mergedEx.note) && (
                            <div className="mt-2 text-warning small fst-italic">
                                <i className="fas fa-sticky-note me-1"></i> {mergedEx.comment || mergedEx.note}
                            </div>
                        )}
                        {substitutes.length > 0 && (
                            <div className="mt-2">
                                <button
                                    className="btn btn-sm btn-outline-info"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#${subsId}`}
                                    aria-expanded="false"
                                    aria-controls={subsId}
                                >
                                    Sustitutos ({substitutes.length})
                                </button>
                                <div className="collapse mt-2" id={subsId}>
                                    <div className="d-flex flex-column gap-2">
                                        {substitutes.map((sub, sIdx) => {
                                            const subEquipment = getEquipmentMeta(sub.equipment);
                                            const subHasVideo = sub.video_url && sub.video_url.trim() !== "";
                                            return (
                                                <div key={`${key}_sub_${sIdx}`} className="d-flex align-items-center justify-content-between border border-secondary rounded px-2 py-2">
                                                    <div>
                                                        <div className="fw-bold text-white">{sub.name || "Ejercicio"}</div>
                                                        <div className="small text-secondary">
                                                            <i className={`${subEquipment.icon} me-1`}></i>{subEquipment.label}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        {subHasVideo && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger"
                                                                title="Ver video"
                                                                onClick={() => openVideoModal(sub.video_url)}
                                                            >
                                                                <i className="fab fa-youtube"></i>
                                                            </button>
                                                        )}
                                                        {stepIdx !== -1 && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-success"
                                                                title="Usar este ejercicio"
                                                                onClick={() => {
                                                                    const subName = sub.exercise_name || sub.name || "Ejercicio";
                                                                    const subEquip = getEquipmentMeta(sub.equipment).label;
                                                                    const origEquip = getEquipmentMeta(mergedEx.equipment).label;
                                                                    showConfirm(
                                                                        "Confirmar sustituto",
                                                                        `¿Aplicar "${subName}" (${subEquip}) en lugar de "${name}" (${origEquip}) a todas las series?`,
                                                                        () => applySubstitute(sub, "remaining", stepIdx),
                                                                        "warning"
                                                                    );
                                                                }}
                                                            >
                                                                Usar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="text-end text-secondary small">
                        <div>{sets} sets {isTime ? `x ${time || 60}s` : `x ${reps || '-'}`}</div>
                        <div>Descanso {restSeconds}s</div>
                    </div>
                </div>
            );
        };

        if (!routine) return <div className="text-white text-center">No routine data</div>;

        return (
            <div className="card mx-3" style={{ background: 'rgba(30,30,30,0.95)', border: '1px solid var(--border-color)', borderRadius: '20px', minHeight: '300px', opacity: 1 }}>
                <div className="card-body">
                    <div className="text-center mb-4">
                        <h2 className="display-6 fw-bold text-white mb-2">{routine.name || "Rutina"}</h2>
                        <p className="text-secondary m-0">{totalExercises} ejercicios -  Revisa los detalles antes de iniciar</p>
                    </div>

                    <div className="d-flex flex-column gap-3 overflow-auto custom-scroll" style={{ maxHeight: '240px' }}>
                        {blocks.map((block, idx) => {
                            if (block.type === 'group' || block.type === 'inline_group') {
                                const blockId = block.id || (block.item && (block.item._id || block.item.id)) || `grp_${idx}`;
                                const blockName = block.name || (block.item && (block.item.group_name || block.item.name)) || "Circuito";
                                const blockNote = block.note || (block.item && (block.item.note || block.item.description)) || "";
                                const isExpanded = expandedGroups.has(blockId);

                                return (
                                    <div key={`routine_group_${idx}`} className="p-3 border border-secondary rounded-3 bg-black-trans">
                                        <div
                                            className="d-flex justify-content-between align-items-center cursor-pointer"
                                            onClick={() => toggleGroup(blockId)}
                                        >
                                            <div>
                                                <div className="text-cyber-orange text-uppercase small fw-bold">
                                                    {blockName} ({block.entries.length} items)
                                                </div>
                                                {blockNote && <div className="text-white small mt-1 fst-italic">"{blockNote}"</div>}
                                            </div>
                                            <i className={`fas fa-chevron-down text-secondary transition-icon ${isExpanded ? 'rotate-180' : ''}`}></i>
                                        </div>
                                        {isExpanded && (
                                            <div className="d-flex flex-column gap-2 mt-3 animate-fade-in">
                                                {block.entries.map((entry, entryIdx) => renderEntry(entry, `b${idx}_${entryIdx}`))}
                                            </div>
                                        )}
                                    </div>
                                );
                            } else if (block.type === 'ungrouped_chunk') {
                                return (
                                    <div key={`routine_block_${idx}`} className="p-3 border border-secondary rounded-3 bg-black-trans">
                                        <div className="text-cyber-blue fw-bold mb-2">Sin grupo</div>
                                        <div className="d-flex flex-column gap-2">
                                            {block.entries.map((entry, entryIdx) => renderEntry(entry, `b${idx}_${entryIdx}`))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>
            </div>
        );
    };
})();
