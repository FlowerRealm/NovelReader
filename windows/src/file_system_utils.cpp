#include "file_system_utils.h"
#include "platform_utils.h"
#include <fstream>
#include <iostream>  // Keep for potential future std::cerr uncommenting
#include <cstdlib>   // For getenv, free (used with _dupenv_s)

#ifdef _WIN32
#include <windows.h>
#else // Linux/POSIX
#include <sys/stat.h>
#include <sys/types.h>
#include <cerrno>      // For errno
#include <cstring>     // For strerror (for errno messages)
#endif

namespace FileSystemUtils {

std::string get_config_directory_path() {
#ifdef _WIN32
    char* localAppDataPath_cstr = nullptr;
    size_t len;
    errno_t err = _dupenv_s(&localAppDataPath_cstr, &len, "LOCALAPPDATA");

    if (err != 0 || localAppDataPath_cstr == nullptr) {
        // std::cerr << "Error: LOCALAPPDATA environment variable not found (Windows)." << std::endl;
        if (localAppDataPath_cstr) free(localAppDataPath_cstr);
        return "";
    }
    std::string app_data_path(localAppDataPath_cstr);
    free(localAppDataPath_cstr);
    return app_data_path + PlatformUtils::get_path_separator() + "NovelReader";
#else // Linux/POSIX
    const char* xdg_config_home_cstr = getenv("XDG_CONFIG_HOME");
    std::string config_home_path;
    if (xdg_config_home_cstr != nullptr && xdg_config_home_cstr[0] != '\0') {
        config_home_path = xdg_config_home_cstr;
    } else {
        const char* home_dir_cstr = getenv("HOME");
        if (home_dir_cstr == nullptr || home_dir_cstr[0] == '\0') {
            // std::cerr << "Error: HOME environment variable not found (Linux)." << std::endl;
            return "";
        }
        config_home_path = std::string(home_dir_cstr) + PlatformUtils::get_path_separator() + ".config";
    }
    return config_home_path + PlatformUtils::get_path_separator() + "NovelReader";
#endif
}

bool create_directory_if_not_exists(const std::string& path) {
#ifdef _WIN32
    if (CreateDirectory(path.c_str(), NULL) || GetLastError() == ERROR_ALREADY_EXISTS) {
        return true;
    }
    // std::cerr << "Failed to create directory (Windows): " << path << ". Error: " << GetLastError() << std::endl;
    return false;
#else // Linux/POSIX
    struct stat st;
    if (stat(path.c_str(), &st) == 0) {
        return S_ISDIR(st.st_mode);
    }
    // The problematic line:
    if (mkdir(path.c_str(), 0755) == 0) { // 0755 is octal for rwxr-xr-x
        return true;
    }
    // std::cerr << "Failed to create directory (Linux): " << path << ". Error: " << strerror(errno) << std::endl;
    return false;
#endif
}

bool read_config(const std::string& config_file_path, std::string& novel_path, int& line_number_from_config) {
    std::fstream config_stream;
    config_stream.open(config_file_path, std::ios::in);

    if (!config_stream.is_open()) {
        config_stream.clear();
        config_stream.open(config_file_path, std::ios::out);
        if (config_stream.is_open()) {
            novel_path = "";
            line_number_from_config = 0;
            config_stream << novel_path << std::endl;
            config_stream << line_number_from_config << std::endl;
            config_stream.close();
        } else {
            // std::cerr << "Could not create config file: " << config_file_path << std::endl;
            novel_path = "";
            line_number_from_config = 0;
            return false;
        }
    } else {
        std::getline(config_stream, novel_path);
        if (!(config_stream >> line_number_from_config)) {
            // std::cerr << "Warning: Could not read line number from config or config is incomplete. Resetting to defaults." << std::endl;
            novel_path = "";
            line_number_from_config = 0;

            config_stream.close();
            config_stream.open(config_file_path, std::ios::out | std::ios::trunc);
            if (config_stream.is_open()) {
                config_stream << novel_path << std::endl;
                config_stream << line_number_from_config << std::endl;
                config_stream.close();
            } else {
                //  std::cerr << "Could not repair config file: " << config_file_path << std::endl;
                 return false;
            }
        } else {
            if (config_stream.is_open()) {
                config_stream.close();
            }
        }
    }
    return true;
}

bool write_config(const std::string& config_file_path, const std::string& novel_path, int line_number_to_config) {
    std::fstream config_stream;
    config_stream.open(config_file_path, std::ios::out | std::ios::trunc);
    if (!config_stream.is_open()) {
        // std::cerr << "Critical Error: Failed to open config file for writing: " << config_file_path << ". Settings not saved." << std::endl;
        return false;
    }
    config_stream << novel_path << std::endl;
    config_stream << line_number_to_config << std::endl;
    config_stream.flush();
    bool success = config_stream.good();
    config_stream.close();
    return success;
}

} // namespace FileSystemUtils
