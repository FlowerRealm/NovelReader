#ifndef TERMINAL_INPUT_H
#define TERMINAL_INPUT_H

#include <string>

#ifndef _WIN32
#include <termios.h>
#endif

namespace TerminalInput {

enum class KeyType {
    Unknown,
    Character,
    Enter,
    Space,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Escape,
    CtrlC,
    CtrlD,
};

struct KeyEvent {
    KeyType type = KeyType::Unknown;
    char ch = '\0';
};

class ScopedRawMode {
public:
    ScopedRawMode();
    ~ScopedRawMode();

    ScopedRawMode(const ScopedRawMode &) = delete;
    ScopedRawMode &operator=(const ScopedRawMode &) = delete;

    bool is_enabled() const { return enabled_; }

private:
    bool enabled_ = false;
#ifndef _WIN32
    termios original_{};
#endif
};

bool read_key_blocking(KeyEvent &out, std::string *error_message);

} // namespace TerminalInput

#endif // TERMINAL_INPUT_H
