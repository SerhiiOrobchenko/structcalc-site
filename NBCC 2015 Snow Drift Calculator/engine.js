/* ============================================================================
   StructCalc — Snow Drift Load at a Roof Step (NBCC 2015, Article 4.1.6.5)
   ----------------------------------------------------------------------------
   Formula sources are cited inline. See the "Sources, Assumptions & Roadmap"
   section at the bottom of the page for full references to the NBC 2015
   Structural Commentaries, Commentary G.
   ============================================================================ */

// ---- Unit conversion factors -------------------------------------------------
const PA_PER_KPA_TO_PSF = 20.8854;   // 1 kPa = 20.8854 psf
const M_TO_FT = 3.28084;             // 1 m = 3.28084 ft
const KNM3_TO_PCF = 6.36589;         // 1 kN/m3 = 6.36589 lb/ft3 (display only)

let unitSystem = 'US'; // 'SI' or 'US' — matches the active button on load

// ---- State (always stored in SI: kPa, m, kN/m3) -------------------------------
const state = {
  Ss: 2.4, Sr: 0.4, Is: 1.0, Cb: 0.8, Cw: 1.0, Cs: 1.0,
  h: 3.2,
  hpLower: 0.5, l0: 14,
  cases: [
    { id: 'I',   label: 'Case I — drift from an upper roof / projection',  ls: 13,  ws: 7.5, hp: 0.0, beta: 1.0,  enabled: true },
    { id: 'II',  label: 'Case II — drift across the lower roof itself',     ls: 14,  ws: 4.5, hp: 0.5, beta: 0.67, enabled: true },
    { id: 'III', label: 'Case III — corner / quartering-wind drift',        ls: 13,  ws: 6.5, hp: 0.5, beta: 0.67, enabled: true },
  ],
  // Snow drift at corners (NBC Art. 4.1.6.8) — each face is evaluated with the same
  // method as Section 2 (Sentence 4.1.6.5.(3), Eq.(2)&(3)), using the roof-step
  // height h above. Article 4.1.6.8 itself defines no new Ca0/xd formula — it only
  // governs how the two faces' drifts are combined/applied at the corner.
  corner: {
    enabled: false,
    type: 'outside', // 'outside' -> Sentence 4.1.6.8.(1) / Fig. 4.1.6.8.-A
                      // 'inside'  -> Sentence 4.1.6.8.(2) / Fig. 4.1.6.8.-B
    faceA: { ls: 13, ws: 7.5, hp: 0.0, beta: 1.0 },
    faceB: { ls: 14, ws: 4.5, hp: 0.5, beta: 0.67 },
  }
};

// ---- Calculation engine -------------------------------------------------------

function gammaOf(Ss) {
  // NBC Sentence 4.1.6.13.(1): gamma = min(0.43 Ss + 2.2, 4.0) kN/m3
  return Math.min(0.43 * Ss + 2.2, 4.0);
}

function caseCalc(c, h, Cb, Ss, g) {
  const lcs = 2 * c.ws - (c.ws * c.ws) / c.ls;                 // Step 2
  let hpRaw = c.hp - (Cb * Ss) / g;
  const hpPrime = Math.max(0, Math.min(hpRaw, lcs / 5));        // Step 3
  const F = 0.35 * c.beta * Math.sqrt((g * (lcs - 5 * hpPrime)) / Ss) + Cb; // Step 4
  const cand1 = (c.beta * g * h) / (Cb * Ss);                   // Eq.(2)
  const cand2 = F / Cb;                                          // Eq.(3)
  const Ca0 = Math.min(cand1, cand2);                            // Step 5
  return { ...c, lcs, hpRaw, hpPrime, F, cand1, cand2, Ca0 };
}

function parapetCheck(hpLower, l0, Cb, Ss, g) {
  const term1 = (0.67 * g * hpLower) / (Cb * Ss);
  const term2 = 1 + (g * l0) / (7.5 * Cb * Ss);
  return { term1, term2, Ca0: Math.min(term1, term2) };
}

function cornerCalc(st, g) {
  // NBC Article 4.1.6.8 — Snow Drift at Corners.
  // Each face's Ca0/xd is found exactly as in Section 2 (Sentence 4.1.6.5.(3), Eq.(2)&(3)),
  // using the roof-step height h. Sentences (1)/(2) then govern how the two faces combine.
  const { h, Cb, Cw, Cs, Ss, Sr, Is } = st;
  const A = caseCalc(st.corner.faceA, h, Cb, Ss, g);
  const B = caseCalc(st.corner.faceB, h, Cb, Ss, g);
  const xdOf = Ca0 => 5 * (Cb * Ss / g) * (Math.max(Ca0, 1) - 1);
  A.xd = xdOf(A.Ca0);
  B.xd = xdOf(B.Ca0);
  A.S0 = Is * (Ss * (Cb * Cw * Cs * A.Ca0) + Sr);
  B.S0 = Is * (Ss * (Cb * Cw * Cs * B.Ca0) + Sr);

  const type = st.corner.type;
  let governing = null;
  if (type === 'outside') {
    // Sentence 4.1.6.8.(1): may be taken as the LEAST SEVERE of the drift loads
    // against the two faces, extended radially around the corner (Fig. 4.1.6.8.-A).
    governing = (A.Ca0 <= B.Ca0) ? { ...A, face: 'A' } : { ...B, face: 'B' };
  }
  // Sentence 4.1.6.8.(2): for an inside corner, each face's drift is calculated
  // separately and applied as far as the bisector of the corner angle (Fig. 4.1.6.8.-B).
  // The Code gives no formula for the bisector distance — that is a plan-geometry
  // quantity the engineer must take off the roof plan.
  return { type, A, B, governing };
}

