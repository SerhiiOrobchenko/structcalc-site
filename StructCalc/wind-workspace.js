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

/* ── Ch.28 Envelope Procedure Step Report — Table 28.2-1 (8 steps) ─────── */
function buildCh28StepReport(r, s) {
  function fv(v, d) { return (typeof v === 'number') ? v.toFixed(d != null ? d : 2) : '—'; }
  function fpf(v) { return fv(v) + ' psf'; }
  function warn(msg) {
    return '<div class="report-warn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>' + msg + '</span></div>';
  }
  if (!r || !r.mwfrsLC1) return warn('Calculation error — check your inputs.');

  var h   = s.h || 20, B = s.minDim || 40, L = s.buildingL || 60;
  var kztV = s.kzt || 1.0;
  var encMap = {enclosed:'Enclosed', partiallyEnclosed:'Partially Enclosed', partiallyOpen:'Partially Open', open:'Open'};
  var encLabel = encMap[s.enclosure] || s.enclosure;
  var gcpiObj = r.gcpi || { pos: 0.18, neg: -0.18 };
  var addrEl = document.getElementById('wind-address');
  var addr   = addrEl ? addrEl.value.trim() : '';
  var html   = '';

  /* header */
  html += '<div class="report-proc-head">';
  html += '<div class="report-proc-title">MWFRS — Envelope Procedure (Low-Rise)</div>';
  html += '<div class="report-proc-sub">ASCE 7-22 Chapter 28 — Low-Rise Buildings (h ≤ 60 ft, h ≤ min(B,L)) — ' + escHtml(encLabel) + ' Building</div>';
  if (addr) html += '<div style="font-size:.73rem;color:var(--text-muted);margin-top:3px;">📍 ' + escHtml(addr) + '</div>';
  html += '</div>';
  html += '<div class="report-bldg-sketch">' + buildElevationSVG(s) + '</div>';
  html += '<p style="font-size:.72rem;color:var(--text-muted);text-align:center;margin:-4px 0 14px;">Procedure per Table 28.2-1, ASCE 7-22</p>';

  /* STEP 1 */
  var rcFig = {I:'26.5-1A', II:'26.5-1B', III:'26.5-1B', IV:'26.5-1C'}[s.riskCategory] || '26.5-1B';
  html += stepBlock(1, 'Determine Risk Category of the building', '&#167;Table 1.5-1',
    '<p>Risk Category: <strong class="step-result">' + escHtml(s.riskCategory||'II') + '</strong></p>');

  /* STEP 2 */
  html += stepBlock(2, 'Determine basic wind speed V for the applicable risk category', '&#167;26.5, Fig. ' + rcFig,
    '<div class="step-formula">V = <span class="step-result">' + fv(s.V,0) + ' mph</span></div>' +
    '<p class="step-sub">Risk Category ' + escHtml(s.riskCategory||'II') + ' — Figure ' + rcFig + '</p>');

  /* STEP 3 */
  var expDesc = {B:'Suburban/wooded areas (Sec. 26.7)', C:'Open terrain with scattered obstructions (Sec. 26.7)', D:'Flat, unobstructed areas near water (Sec. 26.7)'}[s.exposure] || '';
  var kztNote = s.kztMode === 'auto' ? 'K<sub>zt</sub> = (1+K₁K₂K₃)\xb2 from hill geometry (Fig. 26.8-1).' : 'Flat terrain, K<sub>zt</sub> = 1.0 (Sec. 26.8.1).';
  var gcpiStr = {enclosed:'\xb10.18', partiallyEnclosed:'\xb10.55', partiallyOpen:'0.00', open:'0.00'}[s.enclosure] || ('\xb1'+fv(gcpiObj.pos,2));
  html += stepBlock(3, 'Determine wind load parameters', '&#167;26.6 – 26.13',
    '<table class="step-tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Reference</th></tr></thead><tbody>' +
    '<tr><td>Directionality factor K<sub>d</sub></td><td><strong>0.85</strong></td><td>Table 26.6-1, Buildings (MWFRS)</td></tr>' +
    '<tr><td>Exposure category</td><td><strong>' + escHtml(s.exposure||'C') + '</strong></td><td>' + expDesc + '</td></tr>' +
    '<tr><td>Topographic factor K<sub>zt</sub></td><td><strong>' + fv(kztV,3) + '</strong></td><td>' + kztNote + '</td></tr>' +
    '<tr><td>Ground elevation factor K<sub>e</sub></td><td><strong>' + fv(r.ke,3) + '</strong></td><td>K<sub>e</sub> = e<sup>−0.000119\xd7' + fv(s.groundElev||0,0) + '</sup>, z<sub>e</sub> = ' + fv(s.groundElev||0,0) + ' ft AMSL</td></tr>' +
    '<tr><td>Gust factor G</td><td><strong>0.85</strong></td><td>Rigid structure (f ≥ 1 Hz), Sec. 26.11.1</td></tr>' +
    '<tr><td>Enclosure classification</td><td><strong>' + escHtml(encLabel) + '</strong></td><td>Sec. 26.12</td></tr>' +
    '<tr><td>Internal pressure coeff. (GC<sub>pi</sub>)</td><td><strong>' + gcpiStr + '</strong></td><td>Table 26.13-1</td></tr>' +
    '</tbody></table>');

  /* STEP 4 */
  var expZg = {B:1200, C:900, D:700}[s.exposure] || 900;
  var expAlpha = {B:7.0, C:9.5, D:11.5}[s.exposure] || 9.5;
  html += stepBlock(4, 'Determine velocity pressure exposure coefficient K<sub>h</sub>', '&#167;26.10, Table 26.10-1',
    '<p>Exposure ' + escHtml(s.exposure||'C') + ': z<sub>g</sub> = ' + expZg + ' ft, α = ' + expAlpha + '</p>' +
    '<div class="step-formula">K<sub>h</sub> = 2.01 \xd7 (' + fv(h,1) + ' / ' + expZg + ')<sup>2/' + expAlpha + '</sup> = <span class="step-result">' + fv(r.kh,3) + '</span> &nbsp; at h = ' + fv(h,1) + ' ft</div>' +
    '<p class="step-sub">Ch. 28 uses K<sub>h</sub> (at mean roof height) for all surfaces — single velocity pressure q<sub>h</sub>.</p>');

  /* STEP 5 */
  html += stepBlock(5, 'Determine velocity pressure q<sub>h</sub>', '&#167;26.10, Eq. 26.10-1',
    '<div class="step-formula">q<sub>h</sub> = 0.00256 \xd7 K<sub>h</sub> \xd7 K<sub>zt</sub> \xd7 K<sub>e</sub> \xd7 V\xb2</div>' +
    '<div class="step-formula">q<sub>h</sub> = 0.00256 \xd7 ' + fv(r.kh,3) + ' \xd7 ' + fv(kztV,3) + ' \xd7 ' + fv(r.ke,3) + ' \xd7 ' + fv(s.V,0) + '\xb2 = <span class="step-result">' + fpf(r.qh) + '</span></div>');

  /* STEP 6 — GCpf */
  var a = r.a || 0;
  var wallSet = {'4':1,'5':1,'6':1,'4E':1,'5E':1,'6E':1};
  var zDesc = {
    '1':'Roof end zone (windward)', '2':'Roof interior', '3':'Roof end zone (leeward)',
    '4':'Wall end zone', '5':'Wall interior zone (PTR)', '6':'Wall leeward zone (PTR)',
    '1E':'Roof corner zone (WW)','2E':'Roof corner zone (interior)','3E':'Roof corner zone (LW)',
    '4E':'Wall corner zone','5E':'Wall interior corner (PTR)','6E':'Wall leeward corner (PTR)'
  };

  function gcpfTbl(zones, label) {
    var t = '<p style="margin-top:8px;"><strong>' + label + ':</strong></p>';
    t += '<table class="step-tbl"><thead><tr><th>Zone</th><th>Type</th><th>(GCpf)</th></tr></thead><tbody>';
    zones.forEach(function(z) {
      t += '<tr><td><strong>' + z.zone + '</strong></td>' +
           '<td>' + (wallSet[z.zone] ? 'Wall' : 'Roof') + ' — ' + escHtml(zDesc[z.zone]||z.zone) + '</td>' +
           '<td class="' + (z.gcpf < 0 ? 't-neg' : 't-pos') + '">' + fv(z.gcpf,3) + '</td></tr>';
    });
    t += '</tbody></table>';
    return t;
  }

  html += stepBlock(6, 'Determine external pressure coefficients (GCpf)', '&#167;28.3, Fig. 28.3-1',
    '<p>Zone dimension: <strong>a = min[0.1\xd7min(B,L), 0.4h] = <span class="step-result">' + fv(a,2) + ' ft</span></strong> (Fig. 28.3-1 Notation)</p>' +
    '<p class="step-sub">B = ' + fv(B,1) + ' ft, L = ' + fv(L,1) + ' ft, h = ' + fv(h,1) + ' ft, θ = ' + fv(s.theta||0,1) + '\xb0</p>' +
    gcpfTbl(r.mwfrsLC1, 'Load Case 1 — Wind Normal to Ridge (θ-dependent, Fig. 28.3-1)') +
    gcpfTbl(r.mwfrsLC2, 'Load Case 2 — Wind Parallel to Ridge (θ-independent, Fig. 28.3-1)'));

  /* STEP 7 — pressures */
  function pressTbl(zones, lcLabel) {
    var t = '<p style="margin-top:8px;"><strong>' + lcLabel + ':</strong></p>';
    t += '<table class="step-tbl"><thead><tr>' +
         '<th>Zone</th><th>Type</th><th>(GCpf)</th>' +
         '<th>p min (psf)</th><th>p max (psf)</th><th>Gov. (psf)</th></tr></thead><tbody>';
    zones.forEach(function(z) {
      var isWall = !!wallSet[z.zone];
      var pMin = z.p.min, pMax = z.p.max;
      var gov = isWall ? pMax : pMin;   // walls: max inward; roof: min (suction governs)
      t += '<tr><td><strong>' + z.zone + '</strong></td>' +
           '<td>' + (isWall ? 'Wall' : 'Roof') + '</td>' +
           '<td>' + fv(z.gcpf,3) + '</td>' +
           '<td class="t-neg">' + fv(pMin,2) + '</td>' +
           '<td class="t-pos">' + fv(pMax,2) + '</td>' +
           '<td class="t-gov">' + fv(gov,2) + '</td></tr>';
    });
    t += '</tbody></table>';
    return t;
  }

  html += stepBlock(7, 'Calculate wind pressure p on each surface', '&#167;28.3, Eq. 28.3-1',
    '<div class="step-formula">p = q<sub>h</sub> \xd7 K<sub>d</sub> \xd7 [(GCpf) − (GCpi)]</div>' +
    '<div class="step-formula">p = ' + fpf(r.qh) + ' \xd7 0.85 \xd7 [(GCpf) − (\xb1' + fv(gcpiObj.pos,2) + ')]</div>' +
    '<p class="step-sub">p min: pairs GCpf with +GCpi (worst suction). &nbsp; p max: pairs GCpf with −GCpi (worst inward).</p>' +
    pressTbl(r.mwfrsLC1, 'Load Case 1 — Wind Normal to Ridge') +
    pressTbl(r.mwfrsLC2, 'Load Case 2 — Wind Parallel to Ridge') +
    (r.torsionApplies
      ? '<p style="margin-top:10px;">⚠️ h = ' + fv(h,1) + ' ft &gt; 30 ft — <strong>Torsional Load Cases 3 &amp; 4 apply (Fig. 28.3-2).</strong> ' +
        'Use 75 % of LC1/LC2 pressures plus torsional moment M<sub>T</sub>.</p>'
      : '<p class="step-sub">h = ' + fv(h,1) + ' ft ≤ 30 ft — torsional load cases (LC3/LC4) not required.</p>'));

  /* STEP 8 */
  var minW = r.mwfrsMinGoverns ? '<span class="step-result">✅ 16.0 psf minimum governs</span>' : '16.0 psf minimum — does not govern';
  html += stepBlock(8, 'Minimum design wind loads', '&#167;28.3.4',
    '<p>Walls: ' + minW + '</p>' +
    '<p>Roof: Minimum roof pressures checked per Sec. 28.3.4.</p>');

  /* Summary */
  html += '<div class="report-summary-box">';
  html += '<div class="report-summary-title">Design Wind Pressures Summary — MWFRS Envelope Procedure (Ch. 28)</div>';
  html += '<table class="pres-tbl"><thead><tr><th>Zone</th><th>Type</th><th>Load Case</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';

  function summRows(zones, lc) {
    zones.forEach(function(z) {
      var isW = !!wallSet[z.zone];
      html += '<tr' + (isW ? '' : ' class="s-gov-row"') + '>' +
        '<td class="s-label">' + z.zone + '</td>' +
        '<td>' + (isW ? 'Wall' : 'Roof') + '</td>' +
        '<td>' + lc + '</td>' +
        '<td class="s-neg">' + fv(z.p.min,1) + '</td>' +
        '<td class="s-pos">' + fv(z.p.max,1) + '</td></tr>';
    });
  }
  summRows(r.mwfrsLC1, 'LC1');
  summRows(r.mwfrsLC2, 'LC2');
  html += '</tbody></table></div>';
  return html;
}

