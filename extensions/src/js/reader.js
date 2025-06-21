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
                    if (messagePayload.action === 'getNovelLinesFromSessionCache' && response && response.hasOwnProperty('data')) {resolve(response.data);} else { console.warn('Invalid or unsuccessful response from background for action:', messagePayload.action, response); resolve(null);}}});});}}
// ReaderSettings class (unchanged)
class ReaderSettings { /* ... (same as before) ... */ }
// Full ReaderSettings for clarity
ReaderSettings.prototype.constructor = function() { this.fontFamily = 'Arial'; this.fontSize = '14px'; this.lineHeight = '1.5'; this.textColor = '#000000'; this.opacity = 0.85; this.hoverOpacity = 0.95; this.textShadow = true; this.maxWidth = 50; this.backgroundColor = 'rgba(255, 255, 255, 0.85)'; this.hoverBackgroundColor = 'rgba(255, 255, 255, 0.95)'; }; ReaderSettings.prototype.load = async function() { const settings = await StorageManager.get('readerSettings'); if (settings) { Object.assign(this, settings); this.fontSize = this.fontSize + (typeof this.fontSize === 'number' ? 'px' : ''); this.lineHeight = String(this.lineHeight); } };

// REMOVE parseFileContentToLines from reader.js - it's now in settings.js

