/* =====================================================================
   StructCalc — wind-workspace.js
   Responsibility: ASCE 7-22 Wind 3-column workspace — Three.js renderer,
                   engine bridge, input wiring, results display.
   Depends on: projects.js, workspace.js (loaded before)
   Rule: edit only for wind workspace UI/results/3D changes.
   ===================================================================== */

var windScriptsLoaded = false;
var windEngineLoaded  = false;
var windRenderer      = null;
var windActiveProj    = null;
var windActiveCalc    = null;
var windSavedState    = null;

function loadScriptTag(src) {
  return new Promise(function(resolve, reject) {
    for (var i = 0; i < document.scripts.length; i++) {
      var s = document.scripts[i];
      if (s.src === src || s.src.endsWith('/' + src.split('/').pop())) { resolve(); return; }
    }
    var script = document.createElement('script');
    script.src = src;
    script.onload  = resolve;
    script.onerror = function(){ reject(new Error('Script load failed: ' + src)); };
    document.head.appendChild(script);
  });
}

async function loadWindScripts() {
  if (windScriptsLoaded) return;
  await loadScriptTag('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
  await loadScriptTag('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
  await loadScriptTag('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/renderers/CSS2DRenderer.js');
  await loadScriptTag('renderer.js?v=11');
  await loadScriptTag('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  await loadScriptTag('map-module.js?v=3');
  windScriptsLoaded = true;
}

async function loadWindEngine() {
  if (windEngineLoaded) return;
  window._wsShellMode = true;
  await loadScriptTag('../ASCE 7-22 Wind Load Calculator/engine.js');
  windEngineLoaded = true;
}

/* ── Input map ─────────────────────────────────────────────────────────── */
var WIND_INPUT_MAP = {
  'wind-h':               'h',
  'wind-B':               'minDim',
  'wind-L':               'buildingL',
  'wind-theta':           'theta',
  'wind-roofShape':       'roofShape',
  'wind-steppedLowerH':   'steppedLowerH',
  'wind-steppedLowerW':   'steppedLowerW',
  'wind-msModuleW':       'msModuleW',
  'wind-swModuleW':       'swModuleW',
  'wind-domeD':           'domeD',
  'wind-domeF':           'domeF',
  'wind-domeHD':          'domeHD',
  'wind-V':               'V',
  'wind-exposure':        'exposure',
  'wind-kzt':             'kzt',
  'wind-groundElev':      'groundElev',
  'wind-enclosure':       'enclosure',
  'wind-riskCategory':    'riskCategory',
  'wind-areaWall':        'areaWall',
  'wind-areaRoof':        'areaRoof',
  'wind-gMode':           'gMode',
  'wind-structureCategory': 'structureCategory',
  'wind-hp':              'hp',
  'wind-wo':              'wo',
  'wind-Vt':              'Vt',
  'wind-areaEff':         'areaEff',
  'wind-zone':            'zone',
  'wind-surface':         'surface',
  'wind-kztH':            'kztH',
  'wind-kztLh':           'kztLh',
  'wind-kztX':            'kztX',
  'wind-kztZ':            'kztZ',
  /* Other structure params */
  'wind-otherType':       'ch29Type',
  'ws-ch29B':             'ch29B',
  'ws-ch29H':             'ch29H',
  'ws-ch29S':             'ch29S',
  'ws-ch29As':            'ch29As',
  'ws-ch29Af':            'ch29Af',
  'ws-ch29Ar':            'ch29Ar',
  'ws-ch29Bh':            'ch29Bh',
  'ws-ch29BL':            'ch29BL',
  'ws-ch29GsOmega':       'ch29GsOmega',
  'ws-ch29GsLc':          'ch29GsLc',
  'ws-ch29GsWg':          'ch29GsWg',
  'ws-ch29GsS':           'ch29GsS',
  'ws-ch29GsH1':          'ch29SolarH1',
  'ws-ch29GsH2':          'ch29SolarH2',
  'ws-ch29GsWL':          'ch29SolarWL',
  'ws-ch29GsWs':          'ch29SolarWs',
  'ws-ch29GsA':           'ch29GsA',
  'ws-tankD':             'tankD',
  'ws-tankH':             'tankH',
};

function gatherWindState(base) {
  var s = Object.assign({}, base || {});
  var defs = {
    unitSystem:'US', mode:'mwfrs', roofType:'sloped',
    h:60, minDim:40, buildingL:72, theta:15, roofShape:'gable',
    exposure:'C', kzt:1.0, kztMode:'manual',
    groundElev:0, enclosure:'enclosed', riskCategory:'II',
    areaWall:20, areaRoof:50, areaEff:20,
    mwfrsProcedure:'envelope', ccProcedure:'part1',
    hasOverhang:false, hasParapet:false, hasCanopy:false,
    hasCircularTank:false, hasSteppedRoof:false, hasMultispanRoof:false,
    hasSawtoothRoof:false, hasDomeRoof:false, hasMonoslopeRoof:false,
    ch32Enabled:false, structureCategory:'building',
    gMode:'rigid', hp:3, wo:2, Vt:0,
    zone:'1', surface:'roof',
  };
  Object.keys(defs).forEach(function(k){ if (s[k] === undefined) s[k] = defs[k]; });
  Object.entries(WIND_INPUT_MAP).forEach(function(entry) {
    var elId = entry[0], key = entry[1];
    var inp = document.getElementById(elId);
    if (!inp) return;
    var num = parseFloat(inp.value);
    s[key] = isNaN(num) ? inp.value : num;
  });
  var activeProc = document.querySelector('#windProcToggle button.active');
  if (activeProc) {
    var proc = activeProc.dataset.proc;
    if (proc === 'cc') { s.mode = 'cc'; }
    else { s.mode = 'mwfrs'; s.mwfrsProcedure = proc; }
  }
  /* Convert slope (X:12) to degrees if that unit mode is active */
  var pitchActiveBtn = document.querySelector('#pitchUnitToggle button.active');
  if (pitchActiveBtn && pitchActiveBtn.dataset.unit === 'slope') {
    s.theta = Math.atan(s.theta / 12) * 180 / Math.PI;
  }
  s.roofType = (s.theta <= 7 || s.roofShape === 'flat') ? 'flat' : 'sloped';
  if (s.roofShape === 'flat') s.theta = 0;
  var specialRoofs = ['stepped', 'multispan', 'sawtooth', 'dome'];
  s.hasSteppedRoof   = (s.roofShape === 'stepped');
  s.hasMultispanRoof = (s.roofShape === 'multispan');
  s.hasSawtoothRoof  = (s.roofShape === 'sawtooth');
  s.hasDomeRoof      = (s.roofShape === 'dome');
  s.hasMonoslopeRoof = (s.roofShape === 'monoslope');
  if (specialRoofs.indexOf(s.roofShape) !== -1) { s.roofType = 'flat'; }
  return s;
}

function restoreWindInputs(saved) {
  var revMap = {};
  Object.entries(WIND_INPUT_MAP).forEach(function(e){ revMap[e[1]] = e[0]; });
  Object.entries(saved).forEach(function(e) {
    var key = e[0], val = e[1];
    /* Skip V if it was never explicitly set by user (old default = 115) */
    if (key === 'V' && (val === 115 || val === '' || val === null)) return;
    var inp = document.getElementById(revMap[key]);
    if (inp) inp.value = val;
  });
  if (saved.mode === 'cc') { setWindProc('cc'); activateInputTab('geometry'); }
  else if (saved.mwfrsProcedure) { setWindProc(saved.mwfrsProcedure); }
}

function setWindProc(proc) {
  document.querySelectorAll('#windProcToggle button').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.proc === proc);
  });
}

