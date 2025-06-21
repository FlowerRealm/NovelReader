#include "platform_utils.h"

#ifdef _WIN32
#include <windows.h>
#else // Assuming Linux/POSIX
#include <unistd.h>
#include <cstdlib>
#endif

namespace PlatformUtils {

void platform_sleep(int milliseconds) {
#ifdef _WIN32
    Sleep(milliseconds);
#else
    usleep(milliseconds * 1000);
#endif
}

void clear_screen() {
#ifdef _WIN32
    system("cls");
#else
    system("clear");
#endif
}

char get_path_separator() {
#ifdef _WIN32
    return '\\';
#else
    return '/';
#endif
}

std::string get_os_name() {
#ifdef _WIN32
    return "Windows";
#elif __linux__
    return "Linux";
#elif __APPLE__
    return "macOS";
#elif __unix__
    return "Unix-like";
#else
    return "Unknown OS";
#endif
}

} // namespace PlatformUtils
