'use strict';

//Alex Pilafian 2016-2019 - sikanrong@gmail.com
// George Owen 2023 - gbo.owen@gmail.com
// original repository: https://github.com/windfish-studio/three-map-controls

import {
    Box2,
    Box3,
    Quaternion,
    EventDispatcher,
    Vector2,
    Vector3,
    Raycaster,
    Ray,
    MOUSE
} from 'three'

//test stubs
if(typeof window == 'undefined'){
    let window = require('../test/stub_dom');
}

class GalleryControls extends EventDispatcher{

        constructor(camera, domElement, options){
            super();

            this.camera = camera;

            //Object to use for listening for keyboard/mouse events
            this.domElement = ( domElement !== undefined ) ? domElement : window.document.body;

            // Set to false to disable this control (Disables all input events)
            this.enabled = true;

            // Must be set to instance of Plane
            this.target;

            // How far you can dolly in and out
            this.minDistance = 1; //probably should never be 0
            this.maxDistance = 100;

            // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
            // Set to false to disable zooming
            this.enableZoom = true;
            this.zoomSpeed = 6.0;
            this.zoomDampingAlpha = 0.1;
            this.initialZoom = 0; //start zoomed all the way out unless set in options.

            // Set to false to disable panning
            this.enablePan = true;
            this.keyPanSpeed = 50.0;	// pixels moved per arrow key push
            this.keyZoomSpeed = this.zoomSpeed;	// keyboard zoom speed, defaults to mouse-wheel zoom speed
            this.panDampingAlpha = 0.1;

            // Set to false to disable use of the keys
            this.enableKeys = true;

            // The four arrow keys, and two zoom keys
            this.keys = {
                PAN_LEFT: "ArrowLeft",
                PAN_UP: "ArrowUp",
                PAN_RIGHT: "ArrowRight",
                PAN_BOTTOM: "ArrowDown",
                ZOOM_IN: "]",
                ZOOM_OUT: "["
            };

            // Mouse buttons
            this.mouseButtons = { ZOOM: MOUSE.MIDDLE, PAN: MOUSE.LEFT };
            
            //Copy options from parameters
            Object.assign(this, options);
            let isTargetValid = false;

            isTargetValid = (this.target.normal !== undefined && this.target.constant !== undefined);

            if(!isTargetValid){
                throw new Error('\'target\' option must be an instance of type THREE.Plane');
            }

            this._eventListeners = {
                'contextmenu': this._onContextMenu.bind(this),
                'mousedown': this._onMouseDown.bind(this),
                'mousewheel': this._onMouseWheel.bind(this),
                'MozMousePixelScroll': this._onMouseWheel.bind(this),
                'touchstart': this._onTouchStart.bind(this),
                'touchend': this._onTouchEnd.bind(this),
                'touchmove': this._onTouchMove.bind(this),
                'keydown': this._onKeyDown.bind(this),
                'mouseover': this._onMouseOver.bind(this),
                'mouseout': this._onMouseOut.bind(this),
                'mousemove': this._onMouseMove.bind(this),
                'mouseup': this._onMouseUp.bind(this)
            };

            this._init();
        }