/* ── Recalculate ───────────────────────────────────────────────────────── */
function recalcWind() {
  if (!windActiveProj || !windActiveCalc) return;
  var s = gatherWindState(windSavedState || {});
  var r = null;
  try { r = window.compute(s); } catch(e) { console.warn('Wind compute error', e); }

  var B  = s.minDim    || 40;
  var L  = s.buildingL || 60;
  var hE = s.h         || 20;
  var th = s.theta     || 0;
  var hR = (s.roofType === 'flat') ? hE : hE + (B / 2) * Math.tan(th * Math.PI / 180);
  var hMean = (s.roofType === 'flat') ? hE : (hE + hR) / 2;
  var za = (r && r.a) ? r.a : Math.min(0.1 * Math.min(B, L), Math.min(0.4 * hE, 0.04 * Math.min(B, L)));

  /* Update mean roof height display */
  var hMeanEl = document.getElementById('hMeanDisplay');
  if (hMeanEl) hMeanEl.value = hMean.toFixed(1);

  /* Procedure auto-lock: h > 60ft OR h > min(B,L) → Directional only */
  var lockDir = (hMean > 60) || (hMean > Math.min(B, L));
  setVisible('procLockNotice', lockDir);
  if (lockDir) {
    var envBtn = document.querySelector('#windProcToggle button[data-proc="envelope"]');
    if (envBtn) { envBtn.disabled = true; envBtn.style.opacity = '.4'; }
    var activeBtn = document.querySelector('#windProcToggle button.active');
    if (activeBtn && activeBtn.dataset.proc === 'envelope') {
      document.querySelectorAll('#windProcToggle button').forEach(function(b){ b.classList.remove('active'); });
      var dirBtn = document.querySelector('#windProcToggle button[data-proc="directional"]');
      if (dirBtn) dirBtn.classList.add('active');
    }
  } else {
    var envBtn2 = document.querySelector('#windProcToggle button[data-proc="envelope"]');
    if (envBtn2) { envBtn2.disabled = false; envBtn2.style.opacity = ''; }
  }

  /* K_e auto on first calc */
  wsComputeKe();

  // Renderer signature: update3DModel(B, L, ridgeHeight, thetaDegrees, zone_a, roofShape)
  var specialExtras = ['stepped', 'multispan', 'sawtooth', 'dome'];
  specialExtras.forEach(function(t) {
    var el = document.getElementById('ws-extra-' + t);
    if (el) el.classList.toggle('hidden', s.roofShape !== t);
  });
  var rendererShape = s.roofShape;
  if (s.roofShape === 'stepped' || s.roofShape === 'sawtooth' || s.roofShape === 'dome') rendererShape = 'flat';
  if (s.roofShape === 'multispan') rendererShape = 'gable';
  if (windRenderer) windRenderer.update3DModel(B, L, hR, th, za, rendererShape);

  var vDisp = document.getElementById('wind-V-display');
  if (vDisp) vDisp.textContent = s.V || '—';

  var cap = document.getElementById('windDiagramCaption');
  if (cap) {
    var sh = {gable:'Gable Roof',hip:'Hip Roof',flat:'Flat Roof',monoslope:'Monoslope Roof',stepped:'Stepped Roof',multispan:'Multispan Gable',sawtooth:'Sawtooth Roof',dome:'Domed Roof'};
    var pr = {envelope:'Envelope (Ch. 28)',directional:'Directional (Ch. 27)',cc:'C&C (Ch. 30)'};
    var pk = s.mode === 'cc' ? 'cc' : s.mwfrsProcedure;
    cap.textContent = (sh[s.roofShape] || 'Building') + ' — ' + (pr[pk] || '');
  }

  renderWindResults(r, s);

  /* Update step report & project summary */
  var reportEl = document.getElementById('windReportScroll');
  if (reportEl) reportEl.innerHTML = buildWindStepReport(r, s);
  renderProjectSummary(r, s);

  if (!windActiveCalc.state) windActiveCalc.state = {};
  windActiveCalc.state['ASCE 7-22'] = { state: s, unitSystem: s.unitSystem };
  windActiveProj.updatedAt = Date.now();
  scheduleSave();
  windSavedState = s;
}


/* ── Step-report helper: single numbered step block ─────────────────────── */
function stepBlock(n, title, ref, body) {
  return '<div class="step-block">' +
    '<div class="step-header">' +
    '<span class="step-num">' + n + '</span>' +
    '<span class="step-title">' + title + '</span>' +
    '<span class="step-ref">' + escHtml(ref) + '</span>' +
    '</div>' +
    '<div class="step-body">' + body + '</div>' +
    '</div>';
}

/* ── 2-D building elevation SVG ─────────────────────────────────────────── */
function buildElevationSVG(s) {
  var B  = Math.max(s.minDim    || 40, 1);
  var h  = Math.max(s.h         || 20, 1);
  var th = s.theta || 0;
  var shape = s.roofShape || 'gable';

  var svgW = 360, svgH = 160, mL = 70, mR = 20, mT = 14, mB = 24;
  var availW = svgW - mL - mR, availH = svgH - mT - mB;
  var ridgeH = (shape === 'flat') ? 0 : (B / 2) * Math.tan(th * Math.PI / 180);
  if (shape === 'monoslope') ridgeH = B * Math.tan(th * Math.PI / 180);
  var totalH = h + ridgeH;
  var scale  = Math.min(availW / B, availH / totalH) * 0.88;
  var drawW  = B * scale, wallH = h * scale, ridgeDrawH = ridgeH * scale;
  var left   = mL + (availW - drawW) / 2;
  var bot    = svgH - mB;
  var wallTop = bot - wallH;
  var ridgeY  = wallTop - ridgeDrawH;
  var ridgeX  = left + drawW / 2;
  var blue    = 'rgba(59,130,246,0.12)';
  var stroke  = '#3b82f6';
  var muted   = '#94a3b8';

  var d = '';
  // ground
  d += '<line x1="'+(left-8)+'" y1="'+bot+'" x2="'+(left+drawW+8)+'" y2="'+bot+'" stroke="'+muted+'" stroke-width="1.5"/>';
  // walls
  d += '<rect x="'+left+'" y="'+wallTop+'" width="'+drawW+'" height="'+wallH+'" fill="'+blue+'" stroke="'+stroke+'" stroke-width="1.5" stroke-linejoin="round"/>';
  // roof
  if (shape === 'flat') {
    d += '<line x1="'+left+'" y1="'+wallTop+'" x2="'+(left+drawW)+'" y2="'+wallTop+'" stroke="'+stroke+'" stroke-width="2"/>';
  } else if (shape === 'monoslope') {
    d += '<polyline points="'+left+','+ridgeY+' '+(left+drawW)+','+wallTop+'" fill="none" stroke="'+stroke+'" stroke-width="1.5"/>';
  } else {
    d += '<polyline points="'+left+','+wallTop+' '+ridgeX+','+ridgeY+' '+(left+drawW)+','+wallTop+'" fill="'+blue+'" stroke="'+stroke+'" stroke-width="1.5" stroke-linejoin="round"/>';
  }
  // wind arrow
  var aY = wallTop + wallH * 0.45;
  d += '<defs><marker id="warr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#22d3ee"/></marker></defs>';
  d += '<line x1="'+(left-48)+'" y1="'+aY+'" x2="'+(left-3)+'" y2="'+aY+'" stroke="#22d3ee" stroke-width="2" marker-end="url(#warr)"/>';
  d += '<text x="'+(left-52)+'" y="'+(aY+4)+'" fill="#22d3ee" font-size="10" font-family="sans-serif" text-anchor="end">Wind</text>';
  // dim: h
  d += '<line x1="'+(left-6)+'" y1="'+wallTop+'" x2="'+(left-6)+'" y2="'+bot+'" stroke="'+muted+'" stroke-width="0.8" stroke-dasharray="3,2"/>';
  d += '<line x1="'+(left-10)+'" y1="'+wallTop+'" x2="'+(left-2)+'" y2="'+wallTop+'" stroke="'+muted+'" stroke-width="1"/>';
  d += '<line x1="'+(left-10)+'" y1="'+bot+'" x2="'+(left-2)+'" y2="'+bot+'" stroke="'+muted+'" stroke-width="1"/>';
  var hV = h % 1 === 0 ? h.toFixed(0) : h.toFixed(1);
  d += '<text x="'+(left-9)+'" y="'+((wallTop+bot)/2+4)+'" fill="'+muted+'" font-size="9.5" font-family="sans-serif" text-anchor="end">h='+hV+' ft</text>';
  // dim: B
  d += '<line x1="'+left+'" y1="'+(bot+10)+'" x2="'+(left+drawW)+'" y2="'+(bot+10)+'" stroke="'+muted+'" stroke-width="0.8"/>';
  var bV = B % 1 === 0 ? B.toFixed(0) : B.toFixed(1);
  d += '<text x="'+(left+drawW/2)+'" y="'+(bot+20)+'" fill="'+muted+'" font-size="9.5" font-family="sans-serif" text-anchor="middle">B='+bV+' ft</text>';
  // theta
  if (shape !== 'flat' && th > 0.5) {
    var thV = th.toFixed(1);
    d += '<text x="'+(ridgeX+5)+'" y="'+(wallTop-5)+'" fill="'+muted+'" font-size="9" font-family="sans-serif">&theta;='+thV+'&deg;</text>';
  }
  // labels
  d += '<text x="'+(left+4)+'" y="'+(bot-4)+'" fill="'+muted+'" font-size="8.5" font-family="sans-serif">Windward</text>';
  d += '<text x="'+(left+drawW-4)+'" y="'+(bot-4)+'" fill="'+muted+'" font-size="8.5" font-family="sans-serif" text-anchor="end">Leeward</text>';

  return '<svg viewBox="0 0 '+svgW+' '+svgH+'" width="100%" xmlns="http://www.w3.org/2000/svg">'+d+'</svg>';
}

/* ── Project Summary (left panel, Results tab) ─────────────────────────── */
function renderProjectSummary(r, s) {
  var host = document.getElementById('windProjSummaryBody');
  if (!host) return;
  if (!s) { host.innerHTML = '<div style="padding:14px;font-size:.78rem;color:var(--text-muted);">Enter building parameters.</div>'; return; }
  function row(k, v) { return '<div class="proj-sum-row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>'; }
  var encMap = {enclosed:'Enclosed',partiallyEnclosed:'Part. Enclosed',partiallyOpen:'Part. Open',open:'Open'};
  var procMap = {envelope:'MWFRS Env (Ch.28)',directional:'MWFRS Dir (Ch.27)',cc:'C&C (Ch.30)'};
  var proc = s.mode === 'cc' ? 'cc' : (s.mwfrsProcedure || 'envelope');
  var addrEl = document.getElementById('wind-address');
  var addr = addrEl ? addrEl.value.trim() : '';
  var html = '';
  if (addr) {
    html += '<div class="proj-sum-card"><div class="proj-sum-card-title">Location</div>' +
      '<div style="font-size:.77rem;color:var(--text-primary);word-break:break-word;">'+escHtml(addr)+'</div></div>';
  }
  html += '<div class="proj-sum-card"><div class="proj-sum-card-title">Site Parameters</div>' +
    row('Basic Wind Speed V', (s.V ? s.V+' mph' : '<span class="proj-sum-not-set">not set</span>')) +
    row('Risk Category', escHtml(s.riskCategory || '—')) +
    row('Exposure Category', escHtml(s.exposure || '—')) +
    row('Ground Elevation', (s.groundElev || 0)+' ft AMSL') +
    row('K<sub>zt</sub>', r ? (r.kh ? (s.kzt||1.0).toFixed(3) : '—') : '—') +
    '</div>';
  var B = s.minDim||40, L = s.buildingL||60, h = s.h||20, th = s.theta||0;
  var roofNames = {gable:'Gable',hip:'Hip',flat:'Flat',monoslope:'Monoslope',stepped:'Stepped',multispan:'Multispan',sawtooth:'Sawtooth',dome:'Dome'};
  html += '<div class="proj-sum-card"><div class="proj-sum-card-title">Building Geometry</div>' +
    row('Width B', B+' ft') + row('Length L', L+' ft') + row('Eave Height h', h+' ft') +
    row('Roof Shape', escHtml(roofNames[s.roofShape]||s.roofShape||'—')) +
    (s.roofShape !== 'flat' ? row('Roof Pitch &theta;', th.toFixed(1)+'°') : '') +
    '</div>';
  html += '<div class="proj-sum-card"><div class="proj-sum-card-title">Calculation</div>' +
    row('Procedure', escHtml(procMap[proc]||proc)) +
    row('Enclosure', escHtml(encMap[s.enclosure]||s.enclosure||'—')) +
    (r ? row('q<sub>h</sub>', r.qh ? r.qh.toFixed(2)+' psf' : '—') : '') +
    (r && r.kh ? row('K<sub>h</sub>', r.kh.toFixed(3)) : '') +
    (r && r.ke ? row('K<sub>e</sub>', r.ke.toFixed(3)) : '') +
    '</div>';
  host.innerHTML = html;
}

