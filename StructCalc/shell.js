/* =====================================================================
   StructCalc — App Shell
   - Tab navigation between calculation modules (each module is its own
     standalone app, embedded here in an <iframe>).
   - Project manager: create / duplicate / rename / delete / switch
     projects, each holding its own saved state for every module.
     Stored in localStorage (this browser, this computer) plus
     Export/Import to .json for backup and moving between computers.
   - Sync protocol with module iframes (see bridge code appended to each
     module's engine.js):
       shell -> module : {type:'loadState', state:{...}, unitSystem?:'SI'|'US'}
       shell -> module : {type:'requestState'}
       module -> shell : {type:'stateChanged', module:<key>, state:{...}, unitSystem?:'SI'|'US'}
   ===================================================================== */

const LS_PROJECTS = 'structcalc.projects.v1';
const LS_ACTIVE_PROJECT = 'structcalc.activeProjectId.v1';
const LS_ACTIVE_TAB = 'structcalc.activeTab.v1';

/* ---- Module registry --------------------------------------------------- */
// 'ready'   -> module exists; loaded into the shared iframe.
// 'planned' -> not built yet; shows a roadmap placeholder instead.
const MODULES = [
  {
    key: 'snowASCE',
    title: 'Snow Loads',
    badge: 'ASCE 7-22',
    group: 'ASCE 7-22',
    path: '../ASCE 7-22 Snow Load Calculator/index.html',
    status: 'ready'
  },
  {
    key: 'snowDriftNBCC',
    title: 'Snow Drift',
    badge: 'NBCC 2015',
    group: 'NBCC 2015',
    path: '../NBCC 2015 Snow Drift Calculator/index.html',
    status: 'ready'
  },
  {
    key: 'windASCE',
    title: 'Wind Loads',
    badge: 'ASCE 7-22',
    group: 'ASCE 7-22',
    status: 'planned',
    roadmap: {
      summary: 'Main Wind Force Resisting System (MWFRS) and Components & Cladding (C&C) pressures for low-rise buildings.',
      points: [
        'Basic wind speed V and Risk Category (Ch. 26) — reuses the Site Location lookup already built for the Seismic data.',
        'Velocity pressure qₖ, qₕ via Kₖ (Table 26.10-1), Kₖₜ (topographic, Sec. 26.8), Kₑ, Kₑ (Sec. 26.9 / 26.6).',
        'Directionality factor Kₑ (Table 26.6-1) and Gust-Effect Factor G / Gf (Sec. 26.11).',
        'MWFRS external pressure coefficients GCₚf for low-rise buildings (Fig. 27.3-1, envelope procedure, Ch. 27 Part 2).',
        'Components & Cladding pressure coefficients GCₚ (Fig. 30.3-1 / 30.4-1 etc., Ch. 30) for walls, roof zones and corner/edge strips.',
        'Internal pressure coefficient GCₚᵢ by enclosure classification (Table 26.13-1).'
      ]
    }
  },
  {
    key: 'windNBCC',
    title: 'Wind Loads',
    badge: 'NBCC 2015',
    group: 'NBCC 2015',
    status: 'planned',
    roadmap: {
      summary: 'External wind pressures p = Iᵥ · q · Cₑ · Cᵍ · Cₚ per NBC 2015 Sentence 4.1.7.1.',
      points: [
        'Reference velocity pressure q from the 1-in-50 design wind speed (Appendix C, by location).',
        'Importance factor Iᵥ (Table 4.1.7.1, by Importance Category and ULS/SLS).',
        'Exposure factor Cₑ (Sentence 4.1.7.4 — open / rough terrain profiles).',
        'Gust effect factor Cᵍ (Sentence 4.1.7.1.(5) and Commentary I).',
        'External pressure coefficients Cₚ for walls and roofs (Commentary I figures, by building geometry).',
        'Internal pressure coefficients and combination with external pressures for net cladding/C&C loads.'
      ]
    }
  },
  {
    key: 'seismicASCE',
    title: 'Seismic',
    badge: 'ASCE 7-22',
    group: 'ASCE 7-22',
    status: 'planned',
    roadmap: {
      summary: 'Equivalent Lateral Force base shear and design parameters per ASCE 7-22 Ch. 11 &amp; 12, building on the Site Class / Sₛ / S₁ lookup already available in the Snow module.',
      points: [
        'Site coefficients Fₐ, Fᵥ (Tables 11.4-1 / 11.4-2) applied to map values Sₛ, S₁.',
        'Sₘₛ, Sₘ₁, Sᴅₛ, Sᴅ₁ (Sec. 11.4.3 / 11.4.4) and Seismic Design Category (Tables 11.6-1 / 11.6-2) — values already fetched via the USGS Design Maps API.',
        'Approximate fundamental period Tₐ (Sec. 12.8.2.1, Eq. 12.8-7/12.8-8) and seismic response coefficient Cₛ (Sec. 12.8.1.1, Eq. 12.8-2/12.8-3/12.8-4).',
        'Response modification coefficient R, overstrength Ω₀ and deflection amplification Cᴅ by Seismic Force-Resisting System (Table 12.2-1).',
        'Base shear V = Cₛ · W (Eq. 12.8-1) and vertical distribution Fₓ (Sec. 12.8.3).'
      ]
    }
  },
  {
    key: 'seismicNBCC',
    title: 'Seismic',
    badge: 'NBCC 2015',
    group: 'NBCC 2015',
    status: 'planned',
    roadmap: {
      summary: 'Equivalent static base shear V per NBC 2015 Sentence 4.1.8.11, using design spectral acceleration values Sₐ(T).',
      points: [
        'Design spectral acceleration Sₐ(T) from Sₐ(0.2), Sₐ(0.5), Sₐ(1.0), Sₐ(2.0) (Appendix C site data) and site coefficients F(T) (Tables 4.1.8.4.B/C).',
        'IᴇFₐSₐ(0.2) and IᴇFᵥSₐ(1.0), with Earthquake Importance Factor Iᴇ (Table 4.1.8.5) and Site Class.',
        'Higher-mode factor Mᵥ, ductility-related (Rᴅ) and overstrength-related (R₀) force modification factors (Table 4.1.8.9).',
        'Fundamental period Tₐ (Sentence 4.1.8.11.(3)) and base shear V = S(Tₐ)·Mᵥ·Iᴇ·W / (Rᴅ·R₀) (Sentence 4.1.8.11.(2)), with the 4.1.8.11.(2) upper/lower bounds.',
        'Vertical force distribution Fₓ and torsional considerations per Sentence 4.1.8.11.(6)-(8).'
      ]
    }
  }
];

