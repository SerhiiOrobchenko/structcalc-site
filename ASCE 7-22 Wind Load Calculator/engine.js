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
  open: { pos: 0.0, neg: 0.0, label: 'Open' },
  // Open Building with monoslope/pitched/troughed free roof — Sec. 27.3.2,
  // Eq. 27.3-2: p = q_h K_d G C_N. This procedure does not use (GC_pi) at
  // all (C_N is already a net pressure coefficient), so `noGcpi` suppresses
  // the (GC_pi) display/selection for this option (see init()).
  openFreeRoof: { pos: 0.0, neg: 0.0, label: 'Open Building — Free Roof (Sec. 27.3.2)', noGcpi: true }
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

// Figures 30.3-2B (gable, 7° < theta <= 20°) and 30.3-2C (gable, 20° < theta <= 27°)
// Roof Zones 1, 2, 3 — GCp vs effective wind area A (sf), log-linear A=Alo..Ahi (Ahi is
// zone- and sign-specific). Alo = 10 sf for all zones/signs in both figures.
//
// SOURCE: digitized from the user's Calcs.com (ClearCalcs) "ASCE 7-22 Wind Loads — C&C"
// calculator GCp+ / GCp- formula listing (log10-interpolation A_w,low/A_w,up breakpoints
// and GCp,min/GCp,max endpoints), cross-validated 6/6 against explicit printed value
// labels read directly from the Fig. 30.3-2B raster image (Zone 1 hi=-0.5, Zone 2 hi=-1.0,
// Zone 3 hi=-1.8, Zone 2 lo=-2.7, GCp+ hi=+0.3, and the Alo=10/Ahi breakpoints) — see
// task #78 research notes. Fig. 30.3-2C (20°-27°) values come from the same Calcs.com
// listing's 20°<theta<=27° branch (not independently cross-checked against a raster
// label, since 7°<theta<=20° was the band used for cross-validation).
const GCP_ROOF_GABLE = {
  Alo: 10,
  maxTheta: 27, // figures do not extend past 27°; theta > 27° is capped at the 2C (20°-27°) values
  bands: [
    { // Fig. 30.3-2B, 7° < theta <= 20°
      thetaMax: 20, fig: '30.3-2B',
      '1': { neg: { lo: -2.0, hi: -0.5, Ahi: 300 }, pos: { lo: 0.6, hi: 0.3, Ahi: 200 } },
      '2': { neg: { lo: -2.7, hi: -1.0, Ahi: 200 }, pos: { lo: 0.6, hi: 0.3, Ahi: 200 } },
      '3': { neg: { lo: -3.6, hi: -1.8, Ahi: 100 }, pos: { lo: 0.6, hi: 0.3, Ahi: 200 } }
    },
    { // Fig. 30.3-2C, 20° < theta <= 27°
      thetaMax: 27, fig: '30.3-2C',
      '1': { neg: { lo: -1.5, hi: -0.8, Ahi: 200 }, pos: { lo: 0.6, hi: 0.3, Ahi: 200 } },
      '2': { neg: { lo: -2.5, hi: -1.2, Ahi: 100 }, pos: { lo: 0.6, hi: 0.3, Ahi: 200 } },
      '3': { neg: { lo: -3.0, hi: -1.4, Ahi: 100 }, pos: { lo: 0.6, hi: 0.3, Ahi: 200 } }
    }
  ]
};

