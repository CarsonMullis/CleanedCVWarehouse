/**
 * scene.js - Warehouse 3D Scene Core
 *
 * Handles renderer setup, camera, controls, material palette, raycasting,
 * and the animation loop. Object geometry is defined in objects.js.
 **/

'use strict';

/* global scene references (accessed by ui.js) */
window.WH = {};

(function () {

  // Scene constants
  const W = 80;   // warehouse width  (X)
  const D = 60;   // warehouse depth  (Z)
  const H = 20;   // ceiling height   (Y)

  // Three.js setup

  const canvas = document.getElementById('three-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.008);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(55, 45, 60);
  camera.lookAt(W / 2, 0, D / 2);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(W / 2, 5, D / 2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.minDistance = 5;
  controls.maxDistance = 160;
  controls.update();

  // Expose core for ui.js
  WH.scene = scene;
  WH.camera = camera;
  WH.controls = controls;
  WH.renderer = renderer;

  // Warehouse materials palette (used in objects.js)

  const MAT = {
    floor: new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6, metalness: 0.1 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x99ccee, roughness: 0.05, metalness: 0.05, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
    door: new THREE.MeshStandardMaterial({ color: 0xcc2020, roughness: 0.5, metalness: 0.1 }),
    garage: new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.3, metalness: 0.5 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1.0 }),
    shelf: new THREE.MeshStandardMaterial({ color: 0x8a9ab0, roughness: 0.5, metalness: 0.4 }),
    shelfFrame: new THREE.MeshStandardMaterial({ color: 0xb0bac8, roughness: 0.3, metalness: 0.7 }),
    robot: new THREE.MeshStandardMaterial({ color: 0x22cc66, roughness: 0.4, metalness: 0.5 }),
    robotDark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.3 }),
    box: new THREE.MeshStandardMaterial({ color: 0xc8a060, roughness: 0.9, metalness: 0.0 }),
    pallet: new THREE.MeshStandardMaterial({ color: 0x7a5030, roughness: 1.0, metalness: 0.0 }),
    bluePallet: new THREE.MeshStandardMaterial({ color: 0x2060cc, roughness: 0.7, metalness: 0.1 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xddaa00, roughness: 0.5, metalness: 0.2 }),
    camMarker: new THREE.MeshStandardMaterial({ color: 0xff3355, roughness: 0.4, metalness: 0.3, emissive: 0xff1122, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }),
    grid: new THREE.MeshBasicMaterial({ color: 0x00e5a0, wireframe: true, transparent: true, opacity: 0.08 }),
  };

  // Build scene objects

  const objects = [];  // selectable scene objects

  const built = buildWarehouseObjects({ scene, MAT, objects, W, D, H });

  WH.gridHelper = built.gridHelper || null;
  WH.ambient = built.ambient || null;
  WH.cameraMarkers = built.cameraMarkers;
  WH.camPositions = built.camPositions;
  WH.dollhousePos = built.dollhousePos;
  WH.topPos = built.topPos;
  WH.objects = objects;

  // Hover and selection handling

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null;

  const highlightMat = new THREE.MeshStandardMaterial({ color: 0x00e5a0, roughness: 0.3, metalness: 0.2, emissive: 0x00e5a0, emissiveIntensity: 0.25 });

  function getIntersects(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = [];
    objects.forEach(o => o.traverse(c => { if (c.isMesh) meshes.push(c); }));
    return raycaster.intersectObjects(meshes, false);
  }

  canvas.addEventListener('pointermove', e => {
    const hits = getIntersects(e);
    if (hits.length) {
      const obj = findRoot(hits[0].object);
      if (obj && obj !== hovered) {
        hovered = obj;
        updateMeasureBox(obj);
      }
    } else {
      hovered = null;
      document.getElementById('measure-box').textContent = 'Hover an object to see dimensions.';
    }
  });

  canvas.addEventListener('click', e => {
    const hits = getIntersects(e);
    if (hits.length) {
      WH.dispatchSelect(findRoot(hits[0].object));
    }
  });

  function findRoot(mesh) {
    let cur = mesh;
    while (cur.parent && cur.parent !== scene) cur = cur.parent;
    return cur;
  }

  function updateMeasureBox(obj) {
    const bb = new THREE.Box3().setFromObject(obj);
    const sz = new THREE.Vector3();
    bb.getSize(sz);
    document.getElementById('measure-box').innerHTML =
      `<b>${obj.name || 'Object'}</b><br>` +
      `W: ${sz.x.toFixed(1)} ft<br>` +
      `H: ${sz.y.toFixed(1)} ft<br>` +
      `D: ${sz.z.toFixed(1)} ft`;
  }

  WH.dispatchSelect = function (obj) {
    if (!obj) return;
    document.querySelectorAll('#obj-list li').forEach(li => li.classList.remove('selected'));
    const li = document.querySelector(`#obj-list li[data-name="${CSS.escape(obj.name)}"]`);
    if (li) { li.classList.add('selected'); li.scrollIntoView({ block: 'nearest' }); }
  };

  // Camera fly-to

  WH.flyTo = function (pos, target, duration = 1200) {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = pos.clone();
    const endTarget = target.clone();
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      camera.position.lerpVectors(startPos, endPos, e);
      controls.target.lerpVectors(startTarget, endTarget, e);
      controls.update();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  // Render loop

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    resize();
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
  }, 600);

})();