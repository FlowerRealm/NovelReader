/*
 * @Author: FlowerRealm flower_realm@outlook.com
 * @Date: 2025-4-4 11:47:51
 * @LastEditors: FlowerRealm flower_realm@outlook.com
 * @LastEditTime: 2025-4-26 17:24:58
 * @FilePath: \NovelReader\windows\src\main.cpp
 */
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include <limits>    // Required for std::numeric_limits

#ifdef _WIN32
#include <windows.h> // For SetConsoleOutputCP only on Windows
#endif

#include "file_system_utils.h"
#include "platform_utils.h"    // Include the new platform utilities

// Global variables
std::fstream novel_stream;
std::string NovelPath;
int current_line_number;
std::string ConfigFilePath;

// Function declarations
void initConfigAndNovel();
void readNovel();
void showSettings();
void writeAppSettings();

void initConfigAndNovel()
{
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
#else
    // For Linux/macOS, UTF-8 is generally assumed or set by locale.
    // Explicit setup might involve std::locale and std::ios_base::sync_with_stdio(false)
    // but for basic console output, often not needed if system locale is UTF-8.
#endif

    std::string config_dir = FileSystemUtils::get_config_directory_path();
    if (config_dir.empty()) {
        std::cerr << "Critical: Could not determine config directory. Exiting." << std::endl;
        PlatformUtils::platform_sleep(3000);
        exit(1);
    }

    if (!FileSystemUtils::create_directory_if_not_exists(config_dir)) {
        std::cerr << "Critical: Could not create config directory: " << config_dir << ". Exiting." << std::endl;
        PlatformUtils::platform_sleep(3000);
        exit(1);
    }

    ConfigFilePath = config_dir + PlatformUtils::get_path_separator() + "config";

    int line_val_from_config = 0;
    if (!FileSystemUtils::read_config(ConfigFilePath, NovelPath, line_val_from_config)) {
        std::cerr << "Warning: Configuration could not be read or initialized properly." << std::endl;
        NovelPath = "";
        line_val_from_config = 0;
    }
    ::current_line_number = line_val_from_config + 1;

    if (!NovelPath.empty()) {
        if (novel_stream.is_open()) novel_stream.close();
        novel_stream.open(NovelPath, std::ios::in);
        if (!novel_stream.is_open()) {
            std::cerr << "Error: Could not open novel file: " << NovelPath << ". Please check path in settings." << std::endl;
        }
    }
}

void readNovel()
{
    if (!novel_stream.is_open()) {
        PlatformUtils::clear_screen();
        std::cout << "Novel file is not open. Current path: "<< (NovelPath.empty() ? "Not set" : NovelPath) << std::endl;
        std::cout << "Please check the path in Settings." << std::endl;
        PlatformUtils::platform_sleep(2500);
        return;
    }
    novel_stream.clear();
    novel_stream.seekg(0);

    std::string content_buffer;

    for (int i = 1; i < ::current_line_number; i++) {
        if (!std::getline(novel_stream, content_buffer)) {
            PlatformUtils::clear_screen();
            std::cerr << "Novel does not have line " << ::current_line_number << " (EOF reached while skipping)." << std::endl;
            std::cout << "You might want to reset the line number in Settings or check the novel file." << std::endl;
            ::current_line_number = i;
            PlatformUtils::platform_sleep(3000);
            return;
        }
    }

    int line_being_displayed = ::current_line_number;

    while (true) {
        PlatformUtils::clear_screen();
        if (!std::getline(novel_stream, content_buffer)) {
            std::cout << "End of novel." << std::endl;
            ::current_line_number = line_being_displayed;
            PlatformUtils::platform_sleep(1500);
            break;
        }
        std::cout << "Line " << line_being_displayed << ":\n";
        std::cout << content_buffer << std::endl;

        std::cout << "\n--- (Enter: next, Q: quit to menu) ---";
        char ch = getchar();
        if (ch == 'q' || ch == 'Q') {
            ::current_line_number = line_being_displayed + 1;
            break;
        }
        line_being_displayed++;
    }
    writeAppSettings();
    PlatformUtils::clear_screen();
}

