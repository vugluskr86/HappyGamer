//
// Created by vugluskr on 18.03.16.
//

#include "r_mesh.h"

std::vector<Mesh> g_Meshs;

size_t r_load_mesh(Context& ctx, shared_ptr<QB_LoadingHandler> loadingHandler)
{
    Mesh mesh;

    for( auto layout : loadingHandler->layouts )
    {
        auto l_VolumeMesh = PolyVox::extractCubicMeshWithNormals(&layout->volData, layout->volData.getEnclosingRegion(), VoxelIsQuadNeeded(), false);
        auto decodedMesh = decodeMesh(l_VolumeMesh);

        mesh.layouts.push_back( std::make_pair<int, vec3>( r_add_mesh(ctx, decodedMesh), vec3(layout->posX, layout->posY, layout->posZ) )  );
    }

    mesh.aabb = loadingHandler->aabb;

    g_Meshs.push_back( mesh );

    return g_Meshs.size() - 1;
}

void r_draw_mesh_transform(Context& ctx, int mesh_id, btRigidBody* rigidBody)
{
    auto mesh = g_Meshs[mesh_id];

    btTransform trans;
    rigidBody->getMotionState()->getWorldTransform(trans);

    btScalar m[16];
    trans.getOpenGLMatrix(m);
    mat4 model = make_mat4(m) * glm::translate( -mesh.aabb.getCenter() );

    for(auto layout : mesh.layouts)
    {
        r_draw_opengl_mesh_transform(ctx, model * glm::translate( layout.second ), ctx.mesh_list[layout.first]);
    }
}

