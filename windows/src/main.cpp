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
#include <windows.h>
#include <limits> // Required for std::numeric_limits

// Global variables
std::fstream config_stream; // Renamed to avoid conflict with a potential local variable name
std::fstream novel_stream;  // Renamed for clarity
std::string NovelPath;
int current_line_number; // This global 'current_line_number' will be the 1-indexed next line to read.

// Function declarations
bool configExists(const std::string &configname);
void initConfigAndNovel();
void readNovel();
void showSettings();
void writeConfig();

bool configExists(const std::string &configname)
{
    std::ifstream check_config(configname);
    return check_config.good();
}

void initConfigAndNovel()
{
    SetConsoleOutputCP(CP_UTF8); // Set console output to UTF-8

    char* localAppDataPath_cstr = nullptr;
    size_t len;
    errno_t err = _dupenv_s(&localAppDataPath_cstr, &len, "LOCALAPPDATA");

    if (err != 0 || localAppDataPath_cstr == nullptr) {
        std::cerr << "Error: LOCALAPPDATA environment variable not found." << std::endl;
        // Consider exiting or using a default path if critical
        if (localAppDataPath_cstr) free(localAppDataPath_cstr);
        return;
    }
    std::string AppDataPath(localAppDataPath_cstr);
    free(localAppDataPath_cstr);

    std::string NovelreaderDirPath = AppDataPath + "\\Novelreader"; // Corrected variable name
    std::string NovelreaderConfigPath = NovelreaderDirPath + "\\config";

    if (!(CreateDirectory(NovelreaderDirPath.c_str(), NULL) || GetLastError() == ERROR_ALREADY_EXISTS))
    {
        std::cerr << "Directory create unsuccessfully, The information: " << GetLastError() << std::endl;
        return;
    }

    config_stream.open(NovelreaderConfigPath, std::ios::in | std::ios::out);
    if (!config_stream.is_open()) {
        // File doesn't exist or cannot be opened for in|out, try creating it.
        config_stream.clear(); // Clear error flags
        config_stream.open(NovelreaderConfigPath, std::ios::out); // Create it
        if (config_stream.is_open()) {
            config_stream << "" << std::endl; // Default empty path
            config_stream << 0 << std::endl;  // Default start line (0-indexed, so line 1)
            config_stream.close();
            // Reopen in in|out mode
            config_stream.open(NovelreaderConfigPath, std::ios::in | std::ios::out);
        }
    }

    if (!config_stream.is_open()) {
        std::cerr << "Could not open or create config file: " << NovelreaderConfigPath << std::endl;
        return;
    }

    config_stream.seekg(0);

    std::getline(config_stream, NovelPath);
    int val_from_config = 0;
    if (!(config_stream >> val_from_config)) {
        if (config_stream.eof()) { // Reached EOF, means line number might be missing
             config_stream.clear(); // Clear EOF flag
             config_stream.seekg(0, std::ios::end); // Go to end
             if (config_stream.tellg() == 0) { // File is empty
                std::cerr << "Warning: Config file is empty. Initializing with defaults." << std::endl;
             } else {
                std::cerr << "Warning: Could not read line number from config. It might be incomplete. Defaulting to start from line 1." << std::endl;
             }
        } else if (config_stream.fail()) { // Other fail state
            std::cerr << "Warning: Failed to read line number from config due to format error. Defaulting to start from line 1." << std::endl;
            config_stream.clear(); // Clear fail flags
            // Attempt to consume the rest of the problematic line if any before trying to write defaults
            std::string dummy;
            std::getline(config_stream, dummy);
        }
        val_from_config = 0;
        // Ensure config is in a good state to write defaults if it was problematic
        config_stream.close();
        config_stream.open(NovelreaderConfigPath, std::ios::out | std::ios::trunc);
        if (config_stream.is_open()) {
            config_stream << (NovelPath.empty() ? "" : NovelPath) << std::endl;
            config_stream << val_from_config << std::endl;
            config_stream.close();
            config_stream.open(NovelreaderConfigPath, std::ios::in | std::ios::out); // Reopen for continued use
             if (!config_stream.is_open()) { /* handle error */ }
             else {
                 config_stream.seekg(0); // Reset position after re-opening
                 std::getline(config_stream, NovelPath); // Re-read path
                 config_stream >> val_from_config; // Re-read line value
             }
        }
    }
    ::current_line_number = val_from_config + 1;

    if (!NovelPath.empty()) {
        novel_stream.open(NovelPath, std::ios::in);
        if (!novel_stream.is_open()) {
            std::cerr << "Error: Could not open novel file: " << NovelPath << ". Please check path in settings." << std::endl;
        }
    } else {
        // No message here, main menu will show "Not Set"
    }
}

