'use strict';

/* =====================================================================
   UNIT CONVERSION HELPERS
   Canonical (internal) units: US customary — psf, ft, mph, ft^2.
   ===================================================================== */
const PSF_PER_KPA = 20.8854;   // 1 kPa = 20.8854 psf
const FT_PER_M = 3.28084;      // 1 m = 3.28084 ft
const MPH_PER_MPS = 2.23694;   // 1 m/s = 2.23694 mph
const SQFT_PER_SQM = FT_PER_M * FT_PER_M; // 1 m^2 = 10.7639 ft^2

function fmt(v, d = 2) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return Number(v).toFixed(d);
}

// Pressure: internal psf <-> displayed unit
function pressureOut(psf) {
  return state.unitSystem === 'SI' ? psf / PSF_PER_KPA : psf;
}
function toUSPressure(v, sys) {
  return sys === 'SI' ? v * PSF_PER_KPA : v;
}

// Length: internal ft <-> displayed unit
function lengthOut(ft) {
  return state.unitSystem === 'SI' ? ft / FT_PER_M : ft;
}
function toUSLength(v, sys) {
  return sys === 'SI' ? v * FT_PER_M : v;
}

// Speed: internal mph <-> displayed unit
function speedOut(mph) {
  return state.unitSystem === 'SI' ? mph / MPH_PER_MPS : mph;
}
function toUSSpeed(v, sys) {
  return sys === 'SI' ? v * MPH_PER_MPS : v;
}

// Area: internal ft^2 <-> displayed unit
function areaOut(sqft) {
  return state.unitSystem === 'SI' ? sqft / SQFT_PER_SQM : sqft;
}
function toUSArea(v, sys) {
  return sys === 'SI' ? v * SQFT_PER_SQM : v;
}

/* =====================================================================
   REFERENCE DATA — ASCE/SEI 7-22
   Every table below cites the exact Section/Table/Figure/Equation it
   reproduces. No values are estimated or invented.
   ===================================================================== */

// Table 26.11-1, Terrain Exposure Constants (Customary units)
const EXPOSURE = {
  B: { alpha: 7.5, zg: 3280, zmin: 30, label: 'B — Urban/suburban, wooded areas, or terrain with closely spaced obstructions' },
  C: { alpha: 9.8, zg: 2460, zmin: 15, label: 'C — Open terrain with scattered obstructions' },
  D: { alpha: 11.5, zg: 1935, zmin: 7, label: 'D — Flat, unobstructed areas and water surfaces' }
};

// Table 26.6-1, Wind Directionality Factor Kd (Buildings — MWFRS & C&C)
const KD = 0.85;

// Table 26.13-1, Internal Pressure Coefficient (GCpi)
const GCPI = {
  enclosed: { pos: 0.18, neg: -0.18, label: 'Enclosed' },
  partiallyEnclosed: { pos: 0.55, neg: -0.55, label: 'Partially Enclosed' },
  partiallyOpen: { pos: 0.18, neg: -0.18, label: 'Partially Open' },
  open: { pos: 0.0, neg: 0.0, label: 'Open' }
};

// Figure 28.3-1, Load Case 1 — GCpf, theta-dependent (breakpoints at theta = 5,20,30,45,90 deg;
// rows "0-5" and "30-45" are flat across that range)
const GCPF_LC1 = {
  thetas: [5, 20, 30, 45, 90],
  zones: {
    '1': [0.40, 0.53, 0.56, 0.56, 0.56],
    '2': [-0.69, -0.69, 0.21, 0.21, 0.56],
    '3': [-0.37, -0.48, -0.43, -0.43, -0.37],
    '4': [-0.29, -0.43, -0.37, -0.37, -0.37],
    '1E': [0.61, 0.80, 0.69, 0.69, 0.69],
    '2E': [-1.07, -1.07, 0.27, 0.27, 0.69],
    '3E': [-0.53, -0.69, -0.53, -0.53, -0.48],
    '4E': [-0.43, -0.64, -0.48, -0.48, -0.48]
  }
};

// Figure 28.3-1, Load Case 2 — GCpf, theta-independent (0-90 deg)
const GCPF_LC2 = {
  '1': -0.45, '2': -0.69, '3': -0.37, '4': -0.45, '5': 0.40, '6': -0.29,
  '1E': -0.48, '2E': -1.07, '3E': -0.53, '4E': -0.48, '5E': 0.61, '6E': -0.43
};

// Figure 28.3-2, Load Case 3 — torsional T-zones added to Load Case 1 zones 1-4 / 1E-4E
const GCPF_LC3_T = {
  thetas: [5, 20, 30, 45, 90],
  zones: {
    '1T': [0.10, 0.13, 0.14, 0.14, 0.14],
    '2T': [-0.17, -0.17, 0.05, 0.05, 0.14],
    '3T': [-0.09, -0.12, -0.11, -0.11, -0.09],
    '4T': [-0.07, -0.11, -0.09, -0.09, -0.09]
  }
};

// Figure 28.3-2, Load Case 4 — torsional T-zones added to Load Case 2 zones 1-6 / 1E-6E
const GCPF_LC4_T = { '5T': 0.10, '6T': -0.07 };

// Figure 30.3-1, Walls — GCp vs effective wind area A (sf), log-linear between A=10 and A=500
const GCP_WALL = {
  Alo: 10, Ahi: 500,
  '4': { neg: { lo: -1.1, hi: -0.8 }, pos: { lo: 1.0, hi: 0.7 } },
  '5': { neg: { lo: -1.4, hi: -0.8 }, pos: { lo: 1.0, hi: 0.7 } }
};

// Figure 30.3-2A, Roof (theta <= 7 deg) — GCp vs effective wind area A (sf), log-linear A=10..500
const GCP_ROOF_LE7 = {
  Alo: 10, Ahi: 500,
  '1p': { neg: { lo: -0.9, hi: -1.0 }, pos: { lo: 0.3, hi: 0.2 } },
  '1': { neg: { lo: -1.7, hi: -0.4 }, pos: { lo: 0.3, hi: 0.2 } },
  '2': { neg: { lo: -2.3, hi: -1.0 }, pos: { lo: 0.3, hi: 0.2 } },
  '3': { neg: { lo: -3.2, hi: -1.4 }, pos: { lo: 0.3, hi: 0.2 } }
};

/* =====================================================================
   INTERPOLATION HELPERS
   ===================================================================== */

// Piecewise-linear interpolation across a breakpoint table (Fig. 28.3-1/28.3-2:
// "linear interpolation for other values of theta is permitted")
function lerpTheta(theta, thetas, values) {
  const t = Math.min(Math.max(theta, thetas[0]), thetas[thetas.length - 1]);
  for (let i = 0; i < thetas.length - 1; i++) {
    if (t >= thetas[i] && t <= thetas[i + 1]) {
      const span = thetas[i + 1] - thetas[i];
      const f = span === 0 ? 0 : (t - thetas[i]) / span;
      return values[i] + f * (values[i + 1] - values[i]);
    }
  }
  return values[values.length - 1];
}

