/**
 * objects.js - Warehouse Object Definitions
 *
 * DEMO OBJECTS ARE DEFINED IN THIS FILE. You can uncomment existing objects or add
 * Defines geometry and materials for warehouse objects, including walls, doors,
 */

'use strict';

window.buildWarehouseObjects = function (ctx) {

  const { scene, MAT, objects, W, D, H } = ctx;

  // Orignal helpers

  function box(w, h, d, mat, x, y, z, name) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) { mesh.name = name; objects.push(mesh); }
    scene.add(mesh);
    return mesh;
  }

  // Cylinder( radius, height, material, x, y, z, name )

  function cylinder(r, h, mat, x, y, z, name) {
    const geo = new THREE.CylinderGeometry(r, r, h, 24);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) { mesh.name = name; objects.push(mesh); }
    scene.add(mesh);
    return mesh;
  }

  // ShelfUnit( x, z, unitWidth, unitDepth, unitHeight, levels )

  function shelfUnit(px, pz, uw = 4, ud = 4, uh = 8, levels = 3) {
    const group = new THREE.Group();
    group.position.set(px, 0, pz);

    const postMat = MAT.shelfFrame;
    const postR = 0.12;

    // Corner posts
    [[0, 0], [uw, 0], [0, ud], [uw, ud]].forEach(([x, z]) => {
      const g = new THREE.CylinderGeometry(postR, postR, uh, 6);
      const m = new THREE.Mesh(g, postMat);
      m.position.set(x, uh / 2, z);
      m.castShadow = true;
      group.add(m);
    });

    // Horizontal rails
    for (let l = 0; l <= levels; l++) {
      const y = (l / levels) * uh;
      [0, ud].forEach(z => {
        const g = new THREE.BoxGeometry(uw, postR * 2, postR * 2);
        const m = new THREE.Mesh(g, postMat);
        m.position.set(uw / 2, y, z);
        group.add(m);
      });
      [0, uw].forEach(x => {
        const g = new THREE.BoxGeometry(postR * 2, postR * 2, ud);
        const m = new THREE.Mesh(g, postMat);
        m.position.set(x, y, ud / 2);
        group.add(m);
      });
      if (l > 0) {
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.6, transparent: true, opacity: 0.5 });
        const g = new THREE.BoxGeometry(uw - 0.2, 0.08, ud - 0.2);
        const m = new THREE.Mesh(g, deckMat);
        m.position.set(uw / 2, y, ud / 2);
        group.add(m);
      }
    }

    group.name = 'Shelf Unit';
    scene.add(group);
    objects.push(group);
    return group;
  }

  // AMRrobot( x, z, rotationY, name )

  function robot(px, pz, angle = 0, name = 'AMR Robot') {
    const group = new THREE.Group();
    group.position.set(px, 0, pz);
    group.rotation.y = angle;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.35, 32), MAT.robot);
    body.position.y = 0.18;
    body.castShadow = true;
    group.add(body);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 20), MAT.robotDark);
    hub.position.y = 0.53;
    group.add(hub);

    const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20);
    [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wGeo, MAT.robotDark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.11, z);
      group.add(w);
    });

    const lightMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.2 });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), lightMat);
    light.position.set(1.2, 0.53, 0);
    group.add(light);

    group.name = name;
    group.castShadow = true;
    scene.add(group);
    objects.push(group);
    return group;
  }

  // Pallet w/ Cargo( x, z, stackHeight )

  function pallet(px, pz, stackH = 1.2) {
    const group = new THREE.Group();
    group.position.set(px, 0, pz);

    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.5), MAT.pallet);
      m.position.set(0, 0.1, -1.5 + i * 1.5);
      group.add(m);
    }
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 0.35), MAT.pallet);
      m.position.set(0, 0.28, -1.6 + i * 0.8);
      group.add(m);
    }
    if (stackH > 0) {
      const rows = Math.ceil(stackH / 0.8);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          for (let s = 0; s < 2; s++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.5), MAT.box);
            m.position.set(-0.9 + c * 1.85, 0.5 + r * 0.72, -0.75 + s * 1.55);
            m.castShadow = true;
            group.add(m);
          }
        }
      }
    }

    group.name = 'Pallet + Cargo';
    group.castShadow = true;
    scene.add(group);
    objects.push(group);
    return group;
  }

  //Plain pallet (no cargo)
  function plainPallet(px, pz, y = 0) {
    const group = new THREE.Group();
    group.position.set(px, y, pz);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.5), MAT.pallet);
      m.position.set(0, 0.1, -1.5 + i * 1.5);
      group.add(m);
    }
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 0.35), MAT.pallet);
      m.position.set(0, 0.28, -1.6 + i * 0.8);
      group.add(m);
    }
    group.name = 'Pallet';
    group.castShadow = true;
    scene.add(group);
    objects.push(group);
    return group;
  }

  // Canned blue pallet

  function bluePallet(px, pz) {
    const group = new THREE.Group();
    group.position.set(px, 0, pz);
    const pm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 3.5), MAT.pallet);
    pm.position.y = 0.15;
    group.add(pm);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.0, 3.2), MAT.bluePallet);
    bm.position.y = 1.8;
    group.add(bm);
    group.name = 'Blue Wrapped Pallet';
    group.castShadow = true;
    scene.add(group);
    objects.push(group);
    return group;
  }

  // Camera Markers

  const cameraMarkers = [];

  function cameraMarker(px, py, pz, label, camIndex) {
    const group = new THREE.Group();
    group.position.set(px, py, pz);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 0.7), MAT.camMarker);
    group.add(body);

    const lensMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.3, transparent: true, opacity: 0.3 });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 12), lensMat);
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 0.62;
    group.add(lens);

    const canvas2 = document.createElement('canvas');
    canvas2.width = 256;
    canvas2.height = 64;
    const ctx2 = canvas2.getContext('2d');
    ctx2.fillStyle = 'rgba(0,0,0,0.7)';
    ctx2.fillRect(0, 0, 256, 64);
    ctx2.font = 'bold 22px Courier New';
    ctx2.fillStyle = '#00e5a0';
    ctx2.textAlign = 'center';
    ctx2.fillText(label, 128, 40);
    const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas2), depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(5, 1.5, 1);
    sprite.position.y = 1.5;
    group.add(sprite);

    group.name = label;
    group.userData = { camIndex };
    scene.add(group);
    objects.push(group);
    cameraMarkers.push(group);
    return group;
  }

  // ------------------------------------------------------
  // DEMO OBJECTS (80x60 ft) — uncomment to place in scene
  // ------------------------------------------------------

  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT.floor);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(W / 2, 0, D / 2);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'Floor';
  scene.add(floorMesh);

  const gridHelper = (() => {
    const cell = 2;
    const cols = Math.round(W / cell);
    const rows = Math.round(D / cell);
    const pts = [];
    for (let i = 0; i <= cols; i++) {
      const x = i * cell;
      pts.push(x, 0, 0, x, 0, D);
    }
    for (let j = 0; j <= rows; j++) {
      const z = j * cell;
      pts.push(0, 0, z, W, 0, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x00e5a0, transparent: true, opacity: 0.25,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.position.y = 0.01;
    lines.name = '__grid';
    return lines;
  })();
  scene.add(gridHelper);

  //-----------------------------------------------------------------------

  // Boundary Walls

  // North wall — CAM1 to CAM4
  box(W, H, 0.5, MAT.wall, W / 2, 0, 0);

  // South wall - CAM2 to CAM3
  box(W, H, 0.5, MAT.wall, W / 2, 0, D);

  // East wall — CAM1 to CAM2 + garage door
  box(0.5, H, 30, MAT.wall, W, 0, 45);
  box(0.5, H - 12, 30, MAT.wall, W, 12, 15);

  // West wall — CAM3 to CAM4 + red door
  box(0.5, H, 8, MAT.wall, 0, 0, 4);
  box(0.5, H, 45, MAT.wall, 0, 0, 37.5);
  box(0.5, H - 8, 7, MAT.wall, 0, 8, 11.5);

  //-----------------------------------------------------------------------

  // Garage door - east wall

  for (let i = 0; i < 5; i++) {
    const panelY = (i / 5) * 12;
    box(0.4, 12 / 5 - 0.1, 30, MAT.garage, W, panelY + 0.05, 15, i === 0 ? 'Garage Door' : null);
  }

  //-----------------------------------------------------------------------

  // Red door - west wall

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.4 });
  box(0.6, 7.5, 3.5, MAT.door, 0, 0, 9.75, 'Red Door');
  box(0.6, 7.5, 3.5, MAT.door, 0, 0, 13.25);
  box(0.7, 8, 0.3, frameMat, 0, 0, 7.85);
  box(0.7, 8, 0.3, frameMat, 0, 0, 15.15);
  box(0.7, 0.3, 7.2, frameMat, 0, 7.9, 11.5);

  //-----------------------------------------------------------------------

  // Ceiling

  const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT.ceiling);
  ceilMesh.rotation.x = Math.PI / 2;
  ceilMesh.position.set(W / 2, H, D / 2);
  ceilMesh.name = 'Ceiling';
  scene.add(ceilMesh);

  //-----------------------------------------------------------------------

  // Ceiling lights

  const fixMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 1.5 });
  [
    [20, 10], [40, 10], [60, 10],
    [20, 30], [40, 30], [60, 30],
    [20, 50], [40, 50], [60, 50],
  ].forEach(([x, z]) => {
    const fix = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.8), fixMat);
    fix.position.set(x, H - 0.2, z);
    scene.add(fix);
    const ptLight = new THREE.PointLight(0xfff5e0, 0.8, 40);
    ptLight.position.set(x, H - 1, z);
    ptLight.castShadow = true;
    ptLight.shadow.mapSize.width = 256;
    ptLight.shadow.mapSize.height = 256;
    scene.add(ptLight);
  });

  //-----------------------------------------------------------------------

  // Ambient light + hemisphere

  const ambient = new THREE.AmbientLight(0x334455, 0.6);
  scene.add(ambient);
  scene.add(new THREE.HemisphereLight(0x8899aa, 0x332211, 0.3));

  //-----------------------------------------------------------------------

  // Floor grates

  const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.9 });
  box(45, 0.05, 2, ventMat, 57, 0, 5); // North
  box(45, 0.05, 2, ventMat, 57, 0, 32); // South

  //-----------------------------------------------------------------------

  // Blue tape floor markings

  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x0055cc, roughness: 0.8 });
  [10, 25, 40, 55].forEach(z => box(50, 0.01, 0.15, tapeMat, 40, 0, z));
  [20, 40, 60].forEach(x => box(0.15, 0.01, 40, tapeMat, x, 0, D / 2));

  //-----------------------------------------------------------------------

  // Pink tape CE markings

  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff4488, roughness: 0.8 });
  // SW CE, W CE, NW CE, NE, E, SE
  [[40, 57], [40, 30], [40, 3], [75, 3], [75, 30], [75, 57]].forEach(([x, z]) => {
    box(1.2, 0.02, 1.2, pinkMat, x, 0, z);
  });

  //-----------------------------------------------------------------------

  // Shelf units( x, z, width, depth, height, levels )
  // 3 shelves N CE

  shelfUnit(29, 13, 4, 4, 6, 1);
  shelfUnit(29, 18, 4, 4, 6, 1);
  shelfUnit(29, 23, 4, 4, 6, 1);

  // 6 shelves NE CE

  shelfUnit(46, 13, 4, 4, 6, 1);
  shelfUnit(51, 13, 4, 4, 6, 1);
  shelfUnit(46, 18, 4, 4, 6, 1);
  shelfUnit(51, 18, 4, 4, 6, 1);
  shelfUnit(46, 23, 4, 4, 6, 1);
  shelfUnit(51, 23, 4, 4, 6, 1);

  // 3 shelves W

  shelfUnit(23, 39, 4, 4, 6, 1);
  shelfUnit(23, 44, 4, 4, 6, 1);
  shelfUnit(23, 49, 4, 4, 6, 1);

  //-----------------------------------------------------------------------

  // AMR Robots( x, z, rotationY, name )

  robot(14, 40, Math.PI / 3, 'AMR-01');
  robot(14, 45, -Math.PI / 5, 'AMR-02');
  robot(14, 50, 0.2, 'AMR-03');

  robot(41, 43, Math.PI / 6, 'AMR-04');
  robot(46, 46, -0.3, 'AMR-05');
  robot(52, 46, Math.PI, 'AMR-06');

  robot(62, 41, 0, 'AMR-07');
  robot(62, 36, Math.PI, 'AMR-08');

  //-----------------------------------------------------------------------

  // Blue wrapped pallet (canned chicken)

  const blueCannedPallet = new THREE.Group();
  blueCannedPallet.position.set(16, 0, 32);
  (() => {
    const pm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 3.5), MAT.pallet);
    pm.position.y = 0.15;
    blueCannedPallet.add(pm);
    const bm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.0, 3.2), MAT.bluePallet);
    bm.position.y = 1.8;
    blueCannedPallet.add(bm);
  })();
  blueCannedPallet.name = 'Blue Wrapped Pallet (Canned Chicken)';
  scene.add(blueCannedPallet);
  objects.push(blueCannedPallet);


  //-----------------------------------------------------------------------

  // Pallet w/ Cargo + Plain pallet (no cargo)


  plainPallet(23, 57, 1.2);
  pallet(16, 24, 3);
  pallet(69, 26, 3);
  pallet(10, 3, 3);
  pallet(15, 3, 3);

  //-----------------------------------------------------------------------

  // Workbenches + computer screens

  const benchMat = new THREE.MeshStandardMaterial({ color: 0x9a7040, roughness: 0.9 });
  const screenProp = new THREE.MeshStandardMaterial({ color: 0x112233 });
  box(20, 0.8, 2.5, benchMat, 34, 0, 1.5, 'Workbench North');
  box(16, 0.8, 2.5, benchMat, 60, 0, 1.5, 'Workbench NE');
  box(72, 0.8, 2.5, benchMat, 41, 0, 58.5, 'Workbench South');
  box(4.5, 0.8, 18, benchMat, 2.5, 0, 48, 'Workbench SW');

  box(0.1, 1.2, 2.5, screenProp, 2.5, 1.2, 46);
  box(0.1, 1.2, 2.5, screenProp, 2.5, 1.2, 52);

  box(2, 2.5, 1.5, MAT.yellow, 71, 0, 6, 'Equipment Cart');

  //-----------------------------------------------------------------------


  // Color boxes

  box(1.5, 1.5, 1.5, new THREE.MeshStandardMaterial({ color: 0x22bb44 }), 58, 1, 59, 'Storage Box (Green)');
  box(1.5, 1.5, 1.5, new THREE.MeshStandardMaterial({ color: 0x2244cc }), 62, 1, 59, 'Storage Box (Blue)');
  box(1.5, 1.5, 1.5, new THREE.MeshStandardMaterial({ color: 0xdd2222 }), 60, 1, 59, 'Storage Box (Red)');
  box(1.5, 1.5, 1.5, new THREE.MeshStandardMaterial({ color: 0xddbb00 }), 64, 1, 59, 'Storage Box (Yellow)');

  //-----------------------------------------------------------------------

  // Camera markers (see thorough)

  cameraMarker(78, H - 1, 2, 'CAM 1', 0);
  cameraMarker(78, H - 1, 58, 'CAM 2', 1);
  cameraMarker(2, H - 1, 58, 'CAM 3', 2);
  cameraMarker(2, H - 1, 2, 'CAM 4', 3);

  //-----------------------------------------------------------------------

  // Camera target postions

  const camPositions = [
    { pos: new THREE.Vector3(78, H - 1, 2), target: new THREE.Vector3(25, 5, 40) },  // CAM 1 — NE
    { pos: new THREE.Vector3(78, H - 1, 58), target: new THREE.Vector3(30, 5, 25) }, // CAM 2 — SE
    { pos: new THREE.Vector3(2, H - 1, 58), target: new THREE.Vector3(42, 5, 22) },  // CAM 3 — SW
    { pos: new THREE.Vector3(2, H - 1, 2), target: new THREE.Vector3(55, 5, 40) },   // CAM 4 — NW
  ];

  //-----------------------------------------------------------------------

  const dollhousePos = { pos: new THREE.Vector3(55, 60, 85), target: new THREE.Vector3(W / 2, 0, D / 2) };
  const topPos = { pos: new THREE.Vector3(W / 2, 100, D / 2 + 0.01), target: new THREE.Vector3(W / 2, 0, D / 2) };

  window.WH = window.WH || {};
  window.WH.factories = { box, cylinder, shelfUnit, robot, pallet, plainPallet, bluePallet, cameraMarker };

  return { gridHelper, ambient, cameraMarkers, camPositions, dollhousePos, topPos };

};