function compute() {
  const { Ss, Sr, Is, Cb, Cw, Cs, h } = state;
  const g = gammaOf(Ss);

  const enabledCases = state.cases.filter(c => c.enabled);
  const results = enabledCases.map(c => caseCalc(c, h, Cb, Ss, g));

  let Ca0 = 1.0, governing = null;
  if (results.length) {
    governing = results.reduce((a, b) => (b.Ca0 > a.Ca0 ? b : a));
    Ca0 = governing.Ca0;
  }
  Ca0 = Math.max(Ca0, 1.0);

  const xd = 5 * (Cb * Ss / g) * (Ca0 - 1);                      // Step 6
  const hPrime = h - (Cb * Cw * Ss) / g;                         // Step 7
  const x10 = 10 * hPrime;                                       // Step 8

  function Ca(x) {
    if (xd <= 0) return 1.0;
    if (x <= 0) return Ca0;
    if (x >= xd) return 1.0;
    return Ca0 - (Ca0 - 1) * (x / xd);                            // Step 9
  }
  function S(x) {
    return Is * (Ss * (Cb * Cw * Cs * Ca(x)) + Sr);               // Step 11 (Sentence 4.1.6.2.(1))
  }

  const parapet = parapetCheck(state.hpLower, state.l0, Cb, Ss, g);
  const corner = state.corner.enabled ? cornerCalc(state, g) : null;

  return { g, Ss, Sr, Is, Cb, Cw, Cs, h, results, Ca0, governing, xd, hPrime, x10, Ca, S, parapet, corner };
}

// ---- Unit helpers --------------------------------------------------------------
function fmtPressure(kPa, dp = 2) {
  if (unitSystem === 'SI') return kPa.toFixed(dp) + ' kPa';
  return (kPa * PA_PER_KPA_TO_PSF).toFixed(dp) + ' psf';
}
function fmtLength(m, dp = 2) {
  if (unitSystem === 'SI') return m.toFixed(dp) + ' m';
  return (m * M_TO_FT).toFixed(dp) + ' ft';
}
function toSIPressure(val) {
  return unitSystem === 'SI' ? val : val / PA_PER_KPA_TO_PSF;
}
function toSILength(val) {
  return unitSystem === 'SI' ? val : val / M_TO_FT;
}
function fromSIPressure(val) {
  return unitSystem === 'SI' ? val : val * PA_PER_KPA_TO_PSF;
}
function fromSILength(val) {
  return unitSystem === 'SI' ? val : val * M_TO_FT;
}
function lenUnitLabel() { return unitSystem === 'SI' ? 'm' : 'ft'; }
function pressUnitLabel() { return unitSystem === 'SI' ? 'kPa' : 'psf'; }

// ---- Rendering: case input blocks ----------------------------------------------
const caseDiagrams = {
  I: `<svg class="diagram" viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="120" height="60" fill="#eaf1f8" stroke="#1f4e79"/>
        <text x="70" y="45" font-size="11" text-anchor="middle" fill="#1f4e79">Upper roof /</text>
        <text x="70" y="58" font-size="11" text-anchor="middle" fill="#1f4e79">source area</text>
        <rect x="10" y="80" width="300" height="60" fill="#fdf6ee" stroke="#c0571f"/>
        <text x="250" y="115" font-size="11" text-anchor="middle" fill="#c0571f">Lower roof</text>
        <path d="M10 80 L40 80 L10 140 Z" fill="#c0571f" opacity="0.35"/>
        <text x="22" y="100" font-size="10" fill="#8a3c12">drift</text>
        <line x1="10" y1="4" x2="130" y2="4" stroke="#5b6b7c"/>
        <text x="70" y="2" font-size="10" text-anchor="middle" fill="#5b6b7c">l_s</text>
        <line x1="4" y1="10" x2="4" y2="70" stroke="#5b6b7c"/>
        <text x="-8" y="42" font-size="10" fill="#5b6b7c" transform="rotate(-90 4 42)">w_s</text>
        <line x1="70" y1="70" x2="40" y2="80" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrI)"/>
        <defs><marker id="arrI" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#1f4e79"/></marker></defs>
        <text x="270" y="20" font-size="10" fill="#5b6b7c">Wind blows snow from the</text>
        <text x="270" y="32" font-size="10" fill="#5b6b7c">upper roof into the step</text>
      </svg>`,
  II: `<svg class="diagram" viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="80" width="300" height="60" fill="#fdf6ee" stroke="#c0571f"/>
        <text x="250" y="115" font-size="11" text-anchor="middle" fill="#c0571f">Lower roof</text>
        <path d="M10 80 L40 80 L10 140 Z" fill="#c0571f" opacity="0.35"/>
        <text x="22" y="100" font-size="10" fill="#8a3c12">drift</text>
        <rect x="40" y="80" width="270" height="60" fill="none" stroke="#1f4e79" stroke-dasharray="4 3"/>
        <text x="175" y="100" font-size="11" text-anchor="middle" fill="#1f4e79">source area for snow</text>
        <text x="175" y="113" font-size="11" text-anchor="middle" fill="#1f4e79">in drift (on lower roof)</text>
        <line x1="40" y1="74" x2="310" y2="74" stroke="#5b6b7c"/>
        <text x="175" y="68" font-size="10" text-anchor="middle" fill="#5b6b7c">l_s</text>
        <line x1="34" y1="80" x2="34" y2="140" stroke="#5b6b7c"/>
        <text x="14" y="113" font-size="10" fill="#5b6b7c">w_s</text>
        <line x1="280" y1="110" x2="240" y2="110" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrII)"/>
        <defs><marker id="arrII" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#1f4e79"/></marker></defs>
        <text x="260" y="30" font-size="10" fill="#5b6b7c">Wind blows snow across the</text>
        <text x="260" y="42" font-size="10" fill="#5b6b7c">lower roof into the step</text>
      </svg>`,
  III: `<svg class="diagram" viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="80" width="300" height="60" fill="#fdf6ee" stroke="#c0571f"/>
        <text x="250" y="115" font-size="11" text-anchor="middle" fill="#c0571f">Lower roof</text>
        <path d="M10 80 L60 80 L10 140 Z" fill="#c0571f" opacity="0.35"/>
        <text x="26" y="105" font-size="10" fill="#8a3c12">spike</text>
        <text x="22" y="118" font-size="10" fill="#8a3c12">drift</text>
        <rect x="60" y="80" width="250" height="60" fill="none" stroke="#1f4e79" stroke-dasharray="4 3"/>
        <text x="185" y="100" font-size="11" text-anchor="middle" fill="#1f4e79">source area for snow</text>
        <text x="185" y="113" font-size="11" text-anchor="middle" fill="#1f4e79">in drift (lower roof)</text>
        <line x1="60" y1="74" x2="310" y2="74" stroke="#5b6b7c"/>
        <text x="185" y="68" font-size="10" text-anchor="middle" fill="#5b6b7c">l_s</text>
        <line x1="54" y1="80" x2="54" y2="140" stroke="#5b6b7c"/>
        <text x="34" y="113" font-size="10" fill="#5b6b7c">w_s</text>
        <line x1="270" y1="105" x2="230" y2="125" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrIII)"/>
        <defs><marker id="arrIII" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#1f4e79"/></marker></defs>
        <text x="245" y="30" font-size="10" fill="#5b6b7c">Quartering wind &mdash; elongated</text>
        <text x="245" y="42" font-size="10" fill="#5b6b7c">"spike" drift at the corner</text>
      </svg>`
};

