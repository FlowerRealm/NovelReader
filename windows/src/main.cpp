/*
 * @Author: FlowerCity qzrobotsnake@gmail.com
 * @Date: 2025-04-04 11:47:51
 * @LastEditors: FlowerCity qzrobotsnake@gmail.com
 * @LastEditTime: 2025-04-08 22:34:33
 * @configPath: \Novelreader\windows\src\main.cpp
 */
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include <windows.h>

std::fstream config;
std::fstream novel;
std::string NovelPath;
int line;
bool configExists(const std::string &configname);
void init();
void read();
void settings();
void write();

bool configExists(const std::string &configname)
{
    std::ifstream config(configname);
    return config.good();
}
void init()
{
    std::string AppDataPath = std::getenv("LOCALAPPDATA");
    std::string NovelreaderPath = AppDataPath + "\\NovelReader";
    std::string NovelreaderConfigPath = NovelreaderPath + "\\config";

    if (!(CreateDirectory(NovelreaderPath.c_str(), NULL) || GetLastError() == ERROR_ALREADY_EXISTS))
    {
        std::cerr << "Failed to create directory: " << NovelreaderPath << std::endl;
        exit(EXIT_FAILURE);
    }

    std::ifstream configFile(NovelreaderConfigPath);
    if (!configFile.is_open())
    {
        std::ofstream newConfig(NovelreaderConfigPath);
        if (!newConfig.is_open())
        {
            std::cerr << "Failed to create config file: " << NovelreaderConfigPath << std::endl;
            exit(EXIT_FAILURE);
        }
        newConfig << "" << std::endl; // Default empty content
        newConfig.close();
        std::cerr << "Config file created. Please set the novel path and line number in settings." << std::endl;
        exit(EXIT_FAILURE);
    }

    if (!std::getline(configFile, NovelPath) || NovelPath.empty())
    {
        std::cerr << "Novel path is missing in config. Please set it in settings." << std::endl;
        exit(EXIT_FAILURE);
    }

    if (!(configFile >> line) || line <= 0)
    {
        std::cerr << "Invalid line number in config. Please set it in settings." << std::endl;
        exit(EXIT_FAILURE);
    }

    novel.open(NovelPath, std::ios::in);
    if (!novel.is_open())
    {
        std::cerr << "Failed to open novel file: " << NovelPath << std::endl;
        exit(EXIT_FAILURE);
    }
}
void read()
{
    std::string content;
    int currentLine = 0;

    while (currentLine < line - 1 && std::getline(novel, content))
    {
        currentLine++;
    }

    if (currentLine < line - 1)
    {
        std::cerr << "Line number exceeds total lines in the novel." << std::endl;
        return;
    }

    do
    {
        system("cls");
        if (!std::getline(novel, content))
        {
            std::cout << "End of novel reached." << std::endl;
            break;
        }
        std::cout << content << std::endl;
        char ch = getchar();
        if (ch == 'q')
        {
            break;
        }
        line++;
    } while (true);

    write();
    system("cls");
}
void settings()
{
    std::string NovelPath, line;
    std::cout << "Settings..." << std::endl;
    std::cout << "Please enter the path of the novel: (If the path is not correct, the program will exit | If none, just enter ENTER)" << std::endl;
    std::getline(std::cin, NovelPath);
    if (NovelPath != "")
    {
        std::fstream test(NovelPath, std::ios::in);
        if (!test.good())
        {
            std::cerr << "The path is not correct, please check it." << std::endl;
            return;
        }
        ::NovelPath = NovelPath;
    }
    std::cout << "Please enter the line number to start reading from: (If none, just enter ENTER)" << std::endl;
    getline(std::cin, line);
    if (line != "")
    {
        ::line = std::stoi(line);
    }
    write();
    system("cls");
}
void write()
{
    config.clear();
    config.seekp(0, std::ios::beg);
    std::string content;
    std::vector<std::string> lines;
    while (std::getline(config, content))
    {
        lines.push_back(content);
    }
    if (lines.size() >= 2)
    {
        lines[0] = NovelPath;
        lines[1] = std::to_string(line);
    }
    config.clear();
    config.seekp(0, std::ios::beg);
    for (const auto &l : lines)
    {
        config << l << std::endl;
    }
}

int main()
{
    init();
    while (true)
    {
        std::cout << "1. Start Read Novel" << std::endl;
        std::cout << "2. Settings" << std::endl;
        std::cout << "3. Exit" << std::endl;
        std::cout << "Please select an option: ";
        int choice;
        std::cin >> choice;
        system("cls");
        switch (choice)
        {
            case 1:
                std::cout << "Starting to read novel..." << std::endl;
                read();
                return 0;
            case 2:
                std::cout << "Settings..." << std::endl;
                settings();
                break;
            case 3:
                std::cout << "Exiting..." << std::endl;
                return 0;
        }
    }
    config.close();
    novel.close();
    return 0;
}