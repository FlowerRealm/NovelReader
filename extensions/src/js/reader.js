console.log('Reader script loaded successfully.');

// Reverting to the original implementation with a standard textarea
const novelContainer = document.createElement('textarea');
novelContainer.id = 'novel-container';
novelContainer.style.position = 'fixed';
novelContainer.style.top = '10px';
novelContainer.style.left = '10px';
novelContainer.style.width = '300px';
novelContainer.style.height = '200px';
novelContainer.style.zIndex = '1000';
novelContainer.style.overflow = 'auto';
// Make the novel container borderless and transparent
novelContainer.style.border = 'none';
novelContainer.style.backgroundColor = 'transparent';
novelContainer.style.boxShadow = 'none';
document.body.appendChild(novelContainer);

// Ensure the novel container is draggable but auto-resizing
let isDragging = false;
let offsetX, offsetY;

novelContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - novelContainer.getBoundingClientRect().left;
    offsetY = e.clientY - novelContainer.getBoundingClientRect().top;
    document.body.style.cursor = 'move'; // Change cursor to indicate dragging
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
        document.body.style.cursor = 'default'; // Reset cursor
    }
});

// Automatically adjust the size of the container to fit its content
function adjustContainerSize() {
    novelContainer.style.height = 'auto'; // Reset height to auto to calculate scrollHeight
    novelContainer.style.width = 'auto'; // Reset width to auto to calculate scrollWidth
    novelContainer.style.height = `${novelContainer.scrollHeight}px`;
    novelContainer.style.width = `${novelContainer.scrollWidth}px`;
}

// Call adjustContainerSize whenever the content changes
novelContainer.addEventListener('input', adjustContainerSize);
novelContainer.addEventListener('change', adjustContainerSize);

// Initialize settings immediately on load
function initializeReader() {
    getStorage('novelContent', (novelContent) => {
        getStorage('novelLine', (novelLine) => {
            getStorage('fontFamily', (fontFamily) => {
                getStorage('fontSize', (fontSize) => {
                    novelLine = Math.max(0, parseInt(novelLine, 10) - 1); // 将用户输入的行号减1以适配数组索引
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

                    // Adjust size on initialization
                    adjustContainerSize();
                });
            });
        });
    });
}

// Helper function to get storage value
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

// Initialize reader on load
initializeReader();

// Keyboard functionality
let currentLine = 0;
let lines = [];

document.addEventListener('keydown', (e) => {
    if (e.key === 'h') { // Toggle visibility with 'h'
        novelContainer.style.display = novelContainer.style.display === 'none' ? 'block' : 'none';
    } else if (e.key === 'n') { // Read next line with 'n'
        if (lines.length > 0 && currentLine < lines.length - 1) {
            currentLine++;
            novelContainer.value = lines[currentLine] || 'End of file reached';
            // Save current line to background
            chrome.runtime.sendMessage({
                action: 'saveCurrentLine',
                data: { currentLine }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to save current line:', chrome.runtime.lastError);
                }
            });
        }
    }
});