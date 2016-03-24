//
// Created by vugluskr on 18.03.16.
//

#ifndef HAPPYGAMER_R_ROOM_H_H
#define HAPPYGAMER_R_ROOM_H_H

#include "global_includes.h"
#include "r_mesh.h"
#include "bt_world.h"

//
struct RoomObjectHandler
{
    btRigidBody* body;
};

struct Room
{
    std::vector< std::pair<int, btRigidBody*> > objects;
};

enum eRoomWallPatternType
{
    EMPTY = 0,
    SIMPLE = 1,
    DOOR = 2,
    WINDOW = 3
};

enum eRoomGrowthSide
{
    EAST = 0,
    WEST = 1,
    NORTH = 2,
    SOUTH = 3
};

extern void r_room_load(const char* path, Room& room);
extern void r_room_save(const char* path, Room& room);

extern size_t  r_room_add_mesh(Context& ctx, Room& room, shared_ptr<QB_LoadingHandler> loadingHandler, btRigidBody* collisionObject);
extern void r_room_add_wall(Context& ctx, Room& room, const char* pattern_name, const std::list<eRoomWallPatternType>& palette, eRoomGrowthSide side_growth, float growth_size, vec3 shift);
extern void r_room_add_floor(Context& ctx, Room& room, const char* pattern_name, vec2 size, vec2 tileSize, vec3 shift);
extern void r_room_add_static_object(Context& ctx, Room& room, const char* pattern_name, btTransform transform, const float mass = 0.f);
extern void r_room_render(Context& ctx, const Room& room);

#endif //HAPPYGAMER_R_ROOM_H_H