// Log-linear interpolation of GCp between A=Alo and A=Ahi (Figures 30.3-1 / 30.3-2A:
// "Use linear interpolation for effective wind area between values shown" — area axis is log scale)
function logLerpA(A, Alo, Ahi, lo, hi) {
  const a = Math.min(Math.max(A, Alo), Ahi);
  const t = (Math.log10(a) - Math.log10(Alo)) / (Math.log10(Ahi) - Math.log10(Alo));
  return lo + t * (hi - lo);
}

/* =====================================================================
   UI-ONLY STATE (not persisted via shell bridge)
   ===================================================================== */
let torsionExpanded = false; // user toggle for "show T-zone pressures for reference" when h <= 30 ft

/* =====================================================================
   STATE
   ===================================================================== */
const state = {
  unitSystem: 'US',
  mode: 'mwfrs',     // 'mwfrs' or 'cc' — which procedure's inputs/results are shown
  roofType: 'sloped', // 'flat' (theta<=7, hides theta input, forces theta=0) or 'sloped'
  V: 115,            // basic wind speed, mph (Sec. 26.5)
  exposure: 'C',     // B / C / D (Sec. 26.7)
  kzt: 1.0,          // topographic factor (Sec. 26.8.2, Fig. 26.8-1)
  groundElev: 0,     // ground elevation above sea level, ft (Sec. 26.9)
  enclosure: 'enclosed', // enclosed / partiallyEnclosed / partiallyOpen / open (Sec. 26.13)
  h: 20,             // mean roof height, ft (Sec. 26.2 / 26.3)
  minDim: 60,        // least horizontal dimension of the building, ft
  theta: 10,         // roof angle, degrees
  areaWall: 20,      // C&C effective wind area, walls, ft^2
  areaRoof: 50,      // C&C effective wind area, roof, ft^2

  // Report header fields (Phase 4) — informational only, do not affect calculations
  projectName: '',
  projectNumber: '',
  engineer: '',
  projectDate: '',   // ISO yyyy-mm-dd; defaulted to today on init if empty
  riskCategory: 'II' // Table 1.5-1 — recorded for the report header only
};

/* =====================================================================
   CALCULATION ENGINE
   ===================================================================== */

// Table 26.10-1, Note 1 formula for Kz/Kh:
//   z < 15 ft:        Kz = 2.41 (15/zg)^(2/alpha)
//   15 ft <= z <= zg: Kz = 2.41 (z/zg)^(2/alpha)
//   z > zg:           Kz = 2.41
function khFromFormula(h, exposure) {
  const { alpha, zg } = EXPOSURE[exposure];
  const z = Math.max(h, 0);
  if (z < 15) return 2.41 * Math.pow(15 / zg, 2 / alpha);
  if (z <= zg) return 2.41 * Math.pow(z / zg, 2 / alpha);
  return 2.41;
}

// Table 26.10-1 footnote (*): "Use 0.70 in Chapter 28, Exposure B, when z < 30 ft (9.1 m)."
function computeKh(h, exposure) {
  let kh = khFromFormula(h, exposure);
  if (exposure === 'B' && h < 30) kh = 0.70;
  return kh;
}

// Table 26.9-1, Note 2: Ke = exp(-0.0000362 ze[ft]); Ke = 1.0 permitted for all elevations.
function computeKe(ze) {
  return Math.exp(-0.0000362 * Math.max(ze, 0));
}

// Notation under Figure 28.3-1 / 30.3-1:
//   a = 10% of least horizontal dimension or 0.4h, whichever is smaller,
//       but not less than either 4% of least horizontal dimension or 3 ft.
//   Exception: theta = 0-7 deg and least horizontal dimension > 300 ft -> a <= 0.8h
function computeZoneA(h, minDim, theta) {
  let a = Math.min(0.1 * minDim, 0.4 * h);
  a = Math.max(a, Math.max(0.04 * minDim, 3));
  if (theta <= 7 && minDim > 300) a = Math.min(a, 0.8 * h);
  return a;
}

function gcpfLC1(zone, theta) {
  return lerpTheta(theta, GCPF_LC1.thetas, GCPF_LC1.zones[zone]);
}
function gcpfLC3T(zone, theta) {
  return lerpTheta(theta, GCPF_LC3_T.thetas, GCPF_LC3_T.zones[zone]);
}

function gcpWall(zone, A) {
  const z = GCP_WALL[zone];
  return {
    neg: logLerpA(A, GCP_WALL.Alo, GCP_WALL.Ahi, z.neg.lo, z.neg.hi),
    pos: logLerpA(A, GCP_WALL.Alo, GCP_WALL.Ahi, z.pos.lo, z.pos.hi)
  };
}
function gcpRoof(zone, A) {
  const z = GCP_ROOF_LE7[zone];
  return {
    neg: logLerpA(A, GCP_ROOF_LE7.Alo, GCP_ROOF_LE7.Ahi, z.neg.lo, z.neg.hi),
    pos: logLerpA(A, GCP_ROOF_LE7.Alo, GCP_ROOF_LE7.Ahi, z.pos.lo, z.pos.hi)
  };
}

// Eq. 28.3-1 / 30.3-1: p = qh Kd [(GCpf or GCp) - (GCpi)]
// "min" pairs the coefficient with +GCpi (worst suction); "max" pairs it with -GCpi (worst inward).
function pRangeSingle(qh, kd, gc, gcpi) {
  return {
    min: qh * kd * (gc - gcpi.pos),
    max: qh * kd * (gc - gcpi.neg)
  };
}
function pRangeDual(qh, kd, gcNeg, gcPos, gcpi) {
  return {
    min: qh * kd * (gcNeg - gcpi.pos),
    max: qh * kd * (gcPos - gcpi.neg)
  };
}

