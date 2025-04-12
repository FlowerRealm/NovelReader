console.log('Reader script loaded successfully.');

const novelContainer = document.createElement('textarea');
novelContainer.id = 'novel-container';
novelContainer.style.position = 'fixed';
novelContainer.style.top = '10px';
novelContainer.style.left = '10px';
novelContainer.style.width = '300px';
novelContainer.style.height = '200px';
novelContainer.style.zIndex = '1000';
novelContainer.style.overflow = 'auto';
novelContainer.style.border = 'none';
novelContainer.style.backgroundColor = 'transparent';
novelContainer.style.boxShadow = 'none';
document.body.appendChild(novelContainer);

let isDragging = false;
let offsetX, offsetY;

novelContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - novelContainer.getBoundingClientRect().left;
    offsetY = e.clientY - novelContainer.getBoundingClientRect().top;
    document.body.style.cursor = 'move';
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const newLeft = e.clientX - offsetX;
        const newTop = e.clientY - offsetY;
        novelContainer.style.left = `${newLeft}px`;
        novelContainer.style.top = `${newTop}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
    }
});

function adjustContainerSize() {
    novelContainer.style.height = 'auto';
    novelContainer.style.width = 'auto';
    novelContainer.style.height = `${novelContainer.scrollHeight}px`;
    novelContainer.style.width = `${novelContainer.scrollWidth}px`;
}

novelContainer.addEventListener('input', adjustContainerSize);
novelContainer.addEventListener('change', adjustContainerSize);

function initializeReader() {
    chrome.storage.local.get('isVisible', (result) => {
        if (chrome.runtime.lastError) {
            console.error('Failed to load visibility state:', chrome.runtime.lastError);
        } else {
            novelContainer.style.display = result.isVisible ? 'block' : 'none';
        }
    });

    getStorage('novelContent', (novelContent) => {
        if (!novelContent) {
            console.warn('No novel content found in storage.');
        }
    });

    getStorage('novelContent', (novelContent) => {
        getStorage('novelLine', (novelLine) => {
            getStorage('fontFamily', (fontFamily) => {
                getStorage('fontSize', (fontSize) => {
                    novelLine = Math.max(0, parseInt(novelLine, 10) - 1);
                    fontFamily = fontFamily || 'Arial';
                    fontSize = parseInt(fontSize, 10) || 16;

                    if (novelContent) {
                        lines = novelContent.split('\n');
                        currentLine = Math.min(novelLine, lines.length - 1);
                        novelContainer.value = lines[currentLine] || 'File is empty';
                    } else {
                        novelContainer.value = 'No novel content found. Please set the file content in settings.';
                    }

                    novelContainer.style.fontFamily = fontFamily;
                    novelContainer.style.fontSize = `${fontSize}px`;

                    adjustContainerSize();
                });
            });
        });
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

function saveVisibilityState(isVisible) {
    chrome.storage.local.set({ isVisible }, () => {
        if (chrome.runtime.lastError) {
            console.error('Failed to save visibility state:', chrome.runtime.lastError);
        }
    });
}

function loadVisibilityState() {
    chrome.storage.local.get('isVisible', (result) => {
        if (chrome.runtime.lastError) {
            console.error('Failed to load visibility state:', chrome.runtime.lastError);
        } else {
            novelContainer.style.display = result.isVisible ? 'block' : 'none';
        }
    });
}

initializeReader();

let currentLine = 0;
let lines = [];

document.addEventListener('keydown', (e) => {
    if (e.key === 'h') {
        const isVisible = novelContainer.style.display === 'none';
        novelContainer.style.display = isVisible ? 'block' : 'none';
        saveVisibilityState(isVisible);
    } else if (e.key === 'n') {
        if (lines.length > 0 && currentLine < lines.length - 1) {
            currentLine++;
            novelContainer.value = lines[currentLine] || 'End of file reached';
            chrome.runtime.sendMessage({
                action: 'saveCurrentLine',
                data: { currentLine }
            });
        }
    }
});