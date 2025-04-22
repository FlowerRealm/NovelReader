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

// Consolidate repetitive style updates into a helper function
function updateNovelContainerStyle(styles) {
    Object.assign(novelContainer.style, styles);
}

// Simplify event listeners
novelContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - novelContainer.getBoundingClientRect().left;
    offsetY = e.clientY - novelContainer.getBoundingClientRect().top;
    document.body.style.cursor = 'move';
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        updateNovelContainerStyle({
            left: `${e.clientX - offsetX}px`,
            top: `${e.clientY - offsetY}px`
        });
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
    updateNovelContainerStyle({
        width: 'auto',
        width: `${novelContainer.scrollWidth}px`
    });
});

function saveNovelContainerPosition() {
    const { top, left } = novelContainer.style;
    localStorage.setItem('novelContainerPosition', JSON.stringify({ top, left }));
}

function loadNovelContainerPosition() {
    const position = JSON.parse(localStorage.getItem('novelContainerPosition'));
    if (position) {
        updateNovelContainerStyle(position);
    }
}

function initializeReader() {
    chrome.runtime.sendMessage({ action: 'getStorage', key: 'isVisible' }, (response) => {
        if (response && response.success) {
            novelContainer.style.display = response.data ? 'block' : 'none';
        }
    });

    chrome.runtime.sendMessage({ action: 'getStorage', key: 'novelContent' }, (response) => {
        if (response && response.success) {
            const novelContent = response.data;
            if (novelContent) {
                lines = novelContent.split('\n');
                chrome.runtime.sendMessage({ action: 'getStorage', key: 'novelLine' }, (lineResponse) => {
                    if (lineResponse && lineResponse.success) {
                        currentLine = Math.min(parseInt(lineResponse.data, 10) - 1, lines.length - 1);
                        novelContainer.value = lines[currentLine] || 'File is empty';
                    }
                });
            } else {
                novelContainer.value = 'No novel content found. Please set the file content in settings.';
            }
        }
    });
}

// Simplify toggle visibility logic
async function toggleVisibility() {
    const isCurrentlyHidden = novelContainer.style.display === 'none';
    const newVisibility = isCurrentlyHidden ? 'block' : 'none';
    updateNovelContainerStyle({ display: newVisibility });
    chrome.runtime.sendMessage({ action: 'setStorage', key: 'isVisible', value: isCurrentlyHidden });
}

function toggleContainerContent() {
    const isCurrentlyHidden = novelContainer.style.display === 'none';
    novelContainer.style.display = isCurrentlyHidden ? 'block' : 'none';

    if (isCurrentlyHidden) {
        novelContainer.value = lines[currentLine] || 'No content available';
    } else {
        novelContainer.value = '';
    }

    chrome.runtime.sendMessage({ action: 'setStorage', key: 'isVisible', value: isCurrentlyHidden });
}

// Simplify keydown event handling
document.addEventListener('keydown', (e) => {
    if (e.shiftKey) {
        switch (e.key) {
            case 'H':
                chrome.runtime.sendMessage({ action: 'getStorage', key: 'isVisible' }, (response) => {
                    if (response?.success) {
                        const isVisible = response.data;
                        updateNovelContainerStyle({
                            display: isVisible ? 'none' : 'block',
                            width: isVisible ? '' : `${novelContainer.scrollWidth}px`,
                            height: isVisible ? '' : `${novelContainer.scrollHeight}px`
                        });
                        chrome.runtime.sendMessage({ action: 'setStorage', key: 'isVisible', value: !isVisible });
                    }
                });
                break;
            case 'N':
                if (lines.length > 0 && currentLine < lines.length - 1) {
                    novelContainer.value = lines[++currentLine] || 'End of file reached';
                    chrome.runtime.sendMessage({ action: 'setStorage', key: 'currentLine', value: currentLine + 1 });
                }
                break;
            case 'P':
                if (lines.length > 0 && currentLine > 0) {
                    novelContainer.value = lines[--currentLine] || 'Start of file reached';
                    chrome.runtime.sendMessage({ action: 'setStorage', key: 'currentLine', value: currentLine + 1 });
                }
                break;
        }
    }
});

loadNovelContainerPosition();
initializeReader();