// Schematic plan-view diagrams illustrating the concept of NBC Figures 4.1.6.8.-A
// (outside corner) and 4.1.6.8.-B (inside corner). These are original schematics
// for orientation only, not reproductions of the Code figures.
const cornerDiagrams = {
  outside: `<svg class="diagram" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="20" width="180" height="100" fill="#eaf1f8" stroke="#1f4e79"/>
        <text x="110" y="74" font-size="12" text-anchor="middle" fill="#1f4e79">Upper roof</text>
        <rect x="20" y="120" width="280" height="40" fill="#fdf6ee" stroke="#c0571f"/>
        <rect x="200" y="20" width="100" height="140" fill="#fdf6ee" stroke="#c0571f"/>
        <text x="250" y="55" font-size="11" text-anchor="middle" fill="#c0571f">Lower roof</text>
        <text x="60" y="145" font-size="11" text-anchor="middle" fill="#c0571f">Lower roof</text>
        <rect x="20" y="120" width="180" height="13" fill="#c0571f" opacity="0.35"/>
        <text x="110" y="130" font-size="10" text-anchor="middle" fill="#8a3c12">Face A drift</text>
        <rect x="200" y="20" width="13" height="100" fill="#c0571f" opacity="0.35"/>
        <text x="208" y="70" font-size="10" fill="#8a3c12" transform="rotate(90 208 70)">Face B drift</text>
        <path d="M 200 120 A 40 40 0 0 1 240 160" fill="none" stroke="#1f4e79" stroke-width="2" stroke-dasharray="3 2"/>
        <text x="244" y="152" font-size="10" fill="#1f4e79">radius = x_d</text>
        <circle cx="200" cy="120" r="3" fill="#1f4e79"/>
        <text x="206" y="112" font-size="10" fill="#1f4e79">outside corner</text>
      </svg>`,
  inside: `<svg class="diagram" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 20 H300 V80 H140 V160 H20 Z" fill="#eaf1f8" stroke="#1f4e79"/>
        <text x="230" y="55" font-size="12" text-anchor="middle" fill="#1f4e79">Upper roof</text>
        <text x="80" y="125" font-size="12" text-anchor="middle" fill="#1f4e79">Upper roof</text>
        <path d="M140 80 H300 V160 H140 Z" fill="#fdf6ee" stroke="#c0571f"/>
        <text x="225" y="125" font-size="11" text-anchor="middle" fill="#c0571f">Lower roof</text>
        <rect x="140" y="80" width="13" height="80" fill="#c0571f" opacity="0.35"/>
        <text x="146" y="120" font-size="10" fill="#8a3c12" transform="rotate(90 146 120)">Face A drift</text>
        <rect x="140" y="80" width="160" height="13" fill="#c0571f" opacity="0.35"/>
        <text x="225" y="90" font-size="10" text-anchor="middle" fill="#8a3c12">Face B drift</text>
        <line x1="140" y1="80" x2="280" y2="160" stroke="#1f4e79" stroke-width="2" stroke-dasharray="4 3"/>
        <text x="225" y="150" font-size="10" fill="#1f4e79">bisector</text>
        <text x="148" y="74" font-size="10" fill="#1f4e79">inside corner</text>
      </svg>`
};

