//
// Created by vugluskr on 11.03.16.
//

#include "r_common.h"

#include "mem_pool.h"
#include "r_qb_loader.h"
#include "r_mesh.h"
#include "r_room.h"
#include "r_font.h"
/**
 * STATE
 */

static bool g_bool_render_initialize = false;

#define LIGHTMAP_SIZE 16

bool quit = false;


static Context g_Context;

//Mesh mesh;

Room room;

int32_t testFontMesh = 0;
mat4 identity = mat4();

/**
 * INTERNAL
 */

static void r_resize_handler(Context& ctx, int width, int height)
{
    ctx.width = width;
    ctx.height = height;

    glViewport(0, 0, ctx.width, ctx.height);
}

static void r_draw_handler(Context& ctx)
{
    glClearColor(ctx.clear_r, ctx.clear_g, ctx.clear_b, ctx.clear_a);
    glClear(GL_COLOR_BUFFER_BIT| GL_DEPTH_BUFFER_BIT);

    r_cam_update_project((float)ctx.width, (float)ctx.height, 0.01f, 1000.0f, ctx.cam);

    r_room_render(ctx, room);
}

static void r_update_handler()
{
    SDL_Event event;
    while(SDL_PollEvent(&event))
    {
        switch (event.type)
        {
            case SDL_QUIT:
                quit = true;
                break;
            case SDL_MOUSEBUTTONDOWN:
            {
                if( !g_Context.m_mouseRotLock && event.button.button == SDL_BUTTON_LEFT )
                {
                    g_Context.m_mouseLastPos.x = event.button.x;
                    g_Context.m_mouseLastPos.y = event.button.y;

                    g_Context.m_mouseRotLock = true;
                }

                if( !g_Context.m_mouseMoveLock && event.button.button == SDL_BUTTON_RIGHT )
                {
                    g_Context.m_mouseLastPosMove.x = event.button.x;
                    g_Context.m_mouseLastPosMove.y = event.button.y;

                    g_Context.m_mouseMoveLock = true;
                }

                break;
            }
            case SDL_MOUSEBUTTONUP:
            {
                if( g_Context.m_mouseRotLock && event.button.button == SDL_BUTTON_LEFT )
                {
                    g_Context.m_mouseLastPos.x = 0;
                    g_Context.m_mouseLastPos.y = 0;

                    g_Context.m_mouseRotLock = false;
                }

                if( g_Context.m_mouseMoveLock && event.button.button == SDL_BUTTON_RIGHT )
                {
                    g_Context.m_mouseLastPosMove.x = 0;
                    g_Context.m_mouseLastPosMove.y = 0;


                    g_Context.m_mouseMoveLock = false;
                }

                break;
            }
            case SDL_MOUSEMOTION:
            {
                if( g_Context.m_mouseRotLock && event.button.button == SDL_BUTTON_LEFT  )
                {
                    float dPhi = ((float)( g_Context.m_mouseLastPos.y - event.button.y) / 300);
                    float dTheta = ((float)( g_Context.m_mouseLastPos.x - event.button.x) / 300);

                    r_cam_arcball_rotation(-dTheta, dPhi, g_Context.cam);

                    g_Context.m_mouseLastPos.x = event.button.x;
                    g_Context.m_mouseLastPos.y = event.button.y;
                }


                if( g_Context.m_mouseMoveLock && event.button.button == SDL_BUTTON_X1 )
                {
                    float dy = ((float)( g_Context.m_mouseLastPosMove.y - event.button.y) / 50);
                    float dx = ((float)( g_Context.m_mouseLastPosMove.x - event.button.x) / 50);

                    r_cam_move(vec3(dx, 0, -dy), g_Context.cam);

                    g_Context.m_mouseLastPosMove.x = event.button.x;
                    g_Context.m_mouseLastPosMove.y = event.button.y;
                }

                break;
            }
            case SDL_MOUSEWHEEL:
            {
                r_cam_arcball_zoom(event.wheel.y * 1.5f, g_Context.cam);
                break;
            }
        }
    }

    bt_update(g_Context.worldPhysic, 1.0f / 60.0f);

    r_draw_handler(g_Context);

    g_Context.worldPhysic.dynamicsWorld->debugDrawWorld();
    g_Context.worldPhysic.debugDraw.update_mesh();

    r_draw_opengl_mesh_transform(g_Context, glm::mat4(), *g_Context.worldPhysic.debugDraw.meshData, eShaderTypes::EST_VC, GL_LINES);

    if( g_Context.m_mouseRotLock )
    {
        glm::vec3 out_origin;
        glm::vec3 out_direction;
        ScreenPosToWorldRay(
                (int32_t)g_Context.m_mouseLastPos.x,
                g_Context.height - (int32_t)g_Context.m_mouseLastPos.y,
                g_Context.width, g_Context.height,
                g_Context.cam.m_view,
                g_Context.cam.m_proj,
                out_origin,
                out_direction
        );

        out_direction = out_direction * 1000.0f;
        btCollisionWorld::ClosestRayResultCallback RayCallback(btVector3(out_origin.x, out_origin.y, out_origin.z), btVector3(out_direction.x, out_direction.y, out_direction.z));
        g_Context.worldPhysic.dynamicsWorld->rayTest(btVector3(out_origin.x, out_origin.y, out_origin.z), btVector3(out_direction.x, out_direction.y, out_direction.z), RayCallback);

        if(RayCallback.hasHit())
        {
            printf("HIT! %i %f %f \n", RayCallback.m_collisionObject->getUserIndex(), g_Context.m_mouseLastPos.x, g_Context.m_mouseLastPos.y);
        }
    }

    SDL_GL_SwapWindow(g_Context.win);
}