function compute(s) {
  const steps = [];

  // --- Velocity pressure exposure coefficient, Kh ---
  const kh = computeKh(s.h, s.exposure);
  steps.push({
    label: 'Velocity Pressure Exposure Coefficient, K_h',
    clause: 'Table 26.10-1 (Note 1 formula' + (s.exposure === 'B' && s.h < 30 ? ' and footnote *)' : ')'),
    formula: (s.exposure === 'B' && s.h < 30)
      ? 'Exposure B, h < 30 ft → K_h = 0.70 (Table 26.10-1, footnote *)'
      : (s.h < 15
        ? 'K_h = 2.41(15/z_g)^(2/α) = 2.41(15/' + EXPOSURE[s.exposure].zg + ')^(2/' + EXPOSURE[s.exposure].alpha + ')'
        : 'K_h = 2.41(h/z_g)^(2/α) = 2.41(' + fmt(s.h, 1) + '/' + EXPOSURE[s.exposure].zg + ')^(2/' + EXPOSURE[s.exposure].alpha + ')'),
    result: 'K_h = ' + fmt(kh, 3)
  });

  // --- Ground elevation factor, Ke ---
  const ke = computeKe(s.groundElev);
  steps.push({
    label: 'Ground Elevation Factor, K_e',
    clause: 'Table 26.9-1, Note 2',
    formula: 'K_e = exp(-0.0000362 × z_e) = exp(-0.0000362 × ' + fmt(s.groundElev, 0) + ')',
    result: 'K_e = ' + fmt(ke, 3) + '  (K_e = 1.00 is always permitted)'
  });

  // --- Wind directionality factor, Kd ---
  steps.push({
    label: 'Wind Directionality Factor, K_d',
    clause: 'Table 26.6-1',
    formula: 'Buildings — MWFRS and Components & Cladding',
    result: 'K_d = ' + fmt(KD, 2)
  });

  // --- Topographic factor, Kzt (user-supplied) ---
  steps.push({
    label: 'Topographic Factor, K_zt',
    clause: 'Sec. 26.8.2, Fig. 26.8-1',
    formula: 'User input (K_zt = 1.0 if the site does not meet the Fig. 26.8-1 escarpment/ridge/hill criteria of Sec. 26.8.1)',
    result: 'K_zt = ' + fmt(s.kzt, 2)
  });

  // --- Velocity pressure qh ---
  const qh = 0.00256 * kh * s.kzt * ke * s.V * s.V;
  steps.push({
    label: 'Velocity Pressure at Mean Roof Height, q_h',
    clause: 'Eq. 26.10-1',
    formula: 'q_h = 0.00256 K_h K_zt K_e V² = 0.00256 × ' + fmt(kh, 3) + ' × ' + fmt(s.kzt, 2) + ' × ' + fmt(ke, 3) + ' × ' + fmt(s.V, 1) + '²',
    result: 'q_h = ' + fmt(qh, 2) + ' psf'
  });

  // --- Internal pressure coefficient, GCpi ---
  const gcpi = GCPI[s.enclosure];
  steps.push({
    label: 'Internal Pressure Coefficient, (GC_pi)',
    clause: 'Table 26.13-1',
    formula: GCPI[s.enclosure].label + ' building classification (Sec. 26.2 definitions)',
    result: '(GC_pi) = +' + fmt(gcpi.pos, 2) + ' and ' + fmt(gcpi.neg, 2)
  });

  // --- Zone dimension a ---
  const a = computeZoneA(s.h, s.minDim, s.theta);
  steps.push({
    label: 'Zone Dimension, a',
    clause: 'Figure 28.3-1 / 30.3-1, Notation',
    formula: 'a = min[0.1 × (least horiz. dim.), 0.4h], not less than max[0.04 × (least horiz. dim.), 3 ft]' + ((s.theta <= 7 && s.minDim > 300) ? '; capped at 0.8h (θ = 0-7°, least horiz. dim. > 300 ft)' : ''),
    result: 'a = ' + fmt(a, 2) + ' ft'
  });

  // --- MWFRS Load Case 1 (theta-dependent) ---
  const lc1Zones = ['1', '2', '3', '4', '1E', '2E', '3E', '4E'];
  const mwfrsLC1 = lc1Zones.map(z => {
    const gc = gcpfLC1(z, s.theta);
    return { zone: z, gcpf: gc, p: pRangeSingle(qh, KD, gc, gcpi) };
  });

  // --- MWFRS Load Case 2 (theta-independent) ---
  const lc2Zones = ['1', '2', '3', '4', '5', '6', '1E', '2E', '3E', '4E', '5E', '6E'];
  const mwfrsLC2 = lc2Zones.map(z => {
    const gc = GCPF_LC2[z];
    return { zone: z, gcpf: gc, p: pRangeSingle(qh, KD, gc, gcpi) };
  });

  // --- MWFRS Torsional Load Cases 3 & 4 (Fig. 28.3-2) ---
  const lc3Zones = ['1T', '2T', '3T', '4T'];
  const mwfrsLC3 = lc3Zones.map(z => {
    const gc = gcpfLC3T(z, s.theta);
    return { zone: z, gcpf: gc, p: pRangeSingle(qh, KD, gc, gcpi) };
  });
  const lc4Zones = ['5T', '6T'];
  const mwfrsLC4 = lc4Zones.map(z => {
    const gc = GCPF_LC4_T[z];
    return { zone: z, gcpf: gc, p: pRangeSingle(qh, KD, gc, gcpi) };
  });
  const torsionApplies = s.h > 30;

  // --- C&C Walls (Fig. 30.3-1) ---
  const ccWall = ['4', '5'].map(z => {
    const gc = gcpWall(z, s.areaWall);
    return { zone: z, gcp: gc, p: pRangeDual(qh, KD, gc.neg, gc.pos, gcpi) };
  });

  // --- C&C Roof, theta <= 7 deg (Fig. 30.3-2A) ---
  const roofApplicable = s.theta <= 7;
  const ccRoof = roofApplicable
    ? ['1p', '1', '2', '3'].map(z => {
      const gc = gcpRoof(z, s.areaRoof);
      return { zone: z, gcp: gc, p: pRangeDual(qh, KD, gc.neg, gc.pos, gcpi) };
    })
    : [];

  return {
    kh, ke, kd: KD, qh, gcpi, a,
    steps, mwfrsLC1, mwfrsLC2, mwfrsLC3, mwfrsLC4, torsionApplies,
    ccWall, ccRoof, roofApplicable
  };
}

/* =====================================================================
   RENDERING
   ===================================================================== */

const ZONE_LABELS = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '1E': '1E', '2E': '2E', '3E': '3E', '4E': '4E', '5E': '5E', '6E': '6E',
  '1T': '1T', '2T': '2T', '3T': '3T', '4T': '4T', '5T': '5T', '6T': '6T',
  '1p': "1'"
};

function pUnit() { return state.unitSystem === 'SI' ? 'kPa' : 'psf'; }
function pVal(psf) { return state.unitSystem === 'SI' ? psf / PSF_PER_KPA : psf; }

