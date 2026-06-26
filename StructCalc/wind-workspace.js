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
  await loadScriptTag('renderer.js?v=7');
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
};

function gatherWindState(base) {
  var s = Object.assign({}, base || {});
  var defs = {
    unitSystem:'US', mode:'mwfrs', roofType:'sloped',
    h:60, minDim:40, buildingL:72, theta:15, roofShape:'gable',
    V:115, exposure:'C', kzt:1.0, kztMode:'manual',
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
  s.roofType = (s.theta <= 7 || s.roofShape === 'flat') ? 'flat' : 'sloped';
  if (s.roofShape === 'flat') s.theta = 0;
  return s;
}

function restoreWindInputs(saved) {
  var revMap = {};
  Object.entries(WIND_INPUT_MAP).forEach(function(e){ revMap[e[1]] = e[0]; });
  Object.entries(saved).forEach(function(e) {
    var key = e[0], val = e[1];
    var inp = document.getElementById(revMap[key]);
    if (inp) inp.value = val;
  });
  if (saved.mode === 'cc') { setWindProc('cc'); activateInputTab('cc'); }
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
  computeKe();

  // Renderer signature: update3DModel(B, L, ridgeHeight, thetaDegrees, zone_a)
  if (windRenderer) windRenderer.update3DModel(B, L, hR, th, za);

  var vDisp = document.getElementById('wind-V-display');
  if (vDisp) vDisp.textContent = s.V;

  var cap = document.getElementById('windDiagramCaption');
  if (cap) {
    var sh = {gable:'Gable Roof',hip:'Hip Roof',flat:'Flat Roof',monoslope:'Monoslope Roof'};
    var pr = {envelope:'Envelope (Ch. 28)',directional:'Directional (Ch. 27)',cc:'C&C (Ch. 30)'};
    var pk = s.mode === 'cc' ? 'cc' : s.mwfrsProcedure;
    cap.textContent = (sh[s.roofShape] || 'Building') + ' — ' + (pr[pk] || '');
  }

  renderWindResults(r, s);

  if (!windActiveCalc.state) windActiveCalc.state = {};
  windActiveCalc.state['ASCE 7-22'] = { state: s, unitSystem: s.unitSystem };
  windActiveProj.updatedAt = Date.now();
  scheduleSave();
  windSavedState = s;
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
        html += '<div class="result-row ' + (wallCls[z.zone]||'zone-mid') + '"><span class="k">' + (wallLabel[z.zone]||'Zone '+z.zone) + '</span><span class="v">' + fmt(z.p.neg) + ' / +' + fmt(z.p.pos) + ' psf</span></div>';
      });
      html += '</div>';
    }
    var roofLabel = {'1p':'Zone 1′ — field (low)','1':'Zone 1 — field','2':'Zone 2 — edge','3':'Zone 3 — corner'};
    var roofCls   = {'1p':'zone-low','1':'zone-low','2':'zone-mid','3':'zone-high'};
    if (r.ccRoof && r.ccRoof.length) {
      html += '<div class="result-card"><div class="result-card-head">C&amp;C — Roof (Ch. 30)</div>';
      r.ccRoof.forEach(function(z) {
        html += '<div class="result-row ' + (roofCls[z.zone]||'zone-mid') + '"><span class="k">' + (roofLabel[z.zone]||'Zone '+z.zone) + '</span><span class="v">' + fmt(z.p.neg) + ' / +' + fmt(z.p.pos) + ' psf</span></div>';
      });
      html += '</div>';
    }
  }

  host.innerHTML = html;
}

/* ── Input tab switching ───────────────────────────────────────────────── */
function activateInputTab(tabName) {
  document.querySelectorAll('.input-tabs .tab-btn').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.querySelector('.input-tabs .tab-btn[data-tab="' + tabName + '"]');
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
  if (mapEl)    mapEl.classList.toggle('hidden', !isMap);
  if (threeEl)  threeEl.classList.toggle('hidden', isMap);
  if (mapTb)    mapTb.classList.toggle('hidden', !isMap);
  if (diagramTb) diagramTb.classList.toggle('hidden', isMap);
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
function computeKe() {
  var z  = parseFloat((document.getElementById('wind-groundElev') || {}).value) || 0;
  var ke = Math.exp(-0.0000362 * z);
  var d  = document.getElementById('wind-ke-display');
  if (d) d.value = ke.toFixed(3);
  return ke;
}

/* ── K_zt calc (ASCE 7-22 Fig. 26.8-1) ────────────────────────────────── */
function computeKzt() {
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
  document.querySelectorAll('.enc-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.enc === val); });
}

/* ── Zone options by surface ────────────────────────────────────────────── */
function updateZoneOptions(surface) {
  var sel = document.getElementById('wind-zone');
  if (!sel) return;
  sel.innerHTML = (surface === 'wall')
    ? '<option value="4">Zone 4 — Wall field</option><option value="5">Zone 5 — Wall corner</option>'
    : '<option value="1">Zone 1 — Interior field</option><option value="2">Zone 2 — Edge / ridge</option><option value="3">Zone 3 — Corner</option>';
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
      recalcWind();
    });
  });

  /* Input tab switching */
  document.querySelectorAll('.input-tabs .tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { activateInputTab(btn.dataset.tab); });
  });

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
      if (scEl) scEl.value = btn.dataset.struct;
      setVisible('geomBuildingBlock', isBuilding);
      setVisible('geomOtherBlock', !isBuilding);
      recalcWind();
    });
  });

  /* Enclosure buttons */
  document.querySelectorAll('.enc-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.enc-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var encEl = document.getElementById('wind-enclosure');
      if (encEl) encEl.value = btn.dataset.enc;
      recalcWind();
    });
  });

  /* Calculate openings toggle */
  var chkOp = document.getElementById('wind-calcOpenings');
  if (chkOp) {
    chkOp.addEventListener('change', function() {
      setVisible('openingsTable', this.checked);
      document.querySelectorAll('.enc-btn').forEach(function(b){ b.disabled = chkOp.checked; b.style.opacity = chkOp.checked ? '.45' : ''; });
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
      if (this.checked) computeKzt();
    });
    ['wind-kztShape','wind-kztH','wind-kztLh','wind-kztX','wind-kztZ'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function(){ computeKzt(); recalcWind(); });
    });
  }

  /* Ground elevation → K_e */
  var elevEl = document.getElementById('wind-groundElev');
  if (elevEl) elevEl.addEventListener('input', function(){ computeKe(); recalcWind(); });

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
}

/* ── Open wind workspace ───────────────────────────────────────────────── */
async function openWindWorkspace(proj, calc) {
  windActiveProj = proj;
  windActiveCalc = calc;

  var banner = document.getElementById('windBannerText');
  if (banner) banner.innerHTML = '<strong>' + escHtml(proj.name) + '</strong> · ASCE 7-22 · ' + escHtml((proj.settings && proj.settings.units === 'SI') ? 'SI' : 'US') + ' Units';

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
  try { windRenderer = new Wind3DRenderer('threejs-container'); }
  catch(e) { console.error('Wind3DRenderer init:', e); }

  if (!elWsMain._inputsWired) {
    wireWindInputs();
    elWsMain._inputsWired = true;
  }
  recalcWind();
}