/* ── Ch.27 Directional Step Report — Table 27.2-1 (8 steps) ─────────── */
function buildWindStepReport(r, s) {
  function fv(v, d) { return (typeof v === 'number') ? v.toFixed(d != null ? d : 2) : '—'; }
  function fpf(v)   { return fv(v) + ' psf'; }
  function warn(msg) {
    return '<div class="report-warn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>' + msg + '</span></div>';
  }
  if (!s || !s.V || s.V <= 0) return warn('Enter the basic wind speed V on the <strong>Site</strong> tab.');
  if (!s.h || s.h <= 0)       return warn('Enter the building eave height h on the <strong>Geometry</strong> tab.');

  var proc = s.mode === 'cc' ? 'cc' : (s.mwfrsProcedure || 'envelope');
  if (proc !== 'directional') {
    return warn('This panel shows <strong>MWFRS Directional (Ch. 27)</strong>. Switch procedure above to see the full step-by-step calculation.') +
      '<p style="font-size:.78rem;color:var(--text-muted);padding:4px 2px;line-height:1.55;">Reports for MWFRS Envelope (Ch. 28) and C&amp;C (Ch. 30) — coming soon.</p>';
  }
  if (!r || !r.ch27) return warn('Calculation error — please check your inputs.');

  var c   = r.ch27;
  var B   = c.B, L = c.L, h = s.h, th = s.theta || 0;
  var encMap = {enclosed:'Enclosed', partiallyEnclosed:'Partially Enclosed', partiallyOpen:'Partially Open', open:'Open', openFreeRoof:'Open (Free Roof)'};
  var encLabel = encMap[s.enclosure] || s.enclosure;
  var roofNames = {gable:'Gable', hip:'Hip', flat:'Flat', monoslope:'Monoslope', stepped:'Stepped', multispan:'Multispan Gable', sawtooth:'Sawtooth', dome:'Domed'};
  var roofLabel = roofNames[s.roofShape] || s.roofShape || '—';
  var addrEl = document.getElementById('wind-address');
  var addr   = addrEl ? addrEl.value.trim() : '';
  var html   = '';

  /* ---- Header ------------------------------------------------------------- */
  html += '<div class="report-proc-head">';
  html += '<div class="report-proc-title">MWFRS — Directional Procedure</div>';
  html += '<div class="report-proc-sub">ASCE 7-22 Chapter 27 — Wind Loads on Buildings of All Heights — ' + escHtml(encLabel) + ' Building</div>';
  if (addr) html += '<div style="font-size:.73rem;color:var(--text-muted);margin-top:3px;">&#128205; ' + escHtml(addr) + '</div>';
  html += '</div>';

  /* Building elevation sketch */
  html += '<div class="report-bldg-sketch">' + buildElevationSVG(s) + '</div>';

  /* Reference caption */
  html += '<p style="font-size:.72rem;color:var(--text-muted);text-align:center;margin:-4px 0 14px;">Procedure per Table 27.2-1, ASCE 7-22</p>';

  /* ==== STEP 1: Risk Category ============================================== */
  var rcFig = {I:'26.5-1A', II:'26.5-1B', III:'26.5-1B', IV:'26.5-1C'}[s.riskCategory] || '26.5-1B';
  html += stepBlock(1,
    'Determine Risk Category of the building',
    '&#167;Table 1.5-1',
    '<p>Risk Category: <strong class="step-result">' + escHtml(s.riskCategory||'II') + '</strong></p>'
  );

  /* ==== STEP 2: Basic Wind Speed V ========================================= */
  html += stepBlock(2,
    'Determine basic wind speed V for the applicable risk category',
    '&#167;26.5, Fig. ' + rcFig,
    '<div class="step-formula">V = <span class="step-result">' + fv(s.V, 0) + ' mph</span></div>' +
    '<p class="step-sub">Risk Category ' + escHtml(s.riskCategory||'II') + ' — Figure ' + rcFig + '</p>'
  );

  /* ==== STEP 3: Wind Load Parameters ======================================= */
  var expDesc = {B:'Suburban or wooded areas (Sec. 26.7)', C:'Open terrain with scattered obstructions (Sec. 26.7)', D:'Flat, unobstructed areas near water (Sec. 26.7)'}[s.exposure] || '';
  var kztV = s.kzt || 1.0;
  var kztNote = s.kztMode === 'auto'
    ? 'K<sub>zt</sub> = (1 + K&#x2081;K&#x2082;K&#x2083;)&#xB2; computed from hill geometry (Fig. 26.8-1).'
    : 'Flat terrain, K<sub>zt</sub> = 1.0 (Condition 1, Sec. 26.8.1).';
  var gcpiMap = {enclosed:'&#177;0.18', partiallyEnclosed:'&#177;0.55', partiallyOpen:'0.00', open:'0.00', openFreeRoof:'0.00'};
  var s3body =
    '<table class="step-tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Reference</th></tr></thead><tbody>' +
    '<tr><td>Directionality factor K<sub>d</sub></td><td><strong>0.85</strong></td><td>Table 26.6-1, Buildings (MWFRS)</td></tr>' +
    '<tr><td>Exposure category</td><td><strong>' + escHtml(s.exposure||'C') + '</strong></td><td>' + expDesc + '</td></tr>' +
    '<tr><td>Topographic factor K<sub>zt</sub></td><td><strong>' + fv(kztV,3) + '</strong></td><td>' + kztNote + '</td></tr>' +
    '<tr><td>Ground elevation factor K<sub>e</sub></td><td><strong>' + fv(c.ke,3) + '</strong></td>' +
      '<td>K<sub>e</sub> = e<sup>&#x2212;0.000119&#x00D7;' + fv(s.groundElev||0,0) + '</sup>, z<sub>e</sub> = ' + fv(s.groundElev||0,0) + ' ft AMSL</td></tr>' +
    '<tr><td>Gust-effect factor G</td><td><strong>0.85</strong></td><td>Rigid structure (f &#x2265; 1 Hz), Sec. 26.11.1</td></tr>' +
    '<tr><td>Enclosure classification</td><td><strong>' + escHtml(encLabel) + '</strong></td><td>Sec. 26.12</td></tr>' +
    '<tr><td>Internal pressure coeff. (GC<sub>pi</sub>)</td><td><strong>' + (gcpiMap[s.enclosure]||('&#177;'+fv(c.gcpi,2))) + '</strong></td><td>Table 26.13-1</td></tr>' +
    '</tbody></table>';
  html += stepBlock(3, 'Determine wind load parameters', '&#167;26.6 – 26.13', s3body);

  /* ==== STEP 4: K_z / K_h ================================================= */
  var expZg    = {B:1200, C:900, D:700}[s.exposure] || 900;
  var expAlpha = {B:7.0, C:9.5, D:11.5}[s.exposure] || 9.5;
  var s4body =
    '<p>Exposure ' + escHtml(s.exposure||'C') + ': z<sub>g</sub> = ' + expZg + ' ft, &#x3B1; = ' + expAlpha + '</p>' +
    '<div class="step-formula">K<sub>z</sub> = 2.01 &#x22C5; (z / z<sub>g</sub>)<sup>2/&#x3B1;</sup> &nbsp; for z &#x2265; 15 ft</div>' +
    '<div class="step-formula">K<sub>h</sub> = 2.01 &#x00D7; (' + fv(h,1) + ' / ' + expZg + ')<sup>2/' + expAlpha + '</sup> = <span class="step-result">' + fv(c.kh,3) + '</span> &nbsp; at h = ' + fv(h,1) + ' ft</div>' +
    '<p class="step-sub">&#9432; For the windward wall, K<sub>z</sub> varies with height z (see Step 7 table).</p>';
  html += stepBlock(4, 'Determine velocity pressure exposure coefficient K<sub>z</sub> or K<sub>h</sub>', '&#167;26.10, Table 26.10-1', s4body);

  /* ==== STEP 5: q_z / q_h ================================================= */
  var s5body =
    '<div class="step-formula">q<sub>z</sub> = 0.00256 &#x22C5; K<sub>z</sub> &#x22C5; K<sub>zt</sub> &#x22C5; K<sub>e</sub> &#x22C5; V&#xB2; &nbsp;&nbsp; (Eq. 26.10-1)</div>' +
    '<div class="step-formula">q<sub>h</sub> = 0.00256 &#x00D7; ' + fv(c.kh,3) + ' &#x00D7; ' + fv(kztV,3) + ' &#x00D7; ' + fv(c.ke,3) + ' &#x00D7; ' + fv(s.V,0) + '&#xB2; = <span class="step-result">' + fpf(c.qh) + '</span></div>';
  html += stepBlock(5, 'Determine velocity pressure q<sub>z</sub> or q<sub>h</sub>', '&#167;26.10, Eq. 26.10-1', s5body);

  /* ==== STEP 6: External pressure coefficients ============================ */
  var lwNote = 'L/B = ' + fv(L,1) + '/' + fv(B,1) + ' = ' + fv(c.LB,2);
  var hLNote = 'h/L = ' + fv(h,1) + '/' + fv(L,1) + ' = ' + fv(c.hL,3);
  var figRef = s.enclosure === 'openFreeRoof'
    ? 'Fig. 27.3-4/5/6 (open bldg)'
    : 'Fig. 27.3-1 (' + roofLabel + ')';
  var s6rows = '<tr><td>Windward wall</td><td>+0.80</td><td>All L/B</td></tr>' +
    '<tr><td>Leeward wall</td><td>' + fv(c.CP_LW,2) + '</td><td>' + lwNote + ', Fig. 27.3-1</td></tr>' +
    '<tr><td>Side walls</td><td>&#x2212;0.70</td><td>All cases</td></tr>';

  /* Roof zones for Cp display */
  var rfForCp = c.roofApplicable ? c.roofZones : (c.roofZonesPTR || []);
  (rfForCp || []).forEach(function(z) {
    s6rows += '<tr><td>Roof (PTR) — ' + escHtml(z.label||('Zone '+z.zone)) + '</td>' +
      '<td>' + fv(z.cp1,2) + (z.cp2!=null ? ', '+fv(z.cp2,2) : '') + '</td>' +
      '<td>' + hLNote + '</td></tr>';
  });
  if (c.roofNTR) {
    var ww6 = c.roofNTR.ww, lw6 = c.roofNTR.lw;
    s6rows += '<tr><td>Roof WW slope (NTR, &#x3B8;=' + fv(th,1) + '&#xB0;)</td>' +
      '<td>' + fv(ww6.cp1,2) + (ww6.cp2!=null ? ', '+fv(ww6.cp2,2) : '') + '</td>' +
      '<td>' + hLNote + ', Fig. 27.3-1</td></tr>';
    s6rows += '<tr><td>Roof LW slope (NTR)</td><td>' + fv(lw6.cp,2) + '</td><td>Fig. 27.3-1</td></tr>';
  }
  var s6body =
    '<p>Roof type: <strong>' + roofLabel + '</strong>, &#x3B8; = ' + fv(th,1) + '&#xB0; &nbsp;&nbsp; ' + figRef + '</p>' +
    '<table class="step-tbl"><thead><tr><th>Surface</th><th>C<sub>p</sub></th><th>Notes</th></tr></thead><tbody>' +
    s6rows + '</tbody></table>';
  html += stepBlock(6, 'Determine external pressure coefficient C<sub>p</sub>', '&#167;27.3, Fig. 27.3-1 thru 27.3-7', s6body);

  /* ==== STEP 7: Calculate wind pressure p ================================= */
  /* 7a: Windward wall height profile */
  var wwTbl = '<table class="step-tbl"><thead><tr>' +
    '<th>z (ft)</th><th>K<sub>z</sub></th><th>q<sub>z</sub> (psf)</th>' +
    '<th>p LC1 (psf)</th><th>p LC2 (psf)</th><th>Gov.</th>' +
    '</tr></thead><tbody>';
  c.wwProfile.forEach(function(row) {
    var isH = Math.abs(row.z - h) < 0.5;
    var gov = Math.max(row.pLC1, row.pLC2);
    wwTbl += '<tr' + (isH ? ' class="row-h"' : '') + '>' +
      '<td>' + fv(row.z,0) + (isH ? ' &#9654;' : '') + '</td>' +
      '<td>' + fv(row.kz,3) + '</td>' +
      '<td>' + fv(row.qz,2) + '</td>' +
      '<td>' + fv(row.pLC1,2) + '</td>' +
      '<td class="t-pos">' + fv(row.pLC2,2) + '</td>' +
      '<td class="t-gov">' + fv(gov,2) + '</td></tr>';
  });
  wwTbl += '</tbody></table>';

  /* 7b: Leeward / side walls */
  var wsTbl = '<table class="step-tbl"><thead><tr><th>Surface</th><th>C<sub>p</sub></th>' +
    '<th>p LC1 (psf)</th><th>p LC2 (psf)</th><th>Gov.</th></tr></thead><tbody>' +
    '<tr><td>Leeward wall</td><td>' + fv(c.CP_LW,2) + '</td>' +
    '<td class="t-neg">' + fv(c.pLW_lc1,2) + '</td><td>' + fv(c.pLW_lc2,2) + '</td>' +
    '<td class="t-gov">' + fv(c.pLW_lc1,2) + '</td></tr>' +
    '<tr><td>Side walls</td><td>&#x2212;0.70</td>' +
    '<td class="t-neg">' + fv(c.pSW_lc1,2) + '</td><td>' + fv(c.pSW_lc2,2) + '</td>' +
    '<td class="t-gov">' + fv(c.pSW_lc1,2) + '</td></tr>' +
    '</tbody></table>';

  /* 7c: Roof */
  var rfTbl = '';
  if (c.roofApplicable && c.roofZones) {
    rfTbl += '<p style="margin-top:8px;"><strong>Roof (Normal to Ridge, &#x3B8; &#x2264; 10&#xB0;):</strong></p>' +
      '<table class="step-tbl"><thead><tr><th>Zone</th><th>C<sub>p1</sub></th><th>C<sub>p2</sub></th>' +
      '<th>p&#x2081; LC1</th><th>p&#x2081; LC2</th></tr></thead><tbody>';
    c.roofZones.forEach(function(z) {
      rfTbl += '<tr><td>' + escHtml(z.label||('Zone '+z.zone)) + '</td>' +
        '<td>' + fv(z.cp1,2) + '</td><td>' + (z.cp2!=null?fv(z.cp2,2):'—') + '</td>' +
        '<td class="t-neg">' + fv(z.p1_lc1,2) + '</td><td>' + fv(z.p1_lc2,2) + '</td></tr>';
    });
    rfTbl += '</tbody></table>';
  }
  if (c.roofNTR) {
    var wwN = c.roofNTR.ww, lwN = c.roofNTR.lw;
    rfTbl += '<p style="margin-top:8px;"><strong>Roof NTR (Normal to Ridge, &#x3B8; = ' + fv(th,1) + '&#xB0; &gt; 10&#xB0;):</strong></p>' +
      '<table class="step-tbl"><thead><tr><th>Surface</th><th>C<sub>p</sub></th>' +
      '<th>p LC1</th><th>p LC2</th><th>Gov.</th></tr></thead><tbody>';
    rfTbl += '<tr><td>WW slope — C<sub>p1</sub></td><td>' + fv(wwN.cp1,2) + '</td>' +
      '<td class="t-neg">' + fv(wwN.p1_lc1,2) + '</td><td>' + fv(wwN.p1_lc2,2) + '</td>' +
      '<td class="t-gov">' + fv(Math.min(wwN.p1_lc1,wwN.p1_lc2),2) + '</td></tr>';
    if (wwN.cp2 != null) {
      rfTbl += '<tr><td>WW slope — C<sub>p2</sub></td><td>' + fv(wwN.cp2,2) + '</td>' +
        '<td>' + fv(wwN.p2_lc1,2) + '</td><td class="t-pos">' + fv(wwN.p2_lc2,2) + '</td>' +
        '<td class="t-gov">' + fv(Math.max(wwN.p2_lc1||0,wwN.p2_lc2||0),2) + '</td></tr>';
    }
    rfTbl += '<tr><td>LW slope</td><td>' + fv(lwN.cp,2) + '</td>' +
      '<td class="t-neg">' + fv(lwN.lc1,2) + '</td><td>' + fv(lwN.lc2,2) + '</td>' +
      '<td class="t-gov">' + fv(lwN.lc1,2) + '</td></tr></tbody></table>';
    rfTbl += '<p style="margin-top:8px;"><strong>Roof PTR (Parallel to Ridge, all &#x3B8;):</strong></p>' +
      '<table class="step-tbl"><thead><tr><th>Zone</th><th>C<sub>p1</sub></th><th>C<sub>p2</sub></th>' +
      '<th>p&#x2081; LC1</th><th>p&#x2081; LC2</th></tr></thead><tbody>';
    (c.roofZonesPTR||[]).forEach(function(z) {
      rfTbl += '<tr><td>' + escHtml(z.label||('Zone '+z.zone)) + '</td>' +
        '<td>' + fv(z.cp1,2) + '</td><td>' + (z.cp2!=null?fv(z.cp2,2):'—') + '</td>' +
        '<td class="t-neg">' + fv(z.p1_lc1,2) + '</td><td>' + fv(z.p1_lc2,2) + '</td></tr>';
    });
    rfTbl += '</tbody></table>';
  }
  if (c.ch27Overhang) {
    var oh = c.ch27Overhang;
    rfTbl += '<p style="margin-top:8px;"><strong>Roof Overhang (Sec. 27.3.5):</strong></p>' +
      '<div class="step-formula">p<sub>soffit</sub> = q<sub>h</sub>⋅G⋅K<sub>d</sub>⋅0.8 = ' + fv(oh.pSoffit,2) + ' psf</div>' +
      '<div class="step-formula">p<sub>net,LC1</sub> = ' + fv(oh.pSoffit,2) + ' − (' + fv(oh.pTop_lc1,2) + ') = <span class="step-result">' + fv(oh.pNet_lc1,2) + ' psf</span></div>';
  }

  var s7body =
    '<p>Eq. 27.3-1: &nbsp; p = q<sub>z</sub>⋅G⋅C<sub>p</sub> − q<sub>i</sub>⋅(GC<sub>pi</sub>) &nbsp; <span style="color:var(--text-muted)">[rigid buildings; LC1: +GC<sub>pi</sub>, LC2: −GC<sub>pi</sub>]</span></p>' +
    '<p style="margin-bottom:6px;"><strong>Windward wall</strong> (q = q<sub>z</sub> varies with height, q<sub>i</sub> = q<sub>h</sub>; governing LC2):</p>' +
    wwTbl +
    '<p style="margin:8px 0 4px;"><strong>Leeward and side walls</strong> (q = q<sub>i</sub> = q<sub>h</sub>; governing LC1):</p>' +
    wsTbl + rfTbl;

  html += stepBlock(7, 'Calculate wind pressure p on each building surface', '&#167;27.3, Eq. 27.3-1', s7body);

  /* ==== STEP 8: Load cases ================================================ */
  var minWalls = c.wallMinGoverns ? ' <span class="step-result">(16.0 psf min governs)</span>' : ' (16.0 psf min — OK)';
  var minRoof  = c.roofMinGoverns ? ' <span class="step-result">(8.0 psf min governs)</span>'  : ' (8.0 psf min — OK)';
  var s8body =
    '<p>Four load cases per Fig. 27.3-8 must be considered for MWFRS design. Cases 1&amp;2 apply all pressures in the directions computed above. Cases 3&amp;4 apply 75% of those pressures plus a torsional moment to account for wind from non-orthogonal directions.</p>' +
    '<table class="step-tbl"><thead><tr><th>LC</th><th>Description</th><th>Fraction</th></tr></thead><tbody>' +
    '<tr><td><strong>1</strong></td><td>Full wind on one face at a time (&#177; directions)</td><td>100%</td></tr>' +
    '<tr><td><strong>2</strong></td><td>Full wind simultaneously on two perpendicular faces</td><td>100%</td></tr>' +
    '<tr><td><strong>3</strong></td><td>Reduced wind on one face + torsional moment M<sub>T</sub></td><td>75%</td></tr>' +
    '<tr><td><strong>4</strong></td><td>Reduced wind on two faces + torsional moment</td><td>75%</td></tr>' +
    '</tbody></table>' +
    '<p style="margin-top:8px;"><strong>Minimum design wind loads (Sec. 27.1.5):</strong></p>' +
    '<p>Walls:' + minWalls + '</p><p>Roof:' + minRoof + '</p>';
  html += stepBlock(8, 'Evaluate design wind load cases', '&#167;27.3.5, Fig. 27.3-8', s8body);

  /* ==== Summary Table ===================================================== */
  var wwAtH = c.wwProfile[c.wwProfile.length - 1];
  var wwGov = Math.max(wwAtH.pLC1, wwAtH.pLC2);
  html += '<div class="report-summary-box">';
  html += '<div class="report-summary-title">Design Wind Pressures Summary — MWFRS Directional Procedure (Ch. 27)</div>';
  html += '<table class="pres-tbl"><thead><tr><th>Surface</th><th>LC1 (psf)</th><th>LC2 (psf)</th><th>Governing (psf)</th></tr></thead><tbody>';

  html += '<tr class="s-gov-row"><td class="s-label">Windward wall (at h = ' + fv(h,1) + ' ft)</td>' +
    '<td class="s-pos">' + fv(wwAtH.pLC1,1) + '</td><td class="s-pos">' + fv(wwAtH.pLC2,1) + '</td>' +
    '<td class="s-gov">' + fv(wwGov,1) + '</td></tr>';
  if (c.wwProfile.length > 1) {
    var wwBase = c.wwProfile[0];
    html += '<tr><td class="s-label">Windward wall (at z = ' + fv(wwBase.z,0) + ' ft)</td>' +
      '<td class="s-pos">' + fv(wwBase.pLC1,1) + '</td><td class="s-pos">' + fv(wwBase.pLC2,1) + '</td>' +
      '<td class="s-gov">' + fv(Math.max(wwBase.pLC1,wwBase.pLC2),1) + '</td></tr>';
  }
  html += '<tr><td class="s-label">Leeward wall</td>' +
    '<td class="s-neg">' + fv(c.pLW_lc1,1) + '</td><td class="s-neg">' + fv(c.pLW_lc2,1) + '</td>' +
    '<td class="s-gov">' + fv(c.pLW_lc1,1) + '</td></tr>';
  html += '<tr><td class="s-label">Side walls</td>' +
    '<td class="s-neg">' + fv(c.pSW_lc1,1) + '</td><td class="s-neg">' + fv(c.pSW_lc2,1) + '</td>' +
    '<td class="s-gov">' + fv(c.pSW_lc1,1) + '</td></tr>';

  var rfSumZones = c.roofApplicable ? c.roofZones : null;
  if (rfSumZones) {
    rfSumZones.forEach(function(z) {
      html += '<tr><td class="s-label">Roof — ' + escHtml(z.label||('Zone '+z.zone)) + '</td>' +
        '<td class="s-neg">' + fv(z.p1_lc1,1) + '</td><td class="s-neg">' + fv(z.p1_lc2,1) + '</td>' +
        '<td class="s-gov">' + fv(Math.min(z.p1_lc1,z.p1_lc2),1) + '</td></tr>';
    });
  }
  if (c.roofNTR) {
    var wwS = c.roofNTR.ww, lwS = c.roofNTR.lw;
    html += '<tr><td class="s-label">Roof WW slope (NTR, &#x3B8;=' + fv(th,1) + '&#xB0;)</td>' +
      '<td class="s-neg">' + fv(wwS.p1_lc1,1) + '</td>' +
      '<td>' + fv(wwS.p2_lc2!=null?wwS.p2_lc2:wwS.p1_lc2,1) + '</td>' +
      '<td class="s-gov">' + fv(Math.min(wwS.p1_lc1,wwS.p1_lc2),1) + '</td></tr>';
    html += '<tr><td class="s-label">Roof LW slope (NTR)</td>' +
      '<td class="s-neg">' + fv(lwS.lc1,1) + '</td><td class="s-neg">' + fv(lwS.lc2,1) + '</td>' +
      '<td class="s-gov">' + fv(lwS.lc1,1) + '</td></tr>';
  }
  html += '</tbody></table></div>';

  return html;
}


