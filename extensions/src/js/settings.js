document.addEventListener('DOMContentLoaded', () => {
    const novelPathInput = document.getElementById('novel-path');
    const novelPathDisplay = document.getElementById('novel-path-display');
    const novelLineInput = document.getElementById('novel-line');
    const fontFamilyInput = document.getElementById('font-family');
    const fontSizeInput = document.getElementById('font-size');
    const saveButton = document.getElementById('save-button');

    function updateButtonState() {
        saveButton.disabled = !novelPathInput.value && !novelLineInput.value && !fontFamilyInput.value && !fontSizeInput.value;
    }

    function setStorage(key, value) {
        const data = {};
        data[key] = value;
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to set storage:', chrome.runtime.lastError);
            }
        });
    }

    function getStorage(key, callback) {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to get storage:', chrome.runtime.lastError);
                callback(null);
            } else {
                callback(result[key] || null);
            }
        });
    }

    function loadSettings() {
        getStorage('novelPath', (novelPath) => {
            if (novelPath) novelPathDisplay.textContent = novelPath;
        });
        getStorage('novelLine', (novelLine) => {
            if (novelLine) novelLineInput.value = novelLine;
        });
        getStorage('fontFamily', (fontFamily) => {
            if (fontFamily) fontFamilyInput.value = fontFamily;
        });
        getStorage('fontSize', (fontSize) => {
            if (fontSize) fontSizeInput.value = fontSize;
        });
    }

    function saveSettings() {
        if (novelPathInput.files.length === 0) {
            alert('Please select a file before saving settings.');
            return;
        }
        if (novelPathInput.files.length > 0) {
            const file = novelPathInput.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const fileContent = reader.result;
                setStorage('novelContent', fileContent);
                novelPathDisplay.textContent = file.name;
            };
            reader.onerror = () => {
                alert('Failed to read the selected file.');
            };
            reader.readAsText(file);
        }
        if (novelLineInput.value) {
            setStorage('novelLine', novelLineInput.value);
        }
        if (fontFamilyInput.value) {
            setStorage('fontFamily', fontFamilyInput.value);
        }
        if (fontSizeInput.value) {
            const fontSize = parseInt(fontSizeInput.value, 10);
            if (!isNaN(fontSize)) {
                setStorage('fontSize', fontSize);
            }
        }
        alert('Settings saved to storage!');
    }

    novelPathInput.addEventListener('change', () => {
        if (novelPathInput.files.length > 0) {
            novelPathDisplay.textContent = novelPathInput.files[0].name;
        }
        updateButtonState();
    });

    novelLineInput.addEventListener('input', updateButtonState);
    fontFamilyInput.addEventListener('change', updateButtonState);
    fontSizeInput.addEventListener('input', updateButtonState);

    saveButton.addEventListener('click', saveSettings);

    loadSettings();
});