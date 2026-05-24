"""
app.py  —  CV Warehouse Applications backend
Handles: 3D model / Meshroom, MJPEG camera streams,
         click-to-drive robot control, YOLO object detection.

Run from the backend/ folder:
    pip install -r requirements.txt
    python app.py
"""

import traceback
import sys

def boot(msg):
    print(f"[BOOT] {msg}", flush=True)

boot("Starting imports")

try:
    import glob
    import shutil
    import os
    import cv2
    import json
    import threading
    import time
    import subprocess
    import numpy as np
    from datetime import datetime
    from flask import Flask, Response, request, send_from_directory, jsonify, stream_with_context
    from flask_cors import CORS
    from dotenv import load_dotenv

    boot("Core imports OK")

except Exception as e:
    print("\n[CRASH] Import failure")
    traceback.print_exc()
    sys.exit(1)

# ── Load .env ─────────────────────────────────────────────────────────────────
load_dotenv()
AVA_HOST     = os.getenv('AVA_HOST',     '')
AVA_USER     = os.getenv('AVA_USER',     '')
AVA_PASS     = os.getenv('AVA_PASS',     '')
AVA_ROBOT_ID = os.getenv('AVA_ROBOT_ID', '')
AVA_MAP_ID   = int(os.getenv('AVA_MAP_ID', ))

boot("Loading .env")

try:
    load_dotenv()

    AVA_HOST     = os.getenv('AVA_HOST', '')
    AVA_USER     = os.getenv('AVA_USER', '')

    boot(f"ENV loaded: host={AVA_HOST}")

except Exception:
    print("\n[CRASH] ENV setup failed")
    traceback.print_exc()
    sys.exit(1)

# ── Flask ─────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

boot("Creating Flask app")

try:
    app = Flask(__name__)
    CORS(app)

    boot("Flask app created")

except Exception:
    print("\n[CRASH] Flask init failed")
    traceback.print_exc()
    sys.exit(1)

# ── Meshroom config ───────────────────────────────────────────────────────────
MESHROOM_BATCH  = r"C:\Users\Christian\GSU\spring26\capstone\2026Spring-CVWarehouse\src\Meshroom-2025.1.0\meshroom_batch.exe"
MESHROOM_CACHE  = None
MODELS_METADATA = os.path.join("output", "models_metadata.json")

# ── Camera / robot imports ────────────────────────────────────────────────────
boot("Importing camera modules")

try:
    from Cameras import CameraModel
    from CoordinateMapper import CoordinateMapper
    from LocationConverter import LocationConverter
    from Calibrate import Calibrate

    boot("Camera module imports OK")

except Exception:
    print("\n[CRASH] Camera module import failed")
    traceback.print_exc()
    sys.exit(1)

boot("Initializing CameraModel")

try:
    cm = CameraModel()
    boot(f"CameraModel initialized ({len(cm.cameras)} cameras)")

except Exception:
    print("\n[CRASH] CameraModel init failed")
    traceback.print_exc()
    sys.exit(1)
boot("Initializing converters/mappers")

try:
    converter = LocationConverter()
    mappers = {
        i: CoordinateMapper(cm.cameras[i])
        for i in range(len(cm.cameras))
    }

    boot("Converters/mappers initialized")

except Exception:
    print("\n[CRASH] Mapper init failed")
    traceback.print_exc()
    sys.exit(1)
# Affine correction (from main.py)
_computed = np.array([
    [26.3693,-13.8940],[28.8708, -6.7943],[31.3914, -8.7089],
    [32.2110,-11.8195],[35.1383, -2.7580],[29.5900, -8.4231],
    [27.5475,-10.5424],[32.0932, -4.1347],[34.9845, -6.2648]
], dtype=np.float32)
_actual = np.array([
    [16.7899, -1.5175],[25.6261, -1.1149],[20.9252, -8.6480],
    [17.2177,-12.1724],[26.3818,-11.4401],[16.6035, -8.4231],
    [20.7190, -1.2740],[27.1549, -6.4664],[21.7579,-13.3559]
], dtype=np.float32)
boot("Computing affine transform")

try:
    affine_T, _ = cv2.estimateAffine2D(_computed, _actual)

    if affine_T is None:
        raise RuntimeError("Affine transform returned None")

    boot("Affine transform OK")

