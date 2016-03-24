//
// Created by vugluskr on 11.03.16.
//

#ifndef HAPPYGAMER_R_COMMON_H
#define HAPPYGAMER_R_COMMON_H

#define GL_GLEXT_PROTOTYPES

#include "global_includes.h"
#include "r_cam_arcball.h"
#include "r_qb_loader.h"
#include "bt_world.h"

struct Context
{
    int width, height;
    float clear_r, clear_g, clear_b, clear_a;

    r_cam_arcball cam;

    vec2 m_mouseLastPos;
    vec2 m_mouseLastPosMove;
    bool m_mouseRotLock;
    bool m_mouseMoveLock;

    mat4 normal;
    SDL_Window *win;

    Context():
        clear_r(.0f),
        clear_g(.0f),
        clear_b(.3f),
        clear_a(1.f),
        width(800),
        height(600) {}

    int mvpLocation;
    int nLocation;

    uint32_t m_shaderPrograms[_EST_LENGTH];

    uint32_t shaderProgram;

    std::vector<OpenGLMeshData> mesh_list;
    WorldPhysic worldPhysic;

    SDL_GLContext glcontext;
};

struct Transform {
    vec3 position;
    vec3 scale;
    mat4 rotate;

    inline mat4 calc_model() const
    {
        mat4 model = glm::translate( position );
        model = model * rotate;
        model = model * glm::scale( scale );
        return model;
    }
};


extern int r_init(int argc, char *argv[]);

template <typename MeshType> size_t r_add_mesh(Context& ctx, const MeshType& surfaceMesh, const PolyVox::Vector3DInt32& translation = PolyVox::Vector3DInt32(0, 0, 0), float scale = 1.0)
{
    // This struct holds the OpenGL properties (buffer handles, etc) which will be used
    // to render our mesh. We copy the data from the PolyVox mesh into this structure.
    OpenGLMeshData meshData;

    // The GL_ARRAY_BUFFER will contain the list of vertex positions
    glGenBuffers(1, &(meshData.vertexBuffer));
    glBindBuffer(GL_ARRAY_BUFFER, meshData.vertexBuffer);
    glBufferData(GL_ARRAY_BUFFER, surfaceMesh.getNoOfVertices() * sizeof(typename MeshType::VertexType), surfaceMesh.getRawVertexData(), GL_STATIC_DRAW);

  //  printf("glGenBuffers%i\n", meshData.vertexBuffer);

    // and GL_ELEMENT_ARRAY_BUFFER will contain the indices
    glGenBuffers(1, &(meshData.indexBuffer));
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, meshData.indexBuffer);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, surfaceMesh.getNoOfIndices() * sizeof(typename MeshType::IndexType), surfaceMesh.getRawIndexData(), GL_STATIC_DRAW);

    // A few additional properties can be copied across for use during rendering.
    meshData.noOfIndices = surfaceMesh.getNoOfIndices();
    meshData.translation = vec3(translation.getX(), translation.getY(), translation.getZ());
    meshData.scale = scale;

    // Set 16 or 32-bit index buffer size.
    meshData.indexType = sizeof(typename MeshType::IndexType) == 2 ? GL_UNSIGNED_SHORT : GL_UNSIGNED_INT;

    // Now add the mesh to the list of meshes to render.
    ctx.mesh_list.push_back(meshData);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);

    return ctx.mesh_list.size() - 1;
}

extern void r_draw_opengl_mesh_transform(Context& ctx, const mat4& model, const OpenGLMeshData& mesh, eShaderTypes shaderType = eShaderTypes::EST_VNC, GLenum mode = GL_TRIANGLES);

extern uint32_t r_build_shader(const string &vp, const string &fp);
extern void r_use_shader(Context &ctx, eShaderTypes type);

//extern user

#endif //HAPPYGAMER_R_COMMON_H
