IF(GAME_BUILD_TARGET STREQUAL Web)
    cmake_minimum_required(VERSION 2.8.12.2)

    SET(CMAKE_SYSTEM_NAME Linux)

    SET(CMAKE_C_COMPILER   emcc)
    SET(CMAKE_CXX_COMPILER em++)
    SET(CMAKE_AR           emar)
    SET(CMAKE_RANLIB       emranlib)
    SET(CMAKE_C_FLAGS      -g)
    SET(CMAKE_CXX_FLAGS    -g)

    set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
    set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
    set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE BOTH)
    set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

    SET(GMP_RUN_RES "0" CACHE STRING "Result from TRY_RUN" FORCE)
    SET(GMP_RUN_RES__TRYRUN_OUTPUT "version=5.1.1" CACHE STRING "Output from TRY_RUN" FORCE)

    SET(MPFR_RUN_RES "0" CACHE STRING "Result from TRY_RUN" FORCE)
    SET(MPFR_RUN_RES__TRYRUN_OUTPUT "version=3.1.1" CACHE STRING "Output from TRY_RUN" FORCE)

    project(HappyGamer)

    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")
    set(SOURCE_FILES src/r_qb_loader.h src/r_qb_loader.cpp src/mem_pool.h src/MemoryPool.tcc src/global_includes.h src/r_common.h src/r_common.cpp src/r_cam_arcball.h src/r_cam_arcball.cpp  src/main.cpp src/r_room.h src/r_room.cpp src/r_mesh.h src/r_mesh.cpp src/bt_world.h src/bt_world.cpp src/r_debug.h src/r_debug.cpp src/AABB.cpp src/AABB.h src/r_font.cpp src/r_font.h src/global.cpp)
    add_executable(HappyGamer.html ${SOURCE_FILES})
    set_target_properties(HappyGamer.html PROPERTIES LINK_FLAGS "--embed-file ../asset_dir -O3 -s DEMANGLE_SUPPORT=1 -s FULL_ES2=1 -s USE_FREETYPE=1 -s USE_BULLET=1 -s TOTAL_MEMORY=134217728")
    target_include_directories(HappyGamer.html PUBLIC src/glm /usr/local/include /usr/include/freetype2)

   # em_link_js_library(HappyGamer.html freetype2/builds/unix/a.out.js)

ELSE()
    cmake_minimum_required(VERSION 2.8.12.2)

    SET(CMAKE_SYSTEM_NAME Linux)

    set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
    set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
    set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE BOTH)
    set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

    SET( GMP_RUN_RES "0" CACHE STRING "Result from TRY_RUN" FORCE)
    SET( GMP_RUN_RES__TRYRUN_OUTPUT "version=5.1.1" CACHE STRING "Output from TRY_RUN" FORCE)
    SET( MPFR_RUN_RES "0" CACHE STRING "Result from TRY_RUN" FORCE)
    SET( MPFR_RUN_RES__TRYRUN_OUTPUT "version=3.1.1" CACHE STRING "Output from TRY_RUN" FORCE)

    project(HappyGamer)

    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11")
    set(SOURCE_FILES src/r_qb_loader.h src/r_qb_loader.cpp src/mem_pool.h src/MemoryPool.tcc src/global_includes.h src/r_common.h src/r_common.cpp src/r_cam_arcball.h src/r_cam_arcball.cpp  src/main.cpp src/r_room.h src/r_room.cpp src/r_mesh.h src/r_mesh.cpp src/bt_world.h src/bt_world.cpp src/r_debug.h src/r_debug.cpp src/AABB.cpp src/AABB.h src/r_font.cpp src/r_font.h src/global.cpp)

    add_executable(HappyGamer.bin ${SOURCE_FILES})
    target_link_libraries(HappyGamer.bin SDL2 GLESv2 BulletDynamics BulletCollision LinearMath freetype)
    target_include_directories(HappyGamer.bin PUBLIC /usr/include/freetype2)
ENDIF()



