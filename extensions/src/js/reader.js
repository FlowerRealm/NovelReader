// extensions/src/js/reader.js

// StorageManager class (sends messages to background.js)
class StorageManager {
    static async get(key) {
        return new Promise((resolve, reject) => {
            const maxRetries = 3; let attempt = 0;
            const tryGetStorage = () => {
                attempt++;
                try {
                    if (!chrome.runtime || !chrome.runtime.sendMessage) {
                        // If called too early before runtime is ready (e.g. script just injected)
                        if (attempt < maxRetries) { setTimeout(tryGetStorage, 200 + attempt * 100); return; }
                        reject(new Error('Extension runtime not available for StorageManager.get')); return;
                    }
                    chrome.runtime.sendMessage({ action: 'getStorage', key }, response => {
                        if (chrome.runtime.lastError) {
                            console.warn('Reader.StorageManager.get error:', chrome.runtime.lastError.message, 'for key:', key);
                            if (attempt < maxRetries) { setTimeout(tryGetStorage, 1000); }
                            else { reject(chrome.runtime.lastError); }
                            return;
                        }
                        if (response && response.success) resolve(response.data);
                        else if (response && response.error) reject(new Error(response.error));
                        else resolve(null); // Assume null if no specific success/error structure but no chrome error
                    });
                } catch (error) {
                    console.warn('Reader.StorageManager.get send message error:', error);
                    if (attempt < maxRetries) { setTimeout(tryGetStorage, 1000); }
                    else { reject(error); }
                }
            };
            tryGetStorage();
        });
    }

    static async set(key, value) {
        return new Promise((resolve, reject) => {
            const maxRetries = 3; let attempt = 0;
            const trySetStorage = () => {
                attempt++;
                try {
                    if (!chrome.runtime || !chrome.runtime.sendMessage) {
                        if (attempt < maxRetries) { setTimeout(trySetStorage, 200 + attempt * 100); return; }
                        reject(new Error('Extension runtime not available for StorageManager.set')); return;
                    }
                    chrome.runtime.sendMessage({ action: 'setStorage', key, value }, response => {
                        if (chrome.runtime.lastError) {
                            console.warn('Reader.StorageManager.set error:', chrome.runtime.lastError.message, 'for key:', key);
                            if (attempt < maxRetries) { setTimeout(trySetStorage, 1000); }
                            else { reject(chrome.runtime.lastError); }
                            return;
                        }
                        if (response && response.success) resolve(true);
                        else if (response && response.error) reject(new Error(response.error));
                        else resolve(false); // Assume false if no specific success/error structure
                    });
                } catch (error) {
                    console.warn('Reader.StorageManager.set send message error:', error);
                    if (attempt < maxRetries) { setTimeout(trySetStorage, 1000); }
                    else { reject(error); }
                }
            };
            trySetStorage();
        });
    }

    // Helper to message background for DB operations or other specific actions
    static async messageBackground(messagePayload) { // Changed to accept a full payload
        return new Promise((resolve, reject) => {
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                reject(new Error('Extension runtime not available for messageBackground'));
                return;
            }
            chrome.runtime.sendMessage(messagePayload, response => {
                if (chrome.runtime.lastError) {
                    console.warn('Reader.messageBackground error:', chrome.runtime.lastError.message, 'for action:', messagePayload.action);
                    reject(chrome.runtime.lastError);
                    return;
                }
                if (response && response.success) {
                    resolve(response.data); // Assuming 'data' field holds the payload
                } else if (response && response.error) {
                    reject(new Error(response.error));
                } else {
                     // For getFileHandleFromDB, if data is null (no handle), it's a success with null data.
                    if (messagePayload.action === 'getFileHandleFromDB' && response && response.hasOwnProperty('data')) {
                         resolve(response.data);
                    } else {
                        console.warn('Invalid or unsuccessful response from background for action:', messagePayload.action, response);
                        resolve(null); // Resolve with null to prevent unhandled promise rejection often
                    }
                }
            });
        });
    }
}

// ReaderSettings class (unchanged)
class ReaderSettings { constructor() { this.fontFamily = 'Arial'; this.fontSize = '14px'; this.lineHeight = '1.5'; this.textColor = '#000000'; this.opacity = 0.85; this.hoverOpacity = 0.95; this.textShadow = true; this.maxWidth = 50; this.backgroundColor = 'rgba(255, 255, 255, 0.85)'; this.hoverBackgroundColor = 'rgba(255, 255, 255, 0.95)'; } async load() { const settings = await StorageManager.get('readerSettings'); if (settings) { Object.assign(this, settings); this.fontSize = this.fontSize + (typeof this.fontSize === 'number' ? 'px' : ''); this.lineHeight = String(this.lineHeight); } } async save() { await StorageManager.set('readerSettings', { fontFamily: this.fontFamily, fontSize: parseInt(this.fontSize), lineHeight: parseFloat(this.lineHeight), textColor: this.textColor, opacity: this.opacity, hoverOpacity: this.hoverOpacity, textShadow: this.textShadow, maxWidth: this.maxWidth, backgroundColor: this.backgroundColor, hoverBackgroundColor: this.hoverBackgroundColor }); } }