function renderCases() {
  const container = document.getElementById('casesContainer');
  container.innerHTML = state.cases.map((c, idx) => `
    <div class="case-block ${c.enabled ? '' : 'disabled'}" data-idx="${idx}">
      <div class="case-title">
        <strong>${c.label}</strong>
        <label><input type="checkbox" class="case-enabled" data-idx="${idx}" ${c.enabled ? 'checked' : ''}> include this case</label>
      </div>
      ${caseDiagrams[c.id]}
      <div class="row3">
        <div class="field">
          <label>l<sub>s</sub> &mdash; length of source area (${lenUnitLabel()})</label>
          <input type="number" step="any" class="case-input" data-idx="${idx}" data-field="ls" data-unit="length" value="${fromSILength(c.ls).toFixed(2)}">
        </div>
        <div class="field">
          <label>w<sub>s</sub> &mdash; width of source area (${lenUnitLabel()})</label>
          <input type="number" step="any" class="case-input" data-idx="${idx}" data-field="ws" data-unit="length" value="${fromSILength(c.ws).toFixed(2)}">
        </div>
        <div class="field">
          <label>h<sub>p</sub> &mdash; lower-roof parapet, this side (${lenUnitLabel()})</label>
          <input type="number" step="any" class="case-input" data-idx="${idx}" data-field="hp" data-unit="length" value="${fromSILength(c.hp).toFixed(2)}">
        </div>
      </div>
      <div class="field" style="max-width:160px;">
        <label>&beta; (1.0 for Case I; 0.67 for Cases II &amp; III &mdash; Commentary G, &para;37)</label>
        <input type="number" step="any" class="case-input" data-idx="${idx}" data-field="beta" data-unit="none" value="${c.beta}">
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.case-input').forEach(inp => {
    inp.addEventListener('input', onCaseInput);
  });
  container.querySelectorAll('.case-enabled').forEach(chk => {
    chk.addEventListener('change', e => {
      const idx = +e.target.dataset.idx;
      state.cases[idx].enabled = e.target.checked;
      renderCases();
      update();
    });
  });
}

function onCaseInput(e) {
  const idx = +e.target.dataset.idx;
  const field = e.target.dataset.field;
  const unit = e.target.dataset.unit;
  let val = parseFloat(e.target.value);
  if (isNaN(val)) val = 0;
  state.cases[idx][field] = unit === 'length' ? toSILength(val) : val;
  update();
}

// ---- Rendering: corner-drift (Art. 4.1.6.8) inputs ------------------------------
function renderCornerFaces() {
  const container = document.getElementById('cornerFaces');
  if (!container) return;
  const faces = [['faceA', 'Face A'], ['faceB', 'Face B']];
  container.innerHTML = faces.map(([key, label]) => {
    const c = state.corner[key];
    return `
    <div class="case-block">
      <div class="case-title"><strong>${label}</strong></div>
      <div class="row3">
        <div class="field">
          <label>l<sub>s</sub> &mdash; source-area length (${lenUnitLabel()})</label>
          <input type="number" step="any" class="corner-input" data-face="${key}" data-field="ls" data-unit="length" value="${fromSILength(c.ls).toFixed(2)}">
        </div>
        <div class="field">
          <label>w<sub>s</sub> &mdash; source-area width (${lenUnitLabel()})</label>
          <input type="number" step="any" class="corner-input" data-face="${key}" data-field="ws" data-unit="length" value="${fromSILength(c.ws).toFixed(2)}">
        </div>
        <div class="field">
          <label>h<sub>p</sub> &mdash; parapet, this face (${lenUnitLabel()})</label>
          <input type="number" step="any" class="corner-input" data-face="${key}" data-field="hp" data-unit="length" value="${fromSILength(c.hp).toFixed(2)}">
        </div>
      </div>
      <div class="field" style="max-width:160px;">
        <label>&beta; (1.0 or 0.67 &mdash; Commentary G, &para;37)</label>
        <input type="number" step="any" class="corner-input" data-face="${key}" data-field="beta" data-unit="none" value="${c.beta}">
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.corner-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const face = e.target.dataset.face;
      const field = e.target.dataset.field;
      const unit = e.target.dataset.unit;
      let val = parseFloat(e.target.value);
      if (isNaN(val)) val = 0;
      state.corner[face][field] = unit === 'length' ? toSILength(val) : val;
      update();
    });
  });
}

function renderCorner() {
  document.getElementById('cornerDiagram').innerHTML = cornerDiagrams[state.corner.type];
  renderCornerFaces();
}

function bindCornerInputs() {
  const enabledChk = document.getElementById('cornerEnabled');
  const block = document.getElementById('cornerBlock');
  const typeSel = document.getElementById('cornerType');

  enabledChk.checked = state.corner.enabled;
  block.style.display = state.corner.enabled ? 'block' : 'none';
  typeSel.value = state.corner.type;

  enabledChk.addEventListener('change', e => {
    state.corner.enabled = e.target.checked;
    block.style.display = e.target.checked ? 'block' : 'none';
    update();
  });
  typeSel.addEventListener('change', e => {
    state.corner.type = e.target.value;
    renderCorner();
    update();
  });

  renderCorner();
}

