// Consolidate repetitive message sending into a helper function
function sendMessage(action, key, value, callback) {
    chrome.runtime.sendMessage({ action, key, value }, callback);
}

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

    function loadSettings() {
        sendMessage('getStorage', 'novelPath', null, (novelPath) => {
            if (novelPath) novelPathDisplay.textContent = novelPath;
        });
        sendMessage('getStorage', 'novelLine', null, (novelLine) => {
            if (novelLine) novelLineInput.value = novelLine;
        });
        sendMessage('getStorage', 'fontFamily', null, (fontFamily) => {
            if (fontFamily) fontFamilyInput.value = fontFamily;
        });
        sendMessage('getStorage', 'fontSize', null, (fontSize) => {
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
                sendMessage('setStorage', 'novelContent', fileContent);
                novelPathDisplay.textContent = file.name;
            };
            reader.onerror = () => {
                alert('Failed to read the selected file.');
            };
            reader.readAsText(file);
        }

        sendMessage('setStorage', 'novelLine', novelLineInput.value);
        sendMessage('setStorage', 'fontFamily', fontFamilyInput.value);
        sendMessage('setStorage', 'fontSize', fontSizeInput.value);

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