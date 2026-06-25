/* =====================================================================
   StructCalc — workspace.js
   Responsibility: workspace screen — sidebar, module routing, project
                   settings, context menu, add-calc modal, sidebar resize,
                   module loading (snow/future), status bar.
   Depends on: projects.js, dashboard.js (loaded before)
   Rule: edit only for workspace/sidebar/routing changes.
   ===================================================================== */

/* ── Navigation ──────────────────────────────────────────────────────── */
function goWorkspace(projectId, calcId) {
  if (projectId) {
    activeProjectId = projectId;
    localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
  }
  elDashboard.classList.add('hidden');
  elWorkspace.classList.remove('hidden');

  var proj = projects[activeProjectId];
  if (!proj) { goDashboard(); return; }

  elWsCrumbProj.textContent = proj.name;

  var targetCalc = calcId || proj.activeCalcId || (proj.calculations && proj.calculations[0] && proj.calculations[0].id) || 'settings';
  renderSidebar();
  openCalc(targetCalc);
}

/* ── Sidebar render ──────────────────────────────────────────────────── */
function renderSidebar() {
  var proj = projects[activeProjectId];
  if (!proj) return;
  var code  = (proj.settings && proj.settings.code) || 'ASCE 7-22';
  var calcs = proj.calculations || [];

  elTreeList.innerHTML = '';

  var root = el('div', 'tree-root',
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V9l9-6 9 6v12H3z"/></svg>' +
    '<span class="tree-root-name">' + escHtml(proj.name) + '</span>');
  root.addEventListener('click', function(){ openCalc('settings'); });
  elTreeList.appendChild(root);

  var siteCalcs = calcs.filter(function(c){ return MODULE_MAP[c.type] && MODULE_MAP[c.type].group === 'site'; });
  appendGroupHdr(elTreeList, 'Site &amp; Building Loads');
  if (siteCalcs.length === 0) {
    elTreeList.appendChild(el('div', 'tree-empty', 'No calculations yet'));
  } else {
    siteCalcs.forEach(function(calc){ elTreeList.appendChild(buildCalcItem(calc, code)); });
  }

  appendGroupHdr(elTreeList, 'Structural Elements');
  elTreeList.appendChild(el('div', 'tree-empty', 'Coming soon — beam, column, connection design'));
}

function appendGroupHdr(parent, labelHtml) {
  var hdr = document.createElement('div');
  hdr.className = 'tree-group-hdr';
  hdr.innerHTML = labelHtml;
  parent.appendChild(hdr);
}

var CALC_ICONS = {
  wind:    '<path d="M9 4a2 2 0 1 1 2 2H3M17 9a2 2 0 1 1-2 2H3M11 18a2 2 0 1 0 2-2H3"/>',
  snow:    '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>',
  seismic: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'
};

function buildCalcItem(calc, code) {
  var def     = MODULE_MAP[calc.type];
  var variant = def && def.variants[code];
  var planned = !variant || variant.status !== 'ready';
  var icon    = CALC_ICONS[calc.type] || '<circle cx="12" cy="12" r="9"/>';

  var item = el('div', 'tree-item' + (planned?' planned':''),
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + icon + '</svg>' +
    '<div class="tree-item-body">' +
      '<div class="tree-item-name">' + escHtml(calc.title) + '</div>' +
      (calc.description ? '<div class="tree-item-desc">' + escHtml(calc.description) + '</div>' : '') +
    '</div>' +
    '<span class="status-dot idle" id="dot-' + calc.id + '"></span>' +
    '<button class="item-menu-btn" data-cid="' + calc.id + '" title="More options"><svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg></button>');
  item.dataset.calcId = calc.id;

  item.addEventListener('click', function(e) {
    if (e.target.closest('.item-menu-btn')) return;
    openCalc(calc.id);
  });
  item.querySelector('.item-menu-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    showCalcCtxMenu(e, calc.id);
  });
  return item;
}

