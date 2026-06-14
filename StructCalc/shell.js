/* =====================================================================
   StructCalc — App Shell
   - Sidebar lists CALCULATION TYPES (Snow, Wind, Seismic, ...) for the
     active project, grouped by TYPE — not by design code/standard.
   - The Code / Units selectors in the top bar are a GLOBAL SWITCH for the
     active project: picking "Snow" in the sidebar while the top selector
     is set to NBCC 2015 runs the NBCC snow-drift engine; switching the top
     selector to ASCE 7-22 makes the same "Snow" entry run the ASCE engine,
     for the same project. Each calculation keeps its own saved state per
     code, so switching back and forth does not lose data.
   - Project manager: create / duplicate / rename / delete / switch
     projects, each holding its own list of calculations. Stored in
     localStorage (this browser, this computer) plus Export/Import to
     .json for backup and moving between computers.
   - Sync protocol with the module iframe (see bridge code appended to
     each module's engine.js):
       shell -> module : {type:'loadState', state:{...}, unitSystem?:'SI'|'US'}
       shell -> module : {type:'requestState'}
       module -> shell : {type:'stateChanged', module:<key>, state:{...}, unitSystem?:'SI'|'US'}
   ===================================================================== */

const LS_PROJECTS = 'structcalc.projects.v1';
const LS_ACTIVE_PROJECT = 'structcalc.activeProjectId.v1';

/* ---- Design codes ------------------------------------------------------- */
const CODES = ['ASCE 7-22', 'NBCC 2015'];
const CODE_LABELS = {
  'ASCE 7-22': 'ASCE 7-22 (USA)',
  'NBCC 2015': 'NBCC 2015 (Canada)'
};
const DEFAULT_UNITS_BY_CODE = { 'ASCE 7-22': 'US', 'NBCC 2015': 'SI' };

/* ---- Calculation-type registry -------------------------------------------
   Each entry is one TYPE shown in the sidebar (Snow, Wind, Seismic, ...).
   `variants` holds the per-code engine: 'ready' -> loaded into the shared
   iframe from `path`; 'planned' -> roadmap placeholder shown instead. */
