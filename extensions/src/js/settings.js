// sendMessageAsync: Ensure it can send messages without assuming handle is always relevant.
function sendMessageAsync(action, key, value) { // Removed 'handle' from direct params for this version
    const maxRetries = 3; const retryDelay = 500;
    return new Promise(async (resolve, reject) => {
        let attempts = 0; const attemptSend = async () => {
            try {
                if (!chrome.runtime || !chrome.runtime.sendMessage) { throw new Error('扩展运行时不可用'); }
                chrome.runtime.sendMessage({ action, key, value }, response => { // 'handle' removed from payload
                    const error = chrome.runtime.lastError; if (error) { throw new Error(error.message); }
                    if (response && response.success) { resolve(response.data); }
                    else if (response && response.error) { throw new Error(response.error); }
                    else { resolve(null); /* Or throw new Error('无效的响应'); */ }
                });
            } catch (error) {
                attempts++; console.warn(`消息发送失败 (${attempts}/${maxRetries}):`, error);
                if (attempts >= maxRetries) { reject(new Error(`发送消息失败: ${error.message}`)); return; }
                await new Promise(r => setTimeout(r, retryDelay)); attemptSend();
            }
        }; attemptSend();
    });
}

function readFileChunk(fileObject, length = 4096) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target.result));
        reader.onerror = (e) => reject(new Error('Failed to read file chunk: ' + e.target.error.name));
        const blobSlice = fileObject.slice(0, length);
        reader.readAsArrayBuffer(blobSlice);
    });
}

// Re-add readFileAsTextWithEncoding as settings.js now reads the full file
async function readFileAsTextWithEncoding(file, encoding) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Failed to read file with encoding: ${encoding}`));
        reader.readAsText(file, encoding);
    });
}

// Re-add PARSING FUNCTION to settings.js
function parseFileContentToLines(content, fileType) {
    let lines = []; let rawLines = []; let start = 0; let end;
    while ((end = content.indexOf('\n', start)) !== -1) {
        rawLines.push(content.substring(start, end)); start = end + 1;
    }
    if (start < content.length) { rawLines.push(content.substring(start)); }
    const ft = fileType ? fileType.toLowerCase() : 'txt';
    if (ft === 'markdown' || ft === 'md') {
        lines = rawLines.map(line => line.replace(/^#+\s+/, '').replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2').replace(/~~(.*?)~~/g, '$1').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/`{1,3}[^`]*`{1,3}/g, '').trim()).filter(line => line);
    } else { lines = rawLines.map(line => line.trim()).filter(line => line); }
    return lines;
}