        _init (){

            this.target0 = this.target.clone();
            this.position0 = this.camera.position.clone();
            this.zoom0 = this.camera.zoom;
            this._changeEvent = { type: 'change' };
            this._startEvent = { type: 'start' };
            this._endEvent = { type: 'end' };

            this._STATES = { NONE : - 1, DOLLY : 1, PAN : 2, TOUCH_DOLLY : 4, TOUCH_PAN : 5 };

            if(this.target.distanceToPoint(this.camera.position) == 0){
                throw new Error("ORIENTATION_UNKNOWABLE: initial Camera position cannot intersect target plane.");
            }

            this._state = this._STATES.NONE;

            this._mouse = new Vector2();

            this._finalTargetDistance = 0;
            this._currentTargetDistance = 0;

            this._panTarget = new Vector3(0,0,0);
            this._panCurrent = new Vector3(0,0,0);

            this._minZoomPosition = new Vector3();
            this._maxZoomPosition = new Vector3();

            this._panStart = new Vector2();
            this._panEnd = new Vector2();
            this._panDelta = new Vector2();

            this._dollyStart = new Vector2();
            this._dollyEnd = new Vector2();
            this._dollyDelta = new Vector2();

            this._camOrientation = new Vector2();

            this._zoomAlpha;

            this._screenWorldXform = Math.tan( ( this.camera.fov / 2 ) * Math.PI / 180.0 );

            //establish initial camera orientation based on position w.r.t. _this.target plane
            this._straightDollyTrack();

            this.camera.position.lerpVectors(this._minZoomPosition, this._maxZoomPosition, this.initialZoom);
            this._finalTargetDistance = this._currentTargetDistance = Math.abs(this.target.distanceToPoint(this.camera.position));

            const res = this._intersectCameraTarget();
            this.camera.lookAt(res.intersection); //set the orientation of the camera towards the map.
            this._camOrientation = res.ray.direction.clone().normalize();

            this._updateZoomAlpha();

            //Assign event listeners

            [
                'contextmenu',
                'mousedown',
                'mousewheel',
                'MozMousePixelScroll',
                'touchstart',
                'touchend',
                'touchmove',
                'mouseover',
                'mouseout',
                'keydown'
            ].forEach(_e => {
                this.domElement.addEventListener(_e, this._eventListeners[_e], false);
            });

            if(this.domElement.tagName == 'CANVAS' &&
               !this.domElement.getAttribute('tabindex')){
                //if we're dealing with a canvas element which has no tabindex,
                //give it one so that it may recieve keyboard focus
                this.domElement.setAttribute('tabindex', '1');
            }

            this.update();
        }

        _intersectCameraTarget(){
            let intersection = new Vector3();
            let ray;

            const coplanar = new Vector3();
            this.target.projectPoint(this.camera.position, coplanar);
            ray = new Ray(this.camera.position, new Vector3().subVectors(coplanar, this.camera.position).normalize());
            ray.intersectPlane(this.target, intersection);

            return {
                intersection: intersection,
                ray: ray
            }
        }

        _straightDollyTrack(){
            this._updateDollyTrack(this._intersectCameraTarget().ray);
        }

        getZoomAlpha () {
            return this._zoomAlpha;
        }

        reset () {

            this.target.copy( this.target0 );
            this.camera.position.copy( this.position0 );
            this.camera.zoom = this.zoom0;

            this.camera.updateProjectionMatrix();

            this._init(); //reinit

            this.dispatchEvent( this._changeEvent );

            this.update();

            this._state = this._STATES.NONE;

        };

        // this method is exposed, but perhaps it would be better if we can make it private...
        update () {
            const panDelta = new Vector3();
            const oldPanCurrent = new Vector3();
            const position = this.camera.position;

            // move target to panned location
            oldPanCurrent.copy(this._panCurrent);
            this._panCurrent.lerp( this._panTarget, this.panDampingAlpha );
            panDelta.subVectors(this._panCurrent, oldPanCurrent);

            this._maxZoomPosition.add(panDelta);
            this._minZoomPosition.add(panDelta);

            position.lerpVectors(this._minZoomPosition, this._maxZoomPosition, this._updateZoomAlpha());
        }

        dispose () {
            Object.keys(this._eventListeners).forEach(_e =>{
                this.domElement.removeEventListener(_e, this._eventListeners[_e], false);
            });
        };

        //returns a bounding box denoting the visible target area
        targetAreaVisible(){

            let bbox, vOffset, hOffset, center;
            var ray = new Ray(this.camera.position, this._camOrientation);
            var depth = ray.distanceToPlane(this.target);

            center = this.camera.position.clone();

            vOffset = this._screenWorldXform * depth;
            hOffset = vOffset * this.camera.aspect;

            bbox = new Box2(
                new Vector2(center.x - hOffset, center.y - vOffset),
                new Vector2(center.x + hOffset, center.y + vOffset)
            );

            return bbox;
        }
    
        targetAreaVisibleDeg() {
            let bbox = this.targetAreaVisible();
            return bbox;
        }

        zoomTo(note) {
            const boundingBox = new Box3;
            boundingBox.setFromObject(note);
            let center = new Vector3();
            boundingBox.getCenter(center);

            
            this._panTarget.copy(center);
            this._panCurrent.copy(this._intersectCameraTarget().intersection);


            this._straightDollyTrack();

            this._finalTargetDistance = 3;
            this.update();
        }