const MODULE_TYPES = [
  {
    type: 'snow',
    title: 'Snow Loads',
    variants: {
      'ASCE 7-22': {
        status: 'ready',
        path: '../ASCE 7-22 Snow Load Calculator/index.html',
        label: 'ASCE/SEI 7-22, Chapter 7'
      },
      'NBCC 2015': {
        status: 'ready',
        path: '../NBCC 2015 Snow Drift Calculator/index.html',
        label: 'NBCC 2015, Sentence 4.1.6'
      }
    }
  },
  {
    type: 'wind',
    title: 'Wind Loads',
    variants: {
      'ASCE 7-22': {
        status: 'ready',
        path: '../ASCE 7-22 Wind Load Calculator/index.html',
        label: 'ASCE/SEI 7-22, Chapters 26, 28 & 30 (Envelope Procedure)'
      },
      'NBCC 2015': {
        status: 'planned',
        path: '../NBCC 2015 Wind Load Calculator/index.html',
        label: 'NBCC 2015, Sentence 4.1.7',
        roadmap: {
          summary: 'External wind pressures p = Iw * q * Ce * Cg * Cp per NBC 2015 Sentence 4.1.7.1.',
          points: [
            'Reference velocity pressure q from the 1-in-50 design wind speed (Appendix C, by location).',
            'Importance factor Iw (Table 4.1.7.1, by Importance Category and ULS/SLS).',
            'Exposure factor Ce (Sentence 4.1.7.4 — open / rough terrain profiles).',
            'Gust effect factor Cg (Sentence 4.1.7.1.(5) and Commentary I).',
            'External pressure coefficients Cp for walls and roofs (Commentary I figures, by building geometry).',
            'Internal pressure coefficients and combination with external pressures for net cladding/C&C loads.'
          ]
        }
      }
    }
  },
  {
    type: 'seismic',
    title: 'Seismic Loads',
    variants: {
      'ASCE 7-22': {
        status: 'planned',
        path: '../ASCE 7-22 Seismic Load Calculator/index.html',
        label: 'ASCE/SEI 7-22, Chapters 11-12',
        roadmap: {
          summary: 'Equivalent Lateral Force base shear and design parameters per ASCE 7-22 Ch. 11 & 12, building on the Site Class / Ss / S1 lookup already available in the Snow module.',
          points: [
            'Site coefficients Fa, Fv (Tables 11.4-1 / 11.4-2) applied to map values Ss, S1.',
            'Sms, Sm1, Sds, Sd1 (Sec. 11.4.3 / 11.4.4) and Seismic Design Category (Tables 11.6-1 / 11.6-2) — values already fetched via the USGS Design Maps API.',
            'Approximate fundamental period Ta (Sec. 12.8.2.1, Eq. 12.8-7/12.8-8) and seismic response coefficient Cs (Sec. 12.8.1.1, Eq. 12.8-2/12.8-3/12.8-4).',
            'Response modification coefficient R, overstrength Omega0 and deflection amplification Cd by Seismic Force-Resisting System (Table 12.2-1).',
            'Base shear V = Cs * W (Eq. 12.8-1) and vertical distribution Fx (Sec. 12.8.3).'
          ]
        }
      },
      'NBCC 2015': {
        status: 'planned',
        path: '../NBCC 2015 Seismic Load Calculator/index.html',
        label: 'NBCC 2015, Sentence 4.1.8',
        roadmap: {
          summary: 'Equivalent static base shear V per NBC 2015 Sentence 4.1.8.11, using design spectral acceleration values Sa(T).',
          points: [
            'Design spectral acceleration Sa(T) from Sa(0.2), Sa(0.5), Sa(1.0), Sa(2.0) (Appendix C site data) and site coefficients F(T) (Tables 4.1.8.4.B/C).',
            'IeFaSa(0.2) and IeFvSa(1.0), with Earthquake Importance Factor Ie (Table 4.1.8.5) and Site Class.',
            'Higher-mode factor Mv, ductility-related (Rd) and overstrength-related (Ro) force modification factors (Table 4.1.8.9).',
            'Fundamental period Ta (Sentence 4.1.8.11.(3)) and base shear V = S(Ta)*Mv*Ie*W / (Rd*Ro) (Sentence 4.1.8.11.(2)), with the 4.1.8.11.(2) upper/lower bounds.',
            'Vertical force distribution Fx and torsional considerations per Sentence 4.1.8.11.(6)-(8).'
          ]
        }
      }
    }
  }
];

const MODULE_TYPES_BY_KEY = Object.fromEntries(MODULE_TYPES.map(m => [m.type, m]));

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

function makeId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function newCalculation(type, description) {
  const typeDef = MODULE_TYPES_BY_KEY[type] || MODULE_TYPES[0];
  return {
    id: makeId('c'),
    type: typeDef.type,
    title: typeDef.title,
    description: (description || '').trim(),
    state: {}
  };
}

function newProject(name, settings) {
  settings = settings || { code: 'ASCE 7-22', units: DEFAULT_UNITS_BY_CODE['ASCE 7-22'] };
  const firstCalc = newCalculation('snow', '');
  return {
    id: makeId('p'),
    name: name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: settings,
    calculations: [firstCalc],
    activeCalcId: firstCalc.id,
    sidebarCollapsed: false
  };
}

