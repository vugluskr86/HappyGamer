//
// Created by vugluskr on 18.03.16.
//

#include "r_debug.h"
#include "r_common.h"

PhysicsDebugDraw::PhysicsDebugDraw()
{
    m_GenBuffers = false;
    meshData = new OpenGLMeshData();
}

void PhysicsDebugDraw::drawLine(const btVector3 &from, const btVector3 &to, const btVector3 &color)
{
    indices.push_back((int32_t)points.size());
    points.emplace_back(PtData { from.x(), from.y(), from.z(), color.x(), color.y(), color.z() });
    indices.push_back((int32_t)points.size());
    points.emplace_back(PtData { to.x(), to.y(), to.z(), color.x(), color.y(), color.z() });

  //  printf("drawLine\n");
}

void PhysicsDebugDraw::drawLine(const btVector3 &from, const btVector3 &to, const btVector3 &fromColor,
                                const btVector3 &toColor)
{
    indices.push_back((int32_t)points.size());
    points.emplace_back(PtData{from.x(), from.y(), from.z(), fromColor.x(), fromColor.y(), fromColor.z()});
    indices.push_back((int32_t)points.size());
    points.emplace_back(PtData{to.x(), to.y(), to.z(), toColor.x(), toColor.y(), toColor.z()});

  //  printf("drawLine\n");
}

void PhysicsDebugDraw::reportErrorWarning(const char *warningString)
{
    printf("PhysicsDebugDraw::reportErrorWarning %s\n", warningString);
}

void PhysicsDebugDraw::draw3dText(const btVector3 &location, const char *textString)
{
    printf("PhysicsDebugDraw::draw3dText %s\n", textString);
}

void PhysicsDebugDraw::drawContactPoint(const btVector3 &PointOnB, const btVector3 &normalOnB, btScalar distance, int lifeTime, const btVector3 &color)
{
    drawLine(PointOnB, PointOnB + normalOnB, color);
}

void PhysicsDebugDraw::setDebugMode(int debugMode)
{
    dbgMode = debugMode;
}

int PhysicsDebugDraw::getDebugMode() const
{
    return dbgMode;
}

void PhysicsDebugDraw::update_mesh()
{
    if( !m_GenBuffers )
    {
        glGenBuffers(1, &(meshData->vertexBuffer));
        glGenBuffers(1, &(meshData->indexBuffer));

        glBindBuffer(GL_ARRAY_BUFFER, meshData->vertexBuffer);
        glBufferData(GL_ARRAY_BUFFER, points.size() * sizeof(typename PhysicsDebugDraw::PtData), points.data(), GL_STATIC_DRAW);

        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, meshData->indexBuffer);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(uint32_t), indices.data(), GL_STATIC_DRAW);

        meshData->noOfIndices = indices.size();
        meshData->translation = vec3(0, 0, 0);
        meshData->indexType = GL_UNSIGNED_INT;

        glBindBuffer(GL_ARRAY_BUFFER, 0);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);

        indices.clear();
        points.clear();

        m_GenBuffers = true;
    }
    else
    {
        glBindBuffer(GL_ARRAY_BUFFER, meshData->vertexBuffer);
        glBufferSubData(GL_ARRAY_BUFFER, 0, points.size() * sizeof(typename PhysicsDebugDraw::PtData), points.data());

        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, meshData->indexBuffer);
        glBufferSubData(GL_ELEMENT_ARRAY_BUFFER, 0, indices.size() * sizeof(uint32_t), indices.data());

        glBindBuffer(GL_ARRAY_BUFFER, 0);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);

        indices.clear();
        points.clear();
    }
}