const MODULE_BY_KEY = Object.fromEntries(MODULES.map(m => [m.key, m]));

// Sidebar groups, in display order — grouped by code/norm first (ASCE 7-22
// group, then NBCC 2015 group), per the project tree redesign.
const GROUP_ORDER = ['ASCE 7-22', 'NBCC 2015'];

// Default/first module for each design code — used by the New Project
// dialog to pick a sensible starting module based on the chosen code.
const DEFAULT_MODULE_BY_CODE = {
  'ASCE 7-22': 'snowASCE',
  'NBCC 2015': 'snowDriftNBCC'
};

/* ---- Persistence helpers ------------------------------------------------ */
function loadProjects() {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) {
    console.error('StructCalc: failed to load projects', e);
    return {};
  }
}

function saveProjectsNow() {
  try {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    setStatus('All changes saved to this browser.', true);
  } catch (e) {
    console.error('StructCalc: failed to save projects', e);
    setStatus('Could not save — local storage may be full or unavailable.', false);
  }
}

let saveTimer = null;
function scheduleSave() {
  setStatus('Saving…', null);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProjectsNow, 400);
}

function makeId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function newProject(name, settings) {
  settings = settings || { code: 'ASCE 7-22', units: 'US' };
  return {
    id: makeId(),
    name: name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activeModule: DEFAULT_MODULE_BY_CODE[settings.code] || 'snowASCE',
    settings: settings,
    modules: {}
  };
}

