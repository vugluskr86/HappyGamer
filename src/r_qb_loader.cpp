//
// Created by vugluskr on 11.03.16.
//

#include "r_qb_loader.h"
#include <stdio.h>

std::map<string, std::shared_ptr<QB_LoadingHandler> > g_Handlesrs;
typedef std::map<string, std::shared_ptr<QB_LoadingHandler> >::iterator g_Handlesrs_iterator;

inline void endian_swap(unsigned int& x)
{
    x = (x>>24) |
        ((x<<8) & 0x00FF0000) |
        ((x>>8) & 0x0000FF00) |
        (x<<24);
}

/* read a 32 bit little-endian integer */
void read_u8(FILE *in, uint8_t *p)
{
    fread(p, 1, 1, in);
    return;
}

void read_u32(FILE *in, uint32_t *p)
{
    unsigned char q[4];
    fread(q, 1, 4, in);
    *p = q[0] | q[1] << 8 | q[2] << 16 | q[3] << 24;

    //endian_swap(*p);
    return;
}

void read_i32(FILE *in, int32_t *p)
{
    char q[4];
    fread(q, 1, 4, in);
    *p = q[0] | q[1] << 8 | q[2] << 16 | q[3] << 24;

    //endian_swap(*p);
    return;
}

std::shared_ptr<QB_LoadingHandler> load_qb(const char* file)
{
    g_Handlesrs_iterator it = g_Handlesrs.find(file);

    if( it != g_Handlesrs.end() )
    {
        return it->second;
    }

    std::cout << "load_qb " << file << std::endl;

    FILE* _file = fopen(file, "rb");

    if (!_file)
    {
        printf("cannot open file\n");
        throw;
    }

    std::shared_ptr<QB_LoadingHandler> loader( new QB_LoadingHandler() );

    read_u32(_file, &loader->header.version);
    read_u32(_file, &loader->header.colorFormat);
    read_u32(_file, &loader->header.zAxisOrientation);
    read_u32(_file, &loader->header.compressed);
    read_u32(_file, &loader->header.visibilityMaskEncoded);
    read_u32(_file, &loader->header.numMatrices);

    std::cout << "version " << std::dec << loader->header.version << std::endl;
    std::cout << "colorFormat " << std::dec << loader->header.colorFormat << std::endl;
    std::cout << "zAxisOrientation " << std::dec << loader->header.zAxisOrientation << std::endl;
    std::cout << "compressed " << std::dec << loader->header.compressed << std::endl;
    std::cout << "visibilityMaskEncoded " << std::dec << loader->header.visibilityMaskEncoded << std::endl;
    std::cout << "numMatrices " << std::dec << loader->header.numMatrices << std::endl;

    char name[MAX_NAME];
    uint8_t nameLength = 0;

    uint32_t sizeX = 0;
    uint32_t sizeY = 0;
    uint32_t sizeZ = 0;

    int32_t posX = 0;
    int32_t posY = 0;
    int32_t posZ = 0;

    if( loader->header.numMatrices == 0 )
    {
        fclose(_file);
        throw;
    }

    for (uint32_t i = 0; i < loader->header.numMatrices; i++)
    {
        read_u8(_file, &nameLength);
        printf("nameLength: %i\n", nameLength);
        fread(&name[0], nameLength, sizeof(uint8_t), _file);
        name[nameLength] = '\0';

        printf("name: %s\n", name);

        read_u32(_file, &sizeX);
        read_u32(_file, &sizeY);
        read_u32(_file, &sizeZ);

        printf("size: %i %i %i\n", sizeX, sizeY, sizeZ);

        read_i32(_file, &posX);
        read_i32(_file, &posY);
        read_i32(_file, &posZ);

        printf("pos: %i %i %i\n", posX, posY, posZ);

        uint32_t voxelData = 0;

        PolyVox::Region reg(PolyVox::Vector3DInt32(0, 0, 0), PolyVox::Vector3DInt32(sizeX, sizeY, sizeZ));

        OB_Layout* layout = new OB_Layout(reg);

        layout->sizeX = sizeX; layout->sizeY = sizeY; layout->sizeZ = sizeZ;
        layout->posX = posX; layout->posY = posY; layout->posZ = posZ;
        layout->aabb =  CPM_GLM_AABB_NS::AABB();

        CPM_GLM_AABB_NS::AABB voxelAABB;

        for (uint32_t z = 0; z < layout->sizeZ; z++)
        {
            for (uint32_t y = 0; y < layout->sizeY; y++)
            {
                for (uint32_t x = 0; x < layout->sizeX; x++)
                {
                    read_u32(_file, &voxelData);

                    if( voxelData > 0 )
                    {
                        voxel v;

                        v.v[0] = ((voxelData >> 0) & 255) / 255.0f;
                        v.v[1] = ((voxelData >> 8) & 255) / 255.0f;
                        v.v[2] = ((voxelData >> 16)  & 255) / 255.0f;

                        layout->volData.setVoxel(x, y, z, v);

                        voxelAABB = CPM_GLM_AABB_NS::AABB(vec3(x, y, z), 0.5f);

                        printf("v: %f %f %f %f %f %f\n",
                               voxelAABB.getMin().x, voxelAABB.getMin().y, voxelAABB.getMin().z,
                               voxelAABB.getMax().x, voxelAABB.getMax().y, voxelAABB.getMax().z
                        );

                        layout->aabb.extend(voxelAABB);
                    }
                }
            }
        }

        layout->aabb.translate(vec3(posX, posY, posZ));
        loader->layouts.push_back(layout);
        loader->aabb.extend(layout->aabb);
    }

    printf("loader->aabb: %f %f %f %f %f %f\n",
           loader->aabb.getMin().x, loader->aabb.getMin().y, loader->aabb.getMin().z,
           loader->aabb.getMax().x, loader->aabb.getMax().y, loader->aabb.getMax().z
    );

    fclose(_file);

    g_Handlesrs[file] = std::move(loader);

    return g_Handlesrs[file];
}