// ---- Top-level field bindings ---------------------------------------------------
function bindMainInputs() {
  const map = [
    ['Ss', 'pressure'], ['Sr', 'pressure'],
    ['Cb', 'none'], ['Cw', 'none'], ['Cs', 'none'],
    ['h', 'length'], ['hpLower', 'length'], ['l0', 'length'],
    ['xQuery', 'length']
  ];
  map.forEach(([id, unit]) => {
    document.getElementById(id).addEventListener('input', e => {
      let val = parseFloat(e.target.value);
      if (isNaN(val)) val = 0;
      if (id === 'xQuery') { update(); return; }
      state[id] = unit === 'length' ? toSILength(val) : (unit === 'pressure' ? toSIPressure(val) : val);
      update();
    });
  });

  const IsSel = document.getElementById('Is');
  const IsCustom = document.getElementById('IsCustom');
  IsSel.addEventListener('change', () => {
    if (IsSel.value === 'custom') {
      IsCustom.style.display = 'block';
      IsCustom.value = state.Is;
    } else {
      IsCustom.style.display = 'none';
      state.Is = parseFloat(IsSel.value);
      update();
    }
  });
  IsCustom.addEventListener('input', () => {
    let v = parseFloat(IsCustom.value);
    if (isNaN(v)) v = 1.0;
    state.Is = v;
    update();
  });
}

function renderMainInputs() {
  document.getElementById('Ss').value = fromSIPressure(state.Ss).toFixed(2);
  document.getElementById('Sr').value = fromSIPressure(state.Sr).toFixed(2);
  document.getElementById('Cb').value = state.Cb;
  document.getElementById('Cw').value = state.Cw;
  document.getElementById('Cs').value = state.Cs;
  document.getElementById('h').value = fromSILength(state.h).toFixed(2);
  document.getElementById('hpLower').value = fromSILength(state.hpLower).toFixed(2);
  document.getElementById('l0').value = fromSILength(state.l0).toFixed(2);

  // unit labels
  const pLbl = pressUnitLabel(), lLbl = lenUnitLabel();
  ['unitPress1', 'unitPress2'].forEach(id => document.getElementById(id).textContent = `(${pLbl})`);
  document.getElementById('unitPress3').textContent = `(${pLbl})`;
  ['unitLen1', 'unitLen2', 'unitLen3', 'unitLen4'].forEach(id => document.getElementById(id).textContent = `(${lLbl})`);

  // Is dropdown
  const IsSel = document.getElementById('Is');
  const known = ['0.8', '1.0', '1.15', '1.25', '0.9'];
  const cur = state.Is.toString();
  if (known.includes(cur)) {
    IsSel.value = cur;
    document.getElementById('IsCustom').style.display = 'none';
  } else {
    IsSel.value = 'custom';
    document.getElementById('IsCustom').style.display = 'block';
    document.getElementById('IsCustom').value = state.Is;
  }
}

// ---- Profile SVG -------------------------------------------------------------
function drawProfile(r) {
  const svg = document.getElementById('profileSvg');
  const W = 600, H = 200, padL = 50, padR = 20, padT = 20, padB = 35;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const xMax = Math.max(r.xd * 1.4, r.xd + 1, 1);
  const yMax = Math.max(r.Ca0 * 1.15, 1.2);

  const sx = x => padL + (x / xMax) * plotW;
  const sy = y => padT + plotH - (y / yMax) * plotH;

  let pts;
  if (r.xd > 0) {
    pts = [[0, r.Ca0], [r.xd, 1], [xMax, 1]];
  } else {
    pts = [[0, 1], [xMax, 1]];
  }
  const pathD = 'M ' + pts.map(p => `${sx(p[0])},${sy(p[1])}`).join(' L ');
  const areaD = pathD + ` L ${sx(xMax)},${sy(0)} L ${sx(0)},${sy(0)} Z`;

  let svgContent = `
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#5b6b7c"/>
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#5b6b7c"/>
    <text x="${padL - 8}" y="${padT + 4}" font-size="11" text-anchor="end" fill="#5b6b7c">${r.Ca0.toFixed(2)}</text>
    <text x="${padL - 8}" y="${sy(1) + 4}" font-size="11" text-anchor="end" fill="#5b6b7c">1.0</text>
    <text x="${padL}" y="${padT + plotH + 18}" font-size="11" text-anchor="middle" fill="#5b6b7c">0</text>
    <text x="${sx(r.xd)}" y="${padT + plotH + 18}" font-size="11" text-anchor="middle" fill="#1f4e79">x_d = ${fmtLength(r.xd, 2)}</text>
    <path d="${areaD}" fill="#eaf1f8"/>
    <path d="${pathD}" fill="none" stroke="#1f4e79" stroke-width="2"/>
    <line x1="${sx(r.xd)}" y1="${padT}" x2="${sx(r.xd)}" y2="${padT + plotH}" stroke="#c0571f" stroke-dasharray="3 3"/>
    <text x="${padL + plotW / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="#5b6b7c">distance x from roof step (${lenUnitLabel()})</text>
    <text x="14" y="${padT + plotH / 2}" font-size="11" fill="#5b6b7c" transform="rotate(-90 14 ${padT + plotH / 2})">C_a(x)</text>
  `;
  svg.innerHTML = svgContent;
}

// ---- Step-by-step text --------------------------------------------------------
function num(v, dp = 3) { return v.toFixed(dp); }

function caseLabelShort(c) { return `Case ${c.id}`; }

