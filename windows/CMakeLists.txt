#设置最低的编译版本
cmake_minimum_required(VERSION 3.10)
#设置目标平台与标准库文件
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O2 -Wall -DCLOCK")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O2 -Wall -DCLOCK")
#项目名称
project(cppStudy)
#设置C++版本
set(CMAKE_C_STANDARD 14)
set(CMAKE_CXX_STANDARD 14)

#头文件路径
INCLUDE_DIRECTORIES(
"./include/"
)
#枚举头文件
file(GLOB_RECURSE INCLUDES "./include/*.h" "./include/*.hpp")
#枚举源文件
file(GLOB_RECURSE SOURCES "./src/main.cpp")

#PROJECT_SOURCE_DIR 这是项目路径
#PROJECT_BINARY_DIR 这是build里面的文件夹
SET(EXECUTABLE_OUTPUT_PATH ${PROJECT_SOURCE_DIR}/bin) #设置二进制文件存放路径
SET(LIBRARY_OUTPUT_PATH ${PROJECT_SOURCE_DIR}/firmware) #设置各种库存放路径

#添加需要链接的库文件目录 新建好了 链接的时候用
LINK_DIRECTORIES(${LIBRARY_OUTPUT_PATH})
#生成可执行文件
add_executable(main ${SOURCES})