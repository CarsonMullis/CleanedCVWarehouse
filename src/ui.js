/**
 * ui.js - Panel interactions, button handlers, object list
 * Runs after scene.js (WH namespace is already populated)
 */

'use strict';

( function () {

  // Populate object list in right panel
  const list = document.getElementById( 'obj-list' );

  const COLORS = {
    'AMR':     '#22cc66',
    'Shelf':   '#8ab0cc',
    'Pallet':  '#c8a060',
    'Bench':   '#9a7040',
    'Wall':    '#6a7080',
    'Floor':   '#5a6070',
    'Crate':   '#aa8050',
    'Blue':    '#2060cc',
    'CAM':     '#ff3355',
    'default': '#556080',
  };

  function dotColor( name ) {
    for ( const key of Object.keys(COLORS) ) {
      if ( name.includes(key) ) return COLORS[key];
    }
    return COLORS.default;
  }

  const objectsToList = WH.objects.filter( o =>
    !o.name.startsWith('__') && !['Floor','Ceiling','North Wall','South Wall','East Wall','West Wall'].includes(o.name)
  );

  objectsToList.forEach( obj => {
    const li   = document.createElement('li');
    li.dataset.name = obj.name;
    const dot  = document.createElement('span');
    dot.className = 'obj-dot';
    dot.style.background = dotColor( obj.name );
    li.appendChild( dot );
    li.appendChild( document.createTextNode( obj.name ) );
    li.addEventListener( 'click', () => {
      const bb  = new THREE.Box3().setFromObject( obj );
      const ctr = new THREE.Vector3();
      bb.getCenter( ctr );
      const sz  = new THREE.Vector3();
      bb.getSize( sz );
      const dist = Math.max( sz.x, sz.y, sz.z ) * 2.5 + 8;
      const pos  = ctr.clone().add( new THREE.Vector3( dist*0.6, dist*0.5, dist*0.8 ) );
      WH.flyTo( pos, ctr );
      document.querySelectorAll('#obj-list li').forEach( l => l.classList.remove('selected') );
      li.classList.add('selected');
    });
    list.appendChild( li );
  });

  // Search filter for object list
  const searchInput = document.getElementById( 'search-input' );
  searchInput.addEventListener( 'input', () => {
    const filter = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('#obj-list li').forEach( li => {
      const text = li.textContent.trim().toLowerCase();
      li.style.display = text.includes(filter) ? 'block' : 'none';
    });
  });

  // Overlay state
  const overlayImg  = document.getElementById('cam-overlay');
  let   overlayOn   = false;
  let   currentCam  = 0;
  let   flipH       = false;
  let   flipV       = false;
  let   rotation    = 0;   // degrees: 0, 90, 180, 270

  const camSrcs = [ 'assets/cam1.jpg', 'assets/cam2.jpg', 'assets/cam3.jpg', 'assets/cam4.jpg' ];

  function applyTransform() {
    const scaleX = flipH ? -1 : 1;
    const scaleY = flipV ? -1 : 1;
    // scale compensation so rotated image still fills the viewport
    const w = overlayImg.parentElement.clientWidth  || 1;
    const h = overlayImg.parentElement.clientHeight || 1;
    const fill = ( rotation === 90 || rotation === 270 ) ? Math.max( w / h, h / w ) : 1;
    overlayImg.style.transform = `rotate(${rotation}deg) scale(${scaleX * fill}, ${scaleY * fill})`;
  }

  function setOverlay( idx ) {
    currentCam = idx;
    overlayImg.src = camSrcs[ idx ];
    overlayImg.classList.toggle( 'visible', overlayOn );
    if ( overlayOn ) applyTransform();
  }

  document.getElementById('btn-overlay').addEventListener('click', function () {
    overlayOn = !overlayOn;
    this.classList.toggle('active', overlayOn);
    if ( overlayOn ) {
      overlayImg.src = camSrcs[ currentCam ];
      applyTransform();
    }
    overlayImg.classList.toggle( 'visible', overlayOn );
  });

  document.getElementById('sl-overlay').addEventListener('input', function () {
    overlayImg.style.opacity = this.value / 100;
  });

  document.getElementById('btn-flip-h').addEventListener('click', function () {
    flipH = !flipH;
    this.classList.toggle('active', flipH);
    applyTransform();
  });

  document.getElementById('btn-flip-v').addEventListener('click', function () {
    flipV = !flipV;
    this.classList.toggle('active', flipV);
    applyTransform();
  });

  document.getElementById('btn-rot-ccw').addEventListener('click', () => {
    rotation = ( rotation - 90 + 360 ) % 360;
    applyTransform();
  });

  document.getElementById('btn-rot-cw').addEventListener('click', () => {
    rotation = ( rotation + 90 ) % 360;
    applyTransform();
  });

  // Camera card clicks - fly to that camera position
  document.querySelectorAll('.cam-card').forEach( card => {
    card.addEventListener( 'click', () => {
      document.querySelectorAll('.cam-card').forEach( c => c.classList.remove('active') );
      card.classList.add('active');

      const idx = parseInt( card.dataset.cam );
      const cp  = WH.camPositions[ idx ];
      if ( cp ) WH.flyTo( cp.pos, cp.target );

      document.getElementById('cam-info').textContent =
        `Viewing from ${card.querySelector('.cam-label').textContent}`;

      setOverlay( idx );
    });
  });

  // Top toolbar buttons
  document.getElementById('btn-dollhouse').addEventListener('click', () => {
    WH.flyTo( WH.dollhousePos.pos, WH.dollhousePos.target );
    setActive('btn-dollhouse');
  });

  document.getElementById('btn-top').addEventListener('click', () => {
    WH.flyTo( WH.topPos.pos, WH.topPos.target, 900 );
    setActive('btn-top');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    WH.controls.reset();
    setActive(null);
  });

  let wireframe = false;
  document.getElementById('btn-wireframe').addEventListener('click', function () {
    wireframe = !wireframe;
    WH.scene.traverse( obj => {
      if ( obj.isMesh && obj.material && !obj.material.__isFloor ) {
        obj.material.wireframe = wireframe;
      }
    });
    this.classList.toggle('active', wireframe);
  });

  function setActive( id ) {
    ['btn-dollhouse','btn-top'].forEach( bid => {
      document.getElementById(bid).classList.toggle('active', bid === id);
    });
  }

  // Ambient light slider
  document.getElementById('sl-ambient').addEventListener('input', function () {
    WH.ambient.intensity = this.value / 100 * 1.2;
  });

  // Global opacity slider
  document.getElementById('sl-opacity').addEventListener('input', function () {
    const op = this.value / 100;
    WH.scene.traverse( obj => {
      if ( obj.isMesh && obj.material ) {
        obj.material.transparent = op < 1;
        obj.material.opacity = op;
      }
    });
  });

  // Grid toggle
  document.getElementById('cb-grid').addEventListener('change', function () {
    WH.gridHelper.visible = this.checked;
  });

  // Camera markers toggle
  document.getElementById('cb-cameras').addEventListener('change', function () {
    ( WH.cameraMarkers || [] ).forEach( m => { m.visible = this.checked; } );
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    switch ( e.key ) {
      case 'd': document.getElementById('btn-dollhouse').click(); break;
      case 't': document.getElementById('btn-top').click();       break;
      case 'r': document.getElementById('btn-reset').click();     break;
      case 'w': document.getElementById('btn-wireframe').click(); break;
      case '1': case '2': case '3': case '4': {
        const card = document.querySelector(`.cam-card[data-cam="${ parseInt(e.key)-1 }"]`);
        if ( card ) card.click();
        break;
      }
    }
  });

  // Dismiss hint after 5s
  setTimeout( () => {
    const hint = document.getElementById('overlay-hint');
    hint.style.transition = 'opacity 1s';
    hint.style.opacity    = '0';
    setTimeout( () => hint.remove(), 1000 );
  }, 5000 );

} )();
