import numpy as np

class CoordinateMapper:
    def __init__(self, camera):
        self.fx = camera.fx
        self.fy = camera.fy

        self.cx = camera.cx
        self.cy = camera.cy

        self.tx = camera.tx
        self.ty = camera.ty
        self.tz = camera.tz

        r1 = np.deg2rad(camera.rot1z)
        r2 = np.deg2rad(camera.rot2x)
        r3 = np.deg2rad(camera.rot3z)

        Rz1 = np.array([
            [np.cos(r1), -np.sin(r1), 0],
            [np.sin(r1), np.cos(r1), 0],
            [0, 0, 1]
        ])

        Rx = np.array([
            [1, 0, 0],
            [0, np.cos(r2), -np.sin(r2)],
            [0, np.sin(r2), np.cos(r2)]
        ])

        Rz2 = np.array([
            [np.cos(r3), -np.sin(r3), 0],
            [np.sin(r3), np.cos(r3), 0],
            [0, 0, 1]
        ])

        self.R = Rz2 @ Rx @ Rz1
        self.R_inv = np.linalg.inv(self.R)

        self.T = np.array([camera.tx, camera.ty, camera.tz])

        self.K = np.array([
            [camera.fx / camera.sx, 0, camera.cx],
            [0, camera.fy / camera.sy, camera.cy],
            [0, 0, 1]
        ])

        self.K_inv = np.linalg.inv(self.K)

    def pixel_to_world(self, x, y, W=0):
        pixel = np.array([x, y, 1.0])
        cam_coords = self.K_inv @ pixel

        scale = (W + self.R_inv[2] @ self.T) / (self.R_inv[2] @ cam_coords)
        cam_coords *= scale

        world = self.R_inv @ (cam_coords - self.T)
        return world[0], world[1]
    
    def world_to_pixel(self, X, Y, Z=0):
        world = np.array([X, Y, Z])
        cam = self.R @ world + self.T
        pixel = self.K @ cam
        return pixel[0] / pixel[2], pixel[1] / pixel[2]