function buildSteps(r) {
  const steps = [];
  const { Ss, Sr, Is, Cb, Cw, Cs, h, g } = r;

  steps.push({
    lbl: 'Step 1 — Specific weight of snow, &gamma;',
    clause: 'NBC Sentence 4.1.6.13.(1)',
    body: `&gamma; = min(0.43&times;S<sub>s</sub> + 2.2, 4.0) = min(0.43&times;${num(Ss)} + 2.2, 4.0) = <span class="result">${num(g)} kN/m&sup3;</span> (${(g * KNM3_TO_PCF).toFixed(2)} pcf)`
  });

  r.results.forEach(c => {
    steps.push({
      lbl: `${caseLabelShort(c)} — source-area length, l<sub>cs</sub>`,
      clause: 'NBC Sentence 4.1.6.5.(3)',
      body: `l<sub>cs</sub> = 2w<sub>s</sub> &minus; w<sub>s</sub>&sup2;/l<sub>s</sub> = 2(${num(c.ws)}) &minus; ${num(c.ws)}&sup2;/${num(c.ls)} = <span class="result">${num(c.lcs)} m</span> (${(c.lcs * M_TO_FT).toFixed(2)} ft)`
    });
    steps.push({
      lbl: `${caseLabelShort(c)} — reduced parapet height, h<sub>p</sub>'`,
      clause: 'NBC Sentence 4.1.6.5.(3)',
      body: `h<sub>p</sub>' = h<sub>p</sub> &minus; C<sub>b</sub>S<sub>s</sub>/&gamma; = ${num(c.hp)} &minus; (${num(Cb)}&times;${num(Ss)})/${num(g)} = ${num(c.hpRaw)} &rarr; clamped to [0, l<sub>cs</sub>/5 = ${num(c.lcs / 5)}] = <span class="result">${num(c.hpPrime)} m</span>`
    });
    steps.push({
      lbl: `${caseLabelShort(c)} — factor F`,
      clause: 'NBC Sentence 4.1.6.5.(3)',
      body: `F = 0.35&beta;&radic;(&gamma;(l<sub>cs</sub> &minus; 5h<sub>p</sub>')/S<sub>s</sub>) + C<sub>b</sub> = 0.35&times;${num(c.beta)}&times;&radic;(${num(g)}&times;(${num(c.lcs)} &minus; 5&times;${num(c.hpPrime)})/${num(Ss)}) + ${num(Cb)} = <span class="result">${num(c.F)}</span>`
    });
    steps.push({
      lbl: `${caseLabelShort(c)} — accumulation factor C<sub>a0</sub>`,
      clause: 'Eq. (2) &amp; (3), Commentary G &para;37',
      body: `C<sub>a0</sub> = min(&beta;&gamma;h/(C<sub>b</sub>S<sub>s</sub>), F/C<sub>b</sub>) = min(${num(c.beta)}&times;${num(g)}&times;${num(h)}/(${num(Cb)}&times;${num(Ss)}), ${num(c.F)}/${num(Cb)}) = min(${num(c.cand1)}, ${num(c.cand2)}) = <span class="result">${num(c.Ca0)}</span>`
    });
  });

  if (r.results.length) {
    const list = r.results.map(c => `${caseLabelShort(c)}=${num(c.Ca0)}`).join(', ');
    steps.push({
      lbl: 'Governing C<sub>a0</sub>',
      clause: 'Commentary G, Sample Calc. 1, Step 5',
      body: `C<sub>a0</sub> = max(${list}) = <span class="result">${num(r.Ca0)}</span> &mdash; governed by <strong>${caseLabelShort(r.governing)}</strong>.`
    });
  } else {
    steps.push({ lbl: 'Governing C<sub>a0</sub>', clause: '', body: `No case enabled &mdash; C<sub>a0</sub> = 1.0 (no drift).` });
  }

  steps.push({
    lbl: 'Drift length, x<sub>d</sub>',
    clause: 'NBC Sentence 4.1.6.5.(2)',
    body: `x<sub>d</sub> = 5(C<sub>b</sub>S<sub>s</sub>/&gamma;)(C<sub>a0</sub> &minus; 1) = 5&times;(${num(Cb)}&times;${num(Ss)}/${num(g)})&times;(${num(r.Ca0)} &minus; 1) = <span class="result">${num(r.xd)} m</span> (${(r.xd * M_TO_FT).toFixed(2)} ft)`
  });

  steps.push({
    lbl: "Sheltered zone, h' and x = 10h'",
    clause: 'NBC Fig. 4.1.6.5.-A',
    body: `h' = h &minus; C<sub>b</sub>C<sub>w</sub>S<sub>s</sub>/&gamma; = ${num(h)} &minus; (${num(Cb)}&times;${num(Cw)}&times;${num(Ss)})/${num(g)} = <span class="result">${num(r.hPrime)} m</span>; &nbsp; x = 10h' = <span class="result">${num(r.x10)} m</span><br>This defines the extent over which C<sub>w</sub> = 1.0 must be used for adjoining roof areas (Commentary G, &para;37).`
  });

  steps.push({
    lbl: 'C<sub>a</sub>(x) distribution',
    clause: 'NBC Sentence 4.1.6.5.(1)',
    body: `C<sub>a</sub>(x) = C<sub>a0</sub> &minus; (C<sub>a0</sub> &minus; 1)&times;x/x<sub>d</sub> for 0 &le; x &le; x<sub>d</sub> = ${num(r.xd)} m, and C<sub>a</sub>(x) = 1 for x &gt; x<sub>d</sub>.`
  });

  steps.push({
    lbl: 'Snow load, S(x)',
    clause: 'NBC Sentence 4.1.6.2.(1)',
    body: `S(x) = I<sub>s</sub>[S<sub>s</sub>(C<sub>b</sub>C<sub>w</sub>C<sub>s</sub>C<sub>a</sub>(x)) + S<sub>r</sub>], with I<sub>s</sub>=${num(Is)}, C<sub>w</sub>=${num(Cw)}, C<sub>s</sub>=${num(Cs)}, S<sub>r</sub>=${num(Sr)} kPa.<br>At x=0: S = ${num(r.S(0))} kPa (${fromSIPressure(r.S(0)).toFixed(2)} psf, only if displaying US). At x&ge;x<sub>d</sub>: S = ${num(r.S(r.xd + 0.01))} kPa.`
  });

  const p = r.parapet;
  const note = p.Ca0 < 1
    ? `C<sub>a0</sub> (parapet) = min(${num(p.term1)}, ${num(p.term2)}) = <span class="result">${num(p.Ca0)}</span> &lt; 1 &rarr; not significant, may be ignored (per Commentary G, Sample Calc. 1, Step 10).`
    : `C<sub>a0</sub> (parapet) = min(${num(p.term1)}, ${num(p.term2)}) = <span class="result">${num(p.Ca0)}</span> &ge; 1 &mdash; this exceeds the roof-step drift near this parapet; combine with engineering judgement (the source commentary does not give a combination rule beyond the &lt;1 "ignore" case).`;
  steps.push({
    lbl: 'Lower-roof parapet check',
    clause: 'NBC Clause 4.1.6.7.(1)(a)',
    body: `C<sub>a0</sub>(parapet) = min(0.67&gamma;h<sub>p,lower</sub>/(C<sub>b</sub>S<sub>s</sub>), 1 + &gamma;l<sub>0</sub>/(7.5C<sub>b</sub>S<sub>s</sub>))<br>= min(0.67&times;${num(g)}&times;${num(state.hpLower)}/(${num(Cb)}&times;${num(Ss)}), 1 + ${num(g)}&times;${num(state.l0)}/(7.5&times;${num(Cb)}&times;${num(Ss)}))<br>${note}`
  });

  if (r.corner) {
    const c = r.corner;
    ['A', 'B'].forEach(key => {
      const f = c[key];
      const lbl = key === 'A' ? 'Face A' : 'Face B';
      steps.push({
        lbl: `Corner ${lbl} &mdash; C<sub>a0</sub> and x<sub>d</sub>`,
        clause: 'NBC Sentence 4.1.6.5.(3), Eq.(2)&amp;(3) (same method as Section 2)',
        body: `l<sub>cs</sub>=${num(f.lcs)} m, h<sub>p</sub>'=${num(f.hpPrime)} m, F=${num(f.F)} &rarr; C<sub>a0</sub>=min(${num(f.cand1)}, ${num(f.cand2)})=<span class="result">${num(f.Ca0)}</span>, x<sub>d</sub>=<span class="result">${num(f.xd)} m</span> (${(f.xd * M_TO_FT).toFixed(2)} ft)`
      });
    });
    if (c.type === 'outside') {
      steps.push({
        lbl: 'Outside corner &mdash; governing face',
        clause: 'NBC Sentence 4.1.6.8.(1), Fig. 4.1.6.8.-A',
        body: `The drift load at an outside corner may be taken as the <em>least severe</em> of the two faces: min(C<sub>a0,A</sub>=${num(c.A.Ca0)}, C<sub>a0,B</sub>=${num(c.B.Ca0)}) = <span class="result">${num(c.governing.Ca0)}</span> (Face ${c.governing.face}). This drift (x<sub>d</sub>=${num(c.governing.xd)} m) is extended radially around the corner, per Fig. 4.1.6.8.-A.`
      });
    } else {
      steps.push({
        lbl: 'Inside corner &mdash; application',
        clause: 'NBC Sentence 4.1.6.8.(2), Fig. 4.1.6.8.-B',
        body: `Each face keeps its own drift profile: Face A (C<sub>a0</sub>=${num(c.A.Ca0)}, x<sub>d</sub>=${num(c.A.xd)} m) and Face B (C<sub>a0</sub>=${num(c.B.Ca0)}, x<sub>d</sub>=${num(c.B.xd)} m), each applied along its own face. Per Fig. 4.1.6.8.-B, each is extended in plan only as far as the <em>bisector of the angle</em> between the two faces &mdash; the Code gives no formula for this distance; take it off the roof plan.`
      });
    }
  }

  return steps;
}

