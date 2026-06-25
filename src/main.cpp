/*
 * @Author: FlowerRealm flower_realm@outlook.com
 * @Date: 2025-4-4 11:47:51
 * @LastEditors: FlowerRealm admin@flowerrealm.top
 * @LastEditTime: 2025-06-27 20:03:41
 * @FilePath: /NovelReader/native/src/main.cpp
 */
#include <fstream>
#include <iostream>
#include <limits> // Required for std::numeric_limits
#include <string>
#include <vector>
#include <cctype>
#include <cstdlib>

// 编码检测/转码
#ifndef _WIN32
#include <iconv.h>
#if defined(NOVELREADER_HAVE_UCHARDET)
#include <uchardet/uchardet.h>
#endif
#endif

#ifdef _WIN32
#include <windows.h> // For SetConsoleOutputCP only on Windows
#endif

#include "file_system_utils.h"
#include "platform_utils.h" // Include the new platform utilities
#include "terminal_input.h"

// Global variables
std::fstream novel_stream;
std::string NovelPath;
int current_line_number;
std::string ConfigFilePath;
// 新增：保存小说文件编码
std::string NovelEncoding = "UTF-8";

namespace {

void strip_utf8_bom_prefix(std::string &s)
{
    if (s.size() >= 3 && static_cast<unsigned char>(s[0]) == 0xEF &&
        static_cast<unsigned char>(s[1]) == 0xBB && static_cast<unsigned char>(s[2]) == 0xBF)
    {
        s.erase(0, 3);
    }
}

std::string detect_bom_encoding_prefix(const std::string &filename)
{
    std::ifstream file(filename, std::ios::binary);
    if (!file.is_open()) return "";

    unsigned char bom[4] = {0, 0, 0, 0};
    file.read(reinterpret_cast<char *>(bom), sizeof(bom));
    const size_t n = static_cast<size_t>(file.gcount());

    if (n >= 2 && bom[0] == 0xFF && bom[1] == 0xFE) return "UTF-16LE";
    if (n >= 2 && bom[0] == 0xFE && bom[1] == 0xFF) return "UTF-16BE";
    if (n >= 3 && bom[0] == 0xEF && bom[1] == 0xBB && bom[2] == 0xBF) return "UTF-8";

    return "";
}

#ifdef _WIN32
bool is_valid_utf8_sample_strict(const std::string &bytes)
{
    if (bytes.empty()) return true;

    int required = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(),
                                       static_cast<int>(bytes.size()), nullptr, 0);
    return required > 0;
}

std::string convert_to_utf8_windows(const std::string &input, UINT codepage, bool strict)
{
    if (input.empty()) return "";

    DWORD flags = strict ? MB_ERR_INVALID_CHARS : 0;
    int wide_len =
        MultiByteToWideChar(codepage, flags, input.data(), static_cast<int>(input.size()), nullptr, 0);
    if (wide_len <= 0)
    {
        // Best-effort fallback for ANSI-ish codepages.
        wide_len = MultiByteToWideChar(codepage, 0, input.data(), static_cast<int>(input.size()), nullptr, 0);
        if (wide_len <= 0) return input;
    }

    std::wstring wide;
    wide.resize(static_cast<size_t>(wide_len));
    if (MultiByteToWideChar(codepage, 0, input.data(), static_cast<int>(input.size()), &wide[0], wide_len) <= 0)
    {
        return input;
    }

    int u8_len =
        WideCharToMultiByte(CP_UTF8, 0, wide.data(), wide_len, nullptr, 0, nullptr, nullptr);
    if (u8_len <= 0) return input;

    std::string out;
    out.resize(static_cast<size_t>(u8_len));
    if (WideCharToMultiByte(CP_UTF8, 0, wide.data(), wide_len, &out[0], u8_len, nullptr, nullptr) <= 0)
    {
        return input;
    }

    return out;
}
#endif

} // namespace

