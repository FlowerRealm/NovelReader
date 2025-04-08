/*
 * @Author: FlowerCity qzrobotsnake@gmail.com
 * @Date: 2025-04-04 11:47:51
 * @LastEditors: FlowerCity qzrobotsnake@gmail.com
 * @LastEditTime: 2025-04-05 20:45:02
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
    SetConsoleCP(936);
    SetConsoleOutputCP(936);
    std::string AppDataPath = std::getenv("LOCALAPPDATA");
    std::string NovelreaderPath = AppDataPath + "\\Novelreader";
    std::string NovelreaderConfigPath = AppDataPath + "\\Novelreader\\config";
    if (!(CreateDirectory(NovelreaderPath.c_str(), NULL) || GetLastError() == ERROR_ALREADY_EXISTS))
    {
        std::cerr << "Directory create unsuccessfully, The imformation: " << GetLastError() << std::endl;
        return;
    }
    config = std::fstream(NovelreaderConfigPath, std::ios::in | std::ios::out);
    if (!configExists(NovelreaderConfigPath))
    {
        std::cout << "config does not exist." << std::endl;
        return;
    }
    std::getline(config, NovelPath);
    config >> line;
    novel = std::fstream(NovelPath, std::ios::in);
}
void read()
{
    std::string content;
    for (int i = 2; i < line; i++)
    {
        std::getline(novel, content);
    }
    do
    {
        system("cls");
        std::getline(novel, content);
        std::cout << content << std::endl;
        char ch = getchar();
        if (ch == 'q')
        {
            break;
        }
    } while (line++);
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
        lines[1] = std::to_string(line - 1);
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