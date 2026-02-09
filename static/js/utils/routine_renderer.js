/**
 * RoutineRenderer.js
 * 
 * Shared utility for rendering detailed routine previews.
 * Unifies logic from assigned_routines.js and admin/user catalogs.
 */

(function (root) {
    const RoutineRenderer = {

        // --- Helper Methods ---

        getRestSeconds: function (item) {
            if (!item) return 60;
            if (item.rest_seconds != null) return item.rest_seconds;
            if (item.rest != null && item.rest !== item.target_time_seconds) return item.rest;
            return 60;
        },

        getEquipmentMeta: function (equipmentKey) {
            const raw = Array.isArray(equipmentKey) ? (equipmentKey[0] || "") : equipmentKey;
            const map = {
                barbell: { label: "Barra", icon: "fas fa-grip-lines" },
                dumbbell: { label: "Mancuernas", icon: "fas fa-dumbbell" },
                machine: { label: "Máquina", icon: "fas fa-cogs" },
                cable: { label: "Polea", icon: "fas fa-wave-square" },
                band: { label: "Banda", icon: "fas fa-link" },
                bench: { label: "Banco", icon: "fas fa-chair" },
                bodyweight: { label: "Corporal", icon: "fas fa-running" },
                other: { label: "Otro", icon: "fas fa-toolbox" }
            };
            return map[raw] || { label: "General", icon: "fas fa-dumbbell" };
        },

        translateBodyPart: function (bp) {
            const map = {
                'chest': 'Pecho', 'back': 'Espalda', 'legs': 'Pierna',
                'shoulders': 'Hombros', 'arms': 'Brazos', 'abs': 'Abdomen',
                'cardio': 'Cardio', 'fullbody': 'Full Body'
            };
            return map[bp] || bp || "General";
        },

        resolveSubstitutes: function (substitutes) {
            if (!Array.isArray(substitutes) || substitutes.length === 0) return [];
            // Handle both object subs and potential string IDs if logic requires it (usually objects in previews)
            return substitutes.filter(s => s && typeof s === 'object');
        },

        toEmbedUrl: function (url) {
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
        },

        openVideoModal: function (url) {
            const embedUrl = this.toEmbedUrl(url);
            if (!embedUrl) return;

            // Check if modal exists in DOM, if not, create it dynamically? 
            // For now assume #videoModal and #videoFrame exist as they are in all templates.
            const modalEl = document.getElementById("videoModal");
            const iframe = document.getElementById("videoFrame");

            if (modalEl && iframe) {
                iframe.src = embedUrl;
                const modal = new bootstrap.Modal(modalEl);
                modal.show();

                modalEl.addEventListener("hidden.bs.modal", () => {
                    iframe.src = "";
                }, { once: true });
            } else {
                console.warn("RoutineRenderer: Video modal elements not found.");
                window.open(url, '_blank');
            }
        },

        // --- Main Build Function ---

        buildPreviewHtml: function (routine) {
            if (!routine) return '';

            let items = [];
            // Normalize items/groups
            if (routine.items && routine.items.length > 0) {
                items = routine.items;
            } else if (routine.groups && routine.groups.length > 0) {
                // Flatten groups
                routine.groups.forEach(g => {
                    items.push({ item_type: 'group', name: g.name, _id: g._id || 'g_' + Math.random(), note: g.note });
                    if (g.items) items.push(...g.items.map(i => ({ ...i, group_id: g._id })));
                });
            }

            const isRestItem = (item) => item && (item.item_type === "rest" || (!item.exercise_id && item.rest_seconds != null));
            const isExerciseItem = (item) => item && (item.item_type === "exercise" || !item.item_type);
            const isGroupHeader = (item) => item && item.item_type === "group";
            const safeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");

            // 1. Pre-scan for Group Metadata
            const groupMetaMap = new Map();
            items.forEach(item => {
                if (isGroupHeader(item)) {
                    groupMetaMap.set(item._id || item.id, {
                        name: item.group_name || item.name || "Circuito",
                        note: item.note || item.description || ""
                    });
                }
            });

            // 2. Cluster items
            const blocks = [];
            const blockIds = new Set();
            const groupEntries = new Map();

            const ensureGroupBlock = (groupId) => {
                if (!groupId || blockIds.has(groupId)) return;
                blockIds.add(groupId);
                blocks.push({ type: 'group', id: groupId });
            };

            items.forEach((item, idx) => {
                // Inline groups
                if (item.item_type === "group" && item.items && Array.isArray(item.items)) {
                    blocks.push({ type: 'inline_group', item: item });
                    return;
                }
                if (item.item_type === "group") {
                    ensureGroupBlock(item._id || item.id);
                    return;
                }

                if (isExerciseItem(item) || isRestItem(item)) {
                    const gid = item.group_id;
                    if (gid) {
                        ensureGroupBlock(gid);
                        if (!groupEntries.has(gid)) groupEntries.set(gid, []);
                        groupEntries.get(gid).push(item);
                    } else {
                        blocks.push({ type: 'ungrouped', entry: item });
                    }
                }
            });

            // 3. Render Blocks
            const htmlParts = [];
            let lastBlockWasUngrouped = false;

            const renderEntry = (item, idxKey) => {
                if (isRestItem(item)) {
                    const restLabel = item.note || "Descanso";
                    const restSeconds = this.getRestSeconds(item);
                    return `
                        <div class="routine-preview-item d-flex justify-content-between align-items-center mb-1" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;">
                            <div>
                                <div class="text-white small fw-bold"><i class="fas fa-hourglass-half me-2 text-secondary"></i>${restLabel}</div>
                            </div>
                            <div class="text-end text-secondary small">${restSeconds}s</div>
                        </div>
                    `;
                }

                const name = item.exercise_name || item.name || "Ejercicio";
                const bodyPartLabel = this.translateBodyPart(item.body_part);
                const sets = item.target_sets || item.sets || 1;
                const reps = item.target_reps || item.reps || "-";
                const time = item.target_time_seconds || item.time_seconds || 60;
                const isTime = (item.exercise_type || item.type) === "time" || (item.exercise_type || item.type) === "cardio";

                let setsRepText = `${sets} sets ${isTime ? `x ${time}s` : `x ${reps}`}`;
                if (item.series && Array.isArray(item.series) && item.series.length > 0) {
                    setsRepText = `${item.series.length} series`;
                }

                const rest = this.getRestSeconds(item);
                const equipmentMeta = this.getEquipmentMeta(item.equipment);
                const hasVideo = item.video_url && item.video_url.trim() !== "";
                const substitutes = this.resolveSubstitutes(item.substitutes || []);
                const subsId = `subs_${safeId(routine._id)}_${idxKey}`;

                return `
                    <div class="routine-preview-item d-flex justify-content-between align-items-start mb-2" style="background: rgba(40,40,45,0.8); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-dark text-secondary border border-secondary" style="font-size: 0.6rem; min-width: 20px;">${idxKey.split('_').pop() * 1 + 1}</span>
                                <div class="text-white fw-bold" style="font-size: 0.9rem;">${name}</div>
                                ${hasVideo ? `
                                    <button class="btn btn-sm btn-link p-0 text-danger" onclick="RoutineRenderer.openVideoModal('${item.video_url}')">
                                        <i class="fab fa-youtube"></i>
                                    </button>
                                ` : ""}
                            </div>
                            <div class="d-flex flex-wrap gap-2 mt-1">
                                <span class="badge bg-secondary" style="font-size: 0.65rem;">${bodyPartLabel}</span>
                                <span class="badge bg-dark border border-secondary text-info" style="font-size: 0.65rem;">
                                    <i class="${equipmentMeta.icon} me-1"></i>${equipmentMeta.label}
                                </span>
                            </div>
                            ${substitutes.length ? `
                                <button class="btn btn-sm btn-link text-info p-0 mt-1" style="font-size: 0.7rem; text-decoration: none;" type="button" data-bs-toggle="collapse" data-bs-target="#${subsId}">
                                    <i class="fas fa-exchange-alt me-1"></i> Sustitutos (${substitutes.length})
                                </button>
                                <div class="collapse mt-1" id="${subsId}">
                                    <div class="d-flex flex-column gap-1 ps-2 border-start border-info">
                                        ${substitutes.map(sub => `
                                            <div class="d-flex align-items-center gap-2">
                                                <div class="text-secondary small" style="font-size: 0.8rem;">${sub.name || "Ejercicio"}</div>
                                                ${sub.video_url ? `
                                                    <button class="btn btn-sm btn-link p-0 text-danger" onclick="RoutineRenderer.openVideoModal('${sub.video_url}')"><i class="fab fa-youtube" style="font-size: 0.8rem;"></i></button>
                                                ` : ""}
                                            </div>
                                        `).join("")}
                                    </div>
                                </div>
                            ` : ""}
                        </div>
                        <div class="text-end text-secondary small ms-2" style="min-width: 80px;">
                            <div class="fw-bold text-light">${setsRepText}</div>
                            <div>Descanso ${rest}s</div>
                        </div>
                    </div>
                `;
            };

            blocks.forEach((block, bIdx) => {
                if (block.type === 'ungrouped') {
                    if (!lastBlockWasUngrouped) {
                        htmlParts.push(`<h6 class="text-cyber-blue small fw-bold text-uppercase mt-3 mb-2">Ejercicios</h6>`);
                        lastBlockWasUngrouped = true;
                    }
                    htmlParts.push(renderEntry(block.entry, `u_${bIdx}`));
                } else if (block.type === 'group') {
                    lastBlockWasUngrouped = false;
                    const entries = groupEntries.get(block.id) || [];
                    const meta = groupMetaMap.get(block.id) || { name: "Circuito", note: "" };

                    if (entries.length > 0) {
                        htmlParts.push(`
                            <div class="mt-3 mb-2 p-2 rounded" style="background: rgba(0, 210, 255, 0.05); border: 1px dashed rgba(0, 210, 255, 0.2);">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="text-info fw-bold small text-uppercase">${meta.name}</div>
                                    <div class="text-secondary small" style="font-size: 0.7rem;">${entries.length} items</div>
                                </div>
                                ${meta.note ? `<div class="text-secondary small fst-italic mb-2">"${meta.note}"</div>` : ""}
                                ${entries.map((entry, eIdx) => renderEntry(entry, `g_${block.id}_${eIdx}`)).join("")}
                            </div>
                        `);
                    }
                } else if (block.type === 'inline_group') {
                    lastBlockWasUngrouped = false;
                    const item = block.item;
                    const entries = (item.items || []).filter(sub => isExerciseItem(sub) || isRestItem(sub));
                    if (entries.length > 0) {
                        htmlParts.push(`
                            <div class="mt-3 mb-2 p-2 rounded" style="background: rgba(255, 165, 0, 0.05); border: 1px dashed rgba(255, 165, 0, 0.2);">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="text-warning fw-bold small text-uppercase">${item.group_name || item.name || "Circuito"}</div>
                                    <div class="text-secondary small" style="font-size: 0.7rem;">${entries.length} items</div>
                                </div>
                                ${(item.note || item.description) ? `<div class="text-secondary small fst-italic mb-2">"${item.note || item.description}"</div>` : ""}
                                ${entries.map((entry, eIdx) => renderEntry(entry, `ig_${bIdx}_${eIdx}`)).join("")}
                            </div>
                        `);
                    }
                }
            });

            if (htmlParts.length === 0) return '<div class="text-muted text-center py-3">No hay ejercicios en esta rutina.</div>';
            return htmlParts.join("");
        }
    };

    // Expose Global
    root.RoutineRenderer = RoutineRenderer;

})(window);
