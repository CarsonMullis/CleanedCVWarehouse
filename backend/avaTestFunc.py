import requests
import msvcrt
import time
import cv2
import tkinter
import threading
from pprint import pprint
from avarobotutils.robot import RobotUtils
from avarobotutils.drive import RobotDriveUtils
from avarobotutils.tel import RobotTelUtils
from avarobotutils.maintenance import RobotMaintenanceUtils

def main():
    userName = ''
    passWord = ''
    try:
        robotMaint = RobotMaintenanceUtils('', userName, passWord, '', ip=None)
        robot = RobotUtils('', userName, passWord, '', ip=None)
        response = robot.get_command('/robot/info')
        print(response)
        status = robot.get_status()
        print(status)
        state = robot.get_state()
        print(state)
        ##Trying Camera snapshot stuff
        imgURL = "https:///api/htproxy/WebDrive//images/snapshot.jpg"
        robot.get_command("/robot/cameraPose/sendCommand?value=149")
        
        ##I'm boutta whip dis jawn
        ##Don't spam the console with keypresses the robot will tweak out a little when it approaches an obstacle
        robotDrive = RobotDriveUtils('', userName, passWord, '', ip=None)
        print("W is forward. S is backward. A is sidestep left. D is sidestep right. Q is rotate left. E is rotate right.\nP to end the program. G takes a picture with the camera on the AVA. F logs all dynamic obstacles into the console. T to dock the robot.")
        
        stream_state = {'active': False}
        
        def stream_camera():
            while stream_state['active']:
                try:
                    robot.get_command("/robot/cameraPose/sendCommand?value=149")
                    data = requests.get(imgURL, auth=(userName, passWord)).content
                    with open("OnlyBots.jpg", "wb") as file:
                        file.write(data)
                    image = cv2.imread('OnlyBots.jpg')
                    if image is not None:
                        cv2.namedWindow("AVA Stream", cv2.WINDOW_FULLSCREEN)
                        cv2.imshow("AVA Stream", image)
                        cv2.waitKey(1)
                except:
                    print("stream error")
                time.sleep(.05)
            cv2.destroyAllWindows()
        
        while (True):
            consoleKeyPress = msvcrt.getwch()
            match consoleKeyPress:
                case 'w':
                    robotDrive.drive_robot(0,0,.5,.5)
                case 's':
                    robotDrive.drive_robot(0,0,-.5,.5)
                case 'a':
                    robotDrive.drive_robot(1,0,0,.5)
                case 'd':
                    robotDrive.drive_robot(-1,0,0,.5)
                case 'q':
                    robotDrive.drive_robot(0,.5,0,.5)
                case 'e':
                    robotDrive.drive_robot(0,-.5,0,.5)
                case 'p':
                    break
                
                ## Drift Right method //this method does nothing useful lol
                case 'h':
                    print(robotDrive.cur_robot_position())
                    robotDrive.drive_robot(-10)
                    time.sleep(2)
                    robotDrive.drive_robot(0,.5,0,.5)
                     
                    
                    print("Drift completed")
                    
                case 'g':
                    try:
                        robot.get_command("/robot/cameraPose/sendCommand?value=149")
                        data = requests.get(imgURL, auth =(userName, passWord)).content
                        with open("OnlyBots.jpg", "wb") as file:
                            file.write(data)
                        file.close()
                    except:
                        print("sum wrong")
                        
                case 't':
                    robot.dock_home()
                
                ##camera tilt up
                case ',':
                    response = robotDrive.get_zlift_cameratilt()
                    camTilt = response['cameraTilt']
                    curTilt = camTilt['position']
                    curTilt = float(curTilt)
                    newTilt = (curTilt - 0.05)
                    robotDrive.drive_tilt(newTilt)
                    
                ##camera tilt down
                case '.':
                    response = robotDrive.get_zlift_cameratilt()
                    camTilt = response['cameraTilt']
                    curTilt = camTilt['position']
                    curTilt = float(curTilt)
                    newTilt = (curTilt + 0.05)
                    robotDrive.drive_tilt(newTilt)
                    
                #Set checkpoint
                case 'u':
                    print(robotDrive.cur_robot_position())
                    global curPos
                    curPos = robotDrive.cur_robot_position()
                    
                #Go to checkpoint
                case 'i':
                    if(curPos != None):
                        robotDrive.drive_to_destination(curPos)
                    else:
                        print("Checkpoint has not been set. Please set a checkpoint.")
                            
                case 'o':
                    if not stream_state['active']:
                        stream_state['active'] = True
                        threading.Thread(target=stream_camera, daemon=True).start()
                        print("Stream started")
                    else:
                        stream_state['active'] = False
                        print("Stream stopped")
                        
                case 'x':
                    print(robotDrive._wrap_api_command(False, '/robot/drive/payloadPose', {"zLift": 0.8}))
                   
                ##Camera zoom is set to the minimum     
                case 'z':
                    print(robotDrive.get_camera_pos())
                    print(robotDrive.get_zlift_cameratilt())
                            
                case 'y':
                    print(robotMaint.restart_sw())
                case _:
                    print("wrong button")
       
    except:
        print("Failed to obtain IP")
       
if __name__ == '__main__':
    main()
