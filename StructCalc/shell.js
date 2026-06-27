/* =====================================================================
   StructCalc — App Shell  (Blueprint Design System)
   Architecture:
     - Dashboard screen: card grid of projects
     - Workspace screen: sidebar project tree + module host (no iframe)
     - Modules loaded dynamically via fetch+inject (no iframe)
     - Projects stored in localStorage
   ===================================================================== */

/* ── Constants ─────────────────────────────────────────────────────── */
var LS_PROJECTS       = 'structcalc.projects.v2';
var LS_ACTIVE_PROJECT = 'structcalc.activeProject.v2';
var LS_ACTIVE_CALC    = 'structcalc.activeCalc.v2';
var DEFAULT_UNITS     = { 'ASCE 7-22': 'US', 'NBCC 2015': 'SI' };
/* ── DIAGNOSTIC checkpoints (remove after debug) ─────────────────── */


/* ── Module registry ────────────────────────────────────────────────── */
var MODULE_TYPES = [
  {
    type: 'wind',
    group: 'site',
    icon: '🌬️',
    title: 'Wind Load',
    variants: {
      'ASCE 7-22': {
        status: 'ready',
        path: '../ASCE 7-22 Wind Load Calculator/index.html',
        enginePath: '../ASCE 7-22 Wind Load Calculator/engine.js',
        label: 'ASCE/SEI 7-22, Ch. 26–30'
      },
      'NBCC 2015': {
        status: 'planned',
        label: 'NBCC 2015, Sentence 4.1.7',
        roadmap: {
          summary: 'External wind pressures p = Iw·q·Ce·Cg·Cp per NBC 2015 Sentence 4.1.7.1.',
          points: [
            'Reference velocity pressure q from the 1-in-50 design wind speed (Appendix C).',
            'Importance factor Iw (Table 4.1.7.1, by Importance Category and ULS/SLS).',
            'Exposure factor Ce (Sentence 4.1.7.4 — open / rough terrain profiles).',
            'Gust effect factor Cg (Sentence 4.1.7.1.(5) and Commentary I).',
            'External pressure coefficients Cp for walls and roofs (Commentary I).'
          ]
        }
      }
    }
  },
  {
    type: 'snow',
    group: 'site',
    icon: '❄️',
    title: 'Snow Load',
    variants: {
      'ASCE 7-22': {
        status: 'ready',
        path: '../ASCE 7-22 Snow Load Calculator/index.html',
        enginePath: '../ASCE 7-22 Snow Load Calculator/engine.js',
        label: 'ASCE/SEI 7-22, Chapter 7'
      },
      'NBCC 2015': {
        status: 'ready',
        path: '../NBCC 2015 Snow Drift Calculator/index.html',
        enginePath: '../NBCC 2015 Snow Drift Calculator/engine.js',
        label: 'NBCC 2015, Sentence 4.1.6'
      }
    }
  },
  {
    type: 'seismic',
    group: 'site',
    icon: '🌍',
    title: 'Seismic Load',
    variants: {
      'ASCE 7-22': {
        status: 'planned',
        label: 'ASCE/SEI 7-22, Chapters 11–12',
        roadmap: {
          summary: 'Equivalent Lateral Force base shear per ASCE 7-22 Ch. 11 & 12.',
          points: [
            'Site coefficients Fa, Fv (Tables 11.4-1/11.4-2) applied to map values Ss, S1.',
            'Sms, Sm1, Sds, Sd1 and Seismic Design Category (Tables 11.6-1/11.6-2).',
            'Approximate period Ta (§12.8.2.1) and seismic response coefficient Cs.',
            'R, Ω₀, Cd by Seismic Force-Resisting System (Table 12.2-1).',
            'Base shear V = Cs·W (Eq. 12.8-1) and vertical distribution Fx.'
          ]
        }
      },
      'NBCC 2015': {
        status: 'planned',
        label: 'NBCC 2015, Sentence 4.1.8',
        roadmap: {
          summary: 'Equivalent static base shear V per NBC 2015 Sentence 4.1.8.11.',
          points: [
            'Design spectral acceleration Sa(T) and site coefficients F(T).',
            'IeFaSa(0.2) and IeFvSa(1.0) with Earthquake Importance Factor Ie.',
            'Higher-mode factor Mv, ductility Rd and overstrength Ro factors.',
            'Fundamental period Ta and base shear V = S(Ta)·Mv·Ie·W / (Rd·Ro).'
          ]
        }
      }
    }
  }
];

var MODULE_MAP = Object.fromEntries(MODULE_TYPES.map(m => [m.type, m]));

/* ── Persistence ────────────────────────────────────────────────────── */
function loadProjects() {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch { return {}; }
}

function saveProjects() {
  try {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    showSavePill('Saved');
  } catch (e) {
    showSavePill('Save failed!', true);
    console.error('StructCalc: save failed', e);
  }
}

