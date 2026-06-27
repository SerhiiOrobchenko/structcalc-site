/* =====================================================================
   StructCalc — projects.js
   Responsibility: constants, MODULE registry, helpers, data persistence,
                   state initialization, shared DOM refs.
   Rule: edit only for data-model or persistence changes.
   ===================================================================== */

/* ── Constants ─────────────────────────────────────────────────────── */
var LS_PROJECTS       = 'structcalc.projects.v2';
var LS_ACTIVE_PROJECT = 'structcalc.activeProject.v2';
var LS_ACTIVE_CALC    = 'structcalc.activeCalc.v2';
var DEFAULT_UNITS     = { 'ASCE 7-22': 'US', 'NBCC 2015': 'SI' };

/* ── Module registry ────────────────────────────────────────────────── */
var MODULE_TYPES = [
  {
    type: 'wind', group: 'site', icon: '💨', title: 'Wind Load',
    variants: {
      'ASCE 7-22': { status: 'ready', path: '../ASCE 7-22 Wind Load Calculator/index.html',
        enginePath: '../ASCE 7-22 Wind Load Calculator/engine.js', label: 'ASCE/SEI 7-22, Ch. 26–32' },
      'NBCC 2015': { status: 'planned', label: 'NBCC 2015, Sentence 4.1.7',
        roadmap: { summary: 'Wind pressure per NBCC 2015 Sentence 4.1.7 simple method.',
          points: ['Reference velocity pressure q from Appendix C climate data.',
            'Exposure factor Ce at roof height.',
            'Gust factor Cg = 2.0 (simple method).',
            'External pressure coefficient Cp for walls and roof.'] } }
    }
  },
  {
    type: 'snow', group: 'site', icon: '❄️', title: 'Snow Load',
    variants: {
      'ASCE 7-22': { status: 'ready', path: '../ASCE 7-22 Snow Load Calculator/index.html',
        enginePath: '../ASCE 7-22 Snow Load Calculator/engine.js', label: 'ASCE/SEI 7-22, Chapter 7' },
      'NBCC 2015': { status: 'ready', path: '../NBCC 2015 Snow Drift Calculator/index.html',
        enginePath: '../NBCC 2015 Snow Drift Calculator/engine.js', label: 'NBCC 2015, Sentence 4.1.6' }
    }
  },
  {
    type: 'seismic', group: 'site', icon: '🌍', title: 'Seismic Load',
    variants: {
      'ASCE 7-22': { status: 'planned', label: 'ASCE/SEI 7-22, Chapters 11–12',
        roadmap: { summary: 'Equivalent Lateral Force base shear per ASCE 7-22 Ch. 11 & 12.',
          points: ['Site coefficients Fa, Fv (Tables 11.4-1/11.4-2) applied to map values Ss, S1.',
            'Sms, Sm1, Sds, Sd1 and Seismic Design Category (Tables 11.6-1/11.6-2).',
            'Approximate period Ta (§12.8.2.1) and seismic response coefficient Cs.',
            'R, Ω₀, Cd by Seismic Force-Resisting System (Table 12.2-1).',
            'Base shear V = Cs·W (Eq. 12.8-1) and vertical distribution Fx.'] } },
      'NBCC 2015': { status: 'planned', label: 'NBCC 2015, Sentence 4.1.8',
        roadmap: { summary: 'Equivalent static base shear V per NBC 2015 Sentence 4.1.8.11.',
          points: ['Design spectral acceleration Sa(T) and site coefficients F(T).',
            'IeFaSa(0.2) and IeFvSa(1.0) with Earthquake Importance Factor Ie.',
            'Higher-mode factor Mv, ductility Rd and overstrength Ro factors.',
            'Fundamental period Ta and base shear V = S(Ta)·Mv·Ie·W / (Rd·Ro).'] } }
    }
  }
];

var MODULE_MAP = Object.fromEntries(MODULE_TYPES.map(function(m) { return [m.type, m]; }));