/* ---- Migrate old (code-grouped, single-module) project records ---------- */
// Old shape: { settings, activeModule, modules: { snowASCE: {state,unitSystem}, snowDriftNBCC: {...} } }
// New shape: { settings, activeCalcId, calculations: [ {id,type,title,description,state:{<code>:{state,unitSystem}}} ] }
function migrateProject(p) {
  if (!p.settings) p.settings = { code: 'ASCE 7-22', units: 'US' };
  if (typeof p.sidebarCollapsed !== 'boolean') p.sidebarCollapsed = false;

  if (Array.isArray(p.calculations) && p.calculations.length) {
    if (!p.activeCalcId || !p.calculations.some(c => c.id === p.activeCalcId)) {
      p.activeCalcId = p.calculations[0].id;
    }
    return p;
  }

  const legacy = p.modules || {};
  const snowCalc = newCalculation('snow', '');
  if (legacy.snowASCE) {
    snowCalc.state['ASCE 7-22'] = { state: legacy.snowASCE.state, unitSystem: legacy.snowASCE.unitSystem };
  }
  if (legacy.snowDriftNBCC) {
    snowCalc.state['NBCC 2015'] = { state: legacy.snowDriftNBCC.state, unitSystem: legacy.snowDriftNBCC.unitSystem };
  }

  p.calculations = [snowCalc];
  p.activeCalcId = snowCalc.id;
  delete p.modules;
  delete p.activeModule;
  return p;
}

/* ---- DOM refs ------------------------------------------------------------ */
const elProjectSelect = document.getElementById('projectSelect');
const elCodeSelect = document.getElementById('codeSelect');
const elUnitsSelect = document.getElementById('unitsSelect');
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

/* ---- Add Calculation dialog ------------------------------------------------ */
const elAddCalcModal = document.getElementById('addCalcModal');
const elCalcTypeGrid = document.getElementById('calcTypeGrid');
const elAcDescription = document.getElementById('acDescription');
const elAcAdd = document.getElementById('acAdd');
const elAddCalcClose = document.getElementById('addCalcClose');
let selectedNewType = null;

/* ---- State -------------------------------------------------------------- */
let projects = loadProjects();
Object.values(projects).forEach(migrateProject);

let activeProjectId = localStorage.getItem(LS_ACTIVE_PROJECT);

if (!activeProjectId || !projects[activeProjectId]) {
  const p = newProject('Project 1');
  projects[p.id] = p;
  activeProjectId = p.id;
  saveProjectsNow();
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
}

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
  renderProjectSelect();
  renderCodeUnitsSelect();
  renderSidebar();
  renderContent(true);
  setStatus('Switched to project "' + projects[activeProjectId].name + '".', true);
}

/* ---- Code / Units global switch -------------------------------------------- */
// Acts on the active project: choosing "Snow" (etc.) in the sidebar always
// runs the engine for whichever code is selected here.
function renderCodeUnitsSelect() {
  const proj = projects[activeProjectId];
  elCodeSelect.value = proj.settings.code;
  elUnitsSelect.value = proj.settings.units || DEFAULT_UNITS_BY_CODE[proj.settings.code] || 'US';
}

elCodeSelect.addEventListener('change', () => {
  const proj = projects[activeProjectId];
  proj.settings.code = elCodeSelect.value;
  if (!proj.settings.units) proj.settings.units = DEFAULT_UNITS_BY_CODE[proj.settings.code];
  proj.updatedAt = Date.now();
  scheduleSave();
  renderSidebar();
  renderContent(true);
});

elUnitsSelect.addEventListener('change', () => {
  const proj = projects[activeProjectId];
  proj.settings.units = elUnitsSelect.value;
  proj.updatedAt = Date.now();
  scheduleSave();
  renderContent(true);
});

/* ---- Project CRUD buttons --------------------------------------------------- */
document.getElementById('btnNewProject').addEventListener('click', () => {
  openNewProjectModal();
});