var saveTimer = null;
function scheduleSave() {
  showSavePill('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProjects, 500);
}

function makeId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/* ── Data models ────────────────────────────────────────────────────── */
function newCalc(type, description) {
  const def = MODULE_MAP[type] || MODULE_TYPES[0];
  return {
    id:          makeId('c'),
    type:        def.type,
    title:       def.title,
    description: (description || '').trim(),
    state:       {}   // keyed by code: { 'ASCE 7-22': {state,unitSystem}, ... }
  };
}

function newProject(name, settings) {
  settings = settings || { code: 'ASCE 7-22', units: 'US' };
  const wc = newCalc('wind', '');
  return {
    id:          makeId('p'),
    name:        (name || 'New Project').trim(),
    address:     '',
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
    settings,
    calculations: [wc],
    activeCalcId: wc.id
  };
}

/* ── Migrate v1 localStorage data ───────────────────────────────────── */
function tryMigrateV1() {
  const old = localStorage.getItem('structcalc.projects.v1');
  if (!old) return;
  try {
    const v1 = JSON.parse(old);
    if (!v1 || typeof v1 !== 'object') return;
    Object.values(v1).forEach(p => {
      const code = p.settings?.code || 'ASCE 7-22';
      const units = p.settings?.units || DEFAULT_UNITS[code] || 'US';
      const proj = newProject(p.name, { code, units });
      proj.id = p.id || proj.id;
      proj.createdAt = p.createdAt || Date.now();
      proj.address = '';
      // migrate existing calcs
      if (Array.isArray(p.calculations) && p.calculations.length) {
        proj.calculations = p.calculations;
        proj.activeCalcId = p.activeCalcId || p.calculations[0].id;
      }
      projects[proj.id] = proj;
    });
    saveProjects();
  } catch (e) { console.warn('StructCalc: v1 migration failed', e); }
}

/* ── State ──────────────────────────────────────────────────────────── */
var projects = loadProjects();

if (Object.keys(projects).length === 0) {
  tryMigrateV1();
}
if (Object.keys(projects).length === 0) {
  const p = newProject('My First Project', { code: 'ASCE 7-22', units: 'US' });
  projects[p.id] = p;
  saveProjects();
}

var activeProjectId = localStorage.getItem(LS_ACTIVE_PROJECT);
if (!activeProjectId || !projects[activeProjectId]) {
  activeProjectId = Object.keys(projects)[0];
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
}

/* ── DOM refs ────────────────────────────────────────────────────────── */
var elDashboard  = document.getElementById('screen-dashboard');
var elWorkspace  = document.getElementById('screen-workspace');
var elProjGrid   = document.getElementById('projGrid');
var elDbSubtitle = document.getElementById('dbSubtitle');
var elRailAll    = document.getElementById('railCountAll');
var elTreeList   = document.getElementById('treeList');
var elModuleHost = document.getElementById('module-host');
var elModulePh   = document.getElementById('module-placeholder');
var elProjSettings = document.getElementById('project-settings-view');
var elModuleLoading= document.getElementById('module-loading');
var elWsCrumbProj  = document.getElementById('wsCrumbProject');
var elWsCrumbCalc  = document.getElementById('wsCrumbCalc');
var elStatusCode   = document.getElementById('statusCode');
var elStatusUnits  = document.getElementById('statusUnits');
var elStatusMsg    = document.getElementById('statusMsg');
var elStatusDetail = document.getElementById('statusDetail');
var elCtxMenu      = document.getElementById('ctx-menu');
var elWsContent    = document.getElementById('wsContent');
var elWsMain       = document.getElementById('wsWindWorkspace');

/* ── Current workspace state ─────────────────────────────────────────── */
var activeCalcId   = null;  // currently shown calc
var loadedScripts  = {};    // { path: true } to avoid double-loading
var ctxTargetId    = null;  // calc id for context menu

/* =====================================================================
   DASHBOARD
   ===================================================================== */
function goDashboard() {
  elWorkspace.classList.add('hidden');
  elDashboard.classList.remove('hidden');
  renderDashboard();
}

function goWorkspace(projectId, calcId) {
  if (projectId) {
    activeProjectId = projectId;
    localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
  }
  elDashboard.classList.add('hidden');
  elWorkspace.classList.remove('hidden');

  const proj = projects[activeProjectId];
  if (!proj) { goDashboard(); return; }

  elWsCrumbProj.textContent = proj.name;

  // decide which calc to open
  const targetCalc = calcId
    || proj.activeCalcId
    || proj.calculations?.[0]?.id
    || 'settings';

  renderSidebar();
  openCalc(targetCalc);
}

function renderDashboard() {
  const all  = Object.values(projects);
  const sort = document.getElementById('dbSort')?.value || 'modified';
  const q    = (document.getElementById('dbSearch')?.value || '').toLowerCase();

  let sorted = all.filter(p =>
    !q || p.name.toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q)
  );
  if (sort === 'name')     sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'created') sorted.sort((a, b) => b.createdAt - a.createdAt);
  else                     sorted.sort((a, b) => b.updatedAt  - a.updatedAt);

  const count = all.length;
  const codeCount = new Set(all.map(p => p.settings?.code)).size;
  elDbSubtitle.textContent = `${count} project${count!==1?'s':''} · ${codeCount} design code${codeCount!==1?'s':''}`;
  if (elRailAll) elRailAll.textContent = count;

  elProjGrid.innerHTML = '';

  sorted.forEach(proj => {
    const card = buildProjectCard(proj);
    elProjGrid.appendChild(card);
  });

  // New project card
  const nc = document.createElement('div');
  nc.className = 'proj-card proj-card-new';
  nc.innerHTML = `
    <div class="plus-circle">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
    </div>
    <div class="proj-card-new-label">New Project</div>`;
  nc.addEventListener('click', openNewProjectModal);
  elProjGrid.appendChild(nc);
}

function buildProjectCard(proj) {
  const code  = proj.settings?.code || 'ASCE 7-22';
  const isNBCC= code === 'NBCC 2015';
  const calcs = proj.calculations || [];
  const ago   = timeAgo(proj.updatedAt || proj.createdAt);

  const card = document.createElement('div');
  card.className = 'proj-card';
  card.innerHTML = `
    <div class="proj-card-strip${isNBCC?' nbcc':''}"></div>
    <div class="proj-card-body">
      <div class="proj-card-top">
        <div class="proj-card-icon">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21V9l9-6 9 6v12H3z"/><path d="M9 21V12h6v9"/>
          </svg>
        </div>
        <button class="proj-card-menu" data-pid="${proj.id}">
          <svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>
          </svg>
        </button>
      </div>
      <h3>${escHtml(proj.name)}</h3>
      <p class="proj-addr">${escHtml(proj.address || '—')}</p>
      <div class="proj-card-meta">
        <span class="chip ${isNBCC?'nbcc':'asce'}">${escHtml(code)}</span>
        ${calcs.map(c => `<span class="chip">${escHtml(MODULE_MAP[c.type]?.title || c.title || c.type)}</span>`).slice(0,2).join('')}
      </div>
    </div>
    <div class="proj-card-foot">
      <span>${ago}</span>
      <span>${calcs.length} calc${calcs.length!==1?'s':''}</span>
    </div>`;

  card.addEventListener('click', e => {
    if (e.target.closest('.proj-card-menu')) return;
    goWorkspace(proj.id, null);
  });
  card.querySelector('.proj-card-menu').addEventListener('click', e => {
    e.stopPropagation();
    showProjCtxMenu(e, proj.id);
  });
  return card;
}

