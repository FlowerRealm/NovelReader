// 消息处理封装
function sendMessageAsync(action, key, value) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action, key, value }, response => {
            if (response && response.success) {
                resolve(response.data);
            } else {
                resolve(null);
            }
        });
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
        return await sendMessageAsync('getCurrentLocale');
    }

    static async setLocale(locale) {
        await sendMessageAsync('setLocale', 'preferredLocale', locale);
        // 更新 HTML 语言标记
        document.documentElement.lang = locale === 'zh_CN' ? 'zh' : 'en';
        // 立即更新页面文本
        this.updatePageText();
        return true;
    }

    static getMessage(key, substitutions = undefined) {
        return chrome.i18n.getMessage(key, substitutions) || key;
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
        form.languageSelect.value = currentLocale || (navigator.language.startsWith('zh') ? 'zh_CN' : 'en');

        // 监听语言切换
        form.languageSelect.addEventListener('change', async () => {
            const newLocale = form.languageSelect.value;
            await I18nManager.setLocale(newLocale);
            // 使用 i18n 消息提示语言已更改
            alert(I18nManager.getMessage('settingsSaved'));
            // 重新加载扩展
            chrome.runtime.reload();
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

            if (preferredLocale && form.languageSelect) {
                form.languageSelect.value = preferredLocale;
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
                    // 从 rgba 字符串中提取透明度值
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

            // 更新页面文本
            I18nManager.updatePageText();
            updatePreview();
        } catch (error) {
            console.error('Failed to load settings:', error);
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