void mainLoop()
{
#ifdef __EMSCRIPTEN__
    int fps = 0;
    int simulate_infinite_loop = 1;
    emscripten_set_main_loop(r_update_handler, fps, simulate_infinite_loop);
#else
    while (!quit)
    {
        r_update_handler();
   //     SDL_Delay(16);
    }
#endif
}

void r_init_gl(Context& ctx)
{
    glViewport(0, 0, ctx.width, ctx.height);

    glEnable(GL_DEPTH_TEST);

    std::string vnc_fp;
    std::string vnc_vp;

    std::string vc_fp;
    std::string vc_vp;

    read_file_content("asset_dir/shaders/vnc.fp", vnc_fp);
    read_file_content("asset_dir/shaders/vnc.vp", vnc_vp);

    read_file_content("asset_dir/shaders/vc.fp", vc_fp);
    read_file_content("asset_dir/shaders/vc.vp", vc_vp);

#ifndef __EMSCRIPTEN__

#endif

    ctx.m_shaderPrograms[eShaderTypes::EST_VNC] = r_build_shader(vnc_vp, vnc_fp);
    ctx.m_shaderPrograms[eShaderTypes::EST_VC]  = r_build_shader(vc_vp, vc_fp);

    std::list<eRoomWallPatternType> pallete = {
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::WINDOW,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::DOOR,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE
    };

    std::list<eRoomWallPatternType> pallete_door = {
            eRoomWallPatternType::EMPTY,
            eRoomWallPatternType::EMPTY,
            eRoomWallPatternType::EMPTY,
            eRoomWallPatternType::SIMPLE
    };

    std::list<eRoomWallPatternType> pallete_window = {
            eRoomWallPatternType::EMPTY,
            eRoomWallPatternType::SIMPLE
    };

    std::list<eRoomWallPatternType> pallete1 = {
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE,
            eRoomWallPatternType::SIMPLE
    };



    r_room_add_floor(ctx, room, "floor_linoleum_01", vec2(16.0f, 12.0f), vec2(11.0f, 11.0f), vec3(0.0f, 0.0f, 0.0f));
    r_room_add_wall(ctx, room, "wall_wallpaper_01", pallete, eRoomGrowthSide::EAST, 11.0f, vec3(-5.0f, 22.5f, 0.0f));
    r_room_add_wall(ctx, room, "door_wood_01", pallete_door, eRoomGrowthSide::EAST, 11.0f, vec3(-5.0f, 17.0f, 0.0f));
    r_room_add_wall(ctx, room, "wall_wallpaper_01", pallete1, eRoomGrowthSide::SOUTH, 11.0f, vec3(0.0f, 22.5f, -5.0f));

    btTransform t;

    t.setIdentity();
    t.setOrigin( btVector3(20.0f, 50.0f, 20.0f) );
    r_room_add_static_object(ctx, room, "asset_dir/wc_bath_01.qb", t, 4.0f);

    t.setIdentity();
    t.setOrigin( btVector3(25.0f, 50.0f, 25.0f) );
    r_room_add_static_object(ctx, room, "asset_dir/PC_system_unit.qb", t, 4.0f);


    t.setIdentity();
    t.setOrigin( btVector3(30.0f, 50.0f, 30.0f) );
    r_room_add_static_object(ctx, room, "asset_dir/wc_toilet_01.qb", t, 4.0f);


    t.setIdentity();
    t.setOrigin( btVector3(35.0f, 50.0f, 35.0f) );
    r_room_add_static_object(ctx, room, "asset_dir/plant_tree_01.qb", t, 4.0f);

    t.setIdentity();
    t.setOrigin( btVector3(45.0f, 50.0f, 45.0f) );
    r_room_add_static_object(ctx, room, "asset_dir/refrigerator_old_02_big.qb", t, 4.0f);


/*
    PolyVox::Region char_reg(PolyVox::Vector3DInt32(0, 0, 0), PolyVox::Vector3DInt32(100, 1, 100));
    PolyVox::RawVolume<voxel> volData(char_reg);

    r_font_build("asset_dir/fonts/alterebro-pixel-font.ttf", 0, 128, 16, volData, L"A");

    auto l_VolumeMesh = PolyVox::extractCubicMeshWithNormals(&volData, volData.getEnclosingRegion(), VoxelIsQuadNeeded(), false);
    auto decodedMesh = decodeMesh(l_VolumeMesh);

    testFontMesh = r_add_mesh(ctx, decodedMesh);
*/
}


