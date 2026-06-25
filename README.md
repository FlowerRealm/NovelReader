# NovelReader

NovelReader 是一个跨平台的本地小说阅读工具，支持 Windows/Linux/macOS 三端。它的设计特点是隐蔽性，适合在各种场景下低调地阅读小说。

## 功能特点

- **轻量级**：占用资源少，运行快速。
- **隐蔽性**：窗口小巧，支持快捷键操作，适合在工作环境中使用。
- **进度管理**：自动保存阅读进度，支持从上次中断处继续。

## 安装与使用

1. 构建项目后，运行可执行文件：
   - Windows：`main.exe`
   - Linux/macOS：`NovelReaderCLI`
2. 按照提示设置小说路径和起始行号。
3. 使用快捷键操作：
   - `Q`：退出程序。
   - 其他快捷键请参考程序内提示。

## 开发

### 文件结构

```
README.md
CMakeLists.txt
include/
  file_system_utils.h
  platform_utils.h
  terminal_input.h
src/
  main.cpp
  file_system_utils.cpp
  platform_utils.cpp
  terminal_input.cpp
```

### 构建（Windows/Linux/macOS）

1. 安装 CMake 和编译器。
2. 运行以下命令：
   ```
   cmake -S . -B build
   cmake --build build -j
   ```
3. 构建完成后，可执行文件生成在 `build/bin` 目录下。

## 注意事项

- 请确保导入的小说文件为纯文本格式（`.txt`）。
- 使用过程中请遵守相关法律法规，勿用于非法用途。

## 许可证

本项目采用 MIT 许可证，详情请参阅 LICENSE 文件。