        _updateZoomAlpha(){
            this._finalTargetDistance = Math.max( this.minDistance, Math.min( this.maxDistance, this._finalTargetDistance ) );
            var diff = this._currentTargetDistance - this._finalTargetDistance;
            var damping_alpha = this.zoomDampingAlpha;
            this._currentTargetDistance -= diff * damping_alpha;
            var rounding_places = 100000;
            this._zoomAlpha = Math.abs(Math.round((1 - ((this._currentTargetDistance - this.minDistance) / (this.maxDistance - this.minDistance))) * rounding_places ) / rounding_places);

            return this._zoomAlpha;
        }

        _updateDollyTrack(ray){
            let intersect = new Vector3();
            ray.intersectPlane(this.target, intersect);

            if(intersect){
                this._maxZoomPosition.addVectors(intersect, new Vector3().subVectors(this.camera.position, intersect).normalize().multiplyScalar(this.minDistance));
                this._minZoomPosition.copy(this._calculateMinZoom(this.camera.position, intersect));

                this._finalTargetDistance = this._currentTargetDistance = intersect.clone().sub(this.camera.position).length();
            }
        }

        _getZoomScale(speed) {
            speed = speed || this.zoomSpeed;
            return Math.pow( 0.95, speed );
        }

        _panLeft( distance, cameraMatrix ) {
            var v = new Vector3();

            v.setFromMatrixColumn( cameraMatrix, 0 ); // get Y column of cameraMatrix
            v.multiplyScalar( - distance );

            this._panTarget.add( v );
        }

        _panUp ( distance, cameraMatrix ) {
            var v = new Vector3();

            v.setFromMatrixColumn( cameraMatrix, 1 ); // get Y column of cameraMatrix
            v.multiplyScalar( distance );

            this._panTarget.add( v );
        }

        // deltaX and deltaY are in pixels; right and down are positive
        _pan (deltaX, deltaY) {
            var element = this.domElement;

            var r = new Ray(this.camera.position, this._camOrientation);
            var targetDistance;

            targetDistance = this._screenWorldXform * r.distanceToPlane(this.target);

            // we actually don't use screenWidth, since perspective camera is fixed to screen height
            this._panLeft( 2 * deltaX * targetDistance / element.clientHeight, this.camera.matrix );
            this._panUp( 2 * deltaY * targetDistance / element.clientHeight, this.camera.matrix );

        }