function renderSteps(steps) {
  document.getElementById('stepsContainer').innerHTML = steps.map(s => `
    <div class="step">
      <span class="lbl">${s.lbl} <span class="clause">&mdash; ${s.clause}</span></span>
      <div>${s.body}</div>
    </div>
  `).join('');
}

// ---- Main update ---------------------------------------------------------------
function update() {
  const r = compute();

  document.getElementById('outGamma').textContent = unitSystem === 'SI'
    ? r.g.toFixed(2) : (r.g * KNM3_TO_PCF).toFixed(2);
  document.getElementById('outGamma').nextElementSibling.textContent = unitSystem === 'SI' ? 'γ (kN/m³)' : 'γ (pcf)';
  document.getElementById('outCa0').textContent = r.Ca0.toFixed(2);
  document.getElementById('outXd').textContent = fmtLength(r.xd, 2);
  document.getElementById('outSmax').textContent = fmtPressure(r.S(0), 2);

  const govNote = document.getElementById('govCaseNote');
  if (r.governing) {
    govNote.innerHTML = `Governing case: <strong>${caseLabelShort(r.governing)}</strong> &mdash; ${r.governing.label.replace(/^Case [I]+ . /,'')}. C<sub>a0</sub> = ${r.Ca0.toFixed(2)}, drift length x<sub>d</sub> = ${fmtLength(r.xd)}.`;
  } else {
    govNote.innerHTML = `No case is enabled &mdash; enable at least one case in Section 2.`;
  }

  drawProfile(r);

  // profile table
  const tbody = document.querySelector('#profileTable tbody');
  const xs = [0, r.xd * 0.25, r.xd * 0.5, r.xd * 0.75, r.xd, r.xd * 1.3].filter(x => x >= 0);
  tbody.innerHTML = xs.map(x => `
    <tr><td>${fmtLength(x, 2)}</td><td>${r.Ca(x).toFixed(3)}</td><td>${fmtPressure(r.S(x), 2)}</td></tr>
  `).join('');

  // x query
  const xq = toSILength(parseFloat(document.getElementById('xQuery').value) || 0);
  document.getElementById('outCaX').textContent = r.Ca(xq).toFixed(3);
  document.getElementById('outSX').textContent = fmtPressure(r.S(xq), 2);

  // corner drift results (Art. 4.1.6.8)
  const cornerPanel = document.getElementById('cornerResultsPanel');
  if (r.corner) {
    cornerPanel.style.display = 'block';
    const c = r.corner;
    document.getElementById('cornerTable').innerHTML = [
      ['Face A', c.A], ['Face B', c.B]
    ].map(([name, f]) => `
      <tr><td>${name}</td><td>${f.Ca0.toFixed(2)}</td><td>${fmtLength(f.xd, 2)}</td><td>${fmtPressure(f.S0, 2)}</td></tr>
    `).join('');

    let note;
    if (c.type === 'outside') {
      const gFace = c.governing.face === 'A' ? 'Face A' : 'Face B';
      note = `<strong>Outside corner &mdash; Sentence 4.1.6.8.(1):</strong> the drift load is taken as the <em>least severe</em> of the two faces, governed by <strong>${gFace}</strong> (C<sub>a0</sub>=${c.governing.Ca0.toFixed(2)}, x<sub>d</sub>=${fmtLength(c.governing.xd, 2)}, S=${fmtPressure(c.governing.S0, 2)}). Extend this drift radially around the corner with radius x<sub>d</sub>, per Fig. 4.1.6.8.-A.`;
    } else {
      note = `<strong>Inside corner &mdash; Sentence 4.1.6.8.(2):</strong> each face keeps its own drift profile (tabulated above), applied along that face. Per Fig. 4.1.6.8.-B, each face's drift is extended in plan only as far as the <em>bisector of the angle</em> between the two faces &mdash; determine that distance from your roof plan; the Code gives no formula for it.`;
    }
    document.getElementById('cornerNote').innerHTML = note;
  } else {
    cornerPanel.style.display = 'none';
  }

  renderSteps(buildSteps(r));
}

