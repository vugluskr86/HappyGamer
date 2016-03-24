//
// Created by vugluskr on 18.03.16.
//

#ifndef HAPPYGAMER_R_MESH_H
#define HAPPYGAMER_R_MESH_H

#include "r_common.h"
#include "r_qb_loader.h"

struct Mesh {
    std::vector< std::pair<int, vec3> > layouts;
    CPM_GLM_AABB_NS::AABB aabb;
};

extern size_t r_load_mesh(Context& ctx, shared_ptr<QB_LoadingHandler> loadingHandler);
extern void r_draw_mesh_transform(Context& ctx, int mesh_id, btRigidBody* parent_transform);

#endif //HAPPYGAMER_R_MESH_H
