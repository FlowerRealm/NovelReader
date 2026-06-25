# Repository Guidelines

## Project Structure & Module Organization

- Public headers live in `include/`; implementation sources in `src/` (`main.cpp`, `file_system_utils.cpp`, `platform_utils.cpp`, `terminal_input.cpp`).
- Build config in `CMakeLists.txt`.
- Build artifacts: `build/`, `build-*`, and CMake outputs are generated. Avoid committing them.

## Build, Test, and Development Commands

**Native client (recommended out-of-source build)**

- Configure: `cmake -S . -B build`
- Build: `cmake --build build -j`
- Run (Linux/macOS): `./build/bin/NovelReaderCLI`

## Coding Style & Naming Conventions

- C++: format with `clang-format` using the repo's `.clang-format` (LLVM-based, 4-space indent).
- Naming: follow existing patterns (`PlatformUtils::*` utilities in C++).

## Testing Guidelines

- No automated test suite is wired up yet.
- Smoke test checklist:
  - Run the binary and set `test.txt` as the novel path; verify next/previous line navigation and config persistence.

## Commit & Pull Request Guidelines

- Commit messages follow a lightweight convention: `Fix: ...`, `Refactor: ...`, `Chore: ...`.
- PRs should include: summary (what/why), steps to test. Note which OS(es) you tested (Windows/Linux/macOS).

## Security & Configuration Tips

- Settings are stored in the user config directory (e.g., `%LOCALAPPDATA%\NovelReader\config` on Windows, `$XDG_CONFIG_HOME/NovelReader/config` on Linux).
- Do not commit personal novels, logs, or generated binaries unless explicitly intended for release artifacts.