function renderSteps(steps) {
  const c = document.getElementById('stepsContainer');
  if (!c) return;
  // SkyCiv-style "References | Calculations | Results" columnar layout
  let html = '<table class="steps-table"><thead><tr><th>Reference</th><th>Calculation</th><th>Result</th></tr></thead><tbody>';
  steps.forEach(st => {
    html += '<tr>' +
      '<td class="ref-col"><span class="src-tag">' + st.clause + '</span></td>' +
      '<td class="calc-col"><span class="step-label">' + st.label + '</span><div class="formula">' + st.formula + '</div></td>' +
      '<td class="result-col">' + st.result + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

function zoneTable(containerId, rows, dual) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!rows.length) { c.innerHTML = '<p class="muted">Not applicable.</p>'; return; }
  let html = '<table><thead><tr><th>Zone</th>';
  if (dual) html += '<th>(GC_p) range</th>'; else html += '<th>(GC_pf)</th>';
  html += '<th>p_min (outward / suction), ' + pUnit() + '</th><th>p_max (inward / positive), ' + pUnit() + '</th></tr></thead><tbody>';
  rows.forEach(r => {
    const gcStr = dual
      ? fmt(r.gcp.neg, 2) + ' to ' + fmt(r.gcp.pos, 2)
      : fmt(r.gcpf, 2);
    html += '<tr><td>' + (ZONE_LABELS[r.zone] || r.zone) + '</td><td>' + gcStr + '</td>' +
      '<td>' + fmt(pVal(r.p.min), 2) + '</td><td>' + fmt(pVal(r.p.max), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

function renderResults() {
  const r = compute(state);

  renderSteps(r.steps);

  // Summary cards
  const setCard = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCard('cardQh', fmt(pVal(r.qh), 2) + ' ' + pUnit());
  setCard('cardKh', fmt(r.kh, 3));
  setCard('cardKe', fmt(r.ke, 3));
  setCard('cardGCpi', '±' + fmt(r.gcpi.pos, 2));
  setCard('cardA', fmt(lengthOut(r.a), 2) + ' ' + (state.unitSystem === 'SI' ? 'm' : 'ft'));

  // MWFRS tables
  zoneTable('mwfrsLC1Table', r.mwfrsLC1, false);
  zoneTable('mwfrsLC2Table', r.mwfrsLC2, false);

  const torsionNote = document.getElementById('torsionNote');
  const torsionDetails = document.getElementById('torsionDetails');
  const torsionToggle = document.getElementById('torsionToggle');
  if (torsionNote) {
    torsionNote.textContent = r.torsionApplies
      ? 'Mean roof height h = ' + fmt(lengthOut(state.h), 1) + ' ' + (state.unitSystem === 'SI' ? 'm' : 'ft') + ' > 30 ft → Load Cases 3 and 4 (Fig. 28.3-2) are required unless one of the exceptions in Sec. 28.3.2 applies (e.g., torsional sensitivity not significant per ASCE 7 Ch. 26 criteria).'
      : 'Mean roof height h ≤ 30 ft — torsional Load Cases 3 and 4 (Fig. 28.3-2) are not required for this building per Sec. 28.3.2.';
  }
  if (torsionDetails && torsionToggle) {
    const show = r.torsionApplies || torsionExpanded;
    torsionDetails.style.display = show ? '' : 'none';
    torsionToggle.style.display = r.torsionApplies ? 'none' : '';
    torsionToggle.textContent = torsionExpanded ? 'Hide T-zone pressures' : 'Show T-zone pressures for reference';
  }
  zoneTable('mwfrsLC3Table', r.mwfrsLC3, false);
  zoneTable('mwfrsLC4Table', r.mwfrsLC4, false);

  // C&C tables
  zoneTable('ccWallTable', r.ccWall, true);
  const roofNote = document.getElementById('ccRoofNote');
  if (roofNote) {
    roofNote.style.display = r.roofApplicable ? 'none' : '';
  }
  zoneTable('ccRoofTable', r.ccRoof, true);

  renderDiagram(r);
  renderPrintCover();
}

function renderPrintCover() {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('printProjectName', state.projectName || '—');
  setTxt('printProjectNumber', state.projectNumber || '—');
  setTxt('printEngineer', state.engineer || '—');
  setTxt('printProjectDate', state.projectDate
    ? new Date(state.projectDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—');
  setTxt('printRiskCategory', state.riskCategory || '—');
  setTxt('printMode', state.mode === 'mwfrs'
    ? 'Main Wind Force Resisting System (MWFRS), Envelope Procedure (Ch. 28)'
    : 'Components & Cladding (Ch. 30)');
}

/* =====================================================================
   BUILDING SCHEMATIC (SVG)
   Pure geometric schematic of the inputs (h, theta, roofType, minDim,
   enclosure). Does NOT attempt to reproduce the pressure-zone polygons
   of Figures 28.3-1 / 30.3-1 / 30.3-2A (those have figure-specific
   shapes that vary by zone and are not redrawn here to avoid
   misrepresenting the code figures). The edge-zone width "a" shown is
   the same value computed in Step "a" below (Notation, Figs.
   28.3-1/30.3-1/30.3-2A) and reported in the C&C / MWFRS tables.
   ===================================================================== */
function renderDiagram(r) {
  const elev = document.getElementById('elevSvg');
  const plan = document.getElementById('planSvg');
  const note = document.getElementById('enclosureNote');
  if (!elev || !plan) return;

  const hFt = Math.max(state.h, 0);
  const theta = Math.max(state.theta, 0);

  // ---- Elevation -------------------------------------------------------
  const groundY = 170;
  const wallL = 60, wallR = 220; // wall x-extents
  const meanHpx = Math.min(110, Math.max(10, hFt * 1.8));
  const risePx = Math.min(70, ((wallR - wallL) / 2) * Math.tan(theta * Math.PI / 180));
  const eaveHpx = Math.max(2, meanHpx - risePx / 2);
  const ridgeHpx = meanHpx + risePx / 2;
  const eaveY = groundY - eaveHpx;
  const ridgeY = groundY - ridgeHpx;
  const midX = (wallL + wallR) / 2;

  let elevSvg = '';
  // ground hatching
  elevSvg += `<line x1="20" y1="${groundY}" x2="260" y2="${groundY}" stroke="var(--ink)" stroke-width="1.5"/>`;
  for (let x = 20; x < 260; x += 10) {
    elevSvg += `<line x1="${x}" y1="${groundY}" x2="${x - 6}" y2="${groundY + 6}" stroke="var(--line)" stroke-width="1"/>`;
  }
  // walls
  elevSvg += `<rect x="${wallL}" y="${eaveY}" width="${wallR - wallL}" height="${groundY - eaveY}" fill="var(--brand-light)" stroke="var(--brand)" stroke-width="1.5"/>`;
  // roof
  if (risePx > 0.5) {
    elevSvg += `<polygon points="${wallL},${eaveY} ${midX},${ridgeY} ${wallR},${eaveY}" fill="var(--accent)" fill-opacity="0.25" stroke="var(--brand)" stroke-width="1.5"/>`;
  } else {
    elevSvg += `<line x1="${wallL}" y1="${eaveY}" x2="${wallR}" y2="${eaveY}" stroke="var(--brand)" stroke-width="2"/>`;
  }
  // mean roof height dimension line (h)
  const dimX = 35;
  elevSvg += `<line x1="${dimX}" y1="${groundY}" x2="${dimX}" y2="${groundY - meanHpx}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3,2"/>`;
  elevSvg += `<line x1="${dimX - 4}" y1="${groundY}" x2="${dimX + 4}" y2="${groundY}" stroke="var(--muted)" stroke-width="1"/>`;
  elevSvg += `<line x1="${dimX - 4}" y1="${groundY - meanHpx}" x2="${dimX + 4}" y2="${groundY - meanHpx}" stroke="var(--muted)" stroke-width="1"/>`;
  elevSvg += `<text x="${dimX - 6}" y="${groundY - meanHpx / 2}" font-size="9" fill="var(--muted)" text-anchor="end" dominant-baseline="middle">h = ${fmt(lengthOut(hFt), 1)} ${state.unitSystem === 'SI' ? 'm' : 'ft'}</text>`;
  // theta label
  if (risePx > 0.5) {
    elevSvg += `<text x="${midX}" y="${ridgeY - 6}" font-size="9" fill="var(--ink)" text-anchor="middle">&#952; = ${fmt(theta, 1)}&deg;</text>`;
  }
  // wind arrow
  elevSvg += `<line x1="6" y1="${groundY - 30}" x2="${wallL - 6}" y2="${groundY - 30}" stroke="var(--accent)" stroke-width="2" marker-end="url(#arrowElev)"/>`;
  elevSvg += `<text x="6" y="${groundY - 36}" font-size="9" fill="var(--accent)">Wind</text>`;
  elevSvg += `<defs><marker id="arrowElev" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--accent)"/></marker></defs>`;
  // roof type label
  elevSvg += `<text x="${midX}" y="14" font-size="9" fill="var(--muted)" text-anchor="middle">${state.roofType === 'flat' ? 'Flat / low-slope roof (&theta; &le; 7&deg;)' : 'Sloped roof'}</text>`;
  elev.innerHTML = elevSvg;

  // ---- Plan -------------------------------------------------------------
  const px0 = 40, py0 = 40, pw = 200, ph = 120;
  const minDimFt = Math.max(state.minDim, 0.001);
  const aFt = r.a || 0;
  const aPx = Math.min(60, Math.max(6, (aFt / minDimFt) * pw));

  let planSvg = '';
  planSvg += `<rect x="${px0}" y="${py0}" width="${pw}" height="${ph}" fill="var(--brand-light)" stroke="var(--brand)" stroke-width="1.5"/>`;
  // ridge line for sloped roofs
  if (risePx > 0.5) {
    planSvg += `<line x1="${px0}" y1="${py0 + ph / 2}" x2="${px0 + pw}" y2="${py0 + ph / 2}" stroke="var(--brand)" stroke-width="1" stroke-dasharray="4,3"/>`;
    planSvg += `<text x="${px0 + pw - 4}" y="${py0 + ph / 2 - 4}" font-size="8" fill="var(--muted)" text-anchor="end">ridge</text>`;
  }
  // edge-zone inset (width a), all four sides
  planSvg += `<rect x="${px0 + aPx}" y="${py0 + aPx}" width="${pw - 2 * aPx}" height="${ph - 2 * aPx}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3,2"/>`;
  planSvg += `<text x="${px0 + aPx + 3}" y="${py0 + aPx + 11}" font-size="8" fill="var(--accent)">a = ${fmt(lengthOut(aFt), 2)} ${state.unitSystem === 'SI' ? 'm' : 'ft'}</text>`;
  // least horizontal dimension label
  planSvg += `<line x1="${px0}" y1="${py0 + ph + 8}" x2="${px0 + pw}" y2="${py0 + ph + 8}" stroke="var(--muted)" stroke-width="1"/>`;
  planSvg += `<line x1="${px0}" y1="${py0 + ph + 4}" x2="${px0}" y2="${py0 + ph + 12}" stroke="var(--muted)" stroke-width="1"/>`;
  planSvg += `<line x1="${px0 + pw}" y1="${py0 + ph + 4}" x2="${px0 + pw}" y2="${py0 + ph + 12}" stroke="var(--muted)" stroke-width="1"/>`;
  planSvg += `<text x="${px0 + pw / 2}" y="${py0 + ph + 22}" font-size="9" fill="var(--muted)" text-anchor="middle">least horiz. dim. = ${fmt(lengthOut(minDimFt), 1)} ${state.unitSystem === 'SI' ? 'm' : 'ft'}</text>`;
  // wind arrow
  planSvg += `<line x1="6" y1="${py0 + ph / 2}" x2="${px0 - 6}" y2="${py0 + ph / 2}" stroke="var(--accent)" stroke-width="2" marker-end="url(#arrowPlan)"/>`;
  planSvg += `<text x="6" y="${py0 + ph / 2 - 6}" font-size="9" fill="var(--accent)">Wind</text>`;
  planSvg += `<defs><marker id="arrowPlan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--accent)"/></marker></defs>`;
  plan.innerHTML = planSvg;

  // ---- Enclosure note ----------------------------------------------------
  if (note) {
    const g = GCPI[state.enclosure];
    note.textContent = 'Enclosure classification: ' + (g ? g.label : state.enclosure) +
      ' — (GC_pi) = ±' + fmt(g ? g.pos : 0, 2) + ' (Table 26.13-1). Procedure shown: ' +
      (state.mode === 'mwfrs' ? 'MWFRS, Envelope Procedure (Ch. 28)' : 'Components & Cladding (Ch. 30)') + '.';
  }
}

/* =====================================================================
   INPUT BINDING
   ===================================================================== */
function bindInputs() {
  document.getElementById('V').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.V = toUSSpeed(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });
  document.getElementById('exposure').addEventListener('change', e => {
    state.exposure = e.target.value;
    renderResults();
  });
  document.getElementById('kzt').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.kzt = isNaN(v) ? 1.0 : v;
    renderResults();
  });
  document.getElementById('groundElev').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.groundElev = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });
  document.getElementById('enclosure').addEventListener('change', e => {
    state.enclosure = e.target.value;
    renderResults();
  });
  document.getElementById('h').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.h = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });
  document.getElementById('minDim').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.minDim = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });
  document.getElementById('theta').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.theta = isNaN(v) ? 0 : v;
    renderResults();
  });
  document.getElementById('areaWall').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.areaWall = toUSArea(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });
  document.getElementById('areaRoof').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.areaRoof = toUSArea(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });

  // Unit toggle
  document.getElementById('unitSI').addEventListener('click', () => setUnitSystem('SI'));
  document.getElementById('unitUS').addEventListener('click', () => setUnitSystem('US'));

  // Calculation procedure mode toggle (MWFRS / C&C)
  document.getElementById('modeMWFRS').addEventListener('click', () => setMode('mwfrs'));
  document.getElementById('modeCC').addEventListener('click', () => setMode('cc'));

  // Roof type (progressive disclosure of theta input)
  document.getElementById('roofType').addEventListener('change', e => {
    state.roofType = e.target.value;
    if (state.roofType === 'flat') {
      state.theta = 0;
      document.getElementById('theta').value = 0;
    }
    applyRoofTypeVisibility();
    renderResults();
  });

  // Torsional T-zone reference toggle (progressive disclosure when h <= 30 ft)
  const torsionToggle = document.getElementById('torsionToggle');
  if (torsionToggle) {
    torsionToggle.addEventListener('click', () => {
      torsionExpanded = !torsionExpanded;
      renderResults();
    });
  }

  // Project Information (report header) — informational only
  document.getElementById('projectName').addEventListener('input', e => {
    state.projectName = e.target.value;
    renderResults();
  });
  document.getElementById('projectNumber').addEventListener('input', e => {
    state.projectNumber = e.target.value;
    renderResults();
  });
  document.getElementById('engineer').addEventListener('input', e => {
    state.engineer = e.target.value;
    renderResults();
  });
  document.getElementById('projectDate').addEventListener('input', e => {
    state.projectDate = e.target.value;
    renderResults();
  });
  document.getElementById('riskCategory').addEventListener('change', e => {
    state.riskCategory = e.target.value;
    renderResults();
  });
}