/* ---- DOM refs ------------------------------------------------------------ */
const elProjectSelect = document.getElementById('projectSelect');
const elSidebar = document.getElementById('sidebar');
const elFrame = document.getElementById('moduleFrame');
const elPlaceholder = document.getElementById('modulePlaceholder');
const elStatus = document.getElementById('statusbar');
const elImportFile = document.getElementById('importFile');

/* ---- New Project dialog --------------------------------------------------- */
const elNewProjectModal = document.getElementById('newProjectModal');
const elNpName = document.getElementById('npName');
const elNpCode = document.getElementById('npCode');
const elNpUnits = document.getElementById('npUnits');
const elNpCreate = document.getElementById('npCreate');
const elNewProjectClose = document.getElementById('newProjectClose');

/* ---- State -------------------------------------------------------------- */
let projects = loadProjects();
let activeProjectId = localStorage.getItem(LS_ACTIVE_PROJECT);

if (!activeProjectId || !projects[activeProjectId]) {
  const p = newProject('Project 1');
  projects[p.id] = p;
  activeProjectId = p.id;
  saveProjectsNow();
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
}

let activeModule = localStorage.getItem(LS_ACTIVE_TAB) || projects[activeProjectId].activeModule || 'snowASCE';
if (!MODULE_BY_KEY[activeModule]) activeModule = 'snowASCE';

/* ---- Status bar ----------------------------------------------------------- */
function setStatus(message, ok) {
  const proj = projects[activeProjectId];
  const left = document.createElement('span');
  left.textContent = message;
  if (ok === true) left.classList.add('saved-ok');
  const right = document.createElement('span');
  right.textContent = proj ? ('Project: ' + proj.name) : '';
  elStatus.innerHTML = '';
  elStatus.appendChild(left);
  elStatus.appendChild(right);
}

/* ---- Project selector ------------------------------------------------------ */
function renderProjectSelect() {
  elProjectSelect.innerHTML = '';
  const sorted = Object.values(projects).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  sorted.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    if (p.id === activeProjectId) o.selected = true;
    elProjectSelect.appendChild(o);
  });
}

elProjectSelect.addEventListener('change', () => {
  switchProject(elProjectSelect.value);
});

function switchProject(id) {
  if (!projects[id] || id === activeProjectId) return;
  activeProjectId = id;
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
  activeModule = projects[activeProjectId].activeModule || 'snowASCE';
  if (!MODULE_BY_KEY[activeModule]) activeModule = 'snowASCE';
  localStorage.setItem(LS_ACTIVE_TAB, activeModule);
  renderProjectSelect();
  renderSidebar();
  renderContent(true); // force reload so the module starts clean before we push saved state
  setStatus('Switched to project "' + projects[activeProjectId].name + '".', true);
}

/* ---- Project CRUD buttons --------------------------------------------------- */
document.getElementById('btnNewProject').addEventListener('click', () => {
  openNewProjectModal();
});

/* ---- New Project dialog: pick design code + unit system upfront ------------- */
function openNewProjectModal() {
  elNpName.value = 'Project ' + (Object.keys(projects).length + 1);
  elNpCode.value = 'ASCE 7-22';
  elNpUnits.value = 'US';
  elNewProjectModal.classList.add('open');
  elNpName.focus();
}

function closeNewProjectModal() {
  elNewProjectModal.classList.remove('open');
}

elNewProjectClose.addEventListener('click', closeNewProjectModal);
elNewProjectModal.addEventListener('click', (e) => {
  if (e.target === elNewProjectModal) closeNewProjectModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elNewProjectModal.classList.contains('open')) closeNewProjectModal();
});

