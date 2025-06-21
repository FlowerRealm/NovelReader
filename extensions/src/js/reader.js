// StorageManager class (unchanged)
class StorageManager {
    static async get(key) { return new Promise((resolve, reject) => { const maxRetries = 3; let attempt = 0; const tryGetStorage = () => { attempt++; try { chrome.runtime.sendMessage({ action: 'getStorage', key }, response => { if (chrome.runtime.lastError) { console.error('获取存储数据失败:', chrome.runtime.lastError); if (attempt < maxRetries) { setTimeout(tryGetStorage, 1000); } else { reject(chrome.runtime.lastError); } return; } resolve(response?.success ? response.data : null); }); } catch (error) { console.error('发送消息失败:', error); if (attempt < maxRetries) { setTimeout(tryGetStorage, 1000); } else { reject(error); } } }; tryGetStorage(); }); }
    static async set(key, value) { return new Promise((resolve, reject) => { const maxRetries = 3; let attempt = 0; const trySetStorage = () => { attempt++; try { chrome.runtime.sendMessage({ action: 'setStorage', key, value }, response => { if (chrome.runtime.lastError) { console.error('设置存储数据失败:', chrome.runtime.lastError); if (attempt < maxRetries) { setTimeout(trySetStorage, 1000); } else { reject(chrome.runtime.lastError); } return; } resolve(response?.success || false); }); } catch (error) { console.error('发送消息失败:', error); if (attempt < maxRetries) { setTimeout(trySetStorage, 1000); } else { reject(error); } } }; trySetStorage(); }); }
}

// ReaderSettings class (unchanged)
class ReaderSettings { constructor() { this.fontFamily = 'Arial'; this.fontSize = '14px'; this.lineHeight = '1.5'; this.textColor = '#000000'; this.opacity = 0.85; this.hoverOpacity = 0.95; this.textShadow = true; this.maxWidth = 50; this.backgroundColor = 'rgba(255, 255, 255, 0.85)'; this.hoverBackgroundColor = 'rgba(255, 255, 255, 0.95)'; } async load() { const settings = await StorageManager.get('readerSettings'); if (settings) { Object.assign(this, settings); this.fontSize = this.fontSize + (typeof this.fontSize === 'number' ? 'px' : ''); this.lineHeight = String(this.lineHeight); } } async save() { await StorageManager.set('readerSettings', { fontFamily: this.fontFamily, fontSize: parseInt(this.fontSize), lineHeight: parseFloat(this.lineHeight), textColor: this.textColor, opacity: this.opacity, hoverOpacity: this.hoverOpacity, textShadow: this.textShadow, maxWidth: this.maxWidth, backgroundColor: this.backgroundColor, hoverBackgroundColor: this.hoverBackgroundColor }); } }

