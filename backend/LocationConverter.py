import numpy as np

class LocationConverter:
    def __init__(self):
        self.map_to_ava = np.array([
            [0.999337294, -0.036400174, 18.34844542],
            [0.036400174, 0.999337294, -11.25294412],
            [0, 0, 1]
        ])

    def map_to_robot(self, x, y):
        vec = np.array([x / 39.27, y / 39.27, 1])
        result = self.map_to_ava @ vec
        return result[0], result[1]