except Exception:
    print("\n[CRASH] Affine transform failed")
    traceback.print_exc()
    sys.exit(1)

# Route destinations (from main.py)
destinations = [
    {'x':26.33043,'y':-0.67782, 'theta':-2.07397, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':24.24418,'y':-0.84815, 'theta':-1.44023, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':23.05096,'y':-0.77066, 'theta':-1.00689, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':22.70551,'y':-3.31184, 'theta':-0.04694, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':22.39529,'y':-5.74113, 'theta': 0.73771, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':24.47155,'y':-6.28364, 'theta': 1.47782, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':26.74280,'y':-5.64191, 'theta': 2.44087, 'local':False,'mapId':1,'wait_for_complete':True},
    {'x':26.51886,'y':-3.45263, 'theta':-3.06267, 'local':False,'mapId':1,'wait_for_complete':True},
]

# ── Lazy robot drivers ────────────────────────────────────────────────────────
_robot_drive = None
_robot_utils = None
_robot_lock  = threading.Lock()

def get_robot_drive():
    global _robot_drive

    with _robot_lock:
        if _robot_drive is None:
            print("\n[robot] Attempting RobotDriveUtils connection")
            print(f"[robot] HOST={AVA_HOST}")
            print(f"[robot] USER={AVA_USER}")
            print(f"[robot] ROBOT={AVA_ROBOT_ID}")

            try:
                from avarobotutils.drive import RobotDriveUtils

                print("[robot] Imported RobotDriveUtils")

                _robot_drive = RobotDriveUtils(
                    AVA_HOST,
                    AVA_USER,
                    AVA_PASS,
                    AVA_ROBOT_ID,
                    ip=None
                )

                print("[robot] RobotDriveUtils connected successfully")

            except Exception as e:
                import traceback

                print("\n[robot] Drive connect failed")
                print(f"[robot] ERROR: {e}")

                traceback.print_exc()

                _robot_drive = None

        return _robot_drive

def get_robot_utils():
    global _robot_utils
    with _robot_lock:
        if _robot_utils is None:
            try:
                from avarobotutils.robot import RobotUtils
                _robot_utils = RobotUtils(AVA_HOST, AVA_USER, AVA_PASS, AVA_ROBOT_ID, ip=None)
                print('[robot] RobotUtils connected')
            except Exception as e:
                print(f'[robot] Utils connect failed: {e}')
        return _robot_utils

# ── Frame buffers ─────────────────────────────────────────────────────────────
frame_raw:       dict = {i: None for i in range(len(cm.cameras))}
frame_annotated: dict = {i: None for i in range(len(cm.cameras))}
undistort_maps:  dict = {i: None for i in range(len(cm.cameras))}
frame_lock       = threading.Lock()

click_overlay:   dict = {i: None for i in range(len(cm.cameras))}
overlay_lock     = threading.Lock()
OVERLAY_SECS     = 1.5

# ── YOLO state ────────────────────────────────────────────────────────────────
yolo_state = {
    'running':     False,
    'overlay_on':  False,
    'last_counts': {},
    'last_log':    [],
    'model':       'yoloe-11l-seg-pf.pt',
    'lock':        threading.Lock()
}

# ── Route state ───────────────────────────────────────────────────────────────
route_state = {'running': False}

# ── Helpers ───────────────────────────────────────────────────────────────────
def _draw_marker(frame, px, py):
    out = frame.copy()
    c   = (0, 200, 255)
    cv2.circle(out, (px, py), 18, c, 2)
    cv2.circle(out, (px, py),  3, c, -1)
    cv2.line(out, (px-28,py), (px-14,py), c, 1)
    cv2.line(out, (px+14,py), (px+28,py), c, 1)
    cv2.line(out, (px,py-28), (px,py-14), c, 1)
    cv2.line(out, (px,py+14), (px,py+28), c, 1)
    return out

def _encode(frame, quality=75):
    ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ok else None