/* ── C&C Ch.30 Step Report — Table 30.2-1 ──────────────────────────────── */
function buildCCStepReport(r, s) {
  function fv(v, d) { return (typeof v === 'number') ? v.toFixed(d != null ? d : 2) : '—'; }
  function fpf(v)   { return fv(v, 2) + ' psf'; }
  function warn(msg) {
    return '<div class="report-warn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>' + msg + '</span></div>';
  }
  if (!r) return warn('Calculation error — check your inputs.');

  var h      = s.h || 20;
  var kztV   = s.kzt || 1.0;
  var enc    = s.enclosure || 'enclosed';
  var encMap = {enclosed:'Enclosed', partiallyEnclosed:'Partially Enclosed', partiallyOpen:'Partially Open', open:'Open', openFreeRoof:'Open (Free Roof)'};
  var encLabel = encMap[enc] || enc;
  var gcpiObj  = r.gcpi || { pos: 0.18, neg: -0.18 };
  var gcpiStr  = {enclosed:'\xb10.18', partiallyEnclosed:'\xb10.55', partiallyOpen:'0.00', open:'0.00', openFreeRoof:'N/A'}[enc] || ('\xb1' + fv(gcpiObj.pos, 2));
  var addrEl   = document.getElementById('wind-address');
  var addr     = addrEl ? addrEl.value.trim() : '';
  var roofNames = {gable:'Gable', hip:'Hip', flat:'Flat', monoslope:'Monoslope', stepped:'Stepped', multispan:'Multispan Gable', sawtooth:'Sawtooth', dome:'Domed'};
  var roofLabel = roofNames[s.roofShape] || s.roofShape || '—';
  var a    = r.a || 0;
  var Aw   = s.areaWall || 20;
  var Ar   = s.areaRoof || 50;
  var expZg    = {B:1200, C:900, D:700}[s.exposure] || 900;
  var expAlpha = {B:7.0, C:9.5, D:11.5}[s.exposure] || 9.5;
  var expDesc  = {B:'Suburban/wooded areas', C:'Open terrain, scattered obstructions', D:'Flat, unobstructed near water'}[s.exposure] || '';

  var isOpenBldg = enc === 'openFreeRoof';
  var isPart2    = !isOpenBldg && (s.ccProcedure === 'part2' || h > 60);
  var isPart1    = !isOpenBldg && !isPart2;

  var procLabel = isOpenBldg ? 'Open Building — Sec. 30.5 (Figs. 30.5-1/2/3)' :
                  isPart2    ? 'Part 2 — h > 60 ft (Sec. 30.4, Fig. 30.4-1)' :
                               'Part 1 — h ≤ 60 ft (Sec. 30.3, Figs. 30.3-1–30.3-7)';
  var html = '';

  /* ── Header ──────────────────────────────────────────────────────── */
  html += '<div class="report-proc-head">';
  html += '<div class="report-proc-title">Components &amp; Cladding (C&amp;C)</div>';
  html += '<div class="report-proc-sub">ASCE 7-22 Chapter 30 — ' + procLabel + ' — ' + escHtml(encLabel) + ' Building</div>';
  if (addr) html += '<div style="font-size:.73rem;color:var(--text-muted);margin-top:3px;">📍 ' + escHtml(addr) + '</div>';
  html += '</div>';
  html += '<div class="report-bldg-sketch">' + buildElevationSVG(s) + '</div>';
  html += '<p style="font-size:.72rem;color:var(--text-muted);text-align:center;margin:-4px 0 14px;">Procedure per Table 30.2-1, ASCE 7-22</p>';

  /* ── Steps 1–5 ───────────────────────────────────────────────────── */
  var rcFig = {I:'26.5-1A', II:'26.5-1B', III:'26.5-1B', IV:'26.5-1C'}[s.riskCategory] || '26.5-1B';
  html += stepBlock(1, 'Determine Risk Category', '&#167;Table 1.5-1',
    '<p>Risk Category: <strong class="step-result">' + escHtml(s.riskCategory || 'II') + '</strong></p>');

  html += stepBlock(2, 'Determine basic wind speed V', '&#167;26.5, Fig. ' + rcFig,
    '<div class="step-formula">V = <span class="step-result">' + fv(s.V, 0) + ' mph</span></div>');

  var kztNote = s.kztMode === 'auto' ? 'K<sub>zt</sub> = (1+K₁K₂K₃)², hill geometry' : 'Flat terrain — K<sub>zt</sub> = 1.0';
  html += stepBlock(3, 'Determine wind load parameters', '&#167;26.6–26.13',
    '<table class="step-tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Reference</th></tr></thead><tbody>' +
    '<tr><td>K<sub>d</sub></td><td><strong>0.85</strong></td><td>Table 26.6-1</td></tr>' +
    '<tr><td>Exposure</td><td><strong>' + escHtml(s.exposure || 'C') + '</strong></td><td>' + expDesc + ' (Sec. 26.7)</td></tr>' +
    '<tr><td>K<sub>zt</sub></td><td><strong>' + fv(kztV, 3) + '</strong></td><td>' + kztNote + ' (Sec. 26.8)</td></tr>' +
    '<tr><td>K<sub>e</sub></td><td><strong>' + fv(r.ke, 3) + '</strong></td><td>z<sub>e</sub> = ' + fv(s.groundElev || 0, 0) + ' ft AMSL (Sec. 26.9)</td></tr>' +
    (isOpenBldg ? '<tr><td>Gust factor G</td><td><strong>0.85</strong></td><td>Rigid structure, Sec. 26.11.1</td></tr>' : '') +
    '<tr><td>Enclosure</td><td><strong>' + escHtml(encLabel) + '</strong></td><td>Sec. 26.12</td></tr>' +
    (isOpenBldg ? '' : '<tr><td>(GC<sub>pi</sub>)</td><td><strong>' + gcpiStr + '</strong></td><td>Table 26.13-1</td></tr>') +
    '</tbody></table>');

  html += stepBlock(4, 'Determine velocity pressure exposure coefficient K<sub>h</sub>', '&#167;26.10, Table 26.10-1',
    '<div class="step-formula">K<sub>h</sub> = 2.01 × (' + fv(h, 1) + ' / ' + expZg + ')<sup>2/' + expAlpha + '</sup> = <span class="step-result">' + fv(r.kh, 3) + '</span> &nbsp; at h = ' + fv(h, 1) + ' ft</div>' +
    (isPart2 ? '<p class="step-sub">Part 2 (h > 60 ft): windward wall +GCp uses q<sub>z</sub> (height-varying); all suction and roof use q<sub>h</sub>.</p>' : ''));

  html += stepBlock(5, 'Determine velocity pressure q<sub>h</sub>', '&#167;26.10, Eq. 26.10-1',
    '<div class="step-formula">q<sub>h</sub> = 0.00256 × ' + fv(r.kh, 3) + ' × ' + fv(kztV, 3) + ' × ' + fv(r.ke, 3) + ' × ' + fv(s.V, 0) + '² = <span class="step-result">' + fpf(r.qh) + '</span></div>');

  /* ── Step 6 — GCp / CN figure references ────────────────────────── */
  var step6Body = '';
  if (isOpenBldg) {
    var c305 = r.cc30s305;
    var shLab = {monoslope:'Monoslope', pitched:'Pitched (Gable)', troughed:'Troughed'}[c305 ? c305.shape : ''] || '—';
    step6Body = '<p>Open building — net force coefficient C<sub>N</sub> (no GC<sub>pi</sub> applied).</p>' +
      '<table class="step-tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead><tbody>' +
      '<tr><td>Roof type</td><td><strong>' + shLab + '</strong></td><td>' + (c305 ? ('Fig. 30.5-' + (c305.shape==='monoslope'?'1':c305.shape==='pitched'?'2':'3')) : '—') + '</td></tr>' +
      '<tr><td>Wind flow</td><td>' + (c305 && c305.obstr ? 'Obstructed (&gt;50%)' : 'Clear (≤50%)') + '</td><td>Fig. 30.5-1 Note 2</td></tr>' +
      '<tr><td>Zone width a</td><td><strong>' + fv(c305 ? c305.a : 0, 2) + ' ft</strong></td><td>min(0.1L<sub>min</sub>, 0.4h) ≥ max(0.04L<sub>min</sub>, 3 ft)</td></tr>' +
      '<tr><td>h/L</td><td>' + fv(c305 ? c305.hL : 0, 3) + '</td><td>0.25 ≤ h/L ≤ 1.0 required</td></tr>' +
      '<tr><td>Effective area A</td><td>' + fv(c305 ? c305.A : 0, 1) + ' ft²</td><td>—</td></tr>' +
      '<tr><td>Area bracket</td><td>' + escHtml(c305 ? c305.areaLabel : '—') + '</td><td>Fig. table rows</td></tr>' +
      '</tbody></table>';
  } else if (isPart2) {
    var p2 = r.cc30p2;
    step6Body = '<p><strong>Sec. 30.4, Fig. 30.4-1</strong> — applicable for h &gt; 60 ft, enclosed/partially enclosed.</p>';
    step6Body += '<p>Zone dimension a = <strong>' + fv(a, 2) + ' ft</strong>; A<sub>wall</sub> = ' + fv(p2 ? p2.Aw : Aw, 0) + ' ft², A<sub>roof</sub> = ' + fv(p2 ? p2.Ar : Ar, 0) + ' ft²</p>';
    if (p2) {
      step6Body += '<table class="step-tbl"><thead><tr><th>Zone</th><th>Surface</th><th>(GCp) min</th><th>(GCp) max</th></tr></thead><tbody>';
      step6Body += '<tr><td>4</td><td>Wall field</td><td class="t-neg">' + fv(p2.gc4.neg,3) + '</td><td class="t-pos">' + fv(p2.gc4.pos,3) + '</td></tr>';
      step6Body += '<tr><td>5</td><td>Wall corner</td><td class="t-neg">' + fv(p2.gc5.neg,3) + '</td><td class="t-pos">' + fv(p2.gc5.pos,3) + '</td></tr>';
      if (p2.roofApplicable && p2.roofZones) {
        p2.roofZones.forEach(function(z) {
          step6Body += '<tr><td>' + z.zone + '</td><td>Roof (θ ≤ 7°)</td><td class="t-neg">' + fv(z.gcp.neg,3) + '</td><td class="t-pos">' + fv(z.gcp.pos,3) + '</td></tr>';
        });
      } else if (p2.roofSlopedP2) {
        p2.roofSlopedP2.zones.forEach(function(z) {
          step6Body += '<tr><td>' + z.zone + '</td><td>Roof (θ &gt; 7°, Part 1 GCp per Note 6)</td><td class="t-neg">' + fv(z.gcp.neg,3) + '</td><td class="t-pos">' + fv(z.gcp.pos,3) + '</td></tr>';
        });
      }
      step6Body += '</tbody></table>';
    }
  } else {
    step6Body = '<p>Zone dimension a = <strong>' + fv(a,2) + ' ft</strong> (Fig. 30.3-1 Notation); A<sub>w</sub> = ' + fv(Aw,0) + ' ft², A<sub>r</sub> = ' + fv(Ar,0) + ' ft²</p>';
    var figRows = [['Walls (Zones 4, 5)', 'Fig. 30.3-1', 'All enclosed buildings']];
    if (s.theta <= 7) {
      figRows.push(["Flat/low-slope roof (θ ≤ 7°, Zones 1', 1, 2, 3)", 'Fig. 30.3-2A', '']);
    } else if (s.roofShape === 'gable') {
      figRows.push(['Gable roof (θ > 7°, Zones 1, 2, 3)', 'Figs. 30.3-2B/2C', 'θ ≤ 27° from figures' + (r.roofCapped ? '; ⚠ capped' : '')]);
    } else if (s.roofShape === 'hip') {
      figRows.push(['Hip roof (θ > 7°, Zones 1, 2, 3)', 'Figs. 30.3-2D–2G', r.roofCapped ? '⚠ capped at max θ' : '']);
    }
    if (r.monoslopeRoof) figRows.push(["Monoslope roof (Zones 1, 2, 2', 3, 3')", r.monoslopeRoof.is5A ? 'Fig. 30.3-5A' : 'Fig. 30.3-5B', 'θ = 3°–30°; enhanced edge 2a=' + fv(a*2,2) + ' ft']);
    if (r.steppedRoof) figRows.push(['Stepped roof (Zones 1, 2, 3 — lower level)', 'Fig. 30.3-3', 'Step zone = 1.5×h_s = ' + fv(r.steppedRoof.aStep,2) + ' ft']);
    if (r.multispanRoof) figRows.push(['Multispan gable (Zones 1, 2, 3)', 'Fig. 30.3-4', 'Module W = ' + fv(s.msModuleW||0,1) + ' ft']);
    if (r.sawtoothRoof) figRows.push(['Sawtooth roof (Zones 1, 2, 3)', 'Fig. 30.3-6', 'Low-eave zone 2a = ' + fv(r.sawtoothRoof.aLow,2) + ' ft']);
    if (r.domeRoof) figRows.push(['Domed roof', 'Fig. 30.3-7', 'q at top z = ' + fv(r.domeRoof.domeTopZ,1) + ' ft']);
    if (r.ccOverhang && r.ccOverhang.length) figRows.push(['Roof overhangs (Zones 2, 3)', 'Sec. 30.7', 'Net: top + soffit; no GCpi']);
    if (r.parapet) figRows.push(['Parapet C&amp;C (Zones 4, 5)', 'Eq. 30.6-1', 'q<sub>p</sub> at z = ' + fv(r.parapet.zParapet,1) + ' ft']);
    if (r.canopy) figRows.push(['Attached canopy', 'Sec. 30.9, ' + escHtml(r.canopy.figRefSep || '—'), 'A = ' + fv(r.canopy.A,1) + ' ft²']);
    if (r.circTank) figRows.push(['Circular bin/silo/tank', 'Sec. 30.10', 'D=' + fv(s.tankD||0,1) + ' ft, H=' + fv(s.tankH||0,1) + ' ft, H/D=' + fv(r.circTank.HD,2)]);
    step6Body += '<table class="step-tbl"><thead><tr><th>Surface / Type</th><th>Figure</th><th>Notes</th></tr></thead><tbody>';
    figRows.forEach(function(row) {
      step6Body += '<tr><td>' + row[0] + '</td><td><strong>' + row[1] + '</strong></td><td class="step-sub">' + (row[2]||'—') + '</td></tr>';
    });
    step6Body += '</tbody></table>';
  }
  html += stepBlock(6, 'Determine external pressure coefficients',
    isOpenBldg ? '&#167;30.5' : isPart2 ? '&#167;30.4, Fig. 30.4-1' : '&#167;30.3, Figs. 30.3-1–30.3-7',
    step6Body);

  /* ── Step 7 — Design pressures ───────────────────────────────────── */
  var s7 = '';
  if (isOpenBldg) {
    s7 += '<div class="step-formula">p = q<sub>h</sub> × K<sub>d</sub> × G × C<sub>N</sub> &nbsp;(Eq. 30.5-1)</div>';
  } else if (isPart2) {
    s7 += '<div class="step-formula">Windward (+GCp): p = q<sub>z</sub>×K<sub>d</sub>×(+GCp) + q<sub>h</sub>×K<sub>d</sub>×|GCpi| &nbsp;(Eq. 30.4-1, Note 4)</div>';
    s7 += '<div class="step-formula">Suction/all others: p = q<sub>h</sub>×K<sub>d</sub>×(GCp) − q<sub>h</sub>×K<sub>d</sub>×(GCpi)</div>';
  } else {
    s7 += '<div class="step-formula">p = q<sub>h</sub> × K<sub>d</sub> × [(GCp) − (GCpi)] &nbsp;(Eq. 30.3-1)</div>';
    s7 += '<div class="step-formula">p = ' + fpf(r.qh) + ' × 0.85 × [(GCp) − (' + gcpiStr + ')]</div>';
  }

  /* helper: standard zone table {zone, gcp:{neg,pos}, p:{min,max}} */
  function pTblCC(zones, caption, isWall) {
    if (!zones || !zones.length) return '';
    var wD = {'4':'Zone 4 — Wall field','5':'Zone 5 — Wall corner'};
    var rD = {'1p':"Zone 1’ — Flat field (low)",'1':'Zone 1 — Roof field','2':'Zone 2 — Roof eave/edge','3':'Zone 3 — Roof corner'};
    var t = '<p style="margin-top:10px"><strong>' + caption + '</strong></p>';
    t += '<table class="step-tbl"><thead><tr><th>Zone</th><th>Description</th><th>(GCp) min</th><th>(GCp) max</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';
    zones.forEach(function(z) {
      var d = isWall ? (wD[z.zone] || ('Zone ' + z.zone)) : (rD[z.zone] || ('Zone ' + z.zone));
      t += '<tr><td><strong>' + z.zone + '</strong></td><td>' + d + '</td>' +
        '<td class="t-neg">' + (z.gcp ? fv(z.gcp.neg,3) : '—') + '</td>' +
        '<td class="t-pos">' + (z.gcp ? fv(z.gcp.pos,3) : '—') + '</td>' +
        '<td class="t-neg">' + fv(z.p.min,2) + '</td>' +
        '<td class="t-pos">' + fv(z.p.max,2) + '</td></tr>';
    });
    return t + '</tbody></table>';
  }

  /* helper: special zone table where zone data = {gc:{neg,pos}, pMin, pMax} */
  function pTblSpec(rows, caption) {
    var t = caption ? '<p style="margin-top:10px"><strong>' + caption + '</strong></p>' : '';
    t += '<table class="step-tbl"><thead><tr><th>Zone</th><th>(GCp) min</th><th>(GCp) max</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';
    rows.forEach(function(row) {
      var d = row.data;
      t += '<tr><td><strong>' + row.label + '</strong></td>' +
        '<td class="t-neg">' + fv(d && d.gc ? d.gc.neg : null, 3) + '</td>' +
        '<td class="t-pos">' + fv(d && d.gc ? d.gc.pos : null, 3) + '</td>' +
        '<td class="t-neg">' + fv(d ? d.pMin : null, 2) + '</td>' +
        '<td class="t-pos">' + fv(d ? d.pMax : null, 2) + '</td></tr>';
    });
    return t + '</tbody></table>';
  }

  /* 7a: Part 1 standard walls + roof */
  if (isPart1) {
    s7 += pTblCC(r.ccWall, 'Walls — Zones 4 &amp; 5 (Fig. 30.3-1)', true);
    if (r.ccRoof && r.ccRoof.length) {
      var rfig = s.theta <= 7 ? 'Fig. 30.3-2A' : s.roofShape === 'gable' ? 'Figs. 30.3-2B/2C' : 'Figs. 30.3-2D–2G';
      var rcap = escHtml(roofLabel) + ' Roof — ' + rfig + ', θ = ' + fv(s.theta||0,1) + '°' + (r.roofCapped ? ' <em>(⚠ capped at fig. max)</em>' : '');
      s7 += pTblCC(r.ccRoof, rcap, false);
    } else if (s.roofShape === 'monoslope' && !r.monoslopeRoof) {
      s7 += '<p class="step-sub">⚠ Monoslope roof: standard Fig. 30.3-2A zones not applicable. See dedicated monoslope section below.</p>';
    }
  }

  /* 7b: Part 2 walls + roof */
  if (isPart2 && r.cc30p2) {
    var p2 = r.cc30p2;
    s7 += '<p style="margin-top:10px"><strong>Walls — Zones 4 &amp; 5, Height Profile (Fig. 30.4-1)</strong></p>';
    s7 += '<table class="step-tbl"><thead><tr><th>z (ft)</th><th>K<sub>z</sub></th><th>q<sub>z</sub> (psf)</th>' +
      '<th>Z4 p<sub>min</sub></th><th>Z4 p<sub>max</sub></th><th>Z5 p<sub>min</sub></th><th>Z5 p<sub>max</sub></th></tr></thead><tbody>';
    p2.wwProfile.forEach(function(row) {
      s7 += '<tr><td>' + fv(row.z,1) + '</td><td>' + fv(row.kz,3) + '</td><td>' + fv(row.qz,2) + '</td>' +
        '<td class="t-neg">' + fv(row.z4_pmin,2) + '</td><td class="t-pos">' + fv(row.z4_pmax,2) + '</td>' +
        '<td class="t-neg">' + fv(row.z5_pmin,2) + '</td><td class="t-pos">' + fv(row.z5_pmax,2) + '</td></tr>';
    });
    s7 += '</tbody></table>';
    if (p2.roofApplicable && p2.roofZones) {
      s7 += '<p style="margin-top:10px"><strong>Roof — Zones 1, 2, 3 (Fig. 30.4-1, θ ≤ 7°)</strong></p>';
      s7 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>(GCp) min</th><th>(GCp) max</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';
      p2.roofZones.forEach(function(z) {
        s7 += '<tr><td><strong>' + z.zone + '</strong></td>' +
          '<td class="t-neg">' + fv(z.gcp.neg,3) + '</td><td class="t-pos">' + fv(z.gcp.pos,3) + '</td>' +
          '<td class="t-neg">' + fv(z.pMin,2) + '</td><td class="t-pos">' + fv(z.pMax,2) + '</td></tr>';
      });
      s7 += '</tbody></table>';
    } else if (p2.roofSlopedP2) {
      var rsp = p2.roofSlopedP2;
      s7 += '<p style="margin-top:10px"><strong>' + escHtml(roofNames[rsp.shape]||rsp.shape) + ' Roof — θ = ' + fv(rsp.theta,1) + '° &gt; 7°, Part 1 GCp per Fig. 30.4-1 Note 6</strong></p>';
      s7 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>(GCp) min</th><th>(GCp) max</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';
      rsp.zones.forEach(function(z) {
        s7 += '<tr><td><strong>' + z.zone + (z.capped?' ⚠':'') + '</strong></td>' +
          '<td class="t-neg">' + fv(z.gcp.neg,3) + '</td><td class="t-pos">' + fv(z.gcp.pos,3) + '</td>' +
          '<td class="t-neg">' + fv(z.pMin,2) + '</td><td class="t-pos">' + fv(z.pMax,2) + '</td></tr>';
      });
      s7 += '</tbody></table>';
    }
  }

  /* 7c: Open building Sec. 30.5 */
  if (isOpenBldg && r.cc30s305) {
    var c = r.cc30s305;
    if (c.warnings && c.warnings.length) {
      s7 += '<div class="report-warn"><span>⚠ ' + escHtml(c.warnings.join(' • ')) + '</span></div>';
    }
    var shp305 = {monoslope:'Monoslope',pitched:'Pitched',troughed:'Troughed'}[c.shape] || c.shape;
    s7 += '<p style="margin-top:10px"><strong>Net Wind Pressures — ' + escHtml(shp305) + ' Free Roof, θ = ' + fv(c.theta,1) + '°, h/L = ' + fv(c.hL,3) + '</strong></p>';
    s7 += '<p class="step-sub">+ toward top surface; − away from top surface. Apply all + and − cases.</p>';
    s7 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>C<sub>N</sub> (+)</th><th>C<sub>N</sub> (−)</th><th>p (+) psf</th><th>p (−) psf</th></tr></thead><tbody>';
    ['Z3','Z2','Z1'].forEach(function(zk) {
      var z = c.zones[zk];
      s7 += '<tr><td><strong>' + escHtml(z.label) + '</strong></td>' +
        '<td class="t-pos">' + fv(z.CNp,2) + '</td><td class="t-neg">' + fv(z.CNn,2) + '</td>' +
        '<td class="t-pos">' + fv(z.pp,2) + '</td><td class="t-neg">' + fv(z.pn,2) + '</td></tr>';
    });
    s7 += '</tbody></table><p class="step-sub">Area bracket: ' + escHtml(c.areaLabel) + ' (A = ' + fv(c.A,1) + ' ft²). ' + escHtml(c.figRef) + ', ASCE 7-22.</p>';
  }

  /* 7d: Monoslope roof C&C (Fig. 30.3-5A/5B) */
  if (r.monoslopeRoof) {
    var mr = r.monoslopeRoof;
    if (!mr.applicable) {
      s7 += '<div class="report-warn"><span>Monoslope C&amp;C (Figs. 30.3-5A/5B): θ = ' + fv(mr.theta,1) + '° outside 3°–30° range. Use engineering judgment.</span></div>';
    } else {
      s7 += '<p style="margin-top:12px"><strong>Monoslope Roof C&amp;C — ' + (mr.is5A ? 'Fig. 30.3-5A (3°–10°)' : 'Fig. 30.3-5B (10°–30°)') + ', θ = ' + fv(mr.theta,1) + '°</strong></p>';
      s7 += '<p class="step-sub">Zone a = ' + fv(mr.a,2) + ' ft; enhanced high-eave zone = 2a = ' + fv(mr.a*2,2) + ' ft' + (mr.is5A ? '; corners 4a = ' + fv(mr.a*4,2) + ' ft' : '') + '.</p>';
      var mrows = [{label:'Zone 1 — Field', data:mr.zone1}, {label:'Zone 2 — Low-eave edge (a)', data:mr.zone2}];
      if (mr.zone2p) mrows.push({label:"Zone 2’ — High-eave edge (2a)", data:mr.zone2p});
      mrows.push({label:'Zone 3 — Low-eave corner', data:mr.zone3});
      if (mr.zone3p) mrows.push({label:"Zone 3’ — High-eave corner (4a)", data:mr.zone3p});
      s7 += pTblSpec(mrows, '');
    }
  }

  /* 7e: Stepped roof */
  if (r.steppedRoof) {
    var sr = r.steppedRoof;
    s7 += '<p style="margin-top:12px"><strong>Stepped Roof C&amp;C — Fig. 30.3-3</strong></p>';
    s7 += '<p class="step-sub">h<sub>tall</sub> = ' + fv(sr.hTall,1) + ' ft, h<sub>low</sub> = ' + fv(sr.hLow,1) + ' ft, h<sub>s</sub> = ' + fv(sr.hs,2) + ' ft. Zone a = ' + fv(sr.aMain,2) + ' ft; step zone = 1.5×h<sub>s</sub> = ' + fv(sr.aStep,2) + ' ft' + (sr.aStepCapped ? ' (capped at W<sub>low</sub>)' : '') + '.</p>';
    s7 += '<p class="step-sub">GCp from Fig. 30.3-2A (flat roof), per Fig. 30.3-3 Note.</p>';
    s7 += pTblSpec([{label:'Zone 1 — Roof field',data:sr.zone1},{label:'Zone 2 — Eave edge',data:sr.zone2},{label:'Zone 3 — Roof corner',data:sr.zone3}], '');
  }

  /* 7f: Multispan gable */
  if (r.multispanRoof) {
    var mr2 = r.multispanRoof;
    var mrref = mr2.thetaLE10 ? 'Fig. 30.3-4 Note 5 → Fig. 30.3-2A GCp' : 'Fig. 30.3-4' + (mr2.capped ? ' (⚠ capped at 45°)' : '');
    s7 += '<p style="margin-top:12px"><strong>Multispan Gable C&amp;C — ' + mrref + ', θ = ' + fv(mr2.theta,1) + '°</strong></p>';
    s7 += '<p class="step-sub">Module W = ' + fv(mr2.Wp,1) + ' ft; L<sub>mod</sub> = ' + fv(mr2.Lmod,1) + ' ft; zone a = ' + fv(mr2.a,2) + ' ft.</p>';
    s7 += pTblSpec([{label:'Zone 1',data:mr2.zone1},{label:'Zone 2',data:mr2.zone2},{label:'Zone 3',data:mr2.zone3}], '');
  }

  /* 7g: Sawtooth */
  if (r.sawtoothRoof) {
    var sw = r.sawtoothRoof;
    var swref = sw.thetaLE10 ? 'Fig. 30.3-6 Note 5 → Fig. 30.3-2A GCp' : 'Fig. 30.3-6';
    s7 += '<p style="margin-top:12px"><strong>Sawtooth Roof C&amp;C — ' + swref + ', θ = ' + fv(sw.theta,1) + '°</strong></p>';
    s7 += '<p class="step-sub">Span W = ' + fv(sw.Wsp,1) + ' ft; zone a = ' + fv(sw.a,2) + ' ft; low-eave zone 2a = ' + fv(sw.aLow,2) + ' ft.</p>';
    var swrows = [{label:'Zone 1',data:sw.zone1},{label:'Zone 2',data:sw.zone2}];
    if (sw.thetaLE10) {
      swrows.push({label:'Zone 3',data:sw.zone3});
    } else {
      swrows.push({label:'Zone 3 — Span A (windward)',data:sw.zone3SpanA},{label:'Zone 3 — Spans B, C, D',data:sw.zone3SpansBCD});
    }
    s7 += pTblSpec(swrows, '');
  }

  /* 7h: Dome */
  if (r.domeRoof) {
    var dr = r.domeRoof;
    s7 += '<p style="margin-top:12px"><strong>Domed Roof C&amp;C — Fig. 30.3-7</strong></p>';
    s7 += '<p class="step-sub">D=' + fv(dr.D,1) + ' ft, f=' + fv(dr.f,1) + ' ft, h<sub>D</sub>=' + fv(dr.hD,1) + ' ft; dome top z=' + fv(dr.domeTopZ,1) + ' ft → q<sub>dome</sub>=' + fpf(dr.qDome) + ' (K<sub>z</sub>=' + fv(dr.kzDome,3) + ')</p>';
    if (dr.outOfRange) s7 += '<div class="report-warn"><span>⚠ h<sub>D</sub>/D=' + fv(dr.hDoverD,3) + ', f/D=' + fv(dr.fOverD,3) + ' — outside Fig. 30.3-7 range (h<sub>D</sub>/D≤0.5, 0.2≤f/D≤0.5).</span></div>';
    s7 += '<table class="step-tbl"><thead><tr><th>Case</th><th>θ range</th><th>(GCp)</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';
    s7 += '<tr><td>Uplift</td><td>0°–90°</td><td class="t-neg">' + fv(dr.gcpNeg,2) + '</td><td class="t-neg">' + fv(dr.pNeg.min,2) + '</td><td>' + fv(dr.pNeg.max,2) + '</td></tr>';
    s7 += '<tr><td>Inward (apex)</td><td>0°–60°</td><td class="t-pos">' + fv(dr.gcpPosLow,2) + '</td><td>' + fv(dr.pPosLow.min,2) + '</td><td class="t-pos">' + fv(dr.pPosLow.max,2) + '</td></tr>';
    s7 += '<tr><td>Inward (apex)</td><td>61°–90°</td><td class="t-pos">' + fv(dr.gcpPosHigh,2) + '</td><td>' + fv(dr.pPosHigh.min,2) + '</td><td class="t-pos">' + fv(dr.pPosHigh.max,2) + '</td></tr>';
    s7 += '</tbody></table>';
  }

  /* 7i: Roof overhangs */
  if (r.ccOverhang && r.ccOverhang.length) {
    s7 += '<p style="margin-top:12px"><strong>Roof Overhangs — Sec. 30.7 (Net: Top Surface + Soffit, No GCpi)</strong></p>';
    s7 += '<p class="step-sub">p = q<sub>h</sub>×K<sub>d</sub>×GCp<sub>net</sub>; GCp<sub>net</sub> = roof GCp (top) + wall GCp (soffit). Zones 2 &amp; 3 only.</p>';
    s7 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>GCp net min</th><th>GCp net max</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';
    r.ccOverhang.forEach(function(z) {
      s7 += '<tr><td><strong>' + z.zone + '</strong></td>' +
        '<td class="t-neg">' + (z.gcp ? fv(z.gcp.neg,3) : '—') + '</td>' +
        '<td class="t-pos">' + (z.gcp ? fv(z.gcp.pos,3) : '—') + '</td>' +
        '<td class="t-neg">' + fv(z.p.min,2) + '</td><td class="t-pos">' + fv(z.p.max,2) + '</td></tr>';
    });
    s7 += '</tbody></table>';
  }

  /* 7j: Parapet C&C */
  if (r.parapet) {
    var pp = r.parapet;
    s7 += '<p style="margin-top:12px"><strong>Parapet C&amp;C — Eq. 30.6-1 (Sec. 30.6)</strong></p>';
    s7 += '<p class="step-sub">h<sub>p</sub>=' + fv(pp.hp,1) + ' ft; z<sub>p</sub>=' + fv(pp.zParapet,1) + ' ft; K<sub>h,p</sub>=' + fv(pp.khp,3) + '; q<sub>p</sub>=' + fpf(pp.qp) + '. No GCpi (both surfaces exterior).</p>';
    s7 += '<p class="step-sub">Load A: outward windward + inward leeward. Load B: inward windward + outward leeward.</p>';
    s7 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>Load A GCp</th><th>Load A p (psf)</th><th>Load B GCp</th><th>Load B p (psf)</th></tr></thead><tbody>';
    pp.ccParapet.forEach(function(z) {
      s7 += '<tr><td><strong>' + z.zone + '</strong></td>' +
        '<td>' + fv(z.gcA,3) + '</td><td class="' + (z.pA<0?'t-neg':'t-pos') + '">' + fv(z.pA,2) + '</td>' +
        '<td>' + fv(z.gcB,3) + '</td><td class="' + (z.pB<0?'t-neg':'t-pos') + '">' + fv(z.pB,2) + '</td></tr>';
    });
    s7 += '</tbody></table>';
  }

  /* 7k: Attached canopy */
  if (r.canopy) {
    var cn = r.canopy;
    s7 += '<p style="margin-top:12px"><strong>Attached Canopy — Sec. 30.9, ' + escHtml(cn.figRefSep||'—') + '/' + escHtml(cn.figRefNet||'—') + '</strong></p>';
    s7 += '<p class="step-sub">p = q<sub>h</sub>×K<sub>d</sub>×(GCp); A = ' + fv(cn.A,1) + ' ft²; h<sub>c</sub>/h<sub>e</sub> = ' + fv(cn.hcRatio,2) + '; ' + (cn.hGt60 ? 'h > 60 ft' : 'h ≤ 60 ft') + '.</p>';
    s7 += '<table class="step-tbl"><thead><tr><th>Loading</th><th>GCp</th><th>p (psf)</th></tr></thead><tbody>';
    s7 += '<tr><td>Separate: upper neg</td><td class="t-neg">' + fv(cn.sepNegUpper,3) + '</td><td class="t-neg">' + fv(cn.pSepUpperNeg,2) + '</td></tr>';
    s7 += '<tr><td>Separate: lower neg</td><td class="t-neg">' + fv(cn.sepNegLower,3) + '</td><td class="t-neg">' + fv(cn.pSepLowerNeg,2) + '</td></tr>';
    s7 += '<tr><td>Separate: pos</td><td class="t-pos">' + fv(cn.sepPos,3) + '</td><td class="t-pos">' + fv(cn.pSepPos,2) + '</td></tr>';
    s7 += '<tr><td>Net: neg</td><td class="t-neg">' + fv(cn.netNeg,3) + '</td><td class="t-neg">' + fv(cn.pNetNeg,2) + '</td></tr>';
    s7 += '<tr><td>Net: pos (band ' + escHtml(cn.netBand||'—') + ')</td><td class="t-pos">' + fv(cn.netPos,3) + '</td><td class="t-pos">' + fv(cn.pNetPos,2) + '</td></tr>';
    s7 += '</tbody></table>';
  }

  /* 7l: Circular bin/silo/tank */
  if (r.circTank) {
    var ct = r.circTank;
    s7 += '<p style="margin-top:12px"><strong>Circular Bin/Silo/Tank — Sec. 30.10 (Eq. 30.10-1)</strong></p>';
    s7 += '<p class="step-sub">D=' + fv(ct.D,1) + ' ft, H=' + fv(ct.H,1) + ' ft, H/D=' + fv(ct.HD,2) + (ct.HDCapped?' (⚠ capped to '+fv(ct.HDcap,2)+')':'') + '; ' + (ct.isOpenTop ? 'Open-top; GCpi<sub>open</sub>=' + fv(ct.openGcpi,3) : escHtml(ct.enclosureLabel||'—')) + '.</p>';
    s7 += '<table class="step-tbl"><thead><tr><th>α (°)</th><th>GCp</th>' + (ct.isOpenTop ? '<th>p (psf)</th>' : '<th>p min (psf)</th><th>p max (psf)</th>') + '</tr></thead><tbody>';
    ct.wallRows.forEach(function(row) {
      s7 += '<tr><td>' + row.alpha + '°</td><td>' + fv(row.gcp,3) + '</td>';
      s7 += ct.isOpenTop ? '<td>' + fv(row.p,2) + '</td>' : '<td class="t-neg">' + fv(row.pMin,2) + '</td><td class="t-pos">' + fv(row.pMax,2) + '</td>';
      s7 += '</tr>';
    });
    s7 += '</tbody></table>';
    if (ct.isElevated && ct.underside) {
      s7 += '<p style="margin-top:8px"><strong>Elevated Bin Underside (Sec. 30.10.5):</strong></p>';
      s7 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>GCp(+)</th><th>GCp(−)</th><th>p pos (psf)</th><th>p neg (psf)</th></tr></thead><tbody>';
      ct.underside.forEach(function(z) {
        s7 += '<tr><td>' + escHtml(z.zone) + '</td><td class="t-pos">' + fv(z.gcpPos,2) + '</td><td class="t-neg">' + fv(z.gcpNeg,2) + '</td><td class="t-pos">' + fv(z.pPos,2) + '</td><td class="t-neg">' + fv(z.pNeg,2) + '</td></tr>';
      });
      s7 += '</tbody></table>';
    }
  }

  html += stepBlock(7, 'Calculate C&amp;C design wind pressures',
    isOpenBldg ? '&#167;30.5, Eq. 30.5-1' : isPart2 ? '&#167;30.4, Eq. 30.4-1' : '&#167;30.3, Eq. 30.3-1',
    s7);

  /* ── Step 8 — Minimum loads ──────────────────────────────────────── */
  var s8 = '<p>All C&amp;C surfaces: |p| ≥ <strong>16 psf</strong>, acting normal to surface in either direction (Sec. 30.2.2).</p>';
  if (r.ccMinGoverns && r.ccMinCheck) {
    s8 += '<p><span class="step-result">⚠ Minimum 16 psf governs for one or more zones:</span></p>';
    s8 += '<table class="step-tbl"><thead><tr><th>Zone</th><th>|p| calc (psf)</th><th>Min (psf)</th><th>Governs</th></tr></thead><tbody>';
    r.ccMinCheck.forEach(function(c) {
      s8 += '<tr' + (c.governs ? ' style="background:rgba(239,68,68,.06);"' : '') + '><td>' + c.zone + '</td><td>' + fv(c.pCalc,2) + '</td><td>16.00</td><td>' + (c.governs ? '<strong class="step-result">Yes</strong>' : 'No') + '</td></tr>';
    });
    s8 += '</tbody></table>';
  } else {
    s8 += '<p class="step-sub">All computed pressures exceed 16 psf minimum — computed values govern.</p>';
  }
  html += stepBlock(8, 'Minimum C&amp;C design wind pressures', '&#167;30.2.2', s8);

  /* ── Summary ─────────────────────────────────────────────────────── */
  html += '<div class="report-summary-box"><div class="report-summary-title">Design Pressures Summary — C&amp;C (Ch. 30)</div>';
  html += '<table class="pres-tbl"><thead><tr><th>Surface / Zone</th><th>(GCp)</th><th>p min (psf)</th><th>p max (psf)</th></tr></thead><tbody>';

  function sRow(lbl, gStr, mn, mx, hi) {
    return '<tr' + (hi?' class="s-gov-row"':'') + '><td class="s-label">' + lbl + '</td><td>' + (gStr||'—') + '</td><td class="s-neg">' + fv(mn,1) + '</td><td class="s-pos">' + fv(mx,1) + '</td></tr>';
  }
  if (isPart1) {
    (r.ccWall||[]).forEach(function(z) {
      html += sRow('Wall Zone '+z.zone+(z.zone==='4'?' — field':' — corner'), z.gcp?fv(z.gcp.neg,2)+' / +'+fv(z.gcp.pos,2):'—', z.p.min, z.p.max, true);
    });
    (r.ccRoof||[]).forEach(function(z) {
      html += sRow('Roof Zone '+z.zone, z.gcp?fv(z.gcp.neg,2)+' / +'+fv(z.gcp.pos,2):'—', z.p.min, z.p.max, false);
    });
  }
  if (isPart2 && r.cc30p2) {
    var p2 = r.cc30p2, tr = p2.wwProfile[p2.wwProfile.length-1];
    if (tr) {
      html += sRow('Wall Z4 at h='+fv(h,1)+'ft', fv(p2.gc4.neg,2)+' / +'+fv(p2.gc4.pos,2), tr.z4_pmin, tr.z4_pmax, true);
      html += sRow('Wall Z5 at h='+fv(h,1)+'ft', fv(p2.gc5.neg,2)+' / +'+fv(p2.gc5.pos,2), tr.z5_pmin, tr.z5_pmax, true);
    }
    (p2.roofZones||[]).forEach(function(z) { html += sRow('Roof Zone '+z.zone, z.gcp?fv(z.gcp.neg,2)+' / +'+fv(z.gcp.pos,2):'—', z.pMin, z.pMax, false); });
    if (p2.roofSlopedP2) p2.roofSlopedP2.zones.forEach(function(z) { html += sRow('Roof Zone '+z.zone, z.gcp?fv(z.gcp.neg,2)+' / +'+fv(z.gcp.pos,2):'—', z.pMin, z.pMax, false); });
  }
  if (isOpenBldg && r.cc30s305) {
    ['Z3','Z2','Z1'].forEach(function(zk) { var z=r.cc30s305.zones[zk]; html += sRow(escHtml(z.label), 'CN:'+fv(z.CNn,2)+'/+'+fv(z.CNp,2), z.pn, z.pp, false); });
  }
  if (r.monoslopeRoof && r.monoslopeRoof.applicable) {
    var mr=r.monoslopeRoof;
    [{l:'Zone 1',d:mr.zone1},{l:'Zone 2',d:mr.zone2},mr.zone2p?{l:"Zone 2'",d:mr.zone2p}:null,{l:'Zone 3',d:mr.zone3},mr.zone3p?{l:"Zone 3'",d:mr.zone3p}:null].filter(Boolean).forEach(function(x){
      html += sRow('Monoslope '+x.l, x.d.gc?fv(x.d.gc.neg,2)+' / +'+fv(x.d.gc.pos,2):'—', x.d.pMin, x.d.pMax, false);
    });
  }
  if (r.ccOverhang && r.ccOverhang.length) { r.ccOverhang.forEach(function(z){ html += sRow('Overhang Zone '+z.zone+' (net)', '—', z.p.min, z.p.max, false); }); }
  if (r.parapet) { r.parapet.ccParapet.forEach(function(z){ html += sRow('Parapet Zone '+z.zone, '—', Math.min(z.pA,z.pB), Math.max(z.pA,z.pB), false); }); }
  html += '</tbody></table></div>';
  return html;
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
  if (proc === 'envelope') return buildCh28StepReport(r, s);
  if (proc === 'cc')       return buildCCStepReport(r, s);
  if (proc !== 'directional') return warn('Unknown procedure — please select a calculation method above.');
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