/* ---- New Project dialog: pick design code + unit system upfront ------------- */
function openNewProjectModal() {
  elNpName.value = 'Project ' + (Object.keys(projects).length + 1);
  elNpCode.value = 'ASCE 7-22';
  elNpUnits.value = DEFAULT_UNITS_BY_CODE['ASCE 7-22'];
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

elNpCode.addEventListener('change', () => {
  elNpUnits.value = DEFAULT_UNITS_BY_CODE[elNpCode.value] || 'US';
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
  copy.id = makeId('p');
  copy.name = src.name + ' (copy)';
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.calculations.forEach(c => { c.id = makeId('c'); });
  // keep activeCalcId pointing at the corresponding (now re-id'd) calculation
  const srcIdx = src.calculations.findIndex(c => c.id === src.activeCalcId);
  copy.activeCalcId = srcIdx >= 0 ? copy.calculations[srcIdx].id : copy.calculations[0].id;
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
  renderSidebar();
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
  renderProjectSelect();
  renderCodeUnitsSelect();
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
      if (!data || typeof data !== 'object' || (!data.modules && !data.calculations)) {
        throw new Error('File does not look like a StructCalc project.');
      }
      const p = {
        id: makeId('p'),
        name: (data.name || file.name.replace(/\.json$/i, '')) + ' (imported)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings: data.settings || { code: 'ASCE 7-22', units: 'US' },
        calculations: data.calculations,
        activeCalcId: data.activeCalcId,
        modules: data.modules,
        sidebarCollapsed: !!data.sidebarCollapsed
      };
      migrateProject(p);
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

/* ---- Sidebar: active project's calculations, grouped by TYPE -------------------- */
function activeCalc() {
  const proj = projects[activeProjectId];
  if (!proj) return null;
  return (proj.calculations || []).find(c => c.id === proj.activeCalcId) || null;
}

function renderSidebar() {
  elSidebar.innerHTML = '';
  const proj = projects[activeProjectId];
  if (!proj) return;

  const groupEl = document.createElement('div');
  groupEl.className = 'tree-group';

  const header = document.createElement('div');
  header.className = 'tree-group-header';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'tree-group-name';
  nameSpan.textContent = proj.name;
  header.appendChild(nameSpan);

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'tree-collapse-btn';
  collapseBtn.textContent = proj.sidebarCollapsed ? '▸' : '▾';
  collapseBtn.title = proj.sidebarCollapsed ? 'Expand calculations' : 'Collapse calculations';
  collapseBtn.addEventListener('click', () => {
    proj.sidebarCollapsed = !proj.sidebarCollapsed;
    proj.updatedAt = Date.now();
    scheduleSave();
    renderSidebar();
  });
  header.appendChild(collapseBtn);

  groupEl.appendChild(header);

  if (!proj.sidebarCollapsed) {
    const list = document.createElement('div');
    list.className = 'tree-calc-list';

    (proj.calculations || []).forEach(calc => {
      const typeDef = MODULE_TYPES_BY_KEY[calc.type];
      const variant = typeDef ? typeDef.variants[proj.settings.code] : null;
      const isPlanned = !variant || variant.status !== 'ready';

      const item = document.createElement('div');
      item.className = 'tree-item' + (calc.id === proj.activeCalcId ? ' active' : '') + (isPlanned ? ' planned' : '');
      item.dataset.calcId = calc.id;

      const main = document.createElement('div');
      main.className = 'tree-item-main';

      const title = document.createElement('span');
      title.className = 'tree-item-title';
      title.textContent = calc.title || (typeDef ? typeDef.title : calc.type);
      main.appendChild(title);

      const desc = document.createElement('span');
      desc.className = 'tree-item-desc';
      desc.textContent = calc.description || '';
      main.appendChild(desc);

      item.appendChild(main);

      if (isPlanned) {
        const badge = document.createElement('span');
        badge.className = 'tree-badge';
        badge.textContent = 'planned';
        item.appendChild(badge);
      }

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tree-item-remove';
      removeBtn.title = 'Remove this calculation from the project';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCalculation(calc.id);
      });
      item.appendChild(removeBtn);

      item.addEventListener('click', () => switchCalculation(calc.id));
      item.title = 'Double-click to add/edit a short description (e.g. "left canopy grid A")';
      item.addEventListener('dblclick', () => editCalcDescription(calc.id));

      list.appendChild(item);
    });

    const addItem = document.createElement('div');
    addItem.className = 'tree-item tree-add';
    addItem.textContent = '+ Add calculation';
    addItem.addEventListener('click', openAddCalcModal);
    list.appendChild(addItem);

    groupEl.appendChild(list);
  }

  elSidebar.appendChild(groupEl);
}

function switchCalculation(calcId) {
  const proj = projects[activeProjectId];
  if (proj.activeCalcId === calcId) return;
  proj.activeCalcId = calcId;
  proj.updatedAt = Date.now();
  scheduleSave();
  renderSidebar();
  renderContent(true);
}

function editCalcDescription(calcId) {
  const proj = projects[activeProjectId];
  const calc = (proj.calculations || []).find(c => c.id === calcId);
  if (!calc) return;
  const desc = prompt('Short description for this calculation (e.g. "left canopy grid A"):', calc.description || '');
  if (desc === null) return;
  calc.description = desc.trim();
  proj.updatedAt = Date.now();
  scheduleSave();
  renderSidebar();
}

function removeCalculation(calcId) {
  const proj = projects[activeProjectId];
  const list = proj.calculations || [];
  if (list.length <= 1) {
    alert('A project needs at least one calculation — add another before removing this one.');
    return;
  }
  const calc = list.find(c => c.id === calcId);
  if (!calc) return;
  const label = calc.title + (calc.description ? ' — ' + calc.description : '');
  if (!confirm('Remove "' + label + '" from this project?')) return;
  proj.calculations = list.filter(c => c.id !== calcId);
  if (proj.activeCalcId === calcId) {
    proj.activeCalcId = proj.calculations[0].id;
  }
  proj.updatedAt = Date.now();
  scheduleSave();
  renderSidebar();
  renderContent(true);
}

/* ---- Add Calculation dialog: pick a module type for the active project ----------- */
function openAddCalcModal() {
  selectedNewType = null;
  elAcDescription.value = '';
  elAcAdd.disabled = true;
  renderCalcTypeGrid();
  elAddCalcModal.classList.add('open');
}

function closeAddCalcModal() {
  elAddCalcModal.classList.remove('open');
}

elAddCalcClose.addEventListener('click', closeAddCalcModal);
elAddCalcModal.addEventListener('click', (e) => {
  if (e.target === elAddCalcModal) closeAddCalcModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && elAddCalcModal.classList.contains('open')) closeAddCalcModal();
});

