// extensions/src/js/db_utils.js
const DB_NAME = 'NovelReaderDB';
const DB_VERSION = 1;
const FILE_HANDLE_STORE_NAME = 'fileHandles'; // Changed from STORE_NAME for clarity
const CURRENT_NOVEL_HANDLE_KEY = 'currentNovelFileHandle'; // Changed from HANDLE_KEY for clarity

let dbPromise = null; // Singleton promise for the database connection

function openDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(FILE_HANDLE_STORE_NAME)) {
                    db.createObjectStore(FILE_HANDLE_STORE_NAME);
                }
                // Future upgrades can add more stores or indices here
            };

            request.onsuccess = (event) => {
                console.log("IndexedDB opened successfully.");
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('IndexedDB opening error:', event.target.error);
                dbPromise = null; // Reset promise on error so retry is possible
                reject(event.target.error);
            };

            request.onblocked = (event) => {
                // This event is fired when an older version of the database is still open elsewhere
                console.warn('IndexedDB open is blocked:', event);
                dbPromise = null; // Reset promise
                reject(new Error('IndexedDB open blocked, please close other tabs/extensions using this DB.'));
            };
        });
    }
    return dbPromise;
}

async function storeFileHandle(handle) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(FILE_HANDLE_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(FILE_HANDLE_STORE_NAME);
            const request = store.put(handle, CURRENT_NOVEL_HANDLE_KEY);

            transaction.oncomplete = () => {
                console.log("File handle stored successfully.");
                resolve(true);
            };
            transaction.onerror = (event) => {
                console.error('Transaction error storing file handle:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('Failed to open DB for storing file handle:', error);
        return Promise.reject(error);
    }
}

async function getFileHandle() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(FILE_HANDLE_STORE_NAME, 'readonly');
            const store = transaction.objectStore(FILE_HANDLE_STORE_NAME);
            const request = store.get(CURRENT_NOVEL_HANDLE_KEY);

            request.onsuccess = (event) => {
                // event.target.result will be undefined if the key is not found
                resolve(event.target.result || null);
            };
            request.onerror = (event) => {
                console.error('Error getting file handle:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('Failed to open DB for getting file handle:', error);
        return Promise.resolve(null); // Resolve with null if DB open fails, so caller can handle
    }
}

async function deleteFileHandle() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(FILE_HANDLE_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(FILE_HANDLE_STORE_NAME);
            const request = store.delete(CURRENT_NOVEL_HANDLE_KEY);

            transaction.oncomplete = () => {
                console.log("File handle deleted successfully.");
                resolve(true);
            };
            transaction.onerror = (event) => {
                console.error('Transaction error deleting file handle:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('Failed to open DB for deleting file handle:', error);
        return Promise.reject(error);
    }
}