/* ── Results render ────────────────────────────────────────────────────── */
function renderWindResults(r, s) {
  var host = document.getElementById('windResultsContent');
  if (!host) return;
  if (!r) {
    host.innerHTML = '<div class="result-card"><div class="result-card-head">Error</div><div class="result-row"><span class="k">Calculation error — check inputs</span></div></div>';
    return;
  }
  function fmt(v, d){ return (typeof v === 'number' ? v.toFixed(d != null ? d : 2) : '—'); }
  function psf(v){ return fmt(v) + ' psf'; }
  var html = '';

  var gcpiVal = r.gcpi && typeof r.gcpi === 'object' ? r.gcpi.pos : r.gcpi;
  html += '<div class="result-card"><div class="result-card-head">Site &amp; Parameters</div>' +
    '<div class="result-row"><span class="k">Risk Category</span><span class="v"><span class="badge-risk">' + escHtml(s.riskCategory) + '</span></span></div>' +
    '<div class="result-row"><span class="k">Exposure</span><span class="v">' + escHtml(s.exposure) + '</span></div>' +
    '<div class="result-row"><span class="k">Enclosure</span><span class="v">' + escHtml({enclosed:'Enclosed',partiallyEnclosed:'Part. Enclosed',open:'Open'}[s.enclosure] || s.enclosure) + '</span></div>' +
    '<div class="result-row"><span class="k">Procedure</span><span class="v">' + escHtml(s.mode==='cc'?'C&C Ch.30':(s.mwfrsProcedure==='envelope'?'MWFRS Env Ch.28':'MWFRS Dir Ch.27')) + '</span></div></div>';

  html += '<div class="result-card"><div class="result-card-head">Velocity Pressure</div>' +
    '<div class="result-row"><span class="k">K<sub>h</sub></span><span class="v">' + fmt(r.kh,3) + '</span></div>' +
    '<div class="result-row"><span class="k">K<sub>e</sub></span><span class="v">' + fmt(r.ke,3) + '</span></div>' +
    '<div class="result-row"><span class="k">K<sub>d</sub></span><span class="v">' + fmt(r.kd,2) + '</span></div>' +
    '<div class="result-row"><span class="k">q<sub>h</sub></span><span class="v">' + psf(r.qh) + '</span></div>' +
    '<div class="result-row"><span class="k">(GC<sub>pi</sub>)</span><span class="v">±' + fmt(gcpiVal,2) + '</span></div>' +
    '<div class="result-row"><span class="k">Zone a</span><span class="v">' + fmt(r.a,2) + ' ft</span></div></div>';

  if (s.mode === 'mwfrs' && s.mwfrsProcedure === 'envelope' && r.mwfrsLC1 && r.mwfrsLC1.length) {
    var all2 = (r.mwfrsLC1 || []).concat(r.mwfrsLC2 || []);
    var seen = new Set();
    var uniq = all2.filter(function(z){ return !seen.has(z.zone) && seen.add(z.zone); });
    html += '<div class="result-card"><div class="result-card-head">MWFRS — Envelope (Ch. 28)</div>';
    uniq.forEach(function(z) {
      var ma  = Math.max(Math.abs(z.pos||0), Math.abs(z.neg||0));
      var cl  = ma>30?'zone-crit':ma>20?'zone-high':ma>12?'zone-mid':'zone-low';
      var vstr= (z.pos!=null?'+'+fmt(z.pos):'') + (z.neg!=null?' / '+fmt(z.neg):'') + ' psf';
      html += '<div class="result-row ' + cl + '"><span class="k">' + escHtml(z.zone) + '</span><span class="v">' + vstr + '</span></div>';
    });
    html += '</div>';
  }

  if (s.mode === 'mwfrs' && s.mwfrsProcedure === 'directional' && r.ch27) {
    var d = r.ch27;
    html += '<div class="result-card"><div class="result-card-head">MWFRS — Directional (Ch. 27)</div>';
    if (d.pWW!=null) html += '<div class="result-row zone-mid"><span class="k">Windward wall</span><span class="v">+' + fmt(d.pWW) + ' psf</span></div>';
    if (d.pLW!=null) html += '<div class="result-row zone-low"><span class="k">Leeward wall</span><span class="v">'  + fmt(d.pLW) + ' psf</span></div>';
    if (Array.isArray(d.roof)) d.roof.forEach(function(rz) {
      html += '<div class="result-row zone-mid"><span class="k">' + escHtml(rz.label||'Roof') + '</span><span class="v">' + fmt(rz.p) + ' psf</span></div>';
    });
    html += '</div>';
  }

  if (s.mode === 'cc') {
    var wallLabel = {'4':'Zone 4 — field','5':'Zone 5 — corner'};
    var wallCls   = {'4':'zone-low','5':'zone-high'};
    if (r.ccWall && r.ccWall.length) {
      html += '<div class="result-card"><div class="result-card-head">C&amp;C — Walls (Ch. 30)</div>';
      r.ccWall.forEach(function(z) {
        html += '<div class="result-row ' + (wallCls[z.zone]||'zone-mid') + '"><span class="k">' + (wallLabel[z.zone]||'Zone '+z.zone) + '</span><span class="v">' + fmt(z.p.min) + ' / +' + fmt(z.p.max) + ' psf</span></div>';
      });
      html += '</div>';
    }
    var roofLabel = {'1p':'Zone 1′ — field (low)','1':'Zone 1 — field','2':'Zone 2 — edge','3':'Zone 3 — corner'};
    var roofCls   = {'1p':'zone-low','1':'zone-low','2':'zone-mid','3':'zone-high'};
    if (r.ccRoof && r.ccRoof.length) {
      html += '<div class="result-card"><div class="result-card-head">C&amp;C — Roof (Ch. 30)</div>';
      r.ccRoof.forEach(function(z) {
        html += '<div class="result-row ' + (roofCls[z.zone]||'zone-mid') + '"><span class="k">' + (roofLabel[z.zone]||'Zone '+z.zone) + '</span><span class="v">' + fmt(z.p.min) + ' / +' + fmt(z.p.max) + ' psf</span></div>';
      });
      html += '</div>';
    }
  }

  /* ── Special C&C roof cards ───────────────────────────────────────── */
  function zoneRow(label, neg, pos, cls) {
    return '<div class="result-row ' + (cls||'zone-mid') + '"><span class="k">' + label +
           '</span><span class="v">' + fmt(neg) + ' / +' + fmt(pos) + ' psf</span></div>';
  }

  if (r.steppedRoof) {
    var sr = r.steppedRoof;
    html += '<div class="result-card"><div class="result-card-head">Stepped Roof C&amp;C <span class="ref">Fig. 30.3-3</span></div>' +
      '<div class="result-row zone-low"><span class="k">Step height h<sub>s</sub></span><span class="v">' + fmt(sr.hs,1) + ' ft</span></div>' +
      '<div class="result-row zone-low"><span class="k">Zone a (main)</span><span class="v">' + fmt(sr.aMain,1) + ' ft</span></div>' +
      '<div class="result-row zone-low"><span class="k">Zone a (step)</span><span class="v">' + fmt(sr.aStep,1) + (sr.aStepCapped?' (capped)':'') + ' ft</span></div>' +
      zoneRow('Zone 1 — field',  sr.zone1.pMin, sr.zone1.pMax, 'zone-low') +
      zoneRow('Zone 2 — edge',   sr.zone2.pMin, sr.zone2.pMax, 'zone-mid') +
      zoneRow('Zone 3 — corner', sr.zone3.pMin, sr.zone3.pMax, 'zone-high') +
      '</div>';
  }
  if (r.multispanRoof) {
    var mr = r.multispanRoof;
    html += '<div class="result-card"><div class="result-card-head">Multispan Gable C&amp;C <span class="ref">Fig. 30.3-4</span></div>' +
      '<div class="result-row zone-low"><span class="k">Zone a</span><span class="v">' + fmt(mr.a,1) + ' ft</span></div>' +
      (mr.capped ? '<div class="result-row zone-low"><span class="k">&#9888; &theta; &gt; 45&deg; &mdash; capped</span></div>' : '') +
      zoneRow('Zone 1 — field',  mr.zone1.pMin, mr.zone1.pMax, 'zone-low') +
      zoneRow('Zone 2 — edge',   mr.zone2.pMin, mr.zone2.pMax, 'zone-mid') +
      zoneRow('Zone 3 — corner', mr.zone3.pMin, mr.zone3.pMax, 'zone-high') +
      '</div>';
  }
  if (r.sawtoothRoof) {
    var sw = r.sawtoothRoof;
    html += '<div class="result-card"><div class="result-card-head">Sawtooth Roof C&amp;C <span class="ref">Fig. 30.3-6</span></div>' +
      '<div class="result-row zone-low"><span class="k">Zone a</span><span class="v">' + fmt(sw.a,1) + ' ft  (low eave: ' + fmt(sw.aLow,1) + ' ft)</span></div>' +
      zoneRow('Zone 1 — field', sw.zone1.pMin, sw.zone1.pMax, 'zone-low') +
      zoneRow('Zone 2 — edge',  sw.zone2.pMin, sw.zone2.pMax, 'zone-mid');
    if (sw.thetaLE10) {
      html += zoneRow('Zone 3 — corner', sw.zone3.pMin, sw.zone3.pMax, 'zone-high');
    } else {
      html += zoneRow('Zone 3 Span A',    sw.zone3SpanA.pMin,    sw.zone3SpanA.pMax,    'zone-high') +
              zoneRow('Zone 3 Spans B–D', sw.zone3SpansBCD.pMin, sw.zone3SpansBCD.pMax, 'zone-high');
    }
    html += '</div>';
  }
  if (r.domeRoof) {
    var dr = r.domeRoof;
    html += '<div class="result-card"><div class="result-card-head">Domed Roof C&amp;C <span class="ref">Fig. 30.3-7</span></div>' +
      '<div class="result-row zone-low"><span class="k">f/D</span><span class="v">' + fmt(dr.fOverD,3) + (dr.outOfRange?' &#9888; out of range':'') + '</span></div>' +
      '<div class="result-row zone-low"><span class="k">h<sub>D</sub>/D</span><span class="v">' + fmt(dr.hDoverD,3) + '</span></div>' +
      '<div class="result-row zone-low"><span class="k">q at dome top</span><span class="v">' + fmt(dr.qDome,2) + ' psf</span></div>' +
      '<div class="result-row zone-mid"><span class="k">Neg (&#952; 0&ndash;90&deg;)</span><span class="v">' + fmt(dr.pNeg && dr.pNeg.min) + ' / +' + fmt(dr.pNeg && dr.pNeg.max) + ' psf</span></div>' +
      '<div class="result-row zone-low"><span class="k">Pos &#952; 0&ndash;60&deg;</span><span class="v">' + fmt(dr.pPosLow && dr.pPosLow.min) + ' / +' + fmt(dr.pPosLow && dr.pPosLow.max) + ' psf</span></div>' +
      '<div class="result-row zone-low"><span class="k">Pos &#952; 61&ndash;90&deg;</span><span class="v">' + fmt(dr.pPosHigh && dr.pPosHigh.min) + ' / +' + fmt(dr.pPosHigh && dr.pPosHigh.max) + ' psf</span></div>' +
      '</div>';
  }

  host.innerHTML = html;
}

