/**
 * Wind3DRenderer — Three.js 3D building visualiser for StructCalc
 *
 * Usage:
 *   const r = new Wind3DRenderer('threejs-container');
 *   r.update3DModel(48, 80, 22, 18.4, 4.8);
 *   r.onZoneClick(zoneType => console.log(zoneType));
 *
 * Requires (globally loaded before this file):
 *   - three.js r128          (THREE)
 *   - OrbitControls r128     (THREE.OrbitControls)
 *   - CSS2DRenderer r128     (THREE.CSS2DRenderer / THREE.CSS2DObject)
 */

/* =========================================================================
   COLOUR PALETTE — light architectural background
   ========================================================================= */
const THEME = {
  bg         : 0xeef3f8,   // light blue-grey — scene background
  fog        : 0xeef3f8,
  grid1      : 0xc4d4e6,   // subtle blue-grey major grid lines
  grid2      : 0xd8e5f0,   // very light minor grid lines
  gnd        : 0xe2ecf5,   // ground plane, slightly darker than bg

  wallFill   : 0xbdd4e8,   // medium-pale blue — wall faces
  wallEdge   : 0x0e7490,   // dark cyan contour (cyan-700)
  roofFill   : 0x38bdf8,   // sky blue roof
  roofEdge   : 0x0e7490,
  gableFill  : 0x7bb8e0,
  gableEdge  : 0x0e7490,
  ridge      : 0x0e7490,   // dark cyan ridge

  dimLine    : 0x000000,   // black dim lines
  dimActive  : 0x0284c7,   // strong cyan/blue for hover
  dimExt     : 0x000000,   // black extension lines
  dimText    : '#1e3a5f',  // dark navy text — readable on light bg
  dimBg      : 'rgba(255,255,255,0.92)',

  zone1      : 0x34d399,   // emerald-400 — interior field
  zone2      : 0x10b981,   // emerald-500 — edges
  zone3      : 0xef4444,   // red-500     — corners (always vivid red)
  zone4      : 0x06b6d4,   // cyan-500    — wall field
  zone5      : 0x1d4ed8,   // blue-700    — wall corner strip
  zoneLabel1 : { bg:'rgba(52,211,153,0.92)',  fg:'#065f46' },  // emerald-400
  zoneLabel2 : { bg:'rgba(16,185,129,0.92)',  fg:'#fff' },     // emerald-500
  zoneLabel3 : { bg:'rgba(239,68,68,0.92)',   fg:'#fff' },     // red-500
  zoneLabel4 : { bg:'rgba(6,182,212,0.92)',   fg:'#fff' },     // cyan-500
  zoneLabel5 : { bg:'rgba(29,78,216,0.92)',   fg:'#fff' },     // blue-700
};

/* =========================================================================
   HELPERS
   ========================================================================= */
function disposeGroup(group) {
  if (!group) return;
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
    // CSS2DObject: remove label DOM node
    if (obj.element && obj.element.parentNode) {
      obj.element.parentNode.removeChild(obj.element);
    }
  });
}

/* =========================================================================
   Wind3DRenderer CLASS
   ========================================================================= */
class Wind3DRenderer {

  constructor(containerId) {
    this._container   = document.getElementById(containerId);
    this._building    = null;
    this._zones       = null;
    this._dimGroup    = null;   // all dimension geometry
    this._labelGroup  = null;   // CSS2D zone labels
    this._zoneMeshes      = [];
    this._dimHighlight    = {};    // dimId → { lines, labelEl }
    this._dimLabelMeshes  = [];    // flat mesh labels for raycasting
    this._clickCB     = null;
    this._raycaster   = new THREE.Raycaster();
    this._animId      = null;
    this._hoverZone   = null;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initGrid();
    this._initControls();
    this._bindEvents();
    this._initViewCube();
    this._animate();
  }

  /* ── scene setup ───────────────────────────────────────────────────────── */