// Figures 30.3-2D-2G (hip roof, 7° < theta <= 45°), Roof Zones 1, 2, 3 — GCp vs effective
// wind area A (sf), log-linear A=Alo..Ahi. Alo = 10 sf throughout; positive GCp is shared
// across all zones and all theta > 7° (Ahi = 100 sf).
//
// SOURCE: same Calcs.com (ClearCalcs) GCp+ / GCp- formula listing as GCP_ROOF_GABLE above
// (task #79 research notes). Bands for 7°<theta<=10° and 10°<theta<=20° are identical for
// zones 1-3 per the listing, so they are combined into a single 7°-20° band here. The
// 27°<theta<=45° band is not tabulated directly in the listing as fixed endpoints; per the
// Calcs.com formula it is obtained by linear interpolation between the 20°<theta<=27°
// values (band45From below) and the theta=45° endpoint values (band45 below).
const GCP_ROOF_HIP = {
  Alo: 10,
  maxTheta: 45, // theta > 45° is capped at the theta=45° endpoint values
  pos: { lo: 0.7, hi: 0.3, Ahi: 100 }, // shared for all zones, all theta > 7°
  bands: [
    { // Figs. 30.3-2D/2E equivalent, 7° < theta <= 20° (7°-10° and 10°-20° bands are identical for zones 1-3)
      thetaMax: 20,
      '1': { neg: { lo: -1.8, hi: -0.8, Ahi: 200 } },
      '2': { neg: { lo: -2.4, hi: -1.3, Ahi: 200 } },
      '3': { neg: { lo: -2.6, hi: -1.4, Ahi: 200 } }
    },
    { // Fig. 30.3-2F equivalent, 20° < theta <= 27°
      thetaMax: 27,
      '1': { neg: { lo: -1.4, hi: -0.8, Ahi: 100 } },
      '2': { neg: { lo: -2.0, hi: -1.0, Ahi: 100 } },
      '3': { neg: { lo: -2.0, hi: -1.0, Ahi: 100 } }
    }
  ],
  // Fig. 30.3-2G equivalent, theta = 45° endpoint — used with bands[1] (theta=27° values)
  // as the two ends of a linear interpolation for 27° < theta <= 45°.
  band45: {
    '1': { neg: { lo: -1.5, hi: -0.7, Ahi: 100 } },
    '2': { neg: { lo: -1.8, hi: -0.8, Ahi: 100 } },
    '3': { neg: { lo: -2.4, hi: -1.0, Ahi: 100 } }
  }
};

/* =====================================================================
   OPEN BUILDINGS WITH FREE ROOFS — Sec. 27.3.2, Eq. 27.3-2
   p = q_h K_d G C_N
   G  = Gust-Effect Factor, Sec. 26.11. This calculator uses G = 0.85 for
        rigid structures (Sec. 26.11.1). The flexible-structure G_f
        procedure (Sec. 26.11.3-26.11.5, requires fundamental natural
        frequency) is NOT implemented — verify directly if the structure's
        natural frequency is below 1 Hz.
   C_N = Net pressure coefficient, Figs. 27.3-4 (monoslope), 27.3-5
        (pitched), 27.3-6 (troughed), or 27.3-7 (gamma=90/270, all shapes).
   ===================================================================== */
const G_RIGID = 0.85; // Sec. 26.11.1, rigid structures

// Figure 27.3-4 — Monoslope free roof (0.25 <= h/L <= 1.0, theta <= 45 deg),
// gamma = 0 deg and gamma = 180 deg tabulated separately. The "theta < 7.5
// deg" row is a single flat value shared by gamma = 0/180 (Note: identical
// across both gamma columns in the printed figure) — see CN_MONOSLOPE_FLAT.
// Linear interpolation permitted for 7.5 <= theta <= 45 deg (Note 3).
// Note 4: for 0.05 <= h/L < 0.25 and theta < 5 deg, use Figure 27.3-7 instead.
// SOURCE: pdftotext -layout extraction of PDF p.348 (printed p.287),
// Figure 27.3-4 full table (re-verified this session, all values).
const CN_MONOSLOPE_FLAT = { // theta < 7.5 deg, identical for gamma = 0 and 180 deg
  A: { clear: { CNW: 1.2, CNL: 0.3 }, obstr: { CNW: -0.5, CNL: -1.2 } },
  B: { clear: { CNW: -1.1, CNL: -0.1 }, obstr: { CNW: -1.1, CNL: -0.6 } }
};
const CN_MONOSLOPE = {
  thetas: [7.5, 15, 22.5, 30, 37.5, 45],
  gamma0: {
    A: {
      clear: { CNW: [-0.6, -0.9, -1.5, -1.8, -1.8, -1.6], CNL: [-1.0, -1.3, -1.6, -1.8, -1.8, -1.8] },
      obstr: { CNW: [-1.0, -1.1, -1.5, -1.5, -1.5, -1.3], CNL: [-1.5, -1.5, -1.7, -1.8, -1.8, -1.8] }
    },
    B: {
      clear: { CNW: [-1.4, -1.9, -2.4, -2.5, -2.4, -2.3], CNL: [0.0, 0.0, -0.3, -0.5, -0.6, -0.7] },
      obstr: { CNW: [-1.7, -2.1, -2.3, -2.3, -2.2, -1.9], CNL: [-0.8, -0.6, -0.9, -1.1, -1.1, -1.2] }
    }
  },
  gamma180: {
    A: {
      clear: { CNW: [0.9, 1.3, 1.7, 2.1, 2.1, 2.2], CNL: [1.5, 1.6, 1.8, 2.1, 2.2, 2.5] },
      obstr: { CNW: [-0.2, 0.4, 0.5, 0.6, 0.7, 0.8], CNL: [-1.2, -1.1, -1.0, -1.0, -0.9, -0.9] }
    },
    B: {
      clear: { CNW: [1.6, 1.8, 2.2, 2.6, 2.7, 2.6], CNL: [0.3, 0.6, 0.7, 1.0, 1.1, 1.4] },
      obstr: { CNW: [0.8, 1.2, 1.3, 1.6, 1.9, 2.1], CNL: [-0.3, -0.3, 0.0, 0.1, 0.3, 0.4] }
    }
  }
};