function showProjCtxMenu(e, projId) {
  // Simple inline prompt for now
  const menu = document.createElement('div');
  menu.style.cssText = `
    position:fixed; z-index:1200; background:#fff; border:1px solid #dde3ec;
    border-radius:8px; box-shadow:0 8px 32px rgba(15,22,38,.22); min-width:160px;
    padding:5px 0; font-size:.84rem; font-family:inherit;`;
  const r = e.currentTarget.getBoundingClientRect();
  menu.style.left = (r.right + 4) + 'px';
  menu.style.top  = r.top + 'px';

  const items = [
    { label: 'Open', action: () => goWorkspace(projId, null) },
    { label: 'Rename', action: () => {
        const p = projects[projId]; if (!p) return;
        const n = prompt('Rename project:', p.name);
        if (n && n.trim()) { p.name = n.trim(); p.updatedAt = Date.now(); scheduleSave(); renderDashboard(); }
    }},
    { sep: true },
    { label: 'Export .json', action: () => exportProject(projId) },
    { sep: true },
    { label: 'Delete', danger: true, action: () => {
        if (!confirm(`Delete "${projects[projId]?.name}"? This cannot be undone.`)) return;
        delete projects[projId];
        if (activeProjectId === projId) {
          activeProjectId = Object.keys(projects)[0] || null;
          localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId || '');
          if (!activeProjectId) { const p = newProject('My First Project'); projects[p.id] = p; activeProjectId = p.id; }
        }
        scheduleSave(); renderDashboard();
    }}
  ];

  items.forEach(it => {
    if (it.sep) { const s = document.createElement('div'); s.style.cssText='height:1px;background:#e7ebf2;margin:4px 0;'; menu.appendChild(s); return; }
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;padding:8px 14px;cursor:pointer;color:${it.danger?'#ef4444':'#323d4d'};font-weight:500;`;
    el.textContent = it.label;
    el.addEventListener('mouseover', () => el.style.background = it.danger?'#fff5f5':'#eef1f7');
    el.addEventListener('mouseout',  () => el.style.background = '');
    el.addEventListener('click', () => { document.body.removeChild(menu); it.action(); });
    menu.appendChild(el);
  });

  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function close(){ document.body.contains(menu) && document.body.removeChild(menu); document.removeEventListener('click', close); }, { once: true });
  }, 0);
}

/* =====================================================================
   WORKSPACE — SIDEBAR
   ===================================================================== */
function renderSidebar() {
  const proj = projects[activeProjectId];
  if (!proj) return;
  const code = proj.settings?.code || 'ASCE 7-22';
  const calcs = proj.calculations || [];

  elTreeList.innerHTML = '';

  // ── project root ──
  const root = el('div', 'tree-root', `
    <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 21V9l9-6 9 6v12H3z"/>
    </svg>
    <span class="tree-root-name">${escHtml(proj.name)}</span>`);
  root.addEventListener('click', () => openCalc('settings'));
  elTreeList.appendChild(root);

  // ── Site & Building Loads ──
  const siteCalcs = calcs.filter(c => MODULE_MAP[c.type]?.group === 'site');
  appendGroupHdr(elTreeList, 'Site &amp; Building Loads');
  siteCalcs.forEach(calc => elTreeList.appendChild(buildCalcItem(calc, code)));

  if (siteCalcs.length === 0) {
    elTreeList.appendChild(el('div', 'tree-empty', 'No calculations yet'));
  }

  // ── Structural Elements (placeholder) ──
  appendGroupHdr(elTreeList, 'Structural Elements');
  elTreeList.appendChild(el('div', 'tree-empty', 'Coming soon — beam, column, connection design'));
}

function appendGroupHdr(parent, labelHtml) {
  const hdr = document.createElement('div');
  hdr.className = 'tree-group-hdr';
  hdr.innerHTML = labelHtml;
  parent.appendChild(hdr);
}

var CALC_ICONS = {
  wind:    `<path d="M9 4a2 2 0 1 1 2 2H3M17 9a2 2 0 1 1-2 2H3M11 18a2 2 0 1 0 2-2H3"/>`,
  snow:    `<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>`,
  seismic: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`
};

function buildCalcItem(calc, code) {
  const def     = MODULE_MAP[calc.type];
  const variant = def?.variants[code];
  const planned = !variant || variant.status !== 'ready';
  const icon    = CALC_ICONS[calc.type] || `<circle cx="12" cy="12" r="9"/>`;
  const desc    = calc.description || (variant?.label || '');

  const item = el('div', `tree-item${planned?' planned':''}`, `
    <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icon}</svg>
    <div class="tree-item-body">
      <div class="tree-item-name">${escHtml(calc.title)}</div>
      ${calc.description ? `<div class="tree-item-desc">${escHtml(calc.description)}</div>` : ''}
    </div>
    <span class="status-dot idle" id="dot-${calc.id}"></span>
    <button class="item-menu-btn" data-cid="${calc.id}" title="More options">
      <svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>
      </svg>
    </button>`);
  item.dataset.calcId = calc.id;

  item.addEventListener('click', e => {
    if (e.target.closest('.item-menu-btn')) return;
    openCalc(calc.id);
  });
  item.querySelector('.item-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    showCalcCtxMenu(e, calc.id);
  });
  return item;
}

function setActiveTreeItem(calcId) {
  elTreeList.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
  if (calcId && calcId !== 'settings') {
    const item = elTreeList.querySelector(`[data-calc-id="${calcId}"]`);
    if (item) item.classList.add('active');
  }
}

/* ── Calc context menu ──────────────────────────────────────────────── */
function showCalcCtxMenu(e, calcId) {
  e.stopPropagation();
  ctxTargetId = calcId;
  elCtxMenu.classList.remove('hidden');
  const r = e.currentTarget.getBoundingClientRect();
  let left = r.right + 6;
  let top  = r.top;
  if (left + 180 > window.innerWidth) left = r.left - 184;
  elCtxMenu.style.left = left + 'px';
  elCtxMenu.style.top  = top  + 'px';
}

document.addEventListener('click', e => {
  if (!elCtxMenu.classList.contains('hidden') && !elCtxMenu.contains(e.target)) {
    elCtxMenu.classList.add('hidden');
  }
});

document.getElementById('ctx-rename').addEventListener('click', () => {
  elCtxMenu.classList.add('hidden');
  const proj = projects[activeProjectId];
  const calc = proj?.calculations?.find(c => c.id === ctxTargetId);
  if (!calc) return;
  const n = prompt('Rename:', calc.description || calc.title);
  if (n !== null) {
    calc.description = n.trim();
    proj.updatedAt = Date.now();
    scheduleSave();
    renderSidebar();
    if (activeCalcId === calc.id) elWsCrumbCalc.textContent = calcLabel(calc);
  }
});