function setActiveTreeItem(calcId) {
  elTreeList.querySelectorAll('.tree-item').forEach(function(i){ i.classList.remove('active'); });
  if (calcId && calcId !== 'settings') {
    var item = elTreeList.querySelector('[data-calc-id="' + calcId + '"]');
    if (item) item.classList.add('active');
  }
}

/* ── Calc context menu ───────────────────────────────────────────────── */
function showCalcCtxMenu(e, calcId) {
  e.stopPropagation();
  ctxTargetId = calcId;
  elCtxMenu.classList.remove('hidden');
  var r    = e.currentTarget.getBoundingClientRect();
  var left = r.right + 6;
  var top  = r.top;
  if (left + 180 > window.innerWidth) left = r.left - 184;
  elCtxMenu.style.left = left + 'px';
  elCtxMenu.style.top  = top  + 'px';
}

document.addEventListener('click', function(e) {
  if (!elCtxMenu.classList.contains('hidden') && !elCtxMenu.contains(e.target)) {
    elCtxMenu.classList.add('hidden');
  }
});

document.getElementById('ctx-rename').addEventListener('click', function() {
  elCtxMenu.classList.add('hidden');
  var proj = projects[activeProjectId];
  var calc = proj && proj.calculations && proj.calculations.find(function(c){ return c.id === ctxTargetId; });
  if (!calc) return;
  var n = prompt('Rename:', calc.description || calc.title);
  if (n !== null) {
    calc.description = n.trim();
    proj.updatedAt = Date.now();
    scheduleSave(); renderSidebar();
    if (activeCalcId === calc.id) elWsCrumbCalc.textContent = calcLabel(calc);
  }
});

document.getElementById('ctx-duplicate').addEventListener('click', function() {
  elCtxMenu.classList.add('hidden');
  var proj = projects[activeProjectId];
  var src  = proj && proj.calculations && proj.calculations.find(function(c){ return c.id === ctxTargetId; });
  if (!src) return;
  var dup = JSON.parse(JSON.stringify(src));
  dup.id = makeId('c');
  dup.description = (dup.description || dup.title) + ' (copy)';
  var idx = proj.calculations.indexOf(src);
  proj.calculations.splice(idx + 1, 0, dup);
  proj.updatedAt = Date.now();
  scheduleSave(); renderSidebar();
});

document.getElementById('ctx-delete').addEventListener('click', function() {
  elCtxMenu.classList.add('hidden');
  var proj = projects[activeProjectId];
  var calc = proj && proj.calculations && proj.calculations.find(function(c){ return c.id === ctxTargetId; });
  if (!calc) return;
  if (!confirm('Delete "' + (calc.description || calc.title) + '"?')) return;
  proj.calculations = proj.calculations.filter(function(c){ return c.id !== ctxTargetId; });
  proj.updatedAt = Date.now();
  scheduleSave(); renderSidebar();
  var next = proj.calculations[0];
  openCalc(next ? next.id : 'settings');
});

/* ── Module display helpers ──────────────────────────────────────────── */
function showOnly(which) {
  elModuleHost.classList.add('hidden');
  elModulePh.classList.add('hidden');
  elProjSettings.classList.add('hidden');
  elModuleLoading.classList.add('hidden');
  elWsContent.classList.remove('hidden');
  elWsMain.classList.add('hidden');
  if (which) which.classList.remove('hidden');
}

function showWindWorkspace() {
  elWsContent.classList.add('hidden');
  elWsMain.classList.remove('hidden');
}