/* ── Helpers ────────────────────────────────────────────────────────── */
function el(tag, className, html) {
  var e = document.createElement(tag);
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
  var secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  if (secs < 604800) return Math.floor(secs / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calcLabel(calc) {
  return calc.description ? (calc.title + ' — ' + calc.description) : calc.title;
}

function makeId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/* ── Persistence ────────────────────────────────────────────────────── */
function loadProjects() {
  try {
    var raw = localStorage.getItem(LS_PROJECTS);
    if (!raw) return {};
    var obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}

function saveProjects() {
  try {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    if (typeof showSavePill === 'function') showSavePill('Saved');
  } catch (e) {
    if (typeof showSavePill === 'function') showSavePill('Save failed!', true);
    console.error('StructCalc: save failed', e);
  }
}

var saveTimer = null;
function scheduleSave() {
  if (typeof showSavePill === 'function') showSavePill('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProjects, 500);
}

/* ── Data models ────────────────────────────────────────────────────── */
function newCalc(type, description) {
  var def = MODULE_MAP[type] || MODULE_TYPES[0];
  return {
    id:          makeId('c'),
    type:        def.type,
    title:       def.title,
    description: (description || '').trim(),
    state:       {}
  };
}

function newProject(name, settings) {
  settings = settings || { code: 'ASCE 7-22', units: 'US' };
  var wc = newCalc('wind', '');
  return {
    id:          makeId('p'),
    name:        (name || 'New Project').trim(),
    address:     '',
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
    settings:    settings,
    calculations: [wc],
    activeCalcId: wc.id
  };
}

/* ── Migrate v1 localStorage data ───────────────────────────────────── */
function tryMigrateV1() {
  var old = localStorage.getItem('structcalc.projects.v1');
  if (!old) return;
  try {
    var v1 = JSON.parse(old);
    if (!v1 || typeof v1 !== 'object') return;
    Object.values(v1).forEach(function(p) {
      var code  = (p.settings && p.settings.code) || 'ASCE 7-22';
      var units = (p.settings && p.settings.units) || DEFAULT_UNITS[code] || 'US';
      var proj  = newProject(p.name, { code: code, units: units });
      proj.id = p.id || proj.id;
      proj.createdAt = p.createdAt || Date.now();
      proj.address = '';
      if (Array.isArray(p.calculations) && p.calculations.length) {
        proj.calculations = p.calculations;
        proj.activeCalcId = p.activeCalcId || p.calculations[0].id;
      }
      projects[proj.id] = proj;
    });
    saveProjects();
  } catch (e) { console.warn('StructCalc: v1 migration failed', e); }
}

/* ── State initialization ───────────────────────────────────────────── */
var projects = loadProjects();
if (Object.keys(projects).length === 0) { tryMigrateV1(); }
if (Object.keys(projects).length === 0) {
  var _initProj = newProject('My First Project', { code: 'ASCE 7-22', units: 'US' });
  projects[_initProj.id] = _initProj;
  saveProjects();
}

var activeProjectId = localStorage.getItem(LS_ACTIVE_PROJECT);
if (!activeProjectId || !projects[activeProjectId]) {
  activeProjectId = Object.keys(projects)[0];
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
}

/* ── Shared DOM refs ────────────────────────────────────────────────── */
var elDashboard    = document.getElementById('screen-dashboard');
var elWorkspace    = document.getElementById('screen-workspace');
var elProjGrid     = document.getElementById('projGrid');
var elDbSubtitle   = document.getElementById('dbSubtitle');
var elRailAll      = document.getElementById('railCountAll');
var elTreeList     = document.getElementById('treeList');
var elModuleHost   = document.getElementById('module-host');
var elModulePh     = document.getElementById('module-placeholder');
var elProjSettings = document.getElementById('project-settings-view');
var elModuleLoading= document.getElementById('module-loading');
var elWsCrumbProj  = document.getElementById('wsCrumbProject');
var elWsCrumbCalc  = document.getElementById('wsCrumbCalc');
var elStatusCode   = document.getElementById('statusCode');
var elStatusUnits  = document.getElementById('statusUnits');
var elStatusMsg    = document.getElementById('statusMsg');
var elStatusDetail = document.getElementById('statusDetail');
var elCtxMenu      = document.getElementById('ctx-menu');
var elWsMain       = document.getElementById('wsWindWorkspace');

var activeCalcId   = null;   // currently shown calc id
var loadedScripts  = {};     // { path: true } to avoid double-loading
var ctxTargetId    = null;   // calc id for context menu