class NovelReader {
    constructor() {
        this.settings = new ReaderSettings(); this.container = null; this.content = null; this.measureContainer = null;
        this.isDragging = false; this.offsetX = 0; this.offsetY = 0;
        this.currentLine = 0; this.lines = []; this.autoHideTimer = null;
        this.defaultMessages = {
            noContent: chrome.i18n.getMessage('noContent') || "[i18n-key: noContent]",
            parseError: chrome.i18n.getMessage('parseError') || "[i18n-key: parseError]",
            unsupportedFormat: chrome.i18n.getMessage('unsupportedFormat') || "[i18n-key: unsupportedFormat]"
        };
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'localeChanged') { this.updateMessages(); this.updateContent(); }
            if (message.action === 'novelLinesUpdated') { // Potentially from settings page if it re-saves
                 this.initializeReaderContent();
            }
        });
    }

    updateMessages() {
        this.defaultMessages = {
            noContent: chrome.i18n.getMessage('noContent') || "[i18n-key: noContent]",
            parseError: chrome.i18n.getMessage('parseError') || "[i18n-key: parseError]",
            unsupportedFormat: chrome.i18n.getMessage('unsupportedFormat') || "[i18n-key: unsupportedFormat]"
        };
    }

    createContainer() { const container = document.createElement('div'); container.id = 'novel-container'; Object.assign(container.style, { position: 'fixed', top: '10px', left: '10px', transform: 'none', zIndex: '1000', cursor: 'move', userSelect: 'none', opacity: this.settings.opacity, backgroundColor: this.settings.backgroundColor, padding: '10px 15px', borderRadius: '5px', display: 'inline-block', maxWidth: `${this.settings.maxWidth}%`, transition: 'all 0.3s ease' }); this.measureContainer = document.createElement('div'); Object.assign(this.measureContainer.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', padding: '2px 4px' }); document.body.appendChild(this.measureContainer); this.content = document.createElement('div'); this.content.id = 'novel-content'; this.updateContentStyle(); container.appendChild(this.content); document.body.appendChild(container); this.container = container; this.container.addEventListener('mousedown', (e) => { this.isDragging = true; const rect = this.container.getBoundingClientRect(); this.offsetX = e.clientX - rect.left; this.offsetY = e.clientY - rect.top; e.preventDefault(); this.container.style.opacity = this.settings.hoverOpacity; this.container.style.transition = 'none'; }); document.addEventListener('mousemove', (e) => { if (this.isDragging) { const newLeft = e.clientX - this.offsetX; const newTop = e.clientY - this.offsetY; const maxX = window.innerWidth - this.container.offsetWidth; const maxY = window.innerHeight - this.container.offsetHeight; this.container.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px'; this.container.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px'; } }); document.addEventListener('mouseup', () => { if (this.isDragging) { this.isDragging = false; this.container.style.opacity = this.settings.opacity; this.container.style.transition = 'opacity 0.3s ease'; this.savePosition(); } }); container.addEventListener('mouseenter', () => { if (!this.isDragging) { container.style.opacity = this.settings.hoverOpacity; container.style.backgroundColor = this.settings.hoverBackgroundColor; if (this.settings.textShadow) { this.content.style.textShadow = '0 0 4px white'; } } }); container.addEventListener('mouseleave', () => { if (!this.isDragging) { container.style.opacity = this.settings.opacity; container.style.backgroundColor = this.settings.backgroundColor; if (this.settings.textShadow) { this.content.style.textShadow = '0 0 3px white'; } } }); return container; }
    async savePosition() { const position = { left: this.container.style.left, top: this.container.style.top }; await StorageManager.set('readerPosition', position); }
    async loadPosition() { try { const position = await StorageManager.get('readerPosition'); if (position) { this.container.style.left = position.left; this.container.style.top = position.top; } } catch (error) { console.error('Failed to load position:', error); this.container.style.left = '10px'; this.container.style.top = '10px'; } }
    updateContentStyle() { Object.assign(this.content.style, { display: 'inline', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pointerEvents: 'none', fontFamily: this.settings.fontFamily, fontSize: this.settings.fontSize, lineHeight: this.settings.lineHeight, color: this.settings.textColor, textShadow: this.settings.textShadow ? '0 0 3px white' : 'none' }); }
    updateStyle() { this.updateContentStyle(); this.container.style.opacity = this.settings.opacity; this.container.style.maxWidth = `${this.settings.maxWidth}%`; this.container.style.backgroundColor = this.settings.backgroundColor; Object.assign(this.measureContainer.style, { fontFamily: this.settings.fontFamily, fontSize: this.settings.fontSize }); this.updateContent(); }
    initializeEventListeners() { document.addEventListener('keydown', this.handleKeyDown.bind(this)); window.addEventListener('resize', () => { this.updateContent(); }); }
    async handleKeyDown(e) { if (e.shiftKey) { switch (e.key.toUpperCase()) { case 'H': await this.toggleVisibility(); break; case 'N': await this.nextPage(); break; case 'P': await this.previousPage(); break; case 'J': for (let i = 0; i < 5; i++) { await this.nextPage(); } break; case 'K': for (let i = 0; i < 5; i++) { await this.previousPage(); } break; } } }
    async toggleVisibility() { const isVisible = await StorageManager.get('isVisible'); const newVisibility = !isVisible; this.container.style.display = newVisibility ? 'block' : 'none'; await StorageManager.set('isVisible', newVisibility); }
    async nextPage() { if (this.currentLine < this.lines.length - 1) { this.currentLine++; this.updateContent(); await StorageManager.set('currentLine', this.currentLine + 1); this.startAutoHideTimer(); } }
    async previousPage() { if (this.currentLine > 0) { this.currentLine--; this.updateContent(); await StorageManager.set('currentLine', this.currentLine + 1); this.startAutoHideTimer(); } }
    updateContent() { const text = this.lines[this.currentLine] || this.defaultMessages.noContent; this.content.textContent = text.trim(); this.measureContainer.textContent = text.trim(); this.measureContainer.style.fontSize = this.content.style.fontSize; this.measureContainer.style.fontFamily = this.content.style.fontFamily; const textWidth = this.measureContainer.offsetWidth; const maxWidth = Math.min(textWidth, window.innerWidth * 0.5); this.container.style.width = maxWidth + 'px'; }
    startAutoHideTimer() { if (this.autoHideTimer) { clearTimeout(this.autoHideTimer); } this.autoHideTimer = setTimeout(() => { this.container.style.opacity = this.settings.opacity; }, 3000); }

    async initializeReaderContent() {
        const [novelLinesArray, currentLineNumStr] = await Promise.all([
            StorageManager.get('novelLines'),
            StorageManager.get('currentLine')
        ]);

        if (novelLinesArray && Array.isArray(novelLinesArray)) {
            this.lines = novelLinesArray;
            this.currentLine = Math.max(0, Math.min(
                (parseInt(currentLineNumStr || '1', 10)) - 1,
                this.lines.length - 1
            ));
        } else {
            console.warn("novelLines not found in storage or not an array. Displaying 'no content'.");
            this.lines = [this.defaultMessages.noContent];
            this.currentLine = 0;
        }
        this.updateContent(); // Ensure content is updated after lines are set
        this.startAutoHideTimer(); // Also start timer if content is loaded
    }

    async initialize() {
        this.createContainer();
        await this.settings.load();
        await this.loadPosition();
        this.updateStyle();
        this.initializeEventListeners();
        this.updateMessages();

        const isVisible = await StorageManager.get('isVisible');
        this.container.style.display = isVisible ? 'block' : 'none';

        await this.initializeReaderContent();
    }
}

const reader = new NovelReader();
reader.initialize();