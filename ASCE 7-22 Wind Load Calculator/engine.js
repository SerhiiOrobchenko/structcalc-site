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

    // C&C — Eq. 30.9-1: p = qp[(GCp) - (GCpi)], GCpi = 0 (both faces exterior)
    const ccParapet = ['4', '5'].map(z => {
      const gc = gcpParapet(z, s.areaWall, s.theta, s.roofShape);
      if (gc.capped) roofCapped = true;
      return {
        zone: z,
        gcA: gc.gcA,
        gcB: gc.gcB,
        pA: qp * KD * gc.gcA,
        pB: qp * KD * gc.gcB
      };
    });

    parapet = { hp: s.parapetHeight, zParapet, khp, qp, ppWindward, ppLeeward, ppTotal, ccParapet };
  }

  // --- Open Buildings with Free Roofs (Sec. 27.3.2, Eq. 27.3-2: p = qh Kd G CN) ---
  let openRoof = null;
  if (s.enclosure === 'openFreeRoof') {
    // G = Gust-Effect Factor, Sec. 26.11. This calculator uses G = 0.85 for rigid
    // structures (Sec. 26.11.1). The flexible-structure G_f procedure (Secs.
    // 26.11.3-26.11.5, requires fundamental natural frequency) is NOT implemented —
    // verify directly if the structure's natural frequency is below 1 Hz.
    const G = G_RIGID;
    steps.push({
      label: 'Gust-Effect Factor, G',
      clause: 'Sec. 26.11.1',
      formula: 'Rigid structure (fundamental natural frequency ≥ 1 Hz) → G = 0.85. (Flexible/dynamically sensitive structures use G_f per Secs. 26.11.3–26.11.5 — not implemented; verify separately if applicable.)',
      result: 'G = ' + fmt(G, 2)
    });

    const theta = s.theta;
    const shape = s.openRoofShape; // 'monoslope' | 'pitched' | 'troughed'
    const windFlow = s.openWindFlow === 'obstructed' ? 'obstr' : 'clear';
    const hL = s.openL > 0 ? s.h / s.openL : 0;

    steps.push({
      label: 'Roof Height-to-Length Ratio, h/L',
      clause: 'Fig. 27.3-4 Notation (h = mean roof height, L = horizontal roof dimension in the along-wind direction)',
      formula: 'h/L = ' + fmt(s.h, 2) + ' / ' + fmt(s.openL, 2),
      result: 'h/L = ' + fmt(hL, 3)
    });

    // Figs. 27.3-4/5/6 are tabulated for 0.25 <= h/L <= 1.0 and theta <= 45 deg.
    // Fig. 27.3-4 Note 4: for monoslope roofs with 0.05 <= h/L < 0.25 and theta < 5 deg,
    // use Fig. 27.3-7 (gamma = 90/270 table, below) instead of the gamma=0/180 table.
    // Whether this Note 4 substitution also applies to pitched/troughed roofs (Figs.
    // 27.3-5/27.3-6) was NOT confirmed in the source review — flagged below as
    // engineering judgment if relied upon for those shapes.
    const note4Applies = (hL >= 0.05 && hL < 0.25 && theta < 5);
    const hlOutOfRange = !note4Applies && (hL < 0.25 || hL > 1.0);
    const thetaOutOfRange = theta > 45;

    const pCoeff = qh * KD * G; // Eq. 27.3-2 coefficient: p = pCoeff * CN
    function pFromCN(cn) {
      return { CNW: cn.CNW, CNL: cn.CNL, pW: pCoeff * cn.CNW, pL: pCoeff * cn.CNL };
    }

    // gamma = 0/180 deg table (Figs. 27.3-4/5/6), unless Note 4 substitutes Fig. 27.3-7
    let gamma0180 = null;
    let pitchedTroughedBelowRange = false;
    if (!note4Applies) {
      if (shape === 'monoslope') {
        gamma0180 = {
          gamma0: { A: pFromCN(cnMonoslope(theta, 0, 'A', windFlow)), B: pFromCN(cnMonoslope(theta, 0, 'B', windFlow)) },
          gamma180: { A: pFromCN(cnMonoslope(theta, 180, 'A', windFlow)), B: pFromCN(cnMonoslope(theta, 180, 'B', windFlow)) }
        };
      } else {
        // Figs. 27.3-5 (pitched) / 27.3-6 (troughed): a single CNW/CNL table applies
        // to BOTH gamma = 0 deg and gamma = 180 deg (roof symmetry).
        const cnA = cnPitchedTroughed(theta, 'A', windFlow, shape);
        const cnB = cnPitchedTroughed(theta, 'B', windFlow, shape);
        pitchedTroughedBelowRange = !!(cnA.belowRange || cnB.belowRange);
        const pA = pFromCN(cnA), pB = pFromCN(cnB);
        gamma0180 = {
          gamma0: { A: pA, B: pB },
          gamma180: { A: pA, B: pB }
        };
      }
    }

    // gamma = 90/270 deg table (Fig. 27.3-7) — applies to all three roof shapes,
    // all h/L, theta <= 45 deg. Also governs gamma=0/180 when note4Applies (monoslope).
    const fig277 = {
      zoneKeys: CN_FIG277.zoneKeys,
      zoneLabels: CN_FIG277.zoneLabels,
      A: cnFig277('A', windFlow).map(cn => ({ CN: cn, p: pCoeff * cn })),
      B: cnFig277('B', windFlow).map(cn => ({ CN: cn, p: pCoeff * cn }))
    };

    openRoof = {
      G, hL, shape, windFlow, theta,
      note4Applies, hlOutOfRange, thetaOutOfRange, pitchedTroughedBelowRange,
      gamma0180, fig277
    };
  }

  return {
    kh, ke, kd: KD, qh, gcpi, a,
    steps, mwfrsLC1, mwfrsLC2, mwfrsLC3, mwfrsLC4, torsionApplies,
    ccWall, ccRoof, roofApplicable, roofCapped, ccOverhang, parapet, openRoof
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

function zoneTable(containerId, rows, dual, labels) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!rows.length) { c.innerHTML = '<p class="muted">Not applicable.</p>'; return; }
  const lbl = labels || ZONE_LABELS;
  let html = '<table><thead><tr><th>Zone</th>';
  if (dual) html += '<th>(GC_p) range</th>'; else html += '<th>(GC_pf)</th>';
  html += '<th>p_min (outward / suction), ' + pUnit() + '</th><th>p_max (inward / positive), ' + pUnit() + '</th></tr></thead><tbody>';
  rows.forEach(r => {
    const gcStr = dual
      ? fmt(r.gcp.neg, 2) + ' to ' + fmt(r.gcp.pos, 2)
      : fmt(r.gcpf, 2);
    html += '<tr><td>' + (lbl[r.zone] || r.zone) + '</td><td>' + gcStr + '</td>' +
      '<td>' + fmt(pVal(r.p.min), 2) + '</td><td>' + fmt(pVal(r.p.max), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

// Distinct zone labels for the roof overhang table (Sec. 30.7) — '2'/'3' here refer
// to the roof-surface zone whose (GCp) feeds the combination (see gcpOverhang).
const OVERHANG_ZONE_LABELS = {
  '2': '2 (eave, w/ wall Zone 4)',
  '3': '3 (corner, w/ wall Zone 5)'
};

// Zone labels for the parapet C&C table (Sec. 30.9) — these are wall zones 4/5; the
// paired roof zone (per PARAPET_ROOF_ZONE) feeds Load A — see gcpParapet().
const PARAPET_ZONE_LABELS = {
  '4': '4 (field, w/ roof Zone 2)',
  '5': '5 (corner, w/ roof Zone 3)'
};

// C&C parapet table (Sec. 30.9, Load A / Load B) — distinct from zoneTable() because
// each zone carries two independent (GCp)/pressure pairs (Load A and Load B) rather
// than a single neg/pos range.
function ccParapetTable(containerId, rows, labels) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!rows.length) { c.innerHTML = '<p class="muted">Not applicable.</p>'; return; }
  const lbl = labels || ZONE_LABELS;
  let html = '<table><thead><tr><th>Zone</th>' +
    '<th>(GC_p) Load A</th><th>p_A, ' + pUnit() + '</th>' +
    '<th>(GC_p) Load B</th><th>p_B, ' + pUnit() + '</th></tr></thead><tbody>';
  rows.forEach(r => {
    html += '<tr><td>' + (lbl[r.zone] || r.zone) + '</td>' +
      '<td>' + fmt(r.gcA, 2) + '</td><td>' + fmt(pVal(r.pA), 2) + '</td>' +
      '<td>' + fmt(r.gcB, 2) + '</td><td>' + fmt(pVal(r.pB), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

// Open Buildings — gamma=0/180 deg results table (Figs. 27.3-4/5/6, or Fig. 27.3-7
// when Fig. 27.3-4 Note 4 applies). Four rows: gamma=0/180 deg x Load Cases A/B.
function openRoofGammaTable(containerId, gamma0180) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (!gamma0180) { c.innerHTML = '<p class="muted">See note above.</p>'; return; }
  let html = '<table><thead><tr><th>Wind Direction</th><th>Load Case</th>' +
    '<th>C_NW</th><th>C_NL</th><th>p_W, ' + pUnit() + '</th><th>p_L, ' + pUnit() + '</th></tr></thead><tbody>';
  const rows = [
    { lbl: 'γ = 0°', lc: 'A', d: gamma0180.gamma0.A },
    { lbl: 'γ = 0°', lc: 'B', d: gamma0180.gamma0.B },
    { lbl: 'γ = 180°', lc: 'A', d: gamma0180.gamma180.A },
    { lbl: 'γ = 180°', lc: 'B', d: gamma0180.gamma180.B }
  ];
  rows.forEach(row => {
    html += '<tr><td>' + row.lbl + '</td><td>' + row.lc + '</td>' +
      '<td>' + fmt(row.d.CNW, 2) + '</td><td>' + fmt(row.d.CNL, 2) + '</td>' +
      '<td>' + fmt(pVal(row.d.pW), 2) + '</td><td>' + fmt(pVal(row.d.pL), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

// Open Buildings — gamma=90/270 deg results table (Fig. 27.3-7, 3 zones x Load Cases A/B)
function openRoofZoneTable(containerId, fig277) {
  const c = document.getElementById(containerId);
  if (!c) return;
  let html = '<table><thead><tr><th>Zone (horiz. distance from windward edge)</th>' +
    '<th>C_N, Load Case A</th><th>p_A, ' + pUnit() + '</th>' +
    '<th>C_N, Load Case B</th><th>p_B, ' + pUnit() + '</th></tr></thead><tbody>';
  fig277.zoneKeys.forEach((zk, i) => {
    html += '<tr><td>' + fig277.zoneLabels[zk] + '</td>' +
      '<td>' + fmt(fig277.A[i].CN, 2) + '</td><td>' + fmt(pVal(fig277.A[i].p), 2) + '</td>' +
      '<td>' + fmt(fig277.B[i].CN, 2) + '</td><td>' + fmt(pVal(fig277.B[i].p), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

// Open Buildings with Free Roofs (Sec. 27.3.2) — results panel. Shown only when
// state.enclosure === 'openFreeRoof' (toggled via #openRoofSection display).
function renderOpenRoof(r) {
  const section = document.getElementById('openRoofSection');
  if (section) section.style.display = (state.enclosure === 'openFreeRoof') ? '' : 'none';
  if (state.enclosure !== 'openFreeRoof' || !r.openRoof) return;
  const o = r.openRoof;

  const setCard = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCard('openRoofG', fmt(o.G, 2));
  setCard('openRoofHL', fmt(o.hL, 3));

  const noteEl = document.getElementById('openRoofNote');
  if (noteEl) {
    const msgs = [];
    if (o.thetaOutOfRange) {
      msgs.push('Roof angle &theta; = ' + fmt(o.theta, 1) + '&deg; exceeds the &theta; &le; 45&deg; applicability limit of Figs. 27.3-4/5/6/7 &mdash; results are not valid; verify against the Standard.');
    }
    if (o.note4Applies) {
      msgs.push('h/L = ' + fmt(o.hL, 3) + ' and &theta; = ' + fmt(o.theta, 1) + '&deg; &lt; 5&deg; &rarr; per Fig. 27.3-4, Note 4, the &gamma; = 0&deg;/180&deg; loading uses the Fig. 27.3-7 coefficients (table below) instead of Fig. 27.3-4.' +
        (o.shape !== 'monoslope' ? ' This Note 4 substitution is stated for monoslope roofs (Fig. 27.3-4); its applicability to ' + o.shape + ' roofs (Figs. 27.3-5/27.3-6) was not confirmed in the source review &mdash; engineering judgment, verify against the Standard.' : ''));
    } else if (o.hlOutOfRange) {
      msgs.push('h/L = ' + fmt(o.hL, 3) + ' is outside the 0.25 &le; h/L &le; 1.0 range given in the Fig. 27.3-4 Notation.' +
        (o.shape !== 'monoslope' ? ' This range is assumed to also apply to Fig. 27.3-' + (o.shape === 'pitched' ? '5' : '6') + ' (not independently confirmed in the source review) &mdash; ' : ' ') +
        ' The coefficients shown use the nearest tabulated &theta; row (clamped) and should be verified against the Standard for this h/L.');
    }
    if (o.pitchedTroughedBelowRange) {
      msgs.push('&theta; = ' + fmt(o.theta, 1) + '&deg; is below the tabulated range of Fig. 27.3-' + (o.shape === 'troughed' ? '6' : '5') + ' (rows start at &theta; = 7.5&deg;). The &theta; = 7.5&deg; row is used as a clamped approximation &mdash; engineering judgment, verify against the Standard.');
    }
    if (msgs.length) {
      noteEl.style.display = '';
      noteEl.innerHTML = msgs.map(m => '<p>' + m + '</p>').join('');
    } else {
      noteEl.style.display = 'none';
      noteEl.innerHTML = '';
    }
  }

  const gammaHeading = document.getElementById('openRoofGammaHeading');
  if (gammaHeading) {
    const figNum = o.shape === 'monoslope' ? '27.3-4' : (o.shape === 'pitched' ? '27.3-5' : '27.3-6');
    gammaHeading.innerHTML = 'Wind Normal to Ridge/Span &mdash; &gamma; = 0&deg;/180&deg; <span class="ref">' +
      (o.note4Applies ? 'Fig. 27.3-7 (per Fig. 27.3-4 Note 4)' : 'Fig. ' + figNum) + '</span>';
  }
  if (o.note4Applies) {
    const c = document.getElementById('openRoofGammaTable');
    if (c) c.innerHTML = '<p class="muted">Per Note 4, use the &gamma; = 90&deg;/270&deg; (Fig. 27.3-7) table below for this loading direction.</p>';
  } else {
    openRoofGammaTable('openRoofGammaTable', o.gamma0180);
  }

  openRoofZoneTable('openRoofFig277Table', o.fig277);
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
  const roofHeading = document.getElementById('ccRoofHeading');
  if (roofHeading) {
    roofHeading.innerHTML = (state.theta <= 7)
      ? 'Roof &mdash; Zones 1&prime;, 1, 2, 3 <span class="ref">Fig. 30.3-2A, &theta; &le; 7&deg;</span>'
      : 'Roof &mdash; Zones 1, 2, 3 <span class="ref">' +
        (state.roofShape === 'hip' ? 'Figs. 30.3-2D&ndash;G equiv.' : 'Figs. 30.3-2B/2C') +
        ', &theta; &gt; 7&deg;</span>';
  }
  const roofNote = document.getElementById('ccRoofNote');
  if (roofNote) {
    if (state.theta > 7 && r.roofCapped) {
      roofNote.style.display = '';
      roofNote.textContent = (state.roofShape === 'hip')
        ? 'Roof angle θ > 45°: Figures 30.3-2D–G (hip) do not extend past θ = 45°. The θ = 45° coefficients are used as a capped approximation — verify against the Standard for roofs steeper than 45°.'
        : 'Roof angle θ > 27°: Figures 30.3-2B/2C (gable) do not extend past θ = 27°. The θ = 20°–27° (Fig. 30.3-2C) coefficients are used as a capped approximation — verify against the Standard for roofs steeper than 27°.';
    } else {
      roofNote.style.display = 'none';
    }
  }
  zoneTable('ccRoofTable', r.ccRoof, true);

  // Roof overhangs (Sec. 30.7) — only shown when the "has roof overhangs" toggle is on
  const overhangSection = document.getElementById('ccOverhangSection');
  if (overhangSection) overhangSection.style.display = state.hasOverhang ? '' : 'none';
  if (state.hasOverhang) {
    zoneTable('ccOverhangTable', r.ccOverhang, true, OVERHANG_ZONE_LABELS);
  }

  // Parapets (MWFRS Sec. 27.3.4/28.3.4 + C&C Sec. 30.9) — only shown when the
  // "has parapet" toggle is on
  const parapetSection = document.getElementById('parapetSection');
  if (parapetSection) parapetSection.style.display = state.hasParapet ? '' : 'none';
  if (state.hasParapet && r.parapet) {
    setCard('parapetZp', fmt(lengthOut(r.parapet.zParapet), 1) + ' ' + (state.unitSystem === 'SI' ? 'm' : 'ft'));
    setCard('parapetKhp', fmt(r.parapet.khp, 3));
    setCard('parapetQp', fmt(pVal(r.parapet.qp), 2) + ' ' + pUnit());
    setCard('parapetPwindward', fmt(pVal(r.parapet.ppWindward), 2) + ' ' + pUnit());
    setCard('parapetPleeward', fmt(pVal(r.parapet.ppLeeward), 2) + ' ' + pUnit());
    setCard('parapetPtotal', fmt(pVal(r.parapet.ppTotal), 2) + ' ' + pUnit());
    ccParapetTable('ccParapetTable', r.parapet.ccParapet, PARAPET_ZONE_LABELS);
  }

  renderOpenRoof(r);

  renderDiagram(r);
  renderPrintCover();
}

/* =====================================================================
   PRINT REPORT COVER (Project Information)
   Mirrors the "Design Information" header of a SkyCiv-style report.
   All values are user-entered metadata (state.projectName, etc.) —
   nothing here is computed.
   ===================================================================== */
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
    applyEnclosureVisibility();
    renderResults();
  });

  // Open Building — Free Roof (Sec. 27.3.2) inputs — shown only when
  // enclosure === 'openFreeRoof' (see applyEnclosureVisibility)
  const openRoofShapeEl = document.getElementById('openRoofShape');
  if (openRoofShapeEl) {
    openRoofShapeEl.addEventListener('change', e => {
      state.openRoofShape = e.target.value;
      renderResults();
    });
  }
  const openWindFlowEl = document.getElementById('openWindFlow');
  if (openWindFlowEl) {
    openWindFlowEl.addEventListener('change', e => {
      state.openWindFlow = e.target.value;
      renderResults();
    });
  }
  const openLEl = document.getElementById('openL');
  if (openLEl) {
    openLEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.openL = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
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

  // Roof shape (gable vs hip) — selects Fig. 30.3-2B/2C vs 2D-2G equiv. for theta > 7 deg
  const roofShapeEl = document.getElementById('roofShape');
  if (roofShapeEl) {
    roofShapeEl.addEventListener('change', e => {
      state.roofShape = e.target.value;
      renderResults();
    });
  }

  // Roof overhangs (Sec. 30.7) toggle
  const hasOverhangEl = document.getElementById('hasOverhang');
  if (hasOverhangEl) {
    hasOverhangEl.addEventListener('change', e => {
      state.hasOverhang = e.target.checked;
      renderResults();
    });
  }

  // Parapets (Sec. 27.3.4/28.3.4 MWFRS + Sec. 30.9 C&C) toggle + height
  const hasParapetEl = document.getElementById('hasParapet');
  if (hasParapetEl) {
    hasParapetEl.addEventListener('change', e => {
      state.hasParapet = e.target.checked;
      renderResults();
    });
  }
  const parapetHeightEl = document.getElementById('parapetHeight');
  if (parapetHeightEl) {
    parapetHeightEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.parapetHeight = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }

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
  const rs = document.getElementById('roofShapeField');
  if (rs) rs.style.display = state.roofType === 'flat' ? 'none' : '';
}

// Open Building — Free Roof (Sec. 27.3.2): when enclosure === 'openFreeRoof',
// hide the normal MWFRS/C&C mode toggle and Cp/GCpi-based result sections (via the
// 'enclosure-open' body class, see CSS), and show the Open Building geometry/wind-flow
// inputs (#openRoofInputs) and results panel (#openRoofSection, toggled in renderOpenRoof).
function applyEnclosureVisibility() {
  const isOpen = state.enclosure === 'openFreeRoof';
  document.body.classList.toggle('enclosure-open', isOpen);
  const inputs = document.getElementById('openRoofInputs');
  if (inputs) inputs.style.display = isOpen ? '' : 'none';
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
  set('lblParapetHeight', sys === 'SI' ? 'm' : 'ft');
  set('lblOpenL', sys === 'SI' ? 'm' : 'ft');
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
  const parapetHeightEl = document.getElementById('parapetHeight');
  if (parapetHeightEl) parapetHeightEl.value = fmt(lengthOut(state.parapetHeight), 2);
  const openLEl = document.getElementById('openL');
  if (openLEl) openLEl.value = fmt(lengthOut(state.openL), 2);

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
    <p>Both signs must be evaluated (<span class="src-tag">Table 26.13-1, Note 1</span>); this calculator pairs each (GC_pf)/(GC_p) value with whichever (GC_pi) sign produces the larger-magnitude net pressure.</p>
    <p><strong>Open Building &mdash; Free Roof</strong> selects the <span class="src-tag">Sec. 27.3.2</span> procedure for open buildings with monoslope, pitched, or troughed free roofs (e.g., canopies, pavilions, open-sided sheds with no walls). This replaces the normal (GC_pf)/(GC_p)-(GC_pi) MWFRS/C&amp;C flow above with <span class="src-tag">Eq. 27.3-2</span>: p = q_h K_d G C_N, where C_N is read from <span class="src-tag">Figs. 27.3-4 through 27.3-7</span>. (GC_pi) is not applicable to this procedure (there is no enclosed internal volume).</p>`
  },
  openRoof: {
    title: 'Open Buildings with Free Roofs — Sec. 27.3.2',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 27.3.2</span> &mdash; "Open Buildings with Monoslope, Pitched, or Troughed Free Roofs." Net design wind pressure, <span class="src-tag">Eq. 27.3-2</span>: <strong>p = q_h K_d G C_N</strong>, applied normal to the roof surface (positive toward the roof bottom surface).</p>
    <p><strong>G</strong> &mdash; Gust-Effect Factor, <span class="src-tag">Sec. 26.11</span>. This calculator uses G = 0.85 for rigid structures (<span class="src-tag">Sec. 26.11.1</span>). The flexible-structure G_f procedure (<span class="src-tag">Secs. 26.11.3&ndash;26.11.5</span>, requires the fundamental natural frequency) is <strong>not implemented</strong> &mdash; verify separately if the structure's natural frequency is below 1 Hz.</p>
    <p><strong>C_N</strong> &mdash; Net pressure coefficient for two orthogonal load cases (A and B), tabulated by roof angle &theta;, h/L ratio, wind flow (Clear/Obstructed under the roof), and wind direction &gamma; relative to the ridge/span:</p>
    <ul>
      <li><span class="src-tag">Fig. 27.3-4</span> &mdash; Monoslope, &gamma; = 0&deg;/180&deg;, 0.25 &le; h/L &le; 1.0, &theta; &le; 45&deg;.</li>
      <li><span class="src-tag">Fig. 27.3-5</span> &mdash; Pitched, &gamma; = 0&deg;/180&deg; (one table applies to both, by roof symmetry).</li>
      <li><span class="src-tag">Fig. 27.3-6</span> &mdash; Troughed, &gamma; = 0&deg;/180&deg; (one table applies to both, by roof symmetry).</li>
      <li><span class="src-tag">Fig. 27.3-7</span> &mdash; &gamma; = 90&deg;/270&deg; (wind parallel to ridge/valley), applies to all three roof shapes, all h/L, &theta; &le; 45&deg;, in 3 zones based on horizontal distance from the windward edge.</li>
    </ul>
    <p>Linear interpolation for intermediate &theta; between tabulated rows (7.5&deg;&ndash;45&deg;) is permitted by <span class="src-tag">Fig. 27.3-4, Note 3</span> and applied here for all four figures.</p>
    <p>Both Load Cases A and B, and both wind directions (&gamma; = 0&deg;/180&deg; and 90&deg;/270&deg;), must be evaluated to determine the controlling design pressures &mdash; per the figure notes, the case producing the largest absolute pressure for each region of the roof governs.</p>`
  },
  openRoofShape: {
    title: 'Free Roof Shape — Figs. 27.3-4/5/6',
    html: `<p>Selects which C_N table governs the &gamma; = 0&deg;/180&deg; loading (<span class="src-tag">Sec. 27.3.2</span>):</p>
    <ul>
      <li><strong>Monoslope</strong> &mdash; single sloped plane, <span class="src-tag">Fig. 27.3-4</span>. For &theta; &lt; 7.5&deg;, a flat-roof row applies (identical C_N for &gamma; = 0&deg; and 180&deg;, by symmetry).</li>
      <li><strong>Pitched (gable-shaped, ridge at center)</strong> &mdash; <span class="src-tag">Fig. 27.3-5</span>.</li>
      <li><strong>Troughed (valley at center)</strong> &mdash; <span class="src-tag">Fig. 27.3-6</span>, whose C_N values are the sign-flip of Fig. 27.3-5 (physically consistent: a troughed roof is an inverted pitched roof).</li>
    </ul>
    <p>For all three shapes, <span class="src-tag">Fig. 27.3-7</span> (&gamma; = 90&deg;/270&deg;) is always shown as well, since wind parallel to the ridge/valley must also be checked.</p>
    <p><span class="src-tag">Fig. 27.3-4, Note 4</span>: for monoslope roofs with 0.05 &le; h/L &lt; 0.25 and &theta; &lt; 5&deg;, Fig. 27.3-7 is used in place of Fig. 27.3-4 for the &gamma; = 0&deg;/180&deg; case as well &mdash; this calculator applies that substitution and flags it. Whether the same substitution applies to pitched/troughed roofs (Figs. 27.3-5/27.3-6) was not confirmed in the source review and is flagged as engineering judgment if encountered.</p>`
  },
  openWindFlow: {
    title: 'Wind Flow (Clear / Obstructed) — Figs. 27.3-4/5/6/7, Note 2',
    html: `<p>Per the notes to <span class="src-tag">Figs. 27.3-4 through 27.3-7</span>, C_N values are tabulated separately for two conditions of airflow beneath the free roof:</p>
    <ul>
      <li><strong>Clear wind flow</strong> &mdash; wind able to flow with minimal obstruction beneath the roof.</li>
      <li><strong>Obstructed wind flow</strong> &mdash; wind flow blocked by objects beneath the roof equal to more than 50% of the open area under the roof.</li>
    </ul>
    <p>Select the condition that applies to the structure's actual usage; obstructed flow generally increases the magnitude of the net pressure coefficients.</p>`
  },
  openL: {
    title: 'Roof Plan Dimension, L — Fig. 27.3-4 Notation',
    html: `<p>L is the horizontal dimension of the roof measured in the along-wind direction (i.e., the span over which the monoslope/pitched/troughed roof extends), per the Notation diagram of <span class="src-tag">Fig. 27.3-4</span>.</p>
    <p>Together with the mean roof height h (entered above, under "Building Geometry"), this gives the ratio <strong>h/L</strong>, which the C_N tables of Figs. 27.3-4/5/6 are tabulated for over the range 0.25 &le; h/L &le; 1.0. h/L outside this range, or &theta; &gt; 45&deg;, is flagged in the results as outside the figures' stated applicability &mdash; verify against the Standard.</p>`
  },
  riskCategory: {
    title: 'Risk Category',
    html: `<p>Risk Category (I, II, III, or IV) is assigned per <span class="src-tag">Table 1.5-1</span> based on the building's occupancy/use. It is recorded here for the report header and does not feed into this module's calculations directly &mdash; its effect is already embedded in the basic wind speed V you enter.</p>
    <p>Per <span class="src-tag">Sec. 26.5.1</span>, the wind speed maps of <span class="src-tag">Figures 26.5-1A&ndash;D</span> are keyed to Risk Category (each map corresponds to a target annual probability of exceedance / mean recurrence interval appropriate to that category). Use the <a href="https://ascehazardtool.org" target="_blank" rel="noopener">ASCE 7 Hazard Tool</a> with your project's Risk Category to obtain the correct V for the "Basic Wind Speed" field above.</p>`
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
    html: `<p>This selector is a convenience for progressive input &mdash; it does not add a new code parameter. Selecting <strong>"Flat / low-slope (&theta; &le; 7&deg;)"</strong> hides the roof angle and roof shape fields and sets &theta; = 0, which is the governing case for <span class="src-tag">Figure 30.3-2A</span> roof C&amp;C (Zones 1&prime;, 1, 2, 3, applicable only for &theta; &le; 7&deg;) and the &theta; = 0&ndash;5&deg; row of <span class="src-tag">Figure 28.3-1</span>.</p>
    <p>Selecting <strong>"Gable, hip, or other sloped roof"</strong> reveals the &theta; and roof shape fields so you can enter the actual roof angle for interpolation in <span class="src-tag">Figure 28.3-1</span> (Load Cases 1 &amp; 3) and select the roof C&amp;C figure set (<span class="src-tag">Figs. 30.3-2B/2C</span> gable, or <span class="src-tag">30.3-2D&ndash;G</span> hip) for &theta; &gt; 7&deg;.</p>`
  },
  theta: {
    title: 'Roof Angle, θ',
    html: `<p>Angle of the plane of the roof from horizontal, in degrees. Used to interpolate (GC_pf) from <span class="src-tag">Figure 28.3-1</span> (Load Cases 1 &amp; 3, rows tabulated at &theta; = 0&ndash;5&deg;, 20&deg;, 30&ndash;45&deg;, 90&deg;, with linear interpolation permitted for intermediate angles) and to select the roof C&amp;C figure: <span class="src-tag">Figure 30.3-2A</span> for &theta; &le; 7&deg;, or <span class="src-tag">Figures 30.3-2B/2C</span> (gable) / <span class="src-tag">30.3-2D&ndash;G</span> (hip) for 7&deg; &lt; &theta; &le; 45&deg; depending on the Roof Shape selector.</p>
    <p>For &theta; &le; 10&deg;, h may be taken as the eave height (<span class="src-tag">Sec. 26.2</span> definition of mean roof height).</p>
    <p>&theta; &gt; 27&deg; (gable) or &gt; 45&deg; (hip) is beyond the range of the digitized figures; the calculator caps the roof C&amp;C coefficients at the highest tabulated &theta; band and flags this in a note above the roof C&amp;C table. MWFRS results remain valid for all &theta; up to 90&deg;.</p>`
  },
  roofShape: {
    title: 'Roof Shape — Figs. 30.3-2B/2C (gable) vs 30.3-2D–G (hip)',
    html: `<p>Selects which roof C&amp;C figure set applies for &theta; &gt; 7&deg;:</p>
    <p><strong>Gable</strong> &mdash; <span class="src-tag">Figure 30.3-2B</span> (7&deg; &lt; &theta; &le; 20&deg;) or <span class="src-tag">Figure 30.3-2C</span> (20&deg; &lt; &theta; &le; 27&deg;), Zones 1, 2, 3.</p>
    <p><strong>Hip</strong> &mdash; <span class="src-tag">Figures 30.3-2D&ndash;G</span> equivalent (7&deg; &lt; &theta; &le; 45&deg;, in three sub-bands), Zones 1, 2, 3.</p>
    <p>Both sets of (GC_p) values were digitized from the user's Calcs.com (ClearCalcs) ASCE 7-22 Wind Loads C&amp;C calculator formula listing and cross-validated 6/6 against explicit printed value labels on the Fig. 30.3-2B figure image &mdash; see "Where these formulas come from" in the Sources footer for details.</p>`
  },
  areaWall: {
    title: 'Effective Wind Area — Walls (C&C), Figure 30.3-1',
    html: `<p><span class="src-tag">Sec. 26.2 definition of "Effective Wind Area"</span> &mdash; the span length of the component multiplied by an effective width that need not be less than one-third the span length (this maximizes A and minimizes the magnitude of (GC_p)).</p>
    <p><span class="src-tag">Figure 30.3-1</span> tabulates (GC_p) for wall Zones 4 and 5 at A &le; 10 ft&sup2; and A &ge; 500 ft&sup2;, with log-linear interpolation between. This calculator applies that interpolation directly.</p>`
  },
  areaRoof: {
    title: 'Effective Wind Area — Roof (C&C), Figures 30.3-2A/2B-2G',
    html: `<p>Same definition as the wall effective wind area (<span class="src-tag">Sec. 26.2</span>), applied to the roof component/cladding under consideration.</p>
    <p><span class="src-tag">Figure 30.3-2A</span> (&theta; &le; 7&deg;) tabulates (GC_p) for roof Zones 1&prime;, 1, 2, and 3 at A &le; 10 ft&sup2; and A &ge; 500 ft&sup2;, with log-linear interpolation between.</p>
    <p><span class="src-tag">Figures 30.3-2B/2C</span> (gable, 7&deg; &lt; &theta; &le; 27&deg;) and <span class="src-tag">30.3-2D&ndash;G</span> (hip, 7&deg; &lt; &theta; &le; 45&deg;) tabulate (GC_p) for roof Zones 1, 2, 3 at A &le; 10 ft&sup2; and a zone/sign-specific upper area (100&ndash;300 ft&sup2;), with log-linear interpolation between.</p>`
  },
  overhang: {
    title: 'Roof Overhangs — Sec. 30.7',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.7</span> &mdash; for buildings with roof overhangs, the net pressure coefficient on the overhang is obtained by combining the (GC_p) for the applicable roof surface (top of overhang) with the (GC_p) for the adjacent wall zone (bottom/soffit of overhang), both evaluated at the overhang's effective wind area. This replaces the separate overhang (GC_p) graphs used in prior editions of ASCE 7.</p>
    <p>This calculator combines: <strong>net (GC_p) = roof (GC_p) &minus; wall (GC_p)</strong>, using the roof C&amp;C zone 2 (eave) with wall zone 4, and roof zone 3 (corner) with wall zone 5 &mdash; both pairings span the same "a"-dimension perimeter strip per the Notation under Figs. 30.3-1/30.3-2. Interior Zone 1 is excluded (overhangs occur only at the perimeter).</p>
    <p>The sign convention and the zone-pairing/combination approach are based on the worked example and discussion in <em>"ASCE 7-22 Changes to Component and Cladding Wind Provisions"</em> (StructureMag, 2022) and the Eng-Tips thread <em>"ASCE 7-22 Roof overhang pressure"</em> (Nov 2025): roof zone 2, &theta;=20&deg;-27&deg; hip, A&le;10 ft&sup2; gives roof (GC_p)=&minus;2.0 and wall (GC_p)=+1.0, combining to a net coefficient of &minus;3.0, exactly matching this calculator's tables.</p>
    <p><span class="src-tag">No (GC_pi) term</span> &mdash; both faces of an overhang are exterior surfaces, so Eq. 30.3-1's internal-pressure adjustment does not apply; the combined coefficient above is already a net (through-thickness) value.</p>
    <p>The exact roof-zone&harr;wall-zone pairing is not explicitly tabulated in the secondary sources reviewed for this calculator; the pairing used here is this calculator's engineering judgment based on the geometric correspondence of the "a"-dimension zones. Verify against ASCE/SEI 7-22 Sec. 30.7 and Fig. 30.7-1 directly for critical designs.</p>`
  },
  parapet: {
    title: 'Parapets — Sec. 27.3.4 (MWFRS) / Sec. 30.9 (C&amp;C)',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 27.3.4 ("Parapets")</span>, Eq. 27.3-3 &mdash; the design wind pressure on a solid parapet for the MWFRS is p<sub>p</sub> = q<sub>p</sub> K<sub>d</sub> (GC<sub>pn</sub>), where (GC<sub>pn</sub>) = <strong>+1.5</strong> for the windward parapet and <strong>&minus;1.0</strong> for the leeward parapet, and q<sub>p</sub> is the velocity pressure evaluated at the top of the parapet (using the same K<sub>z</sub> formula of Table 26.10-1, evaluated at z = h + parapet height). These (GC<sub>pn</sub>) values are corroborated by RISA's "Load Generation &mdash; Wind Loads" documentation and the ICC "Demystifying Loads for Building Officials" ASCE 7-22 guide.</p>
    <p>This calculator's MWFRS procedure is the Envelope Procedure (Ch. 28). Per Meca Enterprises' ASCE 7-16 comparison, the Ch. 27 Part 1 (then Sec. 27.3.4) and Ch. 28 Part 1 (then Sec. 28.3.2) parapet provisions were numerically identical (same (GC<sub>pn</sub>) = +1.5/&minus;1.0, same q<sub>p</sub>). This calculator assumes the same correspondence holds for ASCE 7-22 and applies these (GC<sub>pn</sub>) values to the Envelope Procedure as well, provisionally citing this as <strong>Sec. 28.3.4</strong> &mdash; <span class="src-tag">this exact section number has NOT been independently confirmed against the ASCE/SEI 7-22 text; verify directly.</span></p>
    <p>"Total parapet pressure" = windward p<sub>p</sub> &minus; leeward p<sub>p</sub> (sum of magnitudes), per the combined-pressure convention shown in worked examples (e.g., Meca's 47.1 psf + 31.4 psf = 78.5 psf for a representative case).</p>
    <p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.9 ("Parapets")</span>, Eq. 30.9-1 &mdash; C&amp;C pressure on a parapet is p = q<sub>p</sub>[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)], with (GC<sub>pi</sub>) = 0 because both faces of the parapet are exterior surfaces (same reasoning as the roof-overhang calculation, Sec. 30.7). Following the two-load-case approach in Meca Enterprises' "Wind Load on Parapets" article (for the analogous ASCE 7-16 Sec. 30.8, renumbered to Sec. 30.9 in ASCE 7-22):</p>
    <p><strong>Load A</strong> &mdash; positive wall (GC<sub>p</sub>) (Fig. 30.3-1) on the front face combined with negative roof edge/corner (GC<sub>p</sub>) (Fig. 30.3-2A&ndash;G) on the back face: net (GC<sub>p</sub>)<sub>A</sub> = wall (GC<sub>p</sub>)<sub>pos</sub> &minus; roof (GC<sub>p</sub>)<sub>neg</sub>.<br>
    <strong>Load B</strong> &mdash; positive wall (GC<sub>p</sub>) on the back face combined with negative wall (GC<sub>p</sub>) (same zone) on the front face: net (GC<sub>p</sub>)<sub>B</sub> = wall (GC<sub>p</sub>)<sub>pos</sub> &minus; wall (GC<sub>p</sub>)<sub>neg</sub>.</p>
    <p>This calculator pairs wall Zone 4 (field) with roof Zone 2 (edge), and wall Zone 5 (corner) with roof Zone 3 (corner) for Load A &mdash; <span class="src-tag">this zone pairing is this calculator's engineering judgment</span> (the inverse of the roof-overhang pairing in Sec. 30.7, for the same geometric reason), not an explicit tabulated pairing found in the sources reviewed. It is numerically consistent with Meca's worked example, in which wall Zone 4 (GC<sub>p</sub>)<sub>pos</sub> = +1.0 and roof Zone 2 (GC<sub>p</sub>)<sub>neg</sub> = &minus;2.3 (A = 10 ft&sup2;) match this calculator's tables exactly.</p>
    <p><span class="src-tag">Not implemented &mdash; verify directly for these conditions:</span> (1) Fig. 30.3-1 Note 5, an additional reduction to the wall (GC<sub>p</sub>) used in Meca's parapet example for low-slope roofs; and (2) the Fig. 30.3-2A note permitting roof Zone 3 (GC<sub>p</sub>) to be taken equal to Zone 2 (GC<sub>p</sub>) when a parapet &ge; 3 ft tall is present. Either could change the governing pressure for some geometries and is not accounted for in the tables above.</p>`
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
    title: 'Components &amp; Cladding — Figures 30.3-1 / 30.3-2A-2G',
    html: `<p><span class="src-tag">Sec. 30.3, Eq. 30.3-1</span>: p = q_h K_d [(GC_p) &minus; (GC_pi)]. Applicable to C&amp;C of enclosed and partially enclosed low-rise buildings (h &le; 60 ft) with flat, gable, hip, monoslope, or similar roofs, per <span class="src-tag">Sec. 30.3.1</span> and the conditions on Figures 30.3-1/30.3-2.</p>
    <p>(GC_p) is read from <span class="src-tag">Figure 30.3-1</span> (walls, Zones 4 &amp; 5, all &theta;), <span class="src-tag">Figure 30.3-2A</span> (roof, Zones 1&prime;, 1, 2, 3, for &theta; &le; 7&deg;), and <span class="src-tag">Figures 30.3-2B/2C</span> (gable) or <span class="src-tag">30.3-2D&ndash;G</span> (hip) (roof, Zones 1, 2, 3, for 7&deg; &lt; &theta; &le; 45&deg;), as a function of the effective wind area, with log-linear interpolation between the tabulated breakpoints.</p>
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
    // Open Building — Free Roof (Sec. 27.3.2) has no (GC_pi) — omit the suffix for it.
    o.value = k; o.textContent = GCPI[k].noGcpi ? GCPI[k].label : GCPI[k].label + ' (GC_pi = ±' + fmt(GCPI[k].pos, 2) + ')';
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
  const roofShapeSel = document.getElementById('roofShape');
  if (roofShapeSel) roofShapeSel.value = state.roofShape;
  const hasOverhangEl = document.getElementById('hasOverhang');
  if (hasOverhangEl) hasOverhangEl.checked = !!state.hasOverhang;
  const hasParapetEl = document.getElementById('hasParapet');
  if (hasParapetEl) hasParapetEl.checked = !!state.hasParapet;
  const parapetHeightEl = document.getElementById('parapetHeight');
  if (parapetHeightEl) parapetHeightEl.value = state.parapetHeight;

  // Open Building — Free Roof (Sec. 27.3.2) inputs
  const openRoofShapeEl = document.getElementById('openRoofShape');
  if (openRoofShapeEl) openRoofShapeEl.value = state.openRoofShape;
  const openWindFlowEl = document.getElementById('openWindFlow');
  if (openWindFlowEl) openWindFlowEl.value = state.openWindFlow;
  const openLEl = document.getElementById('openL');
  if (openLEl) openLEl.value = state.openL;

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
  applyEnclosureVisibility();
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
    const roofShapeSel = document.getElementById('roofShape');
    if (roofShapeSel) {
      roofShapeSel.value = state.roofShape || 'gable';
      state.roofShape = roofShapeSel.value;
    }
    const hasOverhangEl = document.getElementById('hasOverhang');
    if (hasOverhangEl) hasOverhangEl.checked = !!state.hasOverhang;
    const hasParapetEl = document.getElementById('hasParapet');
    if (hasParapetEl) hasParapetEl.checked = !!state.hasParapet;
    const parapetHeightEl = document.getElementById('parapetHeight');
    if (parapetHeightEl) parapetHeightEl.value = fmt(lengthOut(state.parapetHeight), 2);

    // Open Building — Free Roof (Sec. 27.3.2) inputs
    const openRoofShapeEl = document.getElementById('openRoofShape');
    if (openRoofShapeEl) {
      openRoofShapeEl.value = state.openRoofShape || 'monoslope';
      state.openRoofShape = openRoofShapeEl.value;
    }
    const openWindFlowEl = document.getElementById('openWindFlow');
    if (openWindFlowEl) {
      openWindFlowEl.value = state.openWindFlow || 'clear';
      state.openWindFlow = openWindFlowEl.value;
    }
    const openLEl = document.getElementById('openL');
    if (openLEl) openLEl.value = fmt(lengthOut(state.openL || 40), 2);

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
    applyEnclosureVisibility();
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
