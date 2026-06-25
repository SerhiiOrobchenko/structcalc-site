/* =====================================================================
   StructCalc — dashboard.js
   Responsibility: dashboard screen render, project cards, new-project
                   modal, project context menu, import/export.
   Depends on: projects.js (loaded first)
   Rule: edit only for dashboard UI changes.
   ===================================================================== */

function goDashboard() {
  elWorkspace.classList.add('hidden');
  elDashboard.classList.remove('hidden');
  renderDashboard();
}

function renderDashboard() {
  var all  = Object.values(projects);
  var sort = (document.getElementById('dbSort') && document.getElementById('dbSort').value) || 'modified';
  var q    = ((document.getElementById('dbSearch') && document.getElementById('dbSearch').value) || '').toLowerCase();

  var sorted = all.filter(function(p) {
    return !q || p.name.toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q);
  });
  if (sort === 'name')        sorted.sort(function(a,b){ return a.name.localeCompare(b.name); });
  else if (sort === 'created') sorted.sort(function(a,b){ return b.createdAt - a.createdAt; });
  else                         sorted.sort(function(a,b){ return b.updatedAt  - a.updatedAt; });

  var count     = all.length;
  var codeCount = new Set(all.map(function(p){ return p.settings && p.settings.code; })).size;
  if (elDbSubtitle) elDbSubtitle.textContent = count + ' project' + (count!==1?'s':'') + ' · ' + codeCount + ' design code' + (codeCount!==1?'s':'');
  if (elRailAll)    elRailAll.textContent = count;

  elProjGrid.innerHTML = '';

  sorted.forEach(function(proj) {
    elProjGrid.appendChild(buildProjectCard(proj));
  });

  // New project card
  var nc = document.createElement('div');
  nc.className = 'proj-card proj-card-new';
  nc.innerHTML = '<div class="plus-circle"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></div><div class="proj-card-new-label">New Project</div>';
  nc.addEventListener('click', openNewProjectModal);
  elProjGrid.appendChild(nc);
}

function buildProjectCard(proj) {
  var code  = (proj.settings && proj.settings.code) || 'ASCE 7-22';
  var isNBCC= code === 'NBCC 2015';
  var calcs = proj.calculations || [];
  var ago   = timeAgo(proj.updatedAt || proj.createdAt);

  var card = document.createElement('div');
  card.className = 'proj-card';
  card.innerHTML =
    '<div class="proj-card-strip' + (isNBCC?' nbcc':'') + '"></div>' +
    '<div class="proj-card-body">' +
      '<div class="proj-card-top">' +
        '<div class="proj-card-icon"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V9l9-6 9 6v12H3z"/><path d="M9 21V12h6v9"/></svg></div>' +
        '<button class="proj-card-menu" data-pid="' + proj.id + '"><svg class="ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg></button>' +
      '</div>' +
      '<h3>' + escHtml(proj.name) + '</h3>' +
      '<p class="proj-addr">' + escHtml(proj.address || '—') + '</p>' +
      '<div class="proj-card-meta">' +
        '<span class="chip ' + (isNBCC?'nbcc':'asce') + '">' + escHtml(code) + '</span>' +
        calcs.slice(0,2).map(function(c){ return '<span class="chip">' + escHtml((MODULE_MAP[c.type] && MODULE_MAP[c.type].title) || c.title || c.type) + '</span>'; }).join('') +
      '</div>' +
    '</div>' +
    '<div class="proj-card-foot"><span>' + ago + '</span><span>' + calcs.length + ' calc' + (calcs.length!==1?'s':'') + '</span></div>';

  card.addEventListener('click', function(e) {
    if (e.target.closest('.proj-card-menu')) return;
    goWorkspace(proj.id, null);
  });
  card.querySelector('.proj-card-menu').addEventListener('click', function(e) {
    e.stopPropagation();
    showProjCtxMenu(e, proj.id);
  });
  return card;
}