// Figure 27.3-5 — Pitched free roof (theta <= 45 deg), gamma = 0 deg and
// 180 deg share a single symmetric table. The figure does not tabulate a
// "theta < 7.5 deg" row — rows start at theta = 7.5 deg. theta < 7.5 deg is
// clamped to the 7.5 deg row by lerpTheta and flagged in the UI (whether
// Fig. 27.3-4's Note 4 substitution of Fig. 27.3-7 also applies to Figs.
// 27.3-5/27.3-6 for theta < 5 deg is NOT confirmed — flagged as engineering
// judgment if relied upon).
// SOURCE: direct image read of fig275_table.png (verified this session,
// all 8 value arrays).
const CN_PITCHED = {
  thetas: [7.5, 15, 22.5, 30, 37.5, 45],
  A: {
    clear: { CNW: [1.1, 1.1, 1.1, 1.3, 1.3, 1.1], CNL: [-0.3, -0.4, 0.1, 0.3, 0.6, 0.9] },
    obstr: { CNW: [-1.6, -1.2, -1.2, -0.7, -0.6, -0.5], CNL: [-1.0, -1.0, -1.2, -0.7, -0.6, -0.5] }
  },
  B: {
    clear: { CNW: [0.2, 0.1, -0.1, -0.1, -0.2, -0.3], CNL: [-1.2, -1.1, -0.8, -0.9, -0.6, -0.5] },
    obstr: { CNW: [-0.9, -0.6, -0.8, -0.2, -0.3, -0.3], CNL: [-1.7, -1.6, -1.7, -1.1, -0.9, -0.7] }
  }
};

// Figure 27.3-6 — Troughed free roof (theta <= 45 deg), gamma = 0 deg and
// 180 deg share a single symmetric table; same row structure as Fig. 27.3-5
// (rows start at theta = 7.5 deg, no "theta < 7.5 deg" row).
// SOURCE: direct image read of fig276_table.png (verified this session).
const CN_TROUGHED = {
  thetas: [7.5, 15, 22.5, 30, 37.5, 45],
  A: {
    clear: { CNW: [-1.1, -1.1, -1.1, -1.3, -1.3, -1.1], CNL: [0.3, 0.4, -0.1, -0.3, -0.6, -0.9] },
    obstr: { CNW: [-1.6, -1.2, -1.2, -1.4, -1.4, -1.2], CNL: [-0.5, -0.5, -0.6, -0.2, -0.3, -0.3] }
  },
  B: {
    clear: { CNW: [-0.2, 0.1, -0.1, 0.1, 0.2, 0.3], CNL: [1.2, 1.1, 0.8, 0.9, 0.6, 0.5] },
    obstr: { CNW: [-0.9, -0.6, -0.8, -0.2, -0.3, -0.3], CNL: [-0.8, -0.8, -0.8, -0.5, -0.4, -0.4] }
  }
};