void showSettings()
{
    PlatformUtils::clear_screen();
    std::string inputNovelPath;
    std::string inputLineStr;

    std::cout << "--- Settings ---" << std::endl;
    std::cout << "Current Novel Path: " << (NovelPath.empty() ? "Not set" : NovelPath) << std::endl;
    std::cout << "Enter new novel path (or press Enter to keep current): ";

    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::getline(std::cin, inputNovelPath);

    if (!inputNovelPath.empty())
    {
        std::fstream test_novel(inputNovelPath, std::ios::in);
        if (!test_novel.good())
        {
            std::cerr << "\nError: The new path is not correct or file cannot be opened." << std::endl;
            std::cout << "Novel path not changed." << std::endl;
            PlatformUtils::platform_sleep(2000);
        } else {
            test_novel.close();
            if (novel_stream.is_open()) novel_stream.close();
            NovelPath = inputNovelPath;
            novel_stream.open(NovelPath, std::ios::in);
            if(!novel_stream.is_open()){
                std::cerr << "\nError: Could not open new novel file: " << NovelPath << std::endl;
                NovelPath = "";
            } else {
                std::cout << "\nNovel path updated. Reading will start from the beginning of the new novel." << std::endl;
            }
            ::current_line_number = 1;
            PlatformUtils::platform_sleep(1500);
        }
    }

    std::cout << "\nNext line to read will be: " << ::current_line_number << std::endl;
    std::cout << "Enter new starting line number (e.g., 1) (or press Enter to keep current): ";
    std::getline(std::cin, inputLineStr);
    if (!inputLineStr.empty())
    {
        try {
            int input_l = std::stoi(inputLineStr);
            if (input_l >= 1) {
                ::current_line_number = input_l;
                std::cout << "\nStarting line number updated to: " << ::current_line_number << std::endl;
            } else {
                std::cout << "\nInvalid line number. Must be 1 or greater. Line number not changed." << std::endl;
            }
        } catch (const std::invalid_argument& ia) {
            std::cerr << "\nInvalid input for line number (not a number). Line number not changed." << std::endl;
        } catch (const std::out_of_range& oor) {
            std::cerr << "\nInput for line number is out of range. Line number not changed." << std::endl;
        }
        PlatformUtils::platform_sleep(1500);
    }

    writeAppSettings();
    PlatformUtils::clear_screen();
    std::cout << "Settings saved." << std::endl;
    PlatformUtils::platform_sleep(1500);
}

void writeAppSettings()
{
    if (ConfigFilePath.empty()) {
         std::cerr << "Critical Error: Config file path not set. Cannot save settings." << std::endl;
         PlatformUtils::platform_sleep(2000);
         return;
    }
    if (!FileSystemUtils::write_config(ConfigFilePath, NovelPath, ::current_line_number - 1)) {
        std::cerr << "Warning: Failed to write settings to config file." << std::endl;
        PlatformUtils::platform_sleep(2000);
    }
}

int main()
{
    initConfigAndNovel();
    while (true)
    {
        PlatformUtils::clear_screen();
        std::cout << "--- NovelReader Menu (" << PlatformUtils::get_os_name() << ") ---" << std::endl; // Added OS name
        std::cout << "--------------------------" << std::endl;
        std::cout << "Novel: " << (NovelPath.empty() ? "Not Set" : NovelPath) << std::endl;
        std::cout << "Next line to read: " << ::current_line_number << std::endl;
        std::cout << "--------------------------" << std::endl;
        std::cout << "1. Start/Continue Read Novel" << std::endl;
        std::cout << "2. Settings" << std::endl;
        std::cout << "3. Exit" << std::endl;
        std::cout << "Please select an option (1-3): ";

        int choice;
        std::cin >> choice;

        if(std::cin.fail()){
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            PlatformUtils::clear_screen();
            std::cout << "Invalid input. Please enter a number (1-3)." << std::endl;
            PlatformUtils::platform_sleep(1500);
            continue;
        }

        switch (choice)
        {
            case 1:
                if (NovelPath.empty() || !novel_stream.is_open()) {
                    PlatformUtils::clear_screen();
                    std::cout << "Novel path not set or novel file cannot be opened." << std::endl;
                    std::cout << "Please specify a valid novel file in Settings first." << std::endl;
                    PlatformUtils::platform_sleep(2500);
                    break;
                }
                readNovel();
                break;
            case 2:
                showSettings();
                break;
            case 3:
                PlatformUtils::clear_screen();
                std::cout << "Exiting NovelReader..." << std::endl;
                PlatformUtils::platform_sleep(700);
                if(novel_stream.is_open()) novel_stream.close();
                return 0;
            default:
                PlatformUtils::clear_screen();
                std::cout << "Invalid choice. Please enter a number between 1 and 3." << std::endl;
                PlatformUtils::platform_sleep(1500);
                break;
        }
    }
    if(novel_stream.is_open()) novel_stream.close(); // Should be unreachable
    return 0;
}