/* ── Open calc ───────────────────────────────────────────────────────── */
async function openCalc(calcId) {
  activeCalcId = calcId;
  var proj = projects[activeProjectId];
  if (!proj) return;

  setActiveTreeItem(calcId);

  if (calcId === 'settings') { renderProjectSettings(); return; }

  var calc = proj.calculations && proj.calculations.find(function(c){ return c.id === calcId; });
  if (!calc) { renderProjectSettings(); return; }

  proj.activeCalcId = calcId;
  elWsCrumbCalc.textContent = calcLabel(calc);
  updateStatusBar(proj, calc);

  var code    = (proj.settings && proj.settings.code) || 'ASCE 7-22';
  var variant = MODULE_MAP[calc.type] && MODULE_MAP[calc.type].variants[code];

  if (!variant || variant.status !== 'ready') { renderPlaceholder(calc, code); return; }

  if (calc.type === 'wind') {
    showWindWorkspace();
    try { await openWindWorkspace(proj, calc); }
    catch (err) {
      console.error('StructCalc: wind workspace error', err);
      showOnly(elModulePh);
      elModulePh.innerHTML = '<h2>Wind workspace error</h2><p class="ph-sub">' + escHtml(err.message) + '</p>';
    }
    return;
  }

  showOnly(elModuleLoading);
  try { await loadModule(variant, proj, calc); }
  catch (err) {
    console.error('StructCalc: module load failed', err);
    showOnly(elModulePh);
    elModulePh.innerHTML = '<h2>Failed to load module</h2><p class="ph-sub">' + escHtml(err.message) + '</p>';
  }
}

/* ── CSS scoper ──────────────────────────────────────────────────────── */
function scopeCSS(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  var out = '', i = 0;
  while (i < css.length) {
    var brace = css.indexOf('{', i);
    if (brace === -1) break;
    var sel = css.slice(i, brace).trim();
    var depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    var body = css.slice(brace + 1, j - 1);
    if (sel.startsWith('@keyframes') || sel.startsWith('@font-face') || sel.startsWith('@charset') || sel.startsWith('@import') || sel.startsWith('@namespace')) {
      out += sel + '{' + body + '}\n';
    } else if (sel.startsWith('@media') || sel.startsWith('@supports') || sel.startsWith('@layer')) {
      out += sel + '{\n' + scopeCSS(body) + '}\n';
    } else {
      var scoped = sel.split(',').map(function(s) {
        s = s.trim(); if (!s) return '';
        if (s === 'body' || s === 'html') return '#module-host';
        if (s.startsWith(':root') || s.includes('#module-host')) return s;
        if (s.startsWith('body.')) return s.replace(/^body/, '.mod-workspace');
        return '#module-host ' + s;
      }).filter(Boolean).join(',\n');
      out += scoped + '{' + body + '}\n';
    }
    i = j;
  }
  return out;
}

/* ── Module loader (snow and other iframe-style modules) ─────────────── */
async function loadModule(variant, proj, calc) {
  var resp = await fetch(variant.path);
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' fetching ' + variant.path);
  var html = await resp.text();

  var parser = new DOMParser();
  var doc    = parser.parseFromString(html, 'text/html');

  var oldStyle = document.getElementById('module-injected-style');
  if (oldStyle) oldStyle.remove();
  var styleEl = document.createElement('style');
  styleEl.id = 'module-injected-style';
  doc.querySelectorAll('style').forEach(function(s){ styleEl.textContent += scopeCSS(s.textContent) + '\n'; });
  document.head.appendChild(styleEl);

  elModuleHost.innerHTML = doc.body.innerHTML;
  document.querySelectorAll('.module-script').forEach(function(s){ s.remove(); });

  var base = variant.path.replace(/\/[^/]+$/, '/');
  for (var i = 0; i < doc.querySelectorAll('script[src]').length; i++) {
    var s   = doc.querySelectorAll('script[src]')[i];
    var src = base + s.getAttribute('src').replace(/^.*\//, '');
    if (!loadedScripts[src]) {
      await new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.className = 'module-script';
        script.src = src;
        script.onload  = function(){ loadedScripts[src] = true; resolve(); };
        script.onerror = function(){ reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(script);
      });
    }
  }

  doc.querySelectorAll('script:not([src])').forEach(function(s) {
    try { new Function(s.textContent)(); } catch(e) {}
  });

  showOnly(elModuleHost);

  var savedEntry = calc.state && calc.state[proj.settings && proj.settings.code];
  if (savedEntry && savedEntry.state) {
    setTimeout(function() {
      try { window.postMessage({ type:'loadState', state:savedEntry.state, unitSystem:savedEntry.unitSystem }, '*'); } catch(e) {}
    }, 200);
  }

  window._moduleStateListener && window.removeEventListener('message', window._moduleStateListener);
  window._moduleStateListener = function(e) {
    if (e.data && e.data.type === 'stateChanged') {
      var code = proj.settings && proj.settings.code;
      if (!calc.state) calc.state = {};
      calc.state[code] = { state: e.data.state, unitSystem: e.data.unitSystem };
      proj.updatedAt = Date.now();
      scheduleSave();
    }
  };
  window.addEventListener('message', window._moduleStateListener);
}

