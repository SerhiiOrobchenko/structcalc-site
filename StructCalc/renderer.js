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
   COLOUR PALETTE — engineering blueprint on dark background
   ========================================================================= */
const THEME = {
  bg         : 0x0f1626,   // navy-900  — scene background
  fog        : 0x0f1626,
  grid1      : 0x1c2c4a,   // navy-700  — major grid lines
  grid2      : 0x16213a,   // navy-800  — minor grid lines
  gnd        : 0x111827,   // ground plane

  wallFill   : 0xdceef8,   // pale blue — wall faces (near-opaque blocks back edges)
  wallEdge   : 0x7bafd4,   // edge outlines on dark bg
  roofFill   : 0x38bdf8,   // sky blue
  roofEdge   : 0x7dd3fc,
  gableFill  : 0x93c5fd,
  gableEdge  : 0x7bafd4,
  ridge      : 0xe2e8f0,   // bright ridge line

  dimLine    : 0x475569,   // default dim colour
  dimActive  : 0x06b6d4,   // cyan highlight on hover/focus
  dimExt     : 0x334155,   // extension line (dashed, darker)
  dimText    : '#e2e8f0',
  dimBg      : 'rgba(15,22,38,0.88)',

  zone1      : 0x22d3ee,   // cyan   — interior field
  zone2      : 0xf59e0b,   // amber  — edges
  zone3      : 0xef4444,   // red    — corners
  zoneLabel1 : { bg:'rgba(6,182,212,0.82)',  fg:'#fff' },
  zoneLabel2 : { bg:'rgba(217,119,6,0.85)',  fg:'#fff' },
  zoneLabel3 : { bg:'rgba(220,38,38,0.85)',  fg:'#fff' },
};

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
    this._zoneMeshes  = [];
    this._dimHighlight = {};    // dimId → { lines, labelEl }
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
    if (this._labelRenderer) this._labelRenderer.render(this._scene, this._camera);
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
      color:c, transparent:true, opacity:0.96, side:THREE.FrontSide,
    });
    const edgeMat = c => new THREE.LineBasicMaterial({ color:c });

    // -- walls (solid near-opaque: depth buffer hides back edges)
    const boxGeo = new THREE.BoxGeometry(B, hEave, L);
    boxGeo.translate(0, hEave/2, 0);
    const wall = new THREE.Mesh(boxGeo, solidMat(THEME.wallFill));
    wall.castShadow = true;
    grp.add(wall);
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat(THEME.wallEdge)));

    // -- gable triangles
    for (const zs of [-1, 1]) {
      const z = zs * hL;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -hB,hEave,z,  hB,hEave,z,  0,hRidge,z,
      ]), 3));
      geo.computeVertexNormals();
      grp.add(new THREE.Mesh(geo, solidMat(THEME.gableFill)));
      grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat(THEME.gableEdge)));
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
      color:THEME.roofFill, transparent:true, opacity:0.80, side:THREE.DoubleSide,
    });
    for (const [g, mat] of [[leftGeo,roofSide],[rightGeo,roofSide.clone()]]) {
      const m = new THREE.Mesh(g, mat); m.castShadow=true; grp.add(m);
      grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat(THEME.roofEdge)));
    }

    // -- ridge
    grp.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, hRidge,-hL),
        new THREE.Vector3(0, hRidge, hL),
      ]),
      new THREE.LineBasicMaterial({ color: THEME.ridge, linewidth: 2 })
    ));

    return grp;
  }

  /* ── dimension system ───────────────────────────────────────────────────── */

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

    const mat    = () => new THREE.LineBasicMaterial({ color: THEME.dimLine });
    const extMat = () => new THREE.LineDashedMaterial({ color: THEME.dimExt, dashSize:1.5, gapSize:1.2 });

    // main dimension line
    const mainLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p1, p2]), mat()
    );
    grp.add(mainLine);

    // perpendicular tick marks at each end (length 3 ft each side)
    const td = tickDir.clone().normalize();
    for (const p of [p1, p2]) {
      grp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          p.clone().addScaledVector(td,  3),
          p.clone().addScaledVector(td, -3),
        ]), mat()
      ));
    }

    // extension lines (thin dashed)
    for (const [a, b] of extLines) {
      const el = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]), extMat()
      );
      el.computeLineDistances();
      grp.add(el);
    }

    // CSS2D label
    let labelEl = null;
    if (THREE.CSS2DObject) {
      const div = document.createElement('div');
      div.textContent = text;
      div.style.cssText = [
        'font-family:"JetBrains Mono",monospace',
        'font-size:11px',
        'font-weight:600',
        'color:' + THEME.dimText,
        'background:' + THEME.dimBg,
        'padding:2px 8px',
        'border-radius:4px',
        'border:1px solid #334155',
        'white-space:nowrap',
        'pointer-events:' + (inputId ? 'auto' : 'none'),
        inputId ? 'cursor:pointer' : '',
      ].join(';');
      if (inputId) {
        div.title = 'Click to edit ' + dimId.replace('dim-','');
        div.addEventListener('click', () => {
          const el = document.getElementById(inputId);
          if (el) { el.focus(); el.select(); }
        });
      }
      const obj = new THREE.CSS2DObject(div);
      obj.position.copy(p1).lerp(p2, 0.5);  // label at midpoint
      grp.add(obj);
      labelEl = div;
    }

    // Store lines for colour toggling
    grp.userData.lines    = grp.children.filter(c => c.isLine);
    grp.userData.labelEl  = labelEl;
    return grp;
  }

  _buildAllDims(B, L, hEave, hRidge, zone_a) {
    const hB = B/2, hL = L/2;
    const grp = new THREE.Group();
    const D   = Math.max(10, Math.max(B, L) * 0.12); // offset from building face

    // ── B (Width) — front face, at ground, parallel to X ──────────────────
    const bZ = -hL - D;
    grp.add(this._buildDim(
      new THREE.Vector3(-hB, 0, bZ),
      new THREE.Vector3( hB, 0, bZ),
      new THREE.Vector3(0, 1, 0),           // tick: vertical
      [                                       // extension lines
        [new THREE.Vector3(-hB, 0, -hL), new THREE.Vector3(-hB, 0, bZ)],
        [new THREE.Vector3( hB, 0, -hL), new THREE.Vector3( hB, 0, bZ)],
      ],
      `B = ${B.toFixed(1)} ft`, 'dim-B', 'inp-B'
    ));
    this._dimHighlight['dim-B'] = grp.children[grp.children.length - 1];

    // ── L (Length) — right face, at ground, parallel to Z ─────────────────
    const lX = hB + D;
    grp.add(this._buildDim(
      new THREE.Vector3(lX, 0, -hL),
      new THREE.Vector3(lX, 0,  hL),
      new THREE.Vector3(1, 0, 0),           // tick: along X
      [
        [new THREE.Vector3(hB, 0, -hL), new THREE.Vector3(lX, 0, -hL)],
        [new THREE.Vector3(hB, 0,  hL), new THREE.Vector3(lX, 0,  hL)],
      ],
      `L = ${L.toFixed(1)} ft`, 'dim-L', 'inp-L'
    ));
    this._dimHighlight['dim-L'] = grp.children[grp.children.length - 1];

    // ── h (Height) — left back corner, vertical ────────────────────────────
    const hX = -hB - D;
    const hZv = -hL - D * 0.6;
    grp.add(this._buildDim(
      new THREE.Vector3(hX, 0,       hZv),
      new THREE.Vector3(hX, hRidge,  hZv),
      new THREE.Vector3(-1, 0, 0),          // tick: horizontal X
      [
        [new THREE.Vector3(-hB, 0,      -hL), new THREE.Vector3(hX, 0,      hZv)],
        [new THREE.Vector3(-hB, hRidge,   0), new THREE.Vector3(hX, hRidge, hZv)],
      ],
      `h = ${hRidge.toFixed(1)} ft`, 'dim-h', 'inp-h'
    ));
    this._dimHighlight['dim-h'] = grp.children[grp.children.length - 1];

    // ── a (Zone width) — inner sub-dim below B dim ─────────────────────────
    const aZ = bZ - D * 0.55;
    grp.add(this._buildDim(
      new THREE.Vector3(-hB,          0, aZ),
      new THREE.Vector3(-hB + zone_a, 0, aZ),
      new THREE.Vector3(0, 1, 0),
      [
        [new THREE.Vector3(-hB,          0, bZ), new THREE.Vector3(-hB,          0, aZ)],
        [new THREE.Vector3(-hB + zone_a, 0, bZ), new THREE.Vector3(-hB + zone_a, 0, aZ)],
      ],
      `a = ${zone_a.toFixed(1)} ft`, 'dim-a', null
    ));
    this._dimHighlight['dim-a'] = grp.children[grp.children.length - 1];

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

  /* ── public API ─────────────────────────────────────────────────────────── */

  /**
   * Rebuild 3D model from ASCE 7-22 parameters.
   * @param {number} B       Building width, ft  (cross-wind)
   * @param {number} L       Building length, ft (along-wind)
   * @param {number} h       Ridge height, ft
   * @param {number} theta   Roof pitch, degrees
   * @param {number} zone_a  ASCE 7-22 §26.2 edge dimension, ft
   */
  update3DModel(B, L, h, theta, zone_a) {
    B = +B||48; L = +L||80; h = +h||22; theta = +theta||10; zone_a = +zone_a||4;

    const th    = THREE.MathUtils.degToRad(theta);
    const hB    = B/2, hL = L/2;
    const hEave = Math.max(1, h - hB * Math.tan(th));
    const hRidge = h;

    // clear
    for (const g of [this._building, this._zones, this._dimGroup, this._labelGroup]) {
      if (g) { this._scene.remove(g); disposeGroup(g); }
    }
    this._building    = new THREE.Group();
    this._zones       = new THREE.Group();
    this._dimGroup    = new THREE.Group();
    this._labelGroup  = new THREE.Group();
    this._zoneMeshes  = [];
    this._dimHighlight = {};

    // building
    this._building = this._buildStructure(B, L, hEave, hRidge);

    // dim lines
    this._dimGroup = this._buildAllDims(B, L, hEave, hRidge, zone_a);

    // zones
    const u_zone = Math.min(zone_a / hB, 0.45);
    const v_zone = Math.min(zone_a / L,  0.45);
    const u1 = 1 - u_zone, v1 = 1 - v_zone;

    const matZ = (col, op) => new THREE.MeshBasicMaterial({
      color:col, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false,
    });

    const leftNorm  = this._leftNormal(hB, hEave, hRidge, hL);
    const rightNorm = new THREE.Vector3(-leftNorm.x, leftNorm.y, leftNorm.z);

    for (const [ptFn, norm] of [
      [this._ptL.bind(this), leftNorm],
      [this._ptR.bind(this), rightNorm],
    ]) {
      const addZ = (u0,uu1,v0,vv1,col,op,zt,eps,label) => {
        const m = this._zoneQuad(u0,uu1,v0,vv1,ptFn,hB,hEave,hRidge,hL,norm,eps,matZ(col,op),zt);
        this._zones.add(m);
        this._zoneMeshes.push(m);
        if (label) {
          const ctr = this._zoneCentroid(u0,uu1,v0,vv1,ptFn,hB,hEave,hRidge,hL);
          ctr.addScaledVector(norm, eps + 0.5);
          this._makeZoneLabel(zt, ctr, norm, hB, zone_a, L);
        }
      };

      // Zone 1 — interior field
      addZ(u_zone,u1, v_zone,v1, THEME.zone1,0.20,'zone-1',0.02,true);
      // Zone 2 — four edge strips
      addZ(0,     u_zone, v_zone,v1, THEME.zone2,0.35,'zone-2',0.07,true);
      addZ(u1,    1,      v_zone,v1, THEME.zone2,0.35,'zone-2',0.07,false);
      addZ(u_zone,u1,     0,v_zone,  THEME.zone2,0.35,'zone-2',0.07,false);
      addZ(u_zone,u1,     v1,1,      THEME.zone2,0.35,'zone-2',0.07,false);
      // Zone 3 — four corners
      addZ(0,u_zone,  0,v_zone,  THEME.zone3,0.50,'zone-3',0.12,true);
      addZ(0,u_zone,  v1,1,      THEME.zone3,0.50,'zone-3',0.12,false);
      addZ(u1,1,      0,v_zone,  THEME.zone3,0.50,'zone-3',0.12,false);
      addZ(u1,1,      v1,1,      THEME.zone3,0.50,'zone-3',0.12,false);
    }

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
    if (dg.userData.labelEl) {
      const el = dg.userData.labelEl;
      el.style.color      = active ? '#fff'               : THEME.dimText;
      el.style.background = active ? 'rgba(6,182,212,.92)': THEME.dimBg;
      el.style.border     = active ? '1px solid #0891b2'  : '1px solid #334155';
    }
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
    this._raycaster.setFromCamera(ndc, this._camera);
    return this._raycaster.intersectObjects(this._zoneMeshes);
  }

  _handleClick(e) {
    const hits = this._hitZones(this._ndc(e));
    if (hits.length > 0 && this._clickCB) {
      this._clickCB(hits[0].object.userData.zoneType);
    }
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

  /* ── cleanup ────────────────────────────────────────────────────────────── */
  dispose() {
    cancelAnimationFrame(this._animId);
    window.removeEventListener('resize', this._onResize);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    this._renderer.dispose();
    [this._renderer.domElement, this._labelRenderer?.domElement]
      .filter(Boolean).forEach(el => el.parentNode?.removeChild(el));
    [this._building, this._zones, this._dimGroup, this._labelGroup]
      .filter(Boolean).forEach(disposeGroup);
  }
}

/* ── utility ──────────────────────────────────────────────────────────────── */
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
  });
}