// 新增：检测文件编码
std::string detect_encoding(const std::string &filename)
{
    // BOM beats heuristics.
    std::string bom_encoding = detect_bom_encoding_prefix(filename);
    if (!bom_encoding.empty()) return bom_encoding;

#ifdef _WIN32
    std::ifstream file(filename, std::ios::binary);
    if (!file.is_open()) return "UTF-8";

    constexpr size_t kSampleBytes = 64 * 1024;
    std::string data;
    data.resize(kSampleBytes);
    file.read(&data[0], static_cast<std::streamsize>(kSampleBytes));
    data.resize(static_cast<size_t>(file.gcount()));

    if (is_valid_utf8_sample_strict(data)) return "UTF-8";
    return "CP_ACP";
#else
#if defined(NOVELREADER_HAVE_UCHARDET)
    uchardet_t ud = uchardet_new();
    std::ifstream file(filename, std::ios::binary);
    if (!file.is_open())
    {
        uchardet_delete(ud);
        return "UTF-8";
    }
    constexpr size_t kSampleBytes = 64 * 1024;
    std::string data;
    data.resize(kSampleBytes);
    file.read(&data[0], static_cast<std::streamsize>(kSampleBytes));
    data.resize(static_cast<size_t>(file.gcount()));
    if (!data.empty())
    {
        uchardet_handle_data(ud, data.c_str(), data.size());
    }
    uchardet_data_end(ud);
    std::string encoding = uchardet_get_charset(ud);
    uchardet_delete(ud);
    if (encoding.empty()) return "UTF-8";
    // uchardet返回的编码名可能是大写，统一转大写
    for (auto &c : encoding) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return encoding;
#else
    (void)filename;
    return "UTF-8";
#endif
#endif
}

// 新增：转码为UTF-8
std::string convert_to_utf8(const std::string &input, const std::string &from_encoding)
{
#ifdef _WIN32
    if (from_encoding == "UTF-8") return input;
    if (from_encoding == "UTF-16LE" || from_encoding == "UTF-16BE") return input;

    // "CP_ACP" is a stable contract: whatever the user's system ANSI codepage is.
    if (from_encoding == "CP_ACP")
    {
        return convert_to_utf8_windows(input, CP_ACP, false);
    }

    // Conservative fallback.
    return convert_to_utf8_windows(input, CP_ACP, false);
#else
    if (from_encoding == "UTF-8") return input;
    iconv_t cd = iconv_open("UTF-8", from_encoding.c_str());
    if (cd == (iconv_t)-1) return input;
    size_t inlen = input.size();
    size_t outlen = inlen * 4 + 4;
    std::vector<char> outbuf(outlen);
    char *inptr = const_cast<char *>(input.data());
    char *outptr = outbuf.data();
    size_t inbytesleft = inlen;
    size_t outbytesleft = outlen;
    size_t res = iconv(cd, &inptr, &inbytesleft, &outptr, &outbytesleft);
    iconv_close(cd);
    if (res == (size_t)-1) return input;
    return std::string(outbuf.data(), outlen - outbytesleft);
#endif
}

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
    if (config_dir.empty())
    {
        std::cerr << "Critical: Could not determine config directory. Exiting." << std::endl;
        PlatformUtils::platform_sleep(3000);
        exit(1);
    }

    if (!FileSystemUtils::create_directory_if_not_exists(config_dir))
    {
        std::cerr << "Critical: Could not create config directory: " << config_dir << ". Exiting." << std::endl;
        PlatformUtils::platform_sleep(3000);
        exit(1);
    }

    ConfigFilePath = config_dir + PlatformUtils::get_path_separator() + "config";

    int line_val_from_config = 0;
    if (!FileSystemUtils::read_config(ConfigFilePath, NovelPath, line_val_from_config))
    {
        std::cerr << "Warning: Configuration could not be read or initialized properly." << std::endl;
        NovelPath = "";
        line_val_from_config = 0;
    }
    if (line_val_from_config < 0) line_val_from_config = 0;
    ::current_line_number = line_val_from_config + 1;
    if (::current_line_number < 1) ::current_line_number = 1;

    if (!NovelPath.empty())
    {
        if (novel_stream.is_open()) novel_stream.close();
        novel_stream.open(NovelPath, std::ios::in | std::ios::binary);
        if (!novel_stream.is_open())
        {
            std::cerr << "Error: Could not open novel file: " << NovelPath << ". Please check path in settings." << std::endl;
        }
        else
        {
            // 检测编码
            NovelEncoding = detect_encoding(NovelPath);
        }
    }
}

