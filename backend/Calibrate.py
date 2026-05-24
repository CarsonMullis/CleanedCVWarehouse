import cv2
import numpy as np

def Calibrate(Camera, image):
    pattern_size = Camera.pattern_size
    square_size = 1.041
    
    objp = []
    for i in range(pattern_size[1]):
        for j in range(pattern_size[0]):
            objp.append([j * square_size, i * square_size, 0])
            
    objp = np.array(objp, dtype=np.float32)
    
    imgp = Camera.calibration_points.astype(np.float32)
    
    objPoints = [objp]
    imgPoints = [imgp]
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    ret, camera_matrix, dist_coeffs, rvecs, tvecs = cv2.calibrateCamera(
        objPoints,
        imgPoints,
        gray.shape[::-1],
        None,
        None
    )
    
    h, w = image.shape[:2]
    
    new_camera_matrix, _ = cv2.getOptimalNewCameraMatrix(
        camera_matrix,
        dist_coeffs,
        (w, h),
        1,
        (w, h)
    )
    
    map1, map2 = cv2.initUndistortRectifyMap(
        camera_matrix,
        dist_coeffs,
        None,
        new_camera_matrix,
        (w, h),
        cv2.CV_16SC2
    )
    
    return map1, map2