document.getElementById('ctx-duplicate').addEventListener('click', () => {
  elCtxMenu.classList.add('hidden');
  const proj = projects[activeProjectId];
  const src  = proj?.calculations?.find(c => c.id === ctxTargetId);
  if (!src) return;
  const dup = JSON.parse(JSON.stringify(src));
  dup.id = makeId('c');
  dup.description = (dup.description || dup.title) + ' (copy)';
  const idx = proj.calculations.indexOf(src);
  proj.calculations.splice(idx + 1, 0, dup);
  proj.updatedAt = Date.now();
  scheduleSave();
  renderSidebar();
});

document.getElementById('ctx-delete').addEventListener('click', () => {
  elCtxMenu.classList.add('hidden');
  const proj = projects[activeProjectId];
  const calc = proj?.calculations?.find(c => c.id === ctxTargetId);
  if (!calc) return;
  if (!confirm(`Delete "${calc.description || calc.title}"?`)) return;
  proj.calculations = proj.calculations.filter(c => c.id !== ctxTargetId);
  proj.updatedAt = Date.now();
  scheduleSave();
  renderSidebar();
  // switch to first remaining or settings
  const next = proj.calculations[0];
  openCalc(next ? next.id : 'settings');
});

/* =====================================================================
   WORKSPACE — MODULE LOADING
   ===================================================================== */
function showOnly(which) {
  elModuleHost.classList.add('hidden');
  elModulePh.classList.add('hidden');
  elProjSettings.classList.add('hidden');
  elModuleLoading.classList.add('hidden');
  // ws-content vs ws-main
  elWsContent.classList.remove('hidden');
  elWsMain.classList.add('hidden');
  if (which) which.classList.remove('hidden');
}

function showWindWorkspace() {
  elWsContent.classList.add('hidden');
  elWsMain.classList.remove('hidden');
}

async function openCalc(calcId) {
  activeCalcId = calcId;
  const proj   = projects[activeProjectId];
  if (!proj) return;

  setActiveTreeItem(calcId);

  if (calcId === 'settings') {
    renderProjectSettings();
    return;
  }

  const calc = proj.calculations?.find(c => c.id === calcId);
  if (!calc) { renderProjectSettings(); return; }

  proj.activeCalcId = calcId;
  elWsCrumbCalc.textContent = calcLabel(calc);
  updateStatusBar(proj, calc);

  const code    = proj.settings?.code || 'ASCE 7-22';
  const variant = MODULE_MAP[calc.type]?.variants[code];

  if (!variant || variant.status !== 'ready') {
    renderPlaceholder(calc, code);
    return;
  }

  // Wind module — use new 3-column workspace for any ready wind variant
  if (calc.type === 'wind') {
    showWindWorkspace();
    try {
      await openWindWorkspace(proj, calc);
    } catch (err) {
      console.error('StructCalc: wind workspace error', err);
      showOnly(elModulePh);
      elModulePh.innerHTML = `<h2>Wind workspace error</h2><p class="ph-sub">${escHtml(err.message)}</p>`;
    }
    return;
  }

  showOnly(elModuleLoading);
  try {
    await loadModule(variant, proj, calc);
  } catch (err) {
    console.error('StructCalc: module load failed', err);
    showOnly(elModulePh);
    elModulePh.innerHTML = `<h2>Failed to load module</h2><p class="ph-sub">${escHtml(err.message)}</p>`;
  }
}


/* ── CSS scoper ─────────────────────────────────────────────────────────
   Prefixes all module CSS selectors with #module-host so that module
   rules (body, main, header.topbar, etc.) cannot bleed into shell layout.
   :root blocks are kept global so module CSS variables still resolve.
   ──────────────────────────────────────────────────────────────────────── */
function scopeCSS(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
  let out = '', i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace === -1) break;
    const sel = css.slice(i, brace).trim();
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    if (sel.startsWith('@keyframes') || sel.startsWith('@font-face') ||
        sel.startsWith('@charset')   || sel.startsWith('@import')    ||
        sel.startsWith('@namespace')) {
      out += sel + '{' + body + '}\n';
    } else if (sel.startsWith('@media') || sel.startsWith('@supports') || sel.startsWith('@layer')) {
      out += sel + '{\n' + scopeCSS(body) + '}\n';
    } else {
      const scoped = sel.split(',').map(s => {
        s = s.trim(); if (!s) return '';
        if (s === 'body' || s === 'html') return '#module-host';
        if (s.startsWith(':root') || s.includes('#module-host')) return s;
        // body.class-name → .mod-workspace.class-name (body classes set by engine on .mod-workspace)
        if (s.startsWith('body.')) return s.replace(/^body/, '.mod-workspace');
        return '#module-host ' + s;
      }).filter(Boolean).join(',\n');
      out += scoped + '{' + body + '}\n';
    }
    i = j;
  }
  return out;
}