/**
 * INTERFACES
 */
int r_init(int argc, char *argv[])
{
    if( g_bool_render_initialize )
    {
        // TODO: Exception
    }

    g_bool_render_initialize = true;

    if (SDL_Init(SDL_INIT_EVERYTHING) != 0)
    {
        std::cout << "SDL_Init Error: " << SDL_GetError() << std::endl;
        return 1;
    }

    g_Context.m_mouseRotLock = false;
    g_Context.m_mouseMoveLock = false;

#ifdef __EMSCRIPTEN__
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1 );
    SDL_SetVideoMode(g_Context.width, g_Context.height, 0, SDL_ANYFORMAT | SDL_OPENGL);
#else
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 24);
    g_Context.win = SDL_CreateWindow("SDL Cubes", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, g_Context.width, g_Context.height, SDL_WINDOW_SHOWN | SDL_WINDOW_OPENGL);
    g_Context.glcontext = SDL_GL_CreateContext(g_Context.win);

    if (g_Context.win == nullptr)
    {
        std::cout << "SDL_CreateWindow Error: " << SDL_GetError() << std::endl;
        return 1;
    }

#endif

    std::cout << "Start app" << std::endl;

    r_font_init();

    std::cout << "font library initialized" << std::endl;

    bt_init(g_Context.worldPhysic, vec3(0,-9.8f,0));

    std::cout << "physic library initialized" << std::endl;

    r_init_gl(g_Context);

    std::cout << "opengl library initialized" << std::endl;

    std::cout << "starting game loop" << std::endl;

    mainLoop();


#ifdef __EMSCRIPTEN__
    SDL_Quit();
#else
    SDL_Quit();
#endif

    return 0;
}