/* ── Project settings view ───────────────────────────────────────────── */
function renderProjectSettings() {
  var proj = projects[activeProjectId];
  if (!proj) return;
  setActiveTreeItem(null);
  elWsCrumbCalc.textContent = 'Project Settings';
  updateStatusBar(proj, null);
  showOnly(elProjSettings);

  elProjSettings.innerHTML =
    '<h2>Project Settings</h2>' +
    '<div class="settings-field"><label>Project name</label><input type="text" id="spName" value="' + escHtml(proj.name) + '"></div>' +
    '<div class="settings-field"><label>Address / location</label><input type="text" id="spAddress" value="' + escHtml(proj.address || '') + '"></div>' +
    '<div class="settings-field"><label>Design code</label><select id="spCode"><option value="ASCE 7-22"' + (proj.settings && proj.settings.code==='ASCE 7-22'?' selected':'') + '>ASCE 7-22 (United States)</option><option value="NBCC 2015"' + (proj.settings && proj.settings.code==='NBCC 2015'?' selected':'') + '>NBCC 2015 (Canada)</option></select></div>' +
    '<div class="settings-field"><label>Unit system</label><select id="spUnits"><option value="US"' + (proj.settings && proj.settings.units==='US'?' selected':'') + '>US / Imperial (psf, ft, mph)</option><option value="SI"' + (proj.settings && proj.settings.units==='SI'?' selected':'') + '>SI (kPa, m, m/s)</option></select></div>' +
    '<div class="settings-divider"></div>' +
    '<div class="settings-actions"><button class="btn btn-primary" id="spSave">Save Settings</button><button class="btn" id="spExport">Export .json</button></div>' +
    '<div class="danger-zone"><h4>Danger Zone</h4><button class="btn btn-danger" id="spDelete">Delete This Project</button></div>';

  document.getElementById('spSave').addEventListener('click', function() {
    proj.name    = document.getElementById('spName').value.trim() || proj.name;
    proj.address = document.getElementById('spAddress').value.trim();
    proj.settings.code  = document.getElementById('spCode').value;
    proj.settings.units = document.getElementById('spUnits').value;
    proj.updatedAt = Date.now();
    scheduleSave();
    elWsCrumbProj.textContent = proj.name;
    updateStatusBar(proj, null);
    renderSidebar();
    showSavePill('Saved');
  });
  document.getElementById('spExport').addEventListener('click', function(){ exportProject(activeProjectId); });
  document.getElementById('spDelete').addEventListener('click', function() {
    if (!confirm('Delete "' + proj.name + '"? This cannot be undone.')) return;
    delete projects[activeProjectId];
    saveProjects();
    var next = Object.keys(projects)[0];
    if (!next) { var p2 = newProject('My First Project'); projects[p2.id] = p2; saveProjects(); }
    goDashboard();
  });
}

/* ── Planned module placeholder ──────────────────────────────────────── */
function renderPlaceholder(calc, code) {
  var def     = MODULE_MAP[calc.type];
  var variant = def && def.variants[code];
  var rm      = variant && variant.roadmap;
  showOnly(elModulePh);
  elWsCrumbCalc.textContent = calcLabel(calc) + ' (roadmap)';
  elModulePh.innerHTML =
    '<h2>' + escHtml((def && def.title) || calc.title) + ' — ' + escHtml(code) + '</h2>' +
    '<p class="ph-sub">' + escHtml((variant && variant.label) || 'Coming soon') + '</p>' +
    (rm ? '<p>' + escHtml(rm.summary) + '</p><ul style="margin-top:12px">' + rm.points.map(function(p){ return '<li>' + escHtml(p) + '</li>'; }).join('') + '</ul>' : '') +
    '<div class="placeholder-note">This module is on the roadmap. Switch to a ready module using the project tree.</div>';
}

