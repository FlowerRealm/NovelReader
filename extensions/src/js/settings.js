/*
 * @Author: FlowerCity qzrobotsnake@gmail.com
 * @Date: 2025-04-06 11:30:19
 * @LastEditors: FlowerCity qzrobotsnake@gmail.com
 * @LastEditTime: 2025-04-08 22:10:05
 * @FilePath: \NovelReader\extensions\src\js\settings.js
 */
document.addEventListener('DOMContentLoaded', () => {
    const novelPathInput = document.getElementById('novel-path');
    const novelPathDisplay = document.getElementById('novel-path-display'); // 新增用于显示文件路径的元素
    const novelLineInput = document.getElementById('novel-line');
    const fontFamilyInput = document.getElementById('font-family');
    const fontSizeInput = document.getElementById('font-size');
    const saveButton = document.getElementById('save-button');

    function updateButtonState() {
        saveButton.disabled = !novelPathInput.value && !novelLineInput.value && !fontFamilyInput.value && !fontSizeInput.value;
    }

    novelPathInput.addEventListener('change', () => {
        if (novelPathInput.files.length > 0) {
            novelPathDisplay.textContent = novelPathInput.files[0].name; // 显示文件名
        }
        updateButtonState();
    });
    novelLineInput.addEventListener('input', updateButtonState);
    fontFamilyInput.addEventListener('change', updateButtonState);
    fontSizeInput.addEventListener('input', updateButtonState);

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
            if (novelPath) novelPathDisplay.textContent = novelPath; // 显示文件路径
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

    saveButton.addEventListener('click', () => {
        if (novelPathInput.files.length === 0) {
            alert('Please select a file before saving settings.');
            return; // Exit early to prevent further execution
        }
        if (novelPathInput.files.length > 0) {
            const file = novelPathInput.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const fileContent = reader.result;
                setStorage('novelContent', fileContent); // 存储文件内容
                novelPathDisplay.textContent = file.name; // 显示文件名
            };
            reader.onerror = () => {
                alert('Failed to read the selected file.');
            };
            reader.readAsText(file); // 读取文件内容为文本
        }
        if (novelLineInput.value) {
            setStorage('novelLine', novelLineInput.value);
        }
        if (fontFamilyInput.value) {
            setStorage('fontFamily', fontFamilyInput.value);
        }
        if (fontSizeInput.value) {
            const fontSize = parseInt(fontSizeInput.value, 10); // Parse font size as an integer
            if (!isNaN(fontSize)) {
                setStorage('fontSize', fontSize);
            }
        }
        alert('Settings saved to storage!');
    });

    loadSettings();
});