/* =====================================================================
   MODE / PROGRESSIVE DISCLOSURE
   ===================================================================== */
function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  applyModeVisibility();
  renderResults();
}

function applyModeVisibility() {
  document.body.classList.toggle('mode-mwfrs', state.mode === 'mwfrs');
  document.body.classList.toggle('mode-cc', state.mode === 'cc');
  const m = document.getElementById('modeMWFRS');
  const c = document.getElementById('modeCC');
  if (m) m.classList.toggle('active', state.mode === 'mwfrs');
  if (c) c.classList.toggle('active', state.mode === 'cc');
}

function applyRoofTypeVisibility() {
  const f = document.getElementById('thetaField');
  if (f) f.style.display = state.roofType === 'flat' ? 'none' : '';
}

function updateUnitLabels() {
  const sys = state.unitSystem;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('lblV', sys === 'SI' ? 'm/s' : 'mph');
  set('lblGroundElev', sys === 'SI' ? 'm' : 'ft');
  set('lblH', sys === 'SI' ? 'm' : 'ft');
  set('lblMinDim', sys === 'SI' ? 'm' : 'ft');
  set('lblAreaWall', sys === 'SI' ? 'm²' : 'ft²');
  set('lblAreaRoof', sys === 'SI' ? 'm²' : 'ft²');
}