function renderCalcTypeGrid() {
  const proj = projects[activeProjectId];
  elCalcTypeGrid.innerHTML = '';
  MODULE_TYPES.forEach(typeDef => {
    const variant = typeDef.variants[proj.settings.code];
    const ready = variant && variant.status === 'ready';

    const card = document.createElement('div');
    card.className = 'calc-type-card' + (typeDef.type === selectedNewType ? ' selected' : '');
    card.dataset.type = typeDef.type;

    const title = document.createElement('div');
    title.className = 'calc-type-title';
    title.textContent = typeDef.title;
    card.appendChild(title);

    const status = document.createElement('div');
    status.className = 'calc-type-status';
    status.textContent = (ready ? 'Ready — ' : 'Planned — ') + CODE_LABELS[proj.settings.code];
    card.appendChild(status);

    card.addEventListener('click', () => {
      selectedNewType = typeDef.type;
      elAcAdd.disabled = false;
      renderCalcTypeGrid();
    });

    elCalcTypeGrid.appendChild(card);
  });
}

elAcAdd.addEventListener('click', () => {
  if (!selectedNewType) return;
  const proj = projects[activeProjectId];
  const calc = newCalculation(selectedNewType, elAcDescription.value);
  proj.calculations = proj.calculations || [];
  proj.calculations.push(calc);
  proj.activeCalcId = calc.id;
  proj.updatedAt = Date.now();
  scheduleSave();
  closeAddCalcModal();
  renderSidebar();
  renderContent(true);
});

