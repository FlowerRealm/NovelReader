// 存储管理类
class StorageManager {
    static async get(key) {
        return new Promise((resolve, reject) => {
            const maxRetries = 3;
            let attempt = 0;

            const tryGetStorage = () => {
                attempt++;
                try {
                    chrome.runtime.sendMessage({ action: 'getStorage', key }, response => {
                        if (chrome.runtime.lastError) {
                            console.error('获取存储数据失败:', chrome.runtime.lastError);
                            if (attempt < maxRetries) {
                                setTimeout(tryGetStorage, 1000); // 1秒后重试
                            } else {
                                reject(chrome.runtime.lastError);
                            }
                            return;
                        }
                        resolve(response?.success ? response.data : null);
                    });
                } catch (error) {
                    console.error('发送消息失败:', error);
                    if (attempt < maxRetries) {
                        setTimeout(tryGetStorage, 1000);
                    } else {
                        reject(error);
                    }
                }
            };

            tryGetStorage();
        });
    }

    static async set(key, value) {
        return new Promise((resolve, reject) => {
            const maxRetries = 3;
            let attempt = 0;

            const trySetStorage = () => {
                attempt++;
                try {
                    chrome.runtime.sendMessage({ action: 'setStorage', key, value }, response => {
                        if (chrome.runtime.lastError) {
                            console.error('设置存储数据失败:', chrome.runtime.lastError);
                            if (attempt < maxRetries) {
                                setTimeout(trySetStorage, 1000);
                            } else {
                                reject(chrome.runtime.lastError);
                            }
                            return;
                        }
                        resolve(response?.success || false);
                    });
                } catch (error) {
                    console.error('发送消息失败:', error);
                    if (attempt < maxRetries) {
                        setTimeout(trySetStorage, 1000);
                    } else {
                        reject(error);
                    }
                }
            };

            trySetStorage();
        });
    }
}

// 阅读器设置类
class ReaderSettings {
    constructor() {
        this.fontFamily = 'Arial';
        this.fontSize = '14px';
        this.lineHeight = '1.5';
        this.textColor = '#000000';
        this.opacity = 0.85;
        this.hoverOpacity = 0.95;
        this.textShadow = true;
        this.maxWidth = 50;  // 屏幕宽度的百分比
        this.backgroundColor = 'rgba(255, 255, 255, 0.85)'; // 添加背景色设置
        this.hoverBackgroundColor = 'rgba(255, 255, 255, 0.95)'; // 添加悬停背景色
    }

    async load() {
        const settings = await StorageManager.get('readerSettings');
        if (settings) {
            Object.assign(this, settings);
            // 确保数值类型正确
            this.fontSize = this.fontSize + (typeof this.fontSize === 'number' ? 'px' : '');
            this.lineHeight = String(this.lineHeight);
        }
    }

    async save() {
        await StorageManager.set('readerSettings', {
            fontFamily: this.fontFamily,
            fontSize: parseInt(this.fontSize),
            lineHeight: parseFloat(this.lineHeight),
            textColor: this.textColor,
            opacity: this.opacity,
            hoverOpacity: this.hoverOpacity,
            textShadow: this.textShadow,
            maxWidth: this.maxWidth,
            backgroundColor: this.backgroundColor,
            hoverBackgroundColor: this.hoverBackgroundColor
        });
    }
}