function setUnitSystem(sys) {
  if (state.unitSystem === sys) return;
  state.unitSystem = sys;

  document.getElementById('unitSI').classList.toggle('active', sys === 'SI');
  document.getElementById('unitUS').classList.toggle('active', sys === 'US');

  document.getElementById('V').value = fmt(speedOut(state.V), 1);
  document.getElementById('groundElev').value = fmt(lengthOut(state.groundElev), 1);
  document.getElementById('h').value = fmt(lengthOut(state.h), 2);
  document.getElementById('minDim').value = fmt(lengthOut(state.minDim), 2);
  document.getElementById('areaWall').value = fmt(areaOut(state.areaWall), 2);
  document.getElementById('areaRoof').value = fmt(areaOut(state.areaRoof), 2);

  updateUnitLabels();
  renderResults();
}

/* =====================================================================
   "LEARN MORE" INFO MODAL
   Every entry cites the exact clause, table, equation, or figure of
   ASCE/SEI 7-22 it reflects — see the Sources footer in index.html.
   ===================================================================== */
const INFO_CONTENT = {
  V: {
    title: 'Basic Wind Speed, V — Sec. 26.5',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 26.5</span> &mdash; the basic wind speed V is a 3-second gust speed at 33 ft (10 m) above ground in Exposure C, associated with a Risk-Category-dependent mean recurrence interval (MRI). It is read from <strong>Figures 26.5-1A&ndash;D</strong> (Risk Category II, III/IV, and I) for the project location.</p>
    <p>Use the official <a href="https://ascehazardtool.org" target="_blank" rel="noopener">ASCE 7 Hazard Tool</a> (ascehazardtool.org) for your site coordinates and Risk Category, and enter the resulting V here. This calculator does not look V up automatically &mdash; the Hazard Tool API requires a registered ASCE account/API key.</p>`
  },
  exposure: {
    title: 'Exposure Category — Sec. 26.7',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 26.7.2</span> defines the exposure categories used to determine K_z/K_h from Table 26.10-1:</p>
    <ul>
      <li><strong>B</strong> &mdash; Urban and suburban areas, wooded areas, or other terrain with numerous closely spaced obstructions having the size of single-family dwellings or larger.</li>
      <li><strong>C</strong> &mdash; Open terrain with scattered obstructions having heights generally less than 30 ft, including flat open country and grasslands.</li>
      <li><strong>D</strong> &mdash; Flat, unobstructed areas and water surfaces. Includes smooth mud flats, salt flats, and unbroken ice.</li>
    </ul>
    <p>The exposure category is determined for the direction(s) from which the wind blows, per <span class="src-tag">Sec. 26.7.3</span> (surface roughness in an upwind sector of 45&deg; and a distance of 1,500 ft or 10&times;h, whichever is greater).</p>`
  },
  kzt: {
    title: 'Topographic Factor, K_zt — Sec. 26.8',
    html: `<p><span class="src-tag">Sec. 26.8.1</span> &mdash; wind speed-up over isolated hills, ridges, and escarpments shall be included in the design when the site conditions and structure location meet all of the conditions listed (e.g., the hill/ridge/escarpment is isolated, H/L<sub>h</sub> &ge; 0.2, and the structure is located within the distances specified in Fig. 26.8-1).</p>
    <p>If those conditions are <strong>not</strong> met, <span class="src-tag">K_zt = 1.0</span>.</p>
    <p>If they are met, <span class="src-tag">Eq. 26.8-1</span>: K_zt = (1 + K<sub>1</sub>K<sub>2</sub>K<sub>3</sub>)&sup2;, with K<sub>1</sub>, K<sub>2</sub>, K<sub>3</sub> read from <span class="src-tag">Fig. 26.8-1</span> based on hill shape, height H, horizontal distance from the crest x, and height above ground z. This calculator does not reproduce Fig. 26.8-1 &mdash; enter the resulting K_zt directly.</p>`
  },
  groundElev: {
    title: 'Ground Elevation Factor, K_e — Sec. 26.9, Table 26.9-1',
    html: `<p><span class="src-tag">Table 26.9-1, Note 2</span> &mdash; K_e = exp(-0.0000362 z_e), where z_e is the ground elevation above sea level at the building site, in feet.</p>
    <p><span class="src-tag">Table 26.9-1, Note 1</span> permits K_e = 1.0 to be used for any elevation (conservative). Enter z_e = 0 to force K_e = 1.0.</p>`
  },
  enclosure: {
    title: 'Enclosure Classification & (GC_pi) — Sec. 26.2 & Table 26.13-1',
    html: `<p>Building enclosure classification is determined per the definitions of <span class="src-tag">Sec. 26.2</span> (Enclosed, Partially Enclosed, Partially Open, Open Buildings), based on the area of openings in the building envelope relative to wall/roof area.</p>
    <p><span class="src-tag">Table 26.13-1</span> &mdash; Internal Pressure Coefficient, (GC_pi):</p>
    <ul>
      <li>Open Buildings: (GC_pi) = 0.00</li>
      <li>Partially Open Buildings: (GC_pi) = &plusmn;0.18</li>
      <li>Enclosed Buildings: (GC_pi) = &plusmn;0.18</li>
      <li>Partially Enclosed Buildings: (GC_pi) = &plusmn;0.55</li>
    </ul>
    <p>Both signs must be evaluated (<span class="src-tag">Table 26.13-1, Note 1</span>); this calculator pairs each (GC_pf)/(GC_p) value with whichever (GC_pi) sign produces the larger-magnitude net pressure.</p>`
  },
  riskCategory: {
    title: 'Risk Category',
    html: `<p>Risk Category (I, II, III, or IV) is assigned per <span class="src-tag">Table 1.5-1</span> based on the building's occupancy/use. It is recorded here for the report header and does not feed into this module's calculations directly — its effect is already embedded in the basic wind speed V you enter.</p>
    <p>Per <span class="src-tag">Sec. 26.5.1</span>, the wind speed maps of <span class="src-tag">Figures 26.5-1A–D</span> are keyed to Risk Category (each map corresponds to a target annual probability of exceedance / mean recurrence interval appropriate to that category). Use the <a href="https://ascehazardtool.org" target="_blank" rel="noopener">ASCE 7 Hazard Tool</a> with your project's Risk Category to obtain the correct V for the "Basic Wind Speed" field above.</p>`
  },
  h: {
    title: 'Mean Roof Height, h',
    html: `<p>Mean roof height h is defined in <span class="src-tag">Sec. 26.2</span> as the average of the roof eave height and the roof ridge height, except that for roof angles &le; 10&deg; the eave height may be used as h.</p>
    <p>h is used to: determine K_h (<span class="src-tag">Table 26.10-1</span>); determine applicability of the Envelope Procedure, h &le; 60 ft (<span class="src-tag">Sec. 28.3.1</span>); compute the zone dimension a (<span class="src-tag">Fig. 28.3-1</span> Notation); and determine whether torsional Load Cases 3/4 are required, h &gt; 30 ft (<span class="src-tag">Sec. 28.3.2</span>).</p>`
  },
  minDim: {
    title: 'Least Horizontal Dimension',
    html: `<p>The smaller of the two plan dimensions of the building (in any orientation). Used only to compute the zone dimension <strong>a</strong> per the Notation under <span class="src-tag">Figures 28.3-1 and 30.3-1</span>:</p>
    <p>a = min[0.1 &times; (least horizontal dimension), 0.4h], not less than max[0.04 &times; (least horizontal dimension), 3 ft].</p>
    <p><span class="src-tag">Exception</span>: for &theta; = 0&ndash;7&deg; and a least horizontal dimension &gt; 300 ft, a is capped at 0.8h.</p>`
  },
  roofType: {
    title: 'Roof Type — controls the &theta; input',
    html: `<p>This selector is a convenience for progressive input &mdash; it does not add a new code parameter. Selecting <strong>"Flat / low-slope (&theta; &le; 7&deg;)"</strong> hides the roof angle field and sets &theta; = 0, which is the governing case for <span class="src-tag">Figure 30.3-2A</span> roof C&amp;C (applicable only for &theta; &le; 7&deg;) and the &theta; = 0&ndash;5&deg; row of <span class="src-tag">Figure 28.3-1</span>.</p>
    <p>Selecting <strong>"Gable, hip, or other sloped roof"</strong> reveals the &theta; field so you can enter the actual roof angle for interpolation in <span class="src-tag">Figure 28.3-1</span> (Load Cases 1 &amp; 3). If &theta; &gt; 7&deg;, the roof C&amp;C tables (<span class="src-tag">Figure 30.3-2A</span>) do not apply &mdash; see the note above the roof C&amp;C table.</p>`
  },
  theta: {
    title: 'Roof Angle, θ',
    html: `<p>Angle of the plane of the roof from horizontal, in degrees. Used to interpolate (GC_pf) from <span class="src-tag">Figure 28.3-1</span> (Load Cases 1 &amp; 3, rows tabulated at &theta; = 0&ndash;5&deg;, 20&deg;, 30&ndash;45&deg;, 90&deg;, with linear interpolation permitted for intermediate angles) and to determine whether <span class="src-tag">Figure 30.3-2A</span> (roof C&amp;C, &theta; &le; 7&deg;) applies.</p>
    <p>For &theta; &le; 10&deg;, h may be taken as the eave height (<span class="src-tag">Sec. 26.2</span> definition of mean roof height).</p>`
  },
  areaWall: {
    title: 'Effective Wind Area — Walls (C&C), Figure 30.3-1',
    html: `<p><span class="src-tag">Sec. 26.2 definition of "Effective Wind Area"</span> &mdash; the span length of the component multiplied by an effective width that need not be less than one-third the span length (this maximizes A and minimizes the magnitude of (GC_p)).</p>
    <p><span class="src-tag">Figure 30.3-1</span> tabulates (GC_p) for wall Zones 4 and 5 at A &le; 10 ft&sup2; and A &ge; 500 ft&sup2;, with log-linear interpolation between. This calculator applies that interpolation directly.</p>`
  },
  areaRoof: {
    title: 'Effective Wind Area — Roof (C&C), Figure 30.3-2A',
    html: `<p>Same definition as the wall effective wind area (<span class="src-tag">Sec. 26.2</span>), applied to the roof component/cladding under consideration.</p>
    <p><span class="src-tag">Figure 30.3-2A</span> (gable/hip roofs, &theta; &le; 7&deg;) tabulates (GC_p) for roof Zones 1&prime;, 1, 2, and 3 at A &le; 10 ft&sup2; and A &ge; 500 ft&sup2;, with log-linear interpolation between.</p>
    <p>For &theta; &gt; 7&deg;, roof C&amp;C pressures require <span class="src-tag">Figures 30.3-2B&ndash;G</span> (not yet implemented in this calculator &mdash; see the Roadmap in the Sources footer); MWFRS results above remain valid for all &theta;.</p>`
  },
  stepsInfo: {
    title: 'Velocity Pressure — Step by Step',
    html: `<p>Every value below is computed from the inputs on the left, with the clause or equation it comes from &mdash; see "Where these formulas come from" at the bottom of this page for the full citation list.</p>`
  },
  mwfrs: {
    title: 'MWFRS — Envelope Procedure, Figure 28.3-1 / 28.3-2',
    html: `<p><span class="src-tag">Sec. 28.3, Eq. 28.3-1</span>: p = q_h K_d [(GC_pf) &minus; (GC_pi)]. Applicable to enclosed and partially enclosed buildings with h &le; 60 ft, flat/gable/hip roofs, per the conditions of <span class="src-tag">Sec. 28.3.1</span>.</p>
    <p><strong>Load Case 1</strong> (Zones 1&ndash;4, 1E&ndash;4E) is &theta;-dependent. <strong>Load Case 2</strong> (Zones 1&ndash;6, 1E&ndash;6E) is the same for all &theta;. Each load case is evaluated for all four building corners taken as the windward corner (<span class="src-tag">Sec. 28.3.2.1</span>); Zones with the "E" suffix are end-zone (edge strip) values within distance a of the corner.</p>
    <p><strong>Load Cases 3 &amp; 4</strong> (<span class="src-tag">Fig. 28.3-2</span>) add torsional "T" zones to Load Cases 1 and 2, respectively, and are required when h &gt; 30 ft unless an exception of <span class="src-tag">Sec. 28.3.2</span> applies.</p>
    <p>p_min and p_max below pair each (GC_pf) with whichever sign of (GC_pi) (Table 26.13-1) produces the larger-magnitude net pressure &mdash; both must be checked per <span class="src-tag">Table 26.13-1, Note 1</span>.</p>`
  },
  cc: {
    title: 'Components &amp; Cladding — Figure 30.3-1 / 30.3-2A',
    html: `<p><span class="src-tag">Sec. 30.3, Eq. 30.3-1</span>: p = q_h K_d [(GC_p) &minus; (GC_pi)]. Applicable to C&amp;C of enclosed and partially enclosed low-rise buildings (h &le; 60 ft) with flat, gable, hip, monoslope, or similar roofs, per <span class="src-tag">Sec. 30.3.1</span> and the conditions on Figures 30.3-1/30.3-2.</p>
    <p>(GC_p) is read from <span class="src-tag">Figure 30.3-1</span> (walls, Zones 4 &amp; 5) and <span class="src-tag">Figure 30.3-2A</span> (roof, Zones 1&prime;, 1, 2, 3, for &theta; &le; 7&deg;), as a function of the effective wind area, with log-linear interpolation between the tabulated A &le; 10 ft&sup2; and A &ge; 500 ft&sup2; values.</p>
    <p>p_min and p_max pair the negative/positive (GC_p) with whichever sign of (GC_pi) produces the larger-magnitude net pressure.</p>`
  }
};