function showProjCtxMenu(e, projId) {
  var menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;z-index:1200;background:#fff;border:1px solid #dde3ec;border-radius:8px;box-shadow:0 8px 32px rgba(15,22,38,.22);min-width:160px;padding:5px 0;font-size:.84rem;font-family:inherit;';
  var r = e.currentTarget.getBoundingClientRect();
  menu.style.left = (r.right + 4) + 'px';
  menu.style.top  = r.top + 'px';

  var items = [
    { label:'Open',         action: function(){ goWorkspace(projId, null); } },
    { label:'Rename',       action: function(){
        var p = projects[projId]; if (!p) return;
        var n = prompt('Rename project:', p.name);
        if (n && n.trim()) { p.name = n.trim(); p.updatedAt = Date.now(); scheduleSave(); renderDashboard(); }
    }},
    { sep: true },
    { label:'Export .json', action: function(){ exportProject(projId); } },
    { sep: true },
    { label:'Delete', danger:true, action: function(){
        if (!confirm('Delete "' + (projects[projId] && projects[projId].name) + '"? This cannot be undone.')) return;
        delete projects[projId];
        if (activeProjectId === projId) {
          activeProjectId = Object.keys(projects)[0] || null;
          localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId || '');
          if (!activeProjectId) { var p2 = newProject('My First Project'); projects[p2.id] = p2; activeProjectId = p2.id; }
        }
        scheduleSave(); renderDashboard();
    }}
  ];

  items.forEach(function(it) {
    if (it.sep) { var s = document.createElement('div'); s.style.cssText='height:1px;background:#e7ebf2;margin:4px 0;'; menu.appendChild(s); return; }
    var el2 = document.createElement('div');
    el2.style.cssText = 'display:flex;align-items:center;padding:8px 14px;cursor:pointer;color:' + (it.danger?'#ef4444':'#323d4d') + ';font-weight:500;';
    el2.textContent = it.label;
    el2.addEventListener('mouseover', function(){ el2.style.background = it.danger?'#fff5f5':'#eef1f7'; });
    el2.addEventListener('mouseout',  function(){ el2.style.background = ''; });
    el2.addEventListener('click', function(){ document.body.removeChild(menu); it.action(); });
    menu.appendChild(el2);
  });

  document.body.appendChild(menu);
  setTimeout(function() {
    document.addEventListener('click', function close(){
      document.body.contains(menu) && document.body.removeChild(menu);
      document.removeEventListener('click', close);
    }, { once: true });
  }, 0);
}

/* ── New Project Modal ───────────────────────────────────────────────── */
var elNewProjModal = document.getElementById('newProjectModal');
var elNpCode       = document.getElementById('npCode');
var elNpUnits      = document.getElementById('npUnits');

elNpCode.addEventListener('change', function() {
  elNpUnits.value = DEFAULT_UNITS[elNpCode.value] || 'US';
});

function openNewProjectModal() {
  document.getElementById('npName').value    = '';
  document.getElementById('npAddress').value = '';
  elNpCode.value  = 'ASCE 7-22';
  elNpUnits.value = 'US';
  elNewProjModal.classList.add('open');
  setTimeout(function(){ document.getElementById('npName').focus(); }, 50);
}

document.getElementById('npCreate').addEventListener('click', function() {
  var name = document.getElementById('npName').value.trim();
  if (!name) { document.getElementById('npName').focus(); return; }
  var proj = newProject(name, { code: elNpCode.value, units: elNpUnits.value });
  proj.address = document.getElementById('npAddress').value.trim();
  projects[proj.id] = proj;
  activeProjectId = proj.id;
  localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
  scheduleSave();
  elNewProjModal.classList.remove('open');
  goWorkspace(proj.id, null);
});
document.getElementById('newProjectClose').addEventListener('click',  function(){ elNewProjModal.classList.remove('open'); });
document.getElementById('newProjectCancel').addEventListener('click', function(){ elNewProjModal.classList.remove('open'); });
document.getElementById('btnNewProject').addEventListener('click', openNewProjectModal);

/* ── Export / Import ─────────────────────────────────────────────────── */
function exportProject(projId) {
  var proj = projects[projId];
  if (!proj) return;
  var blob = new Blob([JSON.stringify(proj, null, 2)], { type:'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (proj.name || 'project').replace(/[^a-z0-9_-]/gi,'_') + '.json';
  a.click();
}

document.getElementById('importFile').addEventListener('change', function() {
  var f = this.files[0]; if (!f) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.id || !data.name) { alert('Invalid project file.'); return; }
      data.id = makeId('p');
      data.updatedAt = Date.now();
      projects[data.id] = data;
      activeProjectId = data.id;
      localStorage.setItem(LS_ACTIVE_PROJECT, activeProjectId);
      scheduleSave();
      goWorkspace(data.id, null);
    } catch(err) { alert('Could not read project file.'); }
  };
  reader.readAsText(f);
  this.value = '';
});

/* ── Dashboard event wiring ──────────────────────────────────────────── */
document.getElementById('dbSearch').addEventListener('input',  function(){ renderDashboard(); });
document.getElementById('dbSort').addEventListener('change',   function(){ renderDashboard(); });
document.getElementById('btnExport').addEventListener('click', function(){ exportProject(activeProjectId); });
document.getElementById('dbRail').addEventListener('click', function(e) {
  var item = e.target.closest('[data-filter]');
  if (!item) return;
  document.querySelectorAll('.rail-item').forEach(function(r){ r.classList.remove('active'); });
  item.classList.add('active');
});
