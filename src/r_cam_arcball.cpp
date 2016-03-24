//
// Created by vugluskr on 12.03.16.
//

#include "r_cam_arcball.h"

void r_cam_update_matrix(r_cam_arcball& cam)
{
    if (cam.m_viewNeedsUpdate)
    {
        cam.m_view = lookAt(cam.GetCameraPosition(), cam.m_target, vec3(0.0f, cam.m_up, 0.0f));
        cam.m_viewNeedsUpdate = false;
    }
}


void r_cam_arcball_rotation(float dTheta, float dPhi, r_cam_arcball& cam)
{
    cam.m_viewNeedsUpdate = true;

    if (cam.m_up > 0.0f) {
        cam.m_theta += dTheta;
    } else {
        cam.m_theta -= dTheta;
    }

    cam.m_phi += dPhi;


    // Keep phi within -2PI to +2PI for easy 'up' comparison
    if (cam.m_phi > M_PI) {
        cam.m_phi -= M_2_PI;
    } else if (cam.m_phi < -M_2_PI) {
        cam.m_phi += M_2_PI;
    }

    // If phi is between 0 to PI or -PI to -2PI, make 'up' be positive Y, other wise make it negative Y
    if ((cam.m_phi > 0 && cam.m_phi < M_PI) || (cam.m_phi < M_PI && cam.m_phi > -M_PI)) {
        cam.m_up = 1.0f;
    } else {
        cam.m_up = -1.0f;
    }

    r_cam_update_matrix(cam);
}
void r_cam_arcball_zoom(float distance, r_cam_arcball& cam)
{
    cam.m_viewNeedsUpdate = true;

    cam.m_radius -= distance;

    if (cam.m_radius <= 1.0f)
    {
        cam.m_radius = 1.0f;
    }

    r_cam_update_matrix(cam);
}

void r_cam_move(const vec3& pos, r_cam_arcball& cam)
{
    cam.m_viewNeedsUpdate = true;

    cam.m_target += pos;

    r_cam_update_matrix(cam);
}

void r_cam_update_project(float clientWidth, float clientHeight, float nearClip, float farClip, r_cam_arcball& cam)
{
    cam.m_proj = perspective(glm::radians(45.0f), clientWidth / clientHeight, nearClip, farClip);

    r_cam_update_matrix(cam);
}

void r_cam_init(r_cam_arcball& cam)
{
    r_cam_update_matrix(cam);
}