// Parsing function (needed here now)
function parseFileContentToLines(content, fileType) {
    let lines = [];
    let rawLines = [];
    let start = 0;
    let end;
    while ((end = content.indexOf('\n', start)) !== -1) { // Use literal \n for string.indexOf
        rawLines.push(content.substring(start, end));
        start = end + 1;
    }
    if (start < content.length) {
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


class NovelReader {
    constructor() {
        this.settings = new ReaderSettings(); this.container = null; this.content = null; this.measureContainer = null;
        this.isDragging = false; this.offsetX = 0; this.offsetY = 0;
        this.currentLine = 0; this.lines = []; this.autoHideTimer = null;
        this.currentFileHandle = null;
        this.defaultMessages = {}; // To be populated by updateMessages

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'localeChanged') { this.updateMessages(); this.updateContent(); }
            // If settings page stores a new handle, reader should re-initialize its content.
            if (message.action === 'fileHandleStored') {
                console.log("Reader: Received fileHandleStored. Re-initializing content.");
                this.initializeReaderContent(true); // Force refetch handle
            }
        });
    }

    updateMessages() { /* ... same as before ... */ }
    createContainer() { /* ... same as before ... */ }
    async savePosition() { /* ... same as before ... */ }
    async loadPosition() { /* ... same as before ... */ }
    updateContentStyle() { /* ... same as before ... */ }
    updateStyle() { /* ... same as before ... */ }
    initializeEventListeners() { /* ... same as before ... */ }
    async handleKeyDown(e) { /* ... same as before ... */ }
    async toggleVisibility() { /* ... same as before ... */ }
    async nextPage() { /* ... same as before ... */ }
    async previousPage() { /* ... same as before ... */ }
    updateContent() {
        if(!this.content || !this.measureContainer) {
            // If essential UI elements aren't ready, don't proceed.
            // This might happen if updateContent is called too early.
            console.warn("updateContent called before essential UI (this.content or this.measureContainer) is ready.");
            return;
        }

        let textToDisplay = ""; // Default to empty string

        if (this.lines && typeof this.currentLine === 'number' && this.currentLine >= 0 && this.lines.length > this.currentLine && this.lines[this.currentLine] !== undefined) {
            textToDisplay = this.lines[this.currentLine];
        } else if (this.defaultMessages && this.defaultMessages.noContent !== undefined) {
            textToDisplay = this.defaultMessages.noContent;
        }

        // Ensure textToDisplay is always a string before trim()
        // String() conversion handles null or undefined gracefully, turning them into "null" or "undefined"
        // which then trim correctly. If we want them to be empty string instead for trim:
        this.content.textContent = (textToDisplay === null || textToDisplay === undefined) ? "" : String(textToDisplay).trim();

        // Update measure container and width
        // Ensure this.content.style exists (it should if this.content exists and is a DOM element)
        // and settings are loaded for fallback font sizes/families.
        if (this.content.style && this.settings) {
            this.measureContainer.textContent = this.content.textContent;
            this.measureContainer.style.fontSize = this.content.style.fontSize || (this.settings.fontSize ? this.settings.fontSize + 'px' : '14px');
            this.measureContainer.style.fontFamily = this.content.style.fontFamily || this.settings.fontFamily || 'Arial';
        }

        try {
            // Ensure measureContainer has been rendered and has dimensions
            if (this.container && this.measureContainer.offsetWidth !== undefined && this.measureContainer.offsetWidth > 0) {
                const textWidth = this.measureContainer.offsetWidth;
                // Ensure window.innerWidth is available and positive
                const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
                const maxWidth = Math.min(textWidth, screenWidth > 0 ? screenWidth * 0.5 : textWidth);
                this.container.style.width = maxWidth + 'px';
            } else if (this.container) {
                 this.container.style.width = 'auto';
            }
        } catch(e) {
            console.warn("Error calculating text width in updateContent:", e);
            if(this.container) {
                this.container.style.width = 'auto';
            }
        }
    }
    startAutoHideTimer() { /* ... same as before ... */ }

    // Copy-pasted unchanged methods for brevity in generation, assume they are here
    // createContainer, savePosition, loadPosition, updateContentStyle, updateStyle,
    // initializeEventListeners, handleKeyDown, toggleVisibility, nextPage, previousPage,
    // updateContent, startAutoHideTimer
    // (Actual subtask will have the full methods)

    async initializeReaderContent(forceRefetchHandle = false) {
        try {
            if (forceRefetchHandle || !this.currentFileHandle) {
                 console.log("Reader: Fetching file handle from DB.");
                 this.currentFileHandle = await StorageManager.messageBackground({action: 'getFileHandleFromDB'});
            }
            const handle = this.currentFileHandle;

            if (!handle) {
                console.warn("Reader: No file handle found.");
                this.lines = [this.defaultMessages.noContent]; this.currentLine = 0;
                this.updateContent(); return;
            }

            console.log("Reader: Verifying permission for handle:", handle.name);
            let permissionState = await handle.queryPermission({ mode: 'read' });
            if (permissionState !== 'granted') {
                permissionState = await handle.requestPermission({ mode: 'read' });
                if (permissionState !== 'granted') {
                    console.error('Reader: Read permission for file handle denied.');
                    this.lines = [this.defaultMessages.permissionDeniedError]; this.currentLine = 0;
                    this.updateContent(); return;
                }
            }

            const file = await handle.getFile();
            console.log(`Reader: Reading file: ${file.name}, size: ${file.size}`);

            const [storedEncoding, currentLineNumStr, storedFileName] = await Promise.all([
                StorageManager.get('fileEncoding'), StorageManager.get('currentLine'), StorageManager.get('fileName')
            ]);
            const encodingToUse = storedEncoding || 'UTF-8';
            const fileType = storedFileName ? storedFileName.split('.').pop().toLowerCase() : 'txt';

            // Read file content using the stored encoding
            const buffer = await file.arrayBuffer();
            const decoder = new TextDecoder(encodingToUse); // encodingToUse is already defined in this scope
            const fileContentString = decoder.decode(buffer);

            console.log(`Reader: File content read (${fileContentString.length} chars), parsing lines.`);
            this.lines = parseFileContentToLines(fileContentString, fileType);
            console.log(`Reader: Parsed ${this.lines.length} lines.`);

            this.currentLine = Math.max(0, Math.min( (parseInt(currentLineNumStr || '1', 10)) - 1, this.lines.length - 1 ));

        } catch (error) {
            console.error("Reader: Error initializing content:", error);
            this.lines = [this.defaultMessages.fileReadError || `Error: ${error.message}`];
            this.currentLine = 0;
        } finally {
            this.updateContent(); this.startAutoHideTimer();
        }
    }

    async initialize() {
        this.updateMessages(); // Load i18n messages first
        this.createContainer();
        await this.settings.load();
        await this.loadPosition();
        this.updateStyle();
        this.initializeEventListeners();

        const isVisible = await StorageManager.get('isVisible');
        if (this.container) {
             this.container.style.display = isVisible === false ? 'none' : 'block';
        }
        await this.initializeReaderContent();
    }
}

