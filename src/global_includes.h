//
// Created by vugluskr on 11.03.16.
//

#ifndef HAPPYGAMER_GLOBAL_INCLUDES_H_H
#define HAPPYGAMER_GLOBAL_INCLUDES_H_H

#include <inttypes.h>

#include <stdio.h>
#include <math.h>

#ifdef __EMSCRIPTEN__
#   include <emscripten.h>
#   include <SDL/SDL.h>
#   include <SDL/SDL_image.h>
#   include <GLES2/gl2.h>
#else
#   include <SDL2/SDL.h>
#   include <SDL2/SDL_image.h>
#   include <GLES2/gl2.h>
#endif

#include <iostream>
#include <fstream>
#include <streambuf>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <iomanip>
using namespace std;

#include "PolyVox/CubicSurfaceExtractorWithNormals.h"
#include "PolyVox/Mesh.h"
#include "PolyVox/RawVolume.h"

#define GLM_FORCE_RADIANS
#include "glm/glm.hpp"
#include "glm/gtx/transform.hpp"
#include "glm/gtc/matrix_inverse.hpp"
#include "glm/gtc/type_ptr.hpp"
using namespace glm;


#ifdef __EMSCRIPTEN__
#include <LinearMath/btVector3.h>
#include "LinearMath/btAlignedObjectArray.h"
#include "btBulletDynamicsCommon.h"
#include "BulletDynamics/MLCPSolvers/btMLCPSolver.h"
#include "BulletDynamics/MLCPSolvers/btSolveProjectedGaussSeidel.h"
#else
#include "LinearMath/btVector3.h"
#include "LinearMath/btAlignedObjectArray.h"
#include "BulletDynamics/btBulletDynamicsCommon.h"
#include "BulletDynamics/MLCPSolvers/btMLCPSolver.h"
#include "BulletDynamics/MLCPSolvers/btSolveProjectedGaussSeidel.h"
#endif


#ifdef __EMSCRIPTEN__
// FreeType Headers
#include <ft2build.h>
#include <freetype.h>
#include <ftglyph.h>
#include <ftoutln.h>
#include <fttrigon.h>
#else
// FreeType Headers
#include <ft2build.h>
#include <freetype.h>
#include <ftglyph.h>
#include <ftoutln.h>
#include <fttrigon.h>
#endif


#include FT_FREETYPE_H

inline int next_p2 (int a )
{
    int rval=1;
    while(rval<a) rval<<=1;
    return rval;
}

enum eShaderTypes
{
    EST_VNC = 0,
    EST_VC  = 1,

    _EST_LENGTH
};

struct OpenGLMeshData
{
    GLuint noOfIndices;
    GLenum indexType;
    GLuint indexBuffer;
    GLuint vertexBuffer;
    GLuint vertexArrayObject;
    vec3 translation;
    float scale;
};


struct voxel
{

    voxel()
    {
        v[0] = -1;
        v[1] = -1;
        v[2] = -1;
    }

    float v[3];
};

bool operator==(const voxel& lhs, const voxel& rhs);
bool operator!=(const voxel& lhs, const voxel& rhs);

template <typename string_type> void read_file_content(const char* path, string_type& dst)
{
    std::ifstream t(path);

    t.seekg(0, std::ios::end);
    dst.reserve(t.tellg());
    t.seekg(0, std::ios::beg);

    dst.assign((std::istreambuf_iterator<typename string_type::value_type>(t)), std::istreambuf_iterator<typename string_type::value_type>());
}

//typedef read_file_content<std::string> read_file_content_string;
//typedef read_file_content<std::wstring> read_file_content_wstring;

#endif //HAPPYGAMER_GLOBAL_INCLUDES_H_H