// ---- Unit toggle ----------------------------------------------------------------
function setUnits(sys) {
  unitSystem = sys;
  document.getElementById('unitSI').classList.toggle('active', sys === 'SI');
  document.getElementById('unitUS').classList.toggle('active', sys === 'US');
  renderMainInputs();
  renderCases();
  renderCornerFaces();
  update();
}

// ---- Init -------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('unitSI').addEventListener('click', () => setUnits('SI'));
  document.getElementById('unitUS').addEventListener('click', () => setUnits('US'));
  bindMainInputs();
  renderMainInputs();
  renderCases();
  bindCornerInputs();
  update();
});

/* =====================================================================
   STRUCTCALC SHELL BRIDGE
   Lets this module run standalone (as before) AND inside the StructCalc
   app shell (StructCalc/index.html), which embeds it in an <iframe> and
   exchanges `state`/`unitSystem` via postMessage so calculations can be
   saved/restored per project.
   Protocol:
     shell -> module: {type:'loadState', state:{...}, unitSystem:'SI'|'US'}
     shell -> module: {type:'requestState'}
     module -> shell: {type:'stateChanged', module:'snowDriftNBCC', state:{...}, unitSystem:'SI'|'US'}
   ===================================================================== */
(function () {
  function snapshotState() {
    try { return JSON.parse(JSON.stringify(state)); } catch (e) { return null; }
  }

  function postState() {
    if (window.parent === window) return; // not embedded
    window.parent.postMessage({
      type: 'stateChanged', module: 'snowDriftNBCC',
      state: snapshotState(), unitSystem: unitSystem
    }, '*');
  }

  function applyState(msg) {
    if (!msg) return;
    if (msg.state) Object.assign(state, msg.state);
    if (msg.unitSystem) unitSystem = msg.unitSystem;

    document.getElementById('unitSI').classList.toggle('active', unitSystem === 'SI');
    document.getElementById('unitUS').classList.toggle('active', unitSystem === 'US');

    renderMainInputs();
    renderCases();

    document.getElementById('cornerEnabled').checked = state.corner.enabled;
    document.getElementById('cornerBlock').style.display = state.corner.enabled ? 'block' : 'none';
    document.getElementById('cornerType').value = state.corner.type;
    renderCorner();

    update();
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === 'loadState') {
      try { applyState(msg); } catch (err) { console.error('StructCalc applyState error', err); }
    } else if (msg.type === 'requestState') {
      postState();
    }
  });

  // Wrap update() so every recompute (incl. from user edits) reports the
  // new state back to the shell.
  const _update = update;
  update = function () {
    _update.apply(this, arguments);
    postState();
  };

  window.addEventListener('DOMContentLoaded', () => setTimeout(postState, 0));
})();