/* ---- Content (iframe / placeholder) ------------------------------------------------ */
function plannedHtml(typeDef, variant, code) {
  if (!variant) {
    return '<h2>' + typeDef.title + '</h2>' +
      '<p>Not defined for ' + CODE_LABELS[code] + ' yet.</p>';
  }
  const items = (variant.roadmap.points || []).map(pt => '<li>' + pt + '</li>').join('');
  return '<h2>' + typeDef.title + ' — ' + CODE_LABELS[code] + '</h2>' +
    '<p>' + variant.roadmap.summary + '</p>' +
    '<ul>' + items + '</ul>' +
    '<div class="roadmap-note">This calculation is on the roadmap and not built yet for ' + CODE_LABELS[code] + '. ' +
    'Switch the design code above, or pick a ready calculation from the sidebar. Your other calculations and project data are unaffected.</div>';
}

function emptyHtml() {
  return '<h2>No calculations in this project yet</h2>' +
    '<p>Click "+ Add calculation" in the sidebar to choose Snow, Wind, Seismic, etc.</p>';
}

function renderContent(forceReload) {
  const proj = projects[activeProjectId];
  const calc = activeCalc();

  if (!calc) {
    elFrame.style.display = 'none';
    elPlaceholder.style.display = 'block';
    elPlaceholder.innerHTML = emptyHtml();
    return;
  }

  const typeDef = MODULE_TYPES_BY_KEY[calc.type];
  const code = proj.settings.code;
  const variant = typeDef ? typeDef.variants[code] : null;

  if (!variant || variant.status !== 'ready') {
    elFrame.style.display = 'none';
    elPlaceholder.style.display = 'block';
    elPlaceholder.innerHTML = plannedHtml(typeDef, variant, code);
    return;
  }

  elPlaceholder.style.display = 'none';
  elFrame.style.display = 'block';

  const targetSrc = encodeURI(variant.path);
  const loadKey = calc.id + '|' + code;
  const sameLoaded = elFrame.dataset.loadedKey === loadKey;

  if (!sameLoaded || forceReload) {
    elFrame.dataset.loadedKey = loadKey;
    // Force a real reload (even if src string is unchanged) so the module
    // re-initializes with fresh defaults before we push the saved state.
    elFrame.src = 'about:blank';
    setTimeout(() => { elFrame.src = targetSrc; }, 0);
  } else {
    pushStateToFrame();
  }
}

function pushStateToFrame() {
  const proj = projects[activeProjectId];
  const calc = activeCalc();
  if (!calc || !elFrame.contentWindow) return;

  const typeDef = MODULE_TYPES_BY_KEY[calc.type];
  const code = proj.settings.code;
  const variant = typeDef ? typeDef.variants[code] : null;
  if (!variant || variant.status !== 'ready') return;

  const saved = calc.state && calc.state[code];
  if (saved) {
    elFrame.contentWindow.postMessage({
      type: 'loadState',
      state: saved.state,
      unitSystem: saved.unitSystem
    }, '*');
  } else if (proj.settings && proj.settings.units) {
    // No saved state yet for this calculation under this code — at least
    // apply the unit system chosen for this project.
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
  if (!msg || msg.type !== 'stateChanged') return;

  const proj = projects[activeProjectId];
  const calc = activeCalc();
  if (!proj || !calc) return;

  if (!calc.state) calc.state = {};
  calc.state[proj.settings.code] = {
    state: msg.state,
    unitSystem: msg.unitSystem
  };
  proj.updatedAt = Date.now();
  scheduleSave();
});

/* ---- Init ------------------------------------------------------------------------------ */
renderProjectSelect();
renderCodeUnitsSelect();
renderSidebar();
renderContent(true);
setStatus('Ready.', true);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        