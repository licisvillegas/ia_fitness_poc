(function initExercisesRender() {
    // Renderizado de tarjetas/lista y paginacion
    const Utils = window.ExercisesUtils;
    const { equipmentMeta: EQUIPMENT_META, pageSize } = window.ExercisesConsts;

    function updateViewUI() {
        const state = window.ExercisesState;
        const gridContainer = document.getElementById('viewGridContainer');
        const listContainer = document.getElementById('viewListContainer');
        const btnGrid = document.getElementById('btnViewGrid');
        const btnList = document.getElementById('btnViewList');

        if (state.currentView === 'grid') {
            gridContainer.classList.remove('d-none');
            listContainer.classList.add('d-none');
            btnGrid.classList.add('active');
            btnList.classList.remove('active');
        } else {
            gridContainer.classList.add('d-none');
            listContainer.classList.remove('d-none');
            btnGrid.classList.remove('active');
            btnList.classList.add('active');
        }
    }

    function updatePagination() {
        const state = window.ExercisesState;
        const totalPages = Math.max(1, Math.ceil(state.totalItems / pageSize));
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Página ${state.currentPage} de ${totalPages} (${state.totalItems})`;
        }
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
    }

    function resolveImage(ex) {
        if (ex.image_url && ex.image_url.trim()) return ex.image_url;
        if (ex.thumbnail_url && ex.thumbnail_url.trim()) return ex.thumbnail_url;
        if (ex.image && ex.image.trim()) return ex.image;
        if (ex.img && ex.img.trim()) return ex.img;
        return '/static/images/gym.png';
    }

    function renderGrid(items) {
        const state = window.ExercisesState;
        const container = document.getElementById('viewGridContainer');
        if (!container) return;
        items.forEach(ex => {
            const img = resolveImage(ex);
            const hasVideo = ex.video_url && ex.video_url.trim();
            const bodyPartLabel = state.bodyPartMap[ex.body_part_key] || state.bodyPartMap[ex.body_part] || ex.body_part;

            const adminHtml = state.isAdmin ? `
                <div class="admin-actions d-flex gap-1" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-warning" onclick="duplicateExercise('${ex._id}')"><i class="fas fa-copy"></i></button>
                    <button class="btn btn-sm btn-info" onclick="openExerciseModal('${ex._id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteExercise('${ex._id}')"><i class="fas fa-trash"></i></button>
                </div>
            ` : '';

            const col = document.createElement('div');
            col.className = 'col-sm-6 col-md-4 col-lg-3';
            const clickAction = state.isEmbed ? `sendSelection('${ex._id}')` : `openExerciseDetails('${ex._id}')`;
            const selectableClass = state.isEmbed ? 'rm-selectable' : '';

            col.innerHTML = `
                <div class="exercise-grid-card position-relative ${selectableClass}" onclick="${clickAction}">
                    ${hasVideo ? `
                    <button class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2 shadow" 
                            onclick="event.stopPropagation(); openVideoModal('${ex.video_url}')" title="Ver Video" style="z-index:2">
                        <i class="fas fa-play"></i>
                    </button>` : ''}
                    
                    ${adminHtml}

                    <img src="${img}" class="exercise-grid-img" alt="${ex.name}">
                    <div class="card-body p-3">
                        <h6 class="fw-bold text-white text-truncate mb-1" title="${ex.name}">${ex.name}</h6>
                        <div class="d-flex gap-1 mb-2">
                             <span class="badge bg-secondary" style="font-size: 0.65rem;">${bodyPartLabel}</span>
                             <span class="badge bg-dark border border-secondary text-info" style="font-size: 0.65rem;">${ex.type || 'N/A'}</span>
                        </div>
                        <p class="small text-muted text-truncate mb-0">${ex.description || 'Sin descripción'}</p>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    }

    function renderList(items) {
        const state = window.ExercisesState;
        const tbody = document.getElementById('exercisesListBody');
        const mobileContainer = document.getElementById('mobileExercisesList');

        if (!tbody) return;
        tbody.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';

        items.forEach(ex => {
            const bodyPartLabel = state.bodyPartMap[ex.body_part_key] || state.bodyPartMap[ex.body_part] || ex.body_part;
            const hasVideo = ex.video_url && ex.video_url.trim();

            const adminTd = state.isAdmin ? `
                <td onclick="event.stopPropagation()">
                   <div class="btn-group btn-group-sm">
                       <button class="btn btn-outline-warning" onclick="duplicateExercise('${ex._id}')"><i class="fas fa-copy"></i></button>
                       <button class="btn btn-outline-info" onclick="openExerciseModal('${ex._id}')"><i class="fas fa-edit"></i></button>
                       <button class="btn btn-outline-danger" onclick="deleteExercise('${ex._id}')"><i class="fas fa-trash"></i></button>
                   </div>
                </td>
            ` : `<td class="admin-col d-none"></td>`;

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            if (state.isEmbed) {
                tr.onclick = () => window.sendSelection(ex._id);
                tr.classList.add('rm-selectable');
            } else {
                tr.onclick = () => window.openExerciseDetails(ex._id);
            }
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-white">${ex.name}</div>
                    <small class="text-secondary text-truncate d-block" style="max-width: 200px;">${ex.description || ''}</small>
                </td>
                <td><span class="badge bg-secondary">${bodyPartLabel}</span></td>
                <td><small class="text-info">${ex.equipment || 'N/A'}</small></td>
                <td>${ex.type || 'N/A'}</td>
                <td>
                    ${hasVideo ? `<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); openVideoModal('${ex.video_url}')"><i class="fab fa-youtube"></i></button>` : '-'}
                </td>
                <td>${ex.is_custom ? 'Custom' : 'Global'}</td>
                ${adminTd}
            `;
            tbody.appendChild(tr);

            if (mobileContainer) {
                const card = document.createElement('div');
                card.className = 'card bg-panel border-secondary shadow-sm';
                if (state.isEmbed) {
                    card.classList.add('rm-selectable');
                    card.onclick = () => window.sendSelection(ex._id);
                } else {
                    card.onclick = () => window.openExerciseDetails(ex._id);
                }

                const videoBtnMobile = hasVideo ? `<button class="btn btn-sm btn-outline-danger ms-2" onclick="event.stopPropagation(); openVideoModal('${ex.video_url}')"><i class="fab fa-youtube"></i></button>` : '';

                const adminMobile = state.isAdmin ? `
                    <div class="d-flex justify-content-between align-items-center border-top border-secondary pt-2 mt-2" onclick="event.stopPropagation()">
                        <small class="text-muted text-uppercase fw-bold" style="font-size:0.7rem;">
                            <i class="fas fa-dumbbell me-1"></i> ${ex.type || 'N/A'}
                        </small>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-warning" onclick="duplicateExercise('${ex._id}')"><i class="fas fa-copy"></i></button>
                            <button class="btn btn-outline-info" onclick="openExerciseModal('${ex._id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-outline-danger" onclick="deleteExercise('${ex._id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                ` : `
                    <div class="border-top border-secondary pt-2 mt-2">
                        <small class="text-muted text-uppercase fw-bold" style="font-size:0.7rem;">
                            <i class="fas fa-dumbbell me-1"></i> ${ex.type || 'N/A'}
                        </small>
                    </div>
                `;

                card.innerHTML = `
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold text-white">${ex.name}</div>
                                <small class="text-secondary">${bodyPartLabel}</small>
                            </div>
                            <div>
                                ${videoBtnMobile}
                            </div>
                        </div>
                        <p class="text-muted small mt-2 mb-0">${ex.description || ''}</p>
                        ${adminMobile}
                    </div>
                `;
                mobileContainer.appendChild(card);
            }
        });
    }

    window.ExercisesRender = {
        updateViewUI,
        updatePagination,
        resolveImage,
        renderGrid,
        renderList
    };
})();
