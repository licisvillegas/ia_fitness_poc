/**
 * OfflineManager
 * Handles offline storage and synchronization of workout sessions using IndexedDB.
 */
class OfflineManager {
    constructor() {
        this.dbName = 'FitnessDB';
        this.storeName = 'pending_sessions';
        this.db = null;
        this.isSyncing = false;
    }

    async init() {
        if (!('indexedDB' in window)) {
            console.warn("IndexedDB not supported. Offline mode unavailable.");
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.errorCode);
                reject(event.target.errorCode);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("OfflineManager initialized.");
                this.setupSyncListener();
                // Try to sync on init if online
                if (navigator.onLine) {
                    this.sync();
                }
                resolve(this.db);
            };
        });
    }

    setupSyncListener() {
        window.addEventListener('online', () => {
            console.log("Back online! Attempting sync...");
            this.sync();
        });
    }

    async saveSession(payload) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);

            // Add timestamp for sorting if needed
            const record = {
                ...payload,
                storedAt: new Date().toISOString()
            };

            const request = store.add(record);

            request.onsuccess = () => {
                console.log("Session saved locally.");
                resolve(true);
            };

            request.onerror = (e) => {
                console.error("Error saving locally:", e);
                reject(e);
            };
        });
    }

    async sync() {
        if (!this.db || this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;
        console.log("Starting sync process...");

        try {
            const records = await this.getAllRecords();
            if (records.length === 0) {
                console.log("No pending sessions to sync.");
                this.isSyncing = false;
                return;
            }

            console.log(`Found ${records.length} pending sessions.`);

            for (const record of records) {
                try {
                    await this.uploadSession(record);
                    await this.deleteRecord(record.id);
                    console.log(`Synced session ${record.id}`);

                    // Optional: Show a toast/notification to user
                    if (window.showToast) window.showToast("Sesión sincronizada exitosamente", "success");

                } catch (e) {
                    console.error(`Failed to sync session ${record.id}`, e);
                    // Keep in DB to retry later
                }
            }
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            this.isSyncing = false;
        }
    }

    getAllRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    deleteRecord(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async uploadSession(record) {
        // Remove internal ID and metadata before sending
        const { id, storedAt, ...payload } = record;

        const res = await fetch("/workout/api/session/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }
        return await res.json();
    }
}

// Expose global instance
window.offlineManager = new OfflineManager();
