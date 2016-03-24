//
// Created by vugluskr on 18.03.16.
//

#include "bt_world.h"

// http://www.opengl-tutorial.org/ru/miscellaneous/clicking-on-objects/picking-with-a-physics-library/

void bt_init(WorldPhysic& world, const vec3& gravity)
{
    printf("bt_init\n");

    ///collision configuration contains default setup for memory, collision setup. Advanced users can create their own configuration.
    world.collisionConfiguration = new btDefaultCollisionConfiguration();

    ///use the default collision dispatcher. For parallel processing you can use a diffent dispatcher (see Extras/BulletMultiThreaded)
    world.dispatcher = new	btCollisionDispatcher(world.collisionConfiguration);

    ///btDbvtBroadphase is a good general purpose broadphase. You can also try out btAxis3Sweep.
    world.overlappingPairCache = new btDbvtBroadphase();

    ///the default constraint solver. For parallel processing you can use a different solver (see Extras/BulletMultiThreaded)
    world.solver = new btSequentialImpulseConstraintSolver;

    world.dynamicsWorld = new btDiscreteDynamicsWorld(world.dispatcher,world.overlappingPairCache,world.solver,world.collisionConfiguration);

    world.debugDraw.setDebugMode(btIDebugDraw::DBG_DrawWireframe);
    world.dynamicsWorld->setGravity(btVector3(gravity.x, gravity.y, gravity.z));
    world.dynamicsWorld->setDebugDrawer(&world.debugDraw);
}

btRigidBody* bt_add_collistion_shape_box(WorldPhysic& world, const btTransform& trans, const vec3& size, const float mass)
{
    printf("bt_add_collistion_shape_box\n");

    ///create a few basic rigid bodies
    btCollisionShape* groundShape = new btBoxShape(btVector3(size.x / 2.0f, size.y / 2.0f, size.z / 2.0f));

    world.collisionShapes.push_back(groundShape);

    //rigidbody is dynamic if and only if mass is non zero, otherwise static
    bool isDynamic = (mass != 0.f);

    btVector3 localInertia(0,0,0);
    if (isDynamic)
        groundShape->calculateLocalInertia(mass,localInertia);

    //using motionstate is optional, it provides interpolation capabilities, and only synchronizes 'active' objects
    btDefaultMotionState* myMotionState = new btDefaultMotionState(trans);
    btRigidBody::btRigidBodyConstructionInfo rbInfo(mass,myMotionState,groundShape,localInertia);
    btRigidBody* body = new btRigidBody(rbInfo);

    body->setUserIndex(world.rigidBodies.size());

    world.rigidBodies.push_back(body);

    //add the body to the dynamics world
    world.dynamicsWorld->addRigidBody(body);

    return body;
}

void bt_update(WorldPhysic& world, float dt)
{
    world.dynamicsWorld->stepSimulation(dt,10);
}

void ScreenPosToWorldRay(int mouseX, int mouseY,                   // Mouse position, in pixels, from bottom-left corner of the window
                                int screenWidth, int screenHeight,  // Window size, in pixels
                                glm::mat4 ViewMatrix,               // Camera position and orientation
                                glm::mat4 ProjectionMatrix,         // Camera parameters (ratio, field of view, near and far planes)
                                glm::vec3& out_origin,              // Ouput : Origin of the ray. /!\ Starts at the near plane, so if you want the ray to start at the camera's position instead, ignore this.
                                glm::vec3& out_direction)          // Ouput : Direction, in world space, of the ray that goes "through" the mouse.
{
    // The ray Start and End positions, in Normalized Device Coordinates (Have you read Tutorial 4 ?)
    glm::vec4 lRayStart_NDC(
            ((float)mouseX/(float)screenWidth  - 0.5f) * 2.0f, // [0,1024] -> [-1,1]
            ((float)mouseY/(float)screenHeight - 0.5f) * 2.0f, // [0, 768] -> [-1,1]
            -1.0, // The near plane maps to Z=-1 in Normalized Device Coordinates
            1.0f
    );
    glm::vec4 lRayEnd_NDC(
            ((float)mouseX/(float)screenWidth  - 0.5f) * 2.0f,
            ((float)mouseY/(float)screenHeight - 0.5f) * 2.0f,
            0.0,
            1.0f
    );


    // The Projection matrix goes from Camera Space to NDC.
    // So inverse(ProjectionMatrix) goes from NDC to Camera Space.
    glm::mat4 InverseProjectionMatrix = glm::inverse(ProjectionMatrix);

    // The View Matrix goes from World Space to Camera Space.
    // So inverse(ViewMatrix) goes from Camera Space to World Space.
    glm::mat4 InverseViewMatrix = glm::inverse(ViewMatrix);

    glm::vec4 lRayStart_camera = InverseProjectionMatrix * lRayStart_NDC;    lRayStart_camera/=lRayStart_camera.w;
    glm::vec4 lRayStart_world  = InverseViewMatrix       * lRayStart_camera; lRayStart_world /=lRayStart_world .w;
    glm::vec4 lRayEnd_camera   = InverseProjectionMatrix * lRayEnd_NDC;      lRayEnd_camera  /=lRayEnd_camera  .w;
    glm::vec4 lRayEnd_world    = InverseViewMatrix       * lRayEnd_camera;   lRayEnd_world   /=lRayEnd_world   .w;


    // Faster way (just one inverse)
    //glm::mat4 M = glm::inverse(ProjectionMatrix * ViewMatrix);
    //glm::vec4 lRayStart_world = M * lRayStart_NDC; lRayStart_world/=lRayStart_world.w;
    //glm::vec4 lRayEnd_world   = M * lRayEnd_NDC  ; lRayEnd_world  /=lRayEnd_world.w;


    glm::vec3 lRayDir_world(lRayEnd_world - lRayStart_world);
  //  lRayDir_world = glm::normalize(lRayDir_world);

    out_origin = glm::vec3(lRayStart_world);
    out_direction = glm::normalize(lRayDir_world);
}