void readNovel()
{
    if (!novel_stream.is_open()) {
        system("cls");
        std::cout << "Novel file is not open. Current path: "<< (NovelPath.empty() ? "Not set" : NovelPath) << std::endl;
        std::cout << "Please check the path in Settings." << std::endl;
        Sleep(2500);
        return;
    }
    novel_stream.clear();
    novel_stream.seekg(0);

    std::string content_buffer;

    for (int i = 1; i < ::current_line_number; i++) {
        if (!std::getline(novel_stream, content_buffer)) {
            system("cls");
            std::cerr << "Novel does not have line " << ::current_line_number << " (EOF reached while skipping)." << std::endl;
            std::cout << "You might want to reset the line number in Settings or check the novel file." << std::endl;
            ::current_line_number = i; // Reset to the last valid line number reached
            Sleep(3000);
            return;
        }
    }

    int line_being_displayed = ::current_line_number;

    while (true) {
        system("cls");
        if (!std::getline(novel_stream, content_buffer)) {
            std::cout << "End of novel." << std::endl;
            // At this point, line_being_displayed was the one we ATTEMPTED to read.
            // So, next time, we should try to read line_being_displayed again.
            ::current_line_number = line_being_displayed;
            Sleep(1500);
            break;
        }
        std::cout << "Line " << line_being_displayed << ":\n"; // Display current line number
        std::cout << content_buffer << std::endl;

        std::cout << "\n--- (Enter: next, Q: quit to menu) ---";
        char ch = getchar();
        if (ch == 'q' || ch == 'Q') {
            // User quit AFTER successfully reading and displaying 'line_being_displayed'.
            // So, next time, we should start at 'line_being_displayed + 1'.
            ::current_line_number = line_being_displayed + 1;
            break;
        }
        // Any other key (including Enter which getchar() captures if buffer is empty)
        line_being_displayed++;
    }
    writeConfig();
    system("cls");
}

void showSettings()
{
    system("cls");
    std::string inputNovelPath;
    std::string inputLineStr;

    std::cout << "--- Settings ---" << std::endl;
    std::cout << "Current Novel Path: " << (NovelPath.empty() ? "Not set" : NovelPath) << std::endl;
    std::cout << "Enter new novel path (or press Enter to keep current): ";

    // Important: Consume the newline character left by previous std::cin >> choice
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::getline(std::cin, inputNovelPath);

    if (!inputNovelPath.empty())
    {
        std::fstream test_novel(inputNovelPath, std::ios::in);
        if (!test_novel.good())
        {
            std::cerr << "\nError: The new path is not correct or file cannot be opened." << std::endl;
            std::cout << "Novel path not changed." << std::endl;
            Sleep(2000);
        } else {
            if (novel_stream.is_open()) novel_stream.close(); // Close old novel
            NovelPath = inputNovelPath;
            novel_stream.open(NovelPath, std::ios::in); // Open new novel
            if(!novel_stream.is_open()){
                std::cerr << "\nError: Could not open new novel file: " << NovelPath << std::endl;
                NovelPath = ""; // Reset path if open failed
            } else {
                std::cout << "\nNovel path updated. Reading will start from the beginning of the new novel." << std::endl;
            }
            ::current_line_number = 1; // Reset line number for the new novel
            Sleep(1500);
            test_novel.close();
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
        Sleep(1500);
    }

    writeConfig();
    system("cls");
    std::cout << "Settings saved." << std::endl;
    Sleep(1500);
}

void writeConfig()
{
    if (config_stream.is_open()) {
        config_stream.close(); // Close before reopening with truncate
    }

    char* localAppDataPath_cstr = nullptr;
    size_t len;
    errno_t err = _dupenv_s(&localAppDataPath_cstr, &len, "LOCALAPPDATA");
     if (err != 0 || localAppDataPath_cstr == nullptr) { /* error handling */ return; }
    std::string AppDataPath(localAppDataPath_cstr);
    free(localAppDataPath_cstr);
    std::string NovelreaderConfigPath = AppDataPath + "\\Novelreader\\config";

    config_stream.open(NovelreaderConfigPath, std::ios::out | std::ios::trunc);
    if (!config_stream.is_open()) {
        std::cerr << "Critical Error: Failed to open config file for writing in writeConfig(). Settings not saved." << std::endl;
        Sleep(2000);
        return;
    }

    config_stream << NovelPath << std::endl;
    config_stream << (::current_line_number - 1) << std::endl;
    config_stream.flush();
    config_stream.close(); // Close after writing

    // Reopen for future operations if needed by other parts of the program,
    // though current flow usually exits or re-inits.
    // For safety, ensure it's ready for next initConfigAndNovel() if program continues.
    config_stream.open(NovelreaderConfigPath, std::ios::in | std::ios::out);
     if (!config_stream.is_open()) {
        std::cerr << "Warning: Failed to reopen config file after writing." << std::endl;
    }
}


int main()
{
    initConfigAndNovel();
    while (true)
    {
        system("cls");
        std::cout << "--- NovelReader Menu ---" << std::endl;
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
            system("cls");
            std::cout << "Invalid input. Please enter a number (1-3)." << std::endl;
            Sleep(1500);
            continue;
        }

        switch (choice)
        {
            case 1:
                if (NovelPath.empty() || !novel_stream.is_open()) {
                    system("cls");
                    std::cout << "Novel path not set or novel file cannot be opened." << std::endl;
                    std::cout << "Please specify a valid novel file in Settings first." << std::endl;
                    Sleep(2500);
                    break;
                }
                // system("cls"); // readNovel will clear screen
                // std::cout << "Starting to read novel..." << std::endl;
                // Sleep(500);
                readNovel();
                break;
            case 2:
                showSettings();
                break;
            case 3:
                system("cls");
                std::cout << "Exiting NovelReader..." << std::endl;
                Sleep(700);
                if(config_stream.is_open()) config_stream.close();
                if(novel_stream.is_open()) novel_stream.close();
                return 0;
            default:
                system("cls");
                std::cout << "Invalid choice. Please enter a number between 1 and 3." << std::endl;
                Sleep(1500);
                break;
        }
    }
    // Should not be reached
    if(config_stream.is_open()) config_stream.close();
    if(novel_stream.is_open()) novel_stream.close();
    return 0;
}