        _dollyIn( dollyScale ) {
            if ( this._cameraOfKnownType() ) {
                this._finalTargetDistance /= dollyScale;
            } else {
                console.warn( 'WARNING: MapControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                this.enableZoom = false;
            }
        }

        _dollyOut( dollyScale ) {
            if ( this._cameraOfKnownType() ) {
                this._finalTargetDistance *= dollyScale;
            } else {
                console.warn( 'WARNING: GalleryControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                this.enableZoom = false;
            }
        }

        _cameraOfKnownType() {
            return this.camera.type === 'PerspectiveCamera'
        }

        _handleUpdateDollyTrackMouse(event){
            var prevMouse = this._mouse.clone();
            this._mouse.set(( event.offsetX / this.domElement.clientWidth ) * 2 - 1, - ( event.offsetY / this.domElement.clientHeight ) * 2 + 1);

            if(!prevMouse.equals(this._mouse)){
                var rc = new Raycaster();
                rc.setFromCamera(this._mouse, this.camera);
                this._updateDollyTrack(rc.ray);
            }
        }

        _handleMouseDownDolly( event ) {
            this._handleUpdateDollyTrackMouse(event);
            this._dollyStart.set( event.offsetX, event.offsetY );
        }

        _handleMouseDownPan( event ) {

            this._panStart.set( event.offsetX, event.offsetY );

        }

        _handleMouseMoveDolly( event ) {

            this._handleUpdateDollyTrackMouse(event);

            //console.log( 'handleMouseMoveDolly' );

            this._dollyEnd.set( event.offsetX, event.offsetY );

            this._dollyDelta.subVectors(this._dollyEnd, this._dollyStart );

            if ( this._dollyDelta.y > 0 ) {

                this._dollyIn( this._getZoomScale() );

            } else if ( this._dollyDelta.y < 0 ) {

                this._dollyOut( this._getZoomScale() );

            }

            this._dollyStart.copy( this._dollyEnd );

            this.update();

        }

        _handleMouseMovePan( event ) {

            //console.log( 'handleMouseMovePan' );

            this._panEnd.set( event.offsetX, event.offsetY );

            this._panDelta.subVectors( this._panEnd, this._panStart );

            this._pan( this._panDelta.x, this._panDelta.y );

            this._panStart.copy( this._panEnd );

            this.update();

        }

        _handleMouseUp( event ) {

            //console.log( 'handleMouseUp' );

        }

        _calculateMinZoom(cam_pos, map_intersect){
            return map_intersect.clone().add(
                cam_pos.clone()
                .sub(map_intersect)
                .normalize()
                .multiplyScalar(this.maxDistance)
            );
        }


        _handleMouseWheel( event ) {
            this._handleUpdateDollyTrackMouse(event);

            var delta = 0;

            if ( event.wheelDelta !== undefined ) {

                // WebKit / Opera / Explorer 9

                delta = event.wheelDelta;

            } else if ( event.detail !== undefined ) {

                // Firefox

                delta = - event.detail;

            }

            if ( delta > 0 ) {
                this._dollyOut( this._getZoomScale() );
            } else if ( delta < 0 ) {
                this._dollyIn( this._getZoomScale() );
            }

            this.update();
        }

        _handleKeyDown( event ) {

            //console.log( 'handleKeyDown' );

            switch ( event.key ) {

                case this.keys.PAN_UP:
                    this._pan( 0, this.keyPanSpeed );
                    this.update();
                    break;

                case this.keys.PAN_BOTTOM:
                    this._pan( 0, - this.keyPanSpeed );
                    this.update();
                    break;

                case this.keys.PAN_LEFT:
                    this._pan( this.keyPanSpeed, 0 );
                    this.update();
                    break;

                case this.keys.PAN_RIGHT:
                    this._pan( - this.keyPanSpeed, 0 );
                    this.update();
                    break;

                case this.keys.ZOOM_IN:
                    this._dollyIn( this._getZoomScale(this.keyZoomSpeed) )
                    this.update();
                    break;

                case this.keys.ZOOM_OUT:
                    this._dollyOut( this._getZoomScale(this.keyZoomSpeed) )
                    this.update();
                    break;

            }
        }

        _handleUpdateDollyTrackTouch( event ){
            var centerpoint = new Vector2();

            var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

            centerpoint.x = event.touches[ 0 ].pageX + (dx / 2);
            centerpoint.y = event.touches[ 0 ].pageY + (dy / 2);

            var mouse = new Vector2();
            mouse.x = ( centerpoint.x / domElement.clientWidth ) * 2 - 1;
            mouse.y = - ( centerpoint.y / domElement.clientHeight ) * 2 + 1;

            this._updateDollyTrack(mouse);
        }

        _handleTouchStartDolly( event ) {
            this._handleUpdateDollyTrackTouch(event);

            var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

            var distance = Math.sqrt( dx * dx + dy * dy );

            this._dollyStart.set( 0, distance );

        }

        _handleTouchStartPan( event ) {

            //console.log( 'handleTouchStartPan' );

            this._panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

        }


        _handleTouchMoveDolly( event ) {
            this._handleUpdateDollyTrackTouch(event);

            //console.log( 'handleTouchMoveDolly' );

            var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

            var distance = Math.sqrt( dx * dx + dy * dy );

            this._dollyEnd.set( 0, distance );

            this._dollyDelta.subVectors( this._dollyEnd, this._dollyStart );

            if ( this._dollyDelta.y > 0 ) {

                this._dollyOut( this._getZoomScale() );

            } else if ( this._dollyDelta.y < 0 ) {

                this._dollyIn( this._getZoomScale() );

            }

            this._dollyStart.copy( this._dollyEnd );

            this.update();

        }

        _handleTouchMovePan( event ) {

            this._panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

            this._panDelta.subVectors( this._panEnd, this._panStart );

            this._pan( this._panDelta.x, this._panDelta.y );

            this._panStart.copy( this._panEnd );

            this.update();

        }

        _handleTouchEnd( event ) {
            //console.log( 'handleTouchEnd' );
        }

        //
        // event handlers - FSM: listen for events and reset state
        //

        _onMouseDown( event ) {
            event.stopPropagation();
            event.preventDefault();

            if ( this.enabled === false ) return;

            if ( event.button === this.mouseButtons.ZOOM ) {

                if ( this.enableZoom === false ) return;

                this._handleMouseDownDolly( event );

                this._state = this._STATES.DOLLY;

            } else if ( event.button === this.mouseButtons.PAN ) {

                if ( this.enablePan === false ) return;

                this._handleMouseDownPan( event );

                this._state = this._STATES.PAN;

            }

            if ( this._state !== this._STATES.NONE ) {

                this.domElement.addEventListener( 'mousemove', this._eventListeners.mousemove, false );
                this.domElement.addEventListener( 'mouseup', this._eventListeners.mouseup, false );

                this.dispatchEvent( this._startEvent );

            }

        }

        _onMouseMove( event ) {

            if ( this.enabled === false ) return;

            event.preventDefault();

            if ( this._state === this._STATES.DOLLY ) {

                if ( this.enableZoom === false ) return;

                this._handleMouseMoveDolly( event );

            } else if ( this._state === this._STATES.PAN ) {

                if ( this.enablePan === false ) return;

                this._handleMouseMovePan( event );
            }
        }

        _onMouseUp( event ) {

            if ( this.enabled === false ) return;

            this._handleMouseUp( event );

            this.domElement.removeEventListener( 'mousemove', this._eventListeners.mousemove, false );
            this.domElement.removeEventListener( 'mouseup', this._eventListeners.mouseup, false );

            this.dispatchEvent( this._endEvent );

            this._state = this._STATES.NONE;

        }

        _onMouseWheel( event ) {
            if ( this.enabled === false || this.enableZoom === false || ( this._state !== this._STATES.NONE ) ) return;

            event.preventDefault();
            event.stopPropagation();

            this._handleMouseWheel( event );

            this.dispatchEvent( this._startEvent ); // not sure why these are here...
            this.dispatchEvent( this._endEvent );

        }

        _onKeyDown( event ) {
            if ( this.enabled === false || this.enableKeys === false || this.enablePan === false ) return;

            this._handleKeyDown( event );
        }

        _onTouchStart( event ) {

            if ( this.enabled === false ) return;

            switch ( event.touches.length ) {
                case 1: // three-fingered touch: pan

                    if ( this.enablePan === false ) return;

                    this._handleTouchStartPan( event );

                    this._state = this._STATES.TOUCH_PAN;

                    break;

                case 2:	// two-fingered touch: dolly

                    if ( this.enableZoom === false ) return;

                    this._handleTouchStartDolly( event );

                    this._state = this._STATES.TOUCH_DOLLY;

                    break;

                default:

                    this._state = this._STATES.NONE;

            }

            if ( this._state !== this._STATES.NONE ) {

                this.dispatchEvent( this._startEvent );

            }

        }

        _onTouchMove( event ) {

            if ( this.enabled === false ) return;

            event.preventDefault();
            event.stopPropagation();

            switch ( event.touches.length ) {

                case 1: // one-fingered touch: pan
                    if ( this.enablePan === false ) return;
                    if ( this._state !== this._STATES.TOUCH_PAN ) return; // is this needed?...

                    this._handleTouchMovePan( event );

                    break;

                case 2: // two-fingered touch: dolly

                    if ( this.enableZoom === false ) return;
                    if ( this._state !== this._STATES.TOUCH_DOLLY ) return; // is this needed?...

                    this._handleTouchMoveDolly( event );

                    break;

                default:

                    this._state = this._STATES.NONE;

            }

        }

        _onTouchEnd( event ) {

            if ( this.enabled === false ) return;

            this._handleTouchEnd( event );

            this.dispatchEvent( this._endEvent );

            this._state = this._STATES.NONE;

        }

        _onContextMenu( event ) {
            event.preventDefault();
        }

        _onMouseOver ( event ) {
            this.domElement.focus();
            return false;
        }

        _onMouseOut ( event ) {
            this.domElement.blur();
            return false;
        }

};

export default GalleryControls;
