(function () {
    const { useState, useEffect } = React;
    const { useWorkout } = window.Runner.hooks;
    const { translateBodyPart } = window.Runner.constants;
    const { getEquipmentMeta, getExerciseWithLookup, resolveSubstitutes, getRestSeconds, openVideoModal } = window.Runner.logic;

    window.Runner.components.RoutineDetails = ({ routine }) => {
        const { exerciseLookup, applySubstitute, showConfirm, queue, updateTimeTargetForItem } = useWorkout();
        const [blocks, setBlocks] = useState([]);
        const [manualTimeEnabled, setManualTimeEnabled] = useState({});
        const [manualTimeMinutes, setManualTimeMinutes] = useState({});
        const timeOptions = [600, 900, 1200, 1800, 3600];

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
                    <div key={key} className="routine-preview-item d-flex justify-content-between align-items-center mb-1" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
                        <div>
                            <div className="text-white small fw-bold"><i className="fas fa-hourglass-half me-2 text-secondary"></i>{restLabel}</div>
                        </div>
                        <div className="text-end text-secondary small">{restSeconds}s</div>
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
            const timeValue = Number(mergedEx.target_time_seconds || mergedEx.time_seconds || 600);
            const timeSelectValue = timeOptions.includes(timeValue) ? timeValue : 600;
            const manualEnabled = Boolean(manualTimeEnabled[routineItemId]);
            const defaultMinutes = Math.max(1, Math.round(timeSelectValue / 60));
            const manualMinutesValue = manualTimeMinutes[routineItemId] ?? defaultMinutes;

            let setsRepText = `${sets} sets ${isTime ? `x ${time || 60}s` : `x ${reps || '-'}`}`;
            if (item.series && Array.isArray(item.series) && item.series.length > 0) {
                setsRepText = `${item.series.length} series: ` + item.series.map(s => s.reps).join('/');
            }


            return (
                <div key={key} className="routine-preview-item d-flex justify-content-between align-items-start mb-2" style={{ background: 'rgba(40,40,45,0.8)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-dark text-secondary border border-secondary" style={{ fontSize: '0.6rem', minWidth: '20px' }}>{(key.split('_').pop() * 1) + 1}</span>
                            <div className="text-white fw-bold" style={{ fontSize: '0.9rem' }}>{name}</div>
                            {hasVideo && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-link p-0 text-danger"
                                    onClick={() => openVideoModal(mergedEx.video_url)}
                                >
                                    <i className="fab fa-youtube"></i>
                                </button>
                            )}
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                            <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>{bodyPartLabel}</span>
                            <span className="badge bg-dark border border-secondary text-info" style={{ fontSize: '0.65rem' }}>
                                <i className={`${equipmentMeta.icon} me-1`}></i>{equipmentMeta.label}
                            </span>
                        </div>
                        {(mergedEx.comment || mergedEx.note) && (
                            <div className="mt-2 text-warning small fst-italic">
                                <i className="fas fa-sticky-note me-1"></i> {mergedEx.comment || mergedEx.note}
                            </div>
                        )}
                        {isTime && (
                            <div className="mt-2 d-flex align-items-center gap-2">
                                <span className="text-secondary small">Tiempo:</span>
                                {!manualEnabled ? (
                                    <select
                                        className="form-select form-select-sm bg-dark text-white border-secondary"
                                        style={{ width: "110px", fontSize: '0.75rem', padding: '2px 4px' }}
                                        value={timeSelectValue}
                                        onChange={(e) => {
                                            const seconds = Number(e.target.value);
                                            updateTimeTargetForItem(routineItemId, seconds);
                                            if (manualEnabled) {
                                                const minutes = Math.max(1, Math.round(seconds / 60));
                                                setManualTimeMinutes(prev => ({ ...prev, [routineItemId]: minutes }));
                                            }
                                        }}
                                    >
                                        {timeOptions.map(opt => (
                                            <option key={opt} value={opt}>{Math.round(opt / 60)} min</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="input-group input-group-sm" style={{ width: "100px" }}>
                                        <input
                                            type="number"
                                            min="1"
                                            max="240"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            className="form-control bg-dark text-white border-secondary text-center p-1"
                                            value={manualMinutesValue}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const minutes = Number(e.target.value);
                                                if (!Number.isFinite(minutes)) return;
                                                const clamped = Math.max(1, Math.min(240, minutes));
                                                setManualTimeMinutes(prev => ({ ...prev, [routineItemId]: clamped }));
                                                updateTimeTargetForItem(routineItemId, clamped * 60);
                                            }}
                                        />
                                        <span className="input-group-text bg-dark text-white border-secondary p-1">m</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className={`btn btn-sm ${manualEnabled ? 'btn-info text-dark' : 'btn-outline-secondary'} p-1`}
                                    title={manualEnabled ? "Usar lista" : "Editar minutos"}
                                    onClick={() => {
                                        setManualTimeEnabled(prev => {
                                            const nextEnabled = !prev[routineItemId];
                                            if (nextEnabled) {
                                                setManualTimeMinutes(minutesPrev => ({
                                                    ...minutesPrev,
                                                    [routineItemId]: manualMinutesValue
                                                }));
                                            }
                                            return { ...prev, [routineItemId]: nextEnabled };
                                        });
                                    }}
                                >
                                    <i className="fas fa-pen" style={{ fontSize: '0.7rem' }}></i>
                                </button>
                            </div>
                        )}
                        {substitutes.length > 0 && (
                            <div className="mt-2">
                                <button
                                    className="btn btn-sm btn-link text-info p-0"
                                    style={{ fontSize: '0.7rem', textDecoration: 'none' }}
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#${subsId}`}
                                    aria-expanded="false"
                                    aria-controls={subsId}
                                >
                                    <i className="fas fa-exchange-alt me-1"></i> Sustitutos ({substitutes.length})
                                </button>
                                <div className="collapse mt-1" id={subsId}>
                                    <div className="d-flex flex-column gap-1 ps-2 border-start border-info">
                                        {substitutes.map((sub, sIdx) => {
                                            const subEquipment = getEquipmentMeta(sub.equipment);
                                            const subHasVideo = sub.video_url && sub.video_url.trim() !== "";
                                            return (
                                                <div key={`${key}_sub_${sIdx}`} className="d-flex align-items-center justify-content-between">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="text-secondary small" style={{ fontSize: '0.8rem' }}>{sub.name || "Ejercicio"}</div>
                                                        {subHasVideo && (
                                                            <button className="btn btn-sm btn-link p-0 text-danger" onClick={() => openVideoModal(sub.video_url)}>
                                                                <i className="fab fa-youtube" style={{ fontSize: '0.8rem' }}></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {stepIdx !== -1 && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-link text-success p-0 ms-4"
                                                            style={{ fontSize: '0.7rem' }}
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
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="text-end text-secondary small ms-2" style={{ minWidth: '80px' }}>
                        <div className="fw-bold text-light">{setsRepText}</div>
                        <div>Descanso {restSeconds}s</div>
                    </div>
                </div>
            );
        };

        if (!routine) return <div className="text-white text-center">No routine data</div>;

        const partsLabel = routine.body_parts && routine.body_parts.length > 0
            ? routine.body_parts.map(bp => bp.name).join(", ")
            : "General";
        const dayLabel = (routine.routine_day && window.translateDay) ? window.translateDay(routine.routine_day) : (routine.routine_day || "Flexible");
        const validity = routine.assigned_expires_at && window.formatDate ? window.formatDate(routine.assigned_expires_at) : (routine.is_active !== false ? "Activa" : "Oculta");

        return (
            <div className="routine-preview-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '16px' }}>
                <div className="text-center mb-3">
                    <div className="h3 fw-bold text-white mb-1">{routine.name || "Rutina"}</div>
                    <div className="text-secondary small">{totalExercises} ejercicios - Revisa los detalles antes de iniciar</div>
                </div>
                <div className="row g-2 mb-3">
                    <div className="col-6">
                        <div className="text-secondary small">Grupos</div>
                        <div className="text-info small">{partsLabel}</div>
                    </div>
                    <div className="col-6">
                        <div className="text-secondary small">Día</div>
                        <div className="text-warning small">{dayLabel}</div>
                    </div>
                    <div className="col-6">
                        <div className="text-secondary small">Ejercicios</div>
                        <div className="text-white small">{totalExercises}</div>
                    </div>
                    <div className="col-6">
                        <div className="text-secondary small">Estado</div>
                        <div className="text-white small">{validity}</div>
                    </div>
                </div>
                <hr className="border-secondary" />

                <div className="routine-preview-scroll d-flex flex-column gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {blocks.map((block, idx) => {
                        if (block.type === 'group' || block.type === 'inline_group') {
                            const blockName = block.name || (block.item && (block.item.group_name || block.item.name)) || "Circuito";
                            const blockNote = block.note || (block.item && (block.item.note || block.item.description)) || "";

                            return (
                                <div key={`routine_group_${idx}`} className="mt-3 mb-2 p-2 rounded" style={{ background: 'rgba(0, 210, 255, 0.05)', border: '1px dashed rgba(0, 210, 255, 0.2)' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div className="text-info fw-bold small text-uppercase">{blockName}</div>
                                        <div className="text-secondary small" style={{ fontSize: '0.7rem' }}>{block.entries.length} items</div>
                                    </div>
                                    {blockNote && <div className="text-secondary small fst-italic mb-2">"{blockNote}"</div>}
                                    {block.entries.map((entry, entryIdx) => renderEntry(entry, `b${idx}_${entryIdx}`))}
                                </div>
                            );
                        } else if (block.type === 'ungrouped_chunk') {
                            return (
                                <div key={`routine_block_${idx}`}>
                                    <h6 className="text-cyber-blue small fw-bold text-uppercase mt-3 mb-2">Ejercicios</h6>
                                    <div className="d-flex flex-column gap-2">
                                        {block.entries.map((entry, entryIdx) => renderEntry(entry, `b${idx}_${entryIdx}`))}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                    {blocks.length === 0 && <div className="text-muted text-center py-3">No hay ejercicios en esta rutina.</div>}
                </div>
            </div>
        );
    };
})();