# ── Camera threads ────────────────────────────────────────────────────────────
def _camera_thread(cam_idx: int):
    camera = cm.cameras[cam_idx]
    cap    = cv2.VideoCapture(camera.url)
    calibrated = False
    map1 = map2 = None
    print(f'[cam {cam_idx}] Opening {camera.url}')

    while True:
        ret, frame = cap.read()
        if not ret:
            print(f'[cam {cam_idx}] Stream lost — reconnecting in 2s')
            cap.release(); time.sleep(2)
            cap = cv2.VideoCapture(camera.url)
            calibrated = False
            continue

        if not calibrated:
            try:
                map1, map2 = Calibrate(camera, frame)
                with frame_lock:
                    undistort_maps[cam_idx] = (map1, map2)
                calibrated = True
                print(f'[cam {cam_idx}] Calibrated')
            except Exception as e:
                print(f'[cam {cam_idx}] Calibration error: {e}')

        if calibrated and map1 is not None:
            frame = cv2.remap(frame, map1, map2, cv2.INTER_LINEAR)

        # Click overlay
        with overlay_lock:
            ov = click_overlay.get(cam_idx)
        if ov:
            ox, oy, exp = ov
            if time.time() < exp:
                frame = _draw_marker(frame, ox, oy)
            else:
                with overlay_lock:
                    click_overlay[cam_idx] = None

        # Store raw frame
        jpg = _encode(frame)
        if jpg:
            with frame_lock:
                frame_raw[cam_idx] = jpg

        # YOLO overlay if enabled
        with yolo_state['lock']:
            overlay_on = yolo_state['overlay_on']
            model      = yolo_state['model']

        if overlay_on and model is not None:
            try:
                res = model.track(frame, persist=True, conf=0.4, imgsz=640, verbose=False)
                ann = _encode(res[0].plot(masks=False))
                if ann:
                    with frame_lock:
                        frame_annotated[cam_idx] = ann
            except Exception as e:
                print(f'[cam {cam_idx}] Overlay error: {e}')
        else:
            with frame_lock:
                frame_annotated[cam_idx] = None


def _mjpeg_gen(cam_idx: int, annotated: bool = False):
    while True:
        with frame_lock:
            jpg = (frame_annotated.get(cam_idx) or frame_raw.get(cam_idx)) \
                  if annotated else frame_raw.get(cam_idx)
        if jpg is None:
            time.sleep(0.05)
            continue
        yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n'
        time.sleep(0.033)

# ── YOLO detection (headless) ─────────────────────────────────────────────────
def _run_detection(cam_idx: int, save: bool = False):
    from collections import Counter
    with yolo_state['lock']:
        if yolo_state['running']:
            return {'error': 'already running'}
        yolo_state['running'] = True
    try:
        with yolo_state['lock']:
            if yolo_state['model'] is None:
                from ultralytics import YOLOE
                yolo_state['model'] = YOLOE('yoloe-11l-seg-pf.pt')
            model = yolo_state['model']

        camera   = cm.cameras[cam_idx]
        cap      = cv2.VideoCapture(camera.url)
        seen_objects = set()
        counts   = Counter()
        log      = []
        start    = time.time()
        DURATION = 30  # seconds

        with frame_lock:
            maps = undistort_maps.get(cam_idx)

        while time.time() - start < DURATION:
            ret, frame = cap.read()
            if not ret:
                break
            if maps:
                frame = cv2.remap(frame, maps[0], maps[1], cv2.INTER_LINEAR)
            res = model.track(frame, persist=True, conf=0.4, imgsz=1440, verbose=False)
            if res[0].boxes is not None and res[0].boxes.id is not None:
                for cls, tid in zip(res[0].boxes.cls, res[0].boxes.id):

                    tid = int(tid)
                    cls = int(cls)

                    name = model.names.get(cls, str(cls))

                    # Unique object key
                    obj_key = (name, tid)

                    # Skip duplicates
                    if obj_key in seen_objects:
                        continue

                    seen_objects.add(obj_key)

                    counts[name] += 1

                    log.append({
                        'camera': f'cam_{cam_idx}',
                        'track_id': tid,
                        'class_id': cls,
                        'class_name': name,
                        'timestamp': time.time()
                    })
            cap.release()

        result = {
            'total_objects': len(seen_objects),
            'counts': dict(counts),
            'detections': log
        }

        with yolo_state['lock']:
            yolo_state['last_counts'] = dict(counts)
            yolo_state['last_log']    = log

        if save:
            folder = 'Detection Results'
            os.makedirs(folder, exist_ok=True)
            ts = datetime.now().strftime('%m-%d-%Y_%I-%M%p')
            fp = os.path.join(folder, f'DR_{ts}.json')
            with open(fp, 'w') as f:
                json.dump(result, f, indent=4)
            result['saved_to'] = fp

        return result
    finally:
        with yolo_state['lock']:
            yolo_state['running'] = False