async function loadModule(variant, proj, calc) {
  // Fetch the module HTML
  const resp = await fetch(variant.path);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${variant.path}`);
  const html = await resp.text();

  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  // ── Inject module styles ──
  let oldStyle = document.getElementById('module-injected-style');
  if (oldStyle) oldStyle.remove();
  const styleEl = document.createElement('style');
  styleEl.id = 'module-injected-style';
  doc.querySelectorAll('style').forEach(s => { styleEl.textContent += scopeCSS(s.textContent) + '\n'; });
  document.head.appendChild(styleEl);

  // ── Inject module body HTML ──
  elModuleHost.innerHTML = doc.body.innerHTML;

  // ── Remove old module scripts ──
  document.querySelectorAll('.module-script').forEach(s => s.remove());

  // ── Load external scripts (engine.js etc.) ──
  const base = variant.path.replace(/\/[^/]+$/, '/');
  for (const s of doc.querySelectorAll('script[src]')) {
    const src = base + s.getAttribute('src').replace(/^.*\//, '');
    if (!loadedScripts[src]) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.className = 'module-script';
        script.src = src;
        script.onload  = () => { loadedScripts[src] = true; resolve(); };
        script.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(script);
      });
    }
  }

  // ── Run inline scripts ──
  for (const s of doc.querySelectorAll('script:not([src])')) {
    try {
      // eslint-disable-next-line no-new-func
      new Function(s.textContent)();
    } catch (e) { /* inline scripts often reference DOM that isn't ready — ignore */ }
  }

  showOnly(elModuleHost);

  // ── Restore saved state → module ──
  const savedEntry = calc.state?.[proj.settings?.code];
  if (savedEntry && savedEntry.state) {
    setTimeout(() => {
      try {
        window.postMessage({ type: 'loadState', state: savedEntry.state, unitSystem: savedEntry.unitSystem }, '*');
      } catch {}
    }, 200);
  }

  // ── Listen for state changes from module ──
  window._moduleStateListener && window.removeEventListener('message', window._moduleStateListener);
  window._moduleStateListener = function(e) {
    if (e.data?.type === 'stateChanged') {
      const code = proj.settings?.code;
      if (!calc.state) calc.state = {};
      calc.state[code] = { state: e.data.state, unitSystem: e.data.unitSystem };
      proj.updatedAt = Date.now();
      scheduleSave();
    }
  };
  window.addEventListener('message', window._moduleStateListener);
}

/* ── Project settings view ──────────────────────────────────────────── */
function renderProjectSettings() {
  const proj = projects[activeProjectId];
  if (!proj) return;
  setActiveTreeItem(null);
  elWsCrumbCalc.textContent = 'Project Settings';
  updateStatusBar(proj, null);
  showOnly(elProjSettings);

  elProjSettings.innerHTML = `
    <h2>Project Settings</h2>
    <div class="settings-field">
      <label>Project name</label>
      <input type="text" id="spName" value="${escHtml(proj.name)}">
    </div>
    <div class="settings-field">
      <label>Address / location</label>
      <input type="text" id="spAddress" value="${escHtml(proj.address || '')}">
    </div>
    <div class="settings-field">
      <label>Design code</label>
      <select id="spCode">
        <option value="ASCE 7-22"${proj.settings?.code==='ASCE 7-22'?' selected':''}>ASCE 7-22 (United States)</option>
        <option value="NBCC 2015"${proj.settings?.code==='NBCC 2015'?' selected':''}>NBCC 2015 (Canada)</option>
      </select>
    </div>
    <div class="settings-field">
      <label>Unit system</label>
      <select id="spUnits">
        <option value="US"${proj.settings?.units==='US'?' selected':''}>US / Imperial (psf, ft, mph)</option>
        <option value="SI"${proj.settings?.units==='SI'?' selected':''}>SI (kPa, m, m/s)</option>
      </select>
    </div>
    <div class="settings-divider"></div>
    <div class="settings-actions">
      <button class="btn btn-primary" id="spSave">Save Settings</button>
      <button class="btn" id="spExport">Export .json</button>
    </div>
    <div class="danger-zone">
      <h4>Danger Zone</h4>
      <button class="btn btn-danger" id="spDelete">Delete This Project</button>
    </div>`;

  document.getElementById('spSave').addEventListener('click', () => {
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
  document.getElementById('spExport').addEventListener('click', () => exportProject(activeProjectId));
  document.getElementById('spDelete').addEventListener('click', () => {
    if (!confirm(`Delete "${proj.name}"? This cannot be undone.`)) return;
    delete projects[activeProjectId];
    saveProjects();
    const next = Object.keys(projects)[0];
    if (!next) { const p = newProject('My First Project'); projects[p.id] = p; saveProjects(); }
    goDashboard();
  });
}

/* ── Planned module placeholder ─────────────────────────────────────── */
function renderPlaceholder(calc, code) {
  const def  = MODULE_MAP[calc.type];
  const variant = def?.variants[code];
  const rm   = variant?.roadmap;
  showOnly(elModulePh);
  elWsCrumbCalc.textContent = calcLabel(calc) + ' (roadmap)';
  elModulePh.innerHTML = `
    <h2>${escHtml(def?.title || calc.title)} — ${escHtml(code)}</h2>
    <p class="ph-sub">${escHtml(variant?.label || 'Coming soon')}</p>
    ${rm ? `<p>${escHtml(rm.summary)}</p>
    <ul style="margin-top:12px">${rm.points.map(p=>`<li>${escHtml(p)}</li>`).join('')}</ul>` : ''}
    <div class="placeholder-note">
      This module is on the r      This module is on the roadmap. Switch to a ready module using the project tree.
    </div>`;
}

/* ── Status bar ─────────────────────────────────────────────────────── */
function updateStatusBar(proj, calc) {
  const code  = proj?.settings?.code  || 'ASCE 7-22';
  const units = proj?.settings?.units || 'US';
  elStatusCode.innerHTML = `
    <svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
    ${escHtml(code)}`;
  elStatusUnits.textContent = units === 'SI' ? 'SI (kPa, m)' : 'US / Imperial';
  elStatusDetail.textContent = calc ? calcLabel(calc) : (proj?.name || '');
}

function showSavePill(msg, err) {
  const pill = document.getElementById('wsSavePill');
  if (!pill) return;
  pill.innerHTML = err
    ? `<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${escHtml(msg)}`
    : `<svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> ${escHtml(msg)}`;
  pill.style.color = err ? '#fca5a5' : '#bdf3c7';
}

/* =====================================================================
   SIDEBAR RESIZE
   ===================================================================== */
(function() {
  const sidebar = document.getElementById('wsSidebar');
  const handle  = document.getElementById('sidebarResizeHandle');
  if (!handle) return;
  let dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.max(160, Math.min(480, startW + (e.clientX - startX)));
    sidebar.style.width = w + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });
})();

/* =====================================================================
   ADD CALCULATION MODAL
   ===================================================================== */
var elAddCalcModal = document.getElementById('addCalcModal');
var elCalcTypeGrid = document.getElementById('calcTypeGrid');
var elAcAdd        = document.getElementById('acAdd');
var elAcDesc       = document.getElementById('acDescription');
var   selectedType   = null;

function openAddCalcModal() {
  const proj = projects[activeProjectId];
  if (!proj) return;
  const code = proj.settings?.code || 'ASCE 7-22';

  elCalcTypeGrid.innerHTML = '';
  selectedType = null;
  elAcAdd.disabled = true;
  elAcDesc.value = '';

  MODULE_TYPES.forEach(mod => {
    const variant = mod.variants[code];
    const ready   = variant && variant.status === 'ready';
    const card    = el('div', `calc-type-card${ready?'':' planned'}`, `
      <div class="calc-type-icon">${mod.icon}</div>
      <div class="calc-type-title">${escHtml(mod.title)}</div>
      <div class="calc-type-sub">${ready ? escHtml(variant.label) : 'Roadmap'}</div>`);
    if (ready) {
      card.addEventListener('click', () => {
        elCalcTypeGrid.querySelectorAll('.calc-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedType = mod.type;
        elAcAdd.disabled = false;
      });
    }
    elCalcTypeGrid.appendChild(card);
  });

  elAddCalcModal.classList.add('open');
}

elAcAdd.addEventListener('click', () => {
  if (!selectedType) return;
  const proj  = projects[activeProjectId];
  const calc  = newCalc(selectedType, elAcDesc.value);
  proj.calculations.push(calc);
  proj.updatedAt = Date.now();
  scheduleSave();
  elAddCalcModal.classList.remove('open');
  renderSidebar();
  openCalc(calc.id);
});

document.getElementById('addCalcClose').addEventListener('click', () => elAddCalcModal.classList.remove('open'));
document.getElementById('addCalcCancel').addEventListener('click', () => elAddCalcModal.classList.remove('open'));
document.getElementById('btnAddCalc').addEventListener('click', openAddCalcModal);
document.getElementById('treeAddBtn').addEventListener('click', openAddCalcModal);

/* =====================================================================
   NEW PROJECT MODAL
   ===================================================================== */
var elNewProjModal  = document.getElementById('newProjectModal');
var elNpCode        = document.getElementById('npCode');
var elNpUnits       = document.getElementById('npUnits');

elNpCode.addEventListener('change', () => {
  const defUnits = DEFAULT_UNITS[elNpCode.value] || 'US';
  elNpUnits.value = defUnits;
});

function openNewProjectModal() {
  document.getElementById('npName').value = '';
  document.getElementById('npAddress').value = '';
  elNpCode.value  = 'ASCE 7-22';
  elNpUnits.value = 'US';
  elNewProjModal.classList.add('open');
  setTimeout(() => document.getElementById('npName').focus(), 50);
}

document.getElementById('npCreate').addEventListener('click', () => {
  const name = document.getElementById('npName').value.trim();
  if (!name) { document.getElementById('npName').focus(); return; }
  const proj = newProject(name, { code: elNpCode.value, units: elNpUnits.value });
  proj.address = document.getElementById('npAddress').value.trim();
  projects[proj.id] = proj;
  activeProjectId = proj.id;
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
  scheduleSave();
  elNewProjModal.classList.remove('open');
  goWorkspace(proj.id, null);
});

document.getElementById('newProjectClose').addEventListener('click', () => elNewProjModal.classList.remove('open'));
document.getElementById('newProjectCancel').addEventListener('click', () => elNewProjModal.classList.remove('open'));
document.getElementById('btnNewProject').addEventListener('click', openNewProjectModal);

// Close modals on overlay click
[elNewProjModal, elAddCalcModal].forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

/* =====================================================================
   DASHBOARD EVENT WIRING
   ===================================================================== */
document.getElementById('wsBack').addEventListener('click', goDashboard);
document.getElementById('dbSearch').addEventListener('input', () => renderDashboard());
document.getElementById('dbSort').addEventListener('change', () => renderDashboard());
document.getElementById('btnExport').addEventListener('click', () => exportProject(activeProjectId));

document.getElementById('dbRail').addEventListener('click', e => {
  const item = e.target.closest('[data-filter]');
  if (!item) return;
  document.querySelectorAll('.rail-item').forEach(r => r.classList.remove('active'));
  item.classList.add('active');
});

/* =====================================================================
   EXPORT / IMPORT
   ===================================================================== */
function exportProject(projId) {
  const proj = projects[projId];
  if (!proj) return;
  const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (proj.name || 'project').replace(/[^a-z0-9_-]/gi, '_') + '.json';
  a.click();
}

document.getElementById('importFile').addEventListener('change', function() {
  const f = this.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.id || !data.name) { alert('Invalid project file.'); return; }
      data.id = makeId('p');
      data.updatedAt = Date.now();
      projects[data.id] = data;
      activeProjectId = data.id;
      localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
      scheduleSave();
      goWorkspace(data.id, null);
    } catch { alert('Could not read project file.'); }
  };
  r.readAsText(f);
  this.value = '';
});

/* =====================================================================
   HELPERS
   ===================================================================== */
function el(tag, className, html) {
  const e = document.createElement(tag);
  e.className = className;
  if (html) e.innerHTML = html;
  return e;
}


function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  if (!ts) return '';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calcLabel(calc) {
  return calc.description ? `${calc.title} — ${calc.description}` : calc.title;
}

/* =====================================================================
   WIND WORKSPACE — 3-column layout with Three.js 3D renderer
   LOCKED STRUCTURE: col-input(320px) | col-diagram(1fr) | col-results(380px)
   ===================================================================== */

var windScriptsLoaded = false;
var windEngineLoaded  = false;
var windRenderer      = null;
var windActiveProj    = null;
var windActiveCalc    = null;
var windSavedState    = null;

function loadScriptTag(src) {
  return new Promise((resolve, reject) => {
    for (const s of document.scripts) {
      if (s.src === src || s.src.endsWith('/' + src.split('/').pop())) { resolve(); return; }
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload  = resolve;
    script.onerror = () => reject(new Error('Script load failed: ' + src));
    document.head.appendChild(script);
  });
}

async function loadWindScripts() {
  if (windScriptsLoaded) return;
  await loadScriptTag('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
  await loadScriptTag('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
  await loadScriptTag('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/renderers/CSS2DRenderer.js');
  await loadScriptTag('renderer.js?v=4');
  windScriptsLoaded = true;
}

async function loadWindEngine() {
  if (windEngineLoaded) return;
  // Tell engine.js to skip its UI init() — we only need compute()
  window._wsShellMode = true;
  await loadScriptTag('../ASCE 7-22 Wind Load Calculator/engine.js');
  windEngineLoaded = true;
}

var WIND_INPUT_MAP = {
  'wind-h':          'h',
  'wind-B':          'minDim',
  'wind-L':          'buildingL',
  'wind-theta':      'theta',
  'wind-roofShape':  'roofShape',
  'wind-V':          'V',
  'wind-exposure':   'exposure',
  'wind-kzt':        'kzt',
  'wind-groundElev': 'groundElev',
  'wind-enclosure':  'enclosure',
  'wind-riskCategory': 'riskCategory',
  'wind-areaWall':   'areaWall',
  'wind-areaRoof':   'areaRoof',
};

function gatherWindState(base) {
  const s = Object.assign({}, base || {});
  const defs = {
    unitSystem:'US', mode:'mwfrs', roofType:'sloped',
    h:20, minDim:40, buildingL:60, theta:18, roofShape:'gable',
    V:115, exposure:'C', kzt:1.0, kztMode:'manual',
    groundElev:0, enclosure:'enclosed', riskCategory:'II',
    areaWall:20, areaRoof:50,
    mwfrsProcedure:'envelope', ccProcedure:'part1',
    hasOverhang:false, hasParapet:false, hasCanopy:false,
    hasCircularTank:false, hasSteppedRoof:false, hasMultispanRoof:false,
    hasSawtoothRoof:false, hasDomeRoof:false, hasMonoslopeRoof:false,
    ch32Enabled:false, structureCategory:'building',
  };
  Object.keys(defs).forEach(k => { if (s[k] === undefined) s[k] = defs[k]; });
  Object.entries(WIND_INPUT_MAP).forEach(([elId, key]) => {
    const inp = document.getElementById(elId);
    if (!inp) return;
    const num = parseFloat(inp.value);
    s[key] = isNaN(num) ? inp.value : num;
  });
  const activeProc = document.querySelector('#windProcToggle button.active');
  if (activeProc) {
    const proc = activeProc.dataset.proc;
    if (proc === 'cc') { s.mode = 'cc'; }
    else { s.mode = 'mwfrs'; s.mwfrsProcedure = proc; }
  }
  s.roofType = (s.theta <= 7 || s.roofShape === 'flat') ? 'flat' : 'sloped';
  if (s.roofShape === 'flat') s.theta = 0;
  return s;
}

function restoreWindInputs(saved) {
  const revMap = Object.fromEntries(
    Object.entries(WIND_INPUT_MAP).map(([e,k]) => [k, e])
  );
  Object.entries(saved).forEach(([key, val]) => {
    const inp = document.getElementById(revMap[key]);
    if (inp) inp.value = val;
  });
  if (saved.mode === 'cc') {
    setWindProc('cc');
    activateInputTab('cc');
  } else if (saved.mwfrsProcedure) {
    setWindProc(saved.mwfrsProcedure);
  }
}

function setWindProc(proc) {
  document.querySelectorAll('#windProcToggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.proc === proc);
  });
}

function recalcWind() {
  if (!windActiveProj || !windActiveCalc) return;
  const s = gatherWindState(windSavedState || {});
  let r = null;
  try { r = window.compute(s); } catch(e) { console.warn('Wind compute error', e); }

  const B = s.minDim || 40;
  const L = s.buildingL || 60;
  const hE = s.h || 20;
  const th = s.theta || 0;
  const hR = (s.roofType === 'flat') ? hE : hE + (B / 2) * Math.tan(th * Math.PI / 180);
  const za = r && r.a ? r.a : Math.min(0.1 * Math.min(B, L), Math.min(0.4 * hE, 0.04 * Math.min(B, L)));

  if (windRenderer) windRenderer.update3DModel(B, L, hE, hR, za);

  const vDisp = document.getElementById('wind-V-display');
  if (vDisp) vDisp.textContent = s.V;

  const cap = document.getElementById('windDiagramCaption');
  if (cap) {
    const sh = {gable:'Gable Roof',hip:'Hip Roof',flat:'Flat Roof',monoslope:'Monoslope Roof'};
    const pr = {envelope:'Envelope (Ch. 28)',directional:'Directional (Ch. 27)',cc:'C&C (Ch. 30)'};
    const pk = s.mode === 'cc' ? 'cc' : s.mwfrsProcedure;
    cap.textContent = (sh[s.roofShape] || 'Building') + ' — ' + (pr[pk] || '');
  }

  renderWindResults(r, s);

  if (!windActiveCalc.state) windActiveCalc.state = {};
  windActiveCalc.state['ASCE 7-22'] = { state: s, unitSystem: s.unitSystem };
  windActiveProj.updatedAt = Date.now();
  scheduleSave();
  windSavedState = s;
}

function renderWindResults(r, s) {
  const host = document.getElementById('windResultsContent');
  if (!host) return;
  if (!r) {
    host.innerHTML = '<div class="result-card"><div class="result-card-head">Error</div>' +
      '<div class="result-row"><span class="k">Calculation error — check inputs</span></div></div>';
    return;
  }
  const fmt = (v, d) => (typeof v === 'number' ? v.toFixed(d != null ? d : 2) : '—');
  const psf = v => fmt(v) + ' psf';
  let html = '';

  html += '<div class="result-card"><div class="result-card-head">Site &amp; Parameters</div>' +
    '<div class="result-row"><span class="k">Risk Category</span><span class="v"><span class="badge-risk">' + escHtml(s.riskCategory) + '</span></span></div>' +
    '<div class="result-row"><span class="k">Exposure</span><span class="v">' + escHtml(s.exposure) + '</span></div>' +
    '<div class="result-row"><span class="k">Enclosure</span><span class="v">' + escHtml({enclosed:'Enclosed',partiallyEnclosed:'Part. Enclosed',open:'Open'}[s.enclosure] || s.enclosure) + '</span></div>' +
    '<div class="result-row"><span class="k">Procedure</span><span class="v">' + escHtml(s.mode === 'cc' ? 'C&C Ch.30' : (s.mwfrsProcedure === 'envelope' ? 'MWFRS Env Ch.28' : 'MWFRS Dir Ch.27')) + '</span></div>' +
    '</div>';

  const gcpiVal = r.gcpi && typeof r.gcpi === 'object' ? r.gcpi.pos : r.gcpi;
  html += '<div class="result-card"><div class="result-card-head">Velocity Pressure</div>' +
    '<div class="result-row"><span class="k">K<sub>h</sub></span><span class="v">' + fmt(r.kh, 3) + '</span></div>' +
    '<div class="result-row"><span class="k">K<sub>e</sub></span><span class="v">' + fmt(r.ke, 3) + '</span></div>' +
    '<div class="result-row"><span class="k">K<sub>d</sub></span><span class="v">' + fmt(r.kd, 2) + '</span></div>' +
    '<div class="result-row"><span class="k">q<sub>h</sub></span><span class="v">' + psf(r.qh) + '</span></div>' +
    '<div class="result-row"><span class="k">(GC<sub>pi</sub>)</span><span class="v">±' + fmt(gcpiVal, 2) + '</span></div>' +
    '<div class="result-row"><span class="k">Zone a</span><span class="v">' + fmt(r.a, 2) + ' ft</span></div>' +
    '</div>';

  if (s.mode === 'mwfrs' && s.mwfrsProcedure === 'envelope' && r.mwfrsLC1 && r.mwfrsLC1.length) {
    const all = [...(r.mwfrsLC1 || []), ...(r.mwfrsLC2 || [])];
    const seen = new Set();
    const uniq = all.filter(z => !seen.has(z.zone) && seen.add(z.zone));
    html += '<div class="result-card"><div class="result-card-head">MWFRS — Envelope (Ch. 28)</div>';
    uniq.forEach(z => {
      const ma = Math.max(Math.abs(z.pos || 0), Math.abs(z.neg || 0));
      const cl = ma > 30 ? 'zone-crit' : ma > 20 ? 'zone-high' : ma > 12 ? 'zone-mid' : 'zone-low';
      const vstr = (z.pos != null ? '+' + fmt(z.pos) : '') + (z.neg != null ? ' / ' + fmt(z.neg) : '') + ' psf';
      html += '<div class="result-row ' + cl + '"><span class="k">' + escHtml(z.zone) + '</span><span class="v">' + vstr + '</span></div>';
    });
    html += '</div>';
  }

  if (s.mode === 'mwfrs' && s.mwfrsProcedure === 'directional' && r.ch27) {
    const d = r.ch27;
    html += '<div class="result-card"><div class="result-card-head">MWFRS — Directional (Ch. 27)</div>';
    if (d.pWW != null) html += '<div class="result-row zone-mid"><span class="k">Windward wall</span><span class="v">+' + fmt(d.pWW) + ' psf</span></div>';
    if (d.pLW != null) html += '<div class="result-row zone-low"><span class="k">Leeward wall</span><span class="v">' + fmt(d.pLW) + ' psf</span></div>';
    if (Array.isArray(d.roof)) d.roof.forEach(rz => {
      html += '<div class="result-row zone-mid"><span class="k">' + escHtml(rz.label || 'Roof') + '</span><span class="v">' + fmt(rz.p) + ' psf</span></div>';
    });
    html += '</div>';
  }

  if (s.mode === 'cc') {
    // r.ccWall and r.ccRoof are arrays: [{zone, gcp, p:{neg,pos}}, ...]
    if (r.ccWall && r.ccWall.length) {
      const wallLabel = { '4': 'Zone 4 — field', '5': 'Zone 5 — corner' };
      const wallCls   = { '4': 'zone-low', '5': 'zone-high' };
      html += '<div class="result-card"><div class="result-card-head">C&amp;C — Walls (Ch. 30)</div>';
      r.ccWall.forEach(function(z) {
        const cl = wallCls[z.zone] || 'zone-mid';
        const lb = wallLabel[z.zone] || ('Zone ' + z.zone);
        html += '<div class="result-row ' + cl + '"><span class="k">' + lb + '</span><span class="v">' + fmt(z.p.neg) + ' / +' + fmt(z.p.pos) + ' psf</span></div>';
      });
      html += '</div>';
    }
    if (r.ccRoof && r.ccRoof.length) {
      const roofLabel = { '1p': 'Zone 1′ — field (low)', '1': 'Zone 1 — field', '2': 'Zone 2 — edge', '3': 'Zone 3 — corner' };
      const roofCls   = { '1p': 'zone-low', '1': 'zone-low', '2': 'zone-mid', '3': 'zone-high' };
      html += '<div class="result-card"><div class="result-card-head">C&amp;C — Roof (Ch. 30)</div>';
      r.ccRoof.forEach(function(z) {
        const cl = roofCls[z.zone] || 'zone-mid';
        const lb = roofLabel[z.zone] || ('Zone ' + z.zone);
        html += '<div class="result-row ' + cl + '"><span class="k">' + lb + '</span><span class="v">' + fmt(z.p.neg) + ' / +' + fmt(z.p.pos) + ' psf</span></div>';
      });
      html += '</div>';
    }
  }

  host.innerHTML = html;
}

function activateInputTab(tabName) {
  document.querySelectorAll('.input-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.input-tabs .tab-btn[data-tab="' + tabName + '"]');
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('hidden', c.id !== 'tab-' + tabName);
  });
}

function wireWindInputs() {
  let debounce = null;
  const onInput = () => { clearTimeout(debounce); debounce = setTimeout(recalcWind, 250); };
  Object.keys(WIND_INPUT_MAP).forEach(id => {
    const inp = document.getElementById(id);
    if (inp) inp.addEventListener('input', onInput);
  });
  document.querySelectorAll('#windProcToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#windProcToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Auto-switch to C&C tab when C&C procedure is selected
      if (btn.dataset.proc === 'cc') activateInputTab('cc');
      recalcWind();
    });
  });
  // Input section tab switching (Site / Geometry / C&C)
  document.querySelectorAll('.input-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.input-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('hidden', c.id !== 'tab-' + targetTab);
      });
    });
  });
  document.querySelectorAll('#windViewToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#windViewToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  const btnReset = document.getElementById('windBtnReset');
  if (btnReset) btnReset.addEventListener('click', () => windRenderer && windRenderer.resetCamera && windRenderer.resetCamera());
}

async function openWindWorkspace(proj, calc) {
  windActiveProj = proj;
  windActiveCalc = calc;

  const banner = document.getElementById('windBannerText');
  if (banner) banner.innerHTML = '<strong>' + escHtml(proj.name) + '</strong> · ASCE 7-22 · ' + escHtml(proj.settings && proj.settings.units === 'SI' ? 'SI' : 'US') + ' Units';

  await loadWindScripts();
  await loadWindEngine();

  const savedEntry = calc.state && calc.state['ASCE 7-22'];
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
  await new Promise(res => setTimeout(res, 60));
  try { windRenderer = new Wind3DRenderer('threejs-container'); } catch(e) { console.error('Wind3DRenderer init:', e); }

  if (!elWsMain._inputsWired) {
    wireWindInputs();
    elWsMain._inputsWired = true;
  }
  recalcWind();
}

/* =====================================================================
   INIT
   ===================================================================== */
renderDashboard();
var initials = 'SO';
document.getElementById('dbAvatar').textContent = initials;
document.getElementById('wsAvatar').textContent = initia