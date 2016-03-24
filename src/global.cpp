//
// Created by vugluskr on 24.03.16.
//

#include "global_includes.h"

bool operator==(const voxel& lhs, const voxel& rhs)
{
    return lhs.v[0] == rhs.v[0] && lhs.v[1] == rhs.v[1] && lhs.v[2] == rhs.v[2];
}

bool operator!=(const voxel& lhs, const voxel& rhs)
{
    return lhs.v[0] != rhs.v[0] || lhs.v[1] != rhs.v[1] || lhs.v[2] != rhs.v[2];
}