class NovelReader {
    constructor() {
        this.settings = new ReaderSettings(); this.container = null; this.content = null; this.measureContainer = null;
        this.isDragging = false; this.offsetX = 0; this.offsetY = 0;
        this.currentLine = 0; this.lines = []; this.autoHideTimer = null;
        // No currentFileHandle needed with this fallback strategy
        this.defaultMessages = {};

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'localeChanged') { this.updateMessages(); this.updateContent(); }
            if (message.action === 'novelLinesUpdated') {
                console.log("Reader: Received novelLinesUpdated.");
                this.lines = message.lines || []; // Expect lines directly
                this.currentLine = 0; // Reset to start for new content
                // Optionally re-fetch currentLine progress if fileName matches message.fileName
                this.updateContent();
            }
        });
    }

    updateMessages() { /* ... (same as before, including permissionDeniedError, fileReadError although less relevant now) ... */ }
    // Full updateMessages
    updateMessages = function() { this.defaultMessages = { noContent: chrome.i18n.getMessage('noContent') || "[i18n-key: noContent]", parseError: chrome.i18n.getMessage('parseError') || "[i18n-key: parseError]", permissionDeniedError: chrome.i18n.getMessage('permissionDeniedError') || "Permission denied to read file.", fileReadError: chrome.i18n.getMessage('fileReadError') || "Error reading file."}; };


    createContainer() { /* ... (same as before) ... */ }
    async savePosition() { /* ... (same as before) ... */ }
    async loadPosition() { /* ... same as before ... */ }
    updateContentStyle() { /* ... same as before ... */ }
    updateStyle() { /* ... same as before ... */ }
    initializeEventListeners() { /* ... same as before ... */ }
    async handleKeyDown(e) { /* ... same as before ... */ }
    async toggleVisibility() { /* ... same as before ... */ }
    async nextPage() { /* ... same as before ... */ }
    async previousPage() { /* ... same as before ... */ }
    updateContent() { /* ... (same as before, using this.lines and this.defaultMessages) ... */ }
    startAutoHideTimer() { /* ... same as before ... */ }

    async initializeReaderContent() {
        try {
            console.log("Reader: Attempting to get novel lines from session cache.");
            const cachedData = await StorageManager.messageBackground({action: 'getNovelLinesFromSessionCache'});

            if (cachedData && cachedData.lines && Array.isArray(cachedData.lines)) {
                console.log(`Reader: Loaded ${cachedData.lines.length} lines for '${cachedData.fileName}' from session cache.`);
                this.lines = cachedData.lines;
                const currentLineNumStr = await StorageManager.get('currentLine');
                // Ensure currentLine is valid for the newly loaded lines
                this.currentLine = Math.max(0, Math.min(
                    (parseInt(currentLineNumStr || '1', 10)) - 1,
                    this.lines.length - 1
                ));
            } else {
                const storedFileName = await StorageManager.get('fileName');
                if (storedFileName) {
                    console.warn(`Reader: No lines in session cache. File '${storedFileName}' needs re-load from Settings.`);
                    this.lines = [chrome.i18n.getMessage('reloadNovelInSettings') || `Novel '${storedFileName}' not loaded. Please reload from Settings.`];
                } else {
                    console.warn("Reader: No lines in session cache and no stored filename.");
                    this.lines = [this.defaultMessages.noContent];
                }
                this.currentLine = 0;
            }
        } catch (error) {
            console.error("Reader: Error initializing content:", error);
            this.lines = [this.defaultMessages.parseError || `Error: ${error.message}`];
            this.currentLine = 0;
        } finally {
            this.updateContent();
            this.startAutoHideTimer();
        }
    }

    async initialize() { /* ... (same as before, calls initializeReaderContent) ... */ }
}
// Full prototype methods and initialization for NovelReader (copy-pasted for tool, ensure they are complete)
NovelReader.prototype.createContainer = function() {
   console.log("[Reader createContainer] Called.");
   const container = document.createElement('div');
   container.id = 'novel-container';
   Object.assign(container.style, { position: 'fixed', top: '10px', left: '10px', transform: 'none', zIndex: '1000', cursor: 'move', userSelect: 'none', opacity: this.settings.opacity, backgroundColor: this.settings.backgroundColor, padding: '10px 15px', borderRadius: '5px', display: 'inline-block', maxWidth: `${this.settings.maxWidth}%`, transition: 'all 0.3s ease' });

   this.measureContainer = document.createElement('div');
   console.log("[Reader createContainer] this.measureContainer created:", this.measureContainer);
   Object.assign(this.measureContainer.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', padding: '2px 4px' });

   console.log("[Reader createContainer] document.body available for measureContainer?", !!document.body);
   if(document.body) {
       document.body.appendChild(this.measureContainer);
   } else {
       console.warn("[Reader createContainer] document.body not ready for measureContainer.");
   }

   this.content = document.createElement('div');
   this.content.id = 'novel-content';
   console.log("[Reader createContainer] this.content created:", this.content);
   // updateContentStyle is called here, ensure this.content is set before it's called if it relies on it.
   // Current updateContentStyle uses this.content directly, so it's fine.
   this.updateContentStyle();

   container.appendChild(this.content);

   console.log("[Reader createContainer] document.body available for main container?", !!document.body);
   if(document.body) {
       document.body.appendChild(container);
   } else {
       console.warn("[Reader createContainer] document.body not ready for novel container.");
   }

   this.container = container;
   console.log("[Reader createContainer] this.container assigned:", this.container);

   // Event listeners
   this.container.addEventListener('mousedown', (e) => { this.isDragging = true; const rect = this.container.getBoundingClientRect(); this.offsetX = e.clientX - rect.left; this.offsetY = e.clientY - rect.top; e.preventDefault(); this.container.style.opacity = this.settings.hoverOpacity; this.container.style.transition = 'none'; });
   document.addEventListener('mousemove', (e) => { if (this.isDragging && this.container) { const newLeft = e.clientX - this.offsetX; const newTop = e.clientY - this.offsetY; const maxX = window.innerWidth - this.container.offsetWidth; const maxY = window.innerHeight - this.container.offsetHeight; this.container.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px'; this.container.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px'; } });
   document.addEventListener('mouseup', () => { if (this.isDragging) { this.isDragging = false; if(this.container) {this.container.style.opacity = this.settings.opacity; this.container.style.transition = 'opacity 0.3s ease';} this.savePosition(); } });
   container.addEventListener('mouseenter', () => { if (!this.isDragging && this.container) { container.style.opacity = this.settings.hoverOpacity; container.style.backgroundColor = this.settings.hoverBackgroundColor; if (this.settings.textShadow && this.content) { this.content.style.textShadow = '0 0 4px white'; } } });
   container.addEventListener('mouseleave', () => { if (!this.isDragging && this.container) { container.style.opacity = this.settings.opacity; container.style.backgroundColor = this.settings.backgroundColor; if (this.settings.textShadow && this.content) { this.content.style.textShadow = '0 0 3px white'; } } });

   console.log("[Reader createContainer] END. States: container=", !!this.container, "content=", !!this.content, "measureContainer=", !!this.measureContainer);
   return container;
}; NovelReader.prototype.savePosition = async function() {/*...*/}; NovelReader.prototype.loadPosition = async function() {/*...*/}; NovelReader.prototype.updateContentStyle = function() {/*...*/}; NovelReader.prototype.updateStyle = function() {/*...*/}; NovelReader.prototype.initializeEventListeners = function() {/*...*/}; NovelReader.prototype.handleKeyDown = async function(e) {/*...*/}; NovelReader.prototype.toggleVisibility = async function() {/*...*/}; NovelReader.prototype.nextPage = async function() {if(this.currentLine<this.lines.length-1){this.currentLine++; this.updateContent(); await StorageManager.set('currentLine', this.currentLine + 1); this.startAutoHideTimer();}}; NovelReader.prototype.previousPage = async function() {if(this.currentLine>0){this.currentLine--; this.updateContent(); await StorageManager.set('currentLine', this.currentLine + 1); this.startAutoHideTimer();}};
NovelReader.prototype.updateContent = function() { if(!this.content || !this.measureContainer) { console.warn("updateContent called before essential UI is ready."); return; } let textToDisplay = ""; if (this.lines && typeof this.currentLine === 'number' && this.currentLine >= 0 && this.lines.length > this.currentLine && this.lines[this.currentLine] !== undefined) { textToDisplay = this.lines[this.currentLine]; } else if (this.defaultMessages && this.defaultMessages.noContent !== undefined) { textToDisplay = this.defaultMessages.noContent; } this.content.textContent = (textToDisplay === null || textToDisplay === undefined) ? "" : String(textToDisplay).trim(); if (this.content.style && this.settings) { this.measureContainer.textContent = this.content.textContent; this.measureContainer.style.fontSize = this.content.style.fontSize || (this.settings.fontSize ? this.settings.fontSize + 'px' : '14px'); this.measureContainer.style.fontFamily = this.content.style.fontFamily || this.settings.fontFamily || 'Arial'; } try { if (this.container && this.measureContainer.offsetWidth !== undefined && this.measureContainer.offsetWidth > 0) { const textWidth = this.measureContainer.offsetWidth; const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0; const maxWidth = Math.min(textWidth, screenWidth > 0 ? screenWidth * 0.5 : textWidth); this.container.style.width = maxWidth + 'px'; } else if (this.container) { this.container.style.width = 'auto'; } } catch(e) { console.warn("Error calculating text width:", e); if(this.container) { this.container.style.width = 'auto'; } } };
NovelReader.prototype.startAutoHideTimer = function() { if (this.autoHideTimer) { clearTimeout(this.autoHideTimer); } this.autoHideTimer = setTimeout(() => { if(this.container) this.container.style.opacity = this.settings.opacity; }, 3000); };
NovelReader.prototype.initialize = async function() {
   // This is the body of NovelReader.prototype.initialize
   console.log("[Reader initialize] START. Initial states: container=", !!this.container, "content=", !!this.content, "measureContainer=", !!this.measureContainer);
   this.updateMessages();

   console.log("[Reader initialize] BEFORE createContainer. States: container=", !!this.container, "content=", !!this.content, "measureContainer=", !!this.measureContainer);
   this.createContainer();
   console.log("[Reader initialize] AFTER createContainer. States: container=", !!this.container, "content=", !!this.content, "measureContainer=", !!this.measureContainer);

   await Promise.resolve();
   console.log("[Reader initialize] AFTER Promise.resolve. States: container=", !!this.container, "content=", !!this.content, "measureContainer=", !!this.measureContainer);

   if (!this.container || !this.content || !this.measureContainer) {
       console.error("Reader: Critical UI elements (container, content, or measureContainer) not properly created. Aborting further UI initialization for this instance.");
       return;
   }

   await this.settings.load();
   await this.loadPosition();

   // Only call updateStyle (and thus the first updateContent) if elements are confirmed ready
   this.updateStyle();

   this.initializeEventListeners();

   const isVisible = await StorageManager.get('isVisible');
   // The this.container check here is good, as isVisible might be from storage before UI is fully set.
   if (this.container) {
       this.container.style.display = isVisible === false ? 'none' : 'block';
   }

   await this.initializeReaderContent();
   console.log("[Reader initialize] END.");
};


if (document.readyState === "complete" || document.readyState === "interactive") { new NovelReader().initialize(); }
else { document.addEventListener('DOMContentLoaded', () => { new NovelReader().initialize(); }); }