// Full definitions for NovelReader methods that were previously placeholders
NovelReader.prototype.updateMessages = NovelReader.prototype.updateMessages || function() { this.defaultMessages = { noContent: chrome.i18n.getMessage('noContent') || "[i18n-key: noContent]", parseError: chrome.i18n.getMessage('parseError') || "[i18n-key: parseError]", permissionDeniedError: chrome.i18n.getMessage('permissionDeniedError') || "Permission denied to read file.", fileReadError: chrome.i18n.getMessage('fileReadError') || "Error reading file."}; };
NovelReader.prototype.createContainer = function() { const container = document.createElement('div'); container.id = 'novel-container'; Object.assign(container.style, { position: 'fixed', top: '10px', left: '10px', transform: 'none', zIndex: '1000', cursor: 'move', userSelect: 'none', opacity: this.settings.opacity, backgroundColor: this.settings.backgroundColor, padding: '10px 15px', borderRadius: '5px', display: 'inline-block', maxWidth: `${this.settings.maxWidth}%`, transition: 'all 0.3s ease' }); this.measureContainer = document.createElement('div'); Object.assign(this.measureContainer.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', padding: '2px 4px' }); if(document.body) document.body.appendChild(this.measureContainer); else console.warn("document.body not ready for measureContainer"); this.content = document.createElement('div'); this.content.id = 'novel-content'; this.updateContentStyle(); container.appendChild(this.content); if(document.body) document.body.appendChild(container); else console.warn("document.body not ready for novel container"); this.container = container; this.container.addEventListener('mousedown', (e) => { this.isDragging = true; const rect = this.container.getBoundingClientRect(); this.offsetX = e.clientX - rect.left; this.offsetY = e.clientY - rect.top; e.preventDefault(); this.container.style.opacity = this.settings.hoverOpacity; this.container.style.transition = 'none'; }); document.addEventListener('mousemove', (e) => { if (this.isDragging && this.container) { const newLeft = e.clientX - this.offsetX; const newTop = e.clientY - this.offsetY; const maxX = window.innerWidth - this.container.offsetWidth; const maxY = window.innerHeight - this.container.offsetHeight; this.container.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px'; this.container.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px'; } }); document.addEventListener('mouseup', () => { if (this.isDragging) { this.isDragging = false; if(this.container) {this.container.style.opacity = this.settings.opacity; this.container.style.transition = 'opacity 0.3s ease';} this.savePosition(); } }); container.addEventListener('mouseenter', () => { if (!this.isDragging && this.container) { container.style.opacity = this.settings.hoverOpacity; container.style.backgroundColor = this.settings.hoverBackgroundColor; if (this.settings.textShadow && this.content) { this.content.style.textShadow = '0 0 4px white'; } } }); container.addEventListener('mouseleave', () => { if (!this.isDragging && this.container) { container.style.opacity = this.settings.opacity; container.style.backgroundColor = this.settings.backgroundColor; if (this.settings.textShadow && this.content) { this.content.style.textShadow = '0 0 3px white'; } } }); return container; };
NovelReader.prototype.savePosition = async function() { if(!this.container) return; const position = { left: this.container.style.left, top: this.container.style.top }; await StorageManager.set('readerPosition', position); };
NovelReader.prototype.loadPosition = async function() { if(!this.container) return; try { const position = await StorageManager.get('readerPosition'); if (position) { this.container.style.left = position.left; this.container.style.top = position.top; } } catch (error) { console.error('Failed to load position:', error); this.container.style.left = '10px'; this.container.style.top = '10px'; } };
NovelReader.prototype.updateContentStyle = function() { if(!this.content) return; Object.assign(this.content.style, { display: 'inline', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pointerEvents: 'none', fontFamily: this.settings.fontFamily, fontSize: this.settings.fontSize, lineHeight: this.settings.lineHeight, color: this.settings.textColor, textShadow: this.settings.textShadow ? '0 0 3px white' : 'none' }); };
NovelReader.prototype.updateStyle = function() { this.updateContentStyle(); if(!this.container || !this.measureContainer) return; this.container.style.opacity = this.settings.opacity; this.container.style.maxWidth = `${this.settings.maxWidth}%`; this.container.style.backgroundColor = this.settings.backgroundColor; Object.assign(this.measureContainer.style, { fontFamily: this.settings.fontFamily, fontSize: this.settings.fontSize }); this.updateContent(); };
NovelReader.prototype.initializeEventListeners = function() { document.addEventListener('keydown', this.handleKeyDown.bind(this)); window.addEventListener('resize', () => { this.updateContent(); }); };
NovelReader.prototype.handleKeyDown = async function(e) { if (e.shiftKey) { switch (e.key.toUpperCase()) { case 'H': await this.toggleVisibility(); break; case 'N': await this.nextPage(); break; case 'P': await this.previousPage(); break; case 'J': for (let i = 0; i < 5; i++) { await this.nextPage(); } break; case 'K': for (let i = 0; i < 5; i++) { await this.previousPage(); } break; } } };
NovelReader.prototype.toggleVisibility = async function() { if(!this.container) return; const isVisible = await StorageManager.get('isVisible'); const newVisibility = isVisible === false ? true : false; this.container.style.display = newVisibility ? 'block' : 'none'; await StorageManager.set('isVisible', newVisibility); };
NovelReader.prototype.nextPage = async function() { if (this.currentLine < this.lines.length - 1) { this.currentLine++; this.updateContent(); await StorageManager.set('currentLine', this.currentLine + 1); this.startAutoHideTimer(); } };
NovelReader.prototype.previousPage = async function() { if (this.currentLine > 0) { this.currentLine--; this.updateContent(); await StorageManager.set('currentLine', this.currentLine + 1); this.startAutoHideTimer(); } };
NovelReader.prototype.updateContent = function() { if(!this.content || !this.measureContainer || !this.lines) return; const text = this.lines[this.currentLine] || this.defaultMessages.noContent; this.content.textContent = text.trim(); this.measureContainer.textContent = text.trim(); this.measureContainer.style.fontSize = this.content.style.fontSize; this.measureContainer.style.fontFamily = this.content.style.fontFamily; try { const textWidth = this.measureContainer.offsetWidth; const maxWidth = Math.min(textWidth, window.innerWidth * 0.5); if(this.container) this.container.style.width = maxWidth + 'px'; } catch(e) {if(this.container) this.container.style.width = 'auto';} };
NovelReader.prototype.startAutoHideTimer = function() { if (this.autoHideTimer) { clearTimeout(this.autoHideTimer); } this.autoHideTimer = setTimeout(() => { if(this.container) this.container.style.opacity = this.settings.opacity; }, 3000); };

// Initialize reader
// Content scripts might run at document_idle or document_end.
// Ensure DOM is ready for UI manipulation.
if (document.readyState === "complete" || document.readyState === "interactive") {
    new NovelReader().initialize();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        new NovelReader().initialize();
    });
}