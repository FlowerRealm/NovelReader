// 存储管理类
class StorageManager {
    static async get(key) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result[key] ?? null);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async set(key, value) {
        if (value === undefined || value === null || value === '') {
            throw new Error('存储值不能为空');
        }

        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ [key]: value }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(true);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async validate(value) {
        return value !== undefined && value !== null && value !== '';
    }
}

// 语言管理类
class LanguageManager {
    static async getCurrentLocale() {
        try {
            const locale = await StorageManager.get('preferredLocale');
            console.log('Current locale:', locale);
            return locale || chrome.i18n.getUILanguage();
        } catch (error) {
            console.error('获取语言设置失败:', error);
            return chrome.i18n.getUILanguage();
        }
    }

    static async setLocale(locale) {
        try {
            console.log('Setting locale to:', locale);
            if (!['zh_CN', 'en'].includes(locale)) {
                throw new Error(`不支持的语言: ${locale}`);
            }
            await StorageManager.set('preferredLocale', locale);
            // 广播语言变更事件给所有页面
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'localeChanged', locale });
                });
            });
            return true;
        } catch (error) {
            console.error('设置语言失败:', error);
            return false;
        }
    }
}

// 打开设置页面
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("src/html/settings.html")
    });
});

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 检查连接状态
    if (!chrome.runtime.id) {
        console.error('扩展连接已断开');
        sendResponse({ success: false, error: '扩展连接已断开' });
        return false;
    }

    const handleAsyncOperation = async () => {
        try {
            if (!message || !message.action) {
                throw new Error('无效的消息格式');
            }

            switch (message.action) {
                case 'getStorage':
                    if (!message.key) {
                        throw new Error('缺少存储键名');
                    }
                    const data = await StorageManager.get(message.key);
                    return { success: true, data };

                case 'setStorage':
                    if (!message.key || message.value === undefined) {
                        throw new Error('缺少必要的存储参数');
                    }
                    await StorageManager.set(message.key, message.value);
                    return { success: true };

                case 'validateNotEmpty':
                    const isValid = await StorageManager.validate(message.value);
                    return { success: true, isValid };

                case 'getCurrentLocale':
                    const locale = await LanguageManager.getCurrentLocale();
                    return { success: true, data: locale };

                case 'setLocale':
                    if (!message.value) {
                        throw new Error('缺少语言设置参数');
                    }
                    await LanguageManager.setLocale(message.value);
                    return { success: true };

                default:
                    throw new Error('未知的操作类型：' + message.action);
            }
        } catch (error) {
            console.error('操作失败:', error);
            return {
                success: false,
                error: error.message || '未知错误'
            };
        }
    };

    // 处理异步操作并发送响应
    handleAsyncOperation()
        .then(response => {
            try {
                sendResponse(response);
            } catch (error) {
                console.error('发送响应失败:', error);
            }
        })
        .catch(error => {
            console.error('处理消息时发生错误:', error);
            try {
                sendResponse({
                    success: false,
                    error: '处理消息时发生错误'
                });
            } catch (sendError) {
                console.error('发送错误响应失败:', sendError);
            }
        });

    return true; // 保持消息通道开启
});

// 添加连接状态监听
chrome.runtime.onConnect.addListener((port) => {
    console.log('建立新连接:', port.name);
    port.onDisconnect.addListener(() => {
        console.log('连接断开:', port.name);
    });
});