void r_draw_opengl_mesh_transform(Context& ctx, const mat4& model, const OpenGLMeshData& mesh, eShaderTypes shaderType, GLenum mode)
{
    mat4 modelView = ctx.cam.m_view * model;
    mat3 normal = glm::inverseTranspose(glm::mat3(modelView));
    mat4 modelViewProjection = ctx.cam.m_proj * modelView;

    r_use_shader(ctx, shaderType);

    glBindBuffer(GL_ARRAY_BUFFER, mesh.vertexBuffer);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);

    switch (shaderType)
    {
        case eShaderTypes::EST_VNC:
        {
            int floatByteSize = 4;
            int positionFloatCount = 3;
            int normalFloatCount = 3;
            int colorFloatCount = 3;
            int floatsPerVertex = positionFloatCount + normalFloatCount + colorFloatCount;
            int vertexFloatSizeInBytes = floatByteSize * floatsPerVertex;
            int byteOffset = 0;

            GLint vertexLocation = glGetAttribLocation(ctx.shaderProgram, "position");
        //    printf("eShaderTypes::EST_VNC: vertexLocation = %i\n", vertexLocation);
            glEnableVertexAttribArray(0);
            glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, vertexFloatSizeInBytes, (GLvoid*)(byteOffset));

            GLint normalLocation = glGetAttribLocation(ctx.shaderProgram, "normal");
        //    printf("eShaderTypes::EST_VNC: normalLocation = %i\n", normalLocation);
            glEnableVertexAttribArray(1);
            byteOffset = floatByteSize * positionFloatCount;
            glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, vertexFloatSizeInBytes, (GLvoid*)(byteOffset));

            GLint colorLocation = glGetAttribLocation(ctx.shaderProgram, "color");
        //    printf("eShaderTypes::EST_VNC: colorLocation = %i\n", colorLocation);
            glEnableVertexAttribArray(2);
            byteOffset = floatByteSize * (positionFloatCount + normalFloatCount);
            glVertexAttribPointer(2, 3, GL_FLOAT, GL_FALSE, vertexFloatSizeInBytes, (GLvoid*)(byteOffset));

            glUniformMatrix4fv(ctx.mvpLocation, 1, GL_FALSE,  glm::value_ptr(modelViewProjection));
            glUniformMatrix3fv(ctx.nLocation, 1, GL_FALSE,  glm::value_ptr(normal));
            glDrawElements(mode, mesh.noOfIndices, mesh.indexType, 0);
            break;
        }

        case eShaderTypes::EST_VC:
        {
            int floatByteSize = 4;
            int positionFloatCount = 3;
            int colorFloatCount = 3;
            int floatsPerVertex = positionFloatCount + colorFloatCount;
            int vertexFloatSizeInBytes = floatByteSize * floatsPerVertex;
            int byteOffset = 0;

            GLint vertexLocation = glGetAttribLocation(ctx.shaderProgram, "position");
      //      printf("eShaderTypes::EST_VC: vertexLocation = %i\n", vertexLocation);
            glEnableVertexAttribArray(0); // Attrib '0' is the vertex positions
            glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, vertexFloatSizeInBytes, (GLvoid*)(byteOffset));

            GLint colorLocation = glGetAttribLocation(ctx.shaderProgram, "color");
         //   printf("eShaderTypes::EST_VC: colorLocation = %i\n", colorLocation);
            glEnableVertexAttribArray(1); // Attrib '1' is the vertex normals.
            byteOffset = floatByteSize * positionFloatCount;
            glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, vertexFloatSizeInBytes, (GLvoid*)(byteOffset));

            glUniformMatrix4fv(ctx.mvpLocation, 1, GL_FALSE,  glm::value_ptr(modelViewProjection));
            glUniformMatrix3fv(ctx.nLocation, 1, GL_FALSE,  glm::value_ptr(normal));

            glDrawElements(mode, mesh.noOfIndices, mesh.indexType, 0);
            break;
        }
    }
}


int32_t buildProgram(int32_t shaderType, const string& shaderSrc)
{
    int32_t shader = glCreateShader(shaderType);
    const GLchar *shaderPtr = shaderSrc.c_str();
    int32_t shaderLen = shaderSrc.length();
    glShaderSource(shader, 1, & shaderPtr, &shaderLen);
    glCompileShader(shader);
    GLint status;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &status);

    if (status == 0)
    {
        GLint infologLength = 0;

        glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &infologLength);

        if (infologLength > 0)
        {
            char* infoLog = new char[infologLength];
            glGetShaderInfoLog(shader, infologLength, 0, infoLog);
            cout << "Compile error " << infoLog << endl;
            delete[] infoLog;
        }
    }

    return shader;
}

uint32_t r_build_shader(const string &vp, const string &fp)
{
    int32_t _vp = buildProgram(GL_VERTEX_SHADER, vp);
    int32_t _fp = buildProgram(GL_FRAGMENT_SHADER, fp);

    uint32_t shaderProgram = glCreateProgram();
    glAttachShader(shaderProgram, _vp);
    glAttachShader(shaderProgram, _fp);
    glLinkProgram(shaderProgram);

    GLint  linked;
    glGetProgramiv( shaderProgram, GL_LINK_STATUS, &linked );
    if ( !linked )
    {
        std::cerr << "Shader program failed to link" << std::endl;
        GLint  logSize;
        glGetProgramiv( shaderProgram, GL_INFO_LOG_LENGTH, &logSize);
        char* logMsg = new char[logSize];
        glGetProgramInfoLog( shaderProgram, logSize, NULL, logMsg );
        std::cerr << logMsg << std::endl;
        delete [] logMsg;
    }

    return shaderProgram;
}


void r_use_shader(Context &ctx, eShaderTypes type)
{
    ctx.shaderProgram = ctx.m_shaderPrograms[type];

    glUseProgram(ctx.shaderProgram);

    ctx.mvpLocation = glGetUniformLocation(ctx.shaderProgram, "mvp");
    ctx.nLocation = glGetUniformLocation(ctx.shaderProgram, "n");
}
