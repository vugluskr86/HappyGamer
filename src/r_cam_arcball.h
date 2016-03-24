//
// Created by vugluskr on 12.03.16.
//

// Origin : https://github.com/RichieSams/thehalflingproject/blob/master/source/scene/camera.h

#ifndef HAPPYGAMER_R_CAM_ARCBALL_H
#define HAPPYGAMER_R_CAM_ARCBALL_H

#include "global_includes.h"

struct r_cam_arcball
{
    mat4 m_proj, m_view;

    float m_theta;
    float m_phi;
    float m_radius;
    float m_up;

    vec3 m_target;

    bool m_viewNeedsUpdate;

    r_cam_arcball()
            : m_theta(1.0f),
              m_phi(1.0f),
              m_radius(180.0f),
              m_up(1.0f),
              m_target(0.0f, 0.0f, 0.0f),
              m_view(),
              m_proj(),
              m_viewNeedsUpdate(true) { }

    r_cam_arcball(float theta, float phi, float radius)
            : m_theta(theta),
              m_phi(phi),
              m_radius(radius),
              m_up(1.0f),
              m_target(0.0f, 0.0f, 0.0f),
              m_view(),
              m_proj(),
              m_viewNeedsUpdate(true) { }

    inline vec3 ToCartesian() const {
        float x = m_radius * sinf(m_phi) * sinf(m_theta);
        float y = m_radius * cosf(m_phi);
        float z = m_radius * sinf(m_phi) * cosf(m_theta);

        return vec3(x, y, z);
    }

    inline vec3 GetCameraPosition() const {
        vec3 temp = m_target;
        temp += ToCartesian();
        return temp;
    }
};

extern void r_cam_init(r_cam_arcball& cam);
extern void r_cam_arcball_rotation(float dTheta, float dPhi, r_cam_arcball& cam);
extern void r_cam_arcball_zoom(float distance, r_cam_arcball& cam);
extern void r_cam_move(const vec3& pos, r_cam_arcball& cam);

extern void r_cam_update_project(float clientWidth, float clientHeight, float nearClip, float farClip, r_cam_arcball& cam);



#endif //HAPPYGAMER_R_CAM_ARCBALL_H