# ── Route runner ──────────────────────────────────────────────────────────────
def _run_route():
    drive = get_robot_drive()
    robot = get_robot_utils()
    if not drive:
        return
    route_state['running'] = True
    try:
        import requests as req
        img_url = f'https://{AVA_HOST}/api/htproxy/WebDrive/{AVA_ROBOT_ID}/images/snapshot.jpg'
        snap_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snapshots')
        os.makedirs(snap_dir, exist_ok=True)
        existing = [f for f in os.listdir(snap_dir) if f.startswith('snapshot_')]
        next_num = len(existing) + 1
        for i, dest in enumerate(destinations):
            drive.drive_to_destination(dest)
            if robot:
                robot.get_command('/robot/cameraPose/sendCommand?value=149')
                data = req.get(img_url, auth=(AVA_USER, AVA_PASS)).content
                with open(os.path.join(snap_dir, f'snapshot_{next_num+i}.jpg'), 'wb') as f:
                    f.write(data)
    finally:
        route_state['running'] = False


# ══════════════════════════════════════════════════════════════════════════════
#  CAMERA / ROBOT ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/stream/<int:cam_idx>')
def stream(cam_idx: int):
    if cam_idx not in range(len(cm.cameras)):
        return jsonify({'error': 'invalid camera'}), 400
    annotated = request.args.get('annotated', '0') == '1'
    return Response(
        stream_with_context(_mjpeg_gen(cam_idx, annotated)),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/click', methods=['POST'])
def click():
    data     = request.get_json(force=True)
    cam_idx  = int(data.get('cam', 0))
    click_x  = float(data.get('x', 0))
    click_y  = float(data.get('y', 0))
    stream_w = float(data.get('stream_w', 1))
    stream_h = float(data.get('stream_h', 1))

    camera       = cm.cameras[cam_idx]
    raw_w, raw_h = camera.raw_image_size
    px = click_x * (raw_w / stream_w)
    py = click_y * (raw_h / stream_h)

    with overlay_lock:
        click_overlay[cam_idx] = (int(px), int(py), time.time() + OVERLAY_SECS)

    world_x, world_y = mappers[cam_idx].pixel_to_world(px, py, 0)
    robot_x, robot_y = converter.map_to_robot(world_x, world_y)

    pt       = np.array([[[robot_x, robot_y]]], dtype=np.float32)
    corrected = cv2.transform(pt, affine_T)[0][0]
    real_x, real_y = float(corrected[0]), float(corrected[1])

    print(f'[click] cam={cam_idx} pixel=({px:.0f},{py:.0f}) '
          f'world=({world_x:.2f},{world_y:.2f}) corrected=({real_x:.4f},{real_y:.4f})')

    drive = get_robot_drive()
    if drive is None:
        return jsonify({'error': 'robot not connected',
                        'world': [round(world_x,3), round(world_y,3)]}), 503

    threading.Thread(
        target=drive.drive_to_destination,
        args=({'x':real_x,'y':real_y,'local':False,
               'mapId':AVA_MAP_ID,'wait_for_complete':False},),
        daemon=True
    ).start()

    return jsonify({'status': 'driving',
                    'world':     [round(world_x,3), round(world_y,3)],
                    'corrected': [round(real_x,4),  round(real_y,4)]})

@app.route('/position')
def position():
    drive = get_robot_drive()
    if drive is None:
        return jsonify({'error': 'robot not connected'}), 503
    try:
        return jsonify({'position': drive.cur_robot_position()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/run-route', methods=['POST'])
def run_route():
    if route_state['running']:
        return jsonify({'error': 'Route already running'}), 409
    threading.Thread(target=_run_route, daemon=True).start()
    return jsonify({'status': 'route started', 'stops': len(destinations)})

@app.route('/route-status')
def route_status():
    return jsonify({'running': route_state['running']})

@app.route('/detect', methods=['POST'])
def detect():
    data    = request.get_json(force=True)
    cam_idx = int(data.get('cam', 0))
    save    = bool(data.get('save', False))
    if yolo_state['running']:
        return jsonify({'error': 'Detection already running'}), 409
    threading.Thread(target=_run_detection, args=(cam_idx, save), daemon=True).start()
    return jsonify({'status': 'detection started', 'cam': cam_idx})

@app.route('/detect-status')
def detect_status():
    with yolo_state['lock']:
        return jsonify({'running':    yolo_state['running'],
                        'counts':     yolo_state['last_counts'],
                        'total':      sum(yolo_state['last_counts'].values()),
                        'overlay_on': yolo_state['overlay_on']})

@app.route('/detect-results')
def detect_results():
    with yolo_state['lock']:
        return jsonify({'counts':     yolo_state['last_counts'],
                        'total':      sum(yolo_state['last_counts'].values()),
                        'detections': yolo_state['last_log']})

@app.route('/overlay-toggle', methods=['POST'])
def overlay_toggle():
    with yolo_state['lock']:
        if not yolo_state['overlay_on'] and yolo_state['model'] is None:
            try:
                from ultralytics import YOLOE
                yolo_state['model'] = YOLOE('yoloe-11l-seg-pf.pt')
            except Exception as e:
                return jsonify({'error': f'Could not load model: {e}'}), 500
        yolo_state['overlay_on'] = not yolo_state['overlay_on']
        state = yolo_state['overlay_on']
    return jsonify({'overlay_on': state})

@app.route('/cam-info/<int:cam_idx>')
def cam_info(cam_idx: int):
    if cam_idx not in range(len(cm.cameras)):
        return jsonify({'error': 'invalid camera'}), 400
    c = cm.cameras[cam_idx]
    return jsonify({'index': cam_idx, 'url': c.url,
                    'resolution': list(c.raw_image_size),
                    'streaming': frame_raw.get(cam_idx) is not None,
                    'total_cameras': len(cm.cameras)})

@app.route('/detection-files')
def detection_files():
    folder = 'Detection Results'
    if not os.path.exists(folder):
        return jsonify({'files': []})
    files = sorted([f for f in os.listdir(folder) if f.endswith('.json')], reverse=True)
    return jsonify({'files': files})

@app.route('/detection-file/<filename>')
def detection_file(filename: str):
    return send_from_directory(os.path.abspath('Detection Results'), filename)


# ══════════════════════════════════════════════════════════════════════════════
#  MESHROOM / 3D MODEL ROUTES  (unchanged from original app.py)
# ══════════════════════════════════════════════════════════════════════════════

def load_metadata():
    if os.path.exists(MODELS_METADATA):
        try:
            with open(MODELS_METADATA, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_metadata(metadata):
    os.makedirs('output', exist_ok=True)
    with open(MODELS_METADATA, 'w') as f:
        json.dump(metadata, f, indent=2)

@app.route('/status')
def status():
    available = os.path.exists(MESHROOM_BATCH)
    return jsonify({'meshroom_available': available,
                    'meshroom_path': MESHROOM_BATCH if available else None,
                    'message': 'Server ready' if available else 'OBJ upload/load available'})

@app.route('/upload', methods=['POST'])
def upload():
    files       = request.files.getlist('images')
    custom_name = request.form.get('name', '').strip()
    if not files:
        return 'No image files provided', 400
    for f in files:
        if f.filename.lower().endswith('.obj'):
            return 'OBJ files should be uploaded via Upload OBJ', 400
    if not os.path.exists(MESHROOM_BATCH):
        return 'Meshroom not installed. Use Upload OBJ instead.', 400
    shutil.rmtree('input',  ignore_errors=True)
    shutil.rmtree('output', ignore_errors=True)
    for tmp in glob.glob(r'C:\Users\Christian\AppData\Local\Temp\tmp*'):
        shutil.rmtree(tmp, ignore_errors=True)
    for tmp in glob.glob('/tmp/tmp*/'):
        shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs('input',  exist_ok=True)
    os.makedirs('output', exist_ok=True)
    for f in files:
        f.save(f'input/{f.filename}')
    subprocess.run([MESHROOM_BATCH,'-p','photogrammetry',
                    '-i','input','-o','output','--cache','output/cache'], check=True)
    if custom_name:
        meta = load_metadata()
        meta[f'meshroom_{datetime.now().strftime("%Y%m%d_%H%M%S")}'] = custom_name
        save_metadata(meta)
    return f'Done! Processed {len(files)} images'

@app.route('/upload-obj', methods=['POST'])
def upload_obj():
    files       = request.files.getlist('obj_files')
    custom_name = request.form.get('name', '').strip()
    if not files:
        return jsonify({'error': 'No OBJ files provided'}), 400
    os.makedirs('output', exist_ok=True)
    meta = load_metadata()
    uploaded = []
    for f in files:
        if not f.filename.lower().endswith('.obj'):
            return jsonify({'error': f'{f.filename} is not an OBJ file'}), 400
        f.save(f'output/{f.filename}')
        if custom_name:
            meta[f.filename] = custom_name
        uploaded.append(f.filename)
    save_metadata(meta)
    return jsonify({'message': f'Uploaded {len(uploaded)} OBJ file(s)',
                    'files': uploaded, 'custom_name': custom_name or None})

@app.route('/models')
def list_models():
    meta   = load_metadata()
    models = []
    if MESHROOM_CACHE and os.path.exists(MESHROOM_CACHE):
        for path in glob.glob(os.path.join(MESHROOM_CACHE,'**/*.obj'), recursive=True):
            rel  = os.path.relpath(path, MESHROOM_CACHE).replace('\\','/')
            name = os.path.basename(path)
            models.append({'label': meta.get(name) or meta.get(rel) or rel, 'path': rel})
    if os.path.exists('output'):
        for obj in glob.glob('output/*.obj'):
            name = os.path.basename(obj)
            models.append({'label': meta.get(name) or name, 'path': f'output/{name}'})
    models.sort(key=lambda m: m['label'])
    return jsonify(models)

@app.route('/model')
def get_model():
    path = request.args.get('path')
    if not path:
        return 'Missing model path', 400
    if path.startswith('output/'):
        if os.path.isfile(path):
            return send_from_directory(os.path.abspath(os.path.dirname(path)),
                                       os.path.basename(path))
        return 'Model not found', 404
    if MESHROOM_CACHE and os.path.exists(MESHROOM_CACHE):
        abs_p = os.path.abspath(os.path.join(MESHROOM_CACHE, path))
        root  = os.path.abspath(MESHROOM_CACHE)
        try:
            if os.path.commonpath([abs_p, root]) == root and os.path.isfile(abs_p):
                return send_from_directory(os.path.dirname(abs_p), os.path.basename(abs_p))
        except ValueError:
            pass
    return 'Model not found', 404

@app.route('/obj')
def get_obj():
    if not MESHROOM_CACHE:
        return 'Meshroom not available', 404
    matches = glob.glob(os.path.join(MESHROOM_CACHE,'**/texturedMesh.obj'), recursive=True)
    if not matches:
        return 'No OBJ found', 404
    return send_from_directory(os.path.dirname(max(matches,key=os.path.getmtime)),'texturedMesh.obj')

@app.route('/mtl')
def get_mtl():
    if not MESHROOM_CACHE:
        return 'Meshroom not available', 404
    matches = glob.glob(os.path.join(MESHROOM_CACHE,'**/texturedMesh.mtl'), recursive=True)
    if not matches:
        return 'No MTL found', 404
    return send_from_directory(os.path.dirname(max(matches,key=os.path.getmtime)),'texturedMesh.mtl')

@app.route('/output/<path:filename>')
def serve_output(filename):
    local = os.path.join('output', filename)
    if os.path.isfile(local):
        return send_from_directory(os.path.abspath('output'), filename)
    if MESHROOM_CACHE and os.path.exists(MESHROOM_CACHE):
        matches = glob.glob(os.path.join(MESHROOM_CACHE, f'**/{filename}'), recursive=True)
        if matches:
            return send_from_directory(os.path.dirname(max(matches,key=os.path.getmtime)), filename)
    return 'Not found', 404


# ── Startup ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
   boot("Starting camera threads")

for idx in range(len(cm.cameras)):
    try:
        threading.Thread(
            target=_camera_thread,
            args=(idx,),
            daemon=True
        ).start()

        boot(f"Camera thread {idx} started")

    except Exception:
        print(f"\n[CRASH] Failed starting camera thread {idx}")
        traceback.print_exc()
        print(f'[server] Camera thread {idx} started')
    print('[server] Listening on http://0.0.0.0:8000')
    boot("Starting Flask server")

try:
    app.run(
        host='0.0.0.0',
        port=8000,
        threaded=True,
        debug=False,
        use_reloader=False
    )

except Exception:
    print("\n[CRASH] Flask failed to start")
    traceback.print_exc()
