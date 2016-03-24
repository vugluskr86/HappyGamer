/*******************************************************************************
* The MIT License (MIT)
*
* Copyright (c) 2015 David Williams and Matthew Williams
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*******************************************************************************/

#include "Impl/Timer.h"
#include "Vector.h"
#include "CubicSurfaceExtractorWithNormals.h"

namespace PolyVox
{
    // This constant defines the maximum number of quads which can share a vertex in a cubic style mesh.
    //
    // We try to avoid duplicate vertices by checking whether a vertex has already been added at a given position.
    // However, it is possible that vertices have the same position but different materials. In this case, the
    // vertices are not true duplicates and both must be added to the mesh. As far as I can tell, it is possible to have
    // at most eight vertices with the same position but different materials. For example, this worst-case scenario
    // happens when we have a 2x2x2 group of voxels, all with different materials and some/all partially transparent.
    // The vertex position at the center of this group is then going to be used by all eight voxels all with different
    // materials.
    const uint32_t MaxVerticesPerPosition = 8;

    ////////////////////////////////////////////////////////////////////////////////
    // Data structures
    ////////////////////////////////////////////////////////////////////////////////

    enum FaceNames
    {
        PositiveX,
        PositiveY,
        PositiveZ,
        NegativeX,
        NegativeY,
        NegativeZ,
        NoOfFaces
    };

    const Vector3DFloat PositiveX_Normal(-1.0f, 0.0f, 0.0f);
    const Vector3DFloat NegativeX_Normal(1.0f, 0.0f, 0.0f);
    const Vector3DFloat PositiveY_Normal(0.0f, -1.0f, 0.0f);
    const Vector3DFloat NegativeY_Normal(0.0f, 1.0f, 0.0f);
    const Vector3DFloat PositiveZ_Normal(0.0f, 0.0f, -1.0f);
    const Vector3DFloat NegativeZ_Normal(0.0f, 0.0f, 1.0f);

    struct Quad
    {
        Quad(uint32_t v0, uint32_t v1, uint32_t v2, uint32_t v3)
        {
            vertices[0] = v0;
            vertices[1] = v1;
            vertices[2] = v2;
            vertices[3] = v3;
        }

        uint32_t vertices[4];
    };

    template<typename VolumeType>
    struct IndexAndMaterial
    {
        int32_t iIndex;
        typename VolumeType::VoxelType uMaterial;
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Vertex encoding/decoding
    ////////////////////////////////////////////////////////////////////////////////

    inline Vector3DFloat decodePosition(const Vector3DUint8& encodedPosition)
    {
        Vector3DFloat result(encodedPosition.getX(), encodedPosition.getY(), encodedPosition.getZ());
        result -= 0.5f; // Apply the required offset
        return result;
    }