elNpCreate.addEventListener('click', () => {
  const name = (elNpName.value || '').trim() || 'Untitled project';
  const settings = { code: elNpCode.value, units: elNpUnits.value };
  const p = newProject(name, settings);
  projects[p.id] = p;
  scheduleSave();
  closeNewProjectModal();
  switchProject(p.id);
  renderProjectSelect();
});

elNpName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elNpCreate.click();
});

document.getElementById('btnDuplicateProject').addEventListener('click', () => {
  const src = projects[activeProjectId];
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = makeId();
  copy.name = src.name + ' (copy)';
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  projects[copy.id] = copy;
  scheduleSave();
  switchProject(copy.id);
  renderProjectSelect();
  setStatus('Duplicated as "' + copy.name + '".', true);
});

document.getElementById('btnRenameProject').addEventListener('click', () => {
  const p = projects[activeProjectId];
  const name = prompt('Rename project:', p.name);
  if (!name) return;
  p.name = name.trim() || p.name;
  p.updatedAt = Date.now();
  scheduleSave();
  renderProjectSelect();
  setStatus('Renamed to "' + p.name + '".', true);
});

document.getElementById('btnDeleteProject').addEventListener('click', () => {
  const p = projects[activeProjectId];
  if (Object.keys(projects).length <= 1) {
    alert('This is your only project — create another one before deleting this one.');
    return;
  }
  if (!confirm('Delete project "' + p.name + '"? This cannot be undone.')) return;
  delete projects[activeProjectId];
  scheduleSave();
  const remaining = Object.keys(projects);
  activeProjectId = remaining[0];
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
  activeModule = projects[activeProjectId].activeModule || 'snowASCE';
  if (!MODULE_BY_KEY[activeModule]) activeModule = 'snowASCE';
  localStorage.setItem(LS_ACTIVE_TAB, activeModule);
  renderProjectSelect();
  renderSidebar();
  renderContent(true);
  setStatus('Project deleted.', true);
});

/* ---- Export / Import ----------------------------------------------------------- */
document.getElementById('btnExportProject').addEventListener('click', () => {
  const p = projects[activeProjectId];
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (p.name || 'project').replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'project';
  a.href = url;
  a.download = 'structcalc-' + safeName + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('Exported "' + p.name + '" to ' + a.download, true);
});

document.getElementById('btnImportProject').addEventListener('click', () => {
  elImportFile.value = '';
  elImportFile.click();
});

elImportFile.addEventListener('change', () => {
  const file = elImportFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.modules) {
        throw new Error('File does not look like a StructCalc project.');
      }
      const p = {
        id: makeId(),
        name: (data.name || file.name.replace(/\.json$/i, '')) + ' (imported)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        activeModule: MODULE_BY_KEY[data.activeModule] ? data.activeModule : 'snowASCE',
        modules: data.modules || {}
      };
      projects[p.id] = p;
      scheduleSave();
      switchProject(p.id);
      renderProjectSelect();
      setStatus('Imported "' + p.name + '".', true);
    } catch (err) {
      alert('Could not import this file: ' + err.message);
    }
  };
  reader.readAsText(file);
});

/* ---- Sidebar project tree ---------------------------------------------------------- */
// Grouped by design code/norm first (ASCE 7-22, then NBCC 2015), with each
// group's modules listed underneath — replaces the old top tab strip.
function renderSidebar() {
  elSidebar.innerHTML = '';
  GROUP_ORDER.forEach(group => {
    const groupMods = MODULES.filter(m => m.group === group);
    if (!groupMods.length) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'tree-group';

    const header = document.createElement('div');
    header.className = 'tree-group-header';
    header.textContent = group;
    groupEl.appendChild(header);

    groupMods.forEach(m => {
      const item = document.createElement('div');
      item.className = 'tree-item' + (m.key === activeModule ? ' active' : '') + (m.status === 'planned' ? ' planned' : '');
      item.dataset.key = m.key;

      const label = document.createElement('span');
      label.textContent = m.title;
      item.appendChild(label);

      if (m.status === 'planned') {
        const badge = document.createElement('span');
        badge.className = 'tree-badge';
        badge.textContent = 'planned';
        item.appendChild(badge);
      }

      item.addEventListener('click', () => switchModule(m.key));
      groupEl.appendChild(item);
    });

    elSidebar.appendChild(groupEl);
  });
}