let infoModalEl, modalContentEl;

function openInfoModal(key) {
  const entry = INFO_CONTENT[key];
  if (!entry || !infoModalEl || !modalContentEl) return;
  modalContentEl.innerHTML = '<h3>' + entry.title + '</h3>' + entry.html;
  infoModalEl.classList.add('open');
}
function closeInfoModal() {
  if (infoModalEl) infoModalEl.classList.remove('open');
}
function bindInfoModal() {
  infoModalEl = document.getElementById('infoModal');
  modalContentEl = document.getElementById('modalContent');
  if (!infoModalEl) return;

  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openInfoModal(btn.dataset.info);
    });
  });

  const closeBtn = document.getElementById('infoModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeInfoModal);

  infoModalEl.addEventListener('click', (e) => {
    if (e.target === infoModalEl) closeInfoModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInfoModal();
  });
}

/* =====================================================================
   PRINT / EXPORT REPORT
   ===================================================================== */
function bindPrintButton() {
  const btn = document.getElementById('printBtn');
  const genEl = document.getElementById('printGenerated');
  if (genEl) {
    genEl.textContent = 'Report generated ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + ' — values reflect the inputs and computed results shown below at the time of printing.';
  }
  if (btn) {
    btn.addEventListener('click', () => window.print());
  }
}

