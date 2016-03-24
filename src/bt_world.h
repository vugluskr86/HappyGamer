//
// Created by vugluskr on 18.03.16.
//

#ifndef HAPPYGAMER_BT_WORLD_H
#define HAPPYGAMER_BT_WORLD_H

#include "global_includes.h"
#include "r_debug.h"


struct WorldPhysic {
    btDefaultCollisionConfiguration* collisionConfiguration;
    btCollisionDispatcher* dispatcher;
    btBroadphaseInterface* overlappingPairCache;
    btSequentialImpulseConstraintSolver* solver;
    btDiscreteDynamicsWorld* dynamicsWorld;

    btAlignedObjectArray<btCollisionShape*> collisionShapes;
    PhysicsDebugDraw debugDraw;

    std::vector<btRigidBody*> rigidBodies;
};


extern void bt_init(WorldPhysic& world, const vec3& gravity);
extern btRigidBody* bt_add_collistion_shape_box(WorldPhysic& world, const btTransform& trans, const vec3& size, const float mass = 0.f);
extern void bt_update(WorldPhysic& world, float dt);
extern void ScreenPosToWorldRay(int mouseX, int mouseY,                   // Mouse position, in pixels, from bottom-left corner of the window
                                      int screenWidth, int screenHeight,  // Window size, in pixels
                                      glm::mat4 ViewMatrix,               // Camera position and orientation
                                      glm::mat4 ProjectionMatrix,         // Camera parameters (ratio, field of view, near and far planes)
                                      glm::vec3& out_origin,              // Ouput : Origin of the ray. /!\ Starts at the near plane, so if you want the ray to start at the camera's position instead, ignore this.
                                      glm::vec3& out_direction);          // Ouput : Direction, in world space, of the ray that goes "through" the mouse.

#endif //HAPPYGAMER_BT_WORLD_H
