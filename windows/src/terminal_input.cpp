#include "terminal_input.h"

#include <cerrno>
#include <cstring>

#ifdef _WIN32
#include <conio.h>
#else
#include <sys/select.h>
#include <unistd.h>
#endif

namespace TerminalInput {

ScopedRawMode::ScopedRawMode()
{
#ifdef _WIN32
    enabled_ = true;
#else
    if (tcgetattr(STDIN_FILENO, &original_) != 0)
    {
        enabled_ = false;
        return;
    }

    termios raw = original_;
    raw.c_lflag &= static_cast<tcflag_t>(~(ICANON | ECHO | ISIG));
    raw.c_iflag &= static_cast<tcflag_t>(~(IXON));
    raw.c_cc[VMIN] = 1;
    raw.c_cc[VTIME] = 0;

    if (tcsetattr(STDIN_FILENO, TCSANOW, &raw) != 0)
    {
        enabled_ = false;
        return;
    }

    enabled_ = true;
#endif
}

ScopedRawMode::~ScopedRawMode()
{
#ifndef _WIN32
    if (!enabled_) return;
    int rc = tcsetattr(STDIN_FILENO, TCSANOW, &original_);
    (void)rc;
#endif
}

#ifndef _WIN32
static bool read_byte_blocking(unsigned char &out, std::string *error_message)
{
    while (true)
    {
        const ssize_t n = read(STDIN_FILENO, &out, 1);
        if (n == 1) return true;
        if (n == 0)
        {
            if (error_message) *error_message = "stdin EOF";
            return false;
        }
        if (errno == EINTR) continue;
        if (error_message) *error_message = std::strerror(errno);
        return false;
    }
}

static bool read_byte_timeout(unsigned char &out, int timeout_ms)
{
    fd_set read_fds;
    FD_ZERO(&read_fds);
    FD_SET(STDIN_FILENO, &read_fds);

    timeval tv;
    tv.tv_sec = timeout_ms / 1000;
    tv.tv_usec = (timeout_ms % 1000) * 1000;

    const int rc = select(STDIN_FILENO + 1, &read_fds, nullptr, nullptr, &tv);
    if (rc <= 0) return false;
    const ssize_t n = read(STDIN_FILENO, &out, 1);
    return n == 1;
}
#endif

bool read_key_blocking(KeyEvent &out, std::string *error_message)
{
    out = KeyEvent{};

#ifdef _WIN32
    const int first = _getch();

    if (first == 0 || first == 224)
    {
        const int second = _getch();
        switch (second)
        {
            case 72:
                out.type = KeyType::ArrowUp;
                return true;
            case 80:
                out.type = KeyType::ArrowDown;
                return true;
            case 75:
                out.type = KeyType::ArrowLeft;
                return true;
            case 77:
                out.type = KeyType::ArrowRight;
                return true;
            default:
                out.type = KeyType::Unknown;
                return true;
        }
    }

    const unsigned char ch = static_cast<unsigned char>(first);
    if (ch == '\r' || ch == '\n')
    {
        out.type = KeyType::Enter;
        return true;
    }
    if (ch == ' ')
    {
        out.type = KeyType::Space;
        return true;
    }
    if (ch == 0x1B)
    {
        out.type = KeyType::Escape;
        return true;
    }
    if (ch == 0x03)
    {
        out.type = KeyType::CtrlC;
        return true;
    }
    if (ch == 0x04)
    {
        out.type = KeyType::CtrlD;
        return true;
    }

    out.type = KeyType::Character;
    out.ch = static_cast<char>(ch);
    return true;
#else
    unsigned char ch = 0;
    if (!read_byte_blocking(ch, error_message)) return false;

    if (ch == '\r' || ch == '\n')
    {
        out.type = KeyType::Enter;
        return true;
    }
    if (ch == ' ')
    {
        out.type = KeyType::Space;
        return true;
    }
    if (ch == 0x03)
    {
        out.type = KeyType::CtrlC;
        return true;
    }
    if (ch == 0x04)
    {
        out.type = KeyType::CtrlD;
        return true;
    }

    if (ch == 0x1B)
    {
        // Best-effort arrow keys parsing (ESC [ A/B/C/D).
        unsigned char next = 0;
        if (!read_byte_timeout(next, 30))
        {
            out.type = KeyType::Escape;
            return true;
        }

        if (next != '[')
        {
            out.type = KeyType::Escape;
            return true;
        }

        unsigned char code = 0;
        if (!read_byte_timeout(code, 30))
        {
            out.type = KeyType::Escape;
            return true;
        }

        switch (code)
        {
            case 'A':
                out.type = KeyType::ArrowUp;
                return true;
            case 'B':
                out.type = KeyType::ArrowDown;
                return true;
            case 'C':
                out.type = KeyType::ArrowRight;
                return true;
            case 'D':
                out.type = KeyType::ArrowLeft;
                return true;
            default:
                out.type = KeyType::Escape;
                return true;
        }
    }

    out.type = KeyType::Character;
    out.ch = static_cast<char>(ch);
    return true;
#endif
}

} // namespace TerminalInput
