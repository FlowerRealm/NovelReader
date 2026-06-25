#ifndef PLATFORM_UTILS_H
#define PLATFORM_UTILS_H

#include <string>

namespace PlatformUtils {

    void platform_sleep(int milliseconds);
    void clear_screen();
    char get_path_separator();
    std::string get_os_name();

}

#endif // PLATFORM_UTILS_H
