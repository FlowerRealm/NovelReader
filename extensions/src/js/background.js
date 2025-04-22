chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("src/html/settings.html")
    });
});

// Consolidate repetitive storage operations into a helper function
function handleStorage(action, key, value, callback) {
    if (action === 'get') {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                callback({ success: false, error: chrome.runtime.lastError });
            } else {
                callback({ success: true, data: result[key] || null });
            }
        });
    } else if (action === 'set') {
        if (value !== undefined && value !== null && value !== '') {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    callback({ success: false, error: chrome.runtime.lastError });
                } else {
                    callback({ success: true });
                }
            });
        } else {
            callback({ success: false, error: 'Value is empty' });
        }
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getStorage') {
        handleStorage('get', message.key, null, sendResponse);
        return true;
    } else if (message.action === 'setStorage') {
        handleStorage('set', message.key, message.value, sendResponse);
        return true;
    } else if (message.action === 'validateNotEmpty') {
        const isValid = message.value !== undefined && message.value !== null && message.value !== '';
        sendResponse({ success: true, isValid });
    }
});