# NovelReader

NovelReader 是一个跨平台的小说阅读工具，支持 Windows 应用程序和 Chrome 扩展。它的设计特点是隐蔽性，适合在各种场景下低调地阅读小说。

## 功能特点

### Chrome 扩展
- **隐蔽阅读**：通过快捷键快速隐藏或显示阅读内容。
- **字体与样式自定义**：支持自定义字体、字号和样式，提供舒适的阅读体验。
- **进度保存**：自动保存阅读进度，切换页面后可继续阅读。
- **文件导入**：支持从本地导入小说文件。

### Windows 应用程序
- **轻量级**：占用资源少，运行快速。
- **隐蔽性**：窗口小巧，支持快捷键操作，适合在工作环境中使用。
- **进度管理**：自动保存阅读进度，支持从上次中断处继续。

## 安装与使用

### Chrome 扩展
1. 打开 Chrome 浏览器，进入扩展程序管理页面（`chrome://extensions/`）。
2. 点击“加载已解压的扩展程序”，选择 `extensions` 文件夹。
3. 安装完成后，点击浏览器右上角的扩展图标即可使用。

#### 快捷键
- `Shift + H`：隐藏/显示阅读内容。
- `Shift + N`：跳转到下一行。
- `Shift + P`：回到上一行。

### Windows 应用程序
1. 进入 `windows/bin` 目录，运行 `main.exe`。
2. 按照提示设置小说路径和起始行号。
3. 使用快捷键操作：
   - `Q`：退出程序。
   - 其他快捷键请参考程序内提示。

## 开发

### 文件结构
```
README.md
extensions/
	manifest.json
	src/
		html/
			settings.html
		js/
			background.js
			reader.js
			settings.js
windows/
	CMakeLists.txt
	bin/
	src/
		main.cpp
```

### 构建 Windows 应用程序
1. 安装 CMake 和编译器（如 Visual Studio）。
2. 在 `windows` 目录下运行以下命令：
   ```
   mkdir build
   cd build
   cmake ..
   cmake --build .
   ```
3. 构建完成后，`main.exe` 将生成在 `windows/bin` 目录下。

## 注意事项
- 请确保导入的小说文件为纯文本格式（`.txt`）。
- 使用过程中请遵守相关法律法规，勿用于非法用途。

## 许可证
本项目采用 MIT 许可证，详情请参阅 LICENSE 文件。