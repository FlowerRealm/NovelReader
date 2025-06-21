cmake_minimum_required(VERSION 3.10)

project(NovelReaderCLI)

# Set C++ standard
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_C_STANDARD 14)

# Common compiler flags and definitions
# -DCLOCK is retained from original; its specific use isn't clear from current sources
# but assumed to be desired or harmless.
if(MSVC)
    # MSVC specific flags
    add_compile_options(/W4 /O2)
    # Suppress warnings about "unsafe" functions like getenv (used in POSIX code paths)
    # and other CRT functions if they were to be used.
    add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
    add_compile_definitions(CLOCK) # Define CLOCK for MSVC
else()
    # GCC/Clang specific flags
    add_compile_options(-O2 -Wall -std=c++14) # Explicitly set standard for compiler
    add_compile_definitions(CLOCK) # Define CLOCK for GCC/Clang
endif()

# Source files for the executable
set(APP_SOURCES
    src/main.cpp
    src/file_system_utils.cpp
    src/platform_utils.cpp
)

# Set output directory for the executable relative to the build directory
# This makes 'bin' directory appear inside the build folder.
# To place it in windows/bin like before: set(EXECUTABLE_OUTPUT_PATH ${CMAKE_SOURCE_DIR}/bin)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(EXECUTABLE_OUTPUT_PATH ${CMAKE_BINARY_DIR}/bin) # For older CMake compatibility

# Add the executable target
add_executable(NovelReaderCLI ${APP_SOURCES})

# Target specific include directories (if any were in an 'include' folder)
# For example, if you had headers in 'windows/src/include':
# target_include_directories(NovelReaderCLI PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src/include)
# Since platform_utils.h and file_system_utils.h are in src/ alongside .cpp files,
# and main.cpp is also in src/, they should be found automatically by relative includes like "file_system_utils.h".
# If headers were in a top-level "include" directory for the project "NovelReaderCLI":
# target_include_directories(NovelReaderCLI PRIVATE ${CMAKE_SOURCE_DIR}/include)


# Platform specific configurations
if(WIN32)
    # Windows specific settings
    # Ensure _WIN32 is defined (usually by MSVC itself, but good for clarity with other compilers on Windows)
    target_compile_definitions(NovelReaderCLI PRIVATE _WIN32)
else()
    # Linux/POSIX specific settings
    # No special libraries needed for the POSIX functions used (mkdir, usleep, system, getenv, stat)
    # as they are part of libc/libstdc++ which are linked by default.
    # On Linux, ensure __linux__ is defined (usually by compiler)
    # For example, if targeting pthreads: target_link_libraries(NovelReaderCLI PRIVATE pthread)
endif()

# Optional: Set a specific output name for the executable file if desired
# By default it will be NovelReaderCLI.exe on Windows and NovelReaderCLI on Linux.
# set_target_properties(NovelReaderCLI PROPERTIES OUTPUT_NAME "novelreader")

# Optional: Install rule (useful for packaging or local system-wide install)
# install(TARGETS NovelReaderCLI
#         RUNTIME DESTINATION bin  # Installs executable to <prefix>/bin
# )