/* ── Input tab switching ───────────────────────────────────────────────── */
function activateInputTab(tabName) {
  document.querySelectorAll('.itab').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.querySelector('.itab[data-tab="' + tabName + '"]');
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(function(c) {
    c.classList.toggle('hidden', c.id !== 'tab-' + tabName);
  });
  /* Map mode only on Site tab; 3D for everything else */
  var isMap = (tabName === 'site');
  var mapEl = document.getElementById('map-container');
  var threeEl = document.getElementById('threejs-container');
  var mapTb = document.getElementById('mapToolbar');
  var diagramTb = document.getElementById('diagramToolbar');
  var isResults = (tabName === 'results');
  var reportPanelEl = document.getElementById('windReportPanel');
  var captEl = document.getElementById('windDiagramCaption');
  if (mapEl)          mapEl.classList.toggle('hidden', !isMap);
  if (threeEl)        threeEl.classList.toggle('hidden', isMap || isResults);
  if (mapTb)          mapTb.classList.toggle('hidden', !isMap);
  if (diagramTb)      diagramTb.classList.toggle('hidden', isMap || isResults);
  if (reportPanelEl)  reportPanelEl.classList.toggle('hidden', !isResults);
  if (captEl)         captEl.classList.toggle('hidden', isResults);
  /* Init / resize Leaflet map when Site tab becomes visible */
  if (isMap && typeof initWindMap === 'function') {
    setTimeout(function(){ initWindMap('map-container'); }, 50);
  }
}