/* ── Status bar ──────────────────────────────────────────────────────── */
function updateStatusBar(proj, calc) {
  var code  = (proj && proj.settings && proj.settings.code)  || 'ASCE 7-22';
  var units = (proj && proj.settings && proj.settings.units) || 'US';
  elStatusCode.innerHTML = '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg> ' + escHtml(code);
  elStatusUnits.textContent  = units === 'SI' ? 'SI (kPa, m)' : 'US / Imperial';
  elStatusDetail.textContent = calc ? calcLabel(calc) : ((proj && proj.name) || '');
}

function showSavePill(msg, err) {
  var pill = document.getElementById('wsSavePill');
  if (!pill) return;
  pill.innerHTML = err
    ? '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ' + escHtml(msg)
    : '<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> ' + escHtml(msg);
  pill.style.color = err ? '#fca5a5' : '#bdf3c7';
}

/* ── Sidebar resize ──────────────────────────────────────────────────── */
(function() {
  var sidebar = document.getElementById('wsSidebar');
  var handle  = document.getElementById('sidebarResizeHandle');
  if (!handle) return;
  var dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', function(e) {
    dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    sidebar.style.width = Math.max(160, Math.min(480, startW + (e.clientX - startX))) + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });
})();

/* ── Add Calculation Modal ───────────────────────────────────────────── */
var elAddCalcModal = document.getElementById('addCalcModal');
var elCalcTypeGrid = document.getElementById('calcTypeGrid');
var elAcAdd        = document.getElementById('acAdd');
var elAcDesc       = document.getElementById('acDescription');
var selectedType   = null;

function openAddCalcModal() {
  var proj = projects[activeProjectId];
  if (!proj) return;
  var code = (proj.settings && proj.settings.code) || 'ASCE 7-22';

  elCalcTypeGrid.innerHTML = '';
  selectedType = null;
  elAcAdd.disabled = true;
  elAcDesc.value = '';

  MODULE_TYPES.forEach(function(mod) {
    var variant = mod.variants[code];
    var ready   = variant && variant.status === 'ready';
    var card    = el('div', 'calc-type-card' + (ready?'':' planned'),
      '<div class="calc-type-icon">' + mod.icon + '</div>' +
      '<div class="calc-type-title">' + escHtml(mod.title) + '</div>' +
      '<div class="calc-type-sub">' + (ready ? escHtml(variant.label) : 'Roadmap') + '</div>');
    if (ready) {
      card.addEventListener('click', function() {
        elCalcTypeGrid.querySelectorAll('.calc-type-card').forEach(function(c){ c.classList.remove('selected'); });
        card.classList.add('selected');
        selectedType = mod.type;
        elAcAdd.disabled = false;
      });
    }
    elCalcTypeGrid.appendChild(card);
  });

  elAddCalcModal.classList.add('open');
}

elAcAdd.addEventListener('click', function() {
  if (!selectedType) return;
  var proj = projects[activeProjectId];
  var calc = newCalc(selectedType, elAcDesc.value);
  proj.calculations.push(calc);
  proj.updatedAt = Date.now();
  scheduleSave();
  elAddCalcModal.classList.remove('open');
  renderSidebar();
  openCalc(calc.id);
});

document.getElementById('addCalcClose').addEventListener('click',  function(){ elAddCalcModal.classList.remove('open'); });
document.getElementById('addCalcCancel').addEventListener('click', function(){ elAddCalcModal.classList.remove('open'); });
document.getElementById('btnAddCalc').addEventListener('click', openAddCalcModal);
document.getElementById('treeAddBtn').addEventListener('click', openAddCalcModal);

// Close modals on overlay click
[elNewProjModal, elAddCalcModal].forEach(function(m) {
  m.addEventListener('click', function(e){ if (e.target === m) m.classList.remove('open'); });
});

/* ── Workspace top-bar wiring ────────────────────────────────────────── */
document.getElementById('wsBack').addEventListener('click', goDashboard);
