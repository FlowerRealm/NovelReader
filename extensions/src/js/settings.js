// sendMessageAsync, readFileChunk, readFileAsTextWithEncoding (these helpers might be less used or adapted)
// For this step, readFileChunk will be used for encoding detection from the File object.
// readFileAsTextWithEncoding is NO LONGER used in settings.js to read full content.
function sendMessageAsync(action, key, value, handle) { // Added handle for new actions
    const maxRetries = 3; const retryDelay = 500;
    return new Promise(async (resolve, reject) => {
        let attempts = 0; const attemptSend = async () => {
            try {
                if (!chrome.runtime || !chrome.runtime.sendMessage) { throw new Error('扩展运行时不可用'); }
                chrome.runtime.sendMessage({ action, key, value, handle }, response => { // Pass handle
                    const error = chrome.runtime.lastError; if (error) { throw new Error(error.message); }
                    if (response && response.success) { resolve(response.data); }
                    else if (response && response.error) { throw new Error(response.error); }
                    else { throw new Error('无效的响应'); }
                });
            } catch (error) {
                attempts++; console.warn(`消息发送失败 (${attempts}/${maxRetries}):`, error);
                if (attempts >= maxRetries) { reject(new Error(`发送消息失败: ${error.message}`)); return; }
                await new Promise(r => setTimeout(r, retryDelay)); attemptSend();
            }
        }; attemptSend();
    });
}

function readFileChunk(fileObject, length = 4096) { // Takes a File object
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target.result));
        reader.onerror = (e) => reject(new Error('Failed to read file chunk: ' + e.target.error.name));
        const blobSlice = fileObject.slice(0, length);
        reader.readAsArrayBuffer(blobSlice);
    });
}

// parseFileContentToLines - NO LONGER NEEDED IN settings.js as parsing moves to reader.js from file handle

