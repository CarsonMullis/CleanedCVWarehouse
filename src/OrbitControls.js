/**
 * OrbitControls for Three.js r128
 * Adapted from the official Three.js examples — included inline so no build
 * step is required.  Drop this file next to your index.html.
 */
( function () {

  'use strict';

  const _changeEvent = { type: 'change' };
  const _startEvent  = { type: 'start' };
  const _endEvent    = { type: 'end' };

  class OrbitControls extends THREE.EventDispatcher {

    constructor ( object, domElement ) {

      super();

      if ( domElement === undefined ) console.warn( 'THREE.OrbitControls: The second parameter "domElement" is now mandatory.' );
      if ( domElement === document ) console.error( 'THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.' );

      this.object     = object;
      this.domElement = domElement;
      this.domElement.style.touchAction = 'none';

      this.enabled       = true;
      this.target        = new THREE.Vector3();
      this.minDistance   = 0;
      this.maxDistance   = Infinity;
      this.minZoom       = 0;
      this.maxZoom       = Infinity;
      this.minPolarAngle = 0;
      this.maxPolarAngle = Math.PI;
      this.minAzimuthAngle = - Infinity;
      this.maxAzimuthAngle =   Infinity;
      this.enableDamping   = false;
      this.dampingFactor   = 0.05;
      this.enableZoom      = true;
      this.zoomSpeed       = 1.0;
      this.enableRotate    = true;
      this.rotateSpeed     = 1.0;
      this.enablePan       = true;
      this.panSpeed        = 1.0;
      this.screenSpacePanning = true;
      this.keyPanSpeed        = 7.0;
      this.autoRotate         = false;
      this.autoRotateSpeed    = 2.0;
      this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
      this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
      this.target0   = this.target.clone();
      this.position0 = this.object.position.clone();
      this.zoom0     = this.object.zoom;
      this._domElementKeyEvents = null;

      // ── internals ──────────────────────────────────────────────────────────

      const scope = this;
      const STATE  = { NONE:-1, ROTATE:0, DOLLY:1, PAN:2, TOUCH_ROTATE:3, TOUCH_PAN:4, TOUCH_DOLLY_PAN:5, TOUCH_DOLLY_ROTATE:6 };
      let   state  = STATE.NONE;

      const EPS = 0.000001;
      const spherical      = new THREE.Spherical();
      const sphericalDelta = new THREE.Spherical();
      let   scale = 1;
      const panOffset = new THREE.Vector3();
      let   zoomChanged = false;

      const rotateStart = new THREE.Vector2();
      const rotateEnd   = new THREE.Vector2();
      const rotateDelta = new THREE.Vector2();
      const panStart    = new THREE.Vector2();
      const panEnd      = new THREE.Vector2();
      const panDelta    = new THREE.Vector2();
      const dollyStart  = new THREE.Vector2();
      const dollyEnd    = new THREE.Vector2();
      const dollyDelta  = new THREE.Vector2();
      const pointers    = [];
      const pointerPositions = {};

      function getAutoRotationAngle() { return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed; }
      function getZoomScale()         { return Math.pow( 0.95, scope.zoomSpeed ); }

      function rotateLeft( angle )  { sphericalDelta.theta -= angle; }
      function rotateUp( angle )    { sphericalDelta.phi   -= angle; }

      const panLeft = function () {
        const v = new THREE.Vector3();
        return function panLeft( distance, objectMatrix ) {
          v.setFromMatrixColumn( objectMatrix, 0 );
          v.multiplyScalar( - distance );
          panOffset.add( v );
        };
      }();

      const panUp = function () {
        const v = new THREE.Vector3();
        return function panUp( distance, objectMatrix ) {
          if ( scope.screenSpacePanning ) {
            v.setFromMatrixColumn( objectMatrix, 1 );
          } else {
            v.setFromMatrixColumn( objectMatrix, 0 );
            v.crossVectors( scope.object.up, v );
          }
          v.multiplyScalar( distance );
          panOffset.add( v );
        };
      }();

      const pan = function () {
        const offset = new THREE.Vector3();
        return function pan( deltaX, deltaY ) {
          const el = scope.domElement;
          if ( scope.object.isPerspectiveCamera ) {
            const pos = scope.object.position;
            offset.copy( pos ).sub( scope.target );
            let targetDist = offset.length();
            targetDist *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );
            panLeft( 2 * deltaX * targetDist / el.clientHeight, scope.object.matrix );
            panUp(   2 * deltaY * targetDist / el.clientHeight, scope.object.matrix );
          } else if ( scope.object.isOrthographicCamera ) {
            panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / el.clientWidth,  scope.object.matrix );
            panUp(   deltaY * ( scope.object.top   - scope.object.bottom) / scope.object.zoom / el.clientHeight, scope.object.matrix );
          }
        };
      }();

      function dollyOut( dollyScale ) { if ( scope.object.isPerspectiveCamera ) { scale /= dollyScale; } else if ( scope.object.isOrthographicCamera ) { scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) ); scope.object.updateProjectionMatrix(); zoomChanged = true; } }
      function dollyIn(  dollyScale ) { if ( scope.object.isPerspectiveCamera ) { scale *= dollyScale; } else if ( scope.object.isOrthographicCamera ) { scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) ); scope.object.updateProjectionMatrix(); zoomChanged = true; } }

      this.update = function () {
        const offset   = new THREE.Vector3();
        const quat     = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
        const quatInv  = quat.clone().invert();
        const lastPos  = new THREE.Vector3();
        const lastQuat = new THREE.Quaternion();
        return function update() {
          const pos = scope.object.position;
          offset.copy( pos ).sub( scope.target );
          offset.applyQuaternion( quat );
          spherical.setFromVector3( offset );
          if ( scope.autoRotate && state === STATE.NONE ) rotateLeft( getAutoRotationAngle() );
          if ( scope.enableDamping ) {
            spherical.theta += sphericalDelta.theta * scope.dampingFactor;
            spherical.phi   += sphericalDelta.phi   * scope.dampingFactor;
          } else {
            spherical.theta += sphericalDelta.theta;
            spherical.phi   += sphericalDelta.phi;
          }
          let min = scope.minAzimuthAngle, max = scope.maxAzimuthAngle;
          if ( isFinite( min ) && isFinite( max ) ) {
            if ( min < - Math.PI ) min += 2*Math.PI; else if ( min > Math.PI ) min -= 2*Math.PI;
            if ( max < - Math.PI ) max += 2*Math.PI; else if ( max > Math.PI ) max -= 2*Math.PI;
            if ( min <= max ) spherical.theta = Math.max( min, Math.min( max, spherical.theta ) );
            else spherical.theta = ( spherical.theta > ( min + max ) / 2 ) ? Math.max( min, spherical.theta ) : Math.min( max, spherical.theta );
          }
          spherical.phi    = Math.max( scope.minPolarAngle + EPS, Math.min( scope.maxPolarAngle - EPS, spherical.phi ) );
          spherical.makeSafe();
          spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius * scale ) );
          if ( scope.enableDamping ) scope.target.addScaledVector( panOffset, scope.dampingFactor );
          else scope.target.add( panOffset );
          offset.setFromSpherical( spherical );
          offset.applyQuaternion( quatInv );
          pos.copy( scope.target ).add( offset );
          scope.object.lookAt( scope.target );
          if ( scope.enableDamping ) {
            sphericalDelta.theta *= ( 1 - scope.dampingFactor );
            sphericalDelta.phi   *= ( 1 - scope.dampingFactor );
            panOffset.multiplyScalar( 1 - scope.dampingFactor );
          } else {
            sphericalDelta.set( 0, 0, 0 );
            panOffset.set( 0, 0, 0 );
          }
          scale = 1;
          if ( zoomChanged || lastPos.distanceToSquared( scope.object.position ) > EPS || 8 * ( 1 - lastQuat.dot( scope.object.quaternion ) ) > EPS ) {
            scope.dispatchEvent( _changeEvent );
            lastPos.copy( scope.object.position );
            lastQuat.copy( scope.object.quaternion );
            zoomChanged = false;
            return true;
          }
          return false;
        };
      }();

      this.saveState = function () { scope.target0.copy( scope.target ); scope.position0.copy( scope.object.position ); scope.zoom0 = scope.object.zoom; };
      this.reset = function () { scope.target.copy( scope.target0 ); scope.object.position.copy( scope.position0 ); scope.object.zoom = scope.zoom0; scope.object.updateProjectionMatrix(); scope.dispatchEvent( _changeEvent ); scope.update(); state = STATE.NONE; };
      this.dispose = function () { scope.domElement.removeEventListener( 'contextmenu', onContextMenu ); scope.domElement.removeEventListener( 'pointerdown', onPointerDown ); scope.domElement.removeEventListener( 'pointercancel', onPointerCancel ); scope.domElement.removeEventListener( 'wheel', onMouseWheel ); scope.domElement.removeEventListener( 'pointermove', onPointerMove ); scope.domElement.removeEventListener( 'pointerup', onPointerUp ); if ( scope._domElementKeyEvents !== null ) { scope._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown ); } };

      // ── event handlers (minimal but complete) ─────────────────────────────

      function onPointerDown(e) {
        if ( !scope.enabled ) return;
        if ( pointers.length === 0 ) { scope.domElement.setPointerCapture( e.pointerId ); scope.domElement.addEventListener( 'pointermove', onPointerMove ); scope.domElement.addEventListener( 'pointerup', onPointerUp ); }
        addPointer( e );
        if ( e.pointerType === 'touch' ) onTouchStart( e ); else onMouseDown( e );
      }
      function onPointerMove(e)   { if ( !scope.enabled ) return; if ( e.pointerType === 'touch' ) onTouchMove( e ); else onMouseMove( e ); }
      function onPointerUp(e)     { removePointer( e ); if ( pointers.length === 0 ) { scope.domElement.releasePointerCapture( e.pointerId ); scope.domElement.removeEventListener( 'pointermove', onPointerMove ); scope.domElement.removeEventListener( 'pointerup', onPointerUp ); } scope.dispatchEvent( _endEvent ); state = STATE.NONE; }
      function onPointerCancel(e) { removePointer( e ); }
      function addPointer(e)      { pointers.push(e); }
      function removePointer(e)   { delete pointerPositions[ e.pointerId ]; for ( let i=0; i<pointers.length; i++ ) if ( pointers[i].pointerId === e.pointerId ) { pointers.splice(i,1); return; } }
      function trackPointer(e)    { let pos = pointerPositions[ e.pointerId ]; if ( pos === undefined ) { pos = new THREE.Vector2(); pointerPositions[ e.pointerId ] = pos; } pos.set( e.pageX, e.pageY ); }
      function getSecondPointerPosition(e) { const p = ( e.pointerId === pointers[0].pointerId ) ? pointers[1] : pointers[0]; return pointerPositions[ p.pointerId ]; }

      function onMouseDown(e) {
        let mb;
        switch ( e.button ) {
          case 0: mb = scope.mouseButtons.LEFT;   break;
          case 1: mb = scope.mouseButtons.MIDDLE; break;
          case 2: mb = scope.mouseButtons.RIGHT;  break;
          default: mb = -1;
        }
        switch ( mb ) {
          case THREE.MOUSE.DOLLY: if ( !scope.enableZoom   ) return; dollyStart.set(e.clientX,e.clientY); state=STATE.DOLLY;  break;
          case THREE.MOUSE.ROTATE: if(e.ctrlKey||e.metaKey||e.shiftKey){ if(!scope.enablePan)return; panStart.set(e.clientX,e.clientY);state=STATE.PAN; }else{ if(!scope.enableRotate)return; rotateStart.set(e.clientX,e.clientY);state=STATE.ROTATE; } break;
          case THREE.MOUSE.PAN:   if(e.ctrlKey||e.metaKey||e.shiftKey){ if(!scope.enableRotate)return; rotateStart.set(e.clientX,e.clientY);state=STATE.ROTATE; }else{ if(!scope.enablePan)return; panStart.set(e.clientX,e.clientY);state=STATE.PAN; } break;
          default: state=STATE.NONE;
        }
        if ( state !== STATE.NONE ) scope.dispatchEvent( _startEvent );
      }

      function onMouseMove(e) {
        if ( !scope.enabled ) return;
        switch ( state ) {
          case STATE.ROTATE: if(!scope.enableRotate)return; rotateEnd.set(e.clientX,e.clientY); rotateDelta.subVectors(rotateEnd,rotateStart).multiplyScalar(scope.rotateSpeed); const el=scope.domElement; rotateLeft(2*Math.PI*rotateDelta.x/el.clientHeight); rotateUp(2*Math.PI*rotateDelta.y/el.clientHeight); rotateStart.copy(rotateEnd); break;
          case STATE.DOLLY:  if(!scope.enableZoom)return;   dollyEnd.set(e.clientX,e.clientY);  dollyDelta.subVectors(dollyEnd,dollyStart);  dollyDelta.y>0?dollyOut(getZoomScale()):dollyDelta.y<0?dollyIn(getZoomScale()):void 0; dollyStart.copy(dollyEnd); break;
          case STATE.PAN:    if(!scope.enablePan)return;    panEnd.set(e.clientX,e.clientY);    panDelta.subVectors(panEnd,panStart).multiplyScalar(scope.panSpeed); pan(panDelta.x,panDelta.y); panStart.copy(panEnd); break;
        }
        if ( state !== STATE.NONE ) scope.update();
      }

      function onMouseWheel(e) { if(!scope.enabled||!scope.enableZoom||(state!==STATE.NONE&&state!==STATE.ROTATE))return; e.preventDefault(); scope.dispatchEvent(_startEvent); e.deltaY<0?dollyIn(getZoomScale()):e.deltaY>0?dollyOut(getZoomScale()):void 0; scope.update(); scope.dispatchEvent(_endEvent); }
      function onKeyDown(e) { if(!scope.enabled||!scope.enablePan)return; switch(e.code){case scope.keys.UP:pan(0,scope.keyPanSpeed);scope.update();break;case scope.keys.BOTTOM:pan(0,-scope.keyPanSpeed);scope.update();break;case scope.keys.LEFT:pan(scope.keyPanSpeed,0);scope.update();break;case scope.keys.RIGHT:pan(-scope.keyPanSpeed,0);scope.update();break;} }

      function onTouchStart(e) { trackPointer(e); switch(pointers.length){case 1:if(!scope.enableRotate)return;rotateStart.set(e.pageX,e.pageY);state=STATE.TOUCH_ROTATE;break;case 2:if(!scope.enableZoom&&!scope.enablePan)return;const p=getSecondPointerPosition(e);dollyStart.set(0.5*(e.pageX+p.x),0.5*(e.pageY+p.y));break;}}
      function onTouchMove(e)  { trackPointer(e); switch(state){case STATE.TOUCH_ROTATE:if(!scope.enableRotate)return;rotateEnd.set(e.pageX,e.pageY);rotateDelta.subVectors(rotateEnd,rotateStart).multiplyScalar(scope.rotateSpeed);const el2=scope.domElement;rotateLeft(2*Math.PI*rotateDelta.x/el2.clientHeight);rotateUp(2*Math.PI*rotateDelta.y/el2.clientHeight);rotateStart.copy(rotateEnd);scope.update();break;case STATE.TOUCH_DOLLY_PAN:case STATE.TOUCH_DOLLY_ROTATE:if(!scope.enableZoom&&!scope.enablePan)return;const p2=getSecondPointerPosition(e);dollyEnd.set(0.5*(e.pageX+p2.x),0.5*(e.pageY+p2.y));dollyDelta.subVectors(dollyEnd,dollyStart);dollyDelta.y>0?dollyOut(getZoomScale()):dollyDelta.y<0?dollyIn(getZoomScale()):void 0;dollyStart.copy(dollyEnd);scope.update();break;}}

      function onContextMenu(e) { if ( !scope.enabled ) return; e.preventDefault(); }

      scope.domElement.addEventListener( 'contextmenu', onContextMenu );
      scope.domElement.addEventListener( 'pointerdown', onPointerDown );
      scope.domElement.addEventListener( 'pointercancel', onPointerCancel );
      scope.domElement.addEventListener( 'wheel', onMouseWheel, { passive: false } );

      this.update();
    }

  }

  THREE.OrbitControls = OrbitControls;

} )();