// Figure 27.3-7 — Open buildings, all roof shapes (monoslope, pitched, or
// troughed), theta <= 45 deg, gamma = 90/270 deg (wind parallel to
// ridge/valley), applies for all h/L. Three zones by horizontal distance
// from the windward edge: <= h, > h to <= 2h, > 2h. Single C_N per zone/load
// case (no C_NW/C_NL split). Also governs Fig. 27.3-4 Note 4 (monoslope,
// theta < 5 deg, 0.05 <= h/L < 0.25).
// SOURCE: direct image read of fig277_table.png (verified this session).
const CN_FIG277 = {
  zoneKeys: ['le_h', 'h_2h', 'gt_2h'],
  zoneLabels: { le_h: '≤ h from windward edge', h_2h: '> h to ≤ 2h', gt_2h: '> 2h' },
  A: { clear: [-0.8, -0.6, -0.3], obstr: [-1.2, -0.9, -0.6] },
  B: { clear: [0.8, 0.5, 0.3], obstr: [0.5, 0.5, 0.3] }
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
  roofShape: 'gable', // 'gable' or 'hip' — selects Fig. 30.3-2B/2C vs 2D-2G for theta>7 roof C&C
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
  hasOverhang: false, // Sec. 30.7 — building has roof overhangs requiring overhang C&C pressures
  hasParapet: false, // Sec. 27.3.4 (MWFRS) / Sec. 30.9 (C&C) — building has a parapet
  parapetHeight: 3,  // height of parapet above the roof surface, ft (used to compute q_p at top of parapet)

  // Open Building — Free Roof (Sec. 27.3.2), only used when enclosure === 'openFreeRoof'
  openRoofShape: 'monoslope', // 'monoslope' | 'pitched' | 'troughed' — Figs. 27.3-4/5/6
  openWindFlow: 'clear',      // 'clear' | 'obstructed' — Figs. 27.3-4/5/6/7 Note 2
  openL: 40,                  // horizontal roof dimension in the along-wind direction, L, ft (Fig. 27.3-4 Notation)

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

// Roof C&C for theta > 7 deg, zones 1/2/3 only (no zone 1' on Figs. 30.3-2B-G).
// roofShape: 'gable' -> Figs. 30.3-2B (7°-20°) / 2C (20°-27°); 'hip' -> Figs. 30.3-2D-G
// equivalent (7°-20° / 20°-27° / 27°-45° interpolated). theta beyond the figure's range
// (27° gable, 45° hip) is capped at the last band's values and flagged via `capped`.
function gcpRoofSloped(zone, A, theta, roofShape) {
  const Alo = GCP_ROOF_GABLE.Alo; // = 10 sf for both gable and hip tables
  let capped = false;
  let negDef, posDef;

  if (roofShape === 'hip') {
    const t = GCP_ROOF_HIP;
    posDef = t.pos;
    if (theta <= 20) {
      negDef = t.bands[0][zone].neg;
    } else if (theta <= 27) {
      negDef = t.bands[1][zone].neg;
    } else {
      const th = Math.min(theta, 45);
      if (theta > 45) capped = true;
      const b27 = t.bands[1][zone].neg;
      const b45 = t.band45[zone].neg;
      const f = (th - 27) / (45 - 27);
      negDef = {
        lo: b27.lo + f * (b45.lo - b27.lo),
        hi: b27.hi + f * (b45.hi - b27.hi),
        Ahi: b27.Ahi // = 100 for both endpoints
      };
    }
  } else {
    const t = GCP_ROOF_GABLE;
    let band;
    if (theta <= 20) {
      band = t.bands[0];
    } else {
      band = t.bands[1];
      if (theta > 27) capped = true;
    }
    negDef = band[zone].neg;
    posDef = band[zone].pos;
  }

  return {
    neg: logLerpA(A, Alo, negDef.Ahi, negDef.lo, negDef.hi),
    pos: logLerpA(A, Alo, posDef.Ahi, posDef.lo, posDef.hi),
    capped
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

// Net pressure range for roof overhangs (no GCpi term — see gcpOverhang below).
function pRangeNet(qh, kd, gcNeg, gcPos) {
  return { min: qh * kd * gcNeg, max: qh * kd * gcPos };
}

// Roof overhangs — Sec. 30.7 ("Roof Overhangs"). ASCE 7-22 replaced the separate
// overhang (GCp) graphs of prior editions with a combination approach: the net
// pressure coefficient on an overhang equals the (GCp) for the applicable roof
// surface (Fig. 30.3-2A for theta<=7 deg, or Figs. 30.3-2B/2C gable / 30.3-2D-G hip
// equivalent for theta>7 deg, per the user's "Roof Shape" selection) acting on the
// TOP surface, combined with the (GCp) for the adjacent WALL zone (Fig. 30.3-1)
// acting on the BOTTOM (soffit) surface, both evaluated at the overhang's effective
// wind area (here taken as the Roof C&C effective wind area entered above).
// Source: "ASCE 7-22 Changes to Component and Cladding Wind Provisions"
// (StructureMag, 2022) — describes this top+bottom combination and gives a worked
// example (hip roof, Zone 2, 20deg-27deg, A<=10 sf: roof (GCp)=-2.0 combined with
// wall (GCp)=+1.0 gives a net overhang coefficient of -3.0), which matches this
// implementation's GCP_ROOF_HIP.bands[1]['2'].neg.lo (-2.0) and
// GCP_WALL['4'/'5'].pos.lo (+1.0) exactly.
//
// Sign convention (net = roof - wall), confirmed against the worked example above
// and against the Bernoulli-based reasoning discussed in the Eng-Tips thread "ASCE
// 7-22 Roof overhang pressure" (Nov 2025): suction on the top surface (negative
// roof GCp) and positive pressure pushing UP on the soffit from below (positive
// wall GCp) both add to net UPLIFT, so net.neg = roof.neg - wall.pos. Conversely,
// net.pos (downward case) = roof.pos - wall.neg.
//
// Zone pairing (roof zone -> wall zone) is this calculator's engineering judgment,
// not an explicit tabulated pairing found in the secondary sources reviewed:
// roof Zone 2 (eave edge strip) is paired with wall Zone 4 (wall field), and roof
// Zone 3 (corner) is paired with wall Zone 5 (wall corner strip) — both Zone 3 and
// Zone 5 occupy the same "a"-dimension corner region per the Notation under Figs.
// 30.3-1/30.3-2. Interior Zone 1 is not included because overhangs occur only at
// building perimeters. GCpi is NOT applied to overhang pressures: both faces of an
// overhang are exposed to exterior pressure, so Eq. 30.3-1's internal-pressure term
// does not apply — the combined (top - bottom) coefficient above is already a net
// (through-thickness) coefficient.
const OVERHANG_WALL_ZONE = { '2': '4', '3': '5' };

function gcpOverhang(roofZone, A, theta, roofShape) {
  const wallZone = OVERHANG_WALL_ZONE[roofZone];
  const roofGc = (theta <= 7) ? gcpRoof(roofZone, A) : gcpRoofSloped(roofZone, A, theta, roofShape);
  const wallGc = gcpWall(wallZone, A);
  return {
    neg: roofGc.neg - wallGc.pos,
    pos: roofGc.pos - wallGc.neg,
    capped: roofGc.capped || false
  };
}

// Parapets — MWFRS: Sec. 27.3.4 ("Parapets"). ASCE 7-22 Sec. 27.3.4 gives the design
// pressure on a solid parapet as pp = qp Kd (GCpn) (Eq. 27.3-3), with the combined net
// pressure coefficient GCpn = +1.5 for the windward parapet and -1.0 for the leeward
// parapet (these GCpn values already represent the combination of front- and back-face
// pressure on the parapet, per the commentary). qp is the velocity pressure evaluated
// at the top of the parapet (z = h + parapet height), using the same Kz formula
// (Table 26.10-1) as q_h but at the higher elevation.
// Source for GCpn = +1.5 / -1.0: corroborated by RISA "Load Generation - Wind Loads"
// help documentation and the ICC "Demystifying Loads for Building Officials" ASCE 7-22
// guide, both citing Sec. 27.3.4.
//
// This calculator's MWFRS procedure is the Envelope Procedure (Ch. 28), whose parapet
// provision is cited here as Sec. 28.3.4 by analogy: per Meca Enterprises' ASCE 7-16
// worked comparison, the Ch. 27 Part 1 (Sec. 27.3.4) and Ch. 28 Part 1 parapet
// provisions are numerically identical (same GCpn = +1.5/-1.0, same qp). This
// calculator assumes the same correspondence holds in ASCE 7-22 (i.e., that ASCE 7-22
// Sec. 28.3.4 reproduces Sec. 27.3.4's GCpn values) — this section-number
// correspondence has NOT been independently confirmed against the ASCE 7-22 text;
// verify against the Standard directly.
function computeQp(s, kh_unused, ke, hp) {
  const zParapet = Math.max(s.h, 0) + Math.max(hp, 0);
  const khp = computeKh(zParapet, s.exposure);
  return { zParapet, khp, qp: 0.00256 * khp * s.kzt * ke * s.V * s.V };
}

// Parapets — C&C: Sec. 30.9 ("Parapets"), Eq. 30.9-1: p = qp[(GCp) - (GCpi)]. Per the
// two-load-case approach described in Meca Enterprises' "Wind Load on Parapets"
// article (citing the analogous ASCE 7-16 Ch. 30 Part 6 / Sec. 30.8, renumbered to
// Sec. 30.9 in ASCE 7-22):
//   Load A — positive wall (GCp) (Fig. 30.3-1) acts on the front face of the parapet
//            while negative edge/corner roof (GCp) (Fig. 30.3-2A/2B-2G) acts on the
//            back face; net (GCp)_A = wall.pos - roof.neg.
//   Load B — positive wall (GCp) acts on the back face while negative wall (GCp) (same
//            zone) acts on the front face; net (GCp)_B = wall.pos - wall.neg.
// GCpi is NOT applied (both faces are exterior surfaces, as with overhangs — see
// gcpOverhang above for the same reasoning).
//
// Zone pairing (wall zone -> roof zone) is this calculator's engineering judgment,
// NOT an explicit tabulated pairing found in the secondary sources reviewed: wall
// Zone 4 (field) is paired with roof Zone 2 (edge), and wall Zone 5 (corner) is paired
// with roof Zone 3 (corner) — the inverse of the overhang pairing (OVERHANG_WALL_ZONE)
// for the same geometric reason. Numerically, Meca's worked example (flat roof,
// A=10 sf) uses wall Zone 4 (GCp)_pos and roof Zone 2 (GCp)_neg for Load A, which
// matches this pairing, and that roof Zone 2 value (-2.3 at A=10 sf) matches this
// calculator's GCP_ROOF_LE7['2'].neg.lo exactly.
//
// NOT implemented (flagged, verify against the Standard for these conditions):
// Fig. 30.3-1 Note 5 (an additional reduction applied to the wall (GCp) for parapet
// checks on low-slope roofs in Meca's example) and the Fig. 30.3-2A note that Zone 3
// (GCp) may be taken equal to Zone 2 (GCp) when a parapet >= 3 ft tall is present.
// Both notes could change the governing pressure for some geometries.
const PARAPET_ROOF_ZONE = { '4': '2', '5': '3' };

function gcpParapet(wallZone, A, theta, roofShape) {
  const roofZone = PARAPET_ROOF_ZONE[wallZone];
  const wallGc = gcpWall(wallZone, A);
  const roofGc = (theta <= 7) ? gcpRoof(roofZone, A) : gcpRoofSloped(roofZone, A, theta, roofShape);
  return {
    gcA: wallGc.pos - roofGc.neg, // Load A: front (wall, pos) + back (roof, neg)
    gcB: wallGc.pos - wallGc.neg, // Load B: back (wall, pos) + front (wall, neg)
    capped: roofGc.capped || false
  };
}

// Open buildings — Fig. 27.3-4 (monoslope): theta < 7.5 deg uses the flat
// row (CN_MONOSLOPE_FLAT, identical for gamma = 0/180); 7.5 <= theta <= 45
// (clamped by lerpTheta) uses linear interpolation per Note 3.
function cnMonoslope(theta, gamma, loadCase, windFlow) {
  if (theta < 7.5) {
    const v = CN_MONOSLOPE_FLAT[loadCase][windFlow];
    return { CNW: v.CNW, CNL: v.CNL };
  }
  const t = CN_MONOSLOPE;
  const tbl = (gamma === 180 ? t.gamma180 : t.gamma0)[loadCase][windFlow];
  return {
    CNW: lerpTheta(theta, t.thetas, tbl.CNW),
    CNL: lerpTheta(theta, t.thetas, tbl.CNL)
  };
}

// Open buildings — Figs. 27.3-5 (pitched) / 27.3-6 (troughed): single
// C_NW/C_NL table for gamma = 0/180, rows tabulated at theta = 7.5-45 deg
// (no theta < 7.5 deg row). theta < 7.5 deg is clamped to the 7.5 deg row
// by lerpTheta; `belowRange` flags this for the UI.
function cnPitchedTroughed(theta, loadCase, windFlow, shape) {
  const t = shape === 'troughed' ? CN_TROUGHED : CN_PITCHED;
  const tbl = t[loadCase][windFlow];
  return {
    CNW: lerpTheta(theta, t.thetas, tbl.CNW),
    CNL: lerpTheta(theta, t.thetas, tbl.CNL),
    belowRange: theta < t.thetas[0]
  };
}

// Open buildings — Fig. 27.3-7 (gamma = 90/270, all roof shapes): returns
// the 3-zone C_N array [<=h, >h..<=2h, >2h] for the given load case/wind flow.
function cnFig277(loadCase, windFlow) {
  return CN_FIG277[loadCase][windFlow];
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

  // --- C&C Roof ---
  // theta <= 7 deg: Fig. 30.3-2A, zones 1', 1, 2, 3.
  // theta > 7 deg: Figs. 30.3-2B/2C (gable) or 2D-2G equivalent (hip), zones 1, 2, 3
  // (no zone 1' on the sloped-roof figures). theta beyond the figures' range (27° gable,
  // 45° hip) is capped at the last band's values and flagged via roofCapped.
  const roofApplicable = true;
  let roofCapped = false;
  const ccRoof = (s.theta <= 7)
    ? ['1p', '1', '2', '3'].map(z => {
      const gc = gcpRoof(z, s.areaRoof);
      return { zone: z, gcp: gc, p: pRangeDual(qh, KD, gc.neg, gc.pos, gcpi) };
    })
    : ['1', '2', '3'].map(z => {
      const gc = gcpRoofSloped(z, s.areaRoof, s.theta, s.roofShape);
      if (gc.capped) roofCapped = true;
      return { zone: z, gcp: gc, p: pRangeDual(qh, KD, gc.neg, gc.pos, gcpi) };
    });

  // --- C&C Roof Overhangs (Sec. 30.7) ---
  // Net top-surface (roof) + bottom-surface (wall) (GCp), zones 2 (eave) and 3 (corner)
  // only — see gcpOverhang() above for the combination formula and citations.
  const ccOverhang = s.hasOverhang
    ? ['2', '3'].map(z => {
      const gc = gcpOverhang(z, s.areaRoof, s.theta, s.roofShape);
      if (gc.capped) roofCapped = true;
      return { zone: z, gcp: gc, p: pRangeNet(qh, KD, gc.neg, gc.pos) };
    })
    : [];

  // --- Parapets (MWFRS Sec. 27.3.4/28.3.4 + C&C Sec. 30.9) ---
  // qp is the velocity pressure at the top of the parapet (z = h + parapet height),
  // using the same Table 26.10-1 Kh formula evaluated at the higher elevation
  // (computeQp / computeKh above). See the comment block above gcpParapet()/PARAPET_ROOF_ZONE
  // for full citations, the Load A/B definitions, and the not-implemented/unverified flags.
  let parapet = null;
  if (s.hasParapet) {
    const { zParapet, khp, qp } = computeQp(s, kh, ke, s.parapetHeight);

    // MWFRS — Eq. 27.3-3: pp = qp Kd (GCpn), GCpn = +1.5 (windward), -1.0 (leeward)
    const ppWindward = qp * KD * 1.5;
    const ppLeeward = qp * KD * (-1.0);
    const ppTotal = ppWindward - ppLeeward; // sum of magnitudes (windward + |leeward|)

    // C&C — Eq. 30.9-