function switchModule(key) {
  if (key === activeModule) return;
  activeModule = key;
  projects[activeProjectId].activeModule = key;
  localStorage.setItem(LS_ACTIVE_TAB, key);
  scheduleSave();
  renderSidebar();
  renderContent(false);
}

/* ---- Content (iframe / placeholder) ------------------------------------------------ */
function plannedHtml(mod) {
  const items = mod.roadmap.points.map(pt => '<li>' + pt + '</li>').join('');
  return '<h2>' + mod.title + ' — ' + mod.badge + '</h2>' +
    '<p>' + mod.roadmap.summary + '</p>' +
    '<ul>' + items + '</ul>' +
    '<div class="roadmap-note">This module is on the roadmap and not built yet. ' +
    'Your other modules and project data are unaffected — pick another module from the sidebar to use them.</div>';
}

function renderContent(forceReload) {
  const mod = MODULE_BY_KEY[activeModule];

  if (mod.status !== 'ready') {
    elFrame.style.display = 'none';
    elPlaceholder.style.display = 'block';
    elPlaceholder.innerHTML = plannedHtml(mod);
    return;
  }

  elPlaceholder.style.display = 'none';
  elFrame.style.display = 'block';

  const targetSrc = encodeURI(mod.path);
  const samePathLoaded = elFrame.dataset.loadedPath === targetSrc;

  if (!samePathLoaded || forceReload) {
    elFrame.dataset.loadedPath = targetSrc;
    elFrame.dataset.pendingModule = mod.key;
    // Force a real reload (even if src string is unchanged) so the module
    // re-initializes with fresh defaults before we push the saved state.
    elFrame.src = 'about:blank';
    setTimeout(() => { elFrame.src = targetSrc; }, 0);
  } else {
    pushStateToFrame();
  }
}

function pushStateToFrame() {
  const mod = MODULE_BY_KEY[activeModule];
  if (mod.status !== 'ready' || !elFrame.contentWindow) return;
  const proj = projects[activeProjectId];
  const saved = proj.modules[mod.key];
  if (saved) {
    elFrame.contentWindow.postMessage({
      type: 'loadState',
      state: saved.state,
      unitSystem: saved.unitSystem
    }, '*');
  } else if (proj.settings && proj.settings.units) {
    // No saved state yet for this module — at least apply the unit system
    // chosen for this project in the New Project dialog.
    elFrame.contentWindow.postMessage({
      type: 'loadState',
      unitSystem: proj.settings.units
    }, '*');
  }
}

elFrame.addEventListener('load', () => {
  if (elFrame.src === 'about:blank' || !elFrame.src) return;
  // give the module's own DOMContentLoaded/init a tick to finish, then push saved state (if any)
  setTimeout(pushStateToFrame, 50);
});

/* ---- Receive state updates from the active module's iframe ----------------------------- */
window.addEventListener('message', e => {
  const msg = e.data;
  if (!msg || msg.type !== 'stateChanged' || !msg.module) return;
  if (!MODULE_BY_KEY[msg.module]) return;

  const proj = projects[activeProjectId];
  if (!proj) return;
  if (!proj.modules) proj.modules = {};

  proj.modules[msg.module] = {
    state: msg.state,
    unitSystem: msg.unitSystem
  };
  proj.updatedAt = Date.now();
  scheduleSave();
});

/* ---- Init ------------------------------------------------------------------------------ */
renderProjectSelect();
renderSidebar();
renderContent(true);
setStatus('Ready.', true);