  _initRenderer() {
    const { w, h } = this._size();

    this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(THEME.bg, 1);
    this._renderer.shadowMap.enabled = true;
    this._renderer.setSize(w, h);
    this._container.appendChild(this._renderer.domElement);

    if (typeof THREE.CSS2DRenderer !== 'undefined') {
      this._labelRenderer = new THREE.CSS2DRenderer();
      this._labelRenderer.setSize(w, h);
      this._labelRenderer.domElement.style.cssText =
        'position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;';
      this._container.appendChild(this._labelRenderer.domElement);
    } else {
      this._labelRenderer = null;
    }
  }

  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(THEME.bg);
    this._scene.fog = new THREE.Fog(THEME.fog, 600, 1200);
  }

  _initCamera() {
    const { w, h } = this._size();
    this._camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 2000);
    this._camera.position.set(100, 75, 120);
    this._scene.add(this._camera);
  }

  _initLights() {
    this._scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 0.80);
    sun.position.set(80, 160, 100);
    sun.castShadow = true;
    this._scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9db8cf, 0.40);
    fill.position.set(0, 0, 1);  // camera-space fill
    this._camera.add(fill);
  }

  _initGrid() {
    const g = new THREE.GridHelper(600, 60, THEME.grid1, THEME.grid2);
    g.position.y = 0;
    this._scene.add(g);
    const gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: THEME.gnd, transparent: true, opacity: 0.6 })
    );
    gnd.rotation.x = -Math.PI / 2;
    gnd.receiveShadow = true;
    this._scene.add(gnd);
  }

  _initControls() {
    this._controls = new THREE.OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.07;
    this._controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this._controls.minDistance   = 20;
    this._controls.maxDistance   = 700;
    this._controls.target.set(0, 18, 0);
    this._controls.update();
  }

  /* ── Revit-style view cube ──────────────────────────────────────────────── */

  /* ── CSS 3D view cube — no extra WebGL context, pure DOM ────────────────
     The cube's rotation mirrors the main camera's spherical orientation.
     Clicking a face animates the main camera to that canonical view.           */

  _initViewCube() {
    if (getComputedStyle(this._container).position === 'static') {
      this._container.style.position = 'relative';
    }

    const S    = 72;    // main cube side, px
    const HALF = S / 2;

    // Wrapper — 3× margins from scene edges
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:absolute', 'top:50px', 'right:50px',
      `width:${S}px`, `height:${S}px`,
      `perspective:${S * 3.5}px`,
      'z-index:10',
    ].join(';');
    this._container.appendChild(wrap);

    // Rotating inner cube
    const cube = document.createElement('div');
    cube.style.cssText = [
      `width:${S}px`, `height:${S}px`,
      'position:relative', 'transform-style:preserve-3d',
      'transform:rotateX(0deg) rotateY(0deg)',
    ].join(';');
    wrap.appendChild(cube);
    this._vcCubeEl = cube;

    // Light-gray Revit-style palette
    const BG   = 'rgb(232,232,232)';   // light gray, opaque
    const BGHV = 'rgb(155,198,235)';   // blue highlight on hover
    const BORD = 'rgb(175,175,175)';
    const FG   = '#333333';

    // ── Main faces ────────────────────────────────────────────────────────────
    // NOTE: rx=-90 face appears at CSS-BOTTOM (visual bottom); rx=90 at CSS-TOP.
    // Swap labels so the visually-top face shows "TOP" and bottom shows "BTM".
    const faces = [
      { label:'FRONT', ry:   0, rx:   0, dir: new THREE.Vector3( 0, 0,  1) },
      { label:'BACK',  ry: 180, rx:   0, dir: new THREE.Vector3( 0, 0, -1) },
      { label:'RIGHT', ry:  90, rx:   0, dir: new THREE.Vector3( 1, 0,  0) },
      { label:'LEFT',  ry: -90, rx:   0, dir: new THREE.Vector3(-1, 0,  0) },
      { label:'TOP',   ry:   0, rx:  90, dir: new THREE.Vector3( 0, 1,  0) }, // rx=90 → CSS top
      { label:'BTM',   ry:   0, rx: -90, dir: new THREE.Vector3( 0,-1,  0) }, // rx=-90 → CSS bottom
    ];

    faces.forEach(f => {
      const el = document.createElement('div');
      const ry = f.ry !== 0 ? `rotateY(${f.ry}deg) ` : '';
      const rx = f.rx !== 0 ? `rotateX(${f.rx}deg) ` : '';
      el.style.cssText = [
        'position:absolute',
        `width:${S}px`, `height:${S}px`,
        'display:flex', 'align-items:center', 'justify-content:center',
        `background:${BG}`, `border:1px solid ${BORD}`,
        `color:${FG}`,
        'font-family:"JetBrains Mono",monospace',
        'font-size:16px', 'font-weight:700', 'letter-spacing:0.02em',
        'cursor:pointer', 'user-select:none', 'box-sizing:border-box',
        `transform:${ry}${rx}translateZ(${HALF}px)`,
        'backface-visibility:hidden', 'transition:background 0.12s',
      ].join(';');
      el.textContent = f.label;

      el.addEventListener('mouseenter', () => { el.style.background = BGHV; });
      el.addEventListener('mouseleave', () => { el.style.background = BG;   });
      el.addEventListener('click', () => {
        const target = this._controls.target.clone();
        const dist   = this._camera.position.distanceTo(target);
        const dir    = f.dir.clone();
        if (f.label === 'TOP') dir.set(0.03, 1, 0.03).normalize();
        if (f.label === 'BTM') dir.set(0.03,-1, 0.03).normalize();
        this._animateCameraTo(target.clone().addScaledVector(dir, dist));
      });
      cube.appendChild(el);
    });

    // ── Revit-style corner mini-cubes ─────────────────────────────────────────
    // At each of the 8 corners, a small CSS 3D cube with 3 outward-facing faces.
    // Hovering highlights the mini-cube; clicking navigates to the axonometric view.
    const MS    = 13;     // mini-cube side, px
    const MHALF = MS / 2;
    const MCBG   = 'rgb(210,210,210)';
    const MCBGHV = 'rgb(120,180,230)';
    const MCBORD = 'rgb(155,155,155)';

    // [css_cx, css_cy, css_cz, tjs_dx, tjs_dy, tjs_dz]
    // CSS +Y is down; Three.js +Y is up → tjs_dy = -(css_cy sign)
    // Offset by (HALF - MHALF) so each mini-cube is flush with (not protruding from) the main face.
    const CI = HALF - MHALF + 2;  // +2 px protrusion outward from each face
    const corners = [
      [ CI, -CI,  CI,  1,  1,  1],
      [-CI, -CI,  CI, -1,  1,  1],
      [ CI, -CI, -CI,  1,  1, -1],
      [-CI, -CI, -CI, -1,  1, -1],
      [ CI,  CI,  CI,  1, -1,  1],
      [-CI,  CI,  CI, -1, -1,  1],
      [ CI,  CI, -CI,  1, -1, -1],
      [-CI,  CI, -CI, -1, -1, -1],
    ];

    corners.forEach(([cx, cy, cz, dx, dy, dz]) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = [
        'position:absolute', 'left:50%', 'top:50%',
        `width:${MS}px`, `height:${MS}px`,
        'transform-style:preserve-3d',
        `transform:translate(-50%,-50%) translateX(${cx}px) translateY(${cy}px) translateZ(${cz}px)`,
        'cursor:pointer',
      ].join(';');

      // Build the 3 outward-facing mini-cube faces for this corner's octant.
      // Face pointing in +X direction: rotateY(90) translateZ(MHALF)  if cx>0
      //                         in -X: rotateY(-90) translateZ(MHALF) if cx<0
      // Face pointing visually UP (CSS top): rotateX(90) translateZ(MHALF) if cy<0
      //                         DOWN (CSS bottom): rotateX(-90) translateZ(MHALF) if cy>0
      // Face pointing in +Z direction: translateZ(MHALF) if cz>0
      //                         in -Z: rotateY(180) translateZ(MHALF) if cz<0
      const miniFaceDefs = [
        cx > 0 ? 'rotateY(90deg) '  : 'rotateY(-90deg) ',
        cy < 0 ? 'rotateX(90deg) '  : 'rotateX(-90deg) ',
        cz > 0 ? ''                  : 'rotateY(180deg) ',
      ];

      miniFaceDefs.forEach(tfm => {
        const face = document.createElement('div');
        face.style.cssText = [
          'position:absolute',
          `width:${MS}px`, `height:${MS}px`,
          `background:${MCBG}`,
          `border:1px solid ${MCBORD}`,
          'box-sizing:border-box',
          `transform:${tfm}translateZ(${MHALF + 2}px)`,
          'transition:background 0.12s',
        ].join(';');
        wrapper.appendChild(face);
      });

      const setMC = col => wrapper.querySelectorAll('div').forEach(f => f.style.background = col);
      wrapper.addEventListener('mouseenter', () => setMC(MCBGHV));
      wrapper.addEventListener('mouseleave', () => setMC(MCBG));
      wrapper.addEventListener('click', e => {
        e.stopPropagation();
        const target = this._controls.target.clone();
        const dist   = this._camera.position.distanceTo(target);
        this._animateCameraTo(target.clone().addScaledVector(
          new THREE.Vector3(dx, dy, dz).normalize(), dist
        ));
      });

      cube.appendChild(wrapper);
    });
  }

  _animateCameraTo(targetPos) {
    if (this._camAnimId) cancelAnimationFrame(this._camAnimId);
    const startPos = this._camera.position.clone();
    const t0  = performance.now();
    const dur = 480;

    const step = () => {
      const raw  = (performance.now() - t0) / dur;
      const t    = Math.min(raw, 1);
      const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;  // ease-in-out quad
      this._camera.position.lerpVectors(startPos, targetPos, ease);
      this._controls.update();
      if (t < 1) this._camAnimId = requestAnimationFrame(step);
      else        this._camAnimId = null;
    };
    step();
  }

  _bindEvents() {
    // rAF-deferred resize: reads container size after flex/grid layout finishes
    this._onResize = () => {
      requestAnimationFrame(() => {
        const { w, h } = this._size();
        if (w < 10 || h < 10) return;
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(w, h);
        if (this._labelRenderer) this._labelRenderer.setSize(w, h);
      });
    };
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._onResize());
      this._ro.observe(this._container);
    }
    window.addEventListener('resize', this._onResize);

    this._renderer.domElement.addEventListener('click',     e => this._handleClick(e));
    this._renderer.domElement.addEventListener('mousemove', e => this._handleHover(e));
  }

  _size() {
    const rect = this._container.getBoundingClientRect();
    return {
      w: rect.width  || this._container.clientWidth  || 640,
      h: rect.height || this._container.clientHeight || 420,
    };
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    this._controls.update();
    this._renderer.render(this._scene, this._camera);

    // ── Occlusion / back-face culling — must run BEFORE labelRenderer.render()
    // so the CSS2DRenderer sees the correct display state on each element.

    // 1) Dim labels: hide if a building surface is between camera and label
    if (this._buildingMeshes && this._buildingMeshes.length && this._dimGroup) {
      const camPos = this._camera.position;
      const _tmp   = new THREE.Vector3();
      this._dimGroup.traverse(obj => {
        if (!obj.isCSS2DObject) return;
        obj.getWorldPosition(_tmp);
        const distToLabel = camPos.distanceTo(_tmp);
        const dir = _tmp.clone().sub(camPos).normalize();
        this._raycaster.set(camPos, dir);
        const hits = this._raycaster.intersectObjects(this._buildingMeshes, false);
        const occluded = hits.some(h => h.distance < distToLabel - 1.0);
        obj.element.style.display = occluded ? 'none' : '';
      });
    }

    // 2) Zone labels: hide if their surface normal points away from camera
    if (this._labelGroup) {
      const camPos2 = this._camera.position;
      const _tmpL   = new THREE.Vector3();
      this._labelGroup.traverse(obj => {
        if (!obj.isCSS2DObject) return;
        const fn = obj.userData.faceNormal;
        if (!fn) return;                  // no normal stored — always show
        obj.getWorldPosition(_tmpL);
        const facingCamera = fn.dot(new THREE.Vector3().subVectors(camPos2, _tmpL)) > 0;
        obj.element.style.display = facingCamera ? '' : 'none';
      });
    }

    if (this._labelRenderer) this._labelRenderer.render(this._scene, this._camera);

    // Sync CSS view cube rotation to main camera spherical orientation.
    // Formula: rotateX(−phi) rotateY(−theta), CSS right-to-left = Y first then X.
    if (this._vcCubeEl) {
      const d     = new THREE.Vector3().subVectors(this._camera.position, this._controls.target);
      const r     = d.length() || 1;
      const theta = Math.atan2(d.x, d.z);         // azimuth (rad)
      const phi   = Math.asin(Math.max(-1, Math.min(1, d.y / r))); // elevation (rad)
      const R     = 180 / Math.PI;
      this._vcCubeEl.style.transform =
        `rotateX(${(-phi * R).toFixed(2)}deg) rotateY(${(-theta * R).toFixed(2)}deg)`;
    }
  }

  /* ── tube edge helpers — CylinderGeometry segments for thick contours ──── */

  /**
   * One tube segment between two 3D points.
   * radius is in world units (~0.5 looks like 3-5px at normal camera distance).
   */
  _tube(p1, p2, color, radius) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 0.01) return null;
    const geo  = new THREE.CylinderGeometry(radius, radius, len, 6, 1);
    const mat  = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(p1).lerp(p2, 0.5);
    const up   = new THREE.Vector3(0, 1, 0);
    const dirN = dir.normalize();
    if (Math.abs(up.dot(dirN)) < 0.9999) {
      mesh.quaternion.setFromUnitVectors(up, dirN);
    } else if (up.dot(dirN) < 0) {
      mesh.rotateZ(Math.PI);
    }
    return mesh;
  }

  /**
   * Extract edges from EdgesGeometry and add tubes to parent group.
   */
  _tubeEdges(edgesGeo, color, radius, parent) {
    const pos = edgesGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 6) {
      const p1 = new THREE.Vector3(pos[i],   pos[i+1], pos[i+2]);
      const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5]);
      const t  = this._tube(p1, p2, color, radius);
      if (t) parent.add(t);
    }
  }

  /* ── geometry primitives ────────────────────────────────────────────────── */

  _quad(a, b, c, d) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z,
      a.x,a.y,a.z, c.x,c.y,c.z, d.x,d.y,d.z,
    ]), 3));
    g.computeVertexNormals();
    return g;
  }

  _ptL(u, v, hB, hEave, hRidge, hL) {
    return new THREE.Vector3(-(1-u)*hB, (1-u)*hEave + u*hRidge, v*hL*2 - hL);
  }
  _ptR(u, v, hB, hEave, hRidge, hL) {
    return new THREE.Vector3( (1-u)*hB, (1-u)*hEave + u*hRidge, v*hL*2 - hL);
  }

  _leftNormal(hB, hEave, hRidge, hL) {
    const n = new THREE.Vector3().crossVectors(
      new THREE.Vector3(hB, hRidge - hEave, 0),
      new THREE.Vector3(0,  0, 2 * hL)
    ).normalize();
    if (n.x > 0) n.negate();
    return n;
  }

  _zoneCentroid(u0, u1, v0, v1, ptFn, hB, hEave, hRidge, hL) {
    return [
      ptFn(u0,v0,hB,hEave,hRidge,hL), ptFn(u1,v0,hB,hEave,hRidge,hL),
      ptFn(u1,v1,hB,hEave,hRidge,hL), ptFn(u0,v1,hB,hEave,hRidge,hL),
    ].reduce((s,c)=>s.add(c), new THREE.Vector3()).multiplyScalar(0.25);
  }

  /* ── building geometry ──────────────────────────────────────────────────── */

  _buildStructure(B, L, hEave, hRidge) {
    const hB = B/2, hL = L/2;
    const grp = new THREE.Group();

    const solidMat = c => new THREE.MeshStandardMaterial({
      color:c, transparent:false, side:THREE.FrontSide,
    });
    const EDGE_R = 0.11; // tube radius in world units (~4-5px at normal view distance)

    // -- walls (solid near-opaque: depth buffer hides back edges)
    const boxGeo = new THREE.BoxGeometry(B, hEave, L);
    boxGeo.translate(0, hEave/2, 0);
    const wall = new THREE.Mesh(boxGeo, solidMat(THEME.wallFill));
    wall.castShadow = true;
    grp.add(wall);
    this._tubeEdges(new THREE.EdgesGeometry(boxGeo), THEME.wallEdge, EDGE_R, grp);

    // -- gable triangles
    for (const zs of [-1, 1]) {
      const z = zs * hL;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -hB,hEave,z,  hB,hEave,z,  0,hRidge,z,
      ]), 3));
      geo.computeVertexNormals();
      grp.add(new THREE.Mesh(geo, solidMat(THEME.gableFill)));
      this._tubeEdges(new THREE.EdgesGeometry(geo), THEME.gableEdge, EDGE_R, grp);
    }

    // -- roof slopes
    const leftGeo = this._quad(
      new THREE.Vector3(-hB, hEave,-hL),
      new THREE.Vector3(-hB, hEave, hL),
      new THREE.Vector3( 0, hRidge, hL),
      new THREE.Vector3( 0, hRidge,-hL),
    );
    const rightGeo = this._quad(
      new THREE.Vector3( hB, hEave,-hL),
      new THREE.Vector3(  0, hRidge,-hL),
      new THREE.Vector3(  0, hRidge, hL),
      new THREE.Vector3( hB, hEave, hL),
    );
    const roofSide = new THREE.MeshStandardMaterial({
      color:THEME.roofFill, transparent:false, side:THREE.DoubleSide,
    });
    for (const [g, mat] of [[leftGeo,roofSide],[rightGeo,roofSide.clone()]]) {
      const m = new THREE.Mesh(g, mat); m.castShadow=true; grp.add(m);
      this._tubeEdges(new THREE.EdgesGeometry(g), THEME.roofEdge, EDGE_R, grp);
    }

    // -- ridge
    {
      const t = this._tube(new THREE.Vector3(0,hRidge,-hL), new THREE.Vector3(0,hRidge,hL), THEME.ridge, EDGE_R);
      if (t) grp.add(t);
    }

    return grp;
  }

  /* ── hip roof builder ───────────────────────────────────────────────────── */

  _buildStructureHip(B, L, hEave, hRidge) {
    /* Always orient ridge along the longer plan dimension (classic hip, not pyramid) */
    if (B > L) { [B, L] = [L, B]; }
    const hB = B / 2, hL = L / 2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;
    const solidMat = c => new THREE.MeshStandardMaterial({
      color: c, transparent: false, side: THREE.FrontSide,
    });
    const roofMat = () => new THREE.MeshStandardMaterial({
      color: THEME.roofFill, transparent: false, side: THREE.DoubleSide,
    });

    /* Walls — same box as gable (no gable triangles for hip) */
    const boxGeo = new THREE.BoxGeometry(B, hEave, L);
    boxGeo.translate(0, hEave / 2, 0);
    grp.add(new THREE.Mesh(boxGeo, solidMat(THEME.wallFill)));
    this._tubeEdges(new THREE.EdgesGeometry(boxGeo), THEME.wallEdge, EDGE_R, grp);

    /* Ridge: shorter than building length by B on each side (equal-pitch hip) */
    const ridgeL = Math.max(0, L - B);
    const r2 = ridgeL / 2;

    /* Left main slope — trapezoid (or triangle if L === B) */
    const leftGeo = this._quad(
      new THREE.Vector3(-hB, hEave, -hL),
      new THREE.Vector3(-hB, hEave,  hL),
      new THREE.Vector3(  0, hRidge,  r2),
      new THREE.Vector3(  0, hRidge, -r2),
    );
    /* Right main slope */
    const rightGeo = this._quad(
      new THREE.Vector3(hB, hEave, -hL),
      new THREE.Vector3( 0, hRidge, -r2),
      new THREE.Vector3( 0, hRidge,  r2),
      new THREE.Vector3(hB, hEave,  hL),
    );
    for (const g of [leftGeo, rightGeo]) {
      grp.add(new THREE.Mesh(g, roofMat()));
      this._tubeEdges(new THREE.EdgesGeometry(g), THEME.roofEdge, EDGE_R, grp);
    }

    /* Hip triangles at each end */
    for (const zs of [-1, 1]) {
      const z  = zs * hL;
      const rz = zs * r2;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -hB, hEave, z,
         hB, hEave, z,
          0, hRidge, rz,
      ]), 3));
      geo.computeVertexNormals();
      grp.add(new THREE.Mesh(geo, roofMat()));
      this._tubeEdges(new THREE.EdgesGeometry(geo), THEME.roofEdge, EDGE_R, grp);
    }

    /* Ridge line (only if ridge has length) */
    if (ridgeL > 0) {
      const t = this._tube(
        new THREE.Vector3(0, hRidge, -r2),
        new THREE.Vector3(0, hRidge,  r2),
        THEME.ridge, EDGE_R
      );
      if (t) grp.add(t);
    }

    return grp;
  }

  /* ── monoslope roof builder ──────────────────────────────────────────────── */

  _buildStructureMonoslope(B, L, hLow, hHigh) {
    /* hLow  = low eave height  (leeward,  X = +B/2)
       hHigh = high eave height (windward, X = -B/2) */
    const hB = B / 2, hL = L / 2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;
    const solidMat = c => new THREE.MeshStandardMaterial({
      color: c, transparent: false, side: THREE.FrontSide,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: THEME.roofFill, transparent: false, side: THREE.DoubleSide,
    });

    /* 4 walls — all as quads (not a box, heights differ on each side) */
    /* Windward wall  (X = -hB): rectangular, full height = hHigh */
    const windGeo = this._quad(
      new THREE.Vector3(-hB, 0,     -hL),
      new THREE.Vector3(-hB, 0,      hL),
      new THREE.Vector3(-hB, hHigh,  hL),
      new THREE.Vector3(-hB, hHigh, -hL),
    );
    /* Leeward wall  (X = +hB): rectangular, height = hLow */
    const leeGeo = this._quad(
      new THREE.Vector3(hB, 0,    -hL),
      new THREE.Vector3(hB, hLow, -hL),
      new THREE.Vector3(hB, hLow,  hL),
      new THREE.Vector3(hB, 0,     hL),
    );
    /* Left end wall  (Z = -hL): trapezoid */
    const leftEndGeo = this._quad(
      new THREE.Vector3(-hB, 0,     -hL),
      new THREE.Vector3(-hB, hHigh, -hL),
      new THREE.Vector3( hB, hLow,  -hL),
      new THREE.Vector3( hB, 0,     -hL),
    );
    /* Right end wall (Z = +hL): trapezoid */
    const rightEndGeo = this._quad(
      new THREE.Vector3(-hB, 0,     hL),
      new THREE.Vector3( hB, 0,     hL),
      new THREE.Vector3( hB, hLow,  hL),
      new THREE.Vector3(-hB, hHigh, hL),
    );
    for (const g of [windGeo, leeGeo, leftEndGeo, rightEndGeo]) {
      grp.add(new THREE.Mesh(g, solidMat(THEME.wallFill)));
      this._tubeEdges(new THREE.EdgesGeometry(g), THEME.wallEdge, EDGE_R, grp);
    }

    /* Sloped roof — single quad */
    const roofGeo = this._quad(
      new THREE.Vector3(-hB, hHigh, -hL),
      new THREE.Vector3(-hB, hHigh,  hL),
      new THREE.Vector3( hB, hLow,   hL),
      new THREE.Vector3( hB, hLow,  -hL),
    );
    grp.add(new THREE.Mesh(roofGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(roofGeo), THEME.roofEdge, EDGE_R, grp);

    /* High eave edge (accent) */
    const t = this._tube(
      new THREE.Vector3(-hB, hHigh, -hL),
      new THREE.Vector3(-hB, hHigh,  hL),
      THEME.ridge, EDGE_R
    );
    if (t) grp.add(t);

    return grp;
  }

  /* ── dimension system ───────────────────────────────────────────────────── */

  /* ── wall zone 4/5 overlay ─────────────────────────────────────────────────
     Draws Zone 5 (corner strip, width=zone_a) and Zone 4 (field) on all 4
     vertical wall faces. matZ(color, opacity) is the same factory used for
     roof zones.                                                               */
  _drawWallZones(B, L, hEave, zone_a, matZ) {
    const hB = B / 2, hL = L / 2;
    const EPS = 0.06;   // tiny outward offset to avoid z-fighting with wall mesh
    const Z4_OP = 0.22, Z5_OP = 0.45;   // opacities for field and corner zones

    /* Helper: add a wall quad (convex, given 4 corners in CCW order when viewed
       from the outside) to this._zones with userData.zoneType set. */
    const addWallQ = (pts, zt, op) => {
      const geo = this._quad(pts[0], pts[1], pts[2], pts[3]);
      const col = zt === 'zone-5' ? THEME.zone5 : THEME.zone4;
      const m = new THREE.Mesh(geo, matZ(col, op));
      m.renderOrder = 1;
      m.userData = { zoneType: zt };
      this._zones.add(m);
      this._zoneMeshes.push(m);
    };

    /* Wall label (flat, glued to surface) at the centroid of a wall region.    */
    const wallLabel = (zt, p0, p1, p2, p3, norm, tDir) => {
      const ctr = new THREE.Vector3(
        (p0.x+p1.x+p2.x+p3.x)/4,
        (p0.y+p1.y+p2.y+p3.y)/4,
        (p0.z+p1.z+p2.z+p3.z)/4
      ).addScaledVector(norm, 0.04);
      this._makeZoneLabelFlat(zt, ctr, norm, tDir);
    };

    /* ── FRONT wall  (z = +hL, outward normal +Z) ─────────────────────────── */
    {
      const nF = new THREE.Vector3(0, 0, 1);
      const e  = EPS;
      const z  = hL + e;
      const a  = Math.min(zone_a, hB);  // clamp strip to half-width
      const tD = new THREE.Vector3(1, 0, 0);

      // Zone 5 left strip: x=-hB … -hB+a
      const fz5L = [
        new THREE.Vector3(-hB, 0, z),  new THREE.Vector3(-hB+a, 0, z),
        new THREE.Vector3(-hB+a, hEave, z), new THREE.Vector3(-hB, hEave, z),
      ];
      addWallQ(fz5L, 'zone-5', Z5_OP);
      wallLabel('zone-5', fz5L[0], fz5L[1], fz5L[2], fz5L[3], nF, tD);

      // Zone 5 right strip: x=hB-a … hB
      const fz5R = [
        new THREE.Vector3(hB-a, 0, z),  new THREE.Vector3(hB, 0, z),
        new THREE.Vector3(hB, hEave, z), new THREE.Vector3(hB-a, hEave, z),
      ];
      addWallQ(fz5R, 'zone-5', Z5_OP);
      wallLabel('zone-5', fz5R[0], fz5R[1], fz5R[2], fz5R[3], nF, tD);

      // Zone 4 field: x=-hB+a … hB-a (only if wide enough)
      if (2 * a < B - 0.1) {
        const fz4 = [
          new THREE.Vector3(-hB+a, 0, z),  new THREE.Vector3(hB-a, 0, z),
          new THREE.Vector3(hB-a, hEave, z), new THREE.Vector3(-hB+a, hEave, z),
        ];
        addWallQ(fz4, 'zone-4', Z4_OP);
        wallLabel('zone-4', fz4[0], fz4[1], fz4[2], fz4[3], nF, tD);
      }
    }

    /* ── BACK wall  (z = -hL, outward normal -Z) ──────────────────────────── */
    {
      const nB = new THREE.Vector3(0, 0, -1);
      const e  = EPS;
      const z  = -hL - e;
      const a  = Math.min(zone_a, hB);
      const tD = new THREE.Vector3(-1, 0, 0);

      const bz5L = [
        new THREE.Vector3(hB-a, 0, z),  new THREE.Vector3(hB, 0, z),
        new THREE.Vector3(hB, hEave, z), new THREE.Vector3(hB-a, hEave, z),
      ];
      addWallQ(bz5L, 'zone-5', Z5_OP);
      wallLabel('zone-5', bz5L[0], bz5L[1], bz5L[2], bz5L[3], nB, tD);

      const bz5R = [
        new THREE.Vector3(-hB, 0, z),  new THREE.Vector3(-hB+a, 0, z),
        new THREE.Vector3(-hB+a, hEave, z), new THREE.Vector3(-hB, hEave, z),
      ];
      addWallQ(bz5R, 'zone-5', Z5_OP);
      wallLabel('zone-5', bz5R[0], bz5R[1], bz5R[2], bz5R[3], nB, tD);

      if (2 * a < B - 0.1) {
        const bz4 = [
          new THREE.Vector3(-hB+a, 0, z),  new THREE.Vector3(hB-a, 0, z),
          new THREE.Vector3(hB-a, hEave, z), new THREE.Vector3(-hB+a, hEave, z),
        ];
        addWallQ(bz4, 'zone-4', Z4_OP);
        wallLabel('zone-4', bz4[0], bz4[1], bz4[2], bz4[3], nB, tD);
      }
    }

    /* ── RIGHT wall  (x = +hB, outward normal +X) ─────────────────────────── */
    {
      const nR = new THREE.Vector3(1, 0, 0);
      const e  = EPS;
      const x  = hB + e;
      const a  = Math.min(zone_a, hL);
      const tD = new THREE.Vector3(0, 0, -1);

      // Zone 5 front strip (z=+hL side): z=hL-a … hL
      const rz5F = [
        new THREE.Vector3(x, 0, hL-a),  new THREE.Vector3(x, 0, hL),
        new THREE.Vector3(x, hEave, hL), new THREE.Vector3(x, hEave, hL-a),
      ];
      addWallQ(rz5F, 'zone-5', Z5_OP);
      wallLabel('zone-5', rz5F[0], rz5F[1], rz5F[2], rz5F[3], nR, tD);

      // Zone 5 back strip: z=-hL … -hL+a
      const rz5B = [
        new THREE.Vector3(x, 0, -hL),  new THREE.Vector3(x, 0, -hL+a),
        new THREE.Vector3(x, hEave, -hL+a), new THREE.Vector3(x, hEave, -hL),
      ];
      addWallQ(rz5B, 'zone-5', Z5_OP);
      wallLabel('zone-5', rz5B[0], rz5B[1], rz5B[2], rz5B[3], nR, tD);

      if (2 * a < L - 0.1) {
        const rz4 = [
          new THREE.Vector3(x, 0, -hL+a),  new THREE.Vector3(x, 0, hL-a),
          new THREE.Vector3(x, hEave, hL-a), new THREE.Vector3(x, hEave, -hL+a),
        ];
        addWallQ(rz4, 'zone-4', Z4_OP);
        wallLabel('zone-4', rz4[0], rz4[1], rz4[2], rz4[3], nR, tD);
      }
    }

    /* ── LEFT wall  (x = -hB, outward normal -X) ──────────────────────────── */
    {
      const nL = new THREE.Vector3(-1, 0, 0);
      const e  = EPS;
      const x  = -hB - e;
      const a  = Math.min(zone_a, hL);
      const tD = new THREE.Vector3(0, 0, 1);

      // Zone 5 front strip: z=hL-a … hL
      const lz5F = [
        new THREE.Vector3(x, 0, hL-a),  new THREE.Vector3(x, 0, hL),
        new THREE.Vector3(x, hEave, hL), new THREE.Vector3(x, hEave, hL-a),
      ];
      addWallQ(lz5F, 'zone-5', Z5_OP);
      wallLabel('zone-5', lz5F[0], lz5F[1], lz5F[2], lz5F[3], nL, tD);

      // Zone 5 back strip: z=-hL … -hL+a
      const lz5B = [
        new THREE.Vector3(x, 0, -hL),  new THREE.Vector3(x, 0, -hL+a),
        new THREE.Vector3(x, hEave, -hL+a), new THREE.Vector3(x, hEave, -hL),
      ];
      addWallQ(lz5B, 'zone-5', Z5_OP);
      wallLabel('zone-5', lz5B[0], lz5B[1], lz5B[2], lz5B[3], nL, tD);

      if (2 * a < L - 0.1) {
        const lz4 = [
          new THREE.Vector3(x, 0, -hL+a),  new THREE.Vector3(x, 0, hL-a),
          new THREE.Vector3(x, hEave, hL-a), new THREE.Vector3(x, hEave, -hL+a),
        ];
        addWallQ(lz4, 'zone-4', Z4_OP);
        wallLabel('zone-4', lz4[0], lz4[1], lz4[2], lz4[3], nL, tD);
      }
    }
  }

  /**
   * Build one dimension annotation:
   *   - main 3D line between p1 and p2
   *   - tick marks perpendicular at each end
   *   - extension lines (dashed) from building face to dim line
   *   - CSS2DObject label at midpoint (click to focus input)
   */
  _buildDim(p1, p2, tickDir, extLines, text, dimId, inputId) {
    const grp = new THREE.Group();
    grp.userData = { dimId, defaultColor: THEME.dimLine };

    const mat    = () => new THREE.LineBasicMaterial({ color: 0x000000 });
    const extMat = () => new THREE.LineBasicMaterial({ color: 0x000000 });  // solid, not dashed

    // main dimension line
    const mainLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p1, p2]), mat()
    );
    grp.add(mainLine);

    // 45° tick marks — use explicit tickDir when provided (e.g. hip slope dims),
    // otherwise bisect dim direction and first ext-line direction.
    const TICK   = 0.6;   // half-length (world units)
    const TICK_R = 0.08;  // tube radius — uniform across all dims
    let td;
    if (tickDir != null) {
      td = tickDir.clone().normalize();
    } else if (extLines && extLines.length > 0) {
      const dimDir45 = new THREE.Vector3().subVectors(p2, p1).normalize();
      const extDir45 = new THREE.Vector3().subVectors(extLines[0][1], extLines[0][0]).normalize();
      td = new THREE.Vector3().addVectors(dimDir45, extDir45).normalize();
    } else {
      td = new THREE.Vector3(1, 1, 0).normalize();
    }
    for (const p of [p1, p2]) {
      const ta = p.clone().addScaledVector(td,  TICK);
      const tb = p.clone().addScaledVector(td, -TICK);
      const tk = this._tube(ta, tb, 0x000000, TICK_R);
      if (tk) grp.add(tk);
    }

    // extension lines (solid black) — start TICK/2 gap from building, extend TICK past dim line
    for (const [a, b] of extLines) {
      const extDir = new THREE.Vector3().subVectors(b, a).normalize();
      const aGap   = a.clone().addScaledVector(extDir, TICK / 2);  // gap at building face
      const bExt   = b.clone().addScaledVector(extDir, TICK);       // overshoot past dim line
      grp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([aGap, bExt]), extMat()
      ));
    }

    // ── CSS2D billboard label — always faces the camera ──────────────────
    if (THREE.CSS2DObject) {
      const div = document.createElement('div');
      div.textContent = text;
      div.style.cssText = [
        'background:' + THEME.dimBg,
        'color:' + THEME.dimText,
        'font:bold 13px \'JetBrains Mono\',monospace',
        'padding:2px 8px',
        'border-radius:10px',
        'border:1.5px solid #334155',
        'white-space:nowrap',
        'cursor:pointer',
        'pointer-events:auto',
        'user-select:none',
        'box-shadow:0 1px 3px rgba(0,0,0,0.18)',
      ].join(';');

      // Click → focus the linked input
      if (inputId) {
        div.addEventListener('click', function(e) {
          e.stopPropagation();
          const el = document.getElementById(inputId);
          if (el) { el.focus(); el.select(); }
        });
      }

      const lDir  = new THREE.Vector3().subVectors(p2, p1).normalize();
      const lNorm = new THREE.Vector3().crossVectors(lDir, td).normalize();
      const lSide = new THREE.Vector3().crossVectors(lNorm, lDir).normalize();
      const midPt = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
      // Offset label toward the building so it sits just inside the dim line
      const side  = lSide.clone();
      if (side.dot(midPt) > 0) side.negate();
      const obj = new THREE.CSS2DObject(div);
      obj.position.copy(midPt).addScaledVector(side, 0.6);
      grp.add(obj);

      // setLabelActive: toggle highlight style for the HTML element
      grp.userData.setLabelActive = function(active) {
        div.style.background  = active ? 'rgba(6,182,212,0.92)' : THEME.dimBg;
        div.style.borderColor = active ? '#0891b2' : '#334155';
        div.style.color       = active ? '#ffffff'  : THEME.dimText;
      };
    }

    // Store lines for colour toggling
    grp.userData.lines    = grp.children.filter(c => c.isLine);
    return grp;
  }

  _buildAllDims(B, L, hEave, hRidge, zone_a, hLabel = null, hEaveLabel = null, theta = 0, roofShape = 'hip') {
    const hB = B/2, hL = L/2;
    const grp = new THREE.Group();
    const D   = Math.max(8, Math.max(B, L) * 0.10);
    const EPS_Y = 0.2;  // lift base dims off y=0 to prevent z-fighting

    // Helper: remove trailing .0 from toFixed(1)
    const fmt = v => { const s = v.toFixed(1); return s.endsWith('.0') ? s.slice(0,-2) : s; };

    // ── B (Width) — Front face (z = +hL) ──────────────────────────────────
    const bZ = hL + D;
    grp.add(this._buildDim(
      new THREE.Vector3(-hB, EPS_Y, bZ),
      new THREE.Vector3( hB, EPS_Y, bZ),
      new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(-hB, EPS_Y,  hL), new THREE.Vector3(-hB, EPS_Y, bZ)],
        [new THREE.Vector3( hB, EPS_Y,  hL), new THREE.Vector3( hB, EPS_Y, bZ)],
      ],
      `B=${fmt(B)}ft`, 'dim-B', 'wind-B'
    ));
    this._dimHighlight['dim-B'] = grp.children[grp.children.length - 1];

    // ── L (Length) — Right face, parallel to Z ─────────────────────────────
    const lX = hB + D;
    grp.add(this._buildDim(
      new THREE.Vector3(lX, EPS_Y, -hL),
      new THREE.Vector3(lX, EPS_Y,  hL),
      new THREE.Vector3(1, 0, 1).normalize(),
      [
        [new THREE.Vector3(hB, EPS_Y, -hL), new THREE.Vector3(lX, EPS_Y, -hL)],
        [new THREE.Vector3(hB, EPS_Y,  hL), new THREE.Vector3(lX, EPS_Y,  hL)],
      ],
      `L=${fmt(L)}ft`, 'dim-L', 'wind-L'
    ));
    this._dimHighlight['dim-L'] = grp.children[grp.children.length - 1];

    // ── h_eave — Left face centre (z=0), y=0→hEave ───────────────────────
    const hXhe = -hB - D;
    const hZhe = 0;   // midpoint of building length
    grp.add(this._buildDim(
      new THREE.Vector3(hXhe, EPS_Y,  hZhe),
      new THREE.Vector3(hXhe, hEave,  hZhe),
      new THREE.Vector3(-1, 1, 0).normalize(),
      [
        [new THREE.Vector3(-hB, EPS_Y,  hZhe), new THREE.Vector3(hXhe, EPS_Y,  hZhe)],
        [new THREE.Vector3(-hB, hEave,  hZhe), new THREE.Vector3(hXhe, hEave,  hZhe)],
      ],
      `heave=${fmt(hEaveLabel ?? hEave)}ft`, 'dim-h-eave', 'wind-h'
    ));
    this._dimHighlight['dim-h-eave'] = grp.children[grp.children.length - 1];

    // ── h (mean roof height) — Left face, further out, y=0→hMean ──────────
    const hXh   = -hB - D * 1.6;
    const hZh   = 0;   // midpoint of building length
    const hMean = (hEave + hRidge) / 2;   // mean roof height (scaled)
    const hMeanFt = (hEaveLabel != null && hLabel != null)
      ? (hEaveLabel + hLabel) / 2 : null;
    grp.add(this._buildDim(
      new THREE.Vector3(hXh, EPS_Y,  hZh),
      new THREE.Vector3(hXh, hMean,  hZh),
      new THREE.Vector3(-1, 1, 0).normalize(),
      [
        [new THREE.Vector3(hXhe, EPS_Y,  hZh), new THREE.Vector3(hXh, EPS_Y,  hZh)],
        [new THREE.Vector3(-hB/2, hMean,  hZh), new THREE.Vector3(hXh, hMean,  hZh)],
      ],
      `h=${fmt(hMeanFt ?? hMean)}ft`, 'dim-h', 'wind-h'
    ));
    this._dimHighlight['dim-h'] = grp.children[grp.children.length - 1];

    const aEY  = hEave;
    const aOFF = D * 0.4;

    // ── Eave "a" — Front face right side (zone 3 strip from Back toward front right) ──
    const aFZ = hL + D * 0.7;   // move Front-face 'a' dims further out
    grp.add(this._buildDim(
      new THREE.Vector3(hB - zone_a, aEY, aFZ),
      new THREE.Vector3(hB,          aEY, aFZ),
      new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(hB - zone_a, aEY, hL), new THREE.Vector3(hB - zone_a, aEY, aFZ)],
        [new THREE.Vector3(hB,          aEY, hL), new THREE.Vector3(hB,          aEY, aFZ)],
      ],
      `a=${fmt(zone_a)}ft`, 'dim-a2', null
    ));
    this._dimHighlight['dim-a2'] = grp.children[grp.children.length - 1];

    // ── Eave "a" — Right face front corner (zone 3/5 strip z=hL-zone_a to hL) ──
    const aRX = hB + aOFF;
    grp.add(this._buildDim(
      new THREE.Vector3(aRX, aEY, hL - zone_a),
      new THREE.Vector3(aRX, aEY, hL),
      new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(hB, aEY, hL - zone_a), new THREE.Vector3(aRX, aEY, hL - zone_a)],
        [new THREE.Vector3(hB, aEY, hL),          new THREE.Vector3(aRX, aEY, hL)],
      ],
      `a=${fmt(zone_a)}ft`, 'dim-a', null
    ));
    this._dimHighlight['dim-a'] = grp.children[grp.children.length - 1];

    // ── Zone 5 base dims (y = EPS_Y) ─────────────────────────────────────────
    // Front face RIGHT corner base
    const az5FZ = hL + D * 0.7;
    grp.add(this._buildDim(
      new THREE.Vector3(hB - zone_a, EPS_Y, az5FZ),
      new THREE.Vector3(hB,          EPS_Y, az5FZ),
      new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(hB - zone_a, EPS_Y, hL), new THREE.Vector3(hB - zone_a, EPS_Y, az5FZ)],
        [new THREE.Vector3(hB,          EPS_Y, hL), new THREE.Vector3(hB,          EPS_Y, az5FZ)],
      ],
      `a=${fmt(zone_a)}ft`, 'dim-a3', null
    ));
    this._dimHighlight['dim-a3'] = grp.children[grp.children.length - 1];

    // Right face FRONT corner base (zone-5 strip z=hL-zone_a to hL)
    const az5RX = hB + aOFF;
    grp.add(this._buildDim(
      new THREE.Vector3(az5RX, EPS_Y, hL - zone_a),
      new THREE.Vector3(az5RX, EPS_Y, hL),
      new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(hB, EPS_Y, hL - zone_a), new THREE.Vector3(az5RX, EPS_Y, hL - zone_a)],
        [new THREE.Vector3(hB, EPS_Y, hL),          new THREE.Vector3(az5RX, EPS_Y, hL)],
      ],
      `a=${fmt(zone_a)}ft`, 'dim-a4', null
    ));
    this._dimHighlight['dim-a4'] = grp.children[grp.children.length - 1];

    // ── θ angle dim — at front-left eave corner, in XY plane at z=hL ─────────
    if (theta > 0) {
      const arcR  = Math.max(3, Math.min(D * 0.5, zone_a));
      const ax    = -hB, ay = hEave, az = hL;
      const thRad = THREE.MathUtils.degToRad(theta);
      // Two legs of the angle indicator
      const legH = new THREE.Vector3(1, 0, 0);                               // horizontal
      const legS = new THREE.Vector3(Math.cos(thRad), Math.sin(thRad), 0);  // slope

      // Draw arc (10 segments, in the XY plane at z=az)
      const N = 12;
      const arcPts = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * thRad;
        arcPts.push(new THREE.Vector3(ax + arcR * Math.cos(a), ay + arcR * Math.sin(a), az));
      }
      const arcLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arcPts),
        new THREE.LineBasicMaterial({ color: 0x000000 })
      );
      grp.add(arcLine);

      // Two short radial legs
      const leg1 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ax, ay, az),
          new THREE.Vector3(ax + arcR * 1.2, ay, az)
        ]),
        new THREE.LineBasicMaterial({ color: 0x000000 })
      );
      const leg2 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ax, ay, az),
          new THREE.Vector3(ax + arcR * 1.2 * legS.x, ay + arcR * 1.2 * legS.y, az)
        ]),
        new THREE.LineBasicMaterial({ color: 0x000000 })
      );
      grp.add(leg1);
      grp.add(leg2);

      // CSS2D label at arc midpoint
      if (THREE.CSS2DObject) {
        const midAngle = thRad / 2;
        const midPt = new THREE.Vector3(
          ax + arcR * 1.6 * Math.cos(midAngle),
          ay + arcR * 1.6 * Math.sin(midAngle),
          az
        );
        const div = document.createElement('div');
        div.textContent = `θ=${fmt(theta)}°`;
        div.style.cssText = [
          'font-family:"JetBrains Mono",monospace',
          'font-size:13px', 'font-weight:600',
          'color:' + THEME.dimText,
          'background:' + THEME.dimBg,
          'padding:2px 8px', 'border-radius:4px',
          'border:1px solid #334155', 'white-space:nowrap',
          'pointer-events:none',
        ].join(';');
        const obj = new THREE.CSS2DObject(div);
        obj.position.copy(midPt);
        grp.add(obj);
      }
    }

    // ── Zone 2 "a" dims on hip roof slopes (only for hip) ───────────────────
    if (roofShape === 'hip') {
      const r2 = Math.max(0, hL - hB);

      // --- Triangular Front slope, right hip: dim perpendicular to hip on slope surface ---
      {
        const Bv = new THREE.Vector3(hB, hEave, hL);
        const Av = new THREE.Vector3(-hB, hEave, hL);
        const Cv = new THREE.Vector3(0, hRidge, r2);
        const hipDir = new THREE.Vector3().subVectors(Cv, Bv).normalize();
        // Triangular slope normal
        const e1 = new THREE.Vector3().subVectors(Bv, Av);
        const e2 = new THREE.Vector3().subVectors(Cv, Av);
        const sN  = new THREE.Vector3().crossVectors(e1, e2).normalize();
        if (sN.y < 0) sN.negate();
        // On-surface perpendicular to hip, pointing inward
        const perpH = new THREE.Vector3().crossVectors(hipDir, sN).normalize();
        const ctr3  = new THREE.Vector3(0, (hEave + hRidge) * 0.4, (hL + r2) * 0.5);
        if (perpH.dot(new THREE.Vector3().subVectors(ctr3, Bv)) < 0) perpH.negate();
        // Place the dim slightly above eave (halfway up the slope)
        const mid   = Bv.clone().lerp(Cv, 0.55);   // midway up hip = Zone 2 area
        const qa1   = mid.clone();
        const qa2   = mid.clone().addScaledVector(perpH, zone_a);
        // tick at 45° between hip direction and perpH (both in slope plane)
        const tick45T = hipDir.clone().sub(perpH).normalize();  // perpendicular to hip (90° rotation)
        const stub    = hipDir.clone().multiplyScalar(0.5);
        grp.add(this._buildDim(
          qa1, qa2, tick45T,
          [
            [qa1.clone().sub(stub), qa1.clone()],
            [qa2.clone().sub(stub), qa2.clone()],
          ],
          `a=${fmt(zone_a)}ft`, 'dim-aZ2T', null
        ));
        this._dimHighlight['dim-aZ2T'] = grp.children[grp.children.length - 1];
      }

      // --- Trapezoidal Right slope, front-left hip: dim perpendicular to hip on slope surface ---
      {
        const Bv  = new THREE.Vector3(hB, hEave,  hL);
        const BvB = new THREE.Vector3(hB, hEave, -hL);  // right-back eave corner
        const Cv  = new THREE.Vector3(0,  hRidge,  r2);
        const CvB = new THREE.Vector3(0,  hRidge, -r2);
        const hipDir = new THREE.Vector3().subVectors(Cv, Bv).normalize();
        // Trapezoidal slope normal (right slope, norm ≈ +X)
        const e1 = new THREE.Vector3().subVectors(Cv, Bv);
        const e2 = new THREE.Vector3().subVectors(BvB, Bv);
        const sN  = new THREE.Vector3().crossVectors(e1, e2).normalize();
        if (sN.x < 0) sN.negate();
        // On-surface perpendicular to hip
        const perpH = new THREE.Vector3().crossVectors(hipDir, sN).normalize();
        const ctrR  = new THREE.Vector3(hB * 0.5, hEave * 0.5 + hRidge * 0.5, 0);
        if (perpH.dot(new THREE.Vector3().subVectors(ctrR, Bv)) < 0) perpH.negate();
        // Place at midpoint of front hip of right slope
        const mid  = Bv.clone().lerp(Cv, 0.55);  // midway up hip = Zone 2 area
        const qa1  = mid.clone();
        const qa2  = mid.clone().addScaledVector(perpH, zone_a);
        // tick at 45° between hip direction and perpH (both in slope plane)
        const tick45R = hipDir.clone().sub(perpH).normalize();  // perpendicular to hip (90° rotation)
        const stub = hipDir.clone().multiplyScalar(0.5);
        grp.add(this._buildDim(
          qa1, qa2, tick45R,
          [
            [qa1.clone().sub(stub), qa1.clone()],
            [qa2.clone().sub(stub), qa2.clone()],
          ],
          `a=${fmt(zone_a)}ft`, 'dim-aZ2R', null
        ));
        this._dimHighlight['dim-aZ2R'] = grp.children[grp.children.length - 1];
      }
    }

    return grp;
  }

    /* ── zone overlays ──────────────────────────────────────────────────────── */

  _zoneQuad(u0, u1, v0, v1, ptFn, hB, hEave, hRidge, hL, norm, eps, mat, zoneType) {
    const off = norm.clone().multiplyScalar(eps);
    const geo = this._quad(
      ptFn(u0,v0,hB,hEave,hRidge,hL).add(off.clone()),
      ptFn(u1,v0,hB,hEave,hRidge,hL).add(off.clone()),
      ptFn(u1,v1,hB,hEave,hRidge,hL).add(off.clone()),
      ptFn(u0,v1,hB,hEave,hRidge,hL).add(off.clone()),
    );
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.renderOrder = 1;
    mesh.userData = {
      zoneType,
      asce_reference              : 'Figure 30.3-2A',
      internal_pressure_coefficient : 0.18,
      effective_wind_area_min     : 10,
      effective_wind_area_max     : 1000,
    };
    return mesh;
  }

  /* ── zone CSS2D labels with optional leader lines ───────────────────────── */

  _makeZoneLabel(zoneType, centroid, norm, hB, zone_a, L) {
    if (!THREE.CSS2DObject) return;

    const cfgMap = {
      'zone-1': { ...THEME.zoneLabel1, text: 'Zone 1 / Field'  },
      'zone-2': { ...THEME.zoneLabel2, text: 'Zone 2 / Edge'   },
      'zone-3': { ...THEME.zoneLabel3, text: 'Zone 3 / Corner' },
    };
    const cfg = cfgMap[zoneType];
    if (!cfg) return;

    // Estimate zone width on slope (in world units)
    // For zone-2/3, the zone may be narrow — push label outward + draw leader
    const isSmall = (zoneType === 'zone-3') || (zoneType === 'zone-2' && zone_a < L * 0.15);

    let labelPos = centroid.clone();
    let leaderEnd = null;

    if (isSmall) {
      // Push label out from building along the slope normal, projected to XZ
      const outDir = new THREE.Vector3(norm.x, 0, norm.z).normalize();
      const pushDist = zone_a * 2.5 + 10;
      leaderEnd = centroid.clone();
      labelPos  = centroid.clone().addScaledVector(outDir, pushDist);
      labelPos.y = centroid.y * 0.5 + 4; // bring toward mid-height
    }

    const div = document.createElement('div');
    div.textContent = cfg.text;
    div.style.cssText = [
      'font-family:"JetBrains Mono",monospace',
      'font-size:10px',
      'font-weight:600',
      `color:${cfg.fg}`,
      `background:${cfg.bg}`,
      'backdrop-filter:blur(3px)',
      'padding:2px 6px',
      'border-radius:3px',
      'pointer-events:none',
      'white-space:nowrap',
    ].join(';');

    const obj = new THREE.CSS2DObject(div);
    obj.position.copy(labelPos);
    obj.userData.faceNormal = norm.clone().normalize();  // for back-face culling in _animate
    this._labelGroup.add(obj);

    // Leader line from label position to zone centroid (for small zones)
    if (isSmall && leaderEnd) {
      const leaderGeo = new THREE.BufferGeometry().setFromPoints([labelPos, leaderEnd]);
      const leaderMat = new THREE.LineDashedMaterial({
        color: 0x94a3b8, dashSize: 1.5, gapSize: 1.2, transparent: true, opacity: 0.7,
      });
      const leader = new THREE.Line(leaderGeo, leaderMat);
      leader.computeLineDistances();
      this._labelGroup.add(leader);
    }
  }

  /* ── flat on-surface zone label — plane mesh glued to slope surface ─────────
     centroid   : THREE.Vector3  — centre of the label on the slope
     faceNormal : THREE.Vector3  — surface outward normal
     textDir    : THREE.Vector3  — direction the text reads (baseline direction)
     The plane is oriented so: local X = textDir, local Y = n×textDir, local Z = n.
     The label rotates with the building and never faces the camera.               */

  /* _makeZoneLabelFlat — converted to CSS2DObject so labels always face camera.
     centroid   : THREE.Vector3  — centre of the zone region
     faceNormal : THREE.Vector3  — surface outward normal (used for small offset only)
     textDir    : THREE.Vector3  — unused (kept for call-site compatibility)        */
  _makeZoneLabelFlat(zoneType, centroid, faceNormal, textDir) {
    if (!THREE.CSS2DObject) return;
    const cfgMap = {
      'zone-1': { bg:'rgba(52,211,153,0.92)',  fg:'#065f46', text:'Zone 1' },
      'zone-2': { bg:'rgba(16,185,129,0.92)',  fg:'#fff',    text:'Zone 2' },
      'zone-3': { bg:'rgba(239,68,68,0.92)',   fg:'#fff',    text:'Zone 3' },
      'zone-4': { bg:'rgba(6,182,212,0.92)',   fg:'#fff',    text:'Zone 4' },
      'zone-5': { bg:'rgba(29,78,216,0.92)',   fg:'#fff',    text:'Zone 5' },
    };
    const cfg = cfgMap[zoneType];
    if (!cfg) return;

    const div = document.createElement('div');
    div.textContent = cfg.text;
    div.style.cssText = [
      'font-family:"JetBrains Mono",monospace',
      'font-size:10px',
      'font-weight:700',
      `color:${cfg.fg}`,
      `background:${cfg.bg}`,
      'padding:2px 6px',
      'border-radius:3px',
      'pointer-events:none',
      'white-space:nowrap',
    ].join(';');

    // Offset slightly above surface so label clears the mesh face
    const pos = centroid.clone().addScaledVector(faceNormal.clone().normalize(), 0.15);
    const obj = new THREE.CSS2DObject(div);
    obj.position.copy(pos);
    obj.userData.faceNormal = faceNormal.clone().normalize();  // for back-face culling in _animate
    this._labelGroup.add(obj);
  }

  /* ── public API ─────────────────────────────────────────────────────────── */

  /**
   * Rebuild 3D model from ASCE 7-22 parameters.
   * @param {number} B       Building width, ft  (cross-wind)
   * @param {number} L       Building length, ft (along-wind)
   * @param {number} h       Ridge height, ft
   * @param {number} theta   Roof pitch, degrees
   * @param {number} zone_a  ASCE 7-22 §26.2 edge dimension, ft
   */
  update3DModel(B, L, h, theta, zone_a, roofShape) {
    B = +B||48; L = +L||96; h = +h||66; theta = +theta||15; zone_a = +zone_a||4;

    /* For hip roofs, always orient so B <= L (B = short cross-wind span that
       sets eave height; L = long ridge axis). Apply swap before all geometry
       so hB/hL, wall zones, dim lines, and UV mapping stay consistent. */
    const _shape = roofShape || 'gable';
    if (_shape === 'hip' && B > L) { [B, L] = [L, B]; }

    const H_SCALE  = 1.8;  // vertical exaggeration — keeps proportions readable
    const th       = THREE.MathUtils.degToRad(theta);
    const hB       = B/2, hL = L/2;
    const hEave_ft = Math.max(1, h - hB * Math.tan(th));  // actual eave height, ft
    const hRidge_ft = h;                                   // actual ridge height, ft
    const hEave    = hEave_ft  * H_SCALE;  // scaled for rendering
    const hRidge   = hRidge_ft * H_SCALE;

    // clear
    for (const g of [this._building, this._zones, this._dimGroup, this._labelGroup]) {
      if (g) { this._scene.remove(g); disposeGroup(g); }
    }
    this._building    = new THREE.Group();
    this._zones       = new THREE.Group();
    this._dimGroup    = new THREE.Group();
    this._labelGroup  = new THREE.Group();
    this._zoneMeshes      = [];
    this._dimHighlight    = {};
    this._dimLabelMeshes  = [];   // reset flat label meshes each rebuild

    // building — dispatch by roof shape
    if (_shape === 'hip') {
      this._building = this._buildStructureHip(B, L, hEave, hRidge);
    } else if (_shape === 'monoslope') {
      this._building = this._buildStructureMonoslope(B, L, hEave, hRidge);
    } else {
      /* gable or flat (flat = gable with theta=0, already handled by caller) */
      this._building = this._buildStructure(B, L, hEave, hRidge);
    }

    // dim lines (pass hRidge_ft so label shows real engineering value, not scaled)
    this._dimGroup = this._buildAllDims(B, L, hEave, hRidge, zone_a, hRidge_ft, hEave_ft, theta, _shape);

    // zones — shape-specific surface mapping
    const matZ = (col, op) => new THREE.MeshBasicMaterial({
      color:col, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false,
    });

    const u_zone = Math.min(zone_a / hB, 0.45);
    const v_zone = Math.min(zone_a / L,  0.45);
    const u1 = 1 - u_zone, v1 = 1 - v_zone;

    /* addZone: maps region [u0..u1]×[v0..v1] onto the surface defined by ptFn/norm */
    const addZone = (u0,uu1,v0,vv1,col,op,zt,eps,ptFn,norm,label) => {
      const m = this._zoneQuad(u0,uu1,v0,vv1,ptFn,hB,hEave,hRidge,hL,norm,eps,matZ(col,op),zt);
      this._zones.add(m);
      this._zoneMeshes.push(m);
      if (label) {
        const ctr = this._zoneCentroid(u0,uu1,v0,vv1,ptFn,hB,hEave,hRidge,hL);
        ctr.addScaledVector(norm, eps + 0.5);
        this._makeZoneLabel(zt, ctr, norm, hB, zone_a, L);
      }
    };

    /* Shared zone layout applied to one surface (doLabel = draw text labels) */
    const drawZones = (ptFn, norm, doLabel) => {
      addZone(u_zone,u1, v_zone,v1, THEME.zone1,0.20,'zone-1',0.02,ptFn,norm,doLabel);
      addZone(0,u_zone,  v_zone,v1, THEME.zone2,0.35,'zone-2',0.07,ptFn,norm,doLabel);
      addZone(u1,1,      v_zone,v1, THEME.zone2,0.35,'zone-2',0.07,ptFn,norm,false);
      addZone(u_zone,u1, 0,v_zone,  THEME.zone2,0.35,'zone-2',0.07,ptFn,norm,false);
      addZone(u_zone,u1, v1,1,      THEME.zone2,0.35,'zone-2',0.07,ptFn,norm,false);
      addZone(0,u_zone,  0,v_zone,  THEME.zone3,0.65,'zone-3',0.12,ptFn,norm,doLabel);
      addZone(0,u_zone,  v1,1,      THEME.zone3,0.65,'zone-3',0.12,ptFn,norm,false);
      addZone(u1,1,      0,v_zone,  THEME.zone3,0.65,'zone-3',0.12,ptFn,norm,false);
      addZone(u1,1,      v1,1,      THEME.zone3,0.65,'zone-3',0.12,ptFn,norm,false);
    };

    if (_shape === 'monoslope') {
      /* Single sloped surface: u=0 → windward/high (X=-hB, Y=hRidge)
                                 u=1 → leeward/low  (X=+hB, Y=hEave)  */
      const ptMono = (u, v, hB, hEave, hRidge, hL) => new THREE.Vector3(
        -hB + u * 2 * hB,
        hRidge - u * (hRidge - hEave),
        v * 2 * hL - hL
      );
      const _e1 = new THREE.Vector3(2*hB, hEave - hRidge, 0);  // along u direction
      const _e2 = new THREE.Vector3(0, 0, 2*hL);               // along v direction
      const monoNorm = new THREE.Vector3().crossVectors(_e2, _e1).normalize();
      if (monoNorm.y < 0) monoNorm.negate();
      drawZones(ptMono, monoNorm, true);

    } else if (_shape === 'hip') {
      /* Hip roof zones — ASCE 7-22 Figs. 30.3-2D–2G
         Zone 3: outer eave perimeter strip (all 4 eave edges, continuous), width a
         Zone 2: continuous strip width a along hip ridges + main ridge
                 — U-shaped on trapezoidal slopes (side→top→side)
                 — constant-width strips along both hips on triangular end slopes
         Zone 1: interior                                                            */
      const _hipB  = Math.min(B, L), _hipL = Math.max(B, L);
      const _hipHB = _hipB / 2, _hipHL = _hipL / 2;
      const _triH  = _hipHB;                                // hip triangle plan height = _hipHB (equal-pitch)
      const _r2    = _hipHL - _triH;                        // half ridge length
      const L_hip  = Math.sqrt(_hipHB*_hipHB + _triH*_triH); // hip ridge plan length

      /* Surface functions for trapezoidal main slopes */
      const ptHipL = (u, v) => {
        const zH = (1-u)*_hipHL + u*_r2;
        return new THREE.Vector3(-_hipHB*(1-u), (1-u)*hEave + u*hRidge, (2*v-1)*zH);
      };
      const ptHipR = (u, v) => {
        const zH = (1-u)*_hipHL + u*_r2;
        return new THREE.Vector3( _hipHB*(1-u), (1-u)*hEave + u*hRidge, (2*v-1)*zH);
      };
      const wrapL = (u,v,_a,_b,_c,_d) => ptHipL(u,v);
      const wrapR = (u,v,_a,_b,_c,_d) => ptHipR(u,v);

      const _leftNorm  = this._leftNormal(_hipHB, hEave, hRidge, _hipHL);
      const _rightNorm = new THREE.Vector3(-_leftNorm.x, _leftNorm.y, _leftNorm.z);

      /* Zone width fractions for main slopes
         Hip-ridge Zone 2 inner boundary uses PERPENDICULAR plan distance a from the hip ridge:
           v_perp(u) = zone_a * L_hip / (2 * _hipHB * zHalf(u))
         This gives constant-width a strips rather than constant-z-depth strips.          */
      const _ua   = Math.min(zone_a / _hipHB,                        0.45);  // Zone 3 eave
      const _ua2  = Math.min(zone_a / _hipHB,                        0.45);  // Zone 2 ridge
      const _ve   = Math.min(zone_a*L_hip / (2*_hipHB*_hipHL),       0.45);  // hip-ridge v at u=0
      const _vr   = _r2 > 0.5
        ? Math.min(zone_a*L_hip / (2*_hipHB*_r2), 0.45)
        : 0.45;                                                               // hip-ridge v at u=1
      /* Corrected v-boundaries at the actual u-endpoints of the hip strips.
         Hip strips run u=[_ua, 1-_ua2]; zHalf varies so _ve/_vr (computed at
         u=0 and u=1) are wrong at the truncated endpoints.                        */
      const _zH_ua  = (1 - _ua)  * _hipHL + _ua        * _r2;   // zHalf at u=_ua
      const _zH_ua2 =      _ua2  * _hipHL + (1 - _ua2) * _r2;   // zHalf at u=1-_ua2
      const _ve_h   = Math.min(zone_a*L_hip / (2*_hipHB * _zH_ua),  0.45); // v at strip start
      const _vr_h   = Math.min(zone_a*L_hip / (2*_hipHB * _zH_ua2), 0.45); // v at strip end

      /* Helper: explicit quad mesh */
      const addQuadMesh = (p0, p1, p2, p3, norm_, zt, op, eps) => {
        const off_ = norm_.clone().multiplyScalar(eps);
        const geo  = this._quad(
          p0.clone().add(off_), p1.clone().add(off_),
          p2.clone().add(off_), p3.clone().add(off_)
        );
        const mesh = new THREE.Mesh(geo, matZ(
          zt==='zone-1' ? THEME.zone1 : zt==='zone-2' ? THEME.zone2 : THEME.zone3, op
        ));
        mesh.renderOrder = 1;
        mesh.userData = { zoneType: zt };
        this._zones.add(mesh);
        this._zoneMeshes.push(mesh);
      };

      /* ── Trapezoidal main slopes: Zone 2 is a continuous U-shaped band ── */
      const drawHipMainSlope = (ptFn, norm, doLbl) => {
        /* Zone 1: interior — use _ve_h/_vr_h (calibrated at the strip endpoints u=_ua
           and u=1-_ua2) so the corners align exactly with the hip strip inner edges.    */
        addQuadMesh(
          ptFn(_ua,      _ve_h,  0,0,0,0),   // bottom-left
          ptFn(_ua,    1-_ve_h,  0,0,0,0),   // bottom-right
          ptFn(1-_ua2, 1-_vr_h, 0,0,0,0),   // top-right
          ptFn(1-_ua2,   _vr_h, 0,0,0,0),   // top-left
          norm, 'zone-1', 0.20, 0.02
        );

        /* Zone 2 — non-overlapping U-shaped band:
           hip strips run only u=[_ua, 1-_ua2]; ridge block u=[1-_ua2, 1] full v.
           Zone 3 u=[0,_ua]. All pieces share edges only — no double-alpha.
           _ve_h/_vr_h keep the inner boundary exactly parallel to the hip ridges.       */

        /* Back hip strip: u=[_ua, 1-_ua2], v=[0 → _ve_h.._vr_h] */
        addQuadMesh(
          ptFn(_ua,        0, 0,0,0,0), ptFn(_ua,      _ve_h, 0,0,0,0),
          ptFn(1-_ua2, _vr_h, 0,0,0,0), ptFn(1-_ua2,       0, 0,0,0,0),
          norm, 'zone-2', 0.35, 0.07
        );

        /* Front hip strip: u=[_ua, 1-_ua2], v=[1-_ve_h..1-_vr_h → 1] */
        addQuadMesh(
          ptFn(_ua,    1-_ve_h, 0,0,0,0), ptFn(_ua,          1, 0,0,0,0),
          ptFn(1-_ua2,       1, 0,0,0,0), ptFn(1-_ua2, 1-_vr_h, 0,0,0,0),
          norm, 'zone-2', 0.35, 0.07
        );

        /* Ridge block: u=[1-_ua2, 1], full v — meets hip strips at u=1-_ua2 exactly */
        addZone(1-_ua2, 1, 0, 1, THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);

        /* Zone 3: eave strip u=[0, _ua] — meets hip strips at u=_ua exactly */
        addZone(0, _ua, 0, 1, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);

        /* Flat on-surface labels — glued to slope, rotate with building.
           textDir along Z (ridge direction). Flip for right slope so text reads
           in the same apparent direction when that face is viewed head-on.        */
        const _tD = norm.x < 0
          ? new THREE.Vector3(0, 0,  1)   // left slope  (norm.x < 0): front→back
          : new THREE.Vector3(0, 0, -1);  // right slope (norm.x > 0): back→front
        const _uM = (_ua + 1 - _ua2) / 2;   // mid-u of Zone 1/hip-strip range
        this._makeZoneLabelFlat(
          'zone-1', ptFn(_uM, 0.5, 0,0,0,0), norm, _tD
        );
        this._makeZoneLabelFlat(
          'zone-2', ptFn(1 - _ua2 / 2, 0.5, 0,0,0,0), norm, _tD
        );
        this._makeZoneLabelFlat(
          'zone-3', ptFn(_ua / 2, 0.5, 0,0,0,0), norm, _tD
        );
      };

      drawHipMainSlope(wrapL, _leftNorm,  true);
      drawHipMainSlope(wrapR, _rightNorm, false);

      /* ── Triangular end slopes: Zone 2 = constant-width a strips along both hips ── */
      for (const zs of [-1, 1]) {
        const zA = zs * _hipHL;    // base z (eave)
        const zC = zs * _r2;      // apex z (ridge end)

        const A  = new THREE.Vector3(-_hipHB, hEave, zA);   // left base corner
        const Bv = new THREE.Vector3( _hipHB, hEave, zA);   // right base corner
        const C  = new THREE.Vector3(      0, hRidge, zC);  // apex

        const _e1t = new THREE.Vector3().subVectors(Bv, A);
        const _e2t = new THREE.Vector3().subVectors(C, A);
        const tN   = new THREE.Vector3().crossVectors(_e1t, _e2t).normalize();
        if (tN.y < 0) tN.negate();

        const lerp3 = (p, q, t) => new THREE.Vector3(
          p.x+t*(q.x-p.x), p.y+t*(q.y-p.y), p.z+t*(q.z-p.z)
        );

        /* Zone 3 base strip boundary at plan distance zone_a from eave */
        const t_b = Math.min(zone_a / _triH, 0.70);   // fraction from base toward apex
        const D   = lerp3(A,  C, t_b);                // on left hip ridge at Zone 3 boundary
        const E   = lerp3(Bv, C, t_b);                // on right hip ridge at Zone 3 boundary

        /* Zone 2 left strip inner boundary on base AB:
           Perp distance a from hip ridge AC in plan →
           P_L_base_x = -_hipHB + zone_a * L_hip / _triH = -_hipHB + zone_a*sqrt(2)  */
        const dOff     = zone_a * L_hip / _triH;           // = zone_a * sqrt(2) for equal pitch
        const P_L_x    = Math.min(-_hipHB + dOff, 0);      // clamp at x=0
        const P_R_x    = Math.max( _hipHB - dOff, 0);
        const P_L_base = new THREE.Vector3(P_L_x, hEave, zA);
        const P_R_base = new THREE.Vector3(P_R_x, hEave, zA);

        /* Zone 2 inner boundary endpoints — parallelogram approach:
           P_L_top: where Zone 2-left inner boundary exits the triangle (on BC)
           P_R_top: where Zone 2-right inner boundary exits the triangle (on AC)
           s_top = 1 - zone_a/L_hip gives constant-width strip parallel to each hip ridge */
        const s_top   = Math.max(0.01, 1 - zone_a / L_hip);
        const P_L_top = lerp3(Bv, C, s_top);   // on right hip ridge BC
        const P_R_top = lerp3(A,  C, s_top);   // on left hip ridge AC

        const addTriPart = (pts, zt, op, eps) => {
          const off_ = tN.clone().multiplyScalar(eps);
          let geo;
          if (pts.length === 3) {
            geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
              pts[0].x+off_.x, pts[0].y+off_.y, pts[0].z+off_.z,
              pts[1].x+off_.x, pts[1].y+off_.y, pts[1].z+off_.z,
              pts[2].x+off_.x, pts[2].y+off_.y, pts[2].z+off_.z,
            ]), 3));
            geo.computeVertexNormals();
          } else {
            geo = this._quad(
              pts[0].clone().add(off_), pts[1].clone().add(off_),
              pts[2].clone().add(off_), pts[3].clone().add(off_)
            );
          }
          const mesh = new THREE.Mesh(geo, matZ(
            zt==='zone-1' ? THEME.zone1 : zt==='zone-2' ? THEME.zone2 : THEME.zone3, op
          ));
          mesh.renderOrder = 1;
          mesh.userData = { zoneType: zt };
          this._zones.add(mesh);
          this._zoneMeshes.push(mesh);
        };

        /* M_L / M_R: Zone 2 inner boundary at Zone 3 level                            */
        const t_inn = Math.min(t_b / Math.max(s_top, 0.01), 0.99);
        const M_L   = lerp3(P_L_base, P_L_top, t_inn);
        const M_R   = lerp3(P_R_base, P_R_top, t_inn);

        /* Mx: where Zone 2-left inner boundary crosses the apex axis x=0.
           Splitting both Zone 2 strips at this axis (left half → Zone 2 left,
           right half → Zone 2 right) eliminates the apex triangle and all
           interior overlaps. The two strips share only the edge Mx→C.              */
        const t_x0 = Math.min(Math.max((-P_L_x) / (P_L_top.x - P_L_x + 1e-6), 0), 1);
        const Mx   = lerp3(P_L_base, P_L_top, t_x0);   // Mx.x ≈ 0

        /* Zone 1: triangle (M_L, M_R, Mx) — interior, above Zone 3 */
        if (M_L.x < M_R.x - 0.1) {
          addTriPart([M_L, M_R, Mx], 'zone-1', 0.20, 0.02);
        }

        /* Zone 2 left: quad (D, M_L, Mx, C) — x≤0 side, joins Zone 2 right at Mx→C */
        addTriPart([D, M_L, Mx, C], 'zone-2', 0.35, 0.07);

        /* Zone 2 right: quad (M_R, E, C, Mx) — x≥0 side, no interior overlap */
        addTriPart([M_R, E, C, Mx], 'zone-2', 0.35, 0.07);

        /* Zone 3: (A, Bv, E, D) — meets Zone 2 exactly at D–E edge */
        addTriPart([A, Bv, E, D], 'zone-3', 0.65, 0.12);

        /* Flat on-surface labels for this triangular slope.
           textDir along +X for front slope (zs=1), -X for back (zs=-1) so the
           text reads correctly when each slope is viewed head-on.                 */
        const _triTD = new THREE.Vector3(zs > 0 ? 1 : -1, 0, 0);

        // Zone 1 centroid: average of triangle (M_L, M_R, Mx)
        const _ctr1 = new THREE.Vector3(
          (M_L.x + M_R.x + Mx.x) / 3,
          (M_L.y + M_R.y + Mx.y) / 3,
          (M_L.z + M_R.z + Mx.z) / 3
        );
        if (M_L.x < M_R.x - 0.1) {
          this._makeZoneLabelFlat('zone-1', _ctr1, tN, _triTD);
        }

        // Zone 2 centroid: halfway between Mx (inner-boundary axis crossing) and C
        //   (apex), placing the label in the upper Zone 2 band between Zone 1 and ridge.
        const _ctr2 = new THREE.Vector3(
          0,
          Mx.y + 0.4 * (C.y - Mx.y),   // 0.5→0.4: lower by 20% toward Zone 1
          Mx.z + 0.4 * (C.z - Mx.z)
        );
        this._makeZoneLabelFlat('zone-2', _ctr2, tN, _triTD);

        // Zone 3 centroid: average of trapezoid (A, Bv, E, D)
        const _ctr3 = new THREE.Vector3(
          (A.x + Bv.x + E.x + D.x) / 4,
          (A.y + Bv.y + E.y + D.y) / 4,
          (A.z + Bv.z + E.z + D.z) / 4
        );
        this._makeZoneLabelFlat('zone-3', _ctr3, tN, _triTD);
      }

    } else {
      /* Gable (or flat, theta=0): two rectangular slopes */
      const _leftNorm  = this._leftNormal(hB, hEave, hRidge, hL);
      const _rightNorm = new THREE.Vector3(-_leftNorm.x, _leftNorm.y, _leftNorm.z);
      drawZones(this._ptL.bind(this), _leftNorm,  true);
      drawZones(this._ptR.bind(this), _rightNorm, false);
    }

    /* ── Wall C&C zones 4 and 5 (ASCE 7-22 §30.3-2A) ──────────────────────────
       Zone 5: vertical end strip width 'a' at each corner of every facade
       Zone 4: rest of wall field
       Drawn as flat quads offset 0.05 ft from each wall face.              */
    this._drawWallZones(B, L, hEave, zone_a, matZ);

    // Collect opaque building meshes for per-frame label occlusion raycasting
    this._buildingMeshes = [];
    this._building.traverse(obj => { if (obj.isMesh) this._buildingMeshes.push(obj); });

    this._scene.add(this._building);
    this._scene.add(this._zones);
    this._scene.add(this._dimGroup);
    this._scene.add(this._labelGroup);

    // reframe camera
    const span = Math.max(B, L, h);
    this._controls.target.set(0, hEave * 0.6, 0);
    this._camera.position.set(span*1.5, span*0.9, span*1.7);
    this._controls.update();
  }

  /* ── dim highlighting ───────────────────────────────────────────────────── */

  /**
   * Highlight or reset a named dimension group.
   * @param {string}  dimId  'dim-B' | 'dim-L' | 'dim-h' | 'dim-a'
   * @param {boolean} active
   */
  highlightDim(dimId, active) {
    const dg = this._dimHighlight[dimId];
    if (!dg) return;
    const col = active ? THEME.dimActive : THEME.dimLine;
    (dg.userData.lines || []).forEach(l => l.material.color.setHex(col));
    if (dg.userData.setLabelActive) dg.userData.setLabelActive(active);
  }

  onZoneClick(cb) { this._clickCB = cb; }

  /* ── interaction ────────────────────────────────────────────────────────── */

  _ndc(e) {
    const r = this._renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width)  *  2 - 1,
      ((e.clientY - r.top)  / r.height) * -2 + 1
    );
  }

  _hitZones(ndc) {
    this._raycaster.setFromCamera(ndc, this._camera, ndc);
    return this._raycaster.intersectObjects(this._zoneMeshes);
  }

  _handleClick(e) {
    const ndc = this._ndc(e);
    // Zone click
    const zHits = this._hitZones(ndc);
    if (zHits.length > 0 && this._clickCB) {
      this._clickCB(zHits[0].object.userData.zoneType);
      return;
    }
    // Dim label clicks are handled directly by DOM listeners on CSS2DObject elements.
  }

  _handleHover(e) {
    const hits = this._hitZones(this._ndc(e));
    const zone = hits.length > 0 ? hits[0].object.userData.zoneType : null;
    if (zone === this._hoverZone) return;
    if (this._hoverZone) {
      this._zoneMeshes.filter(m => m.userData.zoneType === this._hoverZone)
        .forEach(m => { m.material.opacity *= 0.65; });
    }
    this._hoverZone = zone;
    if (zone) {
      this._zoneMeshes.filter(m => m.userData.zoneType === zone)
        .forEach(m => { m.material.opacity = Math.min(0.9, m.material.opacity / 0.65); });
      this._renderer.domElement.style.cursor = 'pointer';
    } else {
      this._renderer.domElement.style.cursor = '';
    }
  }

  /* ── cleanup ─────────────────────────────────── */

  dispose() {
    cancelAnimationFrame(this._animId);
    window.removeEventListener('resize', this._onResize);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    this._renderer.dispose();
    [this._renderer.domElement, this._labelRenderer?.domElement]
      .filter(Boolean).forEach(el => el.parentNode?.removeChild(el));
    [this._building, this._zones, this._dimGroup, this._labelGroup]
      .filter(Boolean).forEach(g => { this._scene.remove(g); disposeGroup(g); });
    this._container.innerHTML = '';
  }
}
