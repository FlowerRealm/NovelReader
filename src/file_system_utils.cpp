#include "file_system_utils.h"
#include "platform_utils.h"
#include <fstream>
#include <iostream>  // Keep for potential future std::cerr uncommenting
#include <cstdlib>   // For getenv, free (used with _dupenv_s)
#include <cstdio>    // For std::rename
#include <cctype>    // For std::isalpha

#ifdef _WIN32
#include <windows.h>
#else // Linux/POSIX
#include <sys/stat.h>
#include <sys/types.h>
#include <cerrno>      // For errno
#include <cstring>     // For strerror (for errno messages)
#endif

namespace FileSystemUtils {

namespace {

void strip_trailing_carriage_return(std::string& s) {
    if (!s.empty() && s.back() == '\r') {
        s.pop_back();
    }
}

void strip_utf8_bom_prefix(std::string& s) {
    if (s.size() >= 3 && static_cast<unsigned char>(s[0]) == 0xEF &&
        static_cast<unsigned char>(s[1]) == 0xBB &&
        static_cast<unsigned char>(s[2]) == 0xBF) {
        s.erase(0, 3);
    }
}

bool file_exists_and_is_directory(const std::string& path) {
#ifdef _WIN32
    DWORD attrs = GetFileAttributesA(path.c_str());
    if (attrs == INVALID_FILE_ATTRIBUTES) {
        return false;
    }
    return (attrs & FILE_ATTRIBUTE_DIRECTORY) != 0;
#else
    struct stat st;
    if (stat(path.c_str(), &st) != 0) {
        return false;
    }
    return S_ISDIR(st.st_mode);
#endif
}

bool create_directories_recursive(const std::string& path) {
    if (path.empty()) {
        return false;
    }

    if (file_exists_and_is_directory(path)) {
        return true;
    }

#ifdef _WIN32
    std::string normalized = path;
    for (char& c : normalized) {
        if (c == '/') {
            c = '\\';
        }
    }

    std::string current;
    size_t i = 0;

    if (normalized.size() >= 2 && std::isalpha(static_cast<unsigned char>(normalized[0])) &&
        normalized[1] == ':') {
        current = normalized.substr(0, 2);
        i = 2;
        if (i < normalized.size() && normalized[i] == '\\') {
            current.push_back('\\');
            i++;
        }
    } else if (normalized.size() >= 2 && normalized[0] == '\\' && normalized[1] == '\\') {
        // UNC path: \\server\share\...
        current = "\\\\";
        i = 2;
    }

    while (i < normalized.size()) {
        while (i < normalized.size() && normalized[i] == '\\') {
            i++;
        }
        if (i >= normalized.size()) {
            break;
        }

        size_t next_sep = normalized.find('\\', i);
        std::string segment =
            (next_sep == std::string::npos) ? normalized.substr(i) : normalized.substr(i, next_sep - i);
        i = (next_sep == std::string::npos) ? normalized.size() : next_sep;

        if (!current.empty() && current.back() != '\\') {
            current.push_back('\\');
        }
        current += segment;

        if (file_exists_and_is_directory(current)) {
            continue;
        }

        if (!CreateDirectoryA(current.c_str(), NULL)) {
            DWORD err = GetLastError();
            if (err == ERROR_ALREADY_EXISTS) {
                if (!file_exists_and_is_directory(current)) {
                    return false;
                }
                continue;
            }
            return false;
        }
    }

    return file_exists_and_is_directory(path);
#else
    std::string current;
    size_t i = 0;
    if (!path.empty() && path[0] == '/') {
        current = "/";
        i = 1;
    }

    while (i < path.size()) {
        while (i < path.size() && path[i] == '/') {
            i++;
        }
        if (i >= path.size()) {
            break;
        }

        size_t next_sep = path.find('/', i);
        std::string segment =
            (next_sep == std::string::npos) ? path.substr(i) : path.substr(i, next_sep - i);
        i = (next_sep == std::string::npos) ? path.size() : next_sep;

        if (!current.empty() && current.back() != '/') {
            current.push_back('/');
        }
        current += segment;

        struct stat st;
        if (stat(current.c_str(), &st) == 0) {
            if (!S_ISDIR(st.st_mode)) {
                return false;
            }
            continue;
        }

        if (mkdir(current.c_str(), 0755) != 0 && errno != EEXIST) {
            return false;
        }
    }

    return file_exists_and_is_directory(path);
#endif
}

bool write_config_atomic(const std::string& config_file_path, const std::string& novel_path,
                         int line_number_to_config) {
    const std::string tmp_path = config_file_path + ".tmp";

    std::fstream tmp_stream;
    tmp_stream.open(tmp_path, std::ios::out | std::ios::trunc);
    if (!tmp_stream.is_open()) {
        return false;
    }
    tmp_stream << novel_path << std::endl;
    tmp_stream << line_number_to_config << std::endl;
    tmp_stream.flush();
    bool ok = tmp_stream.good();
    tmp_stream.close();
    if (!ok) {
        return false;
    }

#ifdef _WIN32
    if (!MoveFileExA(tmp_path.c_str(), config_file_path.c_str(),
                     MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED)) {
        DeleteFileA(tmp_path.c_str());
        return false;
    }
    return true;
#else
    if (std::rename(tmp_path.c_str(), config_file_path.c_str()) != 0) {
        std::remove(tmp_path.c_str());
        return false;
    }
    return true;
#endif
}

} // namespace

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
    return create_directories_recursive(path);
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
        std::string line_number_str;
        std::getline(config_stream, novel_path);
        strip_trailing_carriage_return(novel_path);
        strip_utf8_bom_prefix(novel_path);

        std::getline(config_stream, line_number_str);
        strip_trailing_carriage_return(line_number_str);

        bool ok = true;
        try {
            size_t idx = 0;
            int parsed = std::stoi(line_number_str, &idx, 10);
            (void)idx;
            line_number_from_config = parsed;
        } catch (...) {
            ok = false;
        }

        if (!ok) {
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
    return write_config_atomic(config_file_path, novel_path, line_number_to_config);
}

} // namespace FileSystemUtils