/* ── Helper ────────────────────────────────────────────────────────────── */
function setVisible(id, show) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('hidden', !show);
}

/* ── Tornado check (Fig 32.1-2) ────────────────────────────────────────── */
function updateTornadoAlert() {
  var rc = (document.getElementById('wind-riskCategory') || {}).value || 'II';
  var needRC = (rc === 'III' || rc === 'IV');
  setVisible('tornadoAlert', needRC);
  if (!needRC) return;

  var prone = !!(document.getElementById('wind-tornadoProne') || {}).checked;
  setVisible('tornadoVtBlock', prone);
  var statusEl = document.getElementById('tornadoStatus');
  if (!prone) { if (statusEl) { statusEl.textContent = ''; statusEl.className = 'tornado-status'; } return; }

  var Vt  = parseFloat((document.getElementById('wind-Vt')       || {}).value) || 0;
  var V   = parseFloat((document.getElementById('wind-V')        || {}).value) || 115;
  var exp = (document.getElementById('wind-exposure') || {}).value || 'C';
  if (!Vt) { if (statusEl) { statusEl.className = 'tornado-status pending'; statusEl.textContent = 'Enter Vᵀ to evaluate requirement'; } return; }

  var step3 = (Vt >= 60);
  var ratio  = { B: 0.5, C: 0.6, D: 0.67 }[exp] || 0.6;
  var step4  = (Vt >= ratio * V);

  if (!statusEl) return;
  if (!step3) {
    statusEl.className = 'tornado-status not-required';
    statusEl.textContent = '✓ NOT required — Vᵀ < 60 mph (Step 3)';
  } else if (!step4) {
    statusEl.className = 'tornado-status not-required';
    statusEl.textContent = '✓ NOT required — Vᵀ < ' + Math.round(ratio * 100) + '% of V (Step 4, Exp. ' + exp + ')';
  } else {
    statusEl.className = 'tornado-status required';
    statusEl.textContent = '⚠ Tornado loads REQUIRED — use Ch. 32';
  }
}

