// sendMessageAsync (unchanged from previous version)
function sendMessageAsync(action, key, value) {
    const maxRetries = 3; const retryDelay = 500;
    return new Promise(async (resolve, reject) => {
        let attempts = 0; const attemptSend = async () => {
            try {
                if (!chrome.runtime || !chrome.runtime.sendMessage) { throw new Error('扩展运行时不可用'); }
                chrome.runtime.sendMessage({ action, key, value }, response => {
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

// readFileChunk (unchanged from previous version)
function readFileChunk(file, length = 4096) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = () => reject(new Error('Failed to read file chunk'));
        const blobSlice = file.slice(0, length);
        reader.readAsArrayBuffer(blobSlice);
    });
}

// readFileAsTextWithEncoding (unchanged from previous version)
async function readFileAsTextWithEncoding(file, encoding) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Failed to read file with encoding: ${encoding}`));
        reader.readAsText(file, encoding);
    });
}

// NEW PARSING FUNCTION
function parseFileContentToLines(content, fileType) {
    let lines = [];
    let rawLines = [];
    let start = 0;
    let end;
    // Memory-efficient way to split string by newline characters
    // IMPORTANT: Use literal '\n' for string.indexOf, not escaped '\\n'
    while ((end = content.indexOf('\n', start)) !== -1) { // searching for literal \n
        rawLines.push(content.substring(start, end));
        start = end + 1;
    }
    if (start < content.length) { // Add last line if no trailing newline
        rawLines.push(content.substring(start));
    }

    const ft = fileType ? fileType.toLowerCase() : 'txt';

    if (ft === 'markdown' || ft === 'md') {
        lines = rawLines.map(line => line
            .replace(/^#+\s+/, '')
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            .replace(/(\*|_)(.*?)\1/g, '$2')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // For [text](url)
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .trim()
        ).filter(line => line);
    } else {
        lines = rawLines.map(line => line.trim()).filter(line => line);
    }
    return lines;
}

// I18nManager class (unchanged from previous version)
class I18nManager {
    static async getCurrentLocale() { const locale = await sendMessageAsync('getCurrentLocale'); return locale || 'en'; }
    static async setLocale(locale) { try { const result = await sendMessageAsync('setLocale', 'preferredLocale', locale); if (!result) { throw new Error('设置语言失败'); } document.documentElement.lang = locale === 'zh_CN' ? 'zh' : 'en'; await this.updatePageText(); window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale }, bubbles: true, cancelable: false })); return true; } catch (error) { console.error('语言切换失败:', error); if (typeof showNotification === 'function') { showNotification('error', `语言切换失败: ${error.message}`); } return false; } }
    static getMessage(key, substitutions = undefined) { const message = chrome.i18n.getMessage(key, substitutions); return message || `[i18n-key: ${key}]`; }
    static updatePageText() { document.title = this.getMessage('settings'); document.querySelectorAll('[data-i18n]').forEach(element => { const key = element.getAttribute('data-i18n'); element.textContent = this.getMessage(key); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { const key = element.getAttribute('data-i18n-placeholder'); element.placeholder = this.getMessage(key); }); const fontFamilySelect = document.getElementById('font-family'); if (fontFamilySelect) { fontFamilySelect.querySelectorAll('option').forEach(option => { const key = option.getAttribute('data-i18n'); if (key) { option.textContent = this.getMessage(key); } }); } const fileEncodingSelect = document.getElementById('file-encoding'); if (fileEncodingSelect) { fileEncodingSelect.querySelectorAll('option').forEach(option => { const key = option.getAttribute('data-i18n'); if (key) { option.textContent = this.getMessage(key); } }); } }
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = {
        novelPath: document.getElementById('novel-path'), novelPathDisplay: document.getElementById('novel-path-display'),
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

    if (form.languageSelect) { const languages = [ { code: 'zh_CN', name: '简体中文' }, { code: 'en', name: 'English' } ]; form.languageSelect.innerHTML = ''; languages.forEach(lang => { const option = document.createElement('option'); option.value = lang.code; option.textContent = lang.name; form.languageSelect.appendChild(option); }); const currentLocale = await I18nManager.getCurrentLocale(); form.languageSelect.value = currentLocale; form.languageSelect.addEventListener('change', async () => { const newLocale = form.languageSelect.value; const success = await I18nManager.setLocale(newLocale); if (success) { alert(I18nManager.getMessage('settingsSaved')); } else { alert(I18nManager.getMessage('settingsSaveError')); } }); window.addEventListener('localeChanged', async (event) => { const { locale } = event.detail; if (locale !== form.languageSelect.value) { form.languageSelect.value = locale; await loadSettings(); } }); }

    async function detectAndSetEncoding(file) { if (!file) return; try { const buffer = await readFileChunk(file); const detected = jschardet.detect(buffer); console.log('Detected encoding:', detected); if (detected && detected.encoding && detected.confidence > 0.2) { let foundInDropdown = false; for (const option of form.fileEncoding.options) { if (option.value.toUpperCase() === detected.encoding.toUpperCase()) { form.fileEncoding.value = option.value; foundInDropdown = true; break; } } if (!foundInDropdown && detected.encoding.toUpperCase() === "ASCII") { form.fileEncoding.value = "UTF-8"; } else if (!foundInDropdown) { console.warn(`Detected encoding ${detected.encoding} not in dropdown, defaulting to UTF-8`); form.fileEncoding.value = "UTF-8"; } } else { form.fileEncoding.value = "UTF-8"; } } catch (error) { console.error('Error detecting encoding:', error); form.fileEncoding.value = "UTF-8"; } }

    form.novelPath.addEventListener('change', async () => { if (form.novelPath.files.length > 0) { const file = form.novelPath.files[0]; form.novelPathDisplay.textContent = file.name; await detectAndSetEncoding(file); } else { form.novelPathDisplay.textContent = I18nManager.getMessage('noFileSelected'); form.fileEncoding.value = "UTF-8"; } updateButtonState(); });

    function updatePreview() { const opacity = form.opacity.value / 100; const bgOpacity = form.bgOpacity.value / 100; const textShadow = form.textShadow.checked ? '0 0 3px white' : 'none'; const backgroundColor = `rgba(255, 255, 255, ${bgOpacity})`; Object.assign(form.previewText.style, { fontFamily: form.fontFamily.value, fontSize: `${form.fontSize.value}px`, lineHeight: form.lineHeight.value, color: form.textColor.value, opacity: opacity, textShadow: textShadow, backgroundColor: backgroundColor, padding: '10px', borderRadius: '5px', display: 'inline-block', maxWidth: `${form.maxWidth.value}%` }); form.previewText.textContent = I18nManager.getMessage('previewText'); }
    function updateButtonState() { const hasChanges = true; form.saveButton.disabled = !hasChanges; }

    async function loadSettings() { try { const [settings, novelLine, preferredLocale, storedFileEncoding] = await Promise.all([sendMessageAsync('getStorage', 'readerSettings'), sendMessageAsync('getStorage', 'novelLine'), I18nManager.getCurrentLocale(), sendMessageAsync('getStorage', 'fileEncoding')]); if (preferredLocale && form.languageSelect) { form.languageSelect.value = preferredLocale; await I18nManager.updatePageText(); } if (settings) { if (typeof settings.fontFamily === 'string') { form.fontFamily.value = settings.fontFamily; } if (typeof settings.fontSize === 'number') { form.fontSize.value = settings.fontSize; } if (typeof settings.lineHeight === 'number') { form.lineHeight.value = settings.lineHeight; } if (typeof settings.textColor === 'string') { form.textColor.value = settings.textColor; } if (typeof settings.opacity === 'number') { form.opacity.value = Math.round(settings.opacity * 100); form.opacityValue.textContent = `${form.opacity.value}%`; } if (typeof settings.hoverOpacity === 'number') { form.hoverOpacity.value = Math.round(settings.hoverOpacity * 100); form.hoverOpacityValue.textContent = `${form.hoverOpacity.value}%`; } if (typeof settings.textShadow === 'boolean') { form.textShadow.checked = settings.textShadow; } if (typeof settings.maxWidth === 'number') { form.maxWidth.value = settings.maxWidth; } if (typeof settings.backgroundColor === 'string') { const match = settings.backgroundColor.match(/rgba\(.*,\s*([\d.]+)\)/); if (match) { form.bgOpacity.value = Math.round(parseFloat(match[1]) * 100); form.bgOpacityValue.textContent = `${form.bgOpacity.value}%`; } } const hoverMatch = settings.hoverBackgroundColor?.match(/rgba\(.*,\s*([\d.]+)\)/); if (hoverMatch) { form.hoverBgOpacity.value = Math.round(parseFloat(hoverMatch[1]) * 100); form.hoverBgOpacityValue.textContent = `${form.hoverBgOpacity.value}%`; } } if (typeof novelLine === 'number') { form.novelLine.value = novelLine; } if (storedFileEncoding && form.fileEncoding) { let found = false; for(let opt of form.fileEncoding.options) { if(opt.value === storedFileEncoding) {found = true; break;} } if(found) form.fileEncoding.value = storedFileEncoding; else form.fileEncoding.value = "UTF-8"; } else if (form.fileEncoding) { form.fileEncoding.value = "UTF-8"; } updatePreview(); } catch (error) { console.error('加载设置失败:', error); alert(I18nManager.getMessage('settingsSaveError')); } }

    async function saveSettings() {
        try {
            const settingsToSave = {fontFamily: form.fontFamily.value, fontSize: parseInt(form.fontSize.value) || 14, lineHeight: parseFloat(form.lineHeight.value) || 1.5, textColor: form.textColor.value, opacity: parseFloat(form.opacity.value) / 100, hoverOpacity: parseFloat(form.hoverOpacity.value) / 100, textShadow: form.textShadow.checked, maxWidth: parseInt(form.maxWidth.value) || 50, backgroundColor: `rgba(255, 255, 255, ${form.bgOpacity.value / 100})`, hoverBackgroundColor: `rgba(255, 255, 255, ${form.hoverBgOpacity.value / 100})`};
            const selectedEncoding = form.fileEncoding.value;

            if (form.novelPath.files.length > 0) {
                const file = form.novelPath.files[0];
                const fileName = file.name;
                const fileExtension = fileName.split('.').pop().toLowerCase();
                const fileType = (fileExtension === 'md' || fileExtension === 'markdown') ? 'markdown' : 'txt';

                const fileContentString = await readFileAsTextWithEncoding(file, selectedEncoding);
                const linesArray = parseFileContentToLines(fileContentString, fileType);

                await sendMessageAsync('setStorage', 'novelLines', linesArray);
                await sendMessageAsync('setStorage', 'fileName', fileName);
                await sendMessageAsync('setStorage', 'fileEncoding', selectedEncoding);
                form.novelPathDisplay.textContent = fileName;
            }
            if (form.novelLine.value) {
                const lineNumber = parseInt(form.novelLine.value) || 1;
                await sendMessageAsync('setStorage', 'currentLine', lineNumber);
            }
            await sendMessageAsync('setStorage', 'readerSettings', settingsToSave);
            alert(I18nManager.getMessage('settingsSaved'));
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert(I18nManager.getMessage('settingsSaveError'));
        }
    }

    ['opacity', 'hoverOpacity', 'bgOpacity', 'hoverBgOpacity'].forEach(id => { const slider = form[id]; const display = form[id + 'Value']; if (slider && display) { slider.addEventListener('input', () => { display.textContent = `${slider.value}%`; if(id === 'opacity' || id === 'bgOpacity') updatePreview(); }); } });
    ['fontFamily', 'fontSize', 'lineHeight', 'textColor', 'textShadow', 'maxWidth'].forEach(id => { if (form[id]) { form[id].addEventListener('input', updatePreview); form[id].addEventListener('change', updatePreview); } });
    if(form.novelLine) form.novelLine.addEventListener('input', updateButtonState);
    if(form.saveButton) form.saveButton.addEventListener('click', saveSettings);

    loadSettings();
    updateButtonState();
});