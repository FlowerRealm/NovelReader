#ifndef FILE_SYSTEM_UTILS_H
#define FILE_SYSTEM_UTILS_H

#include <string>
#include <vector>

namespace FileSystemUtils {

    std::string get_config_directory_path();
    bool create_directory_if_not_exists(const std::string& path);
    bool read_config(const std::string& config_file_path, std::string& novel_path, int& line_number_from_config);
    bool write_config(const std::string& config_file_path, const std::string& novel_path, int line_number_to_config);

}

#endif // FILE_SYSTEM_UTILS_H
