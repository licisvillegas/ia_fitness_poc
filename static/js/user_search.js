(function () {
    "use strict";

    function normalizeUsers(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.users)) return data.users;
        if (data && data.user_id) return [data];
        return [];
    }

    function defaultRenderItem(user) {
        var name = user.name || user.username || "Usuario";
        var email = user.email || "";
        var id = user.user_id || "";
        return "<div><strong>" + name + "</strong> <small class=\"text-muted\">(" + email + ")</small></div>" +
            "<small class=\"text-xs text-secondary\">ID: " + id + "</small>";
    }

    function setInputValue(inputEl, user) {
        if (!inputEl || !user) return;
        var label = (user.name || user.username || "").trim();
        var email = (user.email || "").trim();
        if (label && email) {
            inputEl.value = label + " (" + email + ")";
        } else if (label) {
            inputEl.value = label;
        } else if (user.user_id) {
            inputEl.value = user.user_id;
        }
    }

    function resolveCallback(cb) {
        if (typeof cb === "function") return cb;
        if (typeof cb === "string" && cb && typeof window[cb] === "function") return window[cb];
        return null;
    }

    function initUserSearch(config) {
        if (!config || !config.inputId || !config.resultsId) return;

        var inputEl = document.getElementById(config.inputId);
        var resultsEl = document.getElementById(config.resultsId);
        var buttonEl = config.buttonId ? document.getElementById(config.buttonId) : null;
        var hiddenEl = config.hiddenId ? document.getElementById(config.hiddenId) : null;
        if (!inputEl || !resultsEl) return;

        var minChars = typeof config.minChars === "number" ? config.minChars : 2;
        var limit = typeof config.limit === "number" ? config.limit : 5;
        var debounceMs = typeof config.debounceMs === "number" ? config.debounceMs : 250;
        var endpoint = config.endpoint || "/admin/api/user_profiles/lookup";
        var onSelect = resolveCallback(config.onSelect);
        var onClear = resolveCallback(config.onClear);
        var renderItem = resolveCallback(config.renderItem) || defaultRenderItem;
        var itemClass = config.itemClass || "list-group-item list-group-item-action";
        var clearButtonEl = config.clearButtonId ? document.getElementById(config.clearButtonId) : null;

        var timeoutId = null;

        function hideResults() {
            if (resultsEl) resultsEl.style.display = "none";
        }

        function showResults() {
            if (resultsEl) resultsEl.style.display = "block";
        }

        function storeSelection(user) {
            if (!user) return;
            if (config.storageKey) {
                try { localStorage.setItem(config.storageKey, JSON.stringify(user)); } catch (e) { }
            }
            if (config.storageUidKey && user.user_id) {
                try { localStorage.setItem(config.storageUidKey, String(user.user_id)); } catch (e) { }
            }
        }

        function clearSelection() {
            if (inputEl) inputEl.value = "";
            if (hiddenEl) hiddenEl.value = "";
            hideResults();
            if (config.storageKey) {
                try { localStorage.removeItem(config.storageKey); } catch (e) { }
            }
            if (config.storageUidKey) {
                try { localStorage.removeItem(config.storageUidKey); } catch (e) { }
            }
            if (onClear) onClear();
        }

        function selectUser(user) {
            if (!user) return;
            if (hiddenEl) hiddenEl.value = user.user_id || "";
            if (config.updateInputValue !== false) {
                setInputValue(inputEl, user);
            }
            hideResults();
            if (config.storeSelection !== false) {
                storeSelection(user);
            }
            if (onSelect) onSelect(user);
        }

        function renderResults(users) {
            resultsEl.innerHTML = "";
            if (users.length === 0) {
                resultsEl.innerHTML = '<div class="list-group-item text-muted">Sin resultados</div>';
                return;
            }
            users.forEach(function (user) {
                var item = document.createElement("a");
                item.href = "#";
                item.className = itemClass;
                item.innerHTML = renderItem(user);
                item.addEventListener("click", function (e) {
                    e.preventDefault();
                    selectUser(user);
                });
                resultsEl.appendChild(item);
            });
        }

        function fetchResults(term) {
            if (!term) return;
            resultsEl.innerHTML = '<div class="list-group-item">Buscando...</div>';
            showResults();
            var url = endpoint + "?term=" + encodeURIComponent(term) + "&limit=" + encodeURIComponent(limit);
            if (config.exact) url += "&exact=1";
            fetch(url)
                .then(function (resp) { return resp.json(); })
                .then(function (data) {
                    var users = normalizeUsers(data);
                    renderResults(users);
                    if (resolveCallback(config.onResults)) {
                        resolveCallback(config.onResults)(users);
                    }
                })
                .catch(function (err) {
                    resultsEl.innerHTML = '<div class="list-group-item text-danger">Error: ' + err.message + "</div>";
                });
        }

        function handleSearch() {
            var term = inputEl.value.trim();
            if (term.length < minChars) {
                hideResults();
                return;
            }
            fetchResults(term);
        }

        inputEl.addEventListener("input", function () {
            var term = inputEl.value.trim();
            if (!term) {
                hideResults();
                return;
            }
            clearTimeout(timeoutId);
            timeoutId = setTimeout(handleSearch, debounceMs);
        });

        inputEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
            }
        });

        if (buttonEl) {
            buttonEl.addEventListener("click", function () {
                handleSearch();
            });
        }

        if (clearButtonEl) {
            clearButtonEl.addEventListener("click", function () {
                clearSelection();
            });
        }

        document.addEventListener("click", function (e) {
            if (!e.target.closest("#" + config.inputId) && !e.target.closest("#" + config.resultsId)) {
                hideResults();
            }
        });
    }

    window.initUserSearch = initUserSearch;
})();