    template<typename DataType>
    Vertex<DataType> decodeVertex(const CubicNormalsVertex<DataType>& cubicVertex)
    {
        Vertex<DataType> result;
        result.position = decodePosition(cubicVertex.encodedPosition);

        switch (cubicVertex.face)
        {
            case FaceNames::PositiveX:
            {
                result.normal = PositiveX_Normal;
                break;
            }
            case FaceNames::NegativeX:
            {
                result.normal = NegativeX_Normal;
                break;
            }
            case FaceNames::PositiveY:
            {
                result.normal = PositiveY_Normal;
                break;
            }
            case FaceNames::NegativeY:
            {
                result.normal = NegativeY_Normal;
                break;
            }
            case FaceNames::PositiveZ:
            {
                result.normal = PositiveZ_Normal;
                break;
            }
            case FaceNames::NegativeZ:
            {
                result.normal = NegativeZ_Normal;
                break;
            }
            default:
            {
                POLYVOX_THROW(std::runtime_error, "Undefined face");
            }
        }

        result.data = cubicVertex.data; // Data is not encoded
        return result;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Surface extraction
    ////////////////////////////////////////////////////////////////////////////////

    template<typename MeshType>
    bool mergeQuads(Quad& q1, Quad& q2, MeshType* m_meshCurrent)
    {
        //All four vertices of a given quad have the same data,
        //so just check that the first pair of vertices match.
        if (m_meshCurrent->getVertex(q1.vertices[0]).data == m_meshCurrent->getVertex(q2.vertices[0]).data)
        {
            //Now check whether quad 2 is adjacent to quad one by comparing vertices.
            //Adjacent quads must share two vertices, and the second quad could be to the
            //top, bottom, left, of right of the first one. This gives four combinations to test.
            if ((q1.vertices[0] == q2.vertices[1]) && ((q1.vertices[3] == q2.vertices[2])))
            {
                q1.vertices[0] = q2.vertices[0];
                q1.vertices[3] = q2.vertices[3];
                return true;
            }
            else if ((q1.vertices[3] == q2.vertices[0]) && ((q1.vertices[2] == q2.vertices[1])))
            {
                q1.vertices[3] = q2.vertices[3];
                q1.vertices[2] = q2.vertices[2];
                return true;
            }
            else if ((q1.vertices[1] == q2.vertices[0]) && ((q1.vertices[2] == q2.vertices[3])))
            {
                q1.vertices[1] = q2.vertices[1];
                q1.vertices[2] = q2.vertices[2];
                return true;
            }
            else if ((q1.vertices[0] == q2.vertices[3]) && ((q1.vertices[1] == q2.vertices[2])))
            {
                q1.vertices[0] = q2.vertices[0];
                q1.vertices[1] = q2.vertices[1];
                return true;
            }
        }

        //Quads cannot be merged.
        return false;
    }

    template<typename MeshType>
    bool performQuadMerging(std::list<Quad>& quads, MeshType* m_meshCurrent)
    {
        bool bDidMerge = false;
        for (typename std::list<Quad>::iterator outerIter = quads.begin(); outerIter != quads.end(); outerIter++)
        {
            typename std::list<Quad>::iterator innerIter = outerIter;
            innerIter++;
            while (innerIter != quads.end())
            {
                Quad& q1 = *outerIter;
                Quad& q2 = *innerIter;

                bool result = mergeQuads(q1, q2, m_meshCurrent);

                if (result)
                {
                    bDidMerge = true;
                    innerIter = quads.erase(innerIter);
                }
                else
                {
                    innerIter++;
                }
            }
        }

        return bDidMerge;
    }


    /// The CubicSurfaceExtractor creates a mesh in which each voxel appears to be rendered as a cube
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// Introduction
    /// ------------
    /// Games such as Minecraft and Voxatron have a unique graphical style in which each voxel in the world appears to be rendered as a single cube. Actually rendering a cube for each voxel would be very expensive, but in practice the only faces which need to be drawn are those which lie on the boundary between solid and empty voxels. The CubicSurfaceExtractor can be used to create such a mesh from PolyVox volume data. As an example, images from Minecraft and Voxatron are shown below:
    ///
    /// \image html MinecraftAndVoxatron.jpg
    ///
    /// Before we get into the specifics of the CubicSurfaceExtractor, it is useful to understand the principles which apply to *all* PolyVox surface extractors and which are described in the Surface Extraction document (ADD LINK). From here on, it is assumed that you are familier with PolyVox regions and how they are used to limit surface extraction to a particular part of the volume. The principles of allowing dynamic terrain are also common to all surface extractors and are described here (ADD LINK).
    ///
    /// Basic Operation
    /// ---------------
    /// At its core, the CubicSurfaceExtractor works by by looking at pairs of adjacent voxels and determining whether a quad should be placed between then. The most simple situation to imagine is a binary volume where every voxel is either solid or empty. In this case a quad should be generated whenever a solid voxel is next to an empty voxel as this represents part of the surface of the solid object. There is no need to generate a quad between two solid voxels (this quad would never be seen as it is inside the object) and there is no need to generate a quad between two empty voxels (there is no object here). PolyVox allows the principle to be extended far beyond such simple binary volumes but they provide a useful starting point for understanding how the algorithm works.
    ///
    /// As an example, lets consider the part of a volume shown below. We are going to explain the principles in only two dimensions as this makes it much simpler to illustrate, so you will need to mentally extend the process into the third dimension. Hopefully you will find this intuitive. The diagram below shows a small part of a larger volume (as indicated by the voxel coordinates on the axes) which contains only solid and empty voxels represented by solid and hollow circles respectively. The region on which we are running the surface extractor is marked in pink, and for the purpose of this example it corresponds to the whole of the diagram.
    ///
    /// \image html CubicSurfaceExtractor1.png
    ///
    /// The output of the surface extractor is the mesh marked in red. As you can see, this forms a closed object which corrsponds to the shape of the underlying voxel data. We won't describe the rendering of such meshes here - for details of this please see (SOME LINK HERE).
    ///
    /// Working with Regions
    /// --------------------
    /// So far the behaviour is easy to understand, but let's look at what happens when the extraction is limited to a particular region of the volume. The figure below shows the same data set as the previous figure, but the extraction region (still marked in pink) has been limited to 13 to 16 in x and 47 to 51 in y:
    ///
    /// \image html CubicSurfaceExtractor2.png
    ///
    /// As you can see, the extractor continues to generate a number of quads as indicated by the solid red lines. However, you can also see that the shape is no longer closed. This is because the solid voxels actually extend outside the region which is being processed, and so the extractor does not encounter a boundary between solid and empty voxels. Although this may initially appear problematic, the hole in the mesh does not actually matter because it will be hidden by the mesh corresponding to the region adjacent to it (see next diagram).
    ///
    /// More interestingly, the diagram also contains a couple of dotted red lines lying on the bottom and right hand side of the extracted region. These are present to illustrate a common point of confusion, which is that *no quads are generated at this position even though it is a boundary between solid and empty voxels*. This is indeed somewhat counter intuitive but there is a rational reasaoning behind it.
    /// If you consider the dashed line on the righthand side of the extracted region, then it is clear that this lies on a boundary between solid and empty voxels and so we do need to create quads here. But what is not so clear is whether these quads should be assigned to the mesh which corresponds to the region in pink, or whether they should be assigned to the region to the right of it which is marked in blue in the diagram below:
    ///
    /// \image html CubicSurfaceExtractor3.png
    ///
    /// We could choose to add the quads to *both* regions, but this can cause confusion when one of the region is modified (causing the face to disappear or a new one to be created) as *both* regions need to have their mesh regenerated to correctly represent the new state of the volume data. Such pairs of coplanar quads can also cause problems with physics engines, and may prevent transparent voxels from rendering correctly. Therefore we choose to instead only add the quad to one of the the regions and we always choose the one with the greater coordinate value in the direction in which they differ. In the above example the regions differ by the 'x' component of their position, and so the quad is added to the region with the greater 'x' value (the one marked in blue).
    ///
    /// **Note:** *This behaviour has changed recently (September 2012). Earlier versions of PolyVox tried to be smart about this problem by looking beyond the region which was being processed, but this complicated the code and didn't work very well. Ultimatly we decided to simply stick with the convention outlined above.*
    ///
    /// One of the practical implications of this is that when you modify a voxel *you may have to re-extract the mesh for regions other than region which actually contains the voxel you modified.* This happens when the voxel lies on the upper x,y or z face of a region. Assuming that you have some management code which can mark a region as needing re-extraction when a voxel changes, you should probably extend this to mark the regions of neighbouring voxels as invalid (this will have no effect when the voxel is well within a region, but will mark the neighbouring region as needing an update if the voxel lies on a region face).
    ///
    /// Another scenario which sometimes results in confusion is when you wish to extract a region which corresponds to the whole volume, partcularly when solid voxels extend right to the edge of the volume.
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    template<typename VolumeType, typename IsQuadNeeded>
    Mesh<CubicNormalsVertex<typename VolumeType::VoxelType> > extractCubicMeshWithNormals(VolumeType* volData, Region region, IsQuadNeeded isQuadNeeded, bool bMergeQuads)
    {
        Mesh< CubicNormalsVertex<typename VolumeType::VoxelType> > result;
        extractCubicMeshCustomWithNormals(volData, region, &result, isQuadNeeded, bMergeQuads);
        return result;
    }

    /// This version of the function performs the extraction into a user-provided mesh rather than allocating a mesh automatically.
    /// There are a few reasons why this might be useful to more advanced users:
    ///
    ///   1. It leaves the user in control of memory allocation and would allow them to implement e.g. a mesh pooling system.
    ///   2. The user-provided mesh could have a different index type (e.g. 16-bit indices) to reduce memory usage.
    ///   3. The user could provide a custom mesh class, e.g a thin wrapper around an openGL VBO to allow direct writing into this structure.
    ///
    /// We don't provide a default MeshType here. If the user doesn't want to provide a MeshType then it probably makes
    /// more sense to use the other variant of this function where the mesh is a return value rather than a parameter.
    ///
    /// Note: This function is called 'extractCubicMeshCustom' rather than 'extractCubicMesh' to avoid ambiguity when only three parameters
    /// are provided (would the third parameter be a controller or a mesh?). It seems this can be fixed by using enable_if/static_assert to emulate concepts,
    /// but this is relatively complex and I haven't done it yet. Could always add it later as another overload.
    template<typename VolumeType, typename MeshType, typename IsQuadNeeded>
    void extractCubicMeshCustomWithNormals(VolumeType* volData, Region region, MeshType* result, IsQuadNeeded isQuadNeeded, bool bMergeQuads)
    {
        // This extractor has a limit as to how large the extracted region can be, because the vertex positions are encoded with a single byte per component.
        int32_t maxReionDimensionInVoxels = 255;
        POLYVOX_THROW_IF(region.getWidthInVoxels() > maxReionDimensionInVoxels, std::invalid_argument, "Requested extraction region exceeds maximum dimensions");
        POLYVOX_THROW_IF(region.getHeightInVoxels() > maxReionDimensionInVoxels, std::invalid_argument, "Requested extraction region exceeds maximum dimensions");
        POLYVOX_THROW_IF(region.getDepthInVoxels() > maxReionDimensionInVoxels, std::invalid_argument, "Requested extraction region exceeds maximum dimensions");

        Timer timer;
        result->clear();

        //During extraction we create a number of different lists of quads. All the
        //quads in a given list are in the same plane and facing in the same direction.
        std::vector< std::list<Quad> > m_vecQuads[NoOfFaces];

        m_vecQuads[NegativeX].resize(region.getUpperX() - region.getLowerX() + 2);
        m_vecQuads[PositiveX].resize(region.getUpperX() - region.getLowerX() + 2);

        m_vecQuads[NegativeY].resize(region.getUpperY() - region.getLowerY() + 2);
        m_vecQuads[PositiveY].resize(region.getUpperY() - region.getLowerY() + 2);

        m_vecQuads[NegativeZ].resize(region.getUpperZ() - region.getLowerZ() + 2);
        m_vecQuads[PositiveZ].resize(region.getUpperZ() - region.getLowerZ() + 2);

        typename VolumeType::Sampler volumeSampler(volData);


        for (int32_t z = region.getLowerZ(); z <= region.getUpperZ(); z++)
        {
            uint32_t regZ = z - region.getLowerZ();

            for (int32_t y = region.getLowerY(); y <= region.getUpperY(); y++)
            {
                uint32_t regY = y - region.getLowerY();

                for (int32_t x = region.getLowerX(); x <= region.getUpperX(); x++)
                {
                    uint32_t regX = x - region.getLowerX();

                    volumeSampler.setPosition(x, y, z);

                    typename VolumeType::VoxelType material; //Filled in by callback
                    typename VolumeType::VoxelType currentVoxel = volumeSampler.getVoxel();
                    typename VolumeType::VoxelType negXVoxel = volumeSampler.peekVoxel1nx0py0pz();
                    typename VolumeType::VoxelType negYVoxel = volumeSampler.peekVoxel0px1ny0pz();
                    typename VolumeType::VoxelType negZVoxel = volumeSampler.peekVoxel0px0py1nz();

                    // X
                    if (isQuadNeeded(currentVoxel, negXVoxel, material))
                    {
                        CubicNormalsVertex<typename VolumeType::VoxelType> v0, v1, v2, v3;

                        v0.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v0.face = FaceNames::NegativeX;
                        v0.data = material;


                        v1.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ + 1));
                        v1.face = FaceNames::NegativeX;
                        v1.data = material;


                        v2.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ + 1));
                        v2.face = FaceNames::NegativeX;
                        v2.data = material;


                        v3.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ));
                        v3.face = FaceNames::NegativeX;
                        v3.data = material;