/* ── K_e auto-calc ──────────────────────────────────────────────────────── */
function wsComputeKe() {
  var z  = parseFloat((document.getElementById('wind-groundElev') || {}).value) || 0;
  var ke = Math.exp(-0.0000362 * z);
  var d  = document.getElementById('wind-ke-display');
  if (d) d.value = ke.toFixed(3);
  return ke;
}

/* ── K_zt calc (ASCE 7-22 Fig. 26.8-1) ────────────────────────────────── */
function wsComputeKzt() {
  var shape = (document.getElementById('wind-kztShape') || {}).value || '2dRidge';
  var H   = parseFloat((document.getElementById('wind-kztH')  || {}).value) || 0;
  var Lh  = parseFloat((document.getElementById('wind-kztLh') || {}).value) || 1;
  var x   = parseFloat((document.getElementById('wind-kztX')  || {}).value) || 0;
  var z   = parseFloat((document.getElementById('wind-kztZ')  || {}).value) || 0;
  if (H <= 0 || Lh <= 0) { _setKztVal('—'); return 1.0; }
  var HLh = H / Lh;
  var K1  = (shape === '3dHill') ? Math.min(0.95 * HLh, 0.475) : Math.min(1.30 * HLh, 0.650);
  var mu  = (shape === '3dHill') ? 4.0 : 1.5;
  var K2  = Math.max(0, 1 - Math.abs(x) / (mu * Lh));
  var K3  = Math.exp(-2.5 * z / Lh);
  var Kzt = Math.pow(1 + K1 * K2 * K3, 2);
  _setKztVal(Kzt.toFixed(3));
  var kztEl = document.getElementById('wind-kzt');
  if (kztEl) kztEl.value = Kzt.toFixed(3);
  return Kzt;
}
function _setKztVal(v) {
  var el = document.getElementById('kztCalcVal'); if (el) el.textContent = v;
}

/* ── Enclosure classification (§26.12.1) ───────────────────────────────── */
function computeEnclosureFromOpenings() {
  var Ao  = parseFloat((document.getElementById('wind-Ao')  || {}).value) || 0;
  var Aoi = parseFloat((document.getElementById('wind-Aoi') || {}).value) || 0;
  var Ag  = parseFloat((document.getElementById('wind-Ag')  || {}).value) || 0;
  var Agi = parseFloat((document.getElementById('wind-Agi') || {}).value) || 0;
  var res = document.getElementById('enclosureCalcResult');
  var encEl = document.getElementById('wind-enclosure');
  if (!res) return;
  if (!Ao || !Ag) { res.className = 'enclosure-calc-result'; res.textContent = 'Enter opening areas above'; return; }
  var cls, label, val;
  if (Ao >= 0.8 * Ag) {
    cls = 'open'; label = 'Open — GCpi = 0.00'; val = 'open';
  } else if (Ao > 1.10 * Aoi && Ao > Math.max(4, 0.01 * Ag) && (Agi > 0 ? Aoi / Agi < 0.20 : true)) {
    cls = 'partial'; label = 'Partially Enclosed — GCpi = ±0.55'; val = 'partiallyEnclosed';
  } else {
    cls = 'enclosed'; label = 'Enclosed — GCpi = ±0.18'; val = 'enclosed';
  }
  res.className = 'enclosure-calc-result ' + cls;
  res.innerHTML = 'Classification: <strong>' + label + '</strong>';
  if (encEl) encEl.value = val;
  updateCCDependentUI();
}

/* ── Zone options by surface ────────────────────────────────────────────── */
function updateZoneOptions(surface) {
  var sel = document.getElementById('wind-zone');
  if (!sel) return;
  sel.innerHTML = (surface === 'wall')
    ? '<option value="4">Zone 4 — Wall field</option><option value="5">Zone 5 — Wall corner</option>'
    : '<option value="1">Zone 1 — Interior field</option><option value="2">Zone 2 — Edge / ridge</option><option value="3">Zone 3 — Corner</option>';
}

/* ── C&C-dependent UI visibility (enclosure classification + procedure) ──── */
function updateCCDependentUI() {
  var activeProc = document.querySelector('#windProcToggle button.active');
  var proc = activeProc ? activeProc.dataset.proc : 'envelope';
  var isCC = (proc === 'cc');
  var encEl = document.getElementById('wind-enclosure');
  var isOpen = encEl ? (encEl.value === 'open') : false;

  /* C&C effective area section — visible only for C&C procedure */
  var ccArea = document.getElementById('ccAreaSection');
  if (ccArea) ccArea.classList.toggle('hidden', !isCC);

  /* Open-building free roof optgroup — visible only for C&C + Open */
  var openGrp = document.getElementById('openBldgRoofGroup');
  if (openGrp) openGrp.style.display = (isCC && isOpen) ? '' : 'none';

  /* If an open-building roof type is selected but conditions not met, reset to gable */
  var roofSel = document.getElementById('wind-roofShape');
  var openTypes = ['monoslope-free', 'pitched-free', 'troughed-free'];
  if (roofSel && openTypes.indexOf(roofSel.value) !== -1 && !(isCC && isOpen)) {
    roofSel.value = 'gable';
  }
}

