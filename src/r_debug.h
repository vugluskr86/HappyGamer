//
// Created by vugluskr on 18.03.16.
//

#ifndef HAPPYGAMER_R_DEBUG_H
#define HAPPYGAMER_R_DEBUG_H

#include "global_includes.h"
#include <LinearMath/btIDebugDraw.h>
#include "r_cam_arcball.h"

struct OpenGLMeshData;

class PhysicsDebugDraw : public btIDebugDraw
{
private:
    int dbgMode;

    struct PtData {
        float x, y, z, r, g, b;
    };

    std::vector<PtData> points;
    std::vector<uint32_t> indices;

    bool m_GenBuffers;
public:
    PhysicsDebugDraw();

    OpenGLMeshData* meshData;

    void drawLine(const btVector3 &from, const btVector3 &to, const btVector3 &color);
    void drawLine(const btVector3 &from, const btVector3 &to, const btVector3 &fromColor, const btVector3 &toColor);
    void reportErrorWarning(const char *warningString);
    void draw3dText(const btVector3 &location, const char *textString);
    void drawContactPoint(const btVector3 &PointOnB, const btVector3 &normalOnB, btScalar distance, int lifeTime, const btVector3 &color);
    void setDebugMode(int debugMode);
    int getDebugMode() const;

    void update_mesh();
};

#endif //HAPPYGAMER_R_DEBUG_H
