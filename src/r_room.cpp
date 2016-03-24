//
// Created by vugluskr on 18.03.16.
//

#include "r_room.h"
#include "r_common.h"

void r_load_room(const char* path, Room& room)
{

}

void r_room_save(const char* path, Room& room)
{

}

size_t r_room_add_mesh(Context& ctx, Room& room, shared_ptr<QB_LoadingHandler> loadingHandler, btRigidBody* collisionObject)
{
    size_t mesh_id = r_load_mesh(ctx, loadingHandler);

    room.objects.push_back( std::pair<int, btRigidBody*>(mesh_id, collisionObject) );

    return room.objects.size() - 1;
}

void r_room_remove_mesh(Room& room, int object_id)
{

}

void r_room_translate_mesh(Room& room, int object_id, const Transform& t)
{

}

void r_room_render(Context& ctx, const Room& room)
{
    for(auto object : room.objects)
    {
        r_draw_mesh_transform(ctx, object.first, object.second);
    }
}

const char* wall_pattern_2_type(eRoomWallPatternType pattern)
{
    switch (pattern)
    {
        case eRoomWallPatternType::DOOR:
        {
            return "_door";
        }
        case eRoomWallPatternType::WINDOW:
        {
            return "_window";
        }
        default:
        case eRoomWallPatternType::SIMPLE:
        {
            return "";
        }
    }
}

float side2Degress(eRoomGrowthSide side_growth)
{
    switch (side_growth)
    {
        case eRoomGrowthSide::SOUTH: { return 0.0f; }
        case eRoomGrowthSide::NORTH: { return 180.0f; }
        case eRoomGrowthSide::EAST: { return 90.0f; }
        case eRoomGrowthSide::WEST: { return 270.0f; }
    }

    return 0.0f;
}

float side2Sign(eRoomGrowthSide side_growth)
{
    switch (side_growth)
    {
        case eRoomGrowthSide::SOUTH: { return 1.0f; }
        case eRoomGrowthSide::NORTH: { return -1.0f; }
        case eRoomGrowthSide::EAST: { return 1.0f; }
        case eRoomGrowthSide::WEST: { return -1.0f; }
    }

    return 0.0f;
}

void r_room_add_wall(Context& ctx, Room& room, const char* pattern_name,
                     const std::list<eRoomWallPatternType>& palette,
                     eRoomGrowthSide side_growth, float growth_size, vec3 shift)
{
    float dx = 0;
    float dx_side = side2Sign(side_growth);

    btTransform t;

    for( auto wall_pattern : palette )
    {
        if( wall_pattern !=  eRoomWallPatternType::EMPTY )
        {
            char path[512] = {};
            sprintf(&path[0], "asset_dir/%s%s.qb", pattern_name, wall_pattern_2_type(wall_pattern));

            const float side_rot = radians(side2Degress(side_growth));
            t.setIdentity();

            vec3 position = shift;

            switch (side_growth)
            {
                case eRoomGrowthSide::SOUTH:
                {
                    position += vec3(dx, 0.0f, 0.0f);
                    break;
                }
                case eRoomGrowthSide::NORTH:
                {
                    position += vec3(dx, 0.0f, 0.0f);
                    break;
                }
                case eRoomGrowthSide::EAST:
                {
                    position += vec3(0.0f, 0.0f, dx);
                    break;
                }
                case eRoomGrowthSide::WEST:
                {
                    position += vec3(0.0f, 0.0f, dx);
                    break;
                }
            }

            t.setOrigin( btVector3(position.x, position.y, position.z) );

            btQuaternion rot;
            rot.setRotation(btVector3(0.0f, 1.0f, 0.0f), side_rot);
            t.setRotation(rot);

            r_room_add_static_object(ctx, room, path, t);
        }

        dx += (growth_size * dx_side);
    }
}

void r_room_add_floor(Context& ctx, Room& room, const char* pattern_name, vec2 size, vec2 tileSize, vec3 shift)
{
    float dx = 0.0f;
    float dz = 0.0f;

    btTransform t;

    char path[512] = {};
    sprintf(&path[0], "asset_dir/%s.qb", pattern_name);

    for(int x = 0; x < size.x; x++)
    {
        for(int z = 0; z < size.y; z++)
        {
            dx = x * tileSize.x;
            dz = z * tileSize.y;

            t.setIdentity();
            t.setOrigin( btVector3(shift.x, shift.y, shift.z) + btVector3(dx, 0.0f, dz) );

            r_room_add_static_object(ctx, room, path, t);
        }
    }
}

void r_room_add_static_object(Context& ctx, Room& room, const char* path, btTransform transform, const float mass)
{
    shared_ptr<QB_LoadingHandler> loadingHandler = load_qb(path);
    vec3 diagonal = loadingHandler->aabb.getMax() - loadingHandler->aabb.getMin();
    btRigidBody* body = bt_add_collistion_shape_box(ctx.worldPhysic, transform, diagonal, mass);
    r_room_add_mesh(ctx, room, loadingHandler, body);
}