class I18nManager { /* ... (same as before, ensure updatePageText includes pickNovelFile) ... */ }
// Full I18nManager for clarity
I18nManager.getCurrentLocale = async function() { const locale = await sendMessageAsync('getCurrentLocale'); return locale || 'en'; };
I18nManager.setLocale = async function(locale) { try { const result = await sendMessageAsync('setLocale', 'preferredLocale', locale); if (!result) { throw new Error('设置语言失败'); } document.documentElement.lang = locale === 'zh_CN' ? 'zh' : 'en'; await this.updatePageText(); window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale }, bubbles: true, cancelable: false })); return true; } catch (error) { console.error('语言切换失败:', error); return false; } };
I18nManager.getMessage = function(key, substitutions = undefined) { const message = chrome.i18n.getMessage(key, substitutions); return message || `[i18n-key: ${key}]`; };
I18nManager.updatePageText = function() { document.title = this.getMessage('settings'); document.querySelectorAll('[data-i18n]').forEach(element => { const key = element.getAttribute('data-i18n'); element.textContent = this.getMessage(key); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { const key = element.getAttribute('data-i18n-placeholder'); element.placeholder = this.getMessage(key); }); const fontFamilySelect = document.getElementById('font-family'); if (fontFamilySelect) { fontFamilySelect.querySelectorAll('option').forEach(option => { const key = option.getAttribute('data-i18n'); if (key) { option.textContent = this.getMessage(key); } }); } const fileEncodingSelect = document.getElementById('file-encoding'); if (fileEncodingSelect) { fileEncodingSelect.querySelectorAll('option').forEach(option => { const key = option.getAttribute('data-i18n'); if (key) { option.textContent = this.getMessage(key); } }); } const pickButton = document.getElementById('pick-file-button'); if(pickButton) { pickButton.textContent = this.getMessage('pickNovelFile');} };


document.addEventListener('DOMContentLoaded', async () => {
    const form = {
        pickFileButton: document.getElementById('pick-file-button'),
        novelPathDisplay: document.getElementById('novel-path-display'),
        novelLine: document.getElementById('novel-line'),
        fontFamily: document.getElementById('font-family'),
        fontSize: document.getElementById('font-size'),
        lineHeight: document.getElementById('line-height'),
        textColor: document.getElementById('text-color'),
        opacity: document.getElementById('opacity'),
        opacityValue: document.getElementById('opacity-value'),
        hoverOpacity: document.getElementById('hover-opacity'),
        hoverOpacityValue: document.getElementById('hover-opacity-value'),
        textShadow: document.getElementById('text-shadow'),
        maxWidth: document.getElementById('max-width'),
        saveButton: document.getElementById('save-button'),
        previewText: document.getElementById('preview-text'),
        bgOpacity: document.getElementById('bg-opacity'),
        bgOpacityValue: document.getElementById('bg-opacity-value'),
        hoverBgOpacity: document.getElementById('hover-bg-opacity'),
        hoverBgOpacityValue: document.getElementById('hover-bg-opacity-value'),
        languageSelect: document.getElementById('language-select'),
        fileEncoding: document.getElementById('file-encoding'),
        detectedEncodingFeedback: document.getElementById('detected-encoding-feedback') // New form element
    };

    if (form.languageSelect) { /* ... (language selector init unchanged) ... */ }

    async function detectAndSetEncoding(fileObject) {
        if (!fileObject) {
            if (form.detectedEncodingFeedback) form.detectedEncodingFeedback.textContent = '';
            return;
        }
        const feedbackSpan = form.detectedEncodingFeedback; // Get the span

        try {
            const buffer = await readFileChunk(fileObject); // Reads first 4KB as Uint8Array
            const detected = jschardet.detect(buffer); // jschardet is a placeholder

            console.log('Detected encoding by placeholder jschardet:', detected);

            if (detected && detected.encoding && detected.confidence > 0.1) { // Use a low threshold for placeholder
                let matchedEncoding = null;
                // Attempt to match detected encoding (case-insensitive) with dropdown values
                for (const option of form.fileEncoding.options) {
                    if (option.value.toUpperCase() === detected.encoding.toUpperCase()) {
                        matchedEncoding = option.value;
                        break;
                    }
                }
                // Special case for ASCII, treat as UTF-8 for simplicity in dropdown
                if (!matchedEncoding && detected.encoding.toUpperCase() === "ASCII") {
                    matchedEncoding = "UTF-8";
                }

                if (matchedEncoding) {
                    form.fileEncoding.value = matchedEncoding;
                    if (feedbackSpan) {
                        feedbackSpan.textContent = I18nManager.getMessage('detectionLowConfidence', [
                            matchedEncoding,
                            (detected.confidence * 100).toFixed(0) + '%' // Show confidence from jschardet
                        ]);
                    }
                } else { // Detected encoding not in our dropdown list
                    form.fileEncoding.value = "UTF-8"; // Default to UTF-8
                    if (feedbackSpan) {
                        // Using detectionUncertain for simplicity or create a new i18n key for this specific case
                        feedbackSpan.textContent = I18nManager.getMessage('detectionUncertain') +
                                                   ` (${I18nManager.getMessage('detectedEncodingWas', [detected.encoding])})`;
                        // This requires a new key "detectedEncodingWas": "Detected: $1."
                        console.warn(`Detected encoding '${detected.encoding}' (conf: ${detected.confidence}) not in dropdown, defaulted to UTF-8.`);
                    }
                }
            } else {
                form.fileEncoding.value = "UTF-8"; // Default if detection fails or confidence too low
                if (feedbackSpan) {
                    feedbackSpan.textContent = I18nManager.getMessage('detectionUncertain');
                }
            }
        } catch (error) {
            console.error('Error detecting encoding:', error);
            form.fileEncoding.value = "UTF-8"; // Default on error
            if (feedbackSpan) {
                feedbackSpan.textContent = I18nManager.getMessage('detectionUncertain'); // Or a specific error message
            }
        }
    }

    if (form.pickFileButton) {
        form.pickFileButton.addEventListener('click', async () => {
            try {
                if (!window.showOpenFilePicker) { alert("File System Access API is not supported."); return; }
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt', '.md', '.markdown'] } }],
                    multiple: false
                });

                const file = await fileHandle.getFile(); // Get File object
                form.novelPathDisplay.textContent = file.name;
                await detectAndSetEncoding(file); // Detect encoding for the FileReader

                // Read content using selected/detected encoding
                const selectedEncoding = form.fileEncoding.value;
                const fileContentString = await readFileAsTextWithEncoding(file, selectedEncoding);

                // Parse content into lines
                const fileExtension = file.name.split('.').pop().toLowerCase();
                const fileType = (fileExtension === 'md' || fileExtension === 'markdown') ? 'markdown' : 'txt';
                const linesArray = parseFileContentToLines(fileContentString, fileType);

                // Cache lines and filename in background for the session
                await sendMessageAsync('cacheNovelForSession', null, { lines: linesArray, fileName: file.name });

                // Save metadata to chrome.storage.local
                await sendMessageAsync('setStorage', 'fileName', file.name);
                await sendMessageAsync('setStorage', 'fileEncoding', selectedEncoding);
                await sendMessageAsync('setStorage', 'currentLine', 1); // Reset to line 1 for new file

                // Clear old full content storage keys
                await sendMessageAsync('removeStorage', 'novelLines');
                await sendMessageAsync('removeStorage', 'novelContent');

                alert(`File '${file.name}' processed and cached for this session. Settings saved.`);
                updateButtonState();

            } catch (err) {
                if (err.name === 'AbortError') { console.log('File selection aborted.'); }
                else { console.error('Error picking/processing file:', err); alert('Error picking/processing file: ' + err.message); }
            }
        });
    }

    function updatePreview() { /* ... (same as before) ... */ }
    function updateButtonState() { /* ... (same as before) ... */ }
    async function loadSettings() { /* ... (same as before, loads fileName, fileEncoding, currentLine) ... */ }

    async function saveSettings() {
        try {
            const settingsToSave = {fontFamily: form.fontFamily.value, fontSize: parseInt(form.fontSize.value) || 14, lineHeight: parseFloat(form.lineHeight.value) || 1.5, textColor: form.textColor.value, opacity: parseFloat(form.opacity.value) / 100, hoverOpacity: parseFloat(form.hoverOpacity.value) / 100, textShadow: form.textShadow.checked, maxWidth: parseInt(form.maxWidth.value) || 50, backgroundColor: `rgba(255, 255, 255, ${form.bgOpacity.value / 100})`, hoverBackgroundColor: `rgba(255, 255, 255, ${form.hoverBgOpacity.value / 100})`};
            await sendMessageAsync('setStorage', 'readerSettings', settingsToSave);
            await sendMessageAsync('setStorage', 'fileEncoding', form.fileEncoding.value);
            if (form.novelLine.value) {
                const lineNumber = parseInt(form.novelLine.value) || 1;
                await sendMessageAsync('setStorage', 'currentLine', lineNumber);
            }
            alert(I18nManager.getMessage('settingsSaved'));
        } catch (error) { console.error('Failed to save settings:', error); alert(I18nManager.getMessage('settingsSaveError')); }
    }
    // Event listeners (unchanged)
    /* ... */
    loadSettings(); updateButtonState();
});