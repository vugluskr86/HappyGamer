//
// Created by vugluskr on 11.03.16.
//

#ifndef HAPPYGAMER_R_QB_LOADER_H
#define HAPPYGAMER_R_QB_LOADER_H

#include "global_includes.h"
#include "AABB.h"

#define MAX_NAME 256


class VoxelIsQuadNeeded
{
public:
    bool operator()(voxel back, voxel front, voxel& materialToUse)
    {

        if( ( back.v[0] >= 0 && back.v[1] >= 0 && back.v[2] >= 0 ) &&
            ( front.v[0] < 0 || front.v[1] < 0 || front.v[2] < 0 ) )
        {
            materialToUse.v[0] = back.v[0];
            materialToUse.v[1] = back.v[1];
            materialToUse.v[2] = back.v[2];
            return true;
        }
        else
        {
            return false;
        }
    }
};

struct OB_Layout
{
    uint32_t sizeX, sizeY, sizeZ;
    int32_t posX, posY, posZ;
    PolyVox::RawVolume<voxel> volData;

    CPM_GLM_AABB_NS::AABB aabb;

    OB_Layout() = delete;
    OB_Layout(OB_Layout const &) = delete;
    OB_Layout(OB_Layout &&) = delete;
    OB_Layout & operator=(OB_Layout const &) = delete;
    OB_Layout && operator=(OB_Layout &&) = delete;
    ~OB_Layout() = default;

    OB_Layout(PolyVox::Region& reg) :
            volData(reg)
    {

    }
};

struct QB_LoadingHeader
{
    uint32_t version;
    uint32_t colorFormat;
    uint32_t zAxisOrientation;
    uint32_t compressed;
    uint32_t visibilityMaskEncoded;
    uint32_t numMatrices;

    QB_LoadingHeader()
            : version(0),
              colorFormat(0),
              zAxisOrientation(0),
              compressed(0),
              visibilityMaskEncoded(0),
              numMatrices(0)
    {

    }
};

struct QB_LoadingHandler
{
    QB_LoadingHeader header;
    std::vector< OB_Layout* > layouts;
    CPM_GLM_AABB_NS::AABB aabb;

    QB_LoadingHandler()
    {

    }
};

extern std::shared_ptr<QB_LoadingHandler> load_qb(const char* file);

#endif //HAPPYGAMER_R_QB_LOADER_H
