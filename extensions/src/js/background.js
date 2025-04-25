// 确保在扩展启动时初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('扩展已安装/更新');
});

// 在扩展启动时主动建立连接
chrome.runtime.onStartup.addListener(() => {
    console.log('扩展已启动');
});

// 存储管理类
class StorageManager {
    static async get(key) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Storage get error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result[key] ?? null);
                    }
                });
            } catch (error) {
                console.error('Storage get error:', error);
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
                        console.error('Storage set error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(true);
                    }
                });
            } catch (error) {
                console.error('Storage set error:', error);
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
            return locale || 'en';
        } catch (error) {
            console.error('获取语言设置失败:', error);
            return 'en';
        }
    }

    static async setLocale(locale) {
        try {
            console.log('正在设置语言:', locale);
            if (!['zh_CN', 'en'].includes(locale)) {
                throw new Error(`不支持的语言: ${locale}`);
            }

            // 先保存语言设置
            await StorageManager.set('preferredLocale', locale);

            // 广播语言变更消息到所有标签页
            const tabs = await chrome.tabs.query({});
            const notificationPromises = tabs.map(async tab => {
                if (!tab.url || !tab.id) {
                    return; // 跳过无效的标签页
                }

                // 检查标签页是否可访问
                if (tab.url.startsWith('http') ||
                    tab.url.startsWith('https') ||
                    tab.url.startsWith(chrome.runtime.getURL(''))) {
                    try {
                        // 使用 sendMessage 的 Promise 版本
                        await new Promise((resolve, reject) => {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'localeChanged',
                                locale: locale
                            }, (response) => {
                                const err = chrome.runtime.lastError;
                                if (err) {
                                    // 如果是连接错误，我们认为这是正常的，不需要记录错误
                                    if (err.message.includes('Could not establish connection')) {
                                        resolve();
                                    } else {
                                        reject(err);
                                    }
                                } else {
                                    resolve(response);
                                }
                            });
                        });
                    } catch (err) {
                        // 只有在不是连接错误的情况下才记录
                        if (!err.message.includes('Could not establish connection')) {
                            console.warn(`向标签页 ${tab.id} 发送消息时出现预期之外的错误:`, err);
                        }
                    }
                }
            });

            // 等待所有通知完成，但忽略个别失败
            await Promise.allSettled(notificationPromises);

            return true;
        } catch (error) {
            console.error('设置语言失败:', error);
            throw error;
        }
    }
}

// 建立长连接处理
chrome.runtime.onConnect.addListener((port) => {
    console.log('新连接已建立:', port.name);

    port.onDisconnect.addListener(() => {
        console.log('连接已断开:', port.name);
        if (chrome.runtime.lastError) {
            console.error('连接断开错误:', chrome.runtime.lastError);
        }
    });

    port.onMessage.addListener((msg) => {
        console.log('收到长连接消息:', msg);
    });
});

// 打开设置页面
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("src/html/settings.html")
    });
});

// 全局消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message, '来自:', sender);

    // 立即返回true以保持消息通道开启
    const keepChannelOpen = true;

    // 检查扩展状态
    if (!chrome.runtime.id) {
        console.error('扩展连接已断开');
        sendResponse({ success: false, error: '扩展连接已断开' });
        return keepChannelOpen;
    }

    // 异步消息处理
    (async () => {
        try {
            if (!message || !message.action) {
                throw new Error('无效的消息格式');
            }

            let response;
            switch (message.action) {
                case 'getCurrentLocale':
                    const locale = await LanguageManager.getCurrentLocale();
                    response = { success: true, data: locale };
                    break;

                case 'setLocale':
                    if (!message.value) {
                        throw new Error('缺少语言设置参数');
                    }
                    await LanguageManager.setLocale(message.value);
                    response = { success: true, data: true };
                    break;

                case 'getStorage':
                    if (!message.key) {
                        throw new Error('缺少存储键名');
                    }
                    const data = await StorageManager.get(message.key);
                    response = { success: true, data };
                    break;

                case 'setStorage':
                    if (!message.key || message.value === undefined) {
                        throw new Error('缺少必要的存储参数');
                    }
                    await StorageManager.set(message.key, message.value);
                    response = { success: true };
                    break;

                default:
                    throw new Error('未知的操作类型：' + message.action);
            }

            if (!sender.tab || chrome.runtime.lastError) {
                console.warn('发送响应时发生错误:', chrome.runtime.lastError);
            }
            sendResponse(response);
        } catch (error) {
            console.error('消息处理失败:', error);
            sendResponse({
                success: false,
                error: error.message || '未知错误'
            });
        }
    })();

    return keepChannelOpen;
});