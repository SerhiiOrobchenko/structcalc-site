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

  zone1p     : 0x4ade80,   // green-400  — Zone 1' central field
  zone1      : 0xfde047,   // yellow-300 — interior field
  zone2      : 0xfb923c,   // orange-400 — edges (brighter orange)
  zone3      : 0xdc2626,   // red-600    — corners (deeper red)
  zone4      : 0x7dd3fc,   // sky-300    — wall field
  zone5      : 0xa78bfa,   // violet-400 — wall corner strip
  zone2p     : 0xf97316,   // orange-500 — Zone 2' (enhanced edge, high eave)
  zone3p     : 0x991b1b,   // red-800    — Zone 3' (worst corner, high eave)
  zoneLabel1p : { bg:'rgba(74,222,128,0.92)',  fg:'#14532d' },  // green-400  — Zone 1'
  zoneLabel1  : { bg:'rgba(253,224,71,0.92)',  fg:'#713f12' },  // yellow-300 — Zone 1
  zoneLabel2  : { bg:'rgba(251,146,60,0.92)',  fg:'#7c2d12' },  // orange-400 — Zone 2
  zoneLabel2p : { bg:'rgba(249,115,22,0.92)',  fg:'#fff' },     // orange-500 — Zone 2'
  zoneLabel3  : { bg:'rgba(220,38,38,0.92)',   fg:'#fff' },     // red-600    — Zone 3
  zoneLabel3p : { bg:'rgba(153,27,27,0.92)',   fg:'#fff' },     // red-800    — Zone 3'
  zoneLabel4 : { bg:'rgba(125,211,252,0.92)', fg:'#0c4a6e' },  // sky-300
  zoneLabel5 : { bg:'rgba(167,139,250,0.92)', fg:'#2e1065' },  // violet-400
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
        'clip-path:polygon(13px 0,59px 0,59px 13px,72px 13px,72px 59px,59px 59px,59px 72px,13px 72px,13px 59px,0 59px,0 13px,13px 13px)',
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
    const MCBG   = 'rgb(140,185,220)';  // steel-blue void cube
    const MCBGHV = 'rgb(60,140,210)';   // deeper blue on hover

    // [css_cx, css_cy, css_cz, tjs_dx, tjs_dy, tjs_dz]
    // CSS +Y is down; Three.js +Y is up → tjs_dy = -(css_cy sign)
    // Offset by (HALF - MHALF) so each mini-cube is flush with (not protruding from) the main face.
    const CI = HALF - MHALF;  // flush: outer mini-face aligns with main cube surface
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
        `transform:translate(-50%,-50%) translateX(${cx}px) translateY(${cy}px) translateZ(${cz}px) scale(1.1)`,
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
          `transform:${tfm}translateZ(${MHALF}px)`,
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

    // 1) Dim labels: back-face cull by stored viewNormal, then raycast occlusion
    if (this._buildingMeshes && this._buildingMeshes.length && this._dimGroup) {
      const camPos = this._camera.position;
      const _tmp   = new THREE.Vector3();
      this._dimGroup.traverse(obj => {
        if (!obj.isCSS2DObject) return;
        obj.getWorldPosition(_tmp);
        // a) face-normal culling — hide if the dim face points away from camera
        const fn = obj.userData.faceNormal;
        if (fn) {
          const facingCam = fn.dot(new THREE.Vector3().subVectors(camPos, _tmp)) > 0;
          if (!facingCam) { obj.visible = false; return; }
        }
        // b) raycast occlusion — hide if building mesh is between camera and label
        const distToLabel = camPos.distanceTo(_tmp);
        const dir = _tmp.clone().sub(camPos).normalize();
        this._raycaster.set(camPos, dir);
        const hits = this._raycaster.intersectObjects(this._buildingMeshes, false);
        const occluded = hits.some(h => h.distance < distToLabel - 1.0);
        obj.visible = !occluded;
      });
    }

    // 2) Zone labels: back-face cull, then raycast occlusion
    if (this._labelGroup) {
      const camPos2 = this._camera.position;
      const _tmpL   = new THREE.Vector3();
      this._labelGroup.traverse(obj => {
        if (!obj.isCSS2DObject) return;
        const fn = obj.userData.faceNormal;
        if (!fn) return;                  // no normal stored — always show
        obj.getWorldPosition(_tmpL);
        // a) back-face culling
        const facingCamera = fn.dot(new THREE.Vector3().subVectors(camPos2, _tmpL)) > 0;
        if (!facingCamera) { obj.visible = false; return; }
        // b) raycast occlusion (for floating labels pushed away from surface)
        if (this._buildingMeshes && this._buildingMeshes.length) {
          const distL = camPos2.distanceTo(_tmpL);
          const dirL  = _tmpL.clone().sub(camPos2).normalize();
          this._raycaster.set(camPos2, dirL);
          const hitsL = this._raycaster.intersectObjects(this._buildingMeshes, false);
          if (hitsL.some(h => h.distance < distL - 1.0)) {
            obj.visible = false; return;
          }
        }
        obj.visible = true;
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

  _buildStructure(B, L, hEave, hRidge, wo = 0) {
    const hB = B/2, hL = L/2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;

    /* DoubleSide so each panel is visible from both directions as camera orbits */
    const solidMat = c => new THREE.MeshStandardMaterial({
      color:c, transparent:false, side:THREE.DoubleSide,
    });

    /* Helper: add tube edges along an explicit list of [p1,p2] segments */
    const segs = (pairs, col) => {
      for (const [a, b] of pairs) { const t = this._tube(a, b, col, EDGE_R); if (t) grp.add(t); }
    };

    /* ── LEFT wall (x = -hB) — rectangle ───────────────────────────────── */
    {
      const p = [
        new THREE.Vector3(-hB, 0,     -hL), new THREE.Vector3(-hB, 0,      hL),
        new THREE.Vector3(-hB, hEave,  hL), new THREE.Vector3(-hB, hEave, -hL),
      ];
      grp.add(new THREE.Mesh(this._quad(p[0],p[1],p[2],p[3]), solidMat(THEME.wallFill)));
      segs([[p[0],p[1]],[p[1],p[2]],[p[3],p[0]]], THEME.wallEdge); // no top edge
    }

    /* ── RIGHT wall (x = +hB) — rectangle ──────────────────────────────── */
    {
      const p = [
        new THREE.Vector3(hB, 0,      hL), new THREE.Vector3(hB, 0,     -hL),
        new THREE.Vector3(hB, hEave, -hL), new THREE.Vector3(hB, hEave,  hL),
      ];
      grp.add(new THREE.Mesh(this._quad(p[0],p[1],p[2],p[3]), solidMat(THEME.wallFill)));
      segs([[p[0],p[1]],[p[1],p[2]],[p[3],p[0]]], THEME.wallEdge); // no top edge
    }

    /* ── BACK end wall + gable (z = -hL) — PENTAGON, same as front ─────
       Outward normal is -Z so vertex winding is mirrored vs. front.     */
    {
      const BL = new THREE.Vector3( hB, 0,     -hL);   // bottom-left  (viewed from outside)
      const BR = new THREE.Vector3(-hB, 0,     -hL);   // bottom-right
      const RE = new THREE.Vector3(-hB, hEave, -hL);   // right eave
      const RG = new THREE.Vector3(  0, hRidge,-hL);   // ridge peak
      const LE = new THREE.Vector3( hB, hEave, -hL);   // left eave
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        BL.x,BL.y,BL.z, BR.x,BR.y,BR.z, RE.x,RE.y,RE.z,
        BL.x,BL.y,BL.z, RE.x,RE.y,RE.z, RG.x,RG.y,RG.z,
        BL.x,BL.y,BL.z, RG.x,RG.y,RG.z, LE.x,LE.y,LE.z,
      ]), 3));
      geo.computeVertexNormals();
      grp.add(new THREE.Mesh(geo, solidMat(THEME.wallFill)));
      segs([[BL,BR],[BR,RE],[LE,BL]], THEME.wallEdge); // rake edges hidden under roof
    }

    /* ── FRONT end wall + gable (z = +hL) — PENTAGON, seamless ─────────
       Five vertices: BL, BR, right-eave, ridge-peak, left-eave.
       No internal horizontal edge between wall and gable.               */
    {
      const BL = new THREE.Vector3(-hB, 0,      hL);   // bottom-left
      const BR = new THREE.Vector3( hB, 0,      hL);   // bottom-right
      const RE = new THREE.Vector3( hB, hEave,  hL);   // right eave
      const RG = new THREE.Vector3(  0, hRidge, hL);   // ridge peak
      const LE = new THREE.Vector3(-hB, hEave,  hL);   // left eave
      /* Fan triangulation from BL — all give outward +Z normal */
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        BL.x,BL.y,BL.z, BR.x,BR.y,BR.z, RE.x,RE.y,RE.z,   // lower-right
        BL.x,BL.y,BL.z, RE.x,RE.y,RE.z, RG.x,RG.y,RG.z,   // upper-right
        BL.x,BL.y,BL.z, RG.x,RG.y,RG.z, LE.x,LE.y,LE.z,   // upper-left
      ]), 3));
      geo.computeVertexNormals();
      grp.add(new THREE.Mesh(geo, solidMat(THEME.wallFill)));
      /* Perimeter only: BL→BR→RE→RG→LE→BL (5 edges, no horizontal seam) */
      segs([[BL,BR],[BR,RE],[LE,BL]], THEME.wallEdge); // rake edges hidden under roof
    }

    /* -- Roof slopes (extend to overhang boundary) ----------------------- */
    const slope  = hB > 0 ? (hRidge - hEave) / hB : 0;
    const hOh    = hEave - wo * slope;
    const hBo    = hB + wo, hLo = hL + wo;
    const leftGeo = this._quad(
      new THREE.Vector3(-hBo, hOh,    -hLo),
      new THREE.Vector3(-hBo, hOh,    +hLo),
      new THREE.Vector3(  0,  hRidge, +hLo),
      new THREE.Vector3(  0,  hRidge, -hLo),
    );
    const rightGeo = this._quad(
      new THREE.Vector3( hBo, hOh,    -hLo),
      new THREE.Vector3(   0, hRidge, -hLo),
      new THREE.Vector3(   0, hRidge, +hLo),
      new THREE.Vector3( hBo, hOh,    +hLo),
    );
    const roofSide = new THREE.MeshStandardMaterial({
      color:THEME.roofFill, transparent:false, side:THREE.DoubleSide,
    });
    for (const [g, mat] of [[leftGeo,roofSide],[rightGeo,roofSide.clone()]]) {
      const m = new THREE.Mesh(g, mat); m.castShadow=true; grp.add(m);
      this._tubeEdges(new THREE.EdgesGeometry(g), THEME.roofEdge, EDGE_R, grp);
    }

    /* -- Ridge -------------------------------------------------------------- */
    {
      const t = this._tube(new THREE.Vector3(0,hRidge,-hLo), new THREE.Vector3(0,hRidge,hLo), THEME.ridge, EDGE_R);
      if (t) grp.add(t);
    }


    return grp;
  }

  /* ── hip roof builder ───────────────────────────────────────────────────── */

  _buildStructureHip(B, L, hEave, hRidge, wo = 0) {
    /* Hip roof geometry:
       B <= L: ridge along Z, trapezoidal slopes at x=+/-hB, triangular ends at z=+/-hL
       B >  L: ridge along X, trapezoidal slopes at z=+/-hL, triangular ends at x=+/-hB */
    const hB = B / 2, hL = L / 2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;
    const solidMat = c => new THREE.MeshStandardMaterial({
      color: c, transparent: false, side: THREE.FrontSide,
    });
    const roofMat = () => new THREE.MeshStandardMaterial({
      color: THEME.roofFill, transparent: false, side: THREE.DoubleSide,
    });

    /* Walls -- box spans B (X) x hEave (Y) x L (Z) regardless of B vs L */
    const boxGeo = new THREE.BoxGeometry(B, hEave, L);
    boxGeo.translate(0, hEave / 2, 0);
    grp.add(new THREE.Mesh(boxGeo, solidMat(THEME.wallFill)));
    // Wall edges: bottom perimeter + 4 verticals; top edges omitted (hidden under roof)
    const segs = (pairs, col) => {
      for (const [a, b] of pairs) { const t = this._tube(a, b, col, EDGE_R); if (t) grp.add(t); }
    };
    { const [x1,x2,z1,z2,y0,y1] = [-hB,hB,-hL,hL,0,hEave];
      segs([[new THREE.Vector3(x1,y0,z1),new THREE.Vector3(x2,y0,z1)],
            [new THREE.Vector3(x2,y0,z1),new THREE.Vector3(x2,y0,z2)],
            [new THREE.Vector3(x2,y0,z2),new THREE.Vector3(x1,y0,z2)],
            [new THREE.Vector3(x1,y0,z2),new THREE.Vector3(x1,y0,z1)]], THEME.wallEdge);
      segs([[new THREE.Vector3(x1,y0,z1),new THREE.Vector3(x1,y1,z1)],
            [new THREE.Vector3(x2,y0,z1),new THREE.Vector3(x2,y1,z1)],
            [new THREE.Vector3(x2,y0,z2),new THREE.Vector3(x2,y1,z2)],
            [new THREE.Vector3(x1,y0,z2),new THREE.Vector3(x1,y1,z2)]], THEME.wallEdge);
    }

    if (B <= L) {
      /* Ridge along Z (classic: short span = B along X) */
      const ridgeL = Math.max(0, L - B);
      const r2 = ridgeL / 2;
      /* Extended overhang dims */
      const slope = hB > 0 ? (hRidge - hEave) / hB : 0;
      const hOh   = hEave - wo * slope;
      const hBo   = hB + wo, hLo = hL + wo;

      /* Left main slope -- trapezoid */
      const leftGeo = this._quad(
        new THREE.Vector3(-hBo, hOh,    -hLo),
        new THREE.Vector3(-hBo, hOh,    +hLo),
        new THREE.Vector3(  0,  hRidge,  r2),
        new THREE.Vector3(  0,  hRidge, -r2),
      );
      /* Right main slope -- trapezoid */
      const rightGeo = this._quad(
        new THREE.Vector3(hBo, hOh,    -hLo),
        new THREE.Vector3(  0, hRidge, -r2),
        new THREE.Vector3(  0, hRidge,  r2),
        new THREE.Vector3(hBo, hOh,    +hLo),
      );
      for (const g of [leftGeo, rightGeo]) {
        grp.add(new THREE.Mesh(g, roofMat()));
        this._tubeEdges(new THREE.EdgesGeometry(g), THEME.roofEdge, EDGE_R, grp);
      }

      /* Hip triangles at each end (z = +/-hLo) */
      for (const zs of [-1, 1]) {
        const z  = zs * hLo;
        const rz = zs * r2;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          -hBo, hOh,    z,
           hBo, hOh,    z,
             0, hRidge, rz,
        ]), 3));
        geo.computeVertexNormals();
        grp.add(new THREE.Mesh(geo, roofMat()));
        this._tubeEdges(new THREE.EdgesGeometry(geo), THEME.roofEdge, EDGE_R, grp);
      }

      /* Ridge along Z */
      if (ridgeL > 0) {
        const t = this._tube(
          new THREE.Vector3(0, hRidge, -r2),
          new THREE.Vector3(0, hRidge,  r2),
          THEME.ridge, EDGE_R
        );
        if (t) grp.add(t);
      }

    } else {
      /* Ridge along X (B > L: long span = B along X) */
      const ridgeL = Math.max(0, B - L);
      const r2 = ridgeL / 2;
      /* Extended overhang dims -- short axis is L so use Z-direction slope */
      const slopeZ = hL > 0 ? (hRidge - hEave) / hL : 0;
      const hOhZ   = hEave - wo * slopeZ;
      const hBo    = hB + wo, hLo = hL + wo;

      /* Front main slope -- trapezoid at z=+hLo */
      const frontGeo = this._quad(
        new THREE.Vector3(-hBo, hOhZ,  hLo),
        new THREE.Vector3( hBo, hOhZ,  hLo),
        new THREE.Vector3( r2,  hRidge, 0),
        new THREE.Vector3(-r2,  hRidge, 0),
      );
      /* Back main slope -- trapezoid at z=-hLo */
      const backGeo = this._quad(
        new THREE.Vector3( hBo, hOhZ, -hLo),
        new THREE.Vector3(-hBo, hOhZ, -hLo),
        new THREE.Vector3(-r2,  hRidge, 0),
        new THREE.Vector3( r2,  hRidge, 0),
      );
      for (const g of [frontGeo, backGeo]) {
        grp.add(new THREE.Mesh(g, roofMat()));
        this._tubeEdges(new THREE.EdgesGeometry(g), THEME.roofEdge, EDGE_R, grp);
      }

      /* Hip triangles at each end (x = +/-hBo) */
      for (const xs of [-1, 1]) {
        const x  = xs * hBo;
        const rx = xs * r2;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          x, hOhZ,  hLo,
          x, hOhZ, -hLo,
          rx, hRidge, 0,
        ]), 3));
        geo.computeVertexNormals();
        grp.add(new THREE.Mesh(geo, roofMat()));
        this._tubeEdges(new THREE.EdgesGeometry(geo), THEME.roofEdge, EDGE_R, grp);
      }

      /* Ridge along X */
      if (ridgeL > 0) {
        const t = this._tube(
          new THREE.Vector3(-r2, hRidge, 0),
          new THREE.Vector3( r2, hRidge, 0),
          THEME.ridge, EDGE_R
        );
        if (t) grp.add(t);
      }
    }


    return grp;
  }

  /* ── monoslope roof builder ──────────────────────────────────────────────── */

  _buildStructureMonoslope(B, L, hLow, hHigh, wo = 0) {
    /* hHigh = high eave height (X = -B/2, left)
       hLow  = low  eave height (X = +B/2, right)
       slope descends left → right                */
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
    /* 4 walls -- all as quads; top eave edges omitted (covered by roof) */
    const monoSegs = (pairs) => {
      for (const [a2, b2] of pairs) { const t = this._tube(a2, b2, THEME.wallEdge, EDGE_R); if (t) grp.add(t); }
    };
    /* Left wall  (X = -hB): HIGH wall, height = hHigh */
    const windGeo = this._quad(
      new THREE.Vector3(-hB, 0,     -hL),
      new THREE.Vector3(-hB, 0,      hL),
      new THREE.Vector3(-hB, hHigh,  hL),
      new THREE.Vector3(-hB, hHigh, -hL),
    );
    grp.add(new THREE.Mesh(windGeo, solidMat(THEME.wallFill)));
    monoSegs([[new THREE.Vector3(-hB,0,-hL),   new THREE.Vector3(-hB,0,+hL)],
              [new THREE.Vector3(-hB,0,+hL),   new THREE.Vector3(-hB,hHigh,+hL)],
              [new THREE.Vector3(-hB,hHigh,-hL),new THREE.Vector3(-hB,0,-hL)]]);
    /* Right wall (X = +hB): LOW wall, height = hLow */
    const leeGeo = this._quad(
      new THREE.Vector3(hB, 0,    -hL),
      new THREE.Vector3(hB, hLow, -hL),
      new THREE.Vector3(hB, hLow,  hL),
      new THREE.Vector3(hB, 0,     hL),
    );
    grp.add(new THREE.Mesh(leeGeo, solidMat(THEME.wallFill)));
    monoSegs([[new THREE.Vector3(hB,0,-hL),    new THREE.Vector3(hB,hLow,-hL)],
              [new THREE.Vector3(hB,hLow,+hL), new THREE.Vector3(hB,0,+hL)],
              [new THREE.Vector3(hB,0,-hL),     new THREE.Vector3(hB,0,+hL)]]);
    /* Left end wall  (Z = -hL): trapezoid — high on left, low on right */
    const leftEndGeo = this._quad(
      new THREE.Vector3(-hB, 0,     -hL),
      new THREE.Vector3(-hB, hHigh, -hL),
      new THREE.Vector3( hB, hLow,  -hL),
      new THREE.Vector3( hB, 0,     -hL),
    );
    grp.add(new THREE.Mesh(leftEndGeo, solidMat(THEME.wallFill)));
    monoSegs([[new THREE.Vector3(-hB,0,-hL),   new THREE.Vector3(-hB,hHigh,-hL)],
              [new THREE.Vector3(hB,hLow,-hL),  new THREE.Vector3(hB,0,-hL)],
              [new THREE.Vector3(hB,0,-hL),     new THREE.Vector3(-hB,0,-hL)]]);
    /* Right end wall (Z = +hL): trapezoid — high on left, low on right */
    const rightEndGeo = this._quad(
      new THREE.Vector3(-hB, 0,      hL),
      new THREE.Vector3( hB, 0,      hL),
      new THREE.Vector3( hB, hLow,   hL),
      new THREE.Vector3(-hB, hHigh,  hL),
    );
    grp.add(new THREE.Mesh(rightEndGeo, solidMat(THEME.wallFill)));
    monoSegs([[new THREE.Vector3(-hB,0,+hL),     new THREE.Vector3(hB,0,+hL)],
              [new THREE.Vector3(hB,0,+hL),      new THREE.Vector3(hB,hLow,+hL)],
              [new THREE.Vector3(-hB,hHigh,+hL),  new THREE.Vector3(-hB,0,+hL)]]);

    /* Sloped roof -- extend to overhang; slope descends left → right */
    const slopeM  = (2 * hB) > 0 ? (hHigh - hLow) / (2 * hB) : 0;
    const hHighOh = hHigh + wo * slopeM;   // outer high eave (left,  x=-hBo)
    const hLowOh  = hLow  - wo * slopeM;   // outer low  eave (right, x=+hBo)
    const hBo     = hB + wo, hLo = hL + wo;
    const roofGeo = this._quad(
      new THREE.Vector3(-hBo, hHighOh, -hLo),   // left-back:   high
      new THREE.Vector3(-hBo, hHighOh,  hLo),   // left-front:  high
      new THREE.Vector3( hBo, hLowOh,   hLo),   // right-front: low
      new THREE.Vector3( hBo, hLowOh,  -hLo),   // right-back:  low
    );
    grp.add(new THREE.Mesh(roofGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(roofGeo), THEME.roofEdge, EDGE_R, grp);

    /* High eave accent -- at outer high (left) tip */
    const tHigh = this._tube(
      new THREE.Vector3(-hBo, hHighOh, -hLo),
      new THREE.Vector3(-hBo, hHighOh,  hLo),
      THEME.ridge, EDGE_R
    );
    if (tHigh) grp.add(tHigh);

    return grp;
  }

  /* ── Stepped Roof (ASCE 7-22 Fig. 30.3-3) ─────────────────────────────────
     2-level: W3=0 → sections [W1(hz1), W2(hTop)] left→right
     3-level: W3>0 → sections [W1(hz1), W2(hz2), W3(hTop)] left→right      */
  _buildStructureStepped(W1, W2, W3, L, h1, hs1, h3) {
    const H_SCALE = 1.8;
    const EDGE_R  = 0.11;
    const is3 = W3 > 0;

    // W1 (left) = tallest (h1), W2 = lower (hs1), W3 (right, optional) = h3
    const secs = is3
      ? [{ w: W1, h: h1 }, { w: W2, h: hs1 }, { w: W3, h: h3 }]
      : [{ w: W1, h: h1 }, { w: W2, h: hs1 }];

    // total plan width & half-length
    const Wt = secs.reduce((acc, s) => acc + s.w, 0);
    const hL = L / 2;

    // world-unit x-boundaries (left edge of each section)
    const xL = [];
    let xCur = -Wt / 2;
    for (const sec of secs) { xL.push(xCur); xCur += sec.w; }
    xL.push(Wt / 2);  // right outer edge

    const grp = new THREE.Group();
    const solidMat = (col) => new THREE.MeshStandardMaterial({
      color: col, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.0
    });
    const wallMat = solidMat(THEME.wallFill);
    const roofMat = solidMat(THEME.roofFill);

    // Helper: world-space Vector3 with H_SCALE on Y
    const V = (x, yFt, z) => new THREE.Vector3(x, yFt * H_SCALE, z);

    for (let i = 0; i < secs.length; i++) {
      const x0 = xL[i], x1 = xL[i + 1];
      const hS = secs[i].h;   // section height, ft

      // Front wall (+Z face)
      const fw = this._quad(V(x0,0,hL), V(x1,0,hL), V(x1,hS,hL), V(x0,hS,hL));
      grp.add(new THREE.Mesh(fw, wallMat));
      this._tubeEdges(new THREE.EdgesGeometry(fw), THEME.wallEdge, EDGE_R, grp);

      // Back wall (−Z face)
      const bw = this._quad(V(x1,0,-hL), V(x0,0,-hL), V(x0,hS,-hL), V(x1,hS,-hL));
      grp.add(new THREE.Mesh(bw, wallMat));
      this._tubeEdges(new THREE.EdgesGeometry(bw), THEME.wallEdge, EDGE_R, grp);

      // Flat roof
      const rf = this._quad(V(x0,hS,-hL), V(x1,hS,-hL), V(x1,hS,hL), V(x0,hS,hL));
      grp.add(new THREE.Mesh(rf, roofMat));
      this._tubeEdges(new THREE.EdgesGeometry(rf), THEME.roofEdge, EDGE_R, grp);

      // Left outer wall (leftmost section only)
      if (i === 0) {
        const lw = this._quad(V(x0,0,-hL), V(x0,0,hL), V(x0,hS,hL), V(x0,hS,-hL));
        grp.add(new THREE.Mesh(lw, wallMat));
        this._tubeEdges(new THREE.EdgesGeometry(lw), THEME.wallEdge, EDGE_R, grp);
      }

      // Right outer wall (rightmost section only)
      if (i === secs.length - 1) {
        const rw = this._quad(V(x1,0,hL), V(x1,0,-hL), V(x1,hS,-hL), V(x1,hS,hL));
        grp.add(new THREE.Mesh(rw, wallMat));
        this._tubeEdges(new THREE.EdgesGeometry(rw), THEME.wallEdge, EDGE_R, grp);
      }

      // Step wall at right junction (vertical face between this section roof & next section wall)
      if (i < secs.length - 1) {
        const hN = secs[i + 1].h;
        const sw = this._quad(V(x1,hS,hL), V(x1,hS,-hL), V(x1,hN,-hL), V(x1,hN,hL));
        grp.add(new THREE.Mesh(sw, wallMat));
        this._tubeEdges(new THREE.EdgesGeometry(sw), THEME.wallEdge, EDGE_R, grp);
      }
    }

    // Bottom perimeter edges (ground line)
    const flr = this._quad(V(-Wt/2,0,-hL), V(Wt/2,0,-hL), V(Wt/2,0,hL), V(-Wt/2,0,hL));
    this._tubeEdges(new THREE.EdgesGeometry(flr), THEME.wallEdge, EDGE_R, grp);

    return grp;
  }

  /* ── Monoslope Free Roof (open building — 4 corner columns, no walls) ──────
     hLow = low eave (right, X=+hB), hHigh = high eave (left, X=-hB)         */
  _buildStructureMonoslopeFree(B, L, hLow, hHigh, wo = 0) {
    const hB = B / 2, hL = L / 2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;
    /* Sloped roof panel */
    const slopeM  = (2 * hB) > 0 ? (hHigh - hLow) / (2 * hB) : 0;
    const hHighOh = hHigh + wo * slopeM;
    const hLowOh  = hLow  - wo * slopeM;
    const hBo = hB + wo, hLo = hL + wo;
    const roofMat = new THREE.MeshStandardMaterial({ color: THEME.roofFill, side: THREE.DoubleSide });
    const roofGeo = this._quad(
      new THREE.Vector3(-hBo, hHighOh, -hLo), new THREE.Vector3(-hBo, hHighOh,  hLo),
      new THREE.Vector3( hBo, hLowOh,   hLo), new THREE.Vector3( hBo, hLowOh,  -hLo),
    );
    grp.add(new THREE.Mesh(roofGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(roofGeo), THEME.roofEdge, EDGE_R, grp);
    /* High-eave accent tube */
    const tH = this._tube(new THREE.Vector3(-hBo,hHighOh,-hLo), new THREE.Vector3(-hBo,hHighOh,hLo), THEME.ridge, EDGE_R);
    if (tH) grp.add(tH);
    /* 4 corner columns (ground → roof eave at each corner, inset by COL_R) */
    const COL_R = EDGE_R * 2.5;
    const slopeU = (2*hB) > 0 ? (hHigh - hLow) / (2*hB) : 0;
    const addCol1 = (x, z, ht) => { const c = this._tube(new THREE.Vector3(x,0,z), new THREE.Vector3(x,ht,z), THEME.wallEdge, COL_R); if (c) grp.add(c); };
    const cxHi = -hB + COL_R, cxLo = hB - COL_R;
    const czF = hL - COL_R, czB = -hL + COL_R;
    addCol1(cxHi, czB, hHigh - COL_R * slopeU);  addCol1(cxHi, czF, hHigh - COL_R * slopeU);
    addCol1(cxLo, czB, hLow  + COL_R * slopeU);  addCol1(cxLo, czF, hLow  + COL_R * slopeU);
    return grp;
  }

  /* ── Pitched Free Roof (open building — 4 corner columns, gable profile) ── */
  _buildStructurePitchedFree(B, L, hEave, hRidge, wo = 0) {
    const hB = B / 2, hL = L / 2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;
    /* Two gable slope panels */
    const slopeM  = hB > 0 ? (hRidge - hEave) / hB : 0;
    const hEaveOh = hEave - wo * slopeM;
    const hBo = hB + wo, hLo = hL + wo;
    const roofMat = new THREE.MeshStandardMaterial({ color: THEME.roofFill, side: THREE.DoubleSide });
    /* Left slope */
    const lGeo = this._quad(
      new THREE.Vector3(-hBo, hEaveOh, -hLo), new THREE.Vector3(-hBo, hEaveOh,  hLo),
      new THREE.Vector3(   0, hRidge,   hLo), new THREE.Vector3(   0, hRidge,  -hLo),
    );
    grp.add(new THREE.Mesh(lGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(lGeo), THEME.roofEdge, EDGE_R, grp);
    /* Right slope */
    const rGeo = this._quad(
      new THREE.Vector3(   0, hRidge,  -hLo), new THREE.Vector3(   0, hRidge,   hLo),
      new THREE.Vector3( hBo, hEaveOh,  hLo), new THREE.Vector3( hBo, hEaveOh, -hLo),
    );
    grp.add(new THREE.Mesh(rGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(rGeo), THEME.roofEdge, EDGE_R, grp);
    /* Ridge tube */
    const tR = this._tube(new THREE.Vector3(0,hRidge,-hLo), new THREE.Vector3(0,hRidge,hLo), THEME.ridge, EDGE_R);
    if (tR) grp.add(tR);
    /* 4 corner columns (ground → eave height, inset by COL_R) */
    const COL_R2 = EDGE_R * 2.5;
    const addCol2 = (x, z) => { const c = this._tube(new THREE.Vector3(x,0,z), new THREE.Vector3(x,hEave,z), THEME.wallEdge, COL_R2); if (c) grp.add(c); };
    addCol2(-hB + COL_R2, -hL + COL_R2);  addCol2(-hB + COL_R2,  hL - COL_R2);
    addCol2( hB - COL_R2, -hL + COL_R2);  addCol2( hB - COL_R2,  hL - COL_R2);
    return grp;
  }

  /* ── Troughed Free Roof (open building — 2 center columns at valley) ───────
     hValley = valley (center, lower) = hEave from update3DModel
     hSide   = outer eave (sides, higher) = hRidge from update3DModel         */
  _buildStructureTroughed(B, L, hValley, hSide, wo = 0) {
    const hB = B / 2, hL = L / 2;
    const grp = new THREE.Group();
    const EDGE_R = 0.11;
    /* Two inverted-slope roof panels */
    const slopeM  = hB > 0 ? (hSide - hValley) / hB : 0;
    const hSideOh = hSide + wo * slopeM;
    const hBo = hB + wo, hLo = hL + wo;
    const roofMat = new THREE.MeshStandardMaterial({ color: THEME.roofFill, side: THREE.DoubleSide });
    /* Left panel: outer high side → valley */
    const lGeo = this._quad(
      new THREE.Vector3(-hBo, hSideOh, -hLo), new THREE.Vector3(-hBo, hSideOh,  hLo),
      new THREE.Vector3(   0, hValley,  hLo), new THREE.Vector3(   0, hValley, -hLo),
    );
    grp.add(new THREE.Mesh(lGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(lGeo), THEME.roofEdge, EDGE_R, grp);
    /* Right panel: valley → outer high side */
    const rGeo = this._quad(
      new THREE.Vector3(   0, hValley, -hLo), new THREE.Vector3(   0, hValley,  hLo),
      new THREE.Vector3( hBo, hSideOh,  hLo), new THREE.Vector3( hBo, hSideOh, -hLo),
    );
    grp.add(new THREE.Mesh(rGeo, roofMat));
    this._tubeEdges(new THREE.EdgesGeometry(rGeo), THEME.roofEdge, EDGE_R, grp);
    /* Valley accent tube */
    const tV = this._tube(new THREE.Vector3(0,hValley,-hLo), new THREE.Vector3(0,hValley,hLo), THEME.ridge, EDGE_R);
    if (tV) grp.add(tV);
    /* 2 center columns at valley ends (ground → valley height, inset by COL_R) */
    const COL_R3 = EDGE_R * 2.5;
    const cF = this._tube(new THREE.Vector3(0,0,-hL+COL_R3), new THREE.Vector3(0,hValley,-hL+COL_R3), THEME.wallEdge, COL_R3);
    const cB = this._tube(new THREE.Vector3(0,0, hL-COL_R3), new THREE.Vector3(0,hValley, hL-COL_R3), THEME.wallEdge, COL_R3);
    if (cF) grp.add(cF);  if (cB) grp.add(cB);
    return grp;
  }


  /* ── dimension system ───────────────────────────────────────────────────── */

  /* ── wall zone 4/5 overlay ─────────────────────────────────────────────────
     Draws Zone 5 (corner strip, width=zone_a) and Zone 4 (field) on all 4
     vertical wall faces. matZ(color, opacity) is the same factory used for
     roof zones.                                                               */
  /* ── Helper methods used by zone descriptor files (zones-cc-*.js) ──────────
     * Changing style here affects all diagram types at once.                   */

  /** Offset quad mesh for zone patches (hip main slopes). */
  _addQuadMesh(matZ, p0, p1, p2, p3, norm, zt, op, eps) {
    const off  = norm.clone().multiplyScalar(eps);
    const col  = zt === 'zone-1'  ? THEME.zone1
               : zt === 'zone-2'  ? THEME.zone2
               : zt === 'zone-2p' ? THEME.zone2p
               : zt === 'zone-3'  ? THEME.zone3
               : zt === 'zone-3p' ? THEME.zone3p
               : zt === 'zone-4'  ? THEME.zone4 : THEME.zone5;
    const mesh = new THREE.Mesh(
      this._quad(p0.clone().add(off), p1.clone().add(off),
                 p2.clone().add(off), p3.clone().add(off)),
      matZ(col, op)
    );
    mesh.renderOrder = 1; mesh.userData = { zoneType: zt };
    this._zones.add(mesh); this._zoneMeshes.push(mesh);
  }

  /** Triangle or quad mesh for hip triangular end slopes. */
  _addTriPart(matZ, pts, zt, op, eps, norm) {
    const off = norm.clone().multiplyScalar(eps);
    const col = zt === 'zone-1' ? THEME.zone1
              : zt === 'zone-2' ? THEME.zone2 : THEME.zone3;
    let geo;
    if (pts.length === 3) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        pts[0].x+off.x, pts[0].y+off.y, pts[0].z+off.z,
        pts[1].x+off.x, pts[1].y+off.y, pts[1].z+off.z,
        pts[2].x+off.x, pts[2].y+off.y, pts[2].z+off.z,
      ]), 3));
      geo.computeVertexNormals();
    } else {
      geo = this._quad(
        pts[0].clone().add(off), pts[1].clone().add(off),
        pts[2].clone().add(off), pts[3].clone().add(off)
      );
    }
    const mesh = new THREE.Mesh(geo, matZ(col, op));
    mesh.renderOrder = 1; mesh.userData = { zoneType: zt };
    this._zones.add(mesh); this._zoneMeshes.push(mesh);
  }

  /** Dimension chip label with optional dashed leader line.
   *  Edit style here to update all diagrams. */
  _mkDimChip(text, labelPt, leaderAnchor, nDir) {
    if (!THREE.CSS2DObject) return;
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = [
      'font-family:"JetBrains Mono",monospace',
      'font-size:13px', 'font-weight:700', 'color:#1e293b',
      'background:rgba(241,245,249,0.93)',
      'padding:1px 5px', 'border-radius:3px',
      'border:1px solid #64748b',
      'pointer-events:none', 'white-space:nowrap',
    ].join(';');
    const obj = new THREE.CSS2DObject(div);
    obj.position.copy(labelPt);
    if (nDir) obj.userData.faceNormal = nDir.clone();
    this._labelGroup.add(obj);
    if (leaderAnchor) {
      const geo = new THREE.BufferGeometry().setFromPoints([labelPt, leaderAnchor]);
      const mat = new THREE.LineDashedMaterial({
        color: 0x64748b, dashSize: 1.2, gapSize: 1.0, transparent: true, opacity: 0.8,
      });
      const ln = new THREE.Line(geo, mat);
      ln.computeLineDistances();
      this._labelGroup.add(ln);
    }
  }

  _drawWallZones(B, L, hEave, hRidge, zone_a, matZ, roofShape = 'gable') {
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

    /* -- FRONT end wall (z = +hL, outward normal +Z) ---------------------- */
    {
      const nF = new THREE.Vector3(0, 0, 1);
      const e  = EPS;
      const z  = hL + e;
      const a  = Math.min(zone_a, hB);
      const tD = new THREE.Vector3(1, 0, 0);

      if (roofShape === 'monoslope') {
        /* Trapezoidal: height varies from hRidge (x=-hB, high/left) to hEave (x=+hB, low/right) */
        const hAtX = x => hRidge - (x + hB) / B * (hRidge - hEave);
        const ha  = hAtX(-hB + a);
        const hBa = hAtX( hB - a);
        const fz5L = [
          new THREE.Vector3(-hB,   0,       z), new THREE.Vector3(-hB+a, 0,  z),
          new THREE.Vector3(-hB+a, ha,      z), new THREE.Vector3(-hB,   hRidge, z), // HIGH side → hRidge
        ];
        addWallQ(fz5L, 'zone-5', Z5_OP);
        wallLabel('zone-5', fz5L[0], fz5L[1], fz5L[2], fz5L[3], nF, tD);
        const fz5R = [
          new THREE.Vector3(hB-a, 0,      z), new THREE.Vector3(hB,   0,     z),
          new THREE.Vector3(hB,   hEave,  z), new THREE.Vector3(hB-a, hBa,   z), // LOW side → hEave
        ];
        addWallQ(fz5R, 'zone-5', Z5_OP);
        wallLabel('zone-5', fz5R[0], fz5R[1], fz5R[2], fz5R[3], nF, tD);
        if (2 * a < B - 0.1) {
          const fz4 = [
            new THREE.Vector3(-hB+a, 0,   z), new THREE.Vector3(hB-a, 0,   z),
            new THREE.Vector3(hB-a,  hBa, z), new THREE.Vector3(-hB+a, ha, z),
          ];
          addWallQ(fz4, 'zone-4', Z4_OP);
          wallLabel('zone-4', fz4[0], fz4[1], fz4[2], fz4[3], nF, tD);
        }
      } else if (roofShape === 'hip') {
        /* Hip: rectangular up to hEave */
        const fz5L = [
          new THREE.Vector3(-hB,   0,     z), new THREE.Vector3(-hB+a, 0,     z),
          new THREE.Vector3(-hB+a, hEave, z), new THREE.Vector3(-hB,   hEave, z),
        ];
        addWallQ(fz5L, 'zone-5', Z5_OP);
        wallLabel('zone-5', fz5L[0], fz5L[1], fz5L[2], fz5L[3], nF, tD);
        const fz5R = [
          new THREE.Vector3(hB-a, 0,     z), new THREE.Vector3(hB,   0,     z),
          new THREE.Vector3(hB,   hEave, z), new THREE.Vector3(hB-a, hEave, z),
        ];
        addWallQ(fz5R, 'zone-5', Z5_OP);
        wallLabel('zone-5', fz5R[0], fz5R[1], fz5R[2], fz5R[3], nF, tD);
        if (2 * a < B - 0.1) {
          const fz4 = [
            new THREE.Vector3(-hB+a, 0,     z), new THREE.Vector3(hB-a, 0,     z),
            new THREE.Vector3(hB-a,  hEave, z), new THREE.Vector3(-hB+a, hEave, z),
          ];
          addWallQ(fz4, 'zone-4', Z4_OP);
          wallLabel('zone-4', fz4[0], fz4[1], fz4[2], fz4[3], nF, tD);
        }
      } else {
        /* Gable/flat: pentagon including gable triangle */
        const slopeY = d => hEave + (d / hB) * (hRidge - hEave);
        const ya = slopeY(a);
        const fz5L = [
          new THREE.Vector3(-hB,   0,    z), new THREE.Vector3(-hB+a, 0,  z),
          new THREE.Vector3(-hB+a, ya,   z), new THREE.Vector3(-hB,   hEave, z),
        ];
        addWallQ(fz5L, 'zone-5', Z5_OP);
        wallLabel('zone-5', fz5L[0], fz5L[1], fz5L[2], fz5L[3], nF, tD);
        const fz5R = [
          new THREE.Vector3(hB-a, 0,    z), new THREE.Vector3(hB,   0,    z),
          new THREE.Vector3(hB,   hEave, z), new THREE.Vector3(hB-a, ya,  z),
        ];
        addWallQ(fz5R, 'zone-5', Z5_OP);
        wallLabel('zone-5', fz5R[0], fz5R[1], fz5R[2], fz5R[3], nF, tD);
        if (2 * a < B - 0.1) {
          const fz4Lo = [
            new THREE.Vector3(-hB+a, 0,  z), new THREE.Vector3(hB-a, 0,  z),
            new THREE.Vector3(hB-a,  ya, z), new THREE.Vector3(-hB+a, ya, z),
          ];
          addWallQ(fz4Lo, 'zone-4', Z4_OP);
          wallLabel('zone-4', fz4Lo[0], fz4Lo[1], fz4Lo[2], fz4Lo[3], nF, tD);
          const fz4Hi = [
            new THREE.Vector3(-hB+a, ya,     z), new THREE.Vector3(hB-a,  ya,     z),
            new THREE.Vector3(0,     hRidge, z), new THREE.Vector3(0,     hRidge, z),
          ];
          addWallQ(fz4Hi, 'zone-4', Z4_OP);
        }
      }
    }

    /* -- BACK end wall (z = -hL, outward normal -Z) ---------------------- */
    {
      const nB = new THREE.Vector3(0, 0, -1);
      const e  = EPS;
      const z  = -hL - e;
      const a  = Math.min(zone_a, hB);
      const tD = new THREE.Vector3(-1, 0, 0);

      if (roofShape === 'monoslope') {
        /* Trapezoidal: height varies from hRidge (x=-hB, high/left) to hEave (x=+hB, low/right) */
        const hAtX = x => hRidge - (x + hB) / B * (hRidge - hEave);
        const ha  = hAtX(-hB + a);
        const hBa = hAtX( hB - a);
        // viewed from -Z: left side = x=+hB (high), right side = x=-hB (low)
        const bz5L = [
          new THREE.Vector3(hB-a, 0,      z), new THREE.Vector3(hB,   0,     z),
          new THREE.Vector3(hB,   hEave,  z), new THREE.Vector3(hB-a, hBa,   z), // LOW side → hEave
        ];
        addWallQ(bz5L, 'zone-5', Z5_OP);
        wallLabel('zone-5', bz5L[0], bz5L[1], bz5L[2], bz5L[3], nB, tD);
        const bz5R = [
          new THREE.Vector3(-hB,   0,      z), new THREE.Vector3(-hB+a, 0,   z),
          new THREE.Vector3(-hB+a, ha,     z), new THREE.Vector3(-hB,   hRidge, z), // HIGH side → hRidge
        ];
        addWallQ(bz5R, 'zone-5', Z5_OP);
        wallLabel('zone-5', bz5R[0], bz5R[1], bz5R[2], bz5R[3], nB, tD);
        if (2 * a < B - 0.1) {
          const bz4 = [
            new THREE.Vector3(-hB+a, 0,   z), new THREE.Vector3(hB-a, 0,   z),
            new THREE.Vector3(hB-a,  hBa, z), new THREE.Vector3(-hB+a, ha, z),
          ];
          addWallQ(bz4, 'zone-4', Z4_OP);
          wallLabel('zone-4', bz4[0], bz4[1], bz4[2], bz4[3], nB, tD);
        }
      } else if (roofShape === 'hip') {
        /* Hip: rectangular up to hEave */
        const bz5L = [
          new THREE.Vector3(hB-a, 0,     z), new THREE.Vector3(hB,   0,     z),
          new THREE.Vector3(hB,   hEave, z), new THREE.Vector3(hB-a, hEave, z),
        ];
        addWallQ(bz5L, 'zone-5', Z5_OP);
        wallLabel('zone-5', bz5L[0], bz5L[1], bz5L[2], bz5L[3], nB, tD);
        const bz5R = [
          new THREE.Vector3(-hB,   0,     z), new THREE.Vector3(-hB+a, 0,     z),
          new THREE.Vector3(-hB+a, hEave, z), new THREE.Vector3(-hB,   hEave, z),
        ];
        addWallQ(bz5R, 'zone-5', Z5_OP);
        wallLabel('zone-5', bz5R[0], bz5R[1], bz5R[2], bz5R[3], nB, tD);
        if (2 * a < B - 0.1) {
          const bz4 = [
            new THREE.Vector3(-hB+a, 0,     z), new THREE.Vector3(hB-a, 0,     z),
            new THREE.Vector3(hB-a,  hEave, z), new THREE.Vector3(-hB+a, hEave, z),
          ];
          addWallQ(bz4, 'zone-4', Z4_OP);
          wallLabel('zone-4', bz4[0], bz4[1], bz4[2], bz4[3], nB, tD);
        }
      } else {
        /* Gable/flat: pentagon with gable triangle */
        const slopeY = d => hEave + (d / hB) * (hRidge - hEave);
        const ya = slopeY(a);
        const bz5L = [
          new THREE.Vector3(hB-a, 0,    z), new THREE.Vector3(hB,   0,    z),
          new THREE.Vector3(hB,   hEave, z), new THREE.Vector3(hB-a, ya,  z),
        ];
        addWallQ(bz5L, 'zone-5', Z5_OP);
        wallLabel('zone-5', bz5L[0], bz5L[1], bz5L[2], bz5L[3], nB, tD);
        const bz5R = [
          new THREE.Vector3(-hB,   0,    z), new THREE.Vector3(-hB+a, 0,  z),
          new THREE.Vector3(-hB+a, ya,   z), new THREE.Vector3(-hB,   hEave, z),
        ];
        addWallQ(bz5R, 'zone-5', Z5_OP);
        wallLabel('zone-5', bz5R[0], bz5R[1], bz5R[2], bz5R[3], nB, tD);
        if (2 * a < B - 0.1) {
          const bz4Lo = [
            new THREE.Vector3(-hB+a, 0,  z), new THREE.Vector3(hB-a, 0,  z),
            new THREE.Vector3(hB-a,  ya, z), new THREE.Vector3(-hB+a, ya, z),
          ];
          addWallQ(bz4Lo, 'zone-4', Z4_OP);
          wallLabel('zone-4', bz4Lo[0], bz4Lo[1], bz4Lo[2], bz4Lo[3], nB, tD);
          const bz4Hi = [
            new THREE.Vector3(-hB+a, ya,     z), new THREE.Vector3(hB-a,  ya,     z),
            new THREE.Vector3(0,     hRidge, z), new THREE.Vector3(0,     hRidge, z),
          ];
          addWallQ(bz4Hi, 'zone-4', Z4_OP);
        }
      }
    }

    /* ── RIGHT wall  (x = +hB, outward normal +X) ─────────────────────────── */
    {
      const nR = new THREE.Vector3(1, 0, 0);
      const e  = EPS;
      const x  = hB + e;
      const a  = Math.min(zone_a, hL);
      const tD = new THREE.Vector3(0, 0, -1);
      const hTop = hEave;  // right wall is low (hEave) for both gable and monoslope

      // Zone 5 front strip (z=+hL side)
      const rz5F = [
        new THREE.Vector3(x, 0, hL-a),    new THREE.Vector3(x, 0, hL),
        new THREE.Vector3(x, hTop, hL),    new THREE.Vector3(x, hTop, hL-a),
      ];
      addWallQ(rz5F, 'zone-5', Z5_OP);
      wallLabel('zone-5', rz5F[0], rz5F[1], rz5F[2], rz5F[3], nR, tD);

      // Zone 5 back strip: z=-hL … -hL+a
      const rz5B = [
        new THREE.Vector3(x, 0, -hL),      new THREE.Vector3(x, 0, -hL+a),
        new THREE.Vector3(x, hTop, -hL+a),  new THREE.Vector3(x, hTop, -hL),
      ];
      addWallQ(rz5B, 'zone-5', Z5_OP);
      wallLabel('zone-5', rz5B[0], rz5B[1], rz5B[2], rz5B[3], nR, tD);

      if (2 * a < L - 0.1) {
        const rz4 = [
          new THREE.Vector3(x, 0, -hL+a),    new THREE.Vector3(x, 0, hL-a),
          new THREE.Vector3(x, hTop, hL-a),   new THREE.Vector3(x, hTop, -hL+a),
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
      // monoslope: left wall is HIGH (hRidge); all others: hEave
      const hTopL = roofShape === 'monoslope' ? hRidge : hEave;

      // Zone 5 front strip: z=hL-a … hL
      const lz5F = [
        new THREE.Vector3(x, 0, hL-a),   new THREE.Vector3(x, 0, hL),
        new THREE.Vector3(x, hTopL, hL),  new THREE.Vector3(x, hTopL, hL-a),
      ];
      addWallQ(lz5F, 'zone-5', Z5_OP);
      wallLabel('zone-5', lz5F[0], lz5F[1], lz5F[2], lz5F[3], nL, tD);

      // Zone 5 back strip: z=-hL … -hL+a
      const lz5B = [
        new THREE.Vector3(x, 0, -hL),    new THREE.Vector3(x, 0, -hL+a),
        new THREE.Vector3(x, hTopL, -hL+a), new THREE.Vector3(x, hTopL, -hL),
      ];
      addWallQ(lz5B, 'zone-5', Z5_OP);
      wallLabel('zone-5', lz5B[0], lz5B[1], lz5B[2], lz5B[3], nL, tD);

      if (2 * a < L - 0.1) {
        const lz4 = [
          new THREE.Vector3(x, 0, -hL+a),   new THREE.Vector3(x, 0, hL-a),
          new THREE.Vector3(x, hTopL, hL-a), new THREE.Vector3(x, hTopL, -hL+a),
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
  _buildDim(p1, p2, tickDir, extLines, text, dimId, inputId, viewNormal = null, forceInside = false, p1End = 'auto', p2End = 'auto') {
    const grp = new THREE.Group();
    grp.userData = { dimId, defaultColor: THEME.dimLine };

    const mat    = () => new THREE.LineBasicMaterial({ color: 0x000000 });
    const extMat = () => new THREE.LineBasicMaterial({ color: 0x000000 });  // solid, not dashed

    // main dimension line
    const mainLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p1, p2]), mat()
    );
    grp.add(mainLine);

    // Filled 15° arrowheads — outside+tail when span < 8 ft; tick at chain intersections
    // ── DIM STYLE — fixed for ALL dims, ALL diagrams ──────────────────
    //   ARROW_LEN = 2.5  world units (uniform)
    //   color     = 0x000000 black, fully opaque
    //   ext gap   = ARROW_LEN × 1.0  (half of previous 2×)
    const ARROW_LEN = 2.5;
    const halfW     = ARROW_LEN * Math.tan(THREE.MathUtils.degToRad(15));

    const dimDir = new THREE.Vector3().subVectors(p2, p1).normalize();

    // Wing-spread direction — perpendicular to dimDir in the plane of the dim
    let perpDir;
    if (tickDir != null) {
      const d0 = tickDir.clone().normalize().dot(dimDir);
      perpDir  = tickDir.clone().normalize().addScaledVector(dimDir, -d0);
      if (perpDir.length() < 0.001) perpDir = new THREE.Vector3(0, 1, 0); else perpDir.normalize();
    } else if (extLines && extLines.length > 0) {
      const extDir0 = new THREE.Vector3().subVectors(extLines[0][1], extLines[0][0]).normalize();
      const d0      = extDir0.dot(dimDir);
      perpDir = extDir0.clone().addScaledVector(dimDir, -d0);
      if (perpDir.length() < 0.001) perpDir = new THREE.Vector3(0, 1, 0); else perpDir.normalize();
    } else {
      perpDir = new THREE.Vector3(0, 1, 0);
    }

    const mkArrow = (tip, dir) => {
      const base = tip.clone().addScaledVector(dir, ARROW_LEN);
      const w1   = base.clone().addScaledVector(perpDir,  halfW);
      const w2   = base.clone().addScaledVector(perpDir, -halfW);
      const geo  = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        tip.x, tip.y, tip.z, w1.x, w1.y, w1.z, w2.x, w2.y, w2.z,
      ]), 3));
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial(
        { color: 0x000000, side: THREE.DoubleSide }));
    };

    // Architectural tick: 45° diagonal at chain intermediate points — filled quad for visual weight
    const mkTick = (pt) => {
      const TICK_HW = 0.18;   // half-width → 2× visual vs single Line
      const tDir  = dimDir.clone().add(perpDir.clone()).normalize();   // 45° diagonal
      const wDir2 = dimDir.clone().sub(perpDir.clone()).normalize();   // perpendicular, in dim plane
      const t0 = pt.clone().addScaledVector(tDir, -ARROW_LEN / 2);
      const t1 = pt.clone().addScaledVector(tDir,  ARROW_LEN / 2);
      const w0a = t0.clone().addScaledVector(wDir2,  TICK_HW);
      const w0b = t0.clone().addScaledVector(wDir2, -TICK_HW);
      const w1a = t1.clone().addScaledVector(wDir2,  TICK_HW);
      const w1b = t1.clone().addScaledVector(wDir2, -TICK_HW);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        w0a.x,w0a.y,w0a.z, w0b.x,w0b.y,w0b.z, w1a.x,w1a.y,w1a.z,
        w0b.x,w0b.y,w0b.z, w1b.x,w1b.y,w1b.z, w1a.x,w1a.y,w1a.z,
      ]), 3));
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    };

    const OUTSIDE_THRESHOLD = 8;   // ft — outside arrows when span < this
    const TAIL_LEN = 5;            // tail extending outward past arrowhead (visible 2.5ft stub)
    const dimSpan = p1.distanceTo(p2);

    // p1 endpoint
    if (p1End === 'tick') {
      grp.add(mkTick(p1));
    } else if (p1End === 'inside' || (p1End === 'auto' && dimSpan >= OUTSIDE_THRESHOLD)) {
      grp.add(mkArrow(p1, dimDir.clone()));           // inside → pointing toward p2
    } else {
      grp.add(mkArrow(p1, dimDir.clone().negate()));  // outside → pointing away
      grp.add(new THREE.Line(                         // tail extends outward past arrowhead
        new THREE.BufferGeometry().setFromPoints([p1.clone(), p1.clone().addScaledVector(dimDir.clone().negate(), TAIL_LEN)]), mat()));
    }
    // p2 endpoint
    if (p2End === 'tick') {
      grp.add(mkTick(p2));
    } else if (p2End === 'inside' || (p2End === 'auto' && dimSpan >= OUTSIDE_THRESHOLD)) {
      grp.add(mkArrow(p2, dimDir.clone().negate()));  // inside → pointing toward p1
    } else {
      grp.add(mkArrow(p2, dimDir.clone()));            // outside → pointing away
      grp.add(new THREE.Line(                         // tail extends outward past arrowhead
        new THREE.BufferGeometry().setFromPoints([p2.clone(), p2.clone().addScaledVector(dimDir.clone(), TAIL_LEN)]), mat()));
    }

    // extension lines (solid black) — gap at building face, overshoot past dim line
    for (const [a, b] of extLines) {
      const extDir = new THREE.Vector3().subVectors(b, a).normalize();
      const aGap   = a.clone().addScaledVector(extDir, ARROW_LEN * 1);  // gap = 1× (locked)
      const bExt   = b.clone().addScaledVector(extDir, ARROW_LEN);
      grp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([aGap, bExt]), extMat()
      ));
    }

    // ── CSS2D billboard label — always faces the camera ──────────────────
    if (THREE.CSS2DObject) {
      const div = document.createElement('div');
      div.innerHTML = text;  // allows <sub>/<sup> for engineering notation
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

      const midPt = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
      const obj   = new THREE.CSS2DObject(div);
      obj.position.copy(midPt);   // chip pinned to centre of dim line
      if (viewNormal) obj.userData.faceNormal = viewNormal.clone().normalize();
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

  _buildAllDims(B, L, hEave, hRidge, zone_a, hLabel = null, hEaveLabel = null, theta = 0, roofShape = 'hip', wo = 0) {
    const hB = B/2, hL = L/2;
    const grp = new THREE.Group();
    const D   = Math.max(8, Math.max(B, L) * 0.10);
    const EPS_Y = 0.2;  // lift base dims off y=0 to prevent z-fighting

    // Helper: remove trailing .0 from toFixed(1)
    const fmt = v => { const s = v.toFixed(1); return s.endsWith('.0') ? s.slice(0,-2) : s; };

    // ── Stepped: only L dim here; W/h chain drawn by _buildSteppedDims ──
    if (roofShape === 'stepped') {
      const lX = hB + 16;
      grp.add(this._buildDim(
        new THREE.Vector3(lX, EPS_Y, -hL),
        new THREE.Vector3(lX, EPS_Y,  hL),
        new THREE.Vector3(1, 0, 1).normalize(),
        [
          [new THREE.Vector3(hB, EPS_Y, -hL), new THREE.Vector3(lX, EPS_Y, -hL)],
          [new THREE.Vector3(hB, EPS_Y,  hL), new THREE.Vector3(lX, EPS_Y,  hL)],
        ],
        `L=${fmt(L)}ft`, 'dim-L', 'wind-L', new THREE.Vector3(1,0,0)
      ));
      this._dimHighlight['dim-L'] = grp.children[grp.children.length - 1];
      return grp;
    }

    // ── B (Width) — Front face (z = +hL) ──────────────────────────────────
    const _isFreeRoofDim = (roofShape === 'monoslope-free' || roofShape === 'pitched-free' || roofShape === 'troughed-free');
    const bZ = hL + 16;   // second dim: 16 ft from front face
    grp.add(this._buildDim(
      new THREE.Vector3(-hB, EPS_Y, bZ),
      new THREE.Vector3( hB, EPS_Y, bZ),
      new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(-hB, EPS_Y,  hL), new THREE.Vector3(-hB, EPS_Y, bZ)],
        [new THREE.Vector3( hB, EPS_Y,  hL), new THREE.Vector3( hB, EPS_Y, bZ)],
      ],
      `B=${fmt(B)}ft`, 'dim-B', 'wind-B', new THREE.Vector3(0,0,1)
    ));
    this._dimHighlight['dim-B'] = grp.children[grp.children.length - 1];

    // ── L (Length) ─────────────────────────────────────────────────────────
    // monoslope: LEFT face (HIGH eave, x=-hB);  others: RIGHT face (x=+hB)
    const _monoD = (roofShape === 'monoslope');
    const lX    = _monoD ? (-hB - 16) : (hB + 16);
    const lXsrc = _monoD ? -hB : hB;
    grp.add(this._buildDim(
      new THREE.Vector3(lX, EPS_Y, -hL),
      new THREE.Vector3(lX, EPS_Y,  hL),
      _monoD ? new THREE.Vector3(-1, 0, 1).normalize() : new THREE.Vector3(1, 0, 1).normalize(),
      [
        [new THREE.Vector3(lXsrc, EPS_Y, -hL), new THREE.Vector3(lX, EPS_Y, -hL)],
        [new THREE.Vector3(lXsrc, EPS_Y,  hL), new THREE.Vector3(lX, EPS_Y,  hL)],
      ],
      `L=${fmt(L)}ft`, 'dim-L', 'wind-L',
      _monoD ? new THREE.Vector3(-1,0,0) : new THREE.Vector3(1,0,0)
    ));
    this._dimHighlight['dim-L'] = grp.children[grp.children.length - 1];

    // ── h_eave (skip for free roofs) ──────────────────────────────────────
    // monoslope: RIGHT face (LOW eave, x=+hB);  others: LEFT face (x=-hB)
    if (!_isFreeRoofDim) {
    const hZhe  = 0;
    const hXhe  = _monoD ? (hB + 8) : (-hB - 8);
    const hXheSrc = _monoD ? hB : -hB;
    grp.add(this._buildDim(
      new THREE.Vector3(hXhe, EPS_Y,  hZhe),
      new THREE.Vector3(hXhe, hEave,  hZhe),
      _monoD ? new THREE.Vector3(1, 1, 0).normalize() : new THREE.Vector3(-1, 1, 0).normalize(),
      [
        [new THREE.Vector3(hXheSrc, EPS_Y,  hZhe), new THREE.Vector3(hXhe, EPS_Y,  hZhe)],
        [new THREE.Vector3(hXheSrc, hEave,  hZhe), new THREE.Vector3(hXhe, hEave,  hZhe)],
      ],
      `h<sub>e</sub>=${fmt(hEaveLabel ?? hEave)}ft`, 'dim-h-eave', 'wind-h',
      _monoD ? new THREE.Vector3(1,0,0) : new THREE.Vector3(-1,0,0)
    ));
    this._dimHighlight['dim-h-eave'] = grp.children[grp.children.length - 1];
    } // end if !_isFreeRoofDim (h_eave)

    // ── h (mean roof height, skip for free roofs) ───────────────────────────
    if (!_isFreeRoofDim) {
    const hZh   = 0;
    const hXh   = _monoD ? (hB + 16) : (-hB - 16);
    const hMean = (hEave + hRidge) / 2;
    const hMeanFt = (hEaveLabel != null && hLabel != null)
      ? (hEaveLabel + hLabel) / 2 : null;
    grp.add(this._buildDim(
      new THREE.Vector3(hXh, EPS_Y,  hZh),
      new THREE.Vector3(hXh, hMean,  hZh),
      _monoD ? new THREE.Vector3(1, 1, 0).normalize() : new THREE.Vector3(-1, 1, 0).normalize(),
      [
        [new THREE.Vector3(hXhe, EPS_Y,  hZh), new THREE.Vector3(hXh, EPS_Y,  hZh)],
        [new THREE.Vector3(_monoD ? hB/2 : -hB/2, hMean, hZh), new THREE.Vector3(hXh, hMean, hZh)],
      ],
      `h=${fmt(hMeanFt ?? hMean)}ft`, 'dim-h', 'wind-h',
      _monoD ? new THREE.Vector3(1,0,0) : new THREE.Vector3(-1,0,0)
    ));
    this._dimHighlight['dim-h'] = grp.children[grp.children.length - 1];
    } // end if !_isFreeRoofDim (h_mean)

    const aEY  = EPS_Y;

    // ── Eave "a" dims (skip for free roofs — zone descriptor provides them) ──
    if (!_isFreeRoofDim) {
    const aFZ  = hL + 8;
    const a2x0 = _monoD ? -hB           : (hB - zone_a);
    const a2x1 = _monoD ? (-hB + zone_a) : hB;
    grp.add(this._buildDim(
      new THREE.Vector3(a2x0, aEY, aFZ),
      new THREE.Vector3(a2x1, aEY, aFZ),
      _monoD ? new THREE.Vector3(-1, 0, -1).normalize() : new THREE.Vector3(1, 0, -1).normalize(),
      [
        [new THREE.Vector3(a2x0, EPS_Y, hL), new THREE.Vector3(a2x0, aEY, aFZ)],
        [new THREE.Vector3(a2x1, EPS_Y, hL), new THREE.Vector3(a2x1, aEY, aFZ)],
      ],
      `a=${fmt(zone_a)}ft`, 'dim-a2', null, new THREE.Vector3(0,0,1)
    ));
    this._dimHighlight['dim-a2'] = grp.children[grp.children.length - 1];

    // ── Eave "a" — Side face front corner ────────────────────────────────
    // monoslope: LEFT face (x=-hB);  others: RIGHT face (x=+hB)
    // (still inside !_isFreeRoofDim block)
    const aRX    = _monoD ? (-hB - 12) : (hB + 12);   // +4 ft clear of 0.6h dim
    const aRXsrc = _monoD ? -hB : hB;
    grp.add(this._buildDim(
      new THREE.Vector3(aRX, aEY, hL - zone_a),
      new THREE.Vector3(aRX, aEY, hL),
      _monoD ? new THREE.Vector3(-1, 0, 1).normalize() : new THREE.Vector3(1, 0, 1).normalize(),
      [
        [new THREE.Vector3(aRXsrc, EPS_Y, hL - zone_a), new THREE.Vector3(aRX, aEY, hL - zone_a)],
        [new THREE.Vector3(aRXsrc, EPS_Y, hL),          new THREE.Vector3(aRX, aEY, hL)],
      ],
      `a=${fmt(zone_a)}ft`, 'dim-a', null,
      _monoD ? new THREE.Vector3(-1,0,0) : new THREE.Vector3(1,0,0)
    ));
    this._dimHighlight['dim-a'] = grp.children[grp.children.length - 1];
    } // end if !_isFreeRoofDim (a dims)

    // dim-a3/dim-a4 (base floor a= dims) removed — redundant with eave-level dims

    // ── Zone 3: 0.6h facade dims at EAVE LEVEL — flat/low-pitch gable only (θ ≤ 7°) ─
    if (roofShape !== 'hip' && roofShape !== 'monoslope' && !_isFreeRoofDim && theta <= 7) {
      const h_m    = hEaveLabel ?? (hEave / 1.8);
      const d06str = (+h_m * 0.6).toFixed(1);
      const z3_06h = 0.6 * h_m;
      const hBo    = hB + wo, hLo = hL + wo;  // outer edges include overhang
      const slope3 = hB > 0 ? (hRidge - hEave) / hB : 0;  // roof pitch rise/run

      // Right facade: 0.6h in z direction — from outer eave edge (hLo)
      // Second ext line follows slope plane (outward from eave, going downward)
      const z3RX  = hBo + 8;
      const p2yR  = hEave - (z3RX - hBo) * slope3;
      const sDirR = new THREE.Vector3(1, -slope3, 0).normalize();
      grp.add(this._buildDim(
        new THREE.Vector3(z3RX, hEave, hLo - z3_06h),
        new THREE.Vector3(z3RX, p2yR,  hLo),
        sDirR,
        [
          [new THREE.Vector3(hBo, hEave, hLo - z3_06h), new THREE.Vector3(z3RX, hEave, hLo - z3_06h)],
          [new THREE.Vector3(hBo, hEave, hLo),           new THREE.Vector3(z3RX, p2yR,  hLo)],
        ],
        `0.6h=${d06str}ft`, 'dim-z3-06h-r', null, new THREE.Vector3(1,0,0)
      ));
      this._dimHighlight['dim-z3-06h-r'] = grp.children[grp.children.length - 1];

      // Front facade: 0.6h in x direction — from outer eave edge (hBo)
      // Second ext line goes along Z (eave direction — lies in slope plane)
      const z3FZ = hLo + 8;
      grp.add(this._buildDim(
        new THREE.Vector3(hBo - z3_06h, hEave, z3FZ),
        new THREE.Vector3(hBo,           hEave, z3FZ),
        new THREE.Vector3(1, 0, -1).normalize(),
        [
          [new THREE.Vector3(hBo - z3_06h, hEave, hLo), new THREE.Vector3(hBo - z3_06h, hEave, z3FZ)],
          [new THREE.Vector3(hBo,           hEave, hLo), new THREE.Vector3(hBo,           hEave, z3FZ)],
        ],
        `0.6h=${d06str}ft`, 'dim-z3-06h-f', null, new THREE.Vector3(0,0,1)
      ));
      this._dimHighlight['dim-z3-06h-f'] = grp.children[grp.children.length - 1];
    }

    // ── θ angle dim — monoslope: LOW eave corner (right), angle opens left+up
    //                  others:    front-left eave corner, angle opens right+up ──────
    if (theta > 0) {
      const isMono = (roofShape === 'monoslope');
      const thRad  = isMono
        ? Math.atan2(hRidge - hEave, 2 * hB)   // monoslope: full span
        : Math.atan2(hRidge - hEave, hB);        // gable: half-span
      // monoslope: corner at LOW eave (x=+hB), horizontal goes left (−x), slope goes left+up
      const ax = isMono ? +hB : -hB;
      const ay = hEave, az = hL + 0.15;  // minimal offset to clear wall z-fighting
      const hSign = isMono ? -1 : +1;   // direction of horizontal leg
      const arcR   = 0.75 * hB;
      const ALEN   = 2.5;
      const HALFW  = ALEN * Math.tan(THREE.MathUtils.degToRad(15));
      const ATAIL  = 2;   // overshoot past arrowhead — matches _buildDim ext=aLen*0.8
      const legLen = arcR + ALEN + ATAIL;
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });

      // Arrowhead tangent to arc — arrow points INTO arc (perpendicular to extension line)
      const mkArcArrow = (tip, arrowDir, radialDir) => {
        const base = tip.clone().addScaledVector(arrowDir, -ALEN);
        const w1   = base.clone().addScaledVector(radialDir,  HALFW);
        const w2   = base.clone().addScaledVector(radialDir, -HALFW);
        const geo  = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          tip.x,tip.y,tip.z, w1.x,w1.y,w1.z, w2.x,w2.y,w2.z,
        ]), 3));
        return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
      };

      // Extension line 1: horizontal (right for gable, left for mono)
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax,                  ay, az),
        new THREE.Vector3(ax + hSign * legLen, ay, az),
      ]), lineMat));

      // Extension line 2: slope direction
      // gable: (cosθ, sinθ, 0)   mono: (−cosθ, sinθ, 0)
      const sDir = new THREE.Vector3(hSign * Math.cos(thRad), Math.sin(thRad), 0);
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax,                   ay,                   az),
        new THREE.Vector3(ax + sDir.x * legLen, ay + sDir.y * legLen, az),
      ]), lineMat));

      // Arc: gable sweeps 0→θ (CCW); mono sweeps π−θ→π (CCW)
      const arcStart = isMono ? (Math.PI - thRad) : 0;
      const N = 20;
      const arcPts = [];
      for (let i = 0; i <= N; i++) {
        const a = arcStart + (i / N) * thRad;
        arcPts.push(new THREE.Vector3(ax + arcR * Math.cos(a), ay + arcR * Math.sin(a), az));
      }
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), lineMat));

      if (isMono) {
        // Slope end (angle=π−θ): CCW tangent = (−sinθ, −cosθ), wings = sDir
        const pt2 = new THREE.Vector3(ax + arcR * Math.cos(Math.PI - thRad),
                                      ay + arcR * Math.sin(Math.PI - thRad), az);
        grp.add(mkArcArrow(pt2, new THREE.Vector3(-Math.sin(thRad), -Math.cos(thRad), 0), sDir.clone()));
        // Horizontal end (angle=π): CW into arc = (0,+1,0), wings = (−1,0,0)
        const pt1 = new THREE.Vector3(ax - arcR, ay, az);
        grp.add(mkArcArrow(pt1, new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)));
      } else {
        // pt1: angle=0 (horizontal) — CCW (+Y), wings (1,0,0)
        const pt1 = new THREE.Vector3(ax + arcR, ay, az);
        grp.add(mkArcArrow(pt1, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));
        // pt2: angle=θ (slope) — CW (sinθ,−cosθ,0), wings = sDir
        const pt2 = new THREE.Vector3(ax + arcR * Math.cos(thRad), ay + arcR * Math.sin(thRad), az);
        grp.add(mkArcArrow(pt2, new THREE.Vector3(Math.sin(thRad), -Math.cos(thRad), 0), sDir.clone()));
      }

      // CSS2D label — outside arc at its midpoint
      if (THREE.CSS2DObject) {
        const midA = isMono ? (Math.PI - thRad / 2) : (thRad / 2);
        const midPt = new THREE.Vector3(
          ax + (arcR + 2.5) * Math.cos(midA),
          ay + (arcR + 2.5) * Math.sin(midA),
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
          `a=${fmt(zone_a)}ft`, 'dim-aZ2T', null, sN
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
          `a=${fmt(zone_a)}ft`, 'dim-aZ2R', null, sN
        ));
        this._dimHighlight['dim-aZ2R'] = grp.children[grp.children.length - 1];
      }
    }

    return grp;
  }

    /* ── zone overlays ──────────────────────────────────────────────────────── */

  /** Width chain W1/W2/W3/W + height chain hs2/hs1/h + zone extent dims for stepped roof.
   *  Naming: hs2 = W2 absolute height (input); hs1 = step height = h1 − hs2 (derived).
   *  Height chain left of W1: hs2 (ground→W2 roof), hs1 (W2→W1 roof), h (total).
   *  W2 zone dims skipped when 3 sections (W2 gets П-layout, no Zone 3).
   */
  _buildSteppedDims(so, L, zone_a, grp) {
    const HS  = 1.8;
    const W1  = so.W1  || 20, W2 = so.W2 || 20, W3 = so.W3 || 0;
    const h1  = so.h1  || 24;
    const hs2 = so.hs2 || 12;    // W2 absolute height (input)
    const hs1 = h1 - hs2;         // step height (derived)
    const h3  = so.h3  || h1;
    const is3 = W3 > 0;
    const Wt  = W1 + W2 + (is3 ? W3 : 0);
    const hL  = L / 2;
    const EY  = 0.2;
    const fmt = v => { const s = v.toFixed(1); return s.endsWith('.0') ? s.slice(0,-2) : s; };

    const x0 = -Wt / 2;
    const x1 = x0 + W1;
    const x2 = x1 + W2;
    const xR = Wt / 2;

    const h1W  = h1  * HS;
    const hs2W = hs2 * HS;   // W2 roof level in scene units

    const tickW = new THREE.Vector3(1, 0, -1).normalize();
    const tickH = new THREE.Vector3(-1, 1, 0).normalize();

    /* ── Width chain at z = hL+8 — independent arrows at every end ── */
    const bZ  = hL + 8;
    const bZW = hL + (is3 ? 24 : 16);

    grp.add(this._buildDim(
      new THREE.Vector3(x0, EY, bZ), new THREE.Vector3(x1, EY, bZ), tickW,
      [[new THREE.Vector3(x0, EY, hL), new THREE.Vector3(x0, EY, bZ)],
       [new THREE.Vector3(x1, EY, hL), new THREE.Vector3(x1, EY, bZ)]],
      `W<sub>1</sub>=${fmt(W1)}ft`, 'dim-W1', 'wind-steppedW1',
      new THREE.Vector3(0,0,1)
    ));
    this._dimHighlight['dim-W1'] = grp.children[grp.children.length - 1];

    grp.add(this._buildDim(
      new THREE.Vector3(x1, EY, bZ), new THREE.Vector3(x2, EY, bZ), tickW,
      [[new THREE.Vector3(x1, EY, hL), new THREE.Vector3(x1, EY, bZ)],
       [new THREE.Vector3(x2, EY, hL), new THREE.Vector3(x2, EY, bZ)]],
      `W<sub>2</sub>=${fmt(W2)}ft`, 'dim-W2', 'wind-steppedW2',
      new THREE.Vector3(0,0,1)
    ));
    this._dimHighlight['dim-W2'] = grp.children[grp.children.length - 1];

    if (is3) {
      grp.add(this._buildDim(
        new THREE.Vector3(x2, EY, bZ), new THREE.Vector3(xR, EY, bZ), tickW,
        [[new THREE.Vector3(x2, EY, hL), new THREE.Vector3(x2, EY, bZ)],
         [new THREE.Vector3(xR, EY, hL), new THREE.Vector3(xR, EY, bZ)]],
        `W<sub>3</sub>=${fmt(W3)}ft`, 'dim-W3', 'wind-steppedW3',
        new THREE.Vector3(0,0,1)
      ));
      this._dimHighlight['dim-W3'] = grp.children[grp.children.length - 1];
    }

    grp.add(this._buildDim(
      new THREE.Vector3(x0, EY, bZW), new THREE.Vector3(xR, EY, bZW), tickW,
      [[new THREE.Vector3(x0, EY, bZ), new THREE.Vector3(x0, EY, bZW)],
       [new THREE.Vector3(xR, EY, bZ), new THREE.Vector3(xR, EY, bZW)]],
      `W=${fmt(Wt)}ft`, 'dim-W', null, new THREE.Vector3(0,0,1)
    ));
    this._dimHighlight['dim-W'] = grp.children[grp.children.length - 1];

    /* ── Height chain LEFT of W1 ─────────────────────────────────────────────
       hX1 = x0 − 8  : hs2 (ground→W2 roof) + hs1 (W2 roof→W1 roof) chain
       hX2 = x0 − 18 : h total outer
       ext-line 2 of hs2 anchors at step junction (x1, hs2W) = W2 roof level    */
    const hX1 = x0 - 8;
    const hX2 = x0 - 18;
    const VN  = new THREE.Vector3(-1, 0, 0);

    // hs2 — ground → W2 roof; tick at top (chain joins hs1)
    grp.add(this._buildDim(
      new THREE.Vector3(hX1, EY,   0),
      new THREE.Vector3(hX1, hs2W, 0),
      tickH,
      [[new THREE.Vector3(x0, EY,   0), new THREE.Vector3(hX1, EY,   0)],
       [new THREE.Vector3(x1, hs2W, 0), new THREE.Vector3(hX1, hs2W, 0)]],
      `h<sub>s2</sub>=${fmt(hs2)}ft`, 'dim-hs2', 'wind-steppedHz1',
      VN, false, 'auto', 'tick'
    ));
    this._dimHighlight['dim-hs2'] = grp.children[grp.children.length - 1];

    // hs1 — step (W2 roof → W1 roof); tick at bottom, arrow at top
    grp.add(this._buildDim(
      new THREE.Vector3(hX1, hs2W, 0),
      new THREE.Vector3(hX1, h1W,  0),
      tickH,
      [[new THREE.Vector3(x1, hs2W, 0), new THREE.Vector3(hX1, hs2W, 0)],
       [new THREE.Vector3(x0, h1W,  0), new THREE.Vector3(hX1, h1W,  0)]],
      `h<sub>s1</sub>=${fmt(hs1)}ft`, 'dim-hs1', null,
      VN, false, 'tick', 'auto'
    ));
    this._dimHighlight['dim-hs1'] = grp.children[grp.children.length - 1];

    // h total (outer)
    grp.add(this._buildDim(
      new THREE.Vector3(hX2, EY,  0),
      new THREE.Vector3(hX2, h1W, 0),
      tickH,
      [[new THREE.Vector3(hX1, EY,  0), new THREE.Vector3(hX2, EY,  0)],
       [new THREE.Vector3(hX1, h1W, 0), new THREE.Vector3(hX2, h1W, 0)]],
      `h=${fmt(h1)}ft`, 'dim-h', 'wind-h', VN
    ));
    this._dimHighlight['dim-h'] = grp.children[grp.children.length - 1];

    /* ── a= dims at Zone 5 boundaries ── */
    const zaX = Math.min(zone_a, Wt / 2);
    const zaZ = Math.min(zone_a, hL);

    const aFZ = hL + 4;
    grp.add(this._buildDim(
      new THREE.Vector3(xR - zaX, EY, aFZ), new THREE.Vector3(xR, EY, aFZ), tickW,
      [[new THREE.Vector3(xR - zaX, EY, hL), new THREE.Vector3(xR - zaX, EY, aFZ)],
       [new THREE.Vector3(xR,       EY, hL), new THREE.Vector3(xR,       EY, aFZ)]],
      `a=${fmt(zone_a)}ft`, 'dim-a2', null, new THREE.Vector3(0,0,1)
    ));
    this._dimHighlight['dim-a2'] = grp.children[grp.children.length - 1];

    const aRX = xR + 4;
    grp.add(this._buildDim(
      new THREE.Vector3(aRX, EY, hL - zaZ), new THREE.Vector3(aRX, EY, hL),
      new THREE.Vector3(1, 0, 1).normalize(),
      [[new THREE.Vector3(xR, EY, hL - zaZ), new THREE.Vector3(aRX, EY, hL - zaZ)],
       [new THREE.Vector3(xR, EY, hL),       new THREE.Vector3(aRX, EY, hL)]],
      `a=${fmt(zone_a)}ft`, 'dim-a', null, new THREE.Vector3(1,0,0)
    ));
    this._dimHighlight['dim-a'] = grp.children[grp.children.length - 1];

    /* ── Zone 3 extent dims (0.6h) per section ────────────────────────────────────
       W2 (i=1) skipped when is3: uses П-layout, no Zone 3.                              */
    const _secDs = [
      { x0: x0, x1: x1, w: W1,  h: h1  },
      { x0: x1, x1: x2, w: W2,  h: hs2 },
      ...(is3 ? [{ x0: x2, x1: xR, w: W3, h: h3 }] : []),
    ];
    _secDs.forEach((_s, _i) => {
      if (is3 && _i === 1) return;
      const _hs   = _s.h;
      const _dX2  = Math.min(0.6 * _hs, 0.45 * _s.w);
      const _dZ2  = Math.min(0.6 * _hs, 0.45 * 2 * hL);
      const _yRs  = _hs * HS + 0.2;
      const _last = _i === _secDs.length - 1;

      const _zdX = _s.x1 + (_last ? 8 : 5);
      grp.add(this._buildDim(
        new THREE.Vector3(_zdX, _yRs, hL - _dZ2),
        new THREE.Vector3(_zdX, _yRs, hL),
        new THREE.Vector3(1, 0, 1).normalize(),
        [[new THREE.Vector3(_s.x1, _yRs, hL - _dZ2), new THREE.Vector3(_zdX, _yRs, hL - _dZ2)],
         [new THREE.Vector3(_s.x1, _yRs, hL),         new THREE.Vector3(_zdX, _yRs, hL)]],
        `0.6h=${fmt(_dZ2)}ft`, `dim-z3z${_i}`, null,
        new THREE.Vector3(1, 0, 0)
      ));

      const _xdZ = hL + 6;
      grp.add(this._buildDim(
        new THREE.Vector3(_s.x0,         _yRs, _xdZ),
        new THREE.Vector3(_s.x0 + _dX2,  _yRs, _xdZ),
        tickW,
        [[new THREE.Vector3(_s.x0,        _yRs, hL), new THREE.Vector3(_s.x0,        _yRs, _xdZ)],
         [new THREE.Vector3(_s.x0 + _dX2, _yRs, hL), new THREE.Vector3(_s.x0 + _dX2, _yRs, _xdZ)]],
        `0.6h=${fmt(_dX2)}ft`, `dim-z3x${_i}`, null,
        new THREE.Vector3(0, 0, 1)
      ));
    });
  }
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

  /** On-slope dimension line with 15° filled arrows + chip label.
   *  ptA, ptB   : dim-line endpoints on the slope surface
   *  norm       : outward surface normal
   *  eps        : offset above surface
   *  extPairs   : optional [[fromPt, toPt], …] — extension lines drawn with
   *               gap + overshoot, fromPt on measured object, toPt = dim endpoint
   */
  // DIM STYLE: black 0x000000, ARROW_LEN=2.5, opaque — do not change per call-site
  _mkSlopeDim(label, ptA, ptB, norm, eps, extPairs = [], p1End = 'auto', p2End = 'auto') {
    const N   = norm.clone().normalize();
    const off = N.clone().multiplyScalar((eps || 0.10) + 0.06);
    const A   = ptA.clone().add(off);
    const B   = ptB.clone().add(off);
    const mid = A.clone().lerp(B, 0.5);
    const lineMat = new THREE.LineBasicMaterial(
      { color: 0x000000 });   // black, opaque — locked dim style

    // Main dim line
    this._labelGroup.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), lineMat));

    // Filled 15° arrowheads — 2× size relative to proportional base
    const lineDir = B.clone().sub(A).normalize();
    const perpDir = new THREE.Vector3().crossVectors(N, lineDir).normalize();
    const span    = ptA.distanceTo(ptB);
    const aLen    = 2.5;   // fixed — uniform with _buildDim ARROW_LEN
    const halfWS  = aLen * Math.tan(THREE.MathUtils.degToRad(15));
    const mkSlArr = (tip, dir) => {
      const base = tip.clone().addScaledVector(dir, aLen);
      const w1   = base.clone().addScaledVector(perpDir,  halfWS);
      const w2   = base.clone().addScaledVector(perpDir, -halfWS);
      const geo  = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        tip.x, tip.y, tip.z, w1.x, w1.y, w1.z, w2.x, w2.y, w2.z,
      ]), 3));
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial(
        { color: 0x000000, side: THREE.DoubleSide }));   // black opaque
    };
    // Architectural tick — filled quad for 2× visual weight
    const mkSlTick = (pt) => {
      const TICK_HW = 0.18;
      const tDir  = lineDir.clone().add(perpDir.clone()).normalize();
      const wDir2 = lineDir.clone().sub(perpDir.clone()).normalize();
      const t0 = pt.clone().addScaledVector(tDir, -aLen / 2);
      const t1 = pt.clone().addScaledVector(tDir,  aLen / 2);
      const w0a = t0.clone().addScaledVector(wDir2,  TICK_HW);
      const w0b = t0.clone().addScaledVector(wDir2, -TICK_HW);
      const w1a = t1.clone().addScaledVector(wDir2,  TICK_HW);
      const w1b = t1.clone().addScaledVector(wDir2, -TICK_HW);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        w0a.x,w0a.y,w0a.z, w0b.x,w0b.y,w0b.z, w1a.x,w1a.y,w1a.z,
        w0b.x,w0b.y,w0b.z, w1b.x,w1b.y,w1b.z, w1a.x,w1a.y,w1a.z,
      ]), 3));
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    };
    const OUTSIDE_S = 8;  // ft — outside arrows when span < this
    // A endpoint (p1)
    if (p1End === 'tick') {
      this._labelGroup.add(mkSlTick(A));
    } else if (p1End === 'inside' || (p1End === 'auto' && span >= OUTSIDE_S)) {
      this._labelGroup.add(mkSlArr(A, lineDir.clone()));
    } else {
      this._labelGroup.add(mkSlArr(A, lineDir.clone().negate()));
      this._labelGroup.add(new THREE.Line(            // tail extends outward past arrowhead
        new THREE.BufferGeometry().setFromPoints([A.clone(), A.clone().addScaledVector(lineDir.clone().negate(), 5)]), lineMat));
    }
    // B endpoint (p2)
    if (p2End === 'tick') {
      this._labelGroup.add(mkSlTick(B));
    } else if (p2End === 'inside' || (p2End === 'auto' && span >= OUTSIDE_S)) {
      this._labelGroup.add(mkSlArr(B, lineDir.clone().negate()));
    } else {
      this._labelGroup.add(mkSlArr(B, lineDir.clone()));
      this._labelGroup.add(new THREE.Line(            // tail extends outward past arrowhead
        new THREE.BufferGeometry().setFromPoints([B.clone(), B.clone().addScaledVector(lineDir.clone(), 5)]), lineMat));
    }

    // Extension lines — gap near measured object, overshoot past dim line
    for (const [fromPt, toPt] of extPairs) {
      const fA  = fromPt.clone().add(off);
      const fB  = toPt.clone().add(off);
      const dir = new THREE.Vector3().subVectors(fB, fA).normalize();
      const gap = aLen * 0.75;  // gap at measured-object side (locked: ÷2)
      const ext = aLen * 0.8;   // overshoot past dim line
      const fAg = fA.clone().addScaledVector(dir,  gap);
      const fBe = fB.clone().addScaledVector(dir,  ext);
      this._labelGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([fAg, fBe]), lineMat));
    }

    // Chip label
    if (label && THREE.CSS2DObject) {
      const div = document.createElement('div');
      div.textContent = label;
      div.style.cssText = [
        'font-family:"JetBrains Mono",monospace', 'font-size:13px', 'font-weight:700',
        'color:#1e3a5f', 'background:rgba(255,255,255,0.92)',
        'padding:2px 8px', 'border-radius:4px', 'border:1px solid #64748b',
        'pointer-events:none', 'white-space:nowrap',
      ].join(';');
      const obj = new THREE.CSS2DObject(div);
      obj.position.copy(mid);
      obj.userData.faceNormal = N.clone();
      this._labelGroup.add(obj);
    }
  }

  /** Zone 3 chip with black horizontal-then-diagonal leader + filled 15° arrowhead.
   *  Exits chip's near side horizontally (length = card width), then diagonal to zone. */
  _makeZone3ArrowLabel(centroid, norm, zone_a) {
    if (!THREE.CSS2DObject) return;
    // Chip placed directly on the zone surface — no leader
    const div = document.createElement('div');
    div.textContent = 'Zone 3';
    div.style.cssText = [
      'font-family:"JetBrains Mono",monospace', 'font-size:13px', 'font-weight:700',
      'color:#fff',    'background:rgba(220,38,38,0.92)',
      'padding:2px 8px', 'border-radius:4px', 'pointer-events:none', 'white-space:nowrap',
    ].join(';');
    const obj = new THREE.CSS2DObject(div);
    obj.position.copy(centroid.clone().addScaledVector(norm.clone().normalize(), 0.18));
    obj.userData.faceNormal = norm.clone().normalize();
    this._labelGroup.add(obj);
  }

  _makeZoneLabel(zoneType, centroid, norm, hB, zone_a, L) {
    if (!THREE.CSS2DObject) return;

    const cfgMap = {
      'zone-1p':{ ...THEME.zoneLabel1p,  text: "Zone 1'" },
      'zone-1': { ...THEME.zoneLabel1,   text: 'Zone 1' },
      'zone-2': { ...THEME.zoneLabel2,   text: 'Zone 2' },
      'zone-2p':{ ...THEME.zoneLabel2p,  text: "Zone 2'" },
      'zone-3': { ...THEME.zoneLabel3,   text: 'Zone 3' },
      'zone-3p':{ ...THEME.zoneLabel3p,  text: "Zone 3'" },
    };
    const cfg = cfgMap[zoneType];
    if (!cfg) return;

    // Estimate zone width on slope (in world units)
    // Chip placed directly on the zone surface — no leader
    const div = document.createElement('div');
    div.textContent = cfg.text;
    div.style.cssText = [
      'font-family:"JetBrains Mono",monospace',
      'font-size:13px',
      'font-weight:700',
      `color:${cfg.fg}`,
      `background:${cfg.bg}`,
      'backdrop-filter:blur(3px)',
      'padding:2px 8px',
      'border-radius:4px',
      'pointer-events:none',
      'white-space:nowrap',
    ].join(';');

    const labelPos = centroid.clone().addScaledVector(norm.clone().normalize(), 0.18);
    const obj = new THREE.CSS2DObject(div);
    obj.position.copy(labelPos);
    obj.userData.faceNormal = norm.clone().normalize();  // for back-face culling in _animate
    this._labelGroup.add(obj);
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
      "zone-1p":{ bg:'rgba(74,222,128,0.80)',  fg:'#14532d', text:"Zone 1'" },
      'zone-1': { bg:'rgba(253,224,71,0.92)',  fg:'#713f12', text:'Zone 1' },
      'zone-2': { bg:'rgba(251,146,60,0.92)',  fg:'#7c2d12', text:'Zone 2' },
      'zone-2p':{ bg:'rgba(249,115,22,0.92)',  fg:'#fff',    text:"Zone 2'" },
      'zone-3': { bg:'rgba(220,38,38,0.92)',   fg:'#fff',    text:'Zone 3' },
      'zone-3p':{ bg:'rgba(153,27,27,0.92)',   fg:'#fff',    text:"Zone 3'" },
      'zone-4': { bg:'rgba(125,211,252,0.92)', fg:'#0c4a6e', text:'Zone 4' },
      'zone-5': { bg:'rgba(167,139,250,0.92)', fg:'#2e1065', text:'Zone 5' },
    };
    const cfg = cfgMap[zoneType];
    if (!cfg) return;

    const div = document.createElement('div');
    div.textContent = cfg.text;
    div.style.cssText = [
      'font-family:"JetBrains Mono",monospace',
      'font-size:13px',
      'font-weight:700',
      `color:${cfg.fg}`,
      `background:${cfg.bg}`,
      'padding:2px 8px',
      'border-radius:4px',
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
  update3DModel(B, L, h, theta, zone_a, roofShape, overhangOpts, steppedOpts) {
    B = +B||48; L = +L||96; h = +h||66; theta = +theta||15; zone_a = +zone_a||4;
    const _wo = (overhangOpts && overhangOpts.has) ? (+overhangOpts.wo || 2) : 0;

    /* For hip roofs, always orient so B <= L (B = short cross-wind span that
       sets eave height; L = long ridge axis). Apply swap before all geometry
       so hB/hL, wall zones, dim lines, and UV mapping stay consistent. */
    const _shape = roofShape || 'gable';

    const H_SCALE  = 1.8;  // vertical exaggeration — keeps proportions readable
    const th       = THREE.MathUtils.degToRad(theta);
    const hB       = B/2, hL = L/2;
    // eave height uses the SHORT half-span so hip roofs with B > L stay valid
    const hEave_ft = Math.max(1, h - Math.min(hB, hL) * Math.tan(th));  // actual eave height, ft
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
      this._building = this._buildStructureHip(B, L, hEave, hRidge, _wo);
    } else if (_shape === 'monoslope') {
      this._building = this._buildStructureMonoslope(B, L, hEave, hRidge, _wo);
    } else if (_shape === 'stepped' && steppedOpts) {
      const so = steppedOpts;
      this._building = this._buildStructureStepped(
        so.W1 || 20, so.W2 || 20, so.W3 || 0, L,
        so.h1 || h, so.hs2 || 12, so.h3 || (so.h1 || h)
      );
    } else if (_shape === 'monoslope-free') {
      this._building = this._buildStructureMonoslopeFree(B, L, hEave, hRidge, _wo);
    } else if (_shape === 'pitched-free') {
      this._building = this._buildStructurePitchedFree(B, L, hEave, hRidge, _wo);
    } else if (_shape === 'troughed-free') {
      this._building = this._buildStructureTroughed(B, L, hEave, hRidge, _wo);
    } else {
      /* gable or flat (flat = gable with theta=0, already handled by caller) */
      this._building = this._buildStructure(B, L, hEave, hRidge, _wo);
    }

    // dim lines (pass hRidge_ft so label shows real engineering value, not scaled)
    const _dimB = (_shape === 'stepped' && steppedOpts)
      ? ((steppedOpts.W1||20) + (steppedOpts.W2||20) + (steppedOpts.W3||0))
      : B;
    this._dimGroup = this._buildAllDims(_dimB, L, hEave, hRidge, zone_a, hRidge_ft, hEave_ft, theta, _shape, _wo);
    if (_shape === 'stepped' && steppedOpts) {
      this._buildSteppedDims(steppedOpts, L, zone_a, this._dimGroup);
    }

    // zones — shape-specific surface mapping
    const matZ = (col, op) => new THREE.MeshBasicMaterial({
      color:col, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false,
    });

    const hB_vis    = hB + _wo;
    const hL_vis    = hL + _wo;
    const hEave_vis = _wo > 0 ? hEave - _wo * (hRidge - hEave) / Math.max(hB, 0.001) : hEave;

    const u_zone = Math.min((_wo + zone_a) / hB_vis, 0.45);
    const v_zone = Math.min((_wo + zone_a) / (L + 2*_wo), 0.45);
    const u1 = 1 - u_zone, v1 = 1 - v_zone;

    /* addZone: maps region [u0..u1]×[v0..v1] onto the surface defined by ptFn/norm */
    const addZone = (u0,uu1,v0,vv1,col,op,zt,eps,ptFn,norm,label) => {
      const m = this._zoneQuad(u0,uu1,v0,vv1,ptFn,hB_vis,hEave_vis,hRidge,hL_vis,norm,eps,matZ(col,op),zt);
      this._zones.add(m);
      this._zoneMeshes.push(m);
      if (label) {
        const ctr = this._zoneCentroid(u0,uu1,v0,vv1,ptFn,hB_vis,hEave_vis,hRidge,hL_vis);
        ctr.addScaledVector(norm, eps + 0.5);
        this._makeZoneLabel(zt, ctr, norm, hB_vis, zone_a, L + 2*_wo);
      }
    };

    /* ── Zone descriptor dispatch — geometry lives in zones-cc-*.js ─────── */
    const ctx = {
      B: B + 2*_wo, L: L + 2*_wo, hB: hB_vis, hL: hL_vis,
      hEave_ft, hRidge_ft, hEave: hEave_vis, hRidge,
      zone_a, u_zone, u1, v_zone, v1,
      THEME, THREE,
      addZone,
      addQuadMesh: (p0,p1,p2,p3,n,zt,op,eps) =>
        this._addQuadMesh(matZ,p0,p1,p2,p3,n,zt,op,eps),
      addTriPart: (pts,zt,op,eps,n) =>
        this._addTriPart(matZ,pts,zt,op,eps,n),
      mkDimChip: (t,pt,anchor,nDir) =>
        this._mkDimChip(t,pt,anchor,nDir),
      makeZoneLabelFlat: (zt,pt,n,td) =>
        this._makeZoneLabelFlat(zt,pt,n,td),
      leftNormal:     (b,e,r,l)       => this._leftNormal(b,e,r,l),
      mkSlopeDim:      (lbl,ptA,ptB,n)                   => this._mkSlopeDim(lbl,ptA,ptB,n,0.30),
      mkSlopeDimExt:   (lbl,ptA,ptB,extPairs,n)          => this._mkSlopeDim(lbl,ptA,ptB,n,0.30,extPairs),
      mkSlopeDimZ3:    (lbl,ptA,ptB,n)                   => this._mkSlopeDim(lbl,ptA,ptB,n,0.30),
      mkSlopeDimChain: (lbl,ptA,ptB,n,p1End,p2End)       => this._mkSlopeDim(lbl,ptA,ptB,n,0.30,[],p1End,p2End),
      makeZone3Label: (pt,n)          => this._makeZone3ArrowLabel(pt,n,zone_a),
    };

    if (_shape === 'monoslope') {
      const slopeM   = (2*hB) > 0 ? (hRidge - hEave) / (2*hB) : 0;
      const hHighVis = hRidge + _wo * slopeM;
      const hLowVis  = hEave  - _wo * slopeM;
      const addZoneM = (u0,uu1,v0,vv1,col,op,zt,eps,ptFn,norm,label) => {
        const m = this._zoneQuad(u0,uu1,v0,vv1,ptFn,hB_vis,hLowVis,hHighVis,hL_vis,norm,eps,matZ(col,op),zt);
        this._zones.add(m);
        this._zoneMeshes.push(m);
        if (label) {
          const ctr = this._zoneCentroid(u0,uu1,v0,vv1,ptFn,hB_vis,hLowVis,hHighVis,hL_vis);
          ctr.addScaledVector(norm, eps + 0.5);
          this._makeZoneLabel(zt, ctr, norm, hB_vis, zone_a, L + 2*_wo);
        }
      };
      const ptMono = (u,v,_b,_e,_r,_l) =>
        new THREE.Vector3(-_b + u*2*_b, _r - u*(_r-_e), v*2*_l - _l);
      const _e1 = new THREE.Vector3(2*hB_vis, hLowVis-hHighVis, 0);
      const _e2 = new THREE.Vector3(0, 0, 2*hL_vis);
      const monoNorm = new THREE.Vector3().crossVectors(_e2, _e1).normalize();
      if (monoNorm.y < 0) monoNorm.negate();
      window.ZONE_DESCRIPTORS['cc-monoslope']
        .drawZones({ ...ctx, addZone: addZoneM, ptFn: ptMono, norm: monoNorm, doLabel: true });

    } else if (_shape === 'monoslope-free' && window.ZONE_DESCRIPTORS['cc-monoslope-free']) {
      const slopeM   = (2*hB) > 0 ? (hRidge - hEave) / (2*hB) : 0;
      const hHighVis = hRidge + _wo * slopeM;
      const hLowVis  = hEave  - _wo * slopeM;
      const addZoneM = (u0,uu1,v0,vv1,col,op,zt,eps,ptFn,norm,label) => {
        const m = this._zoneQuad(u0,uu1,v0,vv1,ptFn,hB_vis,hLowVis,hHighVis,hL_vis,norm,eps,matZ(col,op),zt);
        this._zones.add(m);
        this._zoneMeshes.push(m);
        if (label) {
          const ctr = this._zoneCentroid(u0,uu1,v0,vv1,ptFn,hB_vis,hLowVis,hHighVis,hL_vis);
          ctr.addScaledVector(norm, eps + 0.5);
          this._makeZoneLabel(zt, ctr, norm, hB_vis, zone_a, L + 2*_wo);
        }
      };
      const ptMono = (u,v,_b,_e,_r,_l) =>
        new THREE.Vector3(-_b + u*2*_b, _r - u*(_r-_e), v*2*_l - _l);
      const _e1 = new THREE.Vector3(2*hB_vis, hLowVis-hHighVis, 0);
      const _e2 = new THREE.Vector3(0, 0, 2*hL_vis);
      const monoNorm = new THREE.Vector3().crossVectors(_e2, _e1).normalize();
      if (monoNorm.y < 0) monoNorm.negate();
      window.ZONE_DESCRIPTORS['cc-monoslope-free']
        .drawZones({ ...ctx, addZone: addZoneM, ptFn: ptMono, norm: monoNorm, doLabel: true });

    } else if (_shape === 'pitched-free' && window.ZONE_DESCRIPTORS['cc-pitched-free']) {
      window.ZONE_DESCRIPTORS['cc-pitched-free'].drawZones({ ...ctx, doLabel: true });

    } else if (_shape === 'troughed-free' && window.ZONE_DESCRIPTORS['cc-troughed-free']) {
      window.ZONE_DESCRIPTORS['cc-troughed-free'].drawZones({ ...ctx, doLabel: true });

    } else if (_shape === 'hip') {
      window.ZONE_DESCRIPTORS['cc-hip'].drawZones(ctx);

    } else if (_shape === 'stepped' && steppedOpts) {
      /* ── Stepped roof zones (ASCE 7-22 Fig. 30.3-3) ─────────────────────────
         Roof: Zone 3 (corners) · Zone 2 (perimeter) · Zone 1 (field) per section
         Walls: 4 outer building corners = Zone 5 · everything else = Zone 4      */
      const _HS  = 1.8;
      const _so  = steppedOpts;
      const _is3 = (_so.W3 || 0) > 0;
      const _secs = _is3
        ? [{ w: _so.W1||20, h: _so.h1||h }, { w: _so.W2||20, h: _so.hs2||12 }, { w: _so.W3||0, h: _so.h3||(_so.h1||h) }]
        : [{ w: _so.W1||20, h: _so.h1||h }, { w: _so.W2||20, h: _so.hs2||12 }];
      const _Wt = _secs.reduce((acc, s) => acc + s.w, 0);
      const _xL = []; let _xC = -_Wt / 2;
      for (const _s of _secs) { _xL.push(_xC); _xC += _s.w; }
      _xL.push(_Wt / 2);

      const _Z4OP = 0.22, _Z5OP = 0.45, _EPS = 0.06;
      const _upN = new THREE.Vector3(0, 1, 0);

      /* Flat horizontal zone quad on roof surface */
      const _addRoof = (x0, x1, z0, z1, yOff, col, op, zt, lbl) => {
        const geo = this._quad(
          new THREE.Vector3(x0, yOff, z0), new THREE.Vector3(x1, yOff, z0),
          new THREE.Vector3(x1, yOff, z1), new THREE.Vector3(x0, yOff, z1)
        );
        const m = new THREE.Mesh(geo, matZ(col, op));
        m.userData.zoneType = zt;
        this._zones.add(m); this._zoneMeshes.push(m);
        if (lbl) {
          const ctr = new THREE.Vector3((x0+x1)/2, yOff+0.5, (z0+z1)/2);
          this._makeZoneLabel(zt, ctr, _upN, _Wt, zone_a, 2*hL);
        }
      };

      /* Vertical wall zone quad */
      const _addWall = (pts4, zt, op) => {
        const col = zt === 'zone-5' ? THEME.zone5 : THEME.zone4;
        const geo = this._quad(pts4[0], pts4[1], pts4[2], pts4[3]);
        const m = new THREE.Mesh(geo, matZ(col, op));
        m.renderOrder = 1;
        m.userData = { zoneType: zt };
        this._zones.add(m); this._zoneMeshes.push(m);
      };

      /* ── ROOF ZONES per section ─────────────────────────────────────────── */
      const _lbl = { z1: false, z2: false, z3: false };  // label once per zone type

      for (let i = 0; i < _secs.length; i++) {
        _lbl.z1 = false; _lbl.z2 = false; _lbl.z3 = false;  // label each section
        const _x0 = _xL[i], _x1 = _xL[i+1], _w = _x1 - _x0;
        const _yR = _secs[i].h * _HS + 0.05;  // roof surface + tiny clearance

        if (_is3 && i === 1) {
          /* ── W2 middle (3-section): Zone 1 + П-shaped Zone 2 only ─────────────────────
             Zone 2 П-shape on front and back faces:
               left/right strips (width 1.5·hs1 from step wall): depth 0.6·h1
               middle bar (between strips):                        depth 0.6·hs2
             Zone 1 fills the interior.                                            */
          const _hs2v = _secs[1].h;           // W2 absolute height
          const _hs1v = _secs[0].h - _hs2v;  // step height
          const _h1v  = _secs[0].h;           // tallest building height
          const _dXs  = Math.min(1.5 * _hs1v, 0.45 * _w);       // strip width (X)
          const _dZc  = Math.min(0.6 * _h1v,  0.45 * 2 * hL);   // corner depth
          const _dZm  = Math.min(0.6 * _hs2v, 0.45 * 2 * hL);   // middle depth

          // Zone 2 front П
          _addRoof(_x0,        _x0+_dXs, hL-_dZc, hL, _yR, THEME.zone2, 0.35, 'zone-2', !_lbl.z2);
          _lbl.z2 = true;
          _addRoof(_x0+_dXs, _x1-_dXs, hL-_dZm, hL, _yR, THEME.zone2, 0.35, 'zone-2', false);
          _addRoof(_x1-_dXs,     _x1, hL-_dZc, hL, _yR, THEME.zone2, 0.35, 'zone-2', false);
          // Zone 2 back П
          _addRoof(_x0,        _x0+_dXs, -hL, -hL+_dZc, _yR, THEME.zone2, 0.35, 'zone-2', false);
          _addRoof(_x0+_dXs, _x1-_dXs, -hL, -hL+_dZm, _yR, THEME.zone2, 0.35, 'zone-2', false);
          _addRoof(_x1-_dXs,     _x1, -hL, -hL+_dZc, _yR, THEME.zone2, 0.35, 'zone-2', false);

          // Zone 1 interior
          const _zi0m = -hL + _dZm, _zi1m = hL - _dZm;
          if (_x0+_dXs < _x1-_dXs && _zi0m < _zi1m) {
            _addRoof(_x0+_dXs, _x1-_dXs, _zi0m, _zi1m, _yR, THEME.zone1, 0.22, 'zone-1', !_lbl.z1);
            _lbl.z1 = true;
          }
          const _zi0c = -hL + _dZc, _zi1c = hL - _dZc;
          if (_zi0c < _zi1c) {
            _addRoof(_x0,      _x0+_dXs, _zi0c, _zi1c, _yR, THEME.zone1, 0.22, 'zone-1', !_lbl.z1);
            _lbl.z1 = true;
            _addRoof(_x1-_dXs, _x1,      _zi0c, _zi1c, _yR, THEME.zone1, 0.22, 'zone-1', false);
          }

        } else {
          /* ── Standard: Zone 3 L-shapes + Zone 2 perimeter + Zone 1 ── */
          const _hm  = _secs[i].h;
          const _dX3 = Math.min(0.2 * _hm, 0.45 * _w);
          const _dX2 = Math.min(0.6 * _hm, 0.45 * _w);
          const _dZ3 = Math.min(0.2 * _hm, 0.45 * 2 * hL);
          const _dZ2 = Math.min(0.6 * _hm, 0.45 * 2 * hL);

          /* Zone 1 — interior */
          const _xi0 = _x0 + _dX2, _xi1 = _x1 - _dX2;
          const _zi0 = -hL + _dZ2, _zi1 =  hL - _dZ2;
          if (_xi0 < _xi1 && _zi0 < _zi1) {
            const _lbl1 = !_lbl.z1; _lbl.z1 = true;
            _addRoof(_xi0, _xi1, _zi0, _zi1, _yR, THEME.zone1, 0.22, 'zone-1', _lbl1);
          }

          /* Zone 2 — perimeter (no overlap with Zone 3) */
          let _lbl2 = !_lbl.z2;
          if (_xi0 < _xi1) {
            _addRoof(_xi0, _xi1, -hL, -hL+_dZ2, _yR, THEME.zone2, 0.35, 'zone-2', _lbl2);
            if (_lbl2) { _lbl.z2 = true; _lbl2 = false; }
            _addRoof(_xi0, _xi1,  hL-_dZ2, hL,  _yR, THEME.zone2, 0.35, 'zone-2', false);
          }
          if (_zi0 < _zi1) {
            _addRoof(_x0, _x0+_dX2, _zi0, _zi1, _yR, THEME.zone2, 0.35, 'zone-2', _lbl2);
            if (_lbl2) { _lbl.z2 = true; _lbl2 = false; }
            _addRoof(_x1-_dX2, _x1, _zi0, _zi1, _yR, THEME.zone2, 0.35, 'zone-2', false);
          }
          if (_dX3 < _dX2 && _dZ3 < _dZ2) {
            _addRoof(_x0+_dX3, _x0+_dX2, -hL+_dZ3, -hL+_dZ2, _yR, THEME.zone2, 0.35, 'zone-2', _lbl2);
            if (_lbl2) { _lbl.z2 = true; _lbl2 = false; }
            _addRoof(_x1-_dX2, _x1-_dX3, -hL+_dZ3, -hL+_dZ2, _yR, THEME.zone2, 0.35, 'zone-2', false);
            _addRoof(_x0+_dX3, _x0+_dX2,  hL-_dZ2,  hL-_dZ3, _yR, THEME.zone2, 0.35, 'zone-2', false);
            _addRoof(_x1-_dX2, _x1-_dX3,  hL-_dZ2,  hL-_dZ3, _yR, THEME.zone2, 0.35, 'zone-2', false);
          }

          /* Zone 3 — L-shapes at 4 corners */
          let _lbl3 = !_lbl.z3; _lbl.z3 = true;
          _addRoof(_x0,      _x0+_dX3, -hL, -hL+_dZ2, _yR, THEME.zone3, 0.65, 'zone-3', _lbl3);
          _lbl3 = false;
          _addRoof(_x0+_dX3, _x0+_dX2, -hL, -hL+_dZ3, _yR, THEME.zone3, 0.65, 'zone-3', false);
          _addRoof(_x1-_dX3, _x1,      -hL, -hL+_dZ2, _yR, THEME.zone3, 0.65, 'zone-3', false);
          _addRoof(_x1-_dX2, _x1-_dX3, -hL, -hL+_dZ3, _yR, THEME.zone3, 0.65, 'zone-3', false);
          _addRoof(_x0,      _x0+_dX3, hL-_dZ2, hL, _yR, THEME.zone3, 0.65, 'zone-3', false);
          _addRoof(_x0+_dX3, _x0+_dX2, hL-_dZ3, hL, _yR, THEME.zone3, 0.65, 'zone-3', false);
          _addRoof(_x1-_dX3, _x1,      hL-_dZ2, hL, _yR, THEME.zone3, 0.65, 'zone-3', false);
          _addRoof(_x1-_dX2, _x1-_dX3, hL-_dZ3, hL, _yR, THEME.zone3, 0.65, 'zone-3', false);
        }
      }

      /* ── WALL ZONES (outer perimeter only, 4-corner Zone 5 logic) ─────── */
      const _zaWL = Math.min(zone_a, hL);         // zone strip in Z for side walls
      const _zaWX = Math.min(zone_a, _Wt / 2);    // zone strip in X for end walls

      /* Left outer wall (x = −Wt/2, normal −X) */
      { const _hH = _secs[0].h * _HS, _xW = -_Wt/2 - _EPS;
        _addWall([new THREE.Vector3(_xW,0,-hL),      new THREE.Vector3(_xW,0,-hL+_zaWL),
                  new THREE.Vector3(_xW,_hH,-hL+_zaWL), new THREE.Vector3(_xW,_hH,-hL)], 'zone-5', _Z5OP);
        _addWall([new THREE.Vector3(_xW,0,hL-_zaWL), new THREE.Vector3(_xW,0,hL),
                  new THREE.Vector3(_xW,_hH,hL),      new THREE.Vector3(_xW,_hH,hL-_zaWL)], 'zone-5', _Z5OP);
        if (2*_zaWL < 2*hL - 0.1)
          _addWall([new THREE.Vector3(_xW,0,-hL+_zaWL), new THREE.Vector3(_xW,0,hL-_zaWL),
                    new THREE.Vector3(_xW,_hH,hL-_zaWL), new THREE.Vector3(_xW,_hH,-hL+_zaWL)], 'zone-4', _Z4OP);
      }

      /* Right outer wall (x = +Wt/2, normal +X) */
      { const _hH = _secs[_secs.length-1].h * _HS, _xW = _Wt/2 + _EPS;
        _addWall([new THREE.Vector3(_xW,0,hL-_zaWL), new THREE.Vector3(_xW,0,hL),
                  new THREE.Vector3(_xW,_hH,hL),      new THREE.Vector3(_xW,_hH,hL-_zaWL)], 'zone-5', _Z5OP);
        _addWall([new THREE.Vector3(_xW,0,-hL),      new THREE.Vector3(_xW,0,-hL+_zaWL),
                  new THREE.Vector3(_xW,_hH,-hL+_zaWL), new THREE.Vector3(_xW,_hH,-hL)], 'zone-5', _Z5OP);
        if (2*_zaWL < 2*hL - 0.1)
          _addWall([new THREE.Vector3(_xW,0,-hL+_zaWL), new THREE.Vector3(_xW,0,hL-_zaWL),
                    new THREE.Vector3(_xW,_hH,hL-_zaWL), new THREE.Vector3(_xW,_hH,-hL+_zaWL)], 'zone-4', _Z4OP);
      }

      /* Front (z=+hL) and back (z=−hL) walls — per section height */
      for (const _face of ['front', 'back']) {
        const _z = _face === 'front' ? hL + _EPS : -hL - _EPS;
        const _xZ5L = -_Wt/2 + _zaWX, _xZ5R = _Wt/2 - _zaWX;
        for (let i = 0; i < _secs.length; i++) {
          const _x0 = _xL[i], _x1 = _xL[i+1], _hH = _secs[i].h * _HS;
          /* Zone 5 — left corner strip */
          if (_x0 < _xZ5L)
            _addWall([new THREE.Vector3(_x0,0,_z),              new THREE.Vector3(Math.min(_x1,_xZ5L),0,_z),
                      new THREE.Vector3(Math.min(_x1,_xZ5L),_hH,_z), new THREE.Vector3(_x0,_hH,_z)], 'zone-5', _Z5OP);
          /* Zone 5 — right corner strip */
          if (_x1 > _xZ5R)
            _addWall([new THREE.Vector3(Math.max(_x0,_xZ5R),0,_z), new THREE.Vector3(_x1,0,_z),
                      new THREE.Vector3(_x1,_hH,_z),              new THREE.Vector3(Math.max(_x0,_xZ5R),_hH,_z)], 'zone-5', _Z5OP);
          /* Zone 4 — middle field */
          const _x04 = Math.max(_x0,_xZ5L), _x14 = Math.min(_x1,_xZ5R);
          if (_x04 < _x14)
            _addWall([new THREE.Vector3(_x04,0,_z), new THREE.Vector3(_x14,0,_z),
                      new THREE.Vector3(_x14,_hH,_z), new THREE.Vector3(_x04,_hH,_z)], 'zone-4', _Z4OP);
        }
      }

      /* Step faces (normal +X, at section junctions) */
      for (let i = 0; i < _secs.length - 1; i++) {
        const _xS  = _xL[i+1] + _EPS;
        const _hLo = _secs[i].h * _HS, _hHi = _secs[i+1].h * _HS;
        _addWall([new THREE.Vector3(_xS,_hLo, hL), new THREE.Vector3(_xS,_hLo,-hL),
                  new THREE.Vector3(_xS,_hHi,-hL), new THREE.Vector3(_xS,_hHi, hL)], 'zone-4', _Z4OP);
      }

      /* ── Zone card labels for wall zones 4 and 5 ───────────────────── */
      { const _nWL = new THREE.Vector3(-1, 0, 0);
        this._makeZoneLabelFlat('zone-5',
          new THREE.Vector3(-_Wt/2 - _EPS - 0.3, _secs[0].h * _HS * 0.35, -hL + _zaWL * 0.5),
          _nWL, _nWL);
        if (2*_zaWL < 2*hL - 0.1)
          this._makeZoneLabelFlat('zone-4',
            new THREE.Vector3(-_Wt/2 - _EPS - 0.3, _secs[0].h * _HS * 0.35, 0),
            _nWL, _nWL);
      }

    } else {
      /* gable or flat — pitch selects the descriptor */
      const _leftNorm  = this._leftNormal(hB, hEave, hRidge, hL);
      const _rightNorm = new THREE.Vector3(-_leftNorm.x, _leftNorm.y, _leftNorm.z);
      const key = theta > 27 ? 'cc-gable-steep'
                : theta > 7  ? 'cc-gable-mid'
                :               'cc-gable-flat';
      const desc = window.ZONE_DESCRIPTORS[key];
      if (desc) {
        desc.drawZones({ ...ctx, ptFn: this._ptL.bind(this), norm: _leftNorm,  doLabel: true  });
        desc.drawZones({ ...ctx, ptFn: this._ptR.bind(this), norm: _rightNorm, doLabel: false });
      }
    }
    /* ── Wall C&C zones 4 and 5 (ASCE 7-22 §30.3-2A) ──────────────────────────
       Zone 5: vertical end strip width 'a' at each corner of every facade
       Zone 4: rest of wall field
       Drawn as flat quads offset 0.05 ft from each wall face.              */
    const _isFreeRoof3D = ['monoslope-free','pitched-free','troughed-free'].indexOf(_shape) !== -1;
    if (_shape !== 'stepped' && !_isFreeRoof3D) {
      this._drawWallZones(B, L, hEave, hRidge, zone_a, matZ, _shape);
    }

    // Collect opaque building meshes for per-frame label occlusion raycasting
    this._buildingMeshes = [];
    this._building.traverse(obj => { if (obj.isMesh) this._buildingMeshes.push(obj); });

    this._scene.add(this._building);
    this._scene.add(this._zones);
    this._scene.add(this._dimGroup);
    this._scene.add(this._labelGroup);

    // reframe camera
    const _camW = (_shape === 'stepped' && steppedOpts)
      ? ((steppedOpts.W1||20) + (steppedOpts.W2||20) + (steppedOpts.W3||0)) : B;
    const _camH = (_shape === 'stepped' && steppedOpts) ? (steppedOpts.h1||h) : hEave;
    const span  = Math.max(_camW, L, h);
    this._controls.target.set(0, _camH * 0.6, 0);
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

  /* Highlight a zone from an external trigger (e.g. Summary row click).
     Toggle: clicking the same zone again clears the highlight.            */
  highlightZone(zoneType) {
    if (this._activeZone) {
      this._zoneMeshes.filter(m => m.userData.zoneType === this._activeZone)
        .forEach(m => { if (m.material._baseOp != null) m.material.opacity = m.material._baseOp; });
    }
    this._activeZone = (zoneType === this._activeZone) ? null : (zoneType || null);
    if (this._activeZone) {
      this._zoneMeshes.filter(m => m.userData.zoneType === this._activeZone)
        .forEach(m => {
          if (m.material._baseOp == null) m.material._baseOp = m.material.opacity;
          m.material.opacity = Math.min(0.95, m.material._baseOp * 2.2);
        });
    }
  }

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
        .forEach(m => { m.material.opacity /= 0.65; });
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