                        m_vecQuads[NegativeX][regX].push_back(Quad(
                                result->addVertex(v0),
                                result->addVertex(v1),
                                result->addVertex(v2),
                                result->addVertex(v3)));
                    }

                    if (isQuadNeeded(negXVoxel, currentVoxel, material))
                    {
                        CubicNormalsVertex<typename VolumeType::VoxelType> v0, v1, v2, v3;

                        v0.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v0.face = FaceNames::PositiveX;
                        v0.data = material;


                        v1.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ + 1));
                        v1.face = FaceNames::PositiveX;
                        v1.data = material;


                        v2.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ + 1));
                        v2.face = FaceNames::PositiveX;
                        v2.data = material;


                        v3.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ));
                        v3.face = FaceNames::PositiveX;
                        v3.data = material;

                        m_vecQuads[PositiveX][regX].push_back(Quad(
                                result->addVertex(v0),
                                result->addVertex(v3),
                                result->addVertex(v2),
                                result->addVertex(v1)));


                        /*
                        uint32_t v0 = addVertex(regX, regY, regZ, material, FaceNames::PositiveX, result);
                        uint32_t v1 = addVertex(regX, regY, regZ + 1, material, FaceNames::PositiveX, result);
                        uint32_t v2 = addVertex(regX, regY + 1, regZ + 1, material, FaceNames::PositiveX, result);
                        uint32_t v3 = addVertex(regX, regY + 1, regZ, material, FaceNames::PositiveX, result);

                        m_vecQuads[PositiveX][regX].push_back(Quad(v0, v3, v2, v1));
                        */
                    }

                    // Y
                    if (isQuadNeeded(currentVoxel, negYVoxel, material))
                    {
                        CubicNormalsVertex<typename VolumeType::VoxelType> v0, v1, v2, v3;

                        v0.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v0.face = FaceNames::NegativeY;
                        v0.data = material;


                        v1.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v1.face = FaceNames::NegativeY;
                        v1.data = material;


                        v2.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ + 1));
                        v2.face = FaceNames::NegativeY;
                        v2.data = material;


                        v3.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ + 1));
                        v3.face = FaceNames::NegativeY;
                        v3.data = material;

                        m_vecQuads[NegativeY][regY].push_back(Quad(
                                result->addVertex(v0),
                                result->addVertex(v1),
                                result->addVertex(v2),
                                result->addVertex(v3)));

                        /*
                        uint32_t v0 = addVertex(regX, regY, regZ, material, FaceNames::NegativeY, result);
                        uint32_t v1 = addVertex(regX + 1, regY, regZ, material, FaceNames::NegativeY, result);
                        uint32_t v2 = addVertex(regX + 1, regY, regZ + 1, material, FaceNames::NegativeY, result);
                        uint32_t v3 = addVertex(regX, regY, regZ + 1, material, FaceNames::NegativeY, result);

                        m_vecQuads[NegativeY][regY].push_back(Quad(v0, v1, v2, v3));
                        */
                    }

                    if (isQuadNeeded(negYVoxel, currentVoxel, material))
                    {
                        CubicNormalsVertex<typename VolumeType::VoxelType> v0, v1, v2, v3;

                        v0.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v0.face = FaceNames::PositiveY;
                        v0.data = material;


                        v1.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v1.face = FaceNames::PositiveY;
                        v1.data = material;


                        v2.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ + 1));
                        v2.face = FaceNames::PositiveY;
                        v2.data = material;


                        v3.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ + 1));
                        v3.face = FaceNames::PositiveY;
                        v3.data = material;

                        m_vecQuads[PositiveY][regY].push_back(Quad(
                                result->addVertex(v0),
                                result->addVertex(v3),
                                result->addVertex(v2),
                                result->addVertex(v1)));
                        /*
                        uint32_t v0 = addVertex(regX, regY, regZ, material, FaceNames::PositiveY, result);
                        uint32_t v1 = addVertex(regX + 1, regY, regZ, material, FaceNames::PositiveY, result);
                        uint32_t v2 = addVertex(regX + 1, regY, regZ + 1, material, FaceNames::PositiveY, result);
                        uint32_t v3 = addVertex(regX, regY, regZ + 1, material, FaceNames::PositiveY, result);

                        m_vecQuads[PositiveY][regY].push_back(Quad(v0, v3, v2, v1));
                        */
                    }

                    // Z
                    if (isQuadNeeded(currentVoxel, negZVoxel, material))
                    {
                        CubicNormalsVertex<typename VolumeType::VoxelType> v0, v1, v2, v3;

                        v0.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v0.face = FaceNames::NegativeZ;
                        v0.data = material;


                        v1.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ));
                        v1.face = FaceNames::NegativeZ;
                        v1.data = material;


                        v2.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ));
                        v2.face = FaceNames::NegativeZ;
                        v2.data = material;


                        v3.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v3.face = FaceNames::NegativeZ;
                        v3.data = material;

                        m_vecQuads[NegativeZ][regZ].push_back(Quad(
                                result->addVertex(v0),
                                result->addVertex(v1),
                                result->addVertex(v2),
                                result->addVertex(v3)));

                        /*
                        uint32_t v0 = addVertex(regX, regY, regZ, material, FaceNames::NegativeZ, result);
                        uint32_t v1 = addVertex(regX, regY + 1, regZ, material, FaceNames::NegativeZ, result);
                        uint32_t v2 = addVertex(regX + 1, regY + 1, regZ, material, FaceNames::NegativeZ, result);
                        uint32_t v3 = addVertex(regX + 1, regY, regZ, material, FaceNames::NegativeZ, result);

                        m_vecQuads[NegativeZ][regZ].push_back(Quad(v0, v1, v2, v3));
                        */
                    }

                    if (isQuadNeeded(negZVoxel, currentVoxel, material))
                    {
                        CubicNormalsVertex<typename VolumeType::VoxelType> v0, v1, v2, v3;

                        v0.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v0.face = FaceNames::PositiveZ;
                        v0.data = material;


                        v1.encodedPosition.setElements(static_cast<uint8_t>(regX),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ));
                        v1.face = FaceNames::PositiveZ;
                        v1.data = material;


                        v2.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY + 1),
                                                       static_cast<uint8_t>(regZ));
                        v2.face = FaceNames::PositiveZ;
                        v2.data = material;


                        v3.encodedPosition.setElements(static_cast<uint8_t>(regX + 1),
                                                       static_cast<uint8_t>(regY),
                                                       static_cast<uint8_t>(regZ));
                        v3.face = FaceNames::PositiveZ;
                        v3.data = material;

                        m_vecQuads[PositiveZ][regZ].push_back(Quad(
                                result->addVertex(v0),
                                result->addVertex(v3),
                                result->addVertex(v2),
                                result->addVertex(v1)));

                        /*
                        uint32_t v0 = addVertex(regX, regY, regZ, material, FaceNames::PositiveZ, result);
                        uint32_t v1 = addVertex(regX, regY + 1, regZ, material, FaceNames::PositiveZ, result);
                        uint32_t v2 = addVertex(regX + 1, regY + 1, regZ, material, FaceNames::PositiveZ, result);
                        uint32_t v3 = addVertex(regX + 1, regY, regZ, material, FaceNames::PositiveZ, result);

                        m_vecQuads[PositiveZ][regZ].push_back(Quad(v0, v3, v2, v1));
                        */
                    }

                   // volumeSampler.movePositiveX();
                }
            }
        }

        for (uint32_t uFace = 0; uFace < NoOfFaces; uFace++)
        {
            std::vector< std::list<Quad> >& vecListQuads = m_vecQuads[uFace];

            for (uint32_t slice = 0; slice < vecListQuads.size(); slice++)
            {
                std::list<Quad>& listQuads = vecListQuads[slice];

                if (bMergeQuads)
                {
                    //Repeatedly call this function until it returns
                    //false to indicate nothing more can be done.
                    while (performQuadMerging(listQuads, result)){}
                }

                typename std::list<Quad>::iterator iterEnd = listQuads.end();
                for (typename std::list<Quad>::iterator quadIter = listQuads.begin(); quadIter != iterEnd; quadIter++)
                {
                    Quad& quad = *quadIter;
                    result->addTriangle(quad.vertices[0], quad.vertices[1], quad.vertices[2]);
                    result->addTriangle(quad.vertices[0], quad.vertices[2], quad.vertices[3]);
                }
            }
        }

        result->setOffset(region.getLowerCorner());
        result->removeUnusedVertices();

        POLYVOX_LOG_TRACE("Cubic surface extraction took ", timer.elapsedTimeInMilliSeconds(),
                          "ms (Region size = ", m_regSizeInVoxels.getWidthInVoxels(), "x", m_regSizeInVoxels.getHeightInVoxels(),
                          "x", m_regSizeInVoxels.getDepthInVoxels(), ")");
    }
}
