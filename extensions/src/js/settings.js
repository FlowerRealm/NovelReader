// 消息处理封装
function sendMessageAsync(action, key, value) {
    const maxRetries = 3;
    const retryDelay = 500; // 毫秒

    return new Promise(async (resolve, reject) => {
        let attempts = 0;

        const attemptSend = async () => {
            try {
                if (!chrome.runtime) {
                    throw new Error('扩展运行时不可用');
                }

                chrome.runtime.sendMessage({ action, key, value }, response => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        throw new Error(error.message);
                    }

                    if (response && response.success) {
                        resolve(response.data);
                    } else if (response && response.error) {
                        throw new Error(response.error);
                    } else {
                        throw new Error('无效的响应');
                    }
                });
            } catch (error) {
                attempts++;
                console.warn(`消息发送失败 (${attempts}/${maxRetries}):`, error);

                if (attempts >= maxRetries) {
                    reject(new Error(`发送消息失败: ${error.message}`));
                    return;
                }

                // 延迟后重试
                await new Promise(r => setTimeout(r, retryDelay));
                attemptSend();
            }
        };

        attemptSend();
    });
}

// 文件读取封装
function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// i18n 支持类
class I18nManager {
    static async getCurrentLocale() {
        const locale = await sendMessageAsync('getCurrentLocale');
        return locale || 'en';
    }

    static async setLocale(locale) {
        try {
            const result = await sendMessageAsync('setLocale', 'preferredLocale', locale);
            if (!result) {
                throw new Error('设置语言失败');
            }

            // 更新 HTML 语言标记
            document.documentElement.lang = locale === 'zh_CN' ? 'zh' : 'en';

            // 立即更新页面文本
            await this.updatePageText();

            // 触发自定义事件通知其他组件
            window.dispatchEvent(new CustomEvent('localeChanged', {
                detail: { locale },
                bubbles: true,
                cancelable: false
            }));

            return true;
        } catch (error) {
            console.error('语言切换失败:', error);
            // 显示错误提示给用户
            if (typeof showNotification === 'function') {
                showNotification('error', `语言切换失败: ${error.message}`);
            }
            return false;
        }
    }

    static getMessage(key, substitutions = undefined) {
        const message = chrome.i18n.getMessage(key, substitutions); return message || `[i18n-key: ${key}]`;
    }