/* ── Wire inputs ────────────────────────────────────────────────────────── */
function wireWindInputs() {
  var debounce = null;
  var onInput  = function(){ clearTimeout(debounce); debounce = setTimeout(recalcWind, 250); };

  /* All mapped inputs */
  Object.keys(WIND_INPUT_MAP).forEach(function(id) {
    var inp = document.getElementById(id);
    if (inp) inp.addEventListener('input', onInput);
  });

  /* Procedure toggle */
  document.querySelectorAll('#windProcToggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#windProcToggle button').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      updateCCDependentUI();
      recalcWind();
    });
  });

  /* Input tab switching */
  document.querySelectorAll('.itab').forEach(function(btn) {
    btn.addEventListener('click', function() { activateInputTab(btn.dataset.tab); });
  });

  /* ── Address search (Site tab) ────────────────────────────────────── */
  var addrEl = document.getElementById('wind-address');
  var geoBtn = document.getElementById('windGeoBtn');
  var mapResetBtn = document.getElementById('windBtnMapReset');

  if (addrEl) {
    /* Enter key → geocode */
    addrEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (typeof windMapGeocodeAndPlace === 'function') windMapGeocodeAndPlace(addrEl.value.trim());
      }
    });
    /* Show/hide reset button when address has value */
    addrEl.addEventListener('input', function() {
      if (mapResetBtn) mapResetBtn.classList.toggle('hidden', !addrEl.value);
    });
  }

  /* GPS "use my location" button */
  if (geoBtn) {
    geoBtn.addEventListener('click', function() {
      if (!navigator.geolocation) return;
      geoBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          geoBtn.disabled = false;
          if (addrEl) addrEl.value = 'My location (' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4) + ')';
          if (typeof windMapSetLocation === 'function') windMapSetLocation(pos.coords.latitude, pos.coords.longitude);
        },
        function() { geoBtn.disabled = false; }
      );
    });
  }

  /* Map reset → pan back to CONUS */
  if (mapResetBtn) {
    mapResetBtn.addEventListener('click', function() {
      if (typeof windMapReset === 'function') windMapReset();
      if (addrEl) addrEl.value = '';
      var resEl = document.getElementById('wind-addr-result');
      if (resEl) { resEl.textContent = ''; resEl.className = 'addr-result'; }
      mapResetBtn.classList.add('hidden');
    });
  }

  /* 3D view toggle */
  document.querySelectorAll('#windViewToggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#windViewToggle button').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  /* Camera reset */
  var btnReset = document.getElementById('windBtnReset');
  if (btnReset) btnReset.addEventListener('click', function(){ windRenderer && windRenderer.resetCamera && windRenderer.resetCamera(); });

  /* Building / Other Structure */
  document.querySelectorAll('.struct-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.struct-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var isBuilding = (btn.dataset.struct === 'building');
      var scEl = document.getElementById('wind-structureCategory');
      if (scEl) scEl.value = isBuilding ? 'building' : 'otherStructure';
      setVisible('geomBuildingBlock', isBuilding);
      setVisible('geomOtherBlock', !isBuilding);
      recalcWind();
    });
  });

  /* Other structure type selector → show/hide sub-params */
  var otherTypeEl = document.getElementById('wind-otherType');
  if (otherTypeEl) {
    function syncOtherParams() {
      var chosen = otherTypeEl.value;
      document.querySelectorAll('.other-params').forEach(function(el) {
        var isActive = el.id === ('otherParams-' + chosen);
        el.classList.toggle('hidden', !isActive);
      });
    }
    otherTypeEl.addEventListener('change', function() { syncOtherParams(); recalcWind(); });
    syncOtherParams();
  }

  /* Enclosure select */
  var encSelEl = document.getElementById('wind-enclosure');
  if (encSelEl) {
    encSelEl.addEventListener('change', function() {
      updateCCDependentUI();
      recalcWind();
    });
  }

  /* Calculate openings toggle */
  var chkOp = document.getElementById('wind-calcOpenings');
  if (chkOp) {
    chkOp.addEventListener('change', function() {
      setVisible('openingsTable', this.checked);
      });
    ['wind-Ao','wind-Aoi','wind-Ag','wind-Agi'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function(){ computeEnclosureFromOpenings(); recalcWind(); });
    });
  }

  /* Surface toggle */
  document.querySelectorAll('.surf-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.surf-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var sfEl = document.getElementById('wind-surface');
      if (sfEl) sfEl.value = btn.dataset.surface;
      updateZoneOptions(btn.dataset.surface);
      recalcWind();
    });
  });

  /* Parapet */
  var chkP = document.getElementById('wind-hasParapet');
  if (chkP) {
    chkP.addEventListener('change', function(){ setVisible('parapetSub', this.checked); recalcWind(); });
    var hpEl = document.getElementById('wind-hp');
    if (hpEl) hpEl.addEventListener('input', onInput);
  }

  /* Overhang */
  var chkO = document.getElementById('wind-hasOverhang');
  if (chkO) {
    chkO.addEventListener('change', function(){ setVisible('overhangSub', this.checked); recalcWind(); });
    var woEl = document.getElementById('wind-wo');
    if (woEl) woEl.addEventListener('input', onInput);
  }

  /* K_zt calc mode */
  var chkKzt = document.getElementById('wind-kztCalcMode');
  if (chkKzt) {
    chkKzt.addEventListener('change', function() {
      setVisible('kztManualBlock', !this.checked);
      setVisible('kztCalcBlock',    this.checked);
      if (this.checked) wsComputeKzt();
    });
    ['wind-kztShape','wind-kztH','wind-kztLh','wind-kztX','wind-kztZ'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function(){ wsComputeKzt(); recalcWind(); });
    });
  }

  /* Ground elevation → K_e */
  var elevEl = document.getElementById('wind-groundElev');
  if (elevEl) elevEl.addEventListener('input', function(){ wsComputeKe(); recalcWind(); });

  /* Risk Category → tornado alert + recalc */
  var rcEl = document.getElementById('wind-riskCategory');
  if (rcEl) rcEl.addEventListener('change', function(){ updateTornadoAlert(); recalcWind(); });

  /* Tornado prone toggle */
  var proneEl = document.getElementById('wind-tornadoProne');
  if (proneEl) proneEl.addEventListener('change', function(){ updateTornadoAlert(); recalcWind(); });

  /* V_T input */
  var vtEl = document.getElementById('wind-Vt');
  if (vtEl) vtEl.addEventListener('input', function(){ clearTimeout(debounce); debounce = setTimeout(function(){ updateTornadoAlert(); recalcWind(); }, 250); });

  /* Exposure → re-check tornado */
  var expEl = document.getElementById('wind-exposure');
  if (expEl) expEl.addEventListener('change', function(){ updateTornadoAlert(); recalcWind(); });

  /* Roof pitch unit toggle */
  wirePitchToggle();

  /* Initial C&C-dependent visibility */
  updateCCDependentUI();

  /* ── 3D renderer: dim highlight on input focus/blur ──────────────────── */
  var dimInputMap = {
    'wind-B':     ['dim-B'],
    'wind-L':     ['dim-L'],
    'wind-h':     ['dim-h', 'dim-h-eave'],
    'wind-theta': [],
  };
  Object.keys(dimInputMap).forEach(function(inputId) {
    var el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('focus', function() {
      dimInputMap[inputId].forEach(function(d) {
        if (windRenderer) windRenderer.highlightDim(d, true);
      });
    });
    el.addEventListener('blur', function() {
      dimInputMap[inputId].forEach(function(d) {
        if (windRenderer) windRenderer.highlightDim(d, false);
      });
    });
  });

}

/* ── Pitch toggle: deg ↔ X:12 with live conversion display ────────────── */
/* ── Pitch toggle: deg ↔ X:12 with live conversion display ────────────── */
function wirePitchToggle() {
  var thetaInp   = document.getElementById('wind-theta');
  var noteEl     = document.getElementById('pitchConvert');
  var toggleBtns = document.querySelectorAll('#pitchUnitToggle button');
  var labelEl    = document.getElementById('wind-theta-label');

  if (!thetaInp || !noteEl || !toggleBtns.length) return;

  var pitchMode = 'deg';

  function updateNote() {
    var val = parseFloat(thetaInp.value);
    if (isNaN(val)) { noteEl.textContent = ''; return; }
    if (pitchMode === 'deg') {
      var rise = 12 * Math.tan(val * Math.PI / 180);
      noteEl.textContent = '= ' + rise.toFixed(2) + ':12 slope';
    } else {
      var deg = Math.atan(val / 12) * 180 / Math.PI;
      noteEl.textContent = '= ' + deg.toFixed(1) + '°';
    }
  }

  function setMode(mode) {
    if (mode === pitchMode) return;
    var oldVal = parseFloat(thetaInp.value);
    if (!isNaN(oldVal)) {
      if (mode === 'slope') {
        thetaInp.min  = '0';
        thetaInp.max  = '48';
        thetaInp.step = '0.1';
        thetaInp.value = (12 * Math.tan(oldVal * Math.PI / 180)).toFixed(2);
        if (labelEl) labelEl.innerHTML = 'Roof pitch <span class="unit">(X:12)</span>';
      } else {
        thetaInp.min  = '0';
        thetaInp.max  = '89.9';
        thetaInp.step = '0.1';
        thetaInp.value = (Math.atan(oldVal / 12) * 180 / Math.PI).toFixed(1);
        if (labelEl) labelEl.innerHTML = 'Roof pitch, θ <span class="unit">(°)</span>';
      }
    }
    pitchMode = mode;
    updateNote();
    recalcWind();
  }

  toggleBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      toggleBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      setMode(btn.dataset.unit);
    });
  });

  thetaInp.addEventListener('input', function() {
    updateNote();
  });

  updateNote();
}

/* ── Read theta always in degrees (handles slope mode) ─────────────────── */
function readThetaDegrees() {
  var thetaInp = document.getElementById('wind-theta');
  if (!thetaInp) return 0;
  var val = parseFloat(thetaInp.value) || 0;
  var activeBtn = document.querySelector('#pitchUnitToggle button.active');
  if (activeBtn && activeBtn.dataset.unit === 'slope') {
    return Math.atan(val / 12) * 180 / Math.PI;
  }
  return val;
}

/* ── Open wind workspace ───────────────────────────────────────────────── */
async function openWindWorkspace(proj, calc) {
  windActiveProj = proj;
  windActiveCalc = calc;

  var banner = document.getElementById('windBannerText');
  if (banner) banner.innerHTML = '<strong>' + escHtml(proj.name) + '</strong> · ASCE 7-22 · '
    + escHtml((proj.settings && proj.settings.units === 'SI') ? 'SI' : 'US') + ' Units';

  await loadWindScripts();
  await loadWindEngine();

  var savedEntry = calc.state && calc.state['ASCE 7-22'];
  if (savedEntry && savedEntry.state) {
    windSavedState = savedEntry.state;
    restoreWindInputs(savedEntry.state);
  } else {
    windSavedState = null;
  }

  if (windRenderer) {
    try { windRenderer.dispose(); } catch(e) {}
    windRenderer = null;
  }
  await new Promise(function(res){ setTimeout(res, 60); });
  try { windRenderer = new Wind3DRenderer('threejs-container'); } catch(e) { console.error('Wind3DRenderer init:', e); }

  if (!elWsMain._inputsWired) {
    wireWindInputs();
    elWsMain._inputsWired = true;
  }
  // Re-register zone click on every new renderer instance
  if (windRenderer) {
    windRenderer.onZoneClick(function(zoneType) {
      activateInputTab('geometry');
    });
  }
  recalcWind();
}