void readNovel()
{
    if (!novel_stream.is_open())
    {
        PlatformUtils::clear_screen();
        std::cout << "Novel file is not open. Current path: " << (NovelPath.empty() ? "Not set" : NovelPath) << std::endl;
        std::cout << "Please check the path in Settings." << std::endl;
        PlatformUtils::platform_sleep(2500);
        return;
    }

    TerminalInput::ScopedRawMode raw_mode;
    if (!raw_mode.is_enabled())
    {
        PlatformUtils::clear_screen();
        std::cerr << "Critical: Failed to enable raw terminal input. Please run in an interactive terminal." << std::endl;
        PlatformUtils::platform_sleep(2500);
        return;
    }

    if (NovelEncoding == "UTF-16LE" || NovelEncoding == "UTF-16BE")
    {
        PlatformUtils::clear_screen();
        std::cout << "This novel appears to be encoded as " << NovelEncoding << ", which is not supported." << std::endl;
        std::cout << "Please convert it to UTF-8 text." << std::endl;
        PlatformUtils::platform_sleep(2500);
        return;
    }
    std::cin.clear();
    novel_stream.clear();
    novel_stream.seekg(0);

    std::string content_buffer;

    auto strip_trailing_cr = [](std::string &line) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
    };

    // 记录每一行的起始偏移（1-based），用于上一行
    std::vector<std::streampos> line_start_positions;
    line_start_positions.push_back(std::streampos(0)); // index 0 unused

    int line_being_displayed = ::current_line_number;

    // 定位到当前行，同时建立索引（避免上一行需要反复从头扫描）
    for (int line = 1; line < line_being_displayed; ++line)
    {
        line_start_positions.push_back(novel_stream.tellg());
        if (!std::getline(novel_stream, content_buffer))
        {
            PlatformUtils::clear_screen();
            std::cerr << "Requested line " << ::current_line_number << " is beyond EOF. Resetting to start." << std::endl;
            PlatformUtils::platform_sleep(2000);
            ::current_line_number = 1;
            line_being_displayed = 1;
            novel_stream.clear();
            novel_stream.seekg(0);
            line_start_positions.resize(1);
            break;
        }
    }

    bool has_buffered_line = false;
    std::string buffered_utf8_line;

    enum class ReaderAction
    {
        None,
        Next,
        Prev,
        Quit,
    };

    int last_persisted_line = -1;

    while (true)
    {
        PlatformUtils::clear_screen();

        std::string utf8_line;
        if (has_buffered_line)
        {
            utf8_line = buffered_utf8_line;
            has_buffered_line = false;
        }
        else
        {
            if (line_being_displayed >= static_cast<int>(line_start_positions.size()))
            {
                line_start_positions.push_back(novel_stream.tellg());
            }

            if (!std::getline(novel_stream, content_buffer))
            {
                std::cout << "End of novel." << std::endl;
                // Avoid persisting the "EOF + 1" state; keep progress at the last line.
                int last_line = line_being_displayed - 1;
                if (last_line < 1) last_line = 1;
                ::current_line_number = last_line;
                PlatformUtils::platform_sleep(1500);
                break;
            }
            strip_trailing_cr(content_buffer);
            utf8_line = convert_to_utf8(content_buffer, NovelEncoding);
            if (line_being_displayed >= 1 && line_being_displayed < static_cast<int>(line_start_positions.size()) &&
                line_start_positions[line_being_displayed] == std::streampos(0))
            {
                strip_utf8_bom_prefix(utf8_line);
            }
        }

        if (utf8_line.empty())
        {
            line_being_displayed++;
            ::current_line_number = line_being_displayed;
            continue;
        }

        std::cout << "Line " << line_being_displayed << ":\n";
        std::cout << utf8_line << std::endl;

        if (line_being_displayed != last_persisted_line)
        {
            ::current_line_number = line_being_displayed;
            writeAppSettings();
            last_persisted_line = line_being_displayed;
        }

        std::cout << "\n--- (Enter/Space/Down: next, K/Up: previous, Q/Esc: quit to menu) ---" << std::flush;
        TerminalInput::KeyEvent key;
        std::string input_error;
        if (!TerminalInput::read_key_blocking(key, &input_error))
        {
            ::current_line_number = line_being_displayed + 1;
            break;
        }

        ReaderAction action = ReaderAction::None;
        switch (key.type)
        {
            case TerminalInput::KeyType::Enter:
            case TerminalInput::KeyType::Space:
            case TerminalInput::KeyType::ArrowDown:
                action = ReaderAction::Next;
                break;
            case TerminalInput::KeyType::ArrowUp:
                action = ReaderAction::Prev;
                break;
            case TerminalInput::KeyType::Escape:
            case TerminalInput::KeyType::CtrlC:
            case TerminalInput::KeyType::CtrlD:
                action = ReaderAction::Quit;
                break;
            case TerminalInput::KeyType::Character:
                if (key.ch == 'q' || key.ch == 'Q')
                {
                    action = ReaderAction::Quit;
                }
                else if (key.ch == 'k' || key.ch == 'K')
                {
                    action = ReaderAction::Prev;
                }
                else if (key.ch == 'j' || key.ch == 'J')
                {
                    action = ReaderAction::Next;
                }
                break;
            default:
                break;
        }

        if (action == ReaderAction::Quit)
        {
            ::current_line_number = line_being_displayed + 1;
            break;
        }
        else if (action == ReaderAction::Prev)
        {
            const std::streampos resume_pos = novel_stream.tellg();
            if (line_being_displayed <= 1)
            {
                std::cout << "\nAlready at the first line." << std::endl;
                PlatformUtils::platform_sleep(800);
                buffered_utf8_line = utf8_line;
                has_buffered_line = true;
                continue;
            }

            int candidate = line_being_displayed - 1;
            bool found = false;
            while (candidate >= 1)
            {
                if (candidate >= static_cast<int>(line_start_positions.size()))
                {
                    candidate--;
                    continue;
                }

                novel_stream.clear();
                novel_stream.seekg(line_start_positions[candidate]);

                std::string candidate_raw;
                if (!std::getline(novel_stream, candidate_raw))
                {
                    candidate--;
                    continue;
                }
                strip_trailing_cr(candidate_raw);

                std::string candidate_utf8 = convert_to_utf8(candidate_raw, NovelEncoding);
                if (candidate >= 1 && candidate < static_cast<int>(line_start_positions.size()) &&
                    line_start_positions[candidate] == std::streampos(0))
                {
                    strip_utf8_bom_prefix(candidate_utf8);
                }
                if (candidate_utf8.empty())
                {
                    candidate--;
                    continue;
                }

                buffered_utf8_line = candidate_utf8;
                has_buffered_line = true;
                line_being_displayed = candidate;
                ::current_line_number = line_being_displayed;
                found = true;
                break;
            }

            if (!found)
            {
                buffered_utf8_line = utf8_line;
                has_buffered_line = true;
                novel_stream.clear();
                if (resume_pos != std::streampos(-1))
                {
                    novel_stream.seekg(resume_pos);
                }
            }
            continue;
        }
        else if (action == ReaderAction::Next)
        {
            line_being_displayed++;
            ::current_line_number = line_being_displayed;
            continue;
        }

        // Unrecognized key: keep the same line displayed.
        buffered_utf8_line = utf8_line;
        has_buffered_line = true;
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
    std::getline(std::cin, inputNovelPath);

    if (!inputNovelPath.empty())
    {
        std::fstream test_novel(inputNovelPath, std::ios::in | std::ios::binary);
        if (!test_novel.good())
        {
            std::cerr << "\nError: The new path is not correct or file cannot be opened." << std::endl;
            std::cout << "Novel path not changed." << std::endl;
            PlatformUtils::platform_sleep(2000);
        }
        else
        {
            test_novel.close();
            const std::string encoding = detect_encoding(inputNovelPath);
            if (encoding == "UTF-16LE" || encoding == "UTF-16BE")
            {
                std::cerr << "\nError: This file appears to be " << encoding << ", which is not supported." << std::endl;
                std::cerr << "Please convert it to UTF-8 text." << std::endl;
                PlatformUtils::platform_sleep(2500);
            }
            else
            {
                if (novel_stream.is_open()) novel_stream.close();
                NovelPath = inputNovelPath;
                novel_stream.open(NovelPath, std::ios::in | std::ios::binary);
                if (!novel_stream.is_open())
                {
                    std::cerr << "\nError: Could not open new novel file: " << NovelPath << std::endl;
                    NovelPath = "";
                }
                else
                {
                    NovelEncoding = encoding;
                    std::cout << "\nNovel path updated. Reading will start from the beginning of the new novel." << std::endl;
                }
                ::current_line_number = 1;
                PlatformUtils::platform_sleep(1500);
            }
        }
    }

    std::cout << "\nNext line to read will be: " << ::current_line_number << std::endl;
    std::cout << "Enter new starting line number (e.g., 1) (or press Enter to keep current): ";
    std::getline(std::cin, inputLineStr);
    if (!inputLineStr.empty())
    {
        try
        {
            int input_l = std::stoi(inputLineStr);
            if (input_l >= 1)
            {
                ::current_line_number = input_l;
                std::cout << "\nStarting line number updated to: " << ::current_line_number << std::endl;
            }
            else
            {
                std::cout << "\nInvalid line number. Must be 1 or greater. Line number not changed." << std::endl;
            }
        } catch (const std::invalid_argument &ia)
        {
            std::cerr << "\nInvalid input for line number (not a number). Line number not changed." << std::endl;
        } catch (const std::out_of_range &oor)
        {
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
    if (ConfigFilePath.empty())
    {
        std::cerr << "Critical Error: Config file path not set. Cannot save settings." << std::endl;
        PlatformUtils::platform_sleep(2000);
        return;
    }
    if (!FileSystemUtils::write_config(ConfigFilePath, NovelPath, ::current_line_number - 1))
    {
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

        std::string choice_line;
        if (!std::getline(std::cin, choice_line))
        {
            PlatformUtils::clear_screen();
            std::cout << "Exiting NovelReader..." << std::endl;
            PlatformUtils::platform_sleep(700);
            if (novel_stream.is_open()) novel_stream.close();
            return 0;
        }

        int choice = 0;
        try
        {
            choice = std::stoi(choice_line);
        }
        catch (...)
        {
            PlatformUtils::clear_screen();
            std::cout << "Invalid input. Please enter a number (1-3)." << std::endl;
            PlatformUtils::platform_sleep(1500);
            continue;
        }

        switch (choice)
        {
            case 1:
                if (NovelPath.empty() || !novel_stream.is_open())
                {
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
                if (novel_stream.is_open()) novel_stream.close();
                return 0;
            default:
                PlatformUtils::clear_screen();
                std::cout << "Invalid choice. Please enter a number between 1 and 3." << std::endl;
                PlatformUtils::platform_sleep(1500);
                break;
        }
    }
    if (novel_stream.is_open()) novel_stream.close(); // Should be unreachable
    return 0;
}