    static updatePageText() {
        // 更新页面标题
        document.title = this.getMessage('settings');

        // 更新所有带有 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.getMessage(key);
        });

        // 更新所有带有 data-i18n-placeholder 属性的输入元素
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.getMessage(key);
        });

        // 更新字体选项的显示文本
        const fontFamilySelect = document.getElementById('font-family');
        if (fontFamilySelect) {
            fontFamilySelect.querySelectorAll('option').forEach(option => {
                const key = option.getAttribute('data-i18n');
                if (key) {
                    option.textContent = this.getMessage(key);
                }
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 获取所有设置元素
    const form = {
        novelPath: document.getElementById('novel-path'),
        novelPathDisplay: document.getElementById('novel-path-display'),
        novelLine: document.getElementById('novel-line'),
        fontFamily: document.getElementById('font-family'),
        fontSize: document.getElementById('font-size'),
        lineHeight: document.getElementById('line-height'),
        textColor: document.getElementById('text-color'),
        opacity: document.getElementById('opacity'),
        opacityValue: document.getElementById('opacity-value'),
        hoverOpacity: document.getElementById('hover-opacity'),
        hoverOpacityValue: document.getElementById('hover-opacity-value'),
        textShadow: document.getElementById('text-shadow'),
        maxWidth: document.getElementById('max-width'),
        saveButton: document.getElementById('save-button'),
        previewText: document.getElementById('preview-text'),
        bgOpacity: document.getElementById('bg-opacity'),
        bgOpacityValue: document.getElementById('bg-opacity-value'),
        hoverBgOpacity: document.getElementById('hover-bg-opacity'),
        hoverBgOpacityValue: document.getElementById('hover-bg-opacity-value'),
        languageSelect: document.getElementById('language-select')
    };

    // 初始化语言选择器
    if (form.languageSelect) {
        // 添加可用的语言选项
        const languages = [
            { code: 'zh_CN', name: '简体中文' },
            { code: 'en', name: 'English' }
        ];

        // 清空现有选项
        form.languageSelect.innerHTML = '';

        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            form.languageSelect.appendChild(option);
        });

        // 设置当前语言
        const currentLocale = await I18nManager.getCurrentLocale();
        form.languageSelect.value = currentLocale;

        // 监听语言切换
        form.languageSelect.addEventListener('change', async () => {
            const newLocale = form.languageSelect.value;
            // I18nManager.setLocale handles:
            // 1. Sending 'setLocale' action to background (which saves to storage).
            // 2. Updating the current settings page's text via its own call to updatePageText().
            // 3. Dispatching a 'localeChanged' custom event (for other components on the same page).
            const success = await I18nManager.setLocale(newLocale);

            if (success) {
                // Alert using the potentially newly updated language from I18nManager.setLocale's updatePageText call
                alert(I18nManager.getMessage('settingsSaved'));
            } else {
                alert(I18nManager.getMessage('settingsSaveError'));
                // Optional: consider reverting form.languageSelect.value if I18nManager.getCurrentLocale()
                // could confirm the old value, but this adds complexity. Current behavior is acceptable.
            }
        });

        // 监听全局语言变更事件
        window.addEventListener('localeChanged', async (event) => {
            const { locale } = event.detail;
            if (locale !== form.languageSelect.value) {
                form.languageSelect.value = locale;
                await loadSettings();
            }
        });
    }

    // 更新预览
    function updatePreview() {
        const opacity = form.opacity.value / 100;
        const bgOpacity = form.bgOpacity.value / 100;
        const textShadow = form.textShadow.checked ? '0 0 3px white' : 'none';
        const backgroundColor = `rgba(255, 255, 255, ${bgOpacity})`;

        Object.assign(form.previewText.style, {
            fontFamily: form.fontFamily.value,
            fontSize: `${form.fontSize.value}px`,
            lineHeight: form.lineHeight.value,
            color: form.textColor.value,
            opacity: opacity,
            textShadow: textShadow,
            backgroundColor: backgroundColor,
            padding: '10px',
            borderRadius: '5px',
            display: 'inline-block',
            maxWidth: `${form.maxWidth.value}%`
        });

        form.previewText.textContent = I18nManager.getMessage('previewText');
    }

    // 更新保存按钮状态
    function updateButtonState() {
        const hasChanges = true; // 简化逻辑，允许随时保存
        form.saveButton.disabled = !hasChanges;
    }

    // 加载设置
    async function loadSettings() {
        try {
            const [settings, novelLine, preferredLocale] = await Promise.all([
                sendMessageAsync('getStorage', 'readerSettings'),
                sendMessageAsync('getStorage', 'novelLine'),
                I18nManager.getCurrentLocale()
            ]);

            // 首先更新语言设置和页面文本
            if (preferredLocale && form.languageSelect) {
                form.languageSelect.value = preferredLocale;
                // 立即更新页面所有文本
                await I18nManager.updatePageText();
            }

            if (settings) {
                // 安全地设置每个值，避免类型错误
                if (typeof settings.fontFamily === 'string') {
                    form.fontFamily.value = settings.fontFamily;
                }
                if (typeof settings.fontSize === 'number') {
                    form.fontSize.value = settings.fontSize;
                }
                if (typeof settings.lineHeight === 'number') {
                    form.lineHeight.value = settings.lineHeight;
                }
                if (typeof settings.textColor === 'string') {
                    form.textColor.value = settings.textColor;
                }
                if (typeof settings.opacity === 'number') {
                    form.opacity.value = Math.round(settings.opacity * 100);
                    form.opacityValue.textContent = `${form.opacity.value}%`;
                }
                if (typeof settings.hoverOpacity === 'number') {
                    form.hoverOpacity.value = Math.round(settings.hoverOpacity * 100);
                    form.hoverOpacityValue.textContent = `${form.hoverOpacity.value}%`;
                }
                if (typeof settings.textShadow === 'boolean') {
                    form.textShadow.checked = settings.textShadow;
                }
                if (typeof settings.maxWidth === 'number') {
                    form.maxWidth.value = settings.maxWidth;
                }
                if (typeof settings.backgroundColor === 'string') {
                    const match = settings.backgroundColor.match(/rgba\(.*,\s*([\d.]+)\)/);
                    if (match) {
                        form.bgOpacity.value = Math.round(parseFloat(match[1]) * 100);
                        form.bgOpacityValue.textContent = `${form.bgOpacity.value}%`;
                    }
                }

                const hoverMatch = settings.hoverBackgroundColor?.match(/rgba\(.*,\s*([\d.]+)\)/);
                if (hoverMatch) {
                    form.hoverBgOpacity.value = Math.round(parseFloat(hoverMatch[1]) * 100);
                    form.hoverBgOpacityValue.textContent = `${form.hoverBgOpacity.value}%`;
                }
            }

            // 设置行号
            if (typeof novelLine === 'number') {
                form.novelLine.value = novelLine;
            }

            // 在所有设置加载完成后更新预览
            updatePreview();
        } catch (error) {
            console.error('加载设置失败:', error);
            alert(I18nManager.getMessage('settingsSaveError'));
        }
    }

    // 保存设置
    async function saveSettings() {
        try {
            const settings = {
                fontFamily: form.fontFamily.value,
                fontSize: parseInt(form.fontSize.value) || 14,
                lineHeight: parseFloat(form.lineHeight.value) || 1.5,
                textColor: form.textColor.value,
                opacity: parseFloat(form.opacity.value) / 100,
                hoverOpacity: parseFloat(form.hoverOpacity.value) / 100,
                textShadow: form.textShadow.checked,
                maxWidth: parseInt(form.maxWidth.value) || 50,
                backgroundColor: `rgba(255, 255, 255, ${form.bgOpacity.value / 100})`,
                hoverBackgroundColor: `rgba(255, 255, 255, ${form.hoverBgOpacity.value / 100})`
            };

            // 如果有文件，保存文件内容
            if (form.novelPath.files.length > 0) {
                const file = form.novelPath.files[0];
                const fileContent = await readFileAsync(file);
                await sendMessageAsync('setStorage', 'novelContent', fileContent);
                form.novelPathDisplay.textContent = file.name;
            }

            // 保存行号
            if (form.novelLine.value) {
                const lineNumber = parseInt(form.novelLine.value) || 1;
                await sendMessageAsync('setStorage', 'novelLine', lineNumber);
            }

            // 保存所有设置
            await sendMessageAsync('setStorage', 'readerSettings', settings);

            // 使用 i18n 消息提示保存成功
            alert(I18nManager.getMessage('settingsSaved'));
        } catch (error) {
            console.error('Failed to save settings:', error);
            // 使用 i18n 消息提示保存失败
            alert(I18nManager.getMessage('settingsSaveError'));
        }
    }

    // 绑定事件监听器
    form.novelPath.addEventListener('change', () => {
        if (form.novelPath.files.length > 0) {
            form.novelPathDisplay.textContent = form.novelPath.files[0].name;
        }
        updateButtonState();
    });

    // 实时更新透明度显示
    form.opacity.addEventListener('input', () => {
        form.opacityValue.textContent = `${form.opacity.value}%`;
        updatePreview();
    });

    form.hoverOpacity.addEventListener('input', () => {
        form.hoverOpacityValue.textContent = `${form.hoverOpacity.value}%`;
    });

    // 实时更新背景透明度显示
    form.bgOpacity.addEventListener('input', () => {
        form.bgOpacityValue.textContent = `${form.bgOpacity.value}%`;
        updatePreview();
    });

    form.hoverBgOpacity.addEventListener('input', () => {
        form.hoverBgOpacityValue.textContent = `${form.hoverBgOpacity.value}%`;
    });

    // 为所有可能影响预览的输入添加事件监听
    ['fontFamily', 'fontSize', 'lineHeight', 'textColor', 'opacity', 'bgOpacity', 'textShadow', 'maxWidth'].forEach(id => {
        form[id].addEventListener('input', updatePreview);
        form[id].addEventListener('change', updatePreview);
    });

    // 其他输入事件
    form.novelLine.addEventListener('input', updateButtonState);
    form.saveButton.addEventListener('click', saveSettings);

    // 初始化
    loadSettings();
    updateButtonState();
});