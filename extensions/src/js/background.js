chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("src/html/settings.html")
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveSettings') {
        const settings = message.data;
        for (const [key, value] of Object.entries(settings)) {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                }
            });
        }
        sendResponse({ success: true });
    } else if (message.action === 'readFile') {
        const fs = require('fs');
        const path = message.path;

        if (!path) {
            sendResponse({ success: false, error: 'File path is empty or invalid.' });
            return;
        }

        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
                sendResponse({ success: false, error: `Failed to read file: ${err.message}` });
            } else {
                sendResponse({ success: true, content: data });
            }
        });
        return true;
    } else if (message.action === 'saveCurrentLine') {
        const currentLine = message.data.currentLine;
        chrome.storage.local.set({ novelLine: currentLine }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true;
    }
});