/* =====================================================================
   INIT
   ===================================================================== */
function init() {
  const expSel = document.getElementById('exposure');
  Object.keys(EXPOSURE).forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.textContent = 'Exposure ' + EXPOSURE[k].label;
    if (k === state.exposure) o.selected = true;
    expSel.appendChild(o);
  });

  const encSel = document.getElementById('enclosure');
  Object.keys(GCPI).forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.textContent = GCPI[k].label + ' (GC_pi = ±' + fmt(GCPI[k].pos, 2) + ')';
    if (k === state.enclosure) o.selected = true;
    encSel.appendChild(o);
  });

  document.getElementById('V').value = state.V;
  document.getElementById('kzt').value = state.kzt;
  document.getElementById('groundElev').value = state.groundElev;
  document.getElementById('h').value = state.h;
  document.getElementById('minDim').value = state.minDim;
  document.getElementById('theta').value = state.theta;
  document.getElementById('areaWall').value = state.areaWall;
  document.getElementById('areaRoof').value = state.areaRoof;
  document.getElementById('roofType').value = state.roofType;

  // Project Information (report header)
  if (!state.projectDate) {
    const d = new Date();
    state.projectDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  document.getElementById('projectName').value = state.projectName;
  document.getElementById('projectNumber').value = state.projectNumber;
  document.getElementById('engineer').value = state.engineer;
  document.getElementById('projectDate').value = state.projectDate;
  document.getElementById('riskCategory').value = state.riskCategory;

  updateUnitLabels();
  bindInputs();
  bindInfoModal();
  bindPrintButton();
  applyModeVisibility();
  applyRoofTypeVisibility();
  renderResults();
}

document.addEventListener('DOMContentLoaded', init);

/* =====================================================================
   STRUCTCALC SHELL BRIDGE
   Protocol:
     shell -> module: {type:'loadState', state:{...}, unitSystem?}
     shell -> module: {type:'requestState'}
     module -> shell: {type:'stateChanged', module:'windASCE', state:{...}, unitSystem}
   ===================================================================== */
(function () {
  function snapshotState() {
    try { return JSON.parse(JSON.stringify(state)); } catch (e) { return null; }
  }

  function postState() {
    if (window.parent === window) return; // not embedded
    window.parent.postMessage({ type: 'stateChanged', module: 'windASCE', state: snapshotState() }, '*');
  }

  function applyState(newState) {
    if (!newState) return;
    Object.assign(state, newState);

    document.getElementById('V').value = fmt(speedOut(state.V), 1);
    document.getElementById('exposure').value = state.exposure;
    document.getElementById('kzt').value = state.kzt;
    document.getElementById('groundElev').value = fmt(lengthOut(state.groundElev), 1);
    document.getElementById('enclosure').value = state.enclosure;
    document.getElementById('h').value = fmt(lengthOut(state.h), 2);
    document.getElementById('minDim').value = fmt(lengthOut(state.minDim), 2);
    document.getElementById('theta').value = state.theta;
    document.getElementById('areaWall').value = fmt(areaOut(state.areaWall), 2);
    document.getElementById('areaRoof').value = fmt(areaOut(state.areaRoof), 2);
    document.getElementById('roofType').value = state.roofType || (state.theta > 7 ? 'sloped' : 'flat');
    state.roofType = document.getElementById('roofType').value;

    // Project Information (report header)
    if (!state.projectDate) {
      const d = new Date();
      state.projectDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    document.getElementById('projectName').value = state.projectName || '';
    document.getElementById('projectNumber').value = state.projectNumber || '';
    document.getElementById('engineer').value = state.engineer || '';
    document.getElementById('projectDate').value = state.projectDate;
    document.getElementById('riskCategory').value = state.riskCategory || 'II';

    document.getElementById('unitSI').classList.toggle('active', state.unitSystem === 'SI');
    document.getElementById('unitUS').classList.toggle('active', state.unitSystem === 'US');

    applyModeVisibility();
    applyRoofTypeVisibility();
    updateUnitLabels();
    renderResults();
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'loadState') {
      applyState(msg.state);
      if (msg.unitSystem) setUnitSystem(msg.unitSystem);
    } else if (msg.type === 'requestState') {
      postState();
    }
  });

  const origRender = renderResults;
  renderResults = function () {
    origRender();
    postState();
  };
})();
