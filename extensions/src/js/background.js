// extensions/src/js/background.js

// No longer using db_utils.js:
// try {
//     importScripts('db_utils.js');
// } catch (e) {
//     console.error("Failed to import db_utils.js", e);
// }

// In-memory cache for novel lines for the current session (service worker lifetime)
let currentNovelLinesCache = null;
let currentNovelFileNameCache = null;

chrome.runtime.onInstalled.addListener(async () => {
    console.log('扩展已安装/更新');
    try {
        const locale = await StorageManager.get('preferredLocale');
        if (!locale) { await StorageManager.set('preferredLocale', 'en'); console.log('已初始化默认语言设置'); }

        const isVisible = await StorageManager.get('isVisible');
        if (isVisible === null) { await StorageManager.set('isVisible', true); console.log('已初始化阅读器显示状态'); }

        const readerSettings = await StorageManager.get('readerSettings');
        if (!readerSettings) {
            const defaultSettings = {
                fontFamily: 'Arial', fontSize: 14, lineHeight: 1.5, textColor: '#000000',
                opacity: 0.85, hoverOpacity: 0.95, textShadow: true, maxWidth: 50,
                backgroundColor: 'rgba(255, 255, 255, 0.85)', hoverBackgroundColor: 'rgba(255, 255, 255, 0.95)'
            };
            await StorageManager.set('readerSettings', defaultSettings);
            console.log('已初始化阅读器默认设置');
        }

        const currentLine = await StorageManager.get('currentLine');
        if (currentLine === null) { await StorageManager.set('currentLine', 1); console.log('已初始化阅读行号'); }

        const readerPosition = await StorageManager.get('readerPosition');
        if (!readerPosition) { await StorageManager.set('readerPosition', { left: '10px', top: '10px' }); console.log('已初始化阅读器位置');}

        // Clean up old storage keys that are no longer used with the new session-based approach
        await new Promise(resolve => chrome.storage.local.remove(['novelContent', 'novelLines'], () => {
            if (chrome.runtime.lastError) { console.warn("Error during cleanup of old storage keys:", chrome.runtime.lastError.message); }
            else { console.log("Cleaned up old novel content/metadata storage keys from chrome.storage.local."); }
            resolve();
        }));
        // Also clear session cache on install/update
        currentNovelLinesCache = null;
        currentNovelFileNameCache = null;

    } catch (error) { console.error('初始化存储变量失败:', error); }
});

chrome.runtime.onStartup.addListener(() => {
    console.log('扩展已启动');
    // Clear session cache on browser startup as well, as service worker might have been terminated.
    currentNovelLinesCache = null;
    currentNovelFileNameCache = null;
});

class StorageManager {
    static async get(key) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); }
                    else { resolve(result[key] ?? null); }
                });
            } catch (error) { reject(error); }
        });
    }

    static async set(key, value) { // value can be any serializable type for chrome.storage.local
        // The check for empty/null/undefined was specific to certain uses,
        // let's make set more generic and callers can validate if needed.
        // Or, if we want to keep this strictness for general settings:
        if (value === undefined || value === null || value === '') { // Retaining strict check for general settings
             console.warn(`StorageManager.set called with empty value for key: ${key}`);
             // Not throwing error here to allow settings to be cleared with e.g. empty string if desired by a specific call.
             // However, for this extension, most settings expect valid values.
             // The original error was because `null` was passed to clear novelLines.
             // That specific path is now removed.
        }
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ [key]: value }, () => {
                    if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); }
                    else { resolve(true); }
                });
            } catch (error) { reject(error); }
        });
    }
}