// I18nManager class (unchanged)
class I18nManager {
    static async getCurrentLocale() { const locale = await sendMessageAsync('getCurrentLocale'); return locale || 'en'; }
    static async setLocale(locale) { try { const result = await sendMessageAsync('setLocale', 'preferredLocale', locale); if (!result) { throw new Error('设置语言失败'); } document.documentElement.lang = locale === 'zh_CN' ? 'zh' : 'en'; await this.updatePageText(); window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale }, bubbles: true, cancelable: false })); return true; } catch (error) { console.error('语言切换失败:', error); if (typeof showNotification === 'function') { showNotification('error', `语言切换失败: ${error.message}`); } return false; } }
    static getMessage(key, substitutions = undefined) { const message = chrome.i18n.getMessage(key, substitutions); return message || `[i18n-key: ${key}]`; }
    static updatePageText() { document.title = this.getMessage('settings'); document.querySelectorAll('[data-i18n]').forEach(element => { const key = element.getAttribute('data-i18n'); element.textContent = this.getMessage(key); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { const key = element.getAttribute('data-i18n-placeholder'); element.placeholder = this.getMessage(key); }); const fontFamilySelect = document.getElementById('font-family'); if (fontFamilySelect) { fontFamilySelect.querySelectorAll('option').forEach(option => { const key = option.getAttribute('data-i18n'); if (key) { option.textContent = this.getMessage(key); } }); } const fileEncodingSelect = document.getElementById('file-encoding'); if (fileEncodingSelect) { fileEncodingSelect.querySelectorAll('option').forEach(option => { const key = option.getAttribute('data-i18n'); if (key) { option.textContent = this.getMessage(key); } }); } const pickButton = document.getElementById('pick-file-button'); if(pickButton) { pickButton.textContent = this.getMessage('pickNovelFile');} }
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = {
        pickFileButton: document.getElementById('pick-file-button'), // New button
        novelPathDisplay: document.getElementById('novel-path-display'),
        novelLine: document.getElementById('novel-line'), fontFamily: document.getElementById('font-family'),
        fontSize: document.getElementById('font-size'), lineHeight: document.getElementById('line-height'),
        textColor: document.getElementById('text-color'), opacity: document.getElementById('opacity'),
        opacityValue: document.getElementById('opacity-value'), hoverOpacity: document.getElementById('hover-opacity'),
        hoverOpacityValue: document.getElementById('hover-opacity-value'), textShadow: document.getElementById('text-shadow'),
        maxWidth: document.getElementById('max-width'), saveButton: document.getElementById('save-button'),
        previewText: document.getElementById('preview-text'), bgOpacity: document.getElementById('bg-opacity'),
        bgOpacityValue: document.getElementById('bg-opacity-value'), hoverBgOpacity: document.getElementById('hover-bg-opacity'),
        hoverBgOpacityValue: document.getElementById('hover-bg-opacity-value'), languageSelect: document.getElementById('language-select'),
        fileEncoding: document.getElementById('file-encoding')
    };

    // Language selector init (unchanged)
    if (form.languageSelect) { /* ... */ }

    async function detectAndSetEncoding(fileObject) { // Takes File object
        if (!fileObject) return;
        try {
            const buffer = await readFileChunk(fileObject);
            const detected = jschardet.detect(buffer); // jschardet is placeholder
            console.log('Detected encoding (from File object):', detected);
            if (detected && detected.encoding && detected.confidence > 0.2) {
                let foundInDropdown = false;
                for (const option of form.fileEncoding.options) { if (option.value.toUpperCase() === detected.encoding.toUpperCase()) { form.fileEncoding.value = option.value; foundInDropdown = true; break; } }
                if (!foundInDropdown && detected.encoding.toUpperCase() === "ASCII") { form.fileEncoding.value = "UTF-8"; }
                else if (!foundInDropdown) { console.warn(`Detected encoding ${detected.encoding} not in dropdown, defaulting to UTF-8`); form.fileEncoding.value = "UTF-8"; }
            } else { form.fileEncoding.value = "UTF-8"; }
        } catch (error) { console.error('Error detecting encoding:', error); form.fileEncoding.value = "UTF-8"; }
    }

    // New File Picker Logic
    if (form.pickFileButton) {
        form.pickFileButton.addEventListener('click', async () => {
            try {
                if (!window.showOpenFilePicker) {
                    alert("File System Access API is not supported in your browser. Please use a modern browser.");
                    return;
                }
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt', '.md', '.markdown'] } }],
                    multiple: false
                });

                // Store the handle in IndexedDB via background script
                await sendMessageAsync('storeFileHandleInDB', null, null, fileHandle); // Pass handle as 4th arg

                const file = await fileHandle.getFile(); // Get File object for metadata & encoding detection
                form.novelPathDisplay.textContent = file.name;
                await detectAndSetEncoding(file);

                // Save metadata (filename, encoding, reset line) to chrome.storage.local
                await sendMessageAsync('setStorage', 'fileName', file.name);
                await sendMessageAsync('setStorage', 'fileEncoding', form.fileEncoding.value);
                await sendMessageAsync('setStorage', 'currentLine', 1);

                // Clear old storage formats
                await sendMessageAsync('removeStorage', 'novelLines');
                await sendMessageAsync('removeStorage', 'novelContent');

                alert(`File '${file.name}' selected and handle stored. Adjust encoding if needed and save settings to confirm.`);
                updateButtonState();

            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('File selection aborted by user.');
                } else {
                    console.error('Error picking file:', err);
                    alert('Error picking file: ' + err.message);
                }
            }
        });
    }

    function updatePreview() { /* ... unchanged ... */ }
    function updateButtonState() { /* ... unchanged ... */ }

    async function loadSettings() {
        try {
            // When loading, also try to get fileName to update display if a handle was previously stored.
            const [settings, novelLine, preferredLocale, storedFileEncoding, storedFileName] = await Promise.all([
                sendMessageAsync('getStorage', 'readerSettings'),
                sendMessageAsync('getStorage', 'currentLine'), // Changed from novelLine
                I18nManager.getCurrentLocale(),
                sendMessageAsync('getStorage', 'fileEncoding'),
                sendMessageAsync('getStorage', 'fileName') // Load stored filename
            ]);
            if (preferredLocale && form.languageSelect) { form.languageSelect.value = preferredLocale; await I18nManager.updatePageText(); }
            if (settings) { /* ... unchanged ... */ }
            if (typeof novelLine === 'number') { form.novelLine.value = novelLine; } else { form.novelLine.value = 1; }

            if (storedFileName) { form.novelPathDisplay.textContent = storedFileName; }
            else { form.novelPathDisplay.textContent = I18nManager.getMessage('noFileSelected'); }

            if (storedFileEncoding && form.fileEncoding) { /* ... set dropdown ... */ }
            else if (form.fileEncoding) { form.fileEncoding.value = "UTF-8"; }
            updatePreview();
        } catch (error) { console.error('加载设置失败:', error); alert(I18nManager.getMessage('settingsSaveError')); }
    }

    async function saveSettings() {
        try {
            // Save non-file related settings (font, size, opacity, etc.)
            const settingsToSave = {fontFamily: form.fontFamily.value, fontSize: parseInt(form.fontSize.value) || 14, /* ... other settings ... */ };
            await sendMessageAsync('setStorage', 'readerSettings', settingsToSave);

            // Save metadata related to the currently selected/handled file
            // fileName is already saved when file is picked.
            // fileEncoding is saved when file is picked, but user might change it manually.
            await sendMessageAsync('setStorage', 'fileEncoding', form.fileEncoding.value);
            if (form.novelLine.value) {
                const lineNumber = parseInt(form.novelLine.value) || 1;
                await sendMessageAsync('setStorage', 'currentLine', lineNumber);
            }

            // NOVEL CONTENT IS NO LONGER SAVED HERE. Handle is in IndexedDB.
            // Lines are no longer parsed and saved from here.

            alert(I18nManager.getMessage('settingsSaved'));
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert(I18nManager.getMessage('settingsSaveError'));
        }
    }

    // Event listeners for opacity, etc (unchanged)
    /* ... */

    loadSettings();
    updateButtonState();
});