// 小说阅读器类
class NovelReader {
    constructor() {
        this.settings = new ReaderSettings();
        this.container = null;
        this.content = null;
        this.measureContainer = null;
        this.isDragging = false;
        this.offsetX = 0;
        this.offsetY = 0;
        this.currentLine = 0;
        this.lines = [];
        this.autoHideTimer = null;
        // 使用 i18n API 获取本地化消息
        this.defaultMessages = {
            noContent: chrome.i18n.getMessage('noContent'),
            parseError: chrome.i18n.getMessage('parseError'),
            unsupportedFormat: chrome.i18n.getMessage('unsupportedFormat')
        };

        // 监听语言变更事件
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'localeChanged') {
                this.updateMessages();
                this.updateContent();
            }
        });
    }

    // 新增：更新本地化消息
    updateMessages() {
        this.defaultMessages = {
            noContent: chrome.i18n.getMessage('noContent') || '请在设置中设置小说内容',
            parseError: chrome.i18n.getMessage('parseError') || '解析文件失败，请确保文件格式正确',
            unsupportedFormat: chrome.i18n.getMessage('unsupportedFormat') || '暂不支持该格式'
        };
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'novel-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '10px',
            left: '10px',
            transform: 'none',
            zIndex: '1000',
            cursor: 'move',
            userSelect: 'none',
            opacity: this.settings.opacity,
            backgroundColor: this.settings.backgroundColor,
            padding: '10px 15px',
            borderRadius: '5px',
            display: 'inline-block',
            maxWidth: `${this.settings.maxWidth}%`,
            transition: 'all 0.3s ease'
        });

        // 创建一个隐藏的测量容器
        this.measureContainer = document.createElement('div');
        Object.assign(this.measureContainer.style, {
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            padding: '2px 4px'
        });
        document.body.appendChild(this.measureContainer);

        this.content = document.createElement('div');
        this.content.id = 'novel-content';
        this.updateContentStyle();

        container.appendChild(this.content);
        document.body.appendChild(container);
        this.container = container;

        // 事件监听器直接绑定到容器上
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            const rect = this.container.getBoundingClientRect();
            this.offsetX = e.clientX - rect.left;
            this.offsetY = e.clientY - rect.top;
            e.preventDefault();

            // 添加临时样式
            this.container.style.opacity = this.settings.hoverOpacity;
            this.container.style.transition = 'none';  // 拖动时禁用过渡效果
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const newLeft = e.clientX - this.offsetX;
                const newTop = e.clientY - this.offsetY;

                // 边界检查
                const maxX = window.innerWidth - this.container.offsetWidth;
                const maxY = window.innerHeight - this.container.offsetHeight;

                this.container.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
                this.container.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                // 恢复样式
                this.container.style.opacity = this.settings.opacity;
                this.container.style.transition = 'opacity 0.3s ease';
                this.savePosition();
            }
        });

        // 修改鼠标悬停效果
        container.addEventListener('mouseenter', () => {
            if (!this.isDragging) {
                container.style.opacity = this.settings.hoverOpacity;
                container.style.backgroundColor = this.settings.hoverBackgroundColor;
                if (this.settings.textShadow) {
                    this.content.style.textShadow = '0 0 4px white';
                }
            }
        });

        container.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                container.style.opacity = this.settings.opacity;
                container.style.backgroundColor = this.settings.backgroundColor;
                if (this.settings.textShadow) {
                    this.content.style.textShadow = '0 0 3px white';
                }
            }
        });

        return container;
    }

    async savePosition() {
        const position = {
            left: this.container.style.left,
            top: this.container.style.top
        };
        await StorageManager.set('readerPosition', position);
    }

    async loadPosition() {
        try {
            const position = await StorageManager.get('readerPosition');
            if (position) {
                this.container.style.left = position.left;
                this.container.style.top = position.top;
            }
        } catch (error) {
            console.error('Failed to load position:', error);
            // 如果加载位置失败，使用默认位置
            this.container.style.left = '10px';
            this.container.style.top = '10px';
        }
    }

    updateContentStyle() {
        Object.assign(this.content.style, {
            display: 'inline',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            pointerEvents: 'none',
            fontFamily: this.settings.fontFamily,
            fontSize: this.settings.fontSize,
            lineHeight: this.settings.lineHeight,
            color: this.settings.textColor,
            textShadow: this.settings.textShadow ? '0 0 3px white' : 'none'
        });
    }

    updateStyle() {
        this.updateContentStyle();
        this.container.style.opacity = this.settings.opacity;
        this.container.style.maxWidth = `${this.settings.maxWidth}%`;
        this.container.style.backgroundColor = this.settings.backgroundColor;

        // 更新测量容器样式
        Object.assign(this.measureContainer.style, {
            fontFamily: this.settings.fontFamily,
            fontSize: this.settings.fontSize
        });

        this.updateContent();
    }

    initializeEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('resize', () => {
            this.updateContent();  // 窗口大小改变时重新计算宽度
        });
    }

    async handleKeyDown(e) {
        if (e.shiftKey) {
            switch (e.key.toUpperCase()) {
                case 'H':
                    await this.toggleVisibility();
                    break;
                case 'N':
                    await this.nextPage();
                    break;
                case 'P':
                    await this.previousPage();
                    break;
                case 'J':  // 添加快速向下跳转
                    for (let i = 0; i < 5; i++) {
                        await this.nextPage();
                    }
                    break;
                case 'K':  // 添加快速向上跳转
                    for (let i = 0; i < 5; i++) {
                        await this.previousPage();
                    }
                    break;
            }
        }
    }

    async toggleVisibility() {
        const isVisible = await StorageManager.get('isVisible');
        const newVisibility = !isVisible;
        this.container.style.display = newVisibility ? 'block' : 'none';
        await StorageManager.set('isVisible', newVisibility);
    }

    async nextPage() {
        if (this.currentLine < this.lines.length - 1) {
            this.currentLine++;
            this.updateContent();
            await StorageManager.set('currentLine', this.currentLine + 1);
            this.startAutoHideTimer();  // 更新内容后启动自动隐藏计时器
        }
    }

    async previousPage() {
        if (this.currentLine > 0) {
            this.currentLine--;
            this.updateContent();
            await StorageManager.set('currentLine', this.currentLine + 1);
            this.startAutoHideTimer();  // 更新内容后启动自动隐藏计时器
        }
    }

    updateContent() {
        const text = this.lines[this.currentLine] || this.defaultMessages.noContent;
        this.content.textContent = text.trim();

        // 使用测量容器计算实际需要的宽度
        this.measureContainer.textContent = text.trim();
        this.measureContainer.style.fontSize = this.content.style.fontSize;
        this.measureContainer.style.fontFamily = this.content.style.fontFamily;

        // 获取文本实际宽度并应用到容器
        const textWidth = this.measureContainer.offsetWidth;
        const maxWidth = Math.min(textWidth, window.innerWidth * 0.5);  // 限制最大宽度为窗口的50%
        this.container.style.width = maxWidth + 'px';
    }

    startAutoHideTimer() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }
        this.autoHideTimer = setTimeout(() => {
            this.container.style.opacity = this.settings.opacity;
        }, 3000);  // 3秒后降低不透明度
    }

    async parseNovelContent(content, fileType) {
        let lines = [];

        switch (fileType.toLowerCase()) {
            case 'txt':
                lines = content.split('\n').filter(line => line.trim());
                break;
            case 'epub':
                throw new Error(this.defaultMessages.unsupportedFormat + ': EPUB');
            case 'pdf':
                throw new Error(this.defaultMessages.unsupportedFormat + ': PDF');
            case 'markdown':
            case 'md':
                // 移除Markdown标记
                lines = content.split('\n')
                    .map(line => line
                        .replace(/^#+\s+/, '') // 移除标题
                        .replace(/(\*\*|__)(.*?)\1/g, '$2') // 移除加粗
                        .replace(/(\*|_)(.*?)\1/g, '$2') // 移除斜体
                        .replace(/~~(.*?)~~/g, '$1') // 移除删除线
                        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接
                        .replace(/`{1,3}[^`]*`{1,3}/g, '') // 移除代码块
                        .trim()
                    )
                    .filter(line => line);
                break;
            default:
                // 尝试作为纯文本处理
                lines = content.split('\n').filter(line => line.trim());
        }

        return lines;
    }

    async initialize() {
        this.createContainer();
        await this.settings.load();
        await this.loadPosition();
        this.updateStyle();
        this.initializeEventListeners();
        this.updateMessages(); // 确保消息在初始化时已加载

        const [isVisible, content, line] = await Promise.all([
            StorageManager.get('isVisible'),
            StorageManager.get('novelContent'),
            StorageManager.get('novelLine')
        ]);

        this.container.style.display = isVisible ? 'block' : 'none';

        if (content) {
            try {
                // 从文件名或内容特征判断文件类型
                let fileType = 'txt';
                const fileName = await StorageManager.get('fileName');
                if (fileName) {
                    const ext = fileName.split('.').pop().toLowerCase();
                    if (['txt', 'md', 'markdown'].includes(ext)) {
                        fileType = ext;
                    }
                }

                this.lines = await this.parseNovelContent(content, fileType);
                this.currentLine = Math.min(
                    parseInt(line || 0, 10) - 1,
                    this.lines.length - 1
                );
                this.updateContent();
                this.startAutoHideTimer();
            } catch (error) {
                console.error('Failed to parse novel content:', error);
                // 使用最新的本地化消息
                this.lines = [this.defaultMessages.parseError];
                this.updateContent();
            }
        } else {
            // 使用最新的本地化消息
            this.lines = [this.defaultMessages.noContent];
            this.updateContent();
        }
    }
}

// 初始化阅读器
const reader = new NovelReader();
reader.initialize();