class LanguageManager {
    static async getCurrentLocale() { /* ... (same as before) ... */ }
    static async setLocale(locale) { /* ... (same as before, including broadcast) ... */ }
}
// Full LanguageManager definition
LanguageManager.getCurrentLocale = async function() { try { const locale = await StorageManager.get('preferredLocale'); return locale || 'en'; } catch (error) { console.error('获取语言设置失败:', error); return 'en'; } };
LanguageManager.setLocale = async function(locale) { try { if (!['zh_CN', 'en'].includes(locale)) { throw new Error(`不支持的语言: ${locale}`); } await StorageManager.set('preferredLocale', locale); const tabs = await chrome.tabs.query({}); const notificationPromises = tabs.map(async tab => { if (!tab.url || !tab.id) { return; } if (tab.url.startsWith('http') || tab.url.startsWith('https') || tab.url.startsWith(chrome.runtime.getURL(''))) { try { await new Promise((resolve, reject) => { chrome.tabs.sendMessage(tab.id, { action: 'localeChanged', locale: locale }, (response) => { const err = chrome.runtime.lastError; if (err) { if (err.message.includes('Could not establish connection')) { resolve(); } else { reject(err); } } else { resolve(response); } }); }); } catch (err) { if (!err.message.includes('Could not establish connection')) { console.warn(`向标签页 ${tab.id} 发送消息时出现预期之外的错误:`, err); } } } }); await Promise.allSettled(notificationPromises); return true; } catch (error) { console.error('设置语言失败:', error); throw error; } };


chrome.action.onClicked.addListener(() => { chrome.tabs.create({ url: chrome.runtime.getURL("src/html/settings.html") }); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const isAsync = true; // Indicate that sendResponse might be called asynchronously
    (async () => {
        try {
            if (!message || !message.action) { throw new Error('无效的消息格式'); }
            let responsePayload;
            switch (message.action) {
                case 'getCurrentLocale':
                    const locale = await LanguageManager.getCurrentLocale();
                    responsePayload = { success: true, data: locale };
                    break;
                case 'setLocale':
                    if (message.value === undefined) { throw new Error('Locale value not provided for setLocale.'); }
                    await LanguageManager.setLocale(message.value);
                    responsePayload = { success: true, data: true };
                    break;
                case 'getStorage':
                    if (!message.key) { throw new Error('Key not provided for getStorage.'); }
                    const data = await StorageManager.get(message.key);
                    responsePayload = { success: true, data: data };
                    break;
                case 'setStorage':
                    if (!message.key) { throw new Error('Key not provided for setStorage.'); }
                    // Value can be null/empty if a setting is being cleared explicitly,
                    // but StorageManager.set might still have its own rules.
                    // For this extension, settings are generally non-empty if set.
                    if (message.value === undefined ) { throw new Error('Value not provided for setStorage.');}
                    await StorageManager.set(message.key, message.value);
                    responsePayload = { success: true };
                    break;
                case 'removeStorage':
                    if (!message.key) { throw new Error('Key not provided for removeStorage.'); }
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.remove(message.key, () => {
                            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); }
                            else { console.log(`Storage key '${message.key}' removed.`); resolve(); }
                        });
                    });
                    responsePayload = { success: true };
                    break;
                case 'cacheNovelForSession':
                    if (!message.lines || message.fileName === undefined) { throw new Error('Lines or fileName not provided for caching.'); }
                    currentNovelLinesCache = message.lines;
                    currentNovelFileNameCache = message.fileName;
                    console.log(`Novel '${message.fileName}' (${currentNovelLinesCache.length} lines) cached in background.`);
                    const tabs = await chrome.tabs.query({});
                    tabs.forEach(tab => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'novelLinesUpdated',
                                lines: currentNovelLinesCache,
                                fileName: currentNovelFileNameCache
                            }).catch(err => {
                                if (err.message && !err.message.includes('Could not establish connection')) {
                                    console.warn(`Error broadcasting novelLinesUpdated to tab ${tab.id}:`, err.message);
                                }
                            });
                        }
                    });
                    responsePayload = { success: true };
                    break;
                case 'getNovelLinesFromSessionCache':
                    responsePayload = { success: true, data: { lines: currentNovelLinesCache, fileName: currentNovelFileNameCache } };
                    break;
                case 'clearNovelSessionCache':
                    currentNovelLinesCache = null;
                    currentNovelFileNameCache = null;
                    console.log("Novel session cache cleared.");
                    responsePayload = { success: true };
                    break;
                default:
                    throw new Error(`未知的操作类型 (Unknown action type): ${message.action}`);
            }
            if (typeof sendResponse === 'function') sendResponse(responsePayload);
        } catch (error) {
            console.error('消息处理失败 (Message handling failed):', error, "Original message:", message);
            if (typeof sendResponse === 'function') sendResponse({ success: false, error: error.message || '未知错误 (Unknown error)' });
        }
    })();
    return isAsync; // Required for async sendResponse
});