console.log('Reader script loaded successfully.');

const novelContainer = document.createElement('textarea');
novelContainer.id = 'novel-container';
novelContainer.style.position = 'fixed';
novelContainer.style.top = '10px';
novelContainer.style.left = '10px';
novelContainer.style.width = '300px';
novelContainer.style.height = '200px';
novelContainer.style.zIndex = '1000';
novelContainer.style.border = 'none';
novelContainer.style.backgroundColor = 'transparent';
novelContainer.style.boxShadow = 'none';
novelContainer.style.resize = 'none';
novelContainer.style.overflow = 'hidden';
novelContainer.style.whiteSpace = 'nowrap';
novelContainer.style.overflowX = 'hidden';
novelContainer.style.textOverflow = 'ellipsis';
document.body.appendChild(novelContainer);

let isDragging = false;
let offsetX, offsetY;
let currentLine = 0;
let lines = [];
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

novelContainer.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
        saveNovelContainerPosition();
    }
});

novelContainer.addEventListener('input', () => {
    novelContainer.style.width = 'auto';
    novelContainer.style.width = `${novelContainer.scrollWidth}px`;
});
function saveNovelContainerPosition() {
    const position = {
        top: novelContainer.style.top,
        left: novelContainer.style.left
    };
    localStorage.setItem('novelContainerPosition', JSON.stringify(position));
}

function loadNovelContainerPosition() {
    const position = JSON.parse(localStorage.getItem('novelContainerPosition'));
    if (position) {
        novelContainer.style.top = position.top;
        novelContainer.style.left = position.left;
    }
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
    if (!chrome || !chrome.storage || !chrome.storage.local) {
        console.error('Extension context is invalid. Cannot save visibility state.');
        return;
    }
    chrome.storage.local.set({ isVisible }, () => {
        if (chrome.runtime.lastError) {
            console.error('Failed to save visibility state:', chrome.runtime.lastError);
        }
    });
}
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
                    novelLine = Math.max(1, parseInt(novelLine, 10));
                    fontFamily = fontFamily || 'Arial';
                    fontSize = parseInt(fontSize, 10) || 16;

                    if (novelContent) {
                        lines = novelContent.split('\n');
                        currentLine = Math.min(novelLine - 1, lines.length - 1);
                        novelContainer.value = lines[currentLine] || 'File is empty';
                    } else {
                        novelContainer.value = 'No novel content found. Please set the file content in settings.';
                    }

                    novelContainer.style.fontFamily = fontFamily;
                    novelContainer.style.fontSize = `${fontSize}px`;

                    novelContainer.style.height = 'auto';
                    novelContainer.style.width = 'auto';
                    novelContainer.style.height = `${novelContainer.scrollHeight}px`;
                    novelContainer.style.width = `${novelContainer.scrollWidth}px`;
                });
            });
        });
    });
}

// Visibility toggling
async function toggleVisibility() {
    try {
        const isCurrentlyHidden = novelContainer.style.display === 'none';
        const newVisibility = isCurrentlyHidden ? 'block' : 'none';
        novelContainer.style.display = newVisibility;
        await saveVisibilityState(newVisibility === 'block');
    } catch (error) {
        console.error('Failed to toggle visibility:', error);
    }
}

function toggleContainerContent() {
    const isCurrentlyHidden = novelContainer.style.display === 'none';
    novelContainer.style.display = isCurrentlyHidden ? 'block' : 'none';

    if (isCurrentlyHidden) {
        novelContainer.value = lines[currentLine] || 'No content available';
    } else {
        novelContainer.value = '';
    }

    saveVisibilityState(isCurrentlyHidden);
}
document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'H') {
        chrome.storage.local.get('isVisible', (result) => {
            const isVisible = result.isVisible;
            if (isVisible) {
                novelContainer.style.display = 'none';
                chrome.storage.local.set({ isVisible: false }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to update visibility state:', chrome.runtime.lastError);
                    }
                });
            } else {
                novelContainer.style.display = 'block';
                novelContainer.style.width = 'auto';
                novelContainer.style.height = 'auto';
                novelContainer.style.width = `${novelContainer.scrollWidth}px`;
                novelContainer.style.height = `${novelContainer.scrollHeight}px`;

                chrome.storage.local.set({ isVisible: true }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to update visibility state:', chrome.runtime.lastError);
                    }
                });
            }
        });
    } else if (e.shiftKey && e.key === 'N') {
        if (lines.length > 0 && currentLine < lines.length - 1) {
            currentLine++;
            novelContainer.value = lines[currentLine] || 'End of file reached';
            console.log(`Saving current line: ${currentLine + 1}`);
            chrome.runtime.sendMessage({
                action: 'saveCurrentLine',
                data: { currentLine: currentLine + 1 }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to send saveCurrentLine message:', chrome.runtime.lastError);
                } else if (!response || !response.success) {
                    console.error('Failed to save current line:', response ? response.error : 'Unknown error');
                } else {
                    console.log('Current line saved successfully.');
                }
            });
        }
    } else if (e.shiftKey && e.key === 'P') {
        if (lines.length > 0 && currentLine > 0) {
            currentLine--;
            novelContainer.value = lines[currentLine] || 'Start of file reached';
            console.log(`Saving current line: ${currentLine + 1}`);
            chrome.runtime.sendMessage({
                action: 'saveCurrentLine',
                data: { currentLine: currentLine + 1 }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to send saveCurrentLine message:', chrome.runtime.lastError);
                } else if (!response || !response.success) {
                    console.error('Failed to save current line:', response ? response.error : 'Unknown error');
                } else {
                    console.log('Current line saved successfully.');
                }
            });
        }
    }
});

loadNovelContainerPosition();
initializeReader();