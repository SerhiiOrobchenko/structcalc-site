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

// Escape free-text user input before inserting it into an innerHTML string
// (used by the print title block, which is built via string concatenation).
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  partiallyOpen: { pos: 0.00, neg: 0.00, label: 'Partially Open' }, // ASCE 7-22 Table 26.13-1: GCpi = 0.00 (was 0.18 in ASCE 7-16)
  open: { pos: 0.0, neg: 0.0, label: 'Open' },
  // Open Building with monoslope/pitched/troughed free roof — Sec. 27.3.2,
  // Eq. 27.3-2: p = q<sub>h</sub> K<sub>d</sub> G C<sub>N</sub>. This procedure does not use (GC<sub>pi</sub>) at
  // all (C<sub>N</sub> is already a net pressure coefficient), so `noGcpi` suppresses
  // the (GC<sub>pi</sub>) display/selection for this option (see init()).
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

// ─────────────────────────────────────────────────────────────────────────────
// Ch.30 Part 2 (Sec. 30.4) — C&C for buildings with h > 60 ft
// Eq. 30.4-1: p = q·Kd·(GCp) − qi·Kd·(GCpi)
//   Note 4 (Fig. 30.4-1): use qz with positive (GCp), qh with negative (GCp); qi = qh throughout.
// Min. effective wind area = 20 sf. Exception: Part 1 allowed for 60 < h ≤ 90 ft if h ≤ least dim.
//
// GCp source: ASCE 7-16 Fig. 30.6-1 → renumbered ASCE 7-22 Fig. 30.4-1.
// ⚠️ Fig. 30.4-1 revised in Errata 1 (2024-09-20) — verify against current ASCE 7-22.
// Wall   Zone 4: GCp+ +1.0→+0.8, GCp− −1.0→−0.8  (A = 20→500 sf)
// Wall   Zone 5: GCp+ +1.0→+0.8, GCp− −1.3→−0.8
// Roof   Zone 1: GCp+ +0.3 (const), GCp− −1.0→−0.8
// Roof   Zone 2: GCp+ +0.3 (const), GCp− −1.8→−1.1
// Roof   Zone 3: GCp+ +0.3 (const), GCp− −2.8→−1.1
// ─────────────────────────────────────────────────────────────────────────────
const GCP_WALL_P2 = {
  Alo: 20, Ahi: 500,
  '4': { neg: { lo: -1.0, hi: -0.8 }, pos: { lo: 1.0, hi: 0.8 } },
  '5': { neg: { lo: -1.3, hi: -0.8 }, pos: { lo: 1.0, hi: 0.8 } }
};
const GCP_ROOF_P2_FLAT = {
  Alo: 20, Ahi: 500,
  '1': { neg: { lo: -1.0, hi: -0.8 }, pos: { lo: 0.3, hi: 0.3 } },
  '2': { neg: { lo: -1.8, hi: -1.1 }, pos: { lo: 0.3, hi: 0.3 } },
  '3': { neg: { lo: -2.8, hi: -1.1 }, pos: { lo: 0.3, hi: 0.3 } }
};

// ── Ch.27 / Fig. 27.3-1 — Sloped Roof Cp, Wind Normal to Ridge (θ ≥ 10°) ──────────────────────────
// Source: ASCE 7-22 Fig. 27.3-1, p.284, read from PDF image (ASCESEI 7-22 PDF, page idx 344).
// Two Cp values per cell — both cases shall be designed for per Fig. 27.3-1 Note 3.
//   cp1 = more-negative / less-positive value (primary suction / transitional)
//   cp2 = less-negative / more-positive value (reattachment / positive pressure check)
// θ breakpoints: [10,15,20,25,30,35,45]°; linear interpolation permitted (Note 1).
// h/L breakpoints: [0.25, 0.5, 1.0]; clamp hL to [0.25,1.0]; linear interpolation.
// For θ > 45°: Cp = 0.01θ (h/L-independent, single positive value), capped at 0.8 for θ > 80°.
// Leeward slope (all h/L): 10°→−0.3, 15°→−0.5, ≥20°→−0.6; interpolate for intermediate θ.
const CP_ROOF_NTR = {
  thetas: [10, 15, 20, 25, 30, 35, 45],
  hLs:    [0.25, 0.5, 1.0],
  // cp1[hL idx][θ idx] — more-negative / less-positive
  cp1: [
    [-0.7,  -0.5,  -0.3,  -0.2,  -0.2,  0.3,  0.4],   // h/L ≤ 0.25  (0.3ᵃ = interpolation anchor)
    [-0.9,  -0.7,  -0.4,  -0.3,  -0.2, -0.2,  0.0],   // h/L = 0.5   (0.0ᵃ = interpolation anchor)
    [-1.3,  -1.0,  -0.7,  -0.5,  -0.3, -0.2,  0.0],   // h/L ≥ 1.0   (−1.3ᵃ, 0.0ᵃ = anchors)
  ],
  // cp2[hL idx][θ idx] — less-negative / more-positive (Note 3 dual-case)
  cp2: [
    [-0.18,  0.0,  0.2,  0.3,  0.3,  0.4,  0.4],      // h/L ≤ 0.25  (0.0ᵃ = interpolation anchor)
    [-0.18, -0.18, 0.0,  0.2,  0.2,  0.3,  0.4],      // h/L = 0.5   (0.0ᵃ = interpolation anchor)
    [-0.18, -0.18, -0.18, 0.0,  0.2,  0.2,  0.3],     // h/L ≥ 1.0   (0.0ᵃ = interpolation anchor)
  ]
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
   p = q<sub>h</sub> K<sub>d</sub> G C<sub>N</sub>
   G  = Gust-Effect Factor, Sec. 26.11. This calculator uses G = 0.85 for
        rigid structures (Sec. 26.11.1). The flexible-structure G_f
        procedure (Sec. 26.11.3-26.11.5, requires fundamental natural
        frequency) is NOT implemented — verify directly if the structure's
        natural frequency is below 1 Hz.
   C<sub>N</sub> = Net pressure coefficient, Figs. 27.3-4 (monoslope), 27.3-5
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
// from the windward edge: <= h, > h to <= 2h, > 2h. Single C<sub>N</sub> per zone/load
// case (no C<sub>NW</sub>/C<sub>NL</sub> split). Also governs Fig. 27.3-4 Note 4 (monoslope,
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
let lastResult = null; // most recent compute() output, cached for the PDF/Excel report exporters

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
  kzt: 1.0,          // topographic factor — used when kztMode='manual' (Sec. 26.8)
  kztMode: 'flat',   // 'flat' (K_zt=1.0) | 'auto' (compute from topo inputs) | 'manual'
  topoFeature: '2DRidge', // '2DRidge' | '2DEscarp' | '3DHill'
  topoH:  30,        // hill/ridge/escarpment height H, ft (Fig. 26.8-1)
  topoLh: 150,       // horizontal dist. crest to H/2 on windward side, L_h, ft
  topoX:  0,         // horiz. dist. from crest to site, ft (+ = downwind/leeward)
  groundElev: 0,     // ground elevation above sea level, ft (Sec. 26.9)
  enclosure: 'enclosed', // enclosed / partiallyEnclosed / partiallyOpen / open (Sec. 26.13)
  h: 20,             // mean roof height, ft (Sec. 26.2 / 26.3)
  minDim: 60,        // least horizontal dimension of the building, ft
  theta: 10,         // roof angle, degrees
  areaWall: 20,      // C&C effective wind area, walls, ft^2
  areaRoof: 50,      // C&C effective wind area, roof, ft^2
  hasOverhang: false, // Sec. 30.7 — building has roof overhangs requiring overhang C&C pressures
  hasParapet: false, // Sec. 27.3.4 (MWFRS) / Sec. 30.6 (C&C) — building has a parapet
  parapetHeight: 3,  // height of parapet above the roof surface, ft (used to compute q<sub>p</sub> at top of parapet)
  hasCanopy: false,  // Sec. 30.9 — building has an attached canopy requiring canopy C&C pressures
  canopyArea: 50,    // effective wind (tributary) area for the canopy panel/fastener being designed, ft²
  canopyHc: 10,      // canopy height above grade (or reference datum), ft — h_c in Figs. 30.9-1B/2B
  canopyHe: 12,      // building eave height, ft — h_e in Figs. 30.9-1B/2B (h_c/h_e ratio governs net (GCp))
  hasCircularTank: false, // Sec. 30.10 — a circular bin/silo/tank requiring its own C&C pressures
  tankD: 30,         // tank/bin/silo diameter, D, ft (Fig. 30.10-1 Notation)
  tankH: 40,         // cylinder height, H, ft (Fig. 30.10-1 Notation) — H/D must be 0.25-4.0 for Eq. 30.10-2/3/4 to apply
  tankOpenTop: false, // open-topped tank → use Eq. 30.10-5 (GCpi) instead of the page's enclosure-based (GCpi)
  tankElevated: false, // tank is elevated on columns → also compute underside pressures, Sec. 30.10.5

  hasSteppedRoof: false, // Fig. 30.3-3 — building has a stepped (multi-level flat) roof, θ ≤ 7°
  steppedLowerH: 12,  // mean roof height of the LOWER roof level, ft (the page's main "h" field above is the TALLER level)
  steppedLowerW: 30,  // plan width of the lower roof level, measured perpendicular to the step (in the along-wind direction), ft

  hasMultispanRoof: false, // Fig. 30.3-4 — building has a multispan gable roof (2+ repeating gable spans)
  msModuleW: 30, // single-span module width W', ft (Fig. 30.3-4 Notation) — reuses the page's theta/h/buildingL/areaRoof fields

  hasSawtoothRoof: false, // Fig. 30.3-6 — building has a sawtooth (repeating monoslope) roof, 2+ spans
  swModuleW: 30, // single-span module width W, ft (Fig. 30.3-6 Notation) — reuses the page's theta/h/buildingL/areaRoof fields

  hasDomeRoof: false, // Fig. 30.3-7 — domed roof with a circular base
  domeD: 60,  // dome diameter, D, ft (Fig. 30.3-7 Notation)
  domeF: 12,  // dome rise, f, ft (Fig. 30.3-7 Notation) — applicability per Note 4: 0.2 <= f/D <= 0.5
  domeHD: 20, // height to base of dome, h_D, ft (Fig. 30.3-7 Notation) — applicability per Note 4: 0 <= h_D/D <= 0.5

  // Open Building — Free Roof (Sec. 27.3.2), only used when enclosure === 'openFreeRoof'
  openRoofShape: 'monoslope', // 'monoslope' | 'pitched' | 'troughed' — Figs. 27.3-4/5/6
  openWindFlow: 'clear',      // 'clear' | 'obstructed' — Figs. 27.3-4/5/6/7 Note 2
  openL: 40,                  // horizontal roof dimension in the along-wind direction, L, ft (Fig. 27.3-4 Notation)

  // Open Building C&C (Sec. 30.5) — Figs. 30.5-1/2/3
  ch305Lmin: 40,  // least horizontal plan dimension (for zone width a), ft (Fig. 30.5-1 Notation)
  ch305A:    100, // effective wind area A for C&C, ft² (Fig. 30.5-1)

  // Ch.32 Tornado Loads — Secs. 32.1–32.17 (Risk Category III/IV only)
  ch32Enabled:  false,  // toggle: compute tornado loads alongside wind
  ch32VT:       100,    // tornado speed V_T, mph — from ASCE 7 Hazard Tool (Figs. 32.5-1/2)
  ch32Ae:       10000,  // effective plan area A_e, ft² (Sec. 32.5.4) — for map selection reference
  ch32Essential: false, // true = Essential Facility (affects K_dT for C&C, Table 32.6-1)

  // Report header fields (Phase 4) — informational only, do not affect calculations
  projectName: '',
  projectNumber: '',
  engineer: '',
  projectDate: '',   // ISO yyyy-mm-dd; defaulted to today on init if empty
  riskCategory: 'II', // Table 1.5-1 — recorded for the report header only

  // Print title block fields (Phase 3) — informational only, do not affect calculations
  companyName: '',   // firm/company name shown in the title block
  sectionName: '',   // calc section/discipline label (e.g. "Lateral Loads")
  jobRef: '',        // job/project reference number for the title block
  chkdBy: '',        // "Checked by" name
  chkdDate: '',      // "Checked" date, ISO yyyy-mm-dd
  appdBy: '',        // "Approved by" name
  appdDate: '',      // "Approved" date, ISO yyyy-mm-dd

  // Ch.27 Directional Procedure inputs (Sec. 27.3)
  mwfrsProcedure: 'envelope', // 'envelope' (Ch.28, low-rise) | 'directional' (Ch.27, all heights)
  ccProcedure: 'part1',     // 'part1' (Ch.30 Part 1, h ≤ 60 ft) | 'part2' (Ch.30 Part 2, h > 60 ft)
  buildingL: 60,    // building dimension parallel to wind direction, ft (for L/B leeward Cp, Ch.27)

  // Ch.29 Other Structures (Directional Procedure, Sec. 29.1–29.4.1)
  structureCategory: 'building', // 'building' | 'otherStructure'
  ch29Type: 'solidSign',     // 'solidSign'|'chimney'|'openSign'|'trussedTower'|'rooftopEquip'
  ch29B:    40,   // sign/wall horizontal dimension B, ft
  ch29S:    5,    // sign/wall clearance (ground to bottom of sign), ft
  ch29H:    20,   // structure height h, ft
  ch29D:    5,    // diameter or least horizontal dimension D, ft (chimney/tank)
  ch29Af:   100,  // projected area normal to wind Af, ft²
  ch29As:   200,  // gross area As, ft² (solid sign = B × h for Case A/B)
  ch29CrossSection: 'round_smooth', // chimney/tank cross-section
  ch29Eps:  0.30, // solidity ratio ε (open sign / trussed tower)
  ch29MemberType: 'flat', // open-sign member type: 'flat'|'round_smooth'|'round_rough'
  ch29TowerShape: 'square', // trussed tower plan shape: 'square'|'triangle'
  ch29Ar:   80,   // rooftop equip: projected area on horizontal plane Ar, ft²
  ch29Bh:   600,  // rooftop equip: B × h of supporting building, ft²
  ch29BL:   3600, // rooftop equip: B × L of building roof, ft²
  // Sec. 30.8 C&C for Rooftop Structures/Equipment — tributary surface areas
  // for the specific wall/roof panel being designed (default = Af/Ar, i.e. the
  // full unit, but may be set smaller for an individual cladding panel/fastener)
  ch29CCAwall: 80,  // rooftop equip C&C: wall tributary area, ft² (default = Af)
  ch29CCAroof: 80,  // rooftop equip C&C: roof tributary area, ft² (default = Ar)
  // Sec. 29.4.3 Rooftop Solar Panels
  ch29SolarOmega: 10,   // panel tilt ω (°), 0–35
  ch29SolarLp:    6.0,  // panel chord length Lp (ft)
  ch29SolarA:     50,   // effective wind area A (ft²) of structural element
  ch29SolarH1:    0.5,  // lower panel-edge height above roof h₁ (ft)
  ch29SolarH2:    2.0,  // upper panel-edge height above roof h₂ (ft)
  ch29SolarHpt:   0,    // mean parapet height above roof hpt (ft); 0 = none
  ch29SolarD1:    20,   // d₁ to adjacent array or building edge (ft)
  ch29SolarD2:    3,    // d₂ to next row of panels (ft)
  ch29SolarZone:  1,    // roof zone: 1=interior, 2=edge, 3=corner
  ch29SolarWL:    120,  // building longer side WL (ft)
  ch29SolarWs:    60    // building shorter side Ws (ft)
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
// (Table 26.10-1) as q<sub>h</sub> but at the higher elevation.
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
  const kztP = computeKzt(s, zParapet); return { zParapet, khp, qp: 0.00256 * khp * kztP.kzt * ke * s.V * s.V };
}

// Parapets — C&C: Sec. 30.6 ("Parapets"), Eq. 30.6-1: p = qp[(GCp) - (GCpi)]. Per the
// two-load-case approach described in Meca Enterprises' "Wind Load on Parapets"
// article (citing the analogous ASCE 7-16 Ch. 30 Part 6 / Sec. 30.8, renumbered to
// Sec. 30.6 in ASCE 7-22):
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

// Attached Canopies on Buildings — Sec. 30.9 (Eq. 30.9-1: p = qh Kd (GCp), no
// (GCpi) term — both canopy faces are exterior surfaces). (GCp) is read from
// Fig. 30.9-1A/1B (h <= 60 ft) or 30.9-2A/2B (h > 60 ft):
//   Figs. -1A/-2A ("separate surfaces") — distinct upper-surface and
//     lower-surface (GCp), each acting alone, used for fastener design.
//   Figs. -1B/-2B ("net/combined") — a single net (GCp) combining both
//     surfaces simultaneously, used for structural design of the canopy
//     framing; depends on h_c/h_e (canopy height / building eave height).
// Canopies are flat (roof slope <= 2%) per Sec. 30.9 — distinct from roof
// overhangs (Sec. 30.7, gcpOverhang above) and open-building free roofs
// (Sec. 27.3.2/30.5).
//
// Values below transcribe ASCE 7-22 Commentary Tables C30.9-1 through
// C30.9-4 (verified directly against the Standard/Commentary text), each of
// which gives (GCp) as a piecewise log-area formula anchored at A = 10 and
// 100 ft² (h <= 60 ft tables) or 10, 100, and 1000 ft² (h > 60 ft tables).
// For A < 10 ft², the A = 10 ft² anchor value governs; beyond the table's
// upper bound the last tabulated value governs (flagged via `capped`).
// NOTE: Table C30.9-3's negative upper-surface formula has a genuine
// discontinuity at A = 100 ft² as published (confirmed against source text)
// — this is intentionally NOT smoothed over.
function gcpCanopySeparate(A, hGt60) {
  const a = Math.max(A, 10);
  const La = Math.log10(a);
  let negUpper, negLower, pos, capped = false;
  if (!hGt60) {
    // Table C30.9-1 (Fig. 30.9-1A), h <= 60 ft
    negUpper = a <= 10 ? -1.15 : (a <= 100 ? (-1.55 + 0.1737 * La) : -0.75);
    negLower = a <= 10 ? -0.8 : (a <= 100 ? (-0.95 + 0.0651 * La) : -0.65);
    pos = a <= 10 ? 0.8 : (a <= 100 ? (1.0 - 0.087 * La) : 0.6);
    if (A > 100) capped = true;
  } else {
    // Table C30.9-3 (Fig. 30.9-2A), h > 60 ft
    const ac = Math.min(a, 1000);
    const Lac = Math.log10(ac);
    negUpper = a <= 10 ? -1.9 : (a <= 100 ? (-2.1 + 0.0869 * La) : (-3.1 + 0.304 * Lac));
    negLower = a <= 10 ? -1.0 : (a <= 100 ? (-1.2 + 0.0869 * La) : (-1.4 + 0.1303 * Lac));
    pos = a <= 10 ? 0.8 : (a <= 100 ? (1.0 - 0.087 * La) : 0.6);
    if (A > 1000) capped = true;
  }
  return { negUpper, negLower, pos, capped };
}

function gcpCanopyNet(A, hcRatio, hGt60) {
  const a = Math.max(A, 10);
  const La = Math.log10(a);
  let neg, pos, band, capped = false;
  if (!hGt60) {
    // Table C30.9-2 (Fig. 30.9-1B), h <= 60 ft
    if (hcRatio >= 0.9) {
      band = '0.9 ≤ h_c/h_e ≤ 1';
      neg = a <= 10 ? -1.4 : (a <= 100 ? (-1.7 + 0.1303 * La) : -1.1);
    } else if (hcRatio > 0.5) {
      band = '0.5 < h_c/h_e < 0.9';
      neg = a <= 10 ? -0.9 : (a <= 100 ? (-1.15 + 0.1086 * La) : -0.65);
    } else {
      band = 'h_c/h_e ≤ 0.5';
      neg = a <= 10 ? -0.6 : (a <= 100 ? (-0.7 + 0.0434 * La) : -0.5);
    }
    pos = a <= 10 ? 0.9 : (a <= 100 ? (1.15 - 0.109 * La) : 0.65);
    if (A > 100) capped = true;
  } else {
    // Table C30.9-4 (Fig. 30.9-2B), h > 60 ft
    const ac = Math.min(a, 1000);
    const Lac = Math.log10(ac);
    if (hcRatio >= 0.9) {
      band = '0.9 ≤ h_c/h_e ≤ 1';
      neg = a <= 10 ? -2.3 : (a <= 100 ? (-2.5 + 0.0869 * La) : (-3.9 + 0.3909 * Lac));
    } else {
      band = (hcRatio > 0.1)
        ? '0.1 < h_c/h_e < 0.9'
        : 'h_c/h_e ≤ 0.1 (below tabulated range — lowest tabulated band used)';
      if (hcRatio <= 0.1) capped = true;
      neg = a <= 10 ? -1.3 : (a <= 100 ? (-1.85 + 0.2389 * La) : -0.75);
    }
    pos = a <= 10 ? 0.9 : (a <= 100 ? (1.15 - 0.109 * La) : 0.65);
    if (A > 1000) capped = true;
  }
  return { neg, pos, band, capped };
}

// --- Circular Bins, Silos, and Tanks (Sec. 30.10) ---
// Eq. 30.10-1: p = qh Kd [(GCp) - (GCpi)].
//
// Sec. 30.10.2 walls — Eqs. (30.10-2)-(30.10-4): the external pressure
// coefficient varies around the circumference as a function of the angle
// alpha (degrees, measured from the windward stagnation point) and the
// aspect ratio H/D (cylinder height / diameter), valid for 0.25 <= H/D <= 4.0:
//   C(alpha) = -0.5 + 0.4cos(a) + 0.8cos(2a) + 0.3cos(3a) - 0.1cos(4a) - 0.05cos(5a)
//   kb = 1.0                                  for C(alpha) >= -0.15
//   kb = 1.0 - 0.55*(C(alpha)+0.15)*log10(H/D) for C(alpha) <  -0.15
//   (GCp)(alpha) = kb * C(alpha)
// Transcribed character-for-character from the ASCE/SEI 7-22 standard text;
// numerically cross-checked against ASCE/SEI 7-22 Commentary Table C30.10-1
// (which tabulates (GCp)-(GCpi) for open-topped tanks at H/D = 0.25-4 in
// 15-degree steps) at H/D = 1 -- this formula combined with Eq. (30.10-5)
// reproduces the table's values exactly or within publication rounding
// (e.g., within 0.05 at alpha = 90/45/135/15/30/75/105/120 deg, and within
// ~0.15 at the two largest deviations, alpha = 0 and 60 deg) -- consistent
// with the formula as published, not an invented approximation.
function tankWallC(alphaDeg) {
  const a = alphaDeg * Math.PI / 180;
  return -0.5 + 0.4 * Math.cos(a) + 0.8 * Math.cos(2 * a) + 0.3 * Math.cos(3 * a)
       - 0.1 * Math.cos(4 * a) - 0.05 * Math.cos(5 * a);
}
function tankWallGCp(alphaDeg, HD) {
  const C = tankWallC(alphaDeg);
  const kb = (C >= -0.15) ? 1.0 : (1.0 - 0.55 * (C + 0.15) * Math.log10(HD));
  return kb * C;
}
// Sec. 30.10.3 — Eq. (30.10-5): internal pressure coefficient for the
// internal surface of exterior walls of OPEN-TOPPED circular bins, silos,
// and tanks only (closed-top tanks use the page's normal enclosure-based
// (GCpi) per Table 26.13-1, referenced by Eq. 30.10-1 itself).
function tankOpenGCpi(HD) {
  return -0.9 - 0.35 * Math.log10(HD);
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
// C<sub>NW</sub>/C<sub>NL</sub> table for gamma = 0/180, rows tabulated at theta = 7.5-45 deg
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
// the 3-zone C<sub>N</sub> array [<=h, >h..<=2h, >2h] for the given load case/wind flow.
function cnFig277(loadCase, windFlow) {
  return CN_FIG277[loadCase][windFlow];
}

// ── K_zt — Topographic Factor (Sec. 26.8) ─────────────────────────────────
// Source: ASCE/SEI 7-22 Sec. 26.8 and Table 26.8-1.
// K_zt = (1 + K_1 · K_2 · K_3)²
//   K_1 = (K_1/H_Lh_ratio) × (H/L_h)         — speed-up coefficient
//   K_2 = max(0, 1 − |x| / (μ × L_h))         — horizontal attenuation
//   K_3 = exp(−γ × z / L_h)                    — height decay
// Applicability (Sec. 26.8.1): H/L_h ≥ 0.2; site in upper half of feature.
// If H/L_h < 0.2 or kztMode='flat', K_zt = 1.0.

const KZT_K1_COEFF = {      // Table 26.8-1: K_1/(H/L_h) per feature & exposure
  '2DRidge':  { B: 1.30, C: 1.45, D: 1.55 },
  '2DEscarp': { B: 0.75, C: 0.85, D: 0.95 },
  '3DHill':   { B: 0.95, C: 1.05, D: 1.15 }
};
const KZT_MU = {             // μ for K_2 = 1 − |x|/(μ × L_h) — upwind/downwind
  '2DRidge':  { up: 1.5, down: 1.5 },
  '2DEscarp': { up: 2.5, down: 1.5 }, // escarpment: longer attenuation upwind
  '3DHill':   { up: 1.5, down: 1.5 }
};
const KZT_GAMMA = { '2DRidge': 3, '2DEscarp': 2.5, '3DHill': 4 }; // γ for K_3

function computeKzt(s, z) {
  // z = evaluation height (typically mean roof height h, or z_parapet for parapets)
  if (s.kztMode === 'manual') return { kzt: s.kzt, auto: false };
  if (s.kztMode === 'flat')   return { kzt: 1.0,   auto: false };

  const H  = s.topoH;
  const Lh = s.topoLh;
  const x  = s.topoX;
  const ft = s.topoFeature;
  const exp = s.exposure; // 'B'|'C'|'D'

  if (!KZT_K1_COEFF[ft] || Lh <= 0) return { kzt: 1.0, auto: true, err: 'Invalid inputs' };

  const hLh = H / Lh;
  if (hLh < 0.2) {
    // Sec. 26.8.1: K_zt = 1.0 when H/L_h < 0.2
    return { kzt: 1.0, auto: true, hLh, K1: 0, K2: 0, K3: 0, note: 'H/L_h < 0.2 → K_zt = 1.0 (Sec. 26.8.1)' };
  }

  const K1coeff = KZT_K1_COEFF[ft][exp] || KZT_K1_COEFF[ft]['C'];
  const K1 = K1coeff * hLh;

  const mu = x >= 0 ? KZT_MU[ft].down : KZT_MU[ft].up;
  const K2 = Math.max(0, 1 - Math.abs(x) / (mu * Lh));

  const gamma = KZT_GAMMA[ft];
  const K3 = Math.exp(-gamma * Math.max(0, z) / Lh);

  const kzt = Math.pow(1 + K1 * K2 * K3, 2);
  return { kzt, auto: true, hLh, K1, K2, K3, mu, gamma, K1coeff };
}


/* =====================================================================
   CHAPTER 27 — DIRECTIONAL PROCEDURE (MWFRS, ALL HEIGHTS)
   ASCE 7-22 Sec. 27.3 / Eq. 27.3-1: p = qGC_p − q_i(GC_pi)
   Sources:
     - Fig. 27.3-1 (wall and roof Cp, including Note 3 for dual roof Cp values)
     - Sec. 26.11.1 (G = 0.85 for rigid structures)
     - Table 26.10-1 Note 1 (K_z formula — no Ch.28 footnote exception applies here)
     - Sec. 27.1.5 (minimum design wind loads: walls ≥ 16 psf, roof ≥ 8 psf)
   ===================================================================== */

// ── Sec. 30.5 Open Building C&C (Figs. 30.5-1/2/3) ─────────────────────────
// CN305_DATA[shape][flow][thetaIdx][areaIdx] = [z3+,z3−,z2+,z2−,z1+,z1−]
// shape: 'monoslope'|'pitched'|'troughed'; flow: 'clear'|'obstr'
// thetaIdx: 0..4 → [0,7.5,15,30,45] deg  areaIdx: 0=≤a², 1=>a²≤4a², 2=>4a²
// Source: Fig. 30.5-1 (monoslope), 30.5-2 (pitched), 30.5-3 (troughed), ASCE 7-22
const CN305_ANGLES = [0, 7.5, 15, 30, 45];
const CN305_DATA = {
  monoslope: {
    clear: [
      [[2.4,-3.3,1.8,-1.7,1.2,-1.1],[1.8,-1.7,1.8,-1.7,1.2,-1.1],[1.2,-1.1,1.2,-1.1,1.2,-1.1]],
      [[3.2,-4.2,2.4,-2.1,1.6,-1.4],[2.4,-2.1,2.4,-2.1,1.6,-1.4],[1.6,-1.4,1.6,-1.4,1.6,-1.4]],
      [[3.6,-3.8,2.7,-2.9,1.8,-1.9],[2.7,-2.9,2.7,-2.9,1.8,-1.9],[1.8,-1.9,1.8,-1.9,1.8,-1.9]],
      [[5.2,-5.0,3.9,-3.8,2.6,-2.5],[3.9,-3.8,3.9,-3.8,2.6,-2.5],[2.6,-2.5,2.6,-2.5,2.6,-2.5]],
      [[5.2,-4.6,3.9,-3.5,2.6,-2.3],[3.9,-3.5,3.9,-3.5,2.6,-2.3],[2.6,-2.3,2.6,-2.3,2.6,-2.3]]
    ],
    obstr: [
      [[1.0,-3.6,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]],
      [[1.6,-5.1,1.2,-2.6,0.8,-1.7],[1.2,-2.6,1.2,-2.6,0.8,-1.7],[0.8,-1.7,0.8,-1.7,0.8,-1.7]],
      [[2.4,-4.2,1.8,-3.2,1.2,-2.1],[1.8,-3.2,1.8,-3.2,1.2,-2.1],[1.2,-2.1,1.2,-2.1,1.2,-2.1]],
      [[3.2,-4.6,2.4,-3.5,1.6,-2.3],[2.4,-3.5,2.4,-3.5,1.6,-2.3],[1.6,-2.3,1.6,-2.3,1.6,-2.3]],
      [[4.2,-3.8,3.2,-2.9,2.1,-1.9],[3.2,-2.9,3.2,-2.9,2.1,-1.9],[2.1,-1.9,2.1,-1.9,2.1,-1.9]]
    ]
  },
  pitched: {
    clear: [
      [[2.4,-3.3,1.8,-1.7,1.2,-1.1],[1.8,-1.7,1.8,-1.7,1.2,-1.1],[1.2,-1.1,1.2,-1.1,1.2,-1.1]],
      [[2.2,-3.6,1.7,-1.8,1.1,-1.2],[1.7,-1.8,1.7,-1.8,1.1,-1.2],[1.1,-1.2,1.1,-1.2,1.1,-1.2]],
      [[2.2,-2.2,1.7,-1.7,1.1,-1.1],[1.7,-1.7,1.7,-1.7,1.1,-1.1],[1.1,-1.1,1.1,-1.1,1.1,-1.1]],
      [[2.6,-1.8,2.0,-1.4,1.3,-0.9],[2.0,-1.4,2.0,-1.4,1.3,-0.9],[1.3,-0.9,1.3,-0.9,1.3,-0.9]],
      [[2.2,-1.6,1.7,-1.2,1.1,-0.8],[1.7,-1.2,1.7,-1.2,1.1,-0.8],[1.1,-0.8,1.1,-0.8,1.1,-0.8]]
    ],
    obstr: [
      [[1.0,-3.6,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]],
      [[1.0,-5.1,0.8,-2.6,0.5,-1.7],[0.8,-2.6,0.8,-2.6,0.5,-1.7],[0.5,-1.7,0.5,-1.7,0.5,-1.7]],
      [[1.0,-3.2,0.8,-2.4,0.5,-1.6],[0.8,-2.4,0.8,-2.4,0.5,-1.6],[0.5,-1.6,0.5,-1.6,0.5,-1.6]],
      [[1.0,-2.4,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]],
      [[1.0,-2.4,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]]
    ]
  },
  troughed: {
    clear: [
      [[2.4,-3.3,1.8,-1.7,1.2,-1.1],[1.8,-1.7,1.8,-1.7,1.2,-1.1],[1.2,-1.1,1.2,-1.1,1.2,-1.1]],
      [[2.4,-3.3,1.8,-1.7,1.2,-1.1],[1.8,-1.7,1.8,-1.7,1.2,-1.1],[1.2,-1.1,1.2,-1.1,1.2,-1.1]],
      [[2.2,-2.2,1.7,-1.7,1.1,-1.1],[1.7,-1.7,1.7,-1.7,1.1,-1.1],[1.1,-1.1,1.1,-1.1,1.1,-1.1]],
      [[1.8,-2.6,1.4,-2.0,0.9,-1.3],[1.4,-2.0,1.4,-2.0,0.9,-1.3],[0.9,-1.3,0.9,-1.3,0.9,-1.3]],
      [[1.6,-2.2,1.2,-1.7,0.8,-1.1],[1.2,-1.7,1.2,-1.7,0.8,-1.1],[0.8,-1.1,0.8,-1.1,0.8,-1.1]]
    ],
    obstr: [
      [[1.0,-3.6,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]],
      [[1.0,-4.8,0.8,-2.4,0.5,-1.6],[0.8,-2.4,0.8,-2.4,0.5,-1.6],[0.5,-1.6,0.5,-1.6,0.5,-1.6]],
      [[1.0,-2.4,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]],
      [[1.0,-2.8,0.8,-2.1,0.5,-1.4],[0.8,-2.1,0.8,-2.1,0.5,-1.4],[0.5,-1.4,0.5,-1.4,0.5,-1.4]],
      [[1.0,-2.4,0.8,-1.8,0.5,-1.2],[0.8,-1.8,0.8,-1.8,0.5,-1.2],[0.5,-1.2,0.5,-1.2,0.5,-1.2]]
    ]
  }
};

// computeCC30Sec305(s) — open building C&C per Sec. 30.5, Eq. 30.5-1: p = qh·Kd·G·CN
// Applicable: open buildings, all heights, monoslope/pitched/troughed free roofs, θ ≤ 45°, 0.25 ≤ h/L ≤ 1.0
// Source: ASCE 7-22 Sec. 30.5.2, Figs. 30.5-1/2/3
function computeCC30Sec305(s) {
  const shape   = s.openRoofShape;        // 'monoslope'|'pitched'|'troughed'
  const obstr   = s.openWindFlow === 'obstructed';
  const theta   = s.theta;
  const h       = s.h;
  const Lmin    = s.ch305Lmin;           // least horizontal plan dimension (ft)
  const A       = s.ch305A;             // effective wind area (ft²)
  const KD      = 0.85;                  // Table 26.6-1
  const G       = G_RIGID;              // 0.85, Sec. 26.11.1

  // Zone width a (Fig. 30.5-1 Notation)
  const a = Math.max(Math.min(0.1 * Lmin, 0.4 * h), Math.max(0.04 * Lmin, 3));
  const a2 = a * a, a24 = 4 * a2;
  const areaLabel = (A <= a2) ? '≤a²' : (A <= a24) ? '>a², ≤4a²' : '>4a²';
  const areaIdx   = (A <= a2) ? 0 : (A <= a24) ? 1 : 2;

  // qh at mean roof height h
  const kztObj = computeKzt(s, h);
  const kh     = computeKh(h, s.exposure);
  const ke     = computeKe(s.groundElev);
  const qh     = 0.00256 * kh * kztObj.kzt * ke * s.V * s.V;

  // CN lookup with linear theta interpolation (Fig. 30.5-1 Note 3)
  const flow = obstr ? 'obstr' : 'clear';
  const tbl  = CN305_DATA[shape][flow];
  const thetaC = Math.min(45, Math.max(0, theta));
  let i0 = CN305_ANGLES.length - 2;
  for (var k = 0; k < CN305_ANGLES.length - 1; k++) {
    if (thetaC <= CN305_ANGLES[k + 1]) { i0 = k; break; }
  }
  const t0 = CN305_ANGLES[i0], t1 = CN305_ANGLES[i0 + 1];
  const frac = (t1 === t0) ? 0 : (thetaC - t0) / (t1 - t0);
  const r0 = tbl[i0][areaIdx], r1 = tbl[i0 + 1][areaIdx];
  const cn = r0.map(function(v, j) { return v + frac * (r1[j] - v); });
  // cn = [z3+, z3-, z2+, z2-, z1+, z1-]

  const coeff = qh * KD * G;
  const zones = {
    Z3: { label: 'Zone 3 (Corner)',  CNp: cn[0], CNn: cn[1], pp: coeff * cn[0], pn: coeff * cn[1] },
    Z2: { label: 'Zone 2 (Edge)',    CNp: cn[2], CNn: cn[3], pp: coeff * cn[2], pn: coeff * cn[3] },
    Z1: { label: 'Zone 1 (Interior)',CNp: cn[4], CNn: cn[5], pp: coeff * cn[4], pn: coeff * cn[5] }
  };

  const hL = (s.openL > 0) ? h / s.openL : 0;
  const warnings = [];
  if (theta > 45)              warnings.push('θ > 45°: outside Fig. 30.5 range');
  if (hL < 0.25 || hL > 1.0)  warnings.push('h/L = ' + hL.toFixed(3) + ' outside 0.25–1.0 (Fig. 30.5-1 applicability)');

  return {
    shape, obstr, theta, h, hL, Lmin, A, a, areaIdx, areaLabel,
    KD, G, kh, ke, kztObj, qh, coeff, zones, warnings,
    eqRef: 'Eq. 30.5-1', figRef: 'Figs. 30.5-1/2/3'
  };
}

// reportCC30Sec305HTML(r) — HTML report block for open building C&C (Sec. 30.5)
function reportCC30Sec305HTML(r) {
  const c = r.cc30s305;
  if (!c) return '<p class="muted">Sec. 30.5 C&amp;C data unavailable.</p>';
  const u = (state.units === 'metric');
  const pU = u ? 'Pa' : 'psf';
  const lenU = u ? 'm' : 'ft';
  const aU = u ? 'm²' : 'ft²';
  const pF = u ? function(v){ return fmtP(v * 47.88); } : function(v){ return fmtP(v); };
  const shapeLabel = c.shape === 'monoslope' ? 'Monoslope' : c.shape === 'pitched' ? 'Pitched' : 'Troughed';

  var html = '';
  if (c.warnings.length) {
    html += '<div class="alert warn"><strong>Warnings:</strong> ' + c.warnings.join(' &bull; ') + '</div>';
  }
  html += '<table class="report-tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Reference</th></tr></thead><tbody>';
  html += '<tr><td>Roof type</td><td>' + shapeLabel + ' free roof</td><td>Fig. 30.5-' + (c.shape==='monoslope'?'1':c.shape==='pitched'?'2':'3') + '</td></tr>';
  html += '<tr><td>Wind flow</td><td>' + (c.obstr ? 'Obstructed (&gt;50% blockage)' : 'Clear (&le;50% blockage)') + '</td><td>Fig. 30.5-1 Note 2</td></tr>';
  html += '<tr><td>Roof angle, &theta;</td><td>' + fmt(c.theta,1) + '&deg;</td><td>—</td></tr>';
  html += '<tr><td>Mean roof height, h</td><td>' + fmt(c.h,2) + ' ' + lenU + '</td><td>—</td></tr>';
  html += '<tr><td>h / L</td><td>' + fmt(c.hL,3) + '</td><td>0.25 &le; h/L &le; 1.0 required</td></tr>';
  html += '<tr><td>Least plan dimension, L<sub>min</sub></td><td>' + fmt(c.Lmin,2) + ' ' + lenU + '</td><td>Fig. 30.5-1 Notation</td></tr>';
  html += '<tr><td>Zone width, a</td><td>' + fmt(c.a,2) + ' ' + lenU + '</td><td>min(0.1L<sub>min</sub>, 0.4h) &ge; max(0.04L<sub>min</sub>, 3 ft)</td></tr>';
  html += '<tr><td>Effective wind area, A</td><td>' + fmt(c.A,1) + ' ' + aU + '</td><td>—</td></tr>';
  html += '<tr><td>Area size</td><td>' + c.areaLabel + '</td><td>Fig. 30.5-1 table rows</td></tr>';
  html += '<tr><td>K<sub>d</sub></td><td>' + fmt(c.KD,2) + '</td><td>Table 26.6-1</td></tr>';
  html += '<tr><td>G (rigid)</td><td>' + fmt(c.G,2) + '</td><td>Sec. 26.11.1</td></tr>';
  html += '<tr><td>K<sub>z</sub> at h</td><td>' + fmt(c.kh,3) + '</td><td>Table 26.10-1</td></tr>';
  html += '<tr><td>K<sub>zt</sub> at h</td><td>' + fmt(c.kztObj.kzt,3) + '</td><td>Sec. 26.8</td></tr>';
  html += '<tr><td>K<sub>e</sub></td><td>' + fmt(c.ke,4) + '</td><td>Table 26.9-1</td></tr>';
  html += '<tr><td>q<sub>h</sub></td><td>' + (u ? fmtP(c.qh*47.88) : fmtP(c.qh)) + ' ' + pU + '</td><td>Eq. 26.10-1</td></tr>';
  html += '<tr><td>q<sub>h</sub>&middot;K<sub>d</sub>&middot;G</td><td>' + (u ? fmtP(c.coeff*47.88) : fmtP(c.coeff)) + ' ' + pU + '</td><td>Eq. 30.5-1 coefficient</td></tr>';
  html += '</tbody></table>';

  html += '<h4 style="margin:12px 0 6px">Net Design Pressures &mdash; p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;G&middot;C<sub>N</sub> <span class="ref">Eq. 30.5-1</span></h4>';
  html += '<p class="muted" style="margin:0 0 8px">+ toward top surface, &minus; away from top surface. Apply both + and &minus; cases.</p>';
  html += '<table class="report-tbl"><thead><tr><th>Zone</th><th>C<sub>N</sub> (+)</th><th>C<sub>N</sub> (&minus;)</th><th>p (+) ' + pU + '</th><th>p (&minus;) ' + pU + '</th></tr></thead><tbody>';
  ['Z3','Z2','Z1'].forEach(function(zk) {
    const z = c.zones[zk];
    html += '<tr><td>' + z.label + '</td><td>' + fmt(z.CNp,2) + '</td><td>' + fmt(z.CNn,2) + '</td>';
    html += '<td>' + pF(z.pp) + '</td><td>' + pF(z.pn) + '</td></tr>';
  });
  html += '</tbody></table>';
  html += '<p class="muted" style="margin:8px 0 0;font-size:0.82em">C<sub>N</sub> values from ' + c.figRef + ', ASCE 7-22. All load cases for each roof angle shall be investigated (Sec. 30.5.2). Verify h/L applicability directly.</p>';
  return html;
}

// ── Ch.30 Part 2 GCp helpers (Fig. 30.4-1) ─────────────────────────────────
function gcpWallP2(zone, A) {
  const tbl = GCP_WALL_P2, row = tbl[zone];
  if (!row) return { pos: 0, neg: 0, A };
  const Ac = Math.min(Math.max(A, tbl.Alo), tbl.Ahi);
  return { pos: logLerpA(Ac, tbl.Alo, tbl.Ahi, row.pos.lo, row.pos.hi),
           neg: logLerpA(Ac, tbl.Alo, tbl.Ahi, row.neg.lo, row.neg.hi), A: Ac };
}
function gcpRoofP2(zone, A) {
  const tbl = GCP_ROOF_P2_FLAT, row = tbl[zone];
  if (!row) return { pos: 0, neg: 0, A };
  const Ac = Math.min(Math.max(A, tbl.Alo), tbl.Ahi);
  return { pos: logLerpA(Ac, tbl.Alo, tbl.Ahi, row.pos.lo, row.pos.hi),
           neg: logLerpA(Ac, tbl.Alo, tbl.Ahi, row.neg.lo, row.neg.hi), A: Ac };
}

// ── Ch.30 Part 2 main computation (Sec. 30.4) ───────────────────────────────
// Eq. 30.4-1: p = q·Kd·(GCp) − qi·Kd·(GCpi)
// Note 4 (Fig. 30.4-1): positive GCp → q = qz; negative GCp → q = qh; qi = qh.
//   p_max = qz·Kd·(+GCp) − qh·Kd·(−GCpi)   [governs inward push]
//   p_min = qh·Kd·(−GCp) − qh·Kd·(+GCpi)   [governs suction]
// GCp source: see GCP_WALL_P2 / GCP_ROOF_P2_FLAT constant blocks above.
function computeCC30Part2(s) {
  const KD      = 0.85;
  const ke      = computeKe(s.groundElev);
  const gcpiVal = GCPI[s.enclosure]?.pos ?? 0.18;
  const kh      = khFromFormula(s.h, s.exposure);
  const kzth    = computeKzt(s, s.h).kzt;
  const qh      = 0.00256 * kh * kzth * ke * s.V * s.V;
  const Aw      = Math.max(s.areaWall, 20);  // min. 20 sf
  const Ar      = Math.max(s.areaRoof, 20);
  const gc4     = gcpWallP2('4', Aw);
  const gc5     = gcpWallP2('5', Aw);

  // p_min (suction) — uses qh, constant over height
  const z4_pmin = qh * KD * gc4.neg - qh * KD * gcpiVal;
  const z5_pmin = qh * KD * gc5.neg - qh * KD * gcpiVal;

  // Windward wall height profile (p_max varies with qz)
  const wwProfile = ch27HeightProfile(s.h).map(z => {
    const kz  = khFromFormula(z, s.exposure);
    const kzt = computeKzt(s, z).kzt;
    const qz  = 0.00256 * kz * kzt * ke * s.V * s.V;
    return {
      z, kz, qz,
      z4_pmax: qz * KD * gc4.pos + qh * KD * gcpiVal,
      z4_pmin,
      z5_pmax: qz * KD * gc5.pos + qh * KD * gcpiVal,
      z5_pmin
    };
  });

  // Flat/low-slope roof (θ ≤ 7°) — Fig. 30.4-1 direct.
  // Source: Fig. 30.4-1 Note 6: "Coefficients are for roofs with angle θ ≤ 7°."
  const roofApplicable = s.theta <= 7;
  const roofZones = roofApplicable
    ? ['1', '2', '3'].map(zn => {
        const gc = gcpRoofP2(zn, Ar);
        return {
          zone: zn, gcp: gc,
          pMax: qh * KD * gc.pos + qh * KD * gcpiVal,
          pMin: qh * KD * gc.neg - qh * KD * gcpiVal
        };
      })
    : null;

  // Sloped roof (θ > 7°) — Fig. 30.4-1 Note 6: use GCp from Part 1 figures with attendant qh.
  // "For other roof angles and geometry, use (GCp) values from Fig. 30.3-2A–2I and
  //  Fig. 30.3-5A, 5B and attendant qh based on exposure defined in Section 26.7."
  // Reuses gcpRoofSloped() (gable: Figs. 30.3-2B/2C; hip: Figs. 30.3-2D-G equiv.).
  // Both +GCp and −GCp use qh (not qz) — "attendant qh" means qh throughout for roofs.
  const roofSlopedP2 = !roofApplicable
    ? { shape: s.roofShape, theta: s.theta,
        zones: ['1', '2', '3'].map(zn => {
          const gc = gcpRoofSloped(zn, Ar, s.theta, s.roofShape);
          return {
            zone: zn, gcp: gc, capped: gc.capped,
            pMax: qh * KD * gc.pos + qh * KD * gcpiVal,
            pMin: qh * KD * gc.neg - qh * KD * gcpiVal
          };
        })
      }
    : null;

  const PSF_MIN_WALL = 16.0;
  const topRow = wwProfile[wwProfile.length - 1];
  const wallMinGoverns = Math.abs(topRow.z4_pmin) < PSF_MIN_WALL ||
                         Math.abs(topRow.z5_pmin) < PSF_MIN_WALL;

  return {
    procedure: 'ch30part2', KD, ke, qh, gcpiVal, kh, Aw, Ar,
    gc4, gc5, wwProfile, roofApplicable, roofZones, roofSlopedP2, wallMinGoverns, PSF_MIN_WALL
  };
}

// Table 26.10-1 Note 1 formula for K_z at height z.
// Ch.27 does NOT use the footnote (*) exception (K_h = 0.70 for Exp B, h < 30 ft) —
// that footnote applies only to Chapter 28 (Envelope Procedure). Source: Table 26.10-1 footnote (*).
function computeKzDirect(z, exposure) {
  return khFromFormula(z, exposure);  // unmodified power-law formula
}

// Fig. 27.3-1: Leeward wall external pressure coefficient C_p.
// Interpolated linearly on L/B (building length / building width).
// Values: L/B ≤ 1 → −0.5; L/B = 2 → −0.3; L/B ≥ 4 → −0.2 (Fig. 27.3-1, Wall surfaces).
function cpLeewardWall(LB) {
  if (LB <= 1) return -0.50;
  if (LB <= 2) return -0.50 + (LB - 1) * (-0.30 - -0.50);   // linear 1→2
  if (LB <= 4) return -0.30 + (LB - 2) / 2 * (-0.20 - -0.30); // linear 2→4
  return -0.20;
}

// Fig. 27.3-1: Roof C_p zones for flat / low-slope (θ ≤ 10°), wind normal to ridge.
// Three zones measured from the windward edge (in multiples of h):
//   Zone A: 0 to h    Zone B: h to 2h    Zone C: > 2h
// Windward slope Cp — bilinear interpolation in θ and h/L from CP_ROOF_NTR table.
// For θ > 45°: returns { cp1: 0.01θ (capped 0.8 for θ>80°), cp2: null }.
// hL is clamped to [0.25, 1.0] (no extrapolation beyond table).
// Returns { cp1, cp2 } — both values must be checked per Fig. 27.3-1 Note 3.
function cpRoofNtrWindward(theta, hL) {
  if (theta > 80) return { cp1: 0.8, cp2: null };
  if (theta > 45) return { cp1: 0.01 * theta, cp2: null };

  const tbl   = CP_ROOF_NTR;
  const ths   = tbl.thetas;
  const hLc   = Math.min(Math.max(hL, 0.25), 1.0);
  const thetaC = Math.min(Math.max(theta, 10), 45);

  // θ index + weight
  let iT = ths.length - 2, tT = 1;
  for (let i = 0; i < ths.length - 1; i++) {
    if (thetaC <= ths[i + 1]) { iT = i; tT = (thetaC - ths[i]) / (ths[i + 1] - ths[i]); break; }
  }

  // h/L index + weight
  let iH, tH;
  if (hLc <= 0.5) { iH = 0; tH = (hLc - 0.25) / 0.25; }
  else            { iH = 1; tH = (hLc - 0.5)  / 0.5;  }

  const lerp = (a, b, t) => a + t * (b - a);
  const bilin = (arr) =>
    lerp(lerp(arr[iH][iT], arr[iH][iT + 1], tT),
         lerp(arr[iH + 1][iT], arr[iH + 1][iT + 1], tT), tH);

  return { cp1: bilin(tbl.cp1), cp2: bilin(tbl.cp2) };
}

// Leeward slope Cp (Wind Normal to Ridge) — θ-dependent only (all h/L same).
// Source: ASCE 7-22 Fig. 27.3-1, Leeward column, p.284.
// 10°→−0.3, 15°→−0.5, ≥20°→−0.6; linear interpolation for intermediate θ.
function cpRoofNtrLeeward(theta) {
  if (theta <= 10) return -0.3;
  if (theta >= 20) return -0.6;
  if (theta <= 15) return -0.3 + (-0.5 - -0.3) * (theta - 10) / 5;
  return -0.5 + (-0.6 - -0.5) * (theta - 15) / 5;
}

// Two C_p values per zone per Fig. 27.3-1 Note 3 (wind reattachment on large roofs).
// Cp1 is the more negative (primary suction) value; Cp2 = −0.18 (always, per Note 3).
// Cp1 linearly interpolated between h/L = 0.5 (−0.9/−0.5/−0.3) and h/L ≥ 1.0 (−1.3/−0.7/−0.7).
// For h/L ≤ 0.5 the tabulated values at h/L = 0.5 are used.
function roofZonesCp(hL) {
  const t = Math.max(0, Math.min(1, (hL - 0.5) / 0.5)); // 0 at hL≤0.5, 1 at hL≥1.0
  return [
    { label: '0 to h',  cp1: -0.9 + t * (-1.3 - -0.9), cp2: -0.18 },
    { label: 'h to 2h', cp1: -0.5 + t * (-0.7 - -0.5), cp2: -0.18 },
    { label: '> 2h',    cp1: -0.3 + t * (-0.7 - -0.3), cp2: -0.18 }
  ];
}

// Heights at which to evaluate the windward wall pressure profile for Ch.27.
// Uses the standard heights from Table 26.10-1, limited to [15, h].
function ch27HeightProfile(h) {
  const STD_HTS = [15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 250, 300, 350, 400, 450, 500];
  const result = [];
  for (const z of STD_HTS) {
    if (z < h - 0.5) result.push(z);  // include standard heights strictly below h
  }
  result.push(parseFloat(h.toFixed(2))); // always include mean roof height
  return result;
}

// Main Ch.27 computation.
function computeCh27(s) {
  const G   = G_RIGID;  // 0.85, Sec. 26.11.1 (rigid structure, f ≥ 1 Hz)
  const KD  = 0.85;     // Table 26.6-1, buildings
  const ke  = computeKe(s.groundElev);

  // Internal pressure coefficient (GCpi) — same table as Ch.28/30, Table 26.13-1
  const gcpiMap = { enclosed: 0.18, partiallyEnclosed: 0.55, partiallyOpen: 0.00, openFreeRoof: 0.00 }; // partiallyOpen = 0.00 per ASCE 7-22 Table 26.13-1
  const gcpi = gcpiMap[s.enclosure] ?? 0.18;

  // Velocity pressure at mean roof height h — Eq. 26.10-1, Table 26.10-1 Note 1
  // K_z at h uses the standard formula (no Ch.28 footnote exception)
  const kh   = computeKzDirect(s.h, s.exposure);
  const kzth = computeKzt(s, s.h).kzt;
  const qh   = 0.00256 * kh * kzth * ke * s.V * s.V;

  // Building dimensions and ratios
  const B  = Math.max(s.minDim, 1);    // width perpendicular to wind direction (= minDim), ft
  const L  = Math.max(s.buildingL, 1); // length parallel to wind direction, ft
  const LB = L / B;                    // L/B for leeward Cp
  const hL = s.h / L;                  // h/L for roof zone Cp

  // Cp values — Fig. 27.3-1
  const CP_WW = 0.8;               // windward wall, all L/B
  const CP_LW = cpLeewardWall(LB); // leeward wall
  const CP_SW = -0.7;              // side walls, all cases

  // ── Windward wall pressure profile ──
  // q = q_z (at each height z), qi = q_h (enclosed/partially enclosed per Sec. 27.3.1)
  // Eq. 27.3-1: p = q_z · G · C_p − q_h · (GC_pi)
  //   LC1 (+GCpi): p = q_z·G·C_p − q_h·(+GCpi)  [positive internal pressure, reduces net]
  //   LC2 (−GCpi): p = q_z·G·C_p − q_h·(−GCpi)  [negative internal pressure, increases net]
  // Governing windward: LC2 (larger net pressure toward interior)
  const heights = ch27HeightProfile(s.h);
  const wwProfile = heights.map(z => {
    const kz  = computeKzDirect(z, s.exposure);
    const kztz = computeKzt(s, z).kzt;
    const qz   = 0.00256 * kz * kztz * ke * s.V * s.V;
    const pLC1 = KD * (qz * G * CP_WW - qh * gcpi);   // Eq. 27.3-1 + GCpi; Kd per Eq. 26.10-1
    const pLC2 = KD * (qz * G * CP_WW + qh * gcpi);   // Eq. 27.3-1 − GCpi
    return { z, kz, qz, pLC1, pLC2 };
  });

  // ── Leeward and side wall pressures ──
  // q = qh for all except windward (Sec. 27.3.1).
  // Governing leeward/side: LC1 (+GCpi) — positive internal adds to outward suction
  //   p_lw (LC1) = qh·G·Cp_lw − qh·(+GCpi) = qh·(G·Cp_lw − GCpi)  [most negative]
  //   p_lw (LC2) = qh·G·Cp_lw + qh·(GCpi)                          [less negative]
  const pLW_lc1 = KD * (qh * G * CP_LW - qh * gcpi); // Eq. 27.3-1, leeward
  const pLW_lc2 = KD * (qh * G * CP_LW + qh * gcpi);
  const pSW_lc1 = KD * (qh * G * CP_SW - qh * gcpi); // Eq. 27.3-1, side walls
  const pSW_lc2 = KD * (qh * G * CP_SW + qh * gcpi);

  // ── Roof pressures ──────────────────────────────────────────────────────────────────────────────
  // All roof Cp values use q = qh, qi = qh (Sec. 27.3.1, Eq. 27.3-1).
  // Both Cp values per cell must be checked per Fig. 27.3-1 Note 3.
  // Pressure equation: p = qh·G·Cp − qh·(±GCpi)
  //   LC1 (+GCpi): p = qh·G·Cp − qh·GCpi  (max suction when Cp is negative)
  //   LC2 (−GCpi): p = qh·G·Cp + qh·GCpi  (max pressure when Cp is positive)

  const p = (cp, lc) => KD * (qh * G * cp + (lc === 2 ? 1 : -1) * qh * gcpi); // Eq. 27.3-1

  // ── Flat / Wind Parallel to Ridge (θ ≤ 10°: Normal to Ridge; all θ: Parallel to Ridge) ──────
  // Zone-based approach: Cp from Fig. 27.3-1 (lower-left table), horizontal distance zones.
  // Used for:  (a) θ ≤ 10° (only roof case), (b) θ > 10° Wind Parallel to Ridge direction.
  const roofZonesPTR = roofZonesCp(hL).map(zone => ({
    ...zone,
    p1_lc1: p(zone.cp1, 1), p1_lc2: p(zone.cp1, 2),
    p2_lc1: p(zone.cp2, 1), p2_lc2: p(zone.cp2, 2)
  }));
  const roofApplicable = s.theta <= 10;
  const roofZones      = roofApplicable ? roofZonesPTR : null;

  // ── Sloped Roof, Wind Normal to Ridge (θ > 10°) — Fig. 27.3-1 upper table ─────────────────────
  // Windward slope: bilinear Cp from CP_ROOF_NTR; both cp1 + cp2 per Note 3.
  // Leeward slope:  single Cp from cpRoofNtrLeeward(), varies with θ only.
  let roofNTR = null;
  if (s.theta > 10) {
    const wwCp  = cpRoofNtrWindward(s.theta, hL);
    const lwCp  = cpRoofNtrLeeward(s.theta);
    // Windward slope pressure cases
    const ww_p1_lc1 = p(wwCp.cp1, 1);                               // governing suction (Cp1 + +GCpi)
    const ww_p1_lc2 = p(wwCp.cp1, 2);                               // alternate LC2
    const ww_p2_lc1 = wwCp.cp2 !== null ? p(wwCp.cp2, 1) : null;   // Cp2 + +GCpi
    const ww_p2_lc2 = wwCp.cp2 !== null ? p(wwCp.cp2, 2) : null;   // governing pressure (Cp2 + −GCpi)
    // Leeward slope
    const lw_lc1 = p(lwCp, 1);   // governing suction
    const lw_lc2 = p(lwCp, 2);   // alternate
    roofNTR = {
      theta: s.theta, hL,
      ww: { cp1: wwCp.cp1, cp2: wwCp.cp2, p1_lc1: ww_p1_lc1, p1_lc2: ww_p1_lc2, p2_lc1: ww_p2_lc1, p2_lc2: ww_p2_lc2 },
      lw: { cp: lwCp, lc1: lw_lc1, lc2: lw_lc2 }
    };
  }

  // ── Minimum design wind loads (Sec. 27.1.5) ──
  const PSF_MIN_WALL = 16.0, PSF_MIN_ROOF = 8.0;
  const wwAtH       = wwProfile[wwProfile.length - 1];
  const wwAtHGovern = Math.max(wwAtH.pLC1, wwAtH.pLC2);
  const wallMinGoverns = wwAtHGovern < PSF_MIN_WALL || Math.abs(pLW_lc1) < PSF_MIN_WALL;
  const roofMinGoverns = roofZones
    ? roofZones.some(z => Math.abs(z.p1_lc1) < PSF_MIN_ROOF)
    : roofNTR
      ? (Math.abs(roofNTR.ww.p1_lc1) < PSF_MIN_ROOF || Math.abs(roofNTR.lw.lc1) < PSF_MIN_ROOF)
      : false;

  // Sec. 27.3.5 Roof Overhangs: soffit Cp=+0.8 (no GCpi), top from windward edge zone.
  // p_net (upward+) = p_soffit - p_top
  var ch27Overhang = null;
  if (s.hasOverhang) {
    var pSoffit27 = qh * G * KD * 0.8;
    var cpTop27, pTop27_lc1, pTop27_lc2;
    if (roofNTR) {
      cpTop27 = roofNTR.ww.cp1;
      pTop27_lc1 = roofNTR.ww.p1_lc1;
      pTop27_lc2 = roofNTR.ww.p1_lc2;
    } else {
      var ez27 = roofZonesPTR[0];
      cpTop27 = ez27.cp1;
      pTop27_lc1 = ez27.p1_lc1;
      pTop27_lc2 = ez27.p1_lc2;
    }
    ch27Overhang = {
      cpTop: cpTop27, cpSoffit: 0.8, pSoffit: pSoffit27,
      pTop_lc1: pTop27_lc1, pTop_lc2: pTop27_lc2,
      pNet_lc1: pSoffit27 - pTop27_lc1,
      pNet_lc2: pSoffit27 - pTop27_lc2
    };
  }

  return {
    procedure: 'directional', G, KD, ke, qh, gcpi,
    kh, B, L, LB, hL,
    CP_WW, CP_LW, CP_SW,
    wwProfile,
    pLW_lc1, pLW_lc2, pSW_lc1, pSW_lc2,
    roofApplicable, roofZones, roofNTR, roofZonesPTR,
    wallMinGoverns, roofMinGoverns,
    PSF_MIN_WALL, PSF_MIN_ROOF,
    ch27Overhang: ch27Overhang
  };
}

function compute(s) {
  const steps = [];

  // --- Velocity pressure exposure coefficient, Kh ---
  const kh = computeKh(s.h, s.exposure);
  steps.push({
    label: 'Velocity Pressure Exposure Coefficient, K<sub>h</sub>',
    clause: 'Table 26.10-1 (Note 1 formula' + (s.exposure === 'B' && s.h < 30 ? ' and footnote *)' : ')'),
    formula: (s.exposure === 'B' && s.h < 30)
      ? 'Exposure B, h < 30 ft → K<sub>h</sub> = 0.70 (Table 26.10-1, footnote *)'
      : (s.h < 15
        ? 'K<sub>h</sub> = 2.41(15/z<sub>g</sub>)^(2/α) = 2.41(15/' + EXPOSURE[s.exposure].zg + ')^(2/' + EXPOSURE[s.exposure].alpha + ')'
        : 'K<sub>h</sub> = 2.41(h/z<sub>g</sub>)^(2/α) = 2.41(' + fmt(s.h, 1) + '/' + EXPOSURE[s.exposure].zg + ')^(2/' + EXPOSURE[s.exposure].alpha + ')'),
    result: 'K<sub>h</sub> = ' + fmt(kh, 3)
  });

  // --- Ground elevation factor, Ke ---
  const ke = computeKe(s.groundElev);
  steps.push({
    label: 'Ground Elevation Factor, K<sub>e</sub>',
    clause: 'Table 26.9-1, Note 2',
    formula: 'K<sub>e</sub> = exp(-0.0000362 × z<sub>e</sub>) = exp(-0.0000362 × ' + fmt(s.groundElev, 0) + ')',
    result: 'K<sub>e</sub> = ' + fmt(ke, 3) + '  (K<sub>e</sub> = 1.00 is always permitted)'
  });

  // --- Wind directionality factor, Kd ---
  steps.push({
    label: 'Wind Directionality Factor, K<sub>d</sub>',
    clause: 'Table 26.6-1',
    formula: 'Buildings — MWFRS and Components & Cladding',
    result: 'K<sub>d</sub> = ' + fmt(KD, 2)
  });

  // --- Topographic factor, Kzt (Sec. 26.8) ---
  const kztObj = computeKzt(s, s.h);
  const KZT = kztObj.kzt;

  if (!kztObj.auto) {
    // Flat terrain or manual override
    const isManual = s.kztMode === 'manual';
    steps.push({
      label: 'Topographic Factor, K<sub>zt</sub>',
      clause: 'Sec. 26.8',
      formula: isManual
        ? 'User-specified value'
        : 'Flat terrain or site does not satisfy Sec. 26.8.1 criteria (H/L<sub>h</sub> ≥ 0.2, upper half of feature) → K<sub>zt</sub> = 1.0',
      result: 'K<sub>zt</sub> = ' + fmt(KZT, 2)
    });
  } else if (kztObj.note) {
    // H/Lh < 0.2 → auto but still 1.0
    steps.push({
      label: 'Topographic Factor, K<sub>zt</sub>',
      clause: 'Sec. 26.8',
      formula: 'H/L<sub>h</sub> = ' + fmt(kztObj.hLh, 3) + ' < 0.2 → K<sub>zt</sub> = 1.0 per Sec. 26.8.1',
      result: 'K<sub>zt</sub> = 1.00'
    });
  } else {
    // Full auto calculation
    const FEAT_LABELS = { '2DRidge': '2D Ridge', '2DEscarp': '2D Escarpment', '3DHill': '3D Axisymmetric Hill' };
    const fLabel = FEAT_LABELS[s.topoFeature] || s.topoFeature;
    const xDir = s.topoX >= 0 ? 'downwind' : 'upwind';
    steps.push({
      label: 'Topographic Factor, K<sub>zt</sub> — Feature Parameters',
      clause: 'Sec. 26.8, Table 26.8-1',
      formula: 'Feature: ' + fLabel + '. H = ' + fmt(s.topoH, 1) + ' ft; L<sub>h</sub> = ' + fmt(s.topoLh, 1) + ' ft; H/L<sub>h</sub> = ' + fmt(kztObj.hLh, 3) + ' ≥ 0.2 ✓. x = ' + fmt(Math.abs(s.topoX), 1) + ' ft ' + xDir + ' of crest; z = h = ' + fmt(s.h, 1) + ' ft',
      result: 'Inputs OK'
    });
    steps.push({
      label: 'K<sub>1</sub> — Speed-Up Coefficient',
      clause: 'Table 26.8-1',
      formula: 'K<sub>1</sub> = (K<sub>1</sub>/[H/L<sub>h</sub>]) × (H/L<sub>h</sub>) = ' + fmt(kztObj.K1coeff, 2) + ' × ' + fmt(kztObj.hLh, 3),
      result: 'K<sub>1</sub> = ' + fmt(kztObj.K1, 4)
    });
    steps.push({
      label: 'K<sub>2</sub> — Horizontal Attenuation',
      clause: 'Table 26.8-1',
      formula: 'K<sub>2</sub> = 1 − |x| / (μ L<sub>h</sub>) = 1 − ' + fmt(Math.abs(s.topoX), 1) + ' / (' + fmt(kztObj.mu, 1) + ' × ' + fmt(s.topoLh, 1) + ')',
      result: 'K<sub>2</sub> = ' + fmt(kztObj.K2, 4)
    });
    steps.push({
      label: 'K<sub>3</sub> — Height Decay',
      clause: 'Table 26.8-1',
      formula: 'K<sub>3</sub> = e<sup>−γ z/L<sub>h</sub></sup> = e<sup>−' + fmt(kztObj.gamma, 1) + ' × ' + fmt(s.h, 1) + '/' + fmt(s.topoLh, 1) + '</sup>',
      result: 'K<sub>3</sub> = ' + fmt(kztObj.K3, 4)
    });
    steps.push({
      label: 'Topographic Factor, K<sub>zt</sub>',
      clause: 'Eq. 26.8-1',
      formula: 'K<sub>zt</sub> = (1 + K<sub>1</sub> K<sub>2</sub> K<sub>3</sub>)² = (1 + ' + fmt(kztObj.K1, 4) + ' × ' + fmt(kztObj.K2, 4) + ' × ' + fmt(kztObj.K3, 4) + ')²',
      result: 'K<sub>zt</sub> = ' + fmt(KZT, 3)
    });
  }

  // --- Velocity pressure qh ---
  const qh = 0.00256 * kh * KZT * ke * s.V * s.V;
  steps.push({
    label: 'Velocity Pressure at Mean Roof Height, q<sub>h</sub>',
    clause: 'Eq. 26.10-1',
    formula: 'q<sub>h</sub> = 0.00256 K<sub>h</sub> K<sub>zt</sub> K<sub>e</sub> V² = 0.00256 × ' + fmt(kh, 3) + ' × ' + fmt(KZT, 3) + ' × ' + fmt(ke, 3) + ' × ' + fmt(s.V, 1) + '²',
    result: 'q<sub>h</sub> = ' + fmt(qh, 2) + ' psf'
  });

  // --- Internal pressure coefficient, GCpi ---
  const gcpi = GCPI[s.enclosure];
  steps.push({
    label: 'Internal Pressure Coefficient, (GC<sub>pi</sub>)',
    clause: 'Table 26.13-1',
    formula: GCPI[s.enclosure].label + ' building classification (Sec. 26.2 definitions)',
    result: '(GC<sub>pi</sub>) = +' + fmt(gcpi.pos, 2) + ' and ' + fmt(gcpi.neg, 2)
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

  // --- Parapets (MWFRS Sec. 27.3.4/28.3.4 + C&C Sec. 30.6) ---
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

    // C&C — Eq. 30.6-1: p = qp[(GCp) - (GCpi)], GCpi = 0 (both faces exterior)
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

  // --- Attached Canopies on Buildings (Sec. 30.9, Eq. 30.9-1: p = qh Kd (GCp)) ---
  // qh is evaluated at the building's mean roof height h (already computed above for
  // the main C&C/MWFRS procedure) — Sec. 30.9 does not use a separate canopy-height qh.
  // See gcpCanopySeparate()/gcpCanopyNet() above for the table citations and the h<=60
  // vs h>60 ft figure split.
  let canopy = null;
  if (s.hasCanopy) {
    const hGt60 = s.h > 60;
    const A = Math.max(s.canopyArea, 0.1);
    const hcRatio = s.canopyHe > 0 ? (s.canopyHc / s.canopyHe) : 0;
    const sep = gcpCanopySeparate(A, hGt60);
    const net = gcpCanopyNet(A, hcRatio, hGt60);
    canopy = {
      hGt60, A, hcRatio,
      sepNegUpper: sep.negUpper, sepNegLower: sep.negLower, sepPos: sep.pos, sepCapped: sep.capped,
      netNeg: net.neg, netPos: net.pos, netBand: net.band, netCapped: net.capped,
      pSepUpperNeg: qh * KD * sep.negUpper,
      pSepLowerNeg: qh * KD * sep.negLower,
      pSepPos:      qh * KD * sep.pos,
      pNetNeg:      qh * KD * net.neg,
      pNetPos:      qh * KD * net.pos,
      figRefSep: hGt60 ? 'Fig. 30.9-2A' : 'Fig. 30.9-1A',
      figRefNet: hGt60 ? 'Fig. 30.9-2B' : 'Fig. 30.9-1B'
    };
  }

  // --- Circular Bins, Silos, and Tanks (Sec. 30.10, Eq. 30.10-1: p = qh Kd [(GCp) - (GCpi)]) ---
  // qh and Kd are the same shared values used elsewhere on this page — Sec. 30.10 does
  // not define an independent tank-height qh. This mirrors computeCh29() ("Other
  // Structures") above, which likewise reuses the page's shared qh rather than an
  // independent height input.
  //
  // IMPLEMENTED: wall pressures (Sec. 30.10.2, Eqs. 30.10-2/30.10-3/30.10-4 — formula-
  // based, valid for 0.25 <= H/D <= 4.0, D < 120 ft); internal pressure coefficient for
  // open-topped tanks (Sec. 30.10.3, Eq. 30.10-5 — formula-based); underside pressures
  // for elevated isolated bins (Sec. 30.10.5 — explicit numeric values given directly in
  // the standard's text, not figure-only).
  //
  // NOT IMPLEMENTED — verify directly against the standard: roof pressures for isolated
  // circular bins (Sec. 30.10.4, Fig. 30.10-2, Zones 1-4, Class 1/2a/2b roofs) and
  // roof/wall pressures for grouped circular bins (Sec. 30.10.6, Figs. 30.10-3/30.10-4),
  // used when center-to-center spacing < 1.25D. Both exist ONLY as graphical figures in
  // ASCE/SEI 7-22 — confirmed by direct text search of the standard and Commentary —
  // with no numeric (GCp) values recoverable from the text; the Commentary narrative for
  // these figures (citing Sabransky & Melbourne 1987 and Macdonald et al. 1988/1990) is
  // qualitative only and does not reproduce the plotted coefficients.
  let circTank = null;
  if (s.hasCircularTank) {
    const D = Math.max(s.tankD, 0.01);
    const H = Math.max(s.tankH, 0.01);
    const HD = H / D;
    const HDcap = Math.min(Math.max(HD, 0.25), 4.0);
    const HDCapped = (HD < 0.25 || HD > 4.0);
    const isOpenTop = !!s.tankOpenTop;
    const openGcpi = isOpenTop ? tankOpenGCpi(HDcap) : null;

    const wallAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
    const wallRows = wallAngles.map(a => {
      const C = tankWallC(a);
      const gcp = tankWallGCp(a, HDcap);
      if (isOpenTop) {
        return { alpha: a, C, gcp, p: qh * KD * (gcp - openGcpi) };
      }
      return {
        alpha: a, C, gcp,
        pMin: qh * KD * (gcp - gcpi.pos),
        pMax: qh * KD * (gcp - gcpi.neg)
      };
    });

    // Sec. 30.10.5 — undersides of isolated elevated circular bins: explicit numeric
    // (GCp) values stated directly in the standard's text.
    let underside = null;
    if (s.tankElevated) {
      underside = [
        { zone: '1 & 2', gcpPos: 0.8, gcpNeg: -0.6 },
        { zone: '3', gcpPos: 1.2, gcpNeg: -0.9 }
      ].map(z => ({
        zone: z.zone, gcpPos: z.gcpPos, gcpNeg: z.gcpNeg,
        pPos: qh * KD * z.gcpPos,
        pNeg: qh * KD * z.gcpNeg
      }));
    }

    circTank = {
      D, H, HD, HDcap, HDCapped, isOpenTop, openGcpi,
      isElevated: !!s.tankElevated,
      wallRows, underside,
      enclosureLabel: isOpenTop ? null : gcpi.label
    };
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

  // --- Stepped Roofs (Sec. 30.3.2.1, Fig. 30.3-3: Components and cladding,
  // h <= 60 ft, theta <= 7 deg, stepped roofs) ---
  // Fig. 30.3-3's own Note states: "On the lower level of flat, stepped roofs
  // shown here, the zone designations and pressure coefficients shown in
  // Figure 30.3-2A shall apply." I.e. Fig. 30.3-3 reuses the SAME (GCp) values
  // already implemented for flat roofs (gcpRoof() / GCP_ROOF_LE7, Zones 1/2/3)
  // -- it does not define a new GCp curve. What it DOES change is the zone
  // GEOMETRY: per the figure's diagram, the edge-zone width at the building's
  // ordinary (non-step) perimeter is the usual "a" (Notation under Fig.
  // 28.3-1/30.3-1, via computeZoneA()), but the band immediately adjacent to
  // the step (where the lower roof meets the foot of the taller wall) is
  // widened to 1.5 x hs, where hs is the step height differential. This 1.5x
  // multiplier is read directly off Fig. 30.3-3's own diagram dimensions
  // (labelled "1.5h_s1" / "0.6h_s2" for cascading multi-step buildings) -- the
  // Standard does not spell this out in words, only graphically.
  // SCOPE: this calculator implements the common two-level stepped roof (one
  // step). Buildings with more than one step (cascading/multi-level roofs)
  // are NOT covered -- consult Fig. 30.3-3 directly for those.
  let steppedRoof = null;
  if (s.hasSteppedRoof) {
    const hTall = s.h;
    const hLow = Math.max(s.steppedLowerH, 0.01);
    const Wlow = Math.max(s.steppedLowerW, 0.01);
    const hs = hTall - hLow; // step height differential
    if (hs > 0) {
      const aMain = computeZoneA(hTall, s.minDim, 0); // standard edge-zone width, flat roof (theta=0)
      const aStepRaw = 1.5 * hs;
      const aStep = Math.min(aStepRaw, Wlow); // can't exceed the lower roof's own width
      const aStepCapped = aStepRaw > Wlow;
      const A = Math.max(s.areaRoof, 0.1);
      const z1 = gcpRoof('1', A);
      const z2 = gcpRoof('2', A);
      const z3 = gcpRoof('3', A);
      const withP = (gc) => ({
        gc,
        pMin: qh * KD * (gc.neg - gcpi.pos),
        pMax: qh * KD * (gc.pos - gcpi.neg)
      });
      steppedRoof = {
        hTall, hLow, hs, Wlow, aMain, aStep, aStepCapped, A,
        zone1: withP(z1), zone2: withP(z2), zone3: withP(z3)
      };
    }
  }

  // --- Multispan Gable Roofs (Fig. 30.3-4) ---
  // Fig. 30.3-4 Note 5: "For theta <= 10 deg, values of (GCp) from Fig. 30.3-2A
  // shall be used" -- so for the common low-slope case this reuses the exact
  // same Zone 1/2/3 flat-roof (GCp) table already coded (gcpRoof), with only a
  // new edge-zone-width formula "a" (per this figure's own Notation, based on
  // the single-span module width rather than the whole building's minDim) and
  // a tiled zone pattern (every ridge/valley line between spans gets the same
  // zone-2/3 treatment as the building's outer eaves).
  // SCOPE: for theta > 10 deg, Fig. 30.3-4 gives its own numeric (GCp) vs.
  // effective-area graphs (10 < theta <= 30 deg, and 30 < theta <= 45 deg) with
  // three overlapping curves (Zones 1/2/3) each having its own breakpoint --
  // digitizing these reliably from the rendered figure (multiple crossing
  // lines, no printed coordinate table) is not done here to avoid guessing at
  // breakpoints; that range is flagged NOT IMPLEMENTED in the report.
  let multispanRoof = null;
  if (s.hasMultispanRoof) {
    const theta = s.theta;
    if (theta <= 10.0001) {
      const Wp = Math.max(s.msModuleW, 0.01);
      const Lmod = Math.min(Wp, Math.max(s.buildingL, 0.01)); // least horiz. dim. of a single-span module
      const aRaw = Math.min(0.10 * Lmod, 0.4 * s.h);
      const aMin = Math.max(0.04 * Lmod, 3.0);
      const a = Math.max(aRaw, aMin);
      const A = Math.max(s.areaRoof, 0.1);
      const z1 = gcpRoof('1', A);
      const z2 = gcpRoof('2', A);
      const z3 = gcpRoof('3', A);
      const withP = (gc) => ({
        gc,
        pMin: qh * KD * (gc.neg - gcpi.pos),
        pMax: qh * KD * (gc.pos - gcpi.neg)
      });
      multispanRoof = {
        thetaLE10: true, theta, Wp, Lmod, a, A,
        zone1: withP(z1), zone2: withP(z2), zone3: withP(z3)
      };
    } else {
      multispanRoof = { thetaLE10: false, theta };
    }
  }

  // --- Sawtooth Roofs (Fig. 30.3-6) ---
  // Fig. 30.3-6 Note 5: "For theta <= 10 deg, values of (GCp) from Figure
  // 30.3-2A shall be used" -- same reuse pattern as multispan gable roofs.
  // This figure's own zone geometry adds one twist beyond multispan gable:
  // the low (upwind) eave of each monoslope span -- where the roof drops down
  // to the next span, the defining "sawtooth" step -- gets a DOUBLED edge-zone
  // width (2a) instead of the standard "a" used on the other three edges.
  //
  // theta > 10 deg: digitized directly from Fig. 30.3-6's own (GCp) vs.
  // effective-wind-area graph (piecewise-linear breakpoints read off the
  // figure by the user from their own copy and supplied as exact coordinate
  // pairs -- not estimated from a rendered image). Per the figure, the
  // negative (uplift) curves split Zone 3 into "Span A" (the first,
  // windward span) and "Spans B, C, & D" (the repeating downstream spans);
  // Zones 1 and 2 do not split. The positive curves do not split by span at
  // all (single Zone 1/2/3 curve each, shared by all spans). Interpolation
  // is linear in log10(effective wind area), matching the same convention
  // already used elsewhere on this page for GCp-vs-area graphs (logLerpA /
  // gcpRoof / gcpWall).
  const SAWTOOTH_GT10 = {
    zone1: {
      neg: [[1, -2.2], [10, -2.2], [500, -1.1], [1000, -1.1]],
      pos: [[1, 0.7], [10, 0.7], [500, 0.4], [1000, 0.4]]
    },
    zone2: {
      neg: [[1, -3.2], [10, -3.2], [500, -1.6], [1000, -1.6]],
      pos: [[1, 1.1], [10, 1.1], [100, 0.8], [1000, 0.8]]
    },
    zone3: {
      // negative splits by span; positive is shared by all spans
      negSpanA: [[1, -4.1], [10, -4.1], [100, -3.7], [500, -2.1], [1000, -2.1]],
      negSpansBCD: [[1, -2.6], [100, -2.6], [500, -1.9], [1000, -1.9]],
      pos: [[1, 0.8], [10, 0.8], [100, 0.7], [1000, 0.7]]
    }
  };
  // Piecewise-linear interpolation of GCp across an arbitrary list of
  // [area, GCp] breakpoints, linear in log10(area) between consecutive
  // points -- the general form of logLerpA() above for tables with more
  // than two breakpoints. For effective wind area below the table's first
  // point (1 sq ft for all SAWTOOTH_GT10 tables), the value AT 1 sq ft is
  // used; for area above the table's last point (1000 sq ft), the value AT
  // 1000 sq ft is used -- no extrapolation past the figure's plotted range,
  // matching how these GCp-vs-area graphs are meant to be read.
  function logLerpPts(A, pts) {
    const n = pts.length;
    const a = Math.min(Math.max(A, pts[0][0]), pts[n - 1][0]);
    for (let i = 0; i < n - 1; i++) {
      const a0 = pts[i][0], v0 = pts[i][1], a1 = pts[i + 1][0], v1 = pts[i + 1][1];
      if (a <= a1 || i === n - 2) {
        if (a1 === a0) return v0;
        const t = (Math.log10(a) - Math.log10(a0)) / (Math.log10(a1) - Math.log10(a0));
        return v0 + t * (v1 - v0);
      }
    }
    return pts[n - 1][1];
  }
  let sawtoothRoof = null;
  if (s.hasSawtoothRoof) {
    const theta = s.theta;
    const Wsp = Math.max(s.swModuleW, 0.01);
    const Lmod = Math.min(Wsp, Math.max(s.buildingL, 0.01)); // least horiz. dim. of a single-span module
    const aRaw = Math.min(0.10 * Lmod, 0.4 * s.h);
    const aMin = Math.max(0.04 * Lmod, 3.0);
    const a = Math.max(aRaw, aMin);
    const aLow = 2 * a; // doubled zone width at the low eave of each span
    const A = Math.max(s.areaRoof, 0.1);
    if (theta <= 10.0001) {
      const z1 = gcpRoof('1', A);
      const z2 = gcpRoof('2', A);
      const z3 = gcpRoof('3', A);
      const withP = (gc) => ({
        gc,
        pMin: qh * KD * (gc.neg - gcpi.pos),
        pMax: qh * KD * (gc.pos - gcpi.neg)
      });
      sawtoothRoof = {
        thetaLE10: true, theta, Wsp, Lmod, a, aLow, A,
        zone1: withP(z1), zone2: withP(z2), zone3: withP(z3)
      };
    } else {
      const withP = (neg, pos) => ({
        gc: { neg, pos },
        pMin: qh * KD * (neg - gcpi.pos),
        pMax: qh * KD * (pos - gcpi.neg)
      });
      const t = SAWTOOTH_GT10;
      sawtoothRoof = {
        thetaLE10: false, theta, Wsp, Lmod, a, aLow, A,
        zone1: withP(logLerpPts(A, t.zone1.neg), logLerpPts(A, t.zone1.pos)),
        zone2: withP(logLerpPts(A, t.zone2.neg), logLerpPts(A, t.zone2.pos)),
        zone3SpanA: withP(logLerpPts(A, t.zone3.negSpanA), logLerpPts(A, t.zone3.pos)),
        zone3SpansBCD: withP(logLerpPts(A, t.zone3.negSpansBCD), logLerpPts(A, t.zone3.pos))
      };
    }
  }

  // --- Domed Roofs with a Circular Base (Fig. 30.3-7) ---
  // Unlike the other roof-shape extras above, Fig. 30.3-7 is a small, fully
  // numeric (GCp) lookup table -- NOT a graph -- so no digitization/scope-
  // limitation issue here. Table "Coefficients for Domes with a Circular
  // Base": (GCp) = -0.9 for theta = 0-90 deg (negative/uplift case, all
  // theta); (GCp) = +0.9 for theta = 0-60 deg and +0.5 for theta = 61-90 deg
  // (positive case, near the dome's apex). Per Note 1, these values are used
  // with q(hD+f) -- the velocity pressure AT THE TOP OF THE DOME, i.e. at
  // height (h_D + f), not the page's shared qh (mean roof height) -- so qDome
  // is recomputed here at that height using the same Kz/Kzt formulas used
  // elsewhere on this page. Per Note 4, the table applies only to
  // 0 <= h_D/D <= 0.5 and 0.2 <= f/D <= 0.5; outside that range is flagged.
  let domeRoof = null;
  if (s.hasDomeRoof) {
    const D  = Math.max(s.domeD, 0.01);
    const f  = Math.max(s.domeF, 0);
    const hD = Math.max(s.domeHD, 0);
    const hDoverD = hD / D;
    const fOverD  = f / D;
    const outOfRange = (hDoverD > 0.5 + 1e-9) || (fOverD < 0.2 - 1e-9) || (fOverD > 0.5 + 1e-9);
    const domeTopZ = hD + f; // Note 1: height at the top of the dome
    const kzDome  = computeKzDirect(domeTopZ, s.exposure);
    const kztDome = computeKzt(s, domeTopZ).kzt;
    const qDome   = 0.00256 * kzDome * kztDome * ke * s.V * s.V; // Eq. 26.10-1, evaluated at (h_D + f)
    const gcpNeg     = -0.9; // theta 0-90 deg
    const gcpPosLow  = 0.9;  // theta 0-60 deg
    const gcpPosHigh = 0.5;  // theta 61-90 deg
    domeRoof = {
      D, f, hD, hDoverD, fOverD, outOfRange, domeTopZ, kzDome, kztDome, qDome,
      gcpNeg, gcpPosLow, gcpPosHigh,
      pNeg:     pRangeSingle(qDome, KD, gcpNeg, gcpi),
      pPosLow:  pRangeSingle(qDome, KD, gcpPosLow, gcpi),
      pPosHigh: pRangeSingle(qDome, KD, gcpPosHigh, gcpi)
    };
  }

  // ── Minimum Design Wind Load Check ──────────────────────────────────────
  // ASCE/SEI 7-22 Sec. 27.1.5 (MWFRS) and Sec. 30.2.2 (C&C) require
  // computed net pressures to be not less than the tabulated minimums,
  // regardless of qh-based results.
  const PSF_MIN_WALL = 16.0;  // psf — MWFRS wall zones, Sec. 27.1.5
  const PSF_MIN_ROOF = 8.0;   // psf — MWFRS roof zones, Sec. 27.1.5
  const PSF_MIN_CC   = 16.0;  // psf — all C&C zones, Sec. 30.2.2

  // Sec. 27.1.5 zone classification for Ch. 28 Envelope Procedure zones
  const WALL_ZONES = new Set(['4','5','6','4E','5E','6E']);

  function zoneMin(z) { return WALL_ZONES.has(z) ? PSF_MIN_WALL : PSF_MIN_ROOF; }
  function pAbs(p)    { return Math.max(Math.abs(p.min), Math.abs(p.max)); }

  // Collect unique zones from LC1 + LC2 (LC3/LC4 are torsional fractions — skip)
  const mwfrsAllZones = [];
  const seenMZ = new Set();
  [...mwfrsLC1, ...mwfrsLC2].forEach(z => {
    if (!seenMZ.has(z.zone)) { seenMZ.add(z.zone); mwfrsAllZones.push(z); }
  });

  const mwfrsMinCheck = mwfrsAllZones.map(z => ({
    zone: z.zone,
    pCalc: pAbs(z.p),
    pMin:  zoneMin(z.zone),
    type:  WALL_ZONES.has(z.zone) ? 'wall' : 'roof',
    governs: pAbs(z.p) < zoneMin(z.zone)
  }));
  const mwfrsMinGoverns = mwfrsMinCheck.some(c => c.governs);

  const ccAllZones = [...ccWall, ...ccRoof];
  const ccMinCheck = ccAllZones.map(z => ({
    zone: z.zone,
    pCalc: pAbs(z.p),
    pMin:  PSF_MIN_CC,
    governs: pAbs(z.p) < PSF_MIN_CC
  }));
  const ccMinGoverns = ccMinCheck.some(c => c.governs);

  // Helper: convert psf to display unit for step result text
  const pFmt = psf => fmt(pVal(psf), 2) + ' ' + pUnit();

  function mwfrsMinResultText() {
    if (!mwfrsMinGoverns) return 'All zones ≥ minimum — computed pressures govern throughout.';
    const flagged = mwfrsMinCheck.filter(c => c.governs)
      .map(c => 'Zone ' + c.zone + ': ' + pFmt(c.pCalc) + ' < min ' + pFmt(c.pMin)).join('; ');
    return '⚠ Minimum governs: ' + flagged + '. Use minimum values for these zones.';
  }

  function ccMinResultText() {
    if (!ccMinGoverns) return 'All zones ≥ 16 psf minimum — computed pressures govern throughout.';
    const flagged = ccMinCheck.filter(c => c.governs)
      .map(c => 'Zone ' + c.zone + ': ' + pFmt(c.pCalc) + ' < min ' + pFmt(PSF_MIN_CC)).join('; ');
    return '⚠ Minimum governs: ' + flagged + '. Use minimum values for these zones.';
  }

  steps.push({
    label: 'Minimum MWFRS Design Wind Loads',
    clause: 'Sec. 27.1.5',
    formula: 'Wall zones (4, 5, 6): |p| ≥ 16 psf (0.77 kN/m²); Roof zones (1, 2, 3): |p| ≥ 8 psf (0.38 kN/m²). Net pressures, any horizontal direction along each principal axis.',
    result: mwfrsMinResultText()
  });

  steps.push({
    label: 'Minimum C&amp;C Design Wind Pressures',
    clause: 'Sec. 30.2.2',
    formula: 'All C&amp;C zones: |p| ≥ 16 psf (0.77 kN/m²), acting normal to surface in either direction.',
    result: ccMinResultText()
  });

  // Ch.27 Directional Procedure (used when mwfrsProcedure = 'directional')
  const ch27   = (s.enclosure !== 'openFreeRoof') ? computeCh27(s) : null;
  // Ch.30 Part 2 C&C (used when ccProcedure = 'part2', h > 60 ft)
  const cc30p2 = (s.enclosure !== 'openFreeRoof') ? computeCC30Part2(s) : null;
  // Ch.29 Other Structures
  const ch29 = (s.structureCategory === 'otherStructure') ? computeCh29(s) : null;
  // Sec. 30.5 Open Building C&C
  const cc30s305 = (s.enclosure === 'openFreeRoof') ? computeCC30Sec305(s) : null;

  return {
    kh, ke, kd: KD, qh, gcpi, a,
    steps, mwfrsLC1, mwfrsLC2, mwfrsLC3, mwfrsLC4, torsionApplies,
    ccWall, ccRoof, roofApplicable, roofCapped, ccOverhang, parapet, canopy, circTank, steppedRoof, multispanRoof, sawtoothRoof, domeRoof, openRoof,
    mwfrsMinCheck, mwfrsMinGoverns, ccMinCheck, ccMinGoverns,
    ch27, cc30p2, ch29, cc30s305,
    ch32: (s.ch32Enabled ? computeCh32(s) : null), s: s
  };
}


/* =====================================================================
   CH.32 TORNADO LOADS — ASCE 7-22 Secs. 32.1–32.17
   Applicability: Risk Category III/IV + V_T ≥ 60 mph thresholds.
   Data sources:
     Table 32.6-1  KdT                   (PDF p.451)
     Table 32.10-1 KhTor formula         (PDF p.451)
     Table 32.13-1 (GCpiT) values        (PDF p.451)
     Table 32.14-1 KvT values            (PDF p.452, rendered image)
     Eq. 32.10-1   qhT                   (PDF p.418)
     Eq. 32.15-1   MWFRS enclosed pT     (PDF p.452)
     Eq. 32.15-2   MWFRS open pT         (PDF p.453)
     Eq. 32.17-1   C&C enclosed pT       (PDF p.455)
     Eq. 32.17-3   C&C open pT           (PDF p.455)
   ===================================================================== */
function computeCh32(s) {
  const rc = s.riskCategory || 'II';
  if (rc !== 'III' && rc !== 'IV') {
    return { applicable: false, reason: 'Risk Category ' + rc + ' — Ch.32 tornado loads not required (Sec. 32.1.1: only Risk Category III and IV).' };
  }
  const VT = Number(s.ch32VT) || 0;
  if (VT < 60) {
    return { applicable: false, reason: 'Vᵀ = ' + VT.toFixed(0) + ' mph < 60 mph — tornado loads not required (Sec. 32.5.2).' };
  }
  const V   = Number(s.V) || 115;
  const exp = s.exposure || 'C';
  const thresh = (exp === 'B') ? 0.5 : (exp === 'D') ? 0.67 : 0.60;
  if (VT < thresh * V) {
    return { applicable: false, reason: 'Vᵀ = ' + VT.toFixed(0) + ' mph < ' + thresh + '×V = ' + (thresh*V).toFixed(0) + ' mph (Exposure ' + exp + ' threshold, Sec. 32.5.2) — tornado loads not required.' };
  }

  const h  = Number(s.h) || 20;
  const ke = computeKe(s.groundElev || 0);

  // KhTor — Table 32.10-1 Note 1 (PDF p.451)
  let KhTor;
  if (h <= 200)      KhTor = 1.0;
  else if (h <= 328) KhTor = Math.pow((2820 - h) / 2620, 2);
  else               KhTor = 0.90;

  // qhT — Eq. 32.10-1 (PDF p.418)
  const qhT = 0.00256 * KhTor * ke * VT * VT;

  // GT — Sec. 32.11.1 (PDF p.418)
  const GT = 0.85;

  // KdT — Table 32.6-1 (PDF p.451)
  const KdT_mwfrs     = 0.80;
  const KdT_cc_essen  = 1.00;
  const KdT_cc_zone1p = 0.90;
  const KdT_cc_other  = 0.75;
  const KdT_cc = s.ch32Essential ? KdT_cc_essen : KdT_cc_other;

  // KvT — Table 32.14-1 (PDF p.452)
  const KvT_mwfrs_roof_up   = 1.10;
  const KvT_mwfrs_roof_down = 1.00;
  const KvT_mwfrs_wall      = 1.00;
  const theta = Number(s.theta) || 0;
  const KvT_cc_roof_up_fn = function(zone) {
    if (theta <= 7) {
      return (zone === '1' || zone === '1E' || zone === '1p') ? 1.20 :
             (zone === '2' || zone === '2E') ? 1.05 : 1.05;
    }
    return (zone === '1' || zone === '1E' || zone === '1p') ? 1.20 :
           (zone === '2' || zone === '2E') ? 1.20 : 1.30;
  };
  const KvT_cc_down = 1.00;
  const KvT_cc_wall = 1.00;

  // GCpiT — Table 32.13-1 (PDF p.451)
  const enc = s.enclosure || 'enclosed';
  let GCpiT_pos, GCpiT_neg;
  if (enc === 'open' || enc === 'openFreeRoof') {
    GCpiT_pos = 0; GCpiT_neg = 0;
  } else if (enc === 'partiallyEnclosed') {
    GCpiT_pos = 0.55; GCpiT_neg = -0.55;
  } else if (enc === 'partiallyOpen') {
    GCpiT_pos = 0.18; GCpiT_neg = -0.18;
  } else {
    GCpiT_pos = 0.55; GCpiT_neg = -0.18;  // enclosed (default)
  }

  // MWFRS — Eq. 32.15-1: pT = qhT·GT·KdT·KvT·Cp − qhT·(GCpiT)
  const L  = Math.max(Number(s.buildingL) || Number(s.minDim) || 60, 1);
  const B  = Math.max(Number(s.minDim) || 60, 1);
  const LB = L / B;
  const hL = h / L;

  const Cp_ww = 0.8;
  const Cp_lw = cpLeewardWall(LB);
  const Cp_sw = -0.7;

  function mwfrsPT(Cp, KvT) {
    var base = qhT * GT * KdT_mwfrs * KvT * Cp;
    var lc1 = base - qhT * GCpiT_pos;
    var lc2 = base - qhT * GCpiT_neg;
    return { lc1: lc1, lc2: lc2, gov: (Math.abs(lc1) >= Math.abs(lc2) ? lc1 : lc2), Cp: Cp, KvT: KvT };
  }

  const pT_ww = mwfrsPT(Cp_ww, KvT_mwfrs_wall);
  const pT_lw = mwfrsPT(Cp_lw, KvT_mwfrs_wall);
  const pT_sw = mwfrsPT(Cp_sw, KvT_mwfrs_wall);

  const roofZones_mwfrs = roofZonesCp(hL).map(function(z) {
    return {
      label:      z.label,
      cp1:        z.cp1,
      cp2:        z.cp2,
      pT_up_lc1: qhT * GT * KdT_mwfrs * KvT_mwfrs_roof_up   * z.cp1 - qhT * GCpiT_pos,
      pT_up_lc2: qhT * GT * KdT_mwfrs * KvT_mwfrs_roof_up   * z.cp1 - qhT * GCpiT_neg,
      pT_dn_lc1: qhT * GT * KdT_mwfrs * KvT_mwfrs_roof_down * z.cp2 - qhT * GCpiT_pos,
      pT_dn_lc2: qhT * GT * KdT_mwfrs * KvT_mwfrs_roof_down * z.cp2 - qhT * GCpiT_neg,
    };
  });

  // C&C — Eq. 32.17-1: pT = qhT·[KdT·KvT·(GCp) − (GCpiT)]
  function ccPT_zone(zone, isRoof, isNeg) {
    var A   = isRoof ? (Number(s.areaRoof) || 50) : (Number(s.areaWall) || 20);
    var gc  = isRoof ? gcpRoof(zone, A) : gcpWall(zone, A);
    var gcv = isNeg ? gc.neg : gc.pos;
    var KvT = isRoof ? (isNeg ? KvT_cc_roof_up_fn(zone) : KvT_cc_down) : KvT_cc_wall;
    var pT_lc1 = qhT * (KdT_cc * KvT * gcv - GCpiT_pos);
    var pT_lc2 = qhT * (KdT_cc * KvT * gcv - GCpiT_neg);
    return { gcv: gcv, KvT: KvT, pT_lc1: pT_lc1, pT_lc2: pT_lc2, gov: (Math.abs(pT_lc1) >= Math.abs(pT_lc2) ? pT_lc1 : pT_lc2) };
  }

  const cc_roof = ['1','2','3'].map(function(z) {
    return { zone: z, neg: ccPT_zone(z, true, true), pos: ccPT_zone(z, true, false) };
  });
  const cc_wall = ['4','5'].map(function(z) {
    return { zone: z, neg: ccPT_zone(z, false, true), pos: ccPT_zone(z, false, false) };
  });

  const tornOpenFactor = qhT * GT * KdT_mwfrs;

  const warnings = [];
  if (rc === 'III') warnings.push('Risk Category III: tornado speeds from Figs. 32.5-1A–H (MRI ≈ 1,700 yr).');
  if (rc === 'IV')  warnings.push('Risk Category IV: tornado speeds from Figs. 32.5-2A–H (MRI ≈ 3,000 yr).');
  warnings.push('Vᵀ entered by user — verify against ASCE 7 Hazard Tool (ascehazardtool.org) for site coordinates, Risk Category ' + rc + ', Aₑ = ' + (Number(s.ch32Ae) || 10000).toLocaleString() + ' ft².');

  return {
    applicable: true,
    VT: VT, KhTor: KhTor, qhT: qhT, GT: GT,
    KdT_mwfrs: KdT_mwfrs, KdT_cc: KdT_cc,
    KdT_cc_essen: KdT_cc_essen, KdT_cc_zone1p: KdT_cc_zone1p, KdT_cc_other: KdT_cc_other,
    GCpiT_pos: GCpiT_pos, GCpiT_neg: GCpiT_neg,
    ke: ke, h: h, enc: enc, theta: theta, L: L, B: B, LB: LB, hL: hL,
    Cp_ww: Cp_ww, Cp_lw: Cp_lw, Cp_sw: Cp_sw,
    pT_ww: pT_ww, pT_lw: pT_lw, pT_sw: pT_sw,
    roofZones_mwfrs: roofZones_mwfrs,
    cc_roof: cc_roof, cc_wall: cc_wall,
    tornOpenFactor: tornOpenFactor,
    essential: s.ch32Essential || false,
    warnings: warnings
  };
}

function reportCh32HTML(r32, r) {
  if (!r32) return '';
  if (!r32.applicable) {
    return '<section class="rpt-section"><h2>Ch.32 — Tornado Loads</h2><div class="rpt-note warn">' + r32.reason + '</div></section>';
  }
  var f2 = function(v) { return (typeof v === 'number') ? v.toFixed(2) : '—'; };
  var pf = function(v) { return v.toFixed(2) + ' psf'; };
  var s = r && r.s ? r.s : {};

  var h = '<section class="rpt-section"><h2>Ch.32 — Tornado Loads (ASCE 7-22)</h2>';

  h += '<h3>1. Applicability &amp; Inputs</h3>';
  h += '<table class="rpt-table"><thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead><tbody>';
  h += '<tr><td>Risk Category</td><td>' + (s.riskCategory || '—') + '</td><td>Table 1.5-1</td></tr>';
  h += '<tr><td>Tornado Speed, V<sub>T</sub></td><td>' + r32.VT.toFixed(0) + ' mph</td><td>Sec. 32.5 / ASCE Hazard Tool</td></tr>';
  h += '<tr><td>Eff. Plan Area, A<sub>e</sub></td><td>' + (s.ch32Ae ? Number(s.ch32Ae).toLocaleString() : '—') + ' ft²</td><td>Sec. 32.5.4</td></tr>';
  h += '<tr><td>Enclosure</td><td>' + r32.enc + '</td><td>Sec. 32.12 / Table 32.13-1</td></tr>';
  h += '</tbody></table>';

  h += '<h3>2. Tornado Velocity Pressure</h3>';
  h += '<table class="rpt-table"><thead><tr><th>Parameter</th><th>Value</th><th>Ref.</th></tr></thead><tbody>';
  h += '<tr><td>K<sub>hTor</sub> (h = ' + r32.h.toFixed(0) + ' ft)</td><td>' + f2(r32.KhTor) + '</td><td>Table 32.10-1</td></tr>';
  h += '<tr><td>K<sub>e</sub></td><td>' + f2(r32.ke) + '</td><td>Sec. 32.9</td></tr>';
  h += '<tr><td>q<sub>hT</sub> = 0.00256 K<sub>hTor</sub> K<sub>e</sub> V<sub>T</sub>&sup2;</td><td>' + pf(r32.qhT) + '</td><td>Eq. 32.10-1</td></tr>';
  h += '<tr><td>G<sub>T</sub></td><td>' + f2(r32.GT) + '</td><td>Sec. 32.11.1</td></tr>';
  h += '</tbody></table>';

  h += '<h3>3. Load Factors</h3>';
  h += '<table class="rpt-table"><thead><tr><th>Factor</th><th>Value</th><th>Source</th></tr></thead><tbody>';
  h += '<tr><td>K<sub>dT</sub> — MWFRS</td><td>' + f2(r32.KdT_mwfrs) + '</td><td>Table 32.6-1</td></tr>';
  h += '<tr><td>K<sub>dT</sub> — C&amp;C (' + (r32.essential ? 'Essential Fac.' : 'standard') + ')</td><td>' + f2(r32.KdT_cc) + '</td><td>Table 32.6-1</td></tr>';
  h += '<tr><td>(GC<sub>piT</sub>)<sub>+</sub></td><td>+' + f2(r32.GCpiT_pos) + '</td><td>Table 32.13-1</td></tr>';
  h += '<tr><td>(GC<sub>piT</sub>)<sub>−</sub></td><td>' + f2(r32.GCpiT_neg) + '</td><td>Table 32.13-1</td></tr>';
  h += '</tbody></table>';

  var isOpen = (r32.enc === 'open' || r32.enc === 'openFreeRoof');
  if (!isOpen) {
    h += '<h3>4. MWFRS Tornado Pressures (Eq. 32.15-1)</h3>';
    h += '<p style="font-size:0.88em;color:#555">p<sub>T</sub> = q<sub>hT</sub>·G<sub>T</sub>·K<sub>dT</sub>·K<sub>vT</sub>·C<sub>p</sub> − q<sub>hT</sub>·(GC<sub>piT</sub>)</p>';
    h += '<table class="rpt-table"><thead><tr><th>Surface</th><th>C<sub>p</sub></th><th>K<sub>vT</sub></th><th>LC1 (+GC<sub>piT</sub>)</th><th>LC2 (−GC<sub>piT</sub>)</th><th>Governing</th></tr></thead><tbody>';
    [['Windward Wall', r32.pT_ww], ['Leeward Wall', r32.pT_lw], ['Side Walls', r32.pT_sw]].forEach(function(row) {
      var p = row[1];
      h += '<tr><td>' + row[0] + '</td><td>' + f2(p.Cp) + '</td><td>' + f2(p.KvT) + '</td><td>' + pf(p.lc1) + '</td><td>' + pf(p.lc2) + '</td><td><strong>' + pf(p.gov) + '</strong></td></tr>';
    });
    h += '</tbody></table>';

    if (r32.roofZones_mwfrs && r32.roofZones_mwfrs.length) {
      h += '<p style="margin-top:10px;font-size:0.88em;color:#555">Roof zones (flat/low-slope, K<sub>vT</sub> = 1.1 uplift / 1.0 downward, Eq. 32.15-1):</p>';
      h += '<table class="rpt-table"><thead><tr><th>Zone</th><th>C<sub>p</sub></th><th>Uplift LC1</th><th>Uplift LC2</th><th>Down LC1</th><th>Down LC2</th></tr></thead><tbody>';
      r32.roofZones_mwfrs.forEach(function(z) {
        h += '<tr><td>' + z.label + '</td><td>' + f2(z.cp1) + '</td><td>' + pf(z.pT_up_lc1) + '</td><td>' + pf(z.pT_up_lc2) + '</td><td>' + pf(z.pT_dn_lc1) + '</td><td>' + pf(z.pT_dn_lc2) + '</td></tr>';
      });
      h += '</tbody></table>';
    }

    h += '<h3>5. C&amp;C Tornado Pressures (Eq. 32.17-1)</h3>';
    h += '<p style="font-size:0.88em;color:#555">p<sub>T</sub> = q<sub>hT</sub>·[K<sub>dT</sub>·K<sub>vT</sub>·(GC<sub>p</sub>) − (GC<sub>piT</sub>)]</p>';
    h += '<table class="rpt-table"><thead><tr><th>Zone</th><th>(GC<sub>p</sub>)</th><th>K<sub>vT</sub></th><th>p<sub>T</sub> LC1</th><th>p<sub>T</sub> LC2</th><th>Governing</th></tr></thead><tbody>';
    h += '<tr><td colspan="6" style="background:#f5f5f5;font-weight:600;font-size:0.85em">Roof Zones</td></tr>';
    r32.cc_roof.forEach(function(z) {
      [['neg','Uplift'], ['pos','Downward']].forEach(function(pair) {
        var d = z[pair[0]];
        h += '<tr><td>Z' + z.zone + ' ' + pair[1] + '</td><td>' + f2(d.gcv) + '</td><td>' + f2(d.KvT) + '</td><td>' + pf(d.pT_lc1) + '</td><td>' + pf(d.pT_lc2) + '</td><td><strong>' + pf(d.gov) + '</strong></td></tr>';
      });
    });
    h += '<tr><td colspan="6" style="background:#f5f5f5;font-weight:600;font-size:0.85em">Wall Zones</td></tr>';
    r32.cc_wall.forEach(function(z) {
      [['neg','Suction'], ['pos','Pressure']].forEach(function(pair) {
        var d = z[pair[0]];
        h += '<tr><td>Z' + z.zone + ' ' + pair[1] + '</td><td>' + f2(d.gcv) + '</td><td>' + f2(d.KvT) + '</td><td>' + pf(d.pT_lc1) + '</td><td>' + pf(d.pT_lc2) + '</td><td><strong>' + pf(d.gov) + '</strong></td></tr>';
      });
    });
    h += '</tbody></table>';
  } else {
    h += '<h3>4. Open Building Tornado Pressures (Eq. 32.15-2 / 32.17-3)</h3>';
    h += '<p style="font-size:0.88em;color:#555">p<sub>T</sub> = q<sub>hT</sub>·G<sub>T</sub>·K<sub>dT</sub>·C<sub>N</sub></p>';
    h += '<p>q<sub>hT</sub>·G<sub>T</sub>·K<sub>dT</sub> = ' + pf(r32.tornOpenFactor) + ' × C<sub>N</sub></p>';
    h += '<p style="font-size:0.88em;color:#666">Multiply by C<sub>N</sub> values from the open building results above to obtain tornado pressures.</p>';
  }

  if (r32.warnings.length) {
    h += '<div class="rpt-note warn" style="margin-top:14px">';
    r32.warnings.forEach(function(w) { h += '<p>⚠ ' + w + '</p>'; });
    h += '</div>';
  }
  h += '</section>';
  return h;
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

function stepsTableHTML(steps) {
  // Calculation | Result | Reference — Reference always on the right.
  let html = '<table class="steps-table"><thead><tr><th>Calculation</th><th>Result</th><th>Reference</th></tr></thead><tbody>';
  steps.forEach(st => {
    html += '<tr>' +
      '<td class="calc-col"><span class="step-label">' + st.label + '</span><div class="formula">' + st.formula + '</div></td>' +
      '<td class="result-col">' + st.result + '</td>' +
      '<td class="ref-col"><span class="src-tag">' + st.clause + '</span></td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderSteps(steps) {
  const c = document.getElementById('stepsContainer');
  if (!c) return;
  c.innerHTML = stepsTableHTML(steps);
}

function zoneTableHTML(rows, dual, labels) {
  if (!rows.length) return '<p class="muted">Not applicable.</p>';
  const lbl = labels || ZONE_LABELS;
  let html = '<table><thead><tr><th>Zone</th>';
  if (dual) html += '<th>(GC<sub>p</sub>) range</th>'; else html += '<th>(GC<sub>pf</sub>)</th>';
  html += '<th>p<sub>min</sub> (outward / suction), ' + pUnit() + '</th><th>p<sub>max</sub> (inward / positive), ' + pUnit() + '</th></tr></thead><tbody>';
  rows.forEach(r => {
    const gcStr = dual
      ? fmt(r.gcp.neg, 2) + ' to ' + fmt(r.gcp.pos, 2)
      : fmt(r.gcpf, 2);
    html += '<tr><td>' + (lbl[r.zone] || r.zone) + '</td><td>' + gcStr + '</td>' +
      '<td>' + fmt(pVal(r.p.min), 2) + '</td><td>' + fmt(pVal(r.p.max), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function zoneTable(containerId, rows, dual, labels) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = zoneTableHTML(rows, dual, labels);
}

// Distinct zone labels for the roof overhang table (Sec. 30.7) — '2'/'3' here refer
// to the roof-surface zone whose (GCp) feeds the combination (see gcpOverhang).
const OVERHANG_ZONE_LABELS = {
  '2': '2 (eave, w/ wall Zone 4)',
  '3': '3 (corner, w/ wall Zone 5)'
};

// Zone labels for the parapet C&C table (Sec. 30.6) — these are wall zones 4/5; the
// paired roof zone (per PARAPET_ROOF_ZONE) feeds Load A — see gcpParapet().
const PARAPET_ZONE_LABELS = {
  '4': '4 (field, w/ roof Zone 2)',
  '5': '5 (corner, w/ roof Zone 3)'
};

// C&C parapet table (Sec. 30.6, Load A / Load B) — distinct from zoneTable() because
// each zone carries two independent (GCp)/pressure pairs (Load A and Load B) rather
// than a single neg/pos range.
function ccParapetTableHTML(rows, labels) {
  if (!rows.length) return '<p class="muted">Not applicable.</p>';
  const lbl = labels || ZONE_LABELS;
  let html = '<table><thead><tr><th>Zone</th>' +
    '<th>(GC<sub>p</sub>) Load A</th><th>p<sub>A</sub>, ' + pUnit() + '</th>' +
    '<th>(GC<sub>p</sub>) Load B</th><th>p<sub>B</sub>, ' + pUnit() + '</th></tr></thead><tbody>';
  rows.forEach(r => {
    html += '<tr><td>' + (lbl[r.zone] || r.zone) + '</td>' +
      '<td>' + fmt(r.gcA, 2) + '</td><td>' + fmt(pVal(r.pA), 2) + '</td>' +
      '<td>' + fmt(r.gcB, 2) + '</td><td>' + fmt(pVal(r.pB), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function ccParapetTable(containerId, rows, labels) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = ccParapetTableHTML(rows, labels);
}

// Open Buildings — gamma=0/180 deg results table (Figs. 27.3-4/5/6, or Fig. 27.3-7
// when Fig. 27.3-4 Note 4 applies). Four rows: gamma=0/180 deg x Load Cases A/B.
function openRoofGammaTableHTML(gamma0180) {
  if (!gamma0180) return '<p class="muted">See note above.</p>';
  let html = '<table><thead><tr><th>Wind Direction</th><th>Load Case</th>' +
    '<th>C<sub>NW</sub></th><th>C<sub>NL</sub></th><th>p<sub>W</sub>, ' + pUnit() + '</th><th>p<sub>L</sub>, ' + pUnit() + '</th></tr></thead><tbody>';
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
  return html;
}

function openRoofGammaTable(containerId, gamma0180) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = openRoofGammaTableHTML(gamma0180);
}

// Open Buildings — gamma=90/270 deg results table (Fig. 27.3-7, 3 zones x Load Cases A/B)
function openRoofZoneTableHTML(fig277) {
  let html = '<table><thead><tr><th>Zone (horiz. distance from windward edge)</th>' +
    '<th>C<sub>N</sub>, Load Case A</th><th>p<sub>A</sub>, ' + pUnit() + '</th>' +
    '<th>C<sub>N</sub>, Load Case B</th><th>p<sub>B</sub>, ' + pUnit() + '</th></tr></thead><tbody>';
  fig277.zoneKeys.forEach((zk, i) => {
    html += '<tr><td>' + fig277.zoneLabels[zk] + '</td>' +
      '<td>' + fmt(fig277.A[i].CN, 2) + '</td><td>' + fmt(pVal(fig277.A[i].p), 2) + '</td>' +
      '<td>' + fmt(fig277.B[i].CN, 2) + '</td><td>' + fmt(pVal(fig277.B[i].p), 2) + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function openRoofZoneTable(containerId, fig277) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = openRoofZoneTableHTML(fig277);
}

// Open Building C&C (Sec. 30.5) — results panel. Shown only when enclosure === 'openFreeRoof'.
function renderOpenRoofCC(r) {
  const section = document.getElementById('openRoofCCSection');
  if (!section) return;
  section.style.display = (state.enclosure === 'openFreeRoof') ? '' : 'none';
  if (state.enclosure !== 'openFreeRoof' || !r.cc30s305) return;
  section.innerHTML = '<h2>Open Building C&amp;C &mdash; Sec. 30.5 <span class="ref">Eq. 30.5-1: p = q<sub>h</sub>K<sub>d</sub>GC<sub>N</sub></span></h2>' +
    reportCC30Sec305HTML(r);
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

  // Procedure toggle visibility (Ch.28 Envelope vs Ch.27 Directional)
  const mwfrsEnvDiv  = document.getElementById('mwfrsEnvelopeResults');
  const mwfrsDir27   = document.getElementById('mwfrsDirect27Results');
  const buildingLRow = document.getElementById('buildingLRow');
  const ch28Warning  = document.getElementById('ch28TallWarning');
  const isDirectional = state.mwfrsProcedure === 'directional';
  if (mwfrsEnvDiv)  mwfrsEnvDiv.style.display  = isDirectional ? 'none' : '';
  if (mwfrsDir27)   mwfrsDir27.style.display   = isDirectional ? '' : 'none';
  if (buildingLRow) buildingLRow.style.display  = isDirectional ? '' : 'none';
  // Warning when h > 60 ft and Envelope is selected
  if (ch28Warning) {
    const tooTall = state.h > 60 || state.h > state.minDim;
    ch28Warning.style.display = (!isDirectional && tooTall) ? '' : 'none';
  }

  // Render Ch.27 results
  if (isDirectional && r.ch27) {
    const el = document.getElementById('mwfrsDirect27Results');
    if (el) el.innerHTML = reportCh27HTML(r);
  }

  // MWFRS tables (Ch.28 Envelope)
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

  // C&C procedure: auto-selected from h (Sec. 30.3.1 / 30.4.1)
  // h ≤ 60 ft → Part 1 (Fig. 30.3-1); h > 60 ft → Part 2 (Fig. 30.4-1)
  state.ccProcedure = state.h > 60 ? 'part2' : 'part1';
  const ccP1Div    = document.getElementById('cc30Part1Results');
  const ccP2Div    = document.getElementById('cc30Part2Results');
  const cc30P1Warn = document.getElementById('cc30Part1Warning');
  const isPart2    = state.ccProcedure === 'part2';
  if (ccP1Div)   ccP1Div.style.display   = isPart2 ? 'none' : '';
  if (ccP2Div)   ccP2Div.style.display   = isPart2 ? '' : 'none';
  if (cc30P1Warn) cc30P1Warn.style.display = 'none';
  // Auto-selection info banner
  const ccAutoInfo = document.getElementById('ccAutoInfo');
  if (ccAutoInfo) {
    const hDisp = fmt(state.unitSystem === 'SI' ? state.h * 0.3048 : state.h, 1) +
                  (state.unitSystem === 'SI' ? ' m' : ' ft');
    ccAutoInfo.innerHTML = isPart2
      ? '<strong>Ch.30 Part 2 auto-selected</strong> &mdash; h = ' + hDisp + ' &gt; 60 ft (Sec. 30.4.1)'
      : '<strong>Ch.30 Part 1 auto-selected</strong> &mdash; h = ' + hDisp + ' &le; 60 ft (Sec. 30.3.1)';
    ccAutoInfo.style.display = '';
  }
  if (isPart2 && r.cc30p2) {
    const el = document.getElementById('cc30Part2Results');
    if (el) el.innerHTML = reportCC30P2HTML(r);
  }

  // C&C tables (Part 1)
  renderCCCombined(r);
  // Roof overhangs (Sec. 30.7) — only shown when the "has roof overhangs" toggle is on
  const overhangSection = document.getElementById('ccOverhangSection');
  if (overhangSection) overhangSection.style.display = state.hasOverhang ? '' : 'none';
  if (state.hasOverhang) {
    zoneTable('ccOverhangTable', r.ccOverhang, true, OVERHANG_ZONE_LABELS);
  }

  // Parapets (MWFRS Sec. 27.3.4/28.3.4 + C&C Sec. 30.6) — only shown when the
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

  // Attached Canopies on Buildings (Sec. 30.9) — only shown when the
  // "has canopy" toggle is on
  const canopySection = document.getElementById('canopySection');
  if (canopySection) canopySection.style.display = state.hasCanopy ? '' : 'none';
  if (state.hasCanopy && r.canopy) {
    const canopyEl = document.getElementById('canopyResults');
    if (canopyEl) canopyEl.innerHTML = reportCanopyHTML(r);
  }

  // Circular Bins, Silos, and Tanks (Sec. 30.10) — only shown when the
  // "has circular tank" toggle is on
  const circTankSection = document.getElementById('circTankSection');
  if (circTankSection) circTankSection.style.display = state.hasCircularTank ? '' : 'none';
  if (state.hasCircularTank && r.circTank) {
    const circTankEl = document.getElementById('circTankResults');
    if (circTankEl) circTankEl.innerHTML = reportCircTankHTML(r);
  }

  // Stepped Roofs (Sec. 30.3.2.1, Fig. 30.3-3) — only shown when the
  // "has stepped roof" toggle is on
  const steppedRoofSection = document.getElementById('steppedRoofSection');
  if (steppedRoofSection) steppedRoofSection.style.display = state.hasSteppedRoof ? '' : 'none';
  if (state.hasSteppedRoof) {
    const steppedRoofEl = document.getElementById('steppedRoofResults');
    if (steppedRoofEl) {
      steppedRoofEl.innerHTML = r.steppedRoof ? reportSteppedRoofHTML(r) :
        '<div class="alert warn">Enter a lower-roof height that is less than the main roof height h to define a step.</div>';
    }
  }

  // Multispan Gable Roofs (Fig. 30.3-4) — only shown when the
  // "has multispan roof" toggle is on
  const multispanRoofSection = document.getElementById('multispanRoofSection');
  if (multispanRoofSection) multispanRoofSection.style.display = state.hasMultispanRoof ? '' : 'none';
  if (state.hasMultispanRoof && r.multispanRoof) {
    const multispanRoofEl = document.getElementById('multispanRoofResults');
    if (multispanRoofEl) multispanRoofEl.innerHTML = reportMultispanRoofHTML(r);
  }

  // Sawtooth Roofs (Fig. 30.3-6) — only shown when the
  // "has sawtooth roof" toggle is on
  const sawtoothRoofSection = document.getElementById('sawtoothRoofSection');
  if (sawtoothRoofSection) sawtoothRoofSection.style.display = state.hasSawtoothRoof ? '' : 'none';
  if (state.hasSawtoothRoof && r.sawtoothRoof) {
    const sawtoothRoofEl = document.getElementById('sawtoothRoofResults');
    if (sawtoothRoofEl) sawtoothRoofEl.innerHTML = reportSawtoothRoofHTML(r);
  }

  // Domed Roofs (Fig. 30.3-7) — only shown when the
  // "has dome roof" toggle is on
  const domeRoofSection = document.getElementById('domeRoofSection');
  if (domeRoofSection) domeRoofSection.style.display = state.hasDomeRoof ? '' : 'none';
  if (state.hasDomeRoof && r.domeRoof) {
    const domeRoofEl = document.getElementById('domeRoofResults');
    if (domeRoofEl) domeRoofEl.innerHTML = reportDomeRoofHTML(r);
  }

  renderOpenRoof(r);
  renderOpenRoofCC(r);
  // Ch.32 Tornado Loads
  var ch32El = document.getElementById('ch32ResultsSection');
  if (ch32El) {
    if (r.ch32) {
      ch32El.innerHTML = reportCh32HTML(r.ch32, r);
      ch32El.style.display = '';
    } else {
      ch32El.style.display = 'none';
    }
  }
  renderZoneDiagrams(r);

  // Show minimum wind load warning banner in UI
  const minWarnEl = document.getElementById('minWindWarning');
  if (minWarnEl) {
    const anyMin = r.mwfrsMinGoverns || r.ccMinGoverns;
    if (anyMin) {
      const parts = [];
      if (r.mwfrsMinGoverns) {
        const zones = r.mwfrsMinCheck.filter(c => c.governs).map(c => 'Zone ' + c.zone).join(', ');
        parts.push('MWFRS ' + zones + ': min ' + (r.mwfrsMinCheck.find(c=>c.governs && c.type==='wall') ? '16 psf' : '8 psf') + ' governs');
      }
      if (r.ccMinGoverns) {
        const zones = r.ccMinCheck.filter(c => c.governs).map(c => 'Zone ' + c.zone).join(', ');
        parts.push('C&C ' + zones + ': min 16 psf governs');
      }
      minWarnEl.innerHTML = '&#9888; <strong>Minimum wind loads govern</strong> for some zones — ' + parts.join('; ') + '. See report for details (Sec. 27.1.5 / 30.2.2).';
      minWarnEl.style.display = '';
    } else {
      minWarnEl.style.display = 'none';
    }
  }

  // Ch.29 Other Structures results section
  const ch29Sec = document.getElementById('ch29Section');
  if (ch29Sec) {
    const isOther = state.structureCategory === 'otherStructure';
    ch29Sec.style.display = isOther ? '' : 'none';
    if (isOther && r.ch29) ch29Sec.innerHTML = reportCh29HTML(r);
  }

  renderDiagram(r);
  renderPrintCover();

  // Show computed K_zt in auto mode UI
  const kztResultEl = document.getElementById('kztAutoResult');
  if (kztResultEl && state.kztMode === 'auto') {
    const ko = computeKzt(state, state.h);
    kztResultEl.innerHTML = 'K<sub>zt</sub> = <strong>' + fmt(ko.kzt, 3) + '</strong>' + (ko.note ? ' <span style="color:#888; font-size:.78rem;">(H/L<sub>h</sub> < 0.2)</span>' : '');
  }

  lastResult = r;
  const reportEl = document.getElementById('reportContent');
  if (reportEl) reportEl.innerHTML = buildReportHTML(r);
}

/* =====================================================================
   PRINT REPORT COVER (Project Information)
   Mirrors the "Design Information" header of a SkyCiv-style report.
   All values are user-entered metadata (state.projectName, etc.) —
   nothing here is computed.
   ===================================================================== */
function renderPrintCover() {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('coverCompany',       state.companyName  || '');
  setTxt('coverSection',       state.sectionName  || '');
  setTxt('printProjectName',   state.projectName  || '—');
  setTxt('printProjectNumber', state.projectNumber || '—');
  setTxt('printEngineer',      state.engineer     || '—');
  setTxt('printProjectDate',   state.projectDate
    ? new Date(state.projectDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—');
  setTxt('printRiskCategory',  state.riskCategory || '—');
  setTxt('printMode', state.mode === 'mwfrs'
    ? 'Main Wind Force Resisting System (MWFRS), Envelope Procedure (Ch. 28)'
    : 'Components & Cladding (Ch. 30)');
  setTxt('coverChkdBy', state.chkdBy || '—');
  setTxt('coverAppdBy', state.appdBy || '—');
}

/* =====================================================================
   STEP-BY-STEP ENGINEERING REPORT (PDF / print)
   Builds a self-contained "calculation package" — Input Data, Design
   Summary, Step-by-Step Analysis, Diagrams, and Pressure Tables — from
   the SAME compute()/state data used by the on-screen results. Nothing
   here is a new calculation; it only re-presents r/state in a SkyCiv /
   hand-calc style layout (modeled on the "Low-rise Building" sheet of
   the user-supplied reference workbook, 726933068-Wind-ASCE7-22.xlsx).
   ===================================================================== */

// Small helper: one row of a 3-column "Parameter | Value | Reference" table.
function reportRow(label, value, ref) {
  return '<tr><td>' + label + '</td><td>' + value + '</td><td class="ref-col"><span class="src-tag">' + ref + '</span></td></tr>';
}

// Input Data section — every row mirrors a labeled input field already on
// screen (Project Information / Basic Wind Parameters / Building Geometry /
// C&C Effective Wind Areas / Open Roof inputs), with the same ASCE/SEI 7-22
// clause references shown next to those fields or in INFO_CONTENT.
function reportInputDataHTML(r) {
  const s = state;
  const lenUnit = s.unitSystem === 'SI' ? 'm' : 'ft';
  const areaUnit = s.unitSystem === 'SI' ? 'm²' : 'ft²';
  const spdUnit = s.unitSystem === 'SI' ? 'm/s' : 'mph';

  let rows = '';
  rows += reportRow('Calculation procedure', s.mode === 'mwfrs'
    ? 'Main Wind Force Resisting System (MWFRS) &mdash; Envelope Procedure'
    : 'Components &amp; Cladding (C&amp;C)', 'Ch. 28 / Ch. 30');
  rows += reportRow('Risk Category', s.riskCategory, 'Table 1.5-1');
  rows += reportRow('Basic wind speed, V', fmt(speedOut(s.V), 1) + ' ' + spdUnit, 'Sec. 26.5.1, Figs. 26.5-1A&ndash;D');
  rows += reportRow('Exposure category', EXPOSURE[s.exposure].label, 'Sec. 26.7.3');
  rows += reportRow('Topographic factor, K<sub>zt</sub>', fmt(s.kzt, 2), 'Sec. 26.8.2, Fig. 26.8-1');
  rows += reportRow('Ground elevation, z<sub>e</sub>', fmt(lengthOut(s.groundElev), 1) + ' ' + lenUnit, 'Table 26.9-1, Note 2');
  rows += reportRow('Enclosure classification',
    GCPI[s.enclosure].label + (GCPI[s.enclosure].noGcpi ? '' : ' &mdash; (GC<sub>pi</sub>) = &plusmn;' + fmt(GCPI[s.enclosure].pos, 2)),
    'Table 26.13-1');
  rows += reportRow('Mean roof height, h', fmt(lengthOut(s.h), 2) + ' ' + lenUnit, 'Sec. 26.2');
  rows += reportRow('Least horizontal dimension', fmt(lengthOut(s.minDim), 2) + ' ' + lenUnit, 'Fig. 28.3-1/30.3-1, Notation');
  rows += reportRow('Roof type', s.roofType === 'flat' ? 'Flat / low-slope (&theta; &le; 7&deg;)' : 'Gable, hip, or other sloped (&theta; &gt; 7&deg;)', 'Sec. 26.2');
  if (s.roofType !== 'flat' || s.enclosure === 'openFreeRoof') {
    rows += reportRow('Roof angle, &theta;', fmt(s.theta, 1) + '&deg;', 'Notation, Fig. 28.3-1/30.3-1');
  }
  if (s.roofType !== 'flat' && s.mode === 'cc') {
    rows += reportRow('Roof shape', s.roofShape === 'hip' ? 'Hip roof' : 'Gable roof',
      s.roofShape === 'hip' ? 'Figs. 30.3-2D&ndash;G equiv.' : 'Figs. 30.3-2B/2C');
  }
  rows += reportRow('Parapet', s.hasParapet
    ? ('Yes &mdash; height = ' + fmt(lengthOut(s.parapetHeight), 2) + ' ' + lenUnit)
    : 'No', 'Sec. 27.3.4 / 28.3.4 (MWFRS); Sec. 30.6 (C&amp;C)');
  if (s.mode === 'cc') {
    rows += reportRow('Wall C&amp;C effective wind area', fmt(areaOut(s.areaWall), 1) + ' ' + areaUnit, 'Fig. 30.3-1');
    rows += reportRow('Roof C&amp;C effective wind area', fmt(areaOut(s.areaRoof), 1) + ' ' + areaUnit, 'Figs. 30.3-2A&ndash;2G');
    rows += reportRow('Roof overhangs', s.hasOverhang ? 'Yes' : 'No', 'Sec. 30.7');
  }
  if (s.enclosure === 'openFreeRoof') {
    rows += reportRow('Free roof shape',
      s.openRoofShape === 'monoslope' ? 'Monoslope' : (s.openRoofShape === 'pitched' ? 'Pitched' : 'Troughed'),
      'Figs. 27.3-4/5/6');
    rows += reportRow('Wind flow condition', s.openWindFlow === 'obstructed' ? 'Obstructed' : 'Clear', 'Figs. 27.3-4/5/6, Note 2');
    rows += reportRow('Roof plan dimension, L', fmt(lengthOut(s.openL), 2) + ' ' + lenUnit, 'Fig. 27.3-4, Notation');
  }

  return '<table class="report-input-table"><thead><tr><th>Parameter</th><th>Value</th><th>Reference</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

// Design Summary section — the same governing coefficients shown in the
// on-screen "Results Summary" cards (q<sub>h</sub>, K<sub>h</sub>, K<sub>e</sub>, (GC<sub>pi</sub>), zone dim. a),
// plus K<sub>d</sub> and K<sub>zt</sub> for completeness. Values come directly from r/state.
function reportDesignSummaryHTML(r) {
  const s = state;
  let rows = '';
  rows += '<tr><td>Velocity pressure at mean roof height, q<sub>h</sub></td><td>' + fmt(pVal(r.qh), 2) + ' ' + pUnit() + '</td></tr>';
  rows += '<tr><td>Velocity pressure exposure coefficient, K<sub>h</sub></td><td>' + fmt(r.kh, 3) + '</td></tr>';
  rows += '<tr><td>Ground elevation factor, K<sub>e</sub></td><td>' + fmt(r.ke, 3) + '</td></tr>';
  rows += '<tr><td>Wind directionality factor, K<sub>d</sub></td><td>' + fmt(r.kd, 2) + '</td></tr>';
  rows += '<tr><td>Topographic factor, K<sub>zt</sub></td><td>' + fmt(s.kzt, 2) + '</td></tr>';
  if (!GCPI[s.enclosure].noGcpi) {
    rows += '<tr><td>Internal pressure coefficient, (GC<sub>pi</sub>)</td><td>&plusmn;' + fmt(r.gcpi.pos, 2) + '</td></tr>';
  }
  rows += '<tr><td>Zone dimension, a</td><td>' + fmt(lengthOut(r.a), 2) + ' ' + (s.unitSystem === 'SI' ? 'm' : 'ft') + '</td></tr>';
  return '<table class="report-input-table"><thead><tr><th>Quantity</th><th>Value</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

// MWFRS Design Pressures section (Ch. 28 Envelope Procedure) — identical
// tables/headings/citations to the on-screen data-mode="mwfrs" panel.

// Ch.27 Directional Procedure — report section HTML
function reportCh27HTML(r) {
  const s  = state;
  const c  = r.ch27;
  if (!c) return '<p class="muted">Ch.27 result not available.</p>';

  const pu  = pUnit();
  const pf  = v => (pVal(v) >= 0 ? '+' : '') + fmt(pVal(v), 2) + ' ' + pu;
  const gcpiVal = (r.gcpi && r.gcpi.pos != null) ? r.gcpi.pos : c.gcpi;

  let html = '';

  // ── Header note ──
  html += '<p class="muted" style="margin-bottom:10px;">Eq. 27.3-1: p = qGC<sub>p</sub> &minus; q<sub>i</sub>(GC<sub>pi</sub>), '
        + 'G = ' + fmt(c.G, 2)
        + ', K<sub>d</sub> = ' + fmt(c.KD, 2)
        + ', &plusmn;GC<sub>pi</sub> = &plusmn;' + fmt(gcpiVal, 2)
        + ' &bull; q<sub>h</sub> = ' + fmt(pVal(c.qh), 2) + ' ' + pu
        + ' &bull; L/B = ' + fmt(c.LB, 2)
        + ', h/L = ' + fmt(c.hL, 3) + '</p>';

  // ── Windward wall profile ──
  html += '<h3>Windward Wall &mdash; Pressure Profile'
        + ' <span class="ref">Fig. 27.3-1, C<sub>p</sub> = +0.8; Sec. 27.3.1</span></h3>';
  html += '<p class="muted" style="margin-bottom:6px;">'
        + 'q = q<sub>z</sub> at each height z (Table 26.10-1 formula). '
        + 'LC2 (−GC<sub>pi</sub>) governs windward for enclosed buildings.</p>';
  html += '<table class="report-input-table"><thead><tr>'
        + '<th>z (ft)</th><th>K<sub>z</sub></th><th>q<sub>z</sub> (' + pu + ')</th>'
        + '<th>LC1 (+GC<sub>pi</sub>) (' + pu + ')</th><th>LC2 (−GC<sub>pi</sub>) (' + pu + ')</th>'
        + '</tr></thead><tbody>';
  c.wwProfile.forEach(row => {
    html += '<tr><td>' + fmt(row.z, 1) + '</td>'
          + '<td>' + fmt(row.kz, 3) + '</td>'
          + '<td>' + fmt(pVal(row.qz), 2) + '</td>'
          + '<td>' + pf(row.pLC1) + '</td>'
          + '<td>' + pf(row.pLC2) + '</td></tr>';
  });
  html += '</tbody></table>';

  // ── Leeward + side walls ──
  html += '<h3>Leeward and Side Walls'
        + ' <span class="ref">Fig. 27.3-1; q = q<sub>h</sub></span></h3>';
  html += '<p class="muted" style="margin-bottom:6px;">'
        + 'LC1 (+GC<sub>pi</sub>) governs leeward/side (positive internal adds to suction).</p>';
  html += '<table class="report-input-table"><thead><tr>'
        + '<th>Surface</th><th>C<sub>p</sub></th>'
        + '<th>LC1 (+GC<sub>pi</sub>) (' + pu + ')</th><th>LC2 (−GC<sub>pi</sub>) (' + pu + ')</th>'
        + '</tr></thead><tbody>';
  html += '<tr><td>Leeward wall (C<sub>p</sub> @ L/B=' + fmt(c.LB, 2) + ')</td>'
        + '<td>' + fmt(c.CP_LW, 2) + '</td>'
        + '<td>' + pf(c.pLW_lc1) + '</td><td>' + pf(c.pLW_lc2) + '</td></tr>';
  html += '<tr><td>Side walls</td>'
        + '<td>' + fmt(c.CP_SW, 1) + '</td>'
        + '<td>' + pf(c.pSW_lc1) + '</td><td>' + pf(c.pSW_lc2) + '</td></tr>';
  html += '</tbody></table>';

  // ── Flat/low-slope roof zones ──
  if (c.roofApplicable && c.roofZones) {
    // ── Flat/low-slope: θ ≤ 10° — Wind Normal to Ridge ──────────────────────────────────────────
    html += '<h3>Roof &mdash; Flat/Low-slope (&theta; &le; 10&deg;), Wind Normal to Ridge'
          + ' <span class="ref">Fig. 27.3-1; q = q<sub>h</sub></span></h3>';
    html += '<p class="muted" style="margin-bottom:6px;">'
          + 'Both C<sub>p</sub> values shall be used (Fig. 27.3-1 Note 3). '
          + 'C<sub>p1</sub> = primary suction; C<sub>p2</sub> = &minus;0.18 (wind reattachment check). '
          + 'Zones measured from windward edge in multiples of h = ' + fmt(s.h, 0) + ' ft.</p>';
    html += '<table class="report-input-table"><thead><tr>'
          + '<th>Zone (from WW edge)</th>'
          + '<th>C<sub>p1</sub></th><th>p(C<sub>p1</sub>, LC1) (' + pu + ')</th>'
          + '<th>C<sub>p2</sub></th><th>p(C<sub>p2</sub>, LC2) (' + pu + ')</th>'
          + '</tr></thead><tbody>';
    c.roofZones.forEach(z => {
      html += '<tr><td>' + z.label + '</td>'
            + '<td>' + fmt(z.cp1, 2) + '</td><td>' + pf(z.p1_lc1) + '</td>'
            + '<td>' + fmt(z.cp2, 2) + '</td><td>' + pf(z.p2_lc2) + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<p class="muted" style="font-size:.8rem; margin-top:6px;">'
          + 'p(C<sub>p2</sub>, LC2) = q<sub>h</sub>(G&sdot;C<sub>p2</sub> + GC<sub>pi</sub>) may be positive (downward pressure). '
          + 'All four combinations [C<sub>p1</sub>/C<sub>p2</sub>] &times; [&plusmn;GC<sub>pi</sub>] must be checked per Fig. 27.3-1 Note 3.</p>';
  } else if (c.roofNTR) {
    // ── Sloped roof: θ > 10° — Wind Normal to Ridge ──────────────────────────────────────────────
    const ntr = c.roofNTR;
    html += '<h3>Roof &mdash; Sloped (&theta; = ' + fmt(s.theta, 1) + '&deg;) &mdash; Wind Normal to Ridge'
          + ' <span class="ref">Fig. 27.3-1, p.284; q = q<sub>h</sub></span></h3>';
    html += '<p class="muted" style="margin-bottom:6px;">'
          + 'Eq. 27.3-1: p = q<sub>h</sub>&sdot;G&sdot;C<sub>p</sub> &minus; q<sub>h</sub>&sdot;(GC<sub>pi</sub>). '
          + 'Both C<sub>p</sub> values per Note 3 must be checked; h/L = ' + fmt(ntr.hL, 2) + '. '
          + 'Interpolated from Fig. 27.3-1 table (ASCE 7-22 p.284).</p>';

    // Windward slope
    html += '<table class="report-input-table"><thead><tr>'
          + '<th>Slope</th>'
          + '<th>C<sub>p1</sub></th>'
          + '<th>p(C<sub>p1</sub>, LC1) (' + pu + ')</th>'
          + '<th>p(C<sub>p1</sub>, LC2) (' + pu + ')</th>'
          + (ntr.ww.cp2 !== null
            ? '<th>C<sub>p2</sub></th><th>p(C<sub>p2</sub>, LC1) (' + pu + ')</th><th>p(C<sub>p2</sub>, LC2) (' + pu + ')</th>'
            : '')
          + '</tr></thead><tbody>';

    const wwCols = ntr.ww.cp2 !== null
      ? '<td>' + fmt(ntr.ww.cp2, 3) + '</td>'
        + '<td>' + pf(ntr.ww.p2_lc1) + '</td>'
        + '<td>' + pf(ntr.ww.p2_lc2) + '</td>'
      : '';
    html += '<tr><td>Windward slope &#x2191;</td>'
          + '<td>' + fmt(ntr.ww.cp1, 3) + '</td>'
          + '<td>' + pf(ntr.ww.p1_lc1) + '</td>'
          + '<td>' + pf(ntr.ww.p1_lc2) + '</td>'
          + wwCols + '</tr>';
    html += '<tr><td>Leeward slope &#x2193;</td>'
          + '<td>' + fmt(ntr.lw.cp, 3) + '</td>'
          + '<td>' + pf(ntr.lw.lc1) + '</td>'
          + '<td>' + pf(ntr.lw.lc2) + '</td>'
          + (ntr.ww.cp2 !== null ? '<td colspan="3" class="muted">—</td>' : '')
          + '</tr>';
    html += '</tbody></table>';
    html += '<p class="muted" style="font-size:.8rem; margin-top:6px;">'
          + 'LC1 = +GC<sub>pi</sub> (max suction / min pressure); '
          + 'LC2 = &minus;GC<sub>pi</sub> (min suction / max pressure). '
          + 'Governing leeward suction: LC1 (most negative). '
          + 'Windward slope: check all four combinations per Note 3.</p>';

    // Wind Parallel to Ridge (zone-based, same as flat roof formula)
    html += '<h3>Roof &mdash; Sloped (&theta; = ' + fmt(s.theta, 1) + '&deg;) &mdash; Wind Parallel to Ridge'
          + ' <span class="ref">Fig. 27.3-1, p.284; q = q<sub>h</sub></span></h3>';
    html += '<p class="muted" style="margin-bottom:6px;">'
          + 'For wind parallel to ridge (all &theta;): use horizontal-distance zones same as flat roof (Fig. 27.3-1 Note 8). '
          + 'Zones measured from windward edge; h = ' + fmt(s.h, 0) + ' ft, h/L = ' + fmt(ntr.hL, 2) + '.</p>';
    html += '<table class="report-input-table"><thead><tr>'
          + '<th>Zone (from WW edge)</th>'
          + '<th>C<sub>p1</sub></th><th>p(C<sub>p1</sub>, LC1) (' + pu + ')</th>'
          + '<th>C<sub>p2</sub></th><th>p(C<sub>p2</sub>, LC2) (' + pu + ')</th>'
          + '</tr></thead><tbody>';
    c.roofZonesPTR.forEach(z => {
      html += '<tr><td>' + z.label + '</td>'
            + '<td>' + fmt(z.cp1, 2) + '</td><td>' + pf(z.p1_lc1) + '</td>'
            + '<td>' + fmt(z.cp2, 2) + '</td><td>' + pf(z.p2_lc2) + '</td></tr>';
    });
    html += '</tbody></table>';
  }

  // ── Minimum pressure note ──
  const minWarns = [];
  if (c.wallMinGoverns) minWarns.push('wall pressures &lt; 16 psf minimum');
  if (c.roofMinGoverns) minWarns.push('roof zone pressures &lt; 8 psf minimum');
  if (minWarns.length) {
    html += '<div class="alert warn" style="margin-top:12px;">'
          + '&#9888;&#65039; Minimum wind load (Sec. 27.1.5) governs: '
          + minWarns.join('; ')
          + '. Use 16 psf (walls) / 8 psf (roof) in these locations.</div>';
  }

  // Sec. 27.3.5 Roof Overhangs
  var oh27 = c.ch27Overhang;
  if (s.hasOverhang && oh27) {
    var fOH = function(v){ return (pVal(v)>=0?'+':'')+fmt(pVal(v),1)+' '+pUnit(); };
    html += '<h3>Roof Overhang &mdash; Net MWFRS Pressure <span class="ref">Sec. 27.3.5</span></h3>'
          + '<p class="muted" style="margin-bottom:6px;">Soffit C<sub>p</sub>=+0.8 (Sec. 27.3.5, no (GC<sub>pi</sub>)). '
          + 'Top: C<sub>p</sub>='+fmt(oh27.cpTop,2)+' (windward edge, Fig. 27.3-1). '
          + 'p<sub>net</sub>=p<sub>soffit</sub>&minus;p<sub>top</sub> (upward positive).</p>'
          + '<table class="report-input-table"><thead><tr>'
          + '<th>Surface</th><th>C<sub>p</sub></th>'
          + '<th>LC1 ('+pUnit()+')</th><th>LC2 ('+pUnit()+')</th></tr></thead><tbody>'
          + '<tr><td>Soffit (upward)</td><td>+0.80</td>'
          + '<td colspan="2">'+fOH(oh27.pSoffit)+'</td></tr>'
          + '<tr><td>Top surface</td><td>'+fmt(oh27.cpTop,2)+'</td>'
          + '<td>'+fOH(oh27.pTop_lc1)+'</td><td>'+fOH(oh27.pTop_lc2)+'</td></tr>'
          + '<tr style="font-weight:700;background:#f0f4f8"><td>p<sub>net</sub> uplift</td><td>&mdash;</td>'
          + '<td>'+fOH(oh27.pNet_lc1)+'</td><td>'+fOH(oh27.pNet_lc2)+'</td></tr>'
          + '</tbody></table>';
  }

  // Design load cases note
  html += '<div class="alert info" style="margin-top:12px;">'
        + '<strong>Design Load Cases (Fig. 27.3-8):</strong> Case 1 (full load, shown above) and '
        + 'Case 2 (75% with torsional eccentricity e = 0.15B) shall both be checked per Sec. 27.3.6. '
        + 'Cases 3 and 4 (simultaneous orthogonal loads) apply where required. '
        + 'Torsional load cases are not computed in this calculator &mdash; verify separately.'
        + '</div>';

  return html;
}

function reportMWFRSHTML(r) {
  const s = state;
  let html = '<h3>Load Case 1 (Zones 1&ndash;4, 1E&ndash;4E) &mdash; &theta;-dependent <span class="ref">Fig. 28.3-1</span></h3>' +
    zoneTableHTML(r.mwfrsLC1, false) +
    '<h3>Load Case 2 (Zones 1&ndash;6, 1E&ndash;6E) &mdash; all &theta; <span class="ref">Fig. 28.3-1</span></h3>' +
    zoneTableHTML(r.mwfrsLC2, false);

  const torsionNote = r.torsionApplies
    ? 'Mean roof height h = ' + fmt(lengthOut(s.h), 1) + ' ' + (s.unitSystem === 'SI' ? 'm' : 'ft') + ' &gt; 30 ft &rarr; Load Cases 3 and 4 (Fig. 28.3-2) are required unless one of the exceptions in Sec. 28.3.2 applies (e.g., torsional sensitivity not significant per ASCE 7 Ch. 26 criteria).'
    : 'Mean roof height h &le; 30 ft &mdash; torsional Load Cases 3 and 4 (Fig. 28.3-2) are not required for this building per Sec. 28.3.2 (shown below for reference).';

  html += '<h3>Torsional Load Cases 3 &amp; 4 (T-zones) <span class="ref">Fig. 28.3-2</span></h3>' +
    '<div class="alert info">' + torsionNote + '</div>' +
    '<p class="muted" style="margin-top:6px;">Load Case 3 = Load Case 1 zone pressures above, plus the following T-zones:</p>' + zoneTableHTML(r.mwfrsLC3, false) +
    '<p class="muted" style="margin-top:6px;">Load Case 4 = Load Case 2 zone pressures above, plus the following T-zones:</p>' + zoneTableHTML(r.mwfrsLC4, false);
  return html;
}

// C&C Design Pressures section (Ch. 30) — identical tables/headings/
// citations to the on-screen data-mode="cc" + overhang panels.
// Ch.30 Part 2 C&C HTML report section
function reportCC30P2HTML(r) {
  const c = r.cc30p2;
  if (!c) return '<p class="muted">Ch.30 Part 2 data unavailable.</p>';
  const s     = state;
  const u     = s.unitSystem === 'SI';
  const pU    = pUnit();
  const lenU  = u ? 'm' : 'ft';
  const aU    = u ? 'm²' : 'ft²';
  const fmt2  = v => fmt(pVal(v), 2);

  let html = '';

  // Velocity pressure summary
  html += '<table class="report-input-table"><tbody>' +
    '<tr><td>K<sub>h</sub> (mean roof height)</td><td>' + fmt(c.kh, 3) + '</td></tr>' +
    '<tr><td>q<sub>h</sub></td><td>' + fmt2(c.qh) + ' ' + pU + '</td></tr>' +
    '<tr><td>Eff. wind area, walls</td><td>' + fmt(c.Aw, 0) + ' ' + aU + '</td></tr>' +
    '<tr><td>Eff. wind area, roof</td><td>' + fmt(c.Ar, 0) + ' ' + aU + '</td></tr>' +
    '<tr><td>(GC<sub>pi</sub>)</td><td>&pm;' + fmt(c.gcpiVal, 2) + '</td></tr>' +
    '</tbody></table>';

  // ⚠️ Errata / source caveat
  html += '<div class="alert info" style="margin:8px 0 12px;">' +
    '&#9432; GC<sub>p</sub> values from ASCE 7-16 Fig. 30.6-1 (renamed to ASCE 7-22 Fig. 30.4-1). ' +
    'Fig. 30.4-1 was revised in Errata 1 (2024-09-20) &mdash; verify against current ASCE 7-22 before final design.' +
    '</div>';

  // Windward wall height profile table
  html += '<h3>Wall C&amp;C &mdash; Windward Height Profile <span class="ref">Fig. 30.4-1, Note 4: +GC<sub>p</sub> uses q<sub>z</sub></span></h3>';
  html += '<p class="muted" style="margin:0 0 8px;">p<sub>max</sub> = q<sub>z</sub>·K<sub>d</sub>·(+GC<sub>p</sub>) &minus; q<sub>h</sub>·K<sub>d</sub>·(&minus;GC<sub>pi</sub>) &nbsp;|&nbsp; ' +
          'p<sub>min</sub> = q<sub>h</sub>·K<sub>d</sub>·(GC<sub>p</sub><sup>&minus;</sup>) &minus; q<sub>h</sub>·K<sub>d</sub>·(+GC<sub>pi</sub>)</p>';
  html += '<table class="report-table"><thead><tr>' +
    '<th>z (' + lenU + ')</th><th>K<sub>z</sub></th><th>q<sub>z</sub> (' + pU + ')</th>' +
    '<th>Zone 4 p<sub>max</sub></th><th>Zone 4 p<sub>min</sub></th>' +
    '<th>Zone 5 p<sub>max</sub></th><th>Zone 5 p<sub>min</sub></th>' +
    '</tr></thead><tbody>';
  for (const row of c.wwProfile) {
    html += '<tr>' +
      '<td>' + fmt(lengthOut(row.z), 1) + '</td>' +
      '<td>' + fmt(row.kz, 3) + '</td>' +
      '<td>' + fmt2(row.qz) + '</td>' +
      '<td class="val-pos">' + fmt2(row.z4_pmax) + '</td>' +
      '<td class="val-neg">' + fmt2(row.z4_pmin) + '</td>' +
      '<td class="val-pos">' + fmt2(row.z5_pmax) + '</td>' +
      '<td class="val-neg">' + fmt2(row.z5_pmin) + '</td>' +
      '</tr>';
  }
  html += '</tbody></table>';

  // Roof
  if (c.roofApplicable && c.roofZones) {
    html += '<h3>Roof C&amp;C &mdash; Zones 1, 2, 3 (flat/low-slope &theta; &le; 10&deg;) <span class="ref">Fig. 30.4-1</span></h3>';
    html += '<table class="report-table"><thead><tr>' +
      '<th>Zone</th><th>(GC<sub>p</sub>)<sup>+</sup></th><th>(GC<sub>p</sub>)<sup>&minus;</sup></th>' +
      '<th>p<sub>max</sub> (' + pU + ')</th><th>p<sub>min</sub> (' + pU + ')</th>' +
      '</tr></thead><tbody>';
    for (const z of c.roofZones) {
      html += '<tr><td>' + z.zone + '</td>' +
        '<td class="val-pos">+' + fmt(z.gcp.pos, 2) + '</td>' +
        '<td class="val-neg">' + fmt(z.gcp.neg, 2) + '</td>' +
        '<td class="val-pos">' + fmt2(z.pMax) + '</td>' +
        '<td class="val-neg">' + fmt2(z.pMin) + '</td></tr>';
    }
    html += '</tbody></table>';
  } else if (c.roofSlopedP2) {
    const rs = c.roofSlopedP2;
    const isCapped = rs.zones.some(z => z.capped);
    const figRef  = rs.shape === 'hip' ? 'Figs. 30.3-2D&ndash;G equiv.' : 'Figs. 30.3-2B/2C';
    const capMsg  = rs.shape === 'hip'
      ? 'Roof angle &theta; &gt; 45&deg;: Figs. 30.3-2D&ndash;G (hip) do not extend past &theta; = 45&deg;. The &theta; = 45&deg; coefficients are used as a capped approximation &mdash; verify against the Standard.'
      : 'Roof angle &theta; &gt; 27&deg;: Figs. 30.3-2B/2C (gable) do not extend past &theta; = 27&deg;. The &theta; = 20&deg;&ndash;27&deg; (Fig. 30.3-2C) coefficients are used as a capped approximation &mdash; verify against the Standard.';
    html += '<h3>Roof C&amp;C &mdash; Zones 1, 2, 3 (&theta; &gt; 7&deg;) <span class="ref">' + figRef + ', per Fig. 30.4-1 Note 6</span></h3>';
    html += '<p class="muted" style="margin:0 0 8px;">' +
      'Fig. 30.4-1 Note 6: for &theta; &gt; 7&deg;, use GC<sub>p</sub> from Part 1 figures (Fig. 30.3-2A&ndash;I) with attendant q<sub>h</sub>. ' +
      'p<sub>max</sub> = q<sub>h</sub>&middot;K<sub>d</sub>&middot;(+GC<sub>p</sub>) + q<sub>h</sub>&middot;K<sub>d</sub>&middot;GC<sub>pi</sub> &nbsp;|&nbsp; ' +
      'p<sub>min</sub> = q<sub>h</sub>&middot;K<sub>d</sub>&middot;(GC<sub>p</sub><sup>&minus;</sup>) &minus; q<sub>h</sub>&middot;K<sub>d</sub>&middot;GC<sub>pi</sub></p>';
    if (isCapped) {
      html += '<div class="alert warn">' + capMsg + '</div>';
    }
    html += '<table class="report-table"><thead><tr>' +
      '<th>Zone</th><th>(GC<sub>p</sub>)<sup>+</sup></th><th>(GC<sub>p</sub>)<sup>&minus;</sup></th>' +
      '<th>p<sub>max</sub> (' + pU + ')</th><th>p<sub>min</sub> (' + pU + ')</th>' +
      '</tr></thead><tbody>';
    for (const z of rs.zones) {
      html += '<tr><td>' + z.zone + '</td>' +
        '<td class="val-pos">+' + fmt(z.gcp.pos, 2) + '</td>' +
        '<td class="val-neg">' + fmt(z.gcp.neg, 2) + '</td>' +
        '<td class="val-pos">' + fmt2(z.pMax) + '</td>' +
        '<td class="val-neg">' + fmt2(z.pMin) + '</td></tr>';
    }
    html += '</tbody></table>';
  }

  // Minimum load warning
  if (c.wallMinGoverns) {
    html += '<div class="alert warn" style="margin-top:10px;">Sec. 30.2.2 minimum: wall C&amp;C &ge; 16 psf governs for one or more zones.</div>';
  }

  return html;
}


/* =====================================================================
   CH.29 — OTHER STRUCTURES (Directional Procedure)
   Sec. 29.3:   F  = qh·Kd·G·Cf·As        Eq. 29.3-1  (solid signs/walls)
   Sec. 29.4:   F  = qz·Kd·G·Cf·Af        Eq. 29.4-1  (chimneys/tanks/open frames)
   Sec. 29.4.1: Fh = qh·Kd·(GCr)·Af       Eq. 29.4-2  (rooftop structures, horizontal)
                Fv = qh·Kd·(GCr)·Ar        Eq. 29.4-3  (rooftop structures, vertical)
   Sec. 29.7:   min F ≥ 16 psf × Af
   ===================================================================== */

// Wind directionality factors Kd for Ch.29 — Table 26.6-1, ASCE 7-22
const KD_SIGN      = 0.85;  // Solid freestanding walls / solid signs
const KD_CHIMNEY   = 0.95;  // Chimneys, tanks (round/hex); 0.90 used for square below
const KD_OPEN_SIGN = 0.85;  // Open signs, single-plane open frames
const KD_TOWER     = 0.85;  // Trussed towers (square or triangular)
const KD_ROOFTOP   = 0.85;  // Rooftop structures/equipment

// Gust-effect factor G = 0.85 for rigid structures — Sec. 26.11.1
const G_RIGID_CH29 = 0.85;

// Minimum design wind force (Sec. 29.7): F ≥ 16 psf × Af
const PSF_MIN_CH29 = 16; // psf

// ------------------------------------------------------------------
// Fig. 29.3-1: Cf, Cases A and B — solid freestanding walls / signs.
// Source: Fig. 29.3-1, ASCE 7-22 (read from 300 DPI render, p. 301).
// Rows: clearance ratio s/h (ascending). Cols: aspect ratio B/s.
// s = clearance from ground to bottom of sign; B = width; h = sign height.
// Linear interpolation is permitted (Fig. 29.3-1 Note 4).
// ------------------------------------------------------------------
const CF_SIGN_SH_VALS = [0.16, 0.2, 0.5, 0.9];
const CF_SIGN_BS_VALS = [0.05, 0.1, 0.2, 0.5, 1, 2, 3, 4, 5, 10, 20, 30, 45];
const CF_SIGN_TABLE = [
  // s/h ≤ 0.16 (wall on ground or very low clearance):
  [1.95, 1.90, 1.85, 1.85, 1.80, 1.75, 1.75, 1.70, 1.65, 1.55, 1.55, 1.55, 1.55],
  // s/h = 0.2:
  [1.95, 1.90, 1.85, 1.80, 1.70, 1.65, 1.65, 1.60, 1.55, 1.55, 1.55, 1.55, 1.55],
  // s/h = 0.5:
  [1.85, 1.85, 1.85, 1.75, 1.65, 1.55, 1.50, 1.50, 1.45, 1.45, 1.40, 1.40, 1.30],
  // s/h = 0.9:
  [1.85, 1.75, 1.70, 1.60, 1.55, 1.50, 1.45, 1.45, 1.40, 1.40, 1.40, 1.40, 1.30],
];

function cfSolidSign(Bs, sh) {
  // Bilinear interpolation in Fig. 29.3-1 (Cases A and B).
  const shC = Math.max(CF_SIGN_SH_VALS[0], Math.min(CF_SIGN_SH_VALS[CF_SIGN_SH_VALS.length - 1], sh));
  const bsC = Math.max(CF_SIGN_BS_VALS[0], Math.min(CF_SIGN_BS_VALS[CF_SIGN_BS_VALS.length - 1], Bs));

  let shLo = 0, shHi = 0;
  for (let i = 0; i < CF_SIGN_SH_VALS.length - 1; i++) {
    if (shC >= CF_SIGN_SH_VALS[i] && shC <= CF_SIGN_SH_VALS[i + 1]) { shLo = i; shHi = i + 1; break; }
    shHi = i + 1; shLo = i;
  }
  let bsLo = 0, bsHi = 0;
  for (let i = 0; i < CF_SIGN_BS_VALS.length - 1; i++) {
    if (bsC >= CF_SIGN_BS_VALS[i] && bsC <= CF_SIGN_BS_VALS[i + 1]) { bsLo = i; bsHi = i + 1; break; }
    bsHi = i + 1; bsLo = i;
  }

  const dSh = CF_SIGN_SH_VALS[shHi] - CF_SIGN_SH_VALS[shLo];
  const dBs = CF_SIGN_BS_VALS[bsHi] - CF_SIGN_BS_VALS[bsLo];
  const tSh = dSh > 0 ? (shC - CF_SIGN_SH_VALS[shLo]) / dSh : 0;
  const tBs = dBs > 0 ? (bsC - CF_SIGN_BS_VALS[bsLo]) / dBs : 0;

  return CF_SIGN_TABLE[shLo][bsLo] * (1 - tSh) * (1 - tBs) +
         CF_SIGN_TABLE[shLo][bsHi] * (1 - tSh) * tBs +
         CF_SIGN_TABLE[shHi][bsLo] * tSh * (1 - tBs) +
         CF_SIGN_TABLE[shHi][bsHi] * tSh * tBs;
}

// ------------------------------------------------------------------
// Fig. 29.4-1: Cf — chimneys, tanks, and similar structures.
// Source: Fig. 29.4-1, ASCE 7-22 (read from 300 DPI render, p. 303).
// Rows: cross-section type. Cols: h/D = [1, 7, 25].
// Linear interpolation permitted (Fig. 29.4-1 Note 2).
// ------------------------------------------------------------------
const CF_CHIMNEY_VALS = {
  // [Cf at h/D=1, h/D=7, h/D=25]
  square_normal:   [1.3, 1.4, 2.0],  // Square, wind normal to face
  square_diagonal: [1.0, 1.1, 1.5],  // Square, wind along diagonal
  hex_oct:         [1.0, 1.2, 1.4],  // Hexagonal or octagonal
  round_smooth:    [0.5, 0.6, 0.7],  // Round, D·√qz > 2.5, mod. smooth (D'/D=0.02)
  round_rough:     [0.7, 0.8, 0.9],  // Round, D·√qz > 2.5, very rough (D'/D=0.08)
  round_low_qz:    [0.8, 1.0, 1.2],  // Round, D·√qz ≤ 2.5
};
const CF_CHIMNEY_HD = [1, 7, 25];

function cfChimney(crossSection, hD) {
  const vals = CF_CHIMNEY_VALS[crossSection] || CF_CHIMNEY_VALS.round_smooth;
  const hdC = Math.max(1, Math.min(25, hD));
  let lo = 0, hi = 1;
  for (let i = 0; i < CF_CHIMNEY_HD.length - 1; i++) {
    if (hdC >= CF_CHIMNEY_HD[i] && hdC <= CF_CHIMNEY_HD[i + 1]) { lo = i; hi = i + 1; break; }
    lo = i; hi = i + 1;
  }
  const t = (CF_CHIMNEY_HD[hi] - CF_CHIMNEY_HD[lo]) > 0
    ? (hdC - CF_CHIMNEY_HD[lo]) / (CF_CHIMNEY_HD[hi] - CF_CHIMNEY_HD[lo]) : 0;
  return vals[lo] * (1 - t) + vals[hi] * t;
}

// ------------------------------------------------------------------
// Fig. 29.4-2: Cf — open signs and single-plane open frames.
// Source: Fig. 29.4-2, ASCE 7-22 (read from 300 DPI render, p. 303).
// ε = solidity ratio; memberType: 'flat' | 'round_smooth' | 'round_rough'
// ------------------------------------------------------------------
function cfOpenSign(eps, memberType) {
  if (eps < 0.1) {
    return (memberType === 'flat') ? 2.0 : 0.8;
  } else if (eps <= 0.29) {
    if (memberType === 'flat')         return 1.8;
    if (memberType === 'round_smooth') return 1.3;
    return 0.9; // round_rough
  } else if (eps <= 0.70) {
    if (memberType === 'flat')         return 1.6;
    if (memberType === 'round_smooth') return 1.5;
    return 1.1; // round_rough
  }
  // ε > 0.70 is outside table; use conservative value and flag
  return (memberType === 'flat') ? 1.6 : 1.1;
}

// ------------------------------------------------------------------
// Fig. 29.4-3: Cf — trussed towers (formulas per figure).
// Source: Fig. 29.4-3, ASCE 7-22 (read from 300 DPI render, p. 304).
// ε = solidity ratio of one tower face.
// Square:    Cf = 4.0ε² − 5.9ε + 4.0
// Triangle:  Cf = 3.4ε² − 4.7ε + 3.4
// ------------------------------------------------------------------
function cfTrussedTower(eps, shape) {
  const e = Math.max(0.1, Math.min(0.9, eps));
  return (shape === 'triangle')
    ? 3.4 * e * e - 4.7 * e + 3.4
    : 4.0 * e * e - 5.9 * e + 4.0;
}

// ------------------------------------------------------------------
// gcrnNom(An, zone, omega) — Fig. 29.4-7, ASCE 7-22 Sec. 29.4.3
// Source: values read from dashed-box annotations and curve label positions in
//         Figure 29.4-7. Low-tilt An=10 start values estimated from label positions.
//         High-tilt An<1000 extrapolated using same log-linear slope as 1000→5000.
//         All intermediate values use log-linear interpolation. ±(GCrn) applies.
// ------------------------------------------------------------------
function gcrnNom(An, zone, omega) {
  var zi  = Math.min(2, Math.max(0, zone - 1)); // 0-based index
  // Low tilt (0–5°): anchor A = An=10 (label positions); anchor B/floor = An=500 (box annotation)
  var lowA  = [1.50, 1.85, 2.20]; // An=10: [Z1, Z2, Z3] — estimated from Fig. 29.4-7 label positions
  var lowBv = [0.35, 0.45, 0.50]; // An=500: floors — from Fig. 29.4-7 box annotation (left chart)
  var lowA_An = 10, lowB_An = 500;
  // High tilt (15–35°): two boxes from Fig. 29.4-7 right chart
  var hiB  = [0.56, 0.65, 0.80]; // An=1000 — from Fig. 29.4-7 box annotation
  var hiC  = [0.30, 0.40, 0.50]; // An=5000 — from Fig. 29.4-7 box annotation (minimum floors)
  var hiB_An = 1000, hiC_An = 5000;

  function logLerp(An1, v1, An2, v2, x) {
    var t = (Math.log10(x) - Math.log10(An1)) / (Math.log10(An2) - Math.log10(An1));
    return v1 + t * (v2 - v1);
  }
  function gcLow(x) {
    if (x <= lowA_An) return lowA[zi];
    if (x >= lowB_An) return lowBv[zi];
    return Math.max(lowBv[zi], logLerp(lowA_An, lowA[zi], lowB_An, lowBv[zi], x));
  }
  function gcHigh(x) {
    if (x >= hiC_An) return hiC[zi];
    if (x >= hiB_An) return logLerp(hiB_An, hiB[zi], hiC_An, hiC[zi], x);
    // Extrapolate backward using same slope (conservative — verify against Fig. 29.4-7)
    var slope = (hiC[zi] - hiB[zi]) / (Math.log10(hiC_An) - Math.log10(hiB_An));
    return hiB[zi] + slope * (Math.log10(x) - Math.log10(hiB_An));
  }
  // Linear interpolation 5°–15° per Note 2, Fig. 29.4-7
  if (omega <= 5)  return gcLow(An);
  if (omega >= 15) return gcHigh(An);
  var t = (omega - 5) / 10;
  return gcLow(An) * (1 - t) + gcHigh(An) * t;
}

// ------------------------------------------------------------------
// computeCh29(s): main Ch.29 computation
// ------------------------------------------------------------------
function computeCh29(s) {
  const G   = G_RIGID_CH29; // Sec. 26.11.1
  const ke  = computeKe(s.groundElev);
  const kztObj = computeKzt(s, s.ch29H);
  const KZT = kztObj.kzt;
  const kh  = computeKh(s.ch29H, s.exposure);
  // qh at top of structure: Eq. 26.10-1, q = 0.00256·Kz·Kzt·Ke·V²
  const qh  = 0.00256 * kh * KZT * ke * s.V * s.V;

  const type = s.ch29Type;

  if (type === 'solidSign') {
    // Eq. 29.3-1: F = qh·Kd·G·Cf·As
    const B = s.ch29B, h = s.ch29H, sc = Math.max(0, s.ch29S), As = s.ch29As;
    const sh = (h > 0) ? Math.max(0, sc / h) : 0;
    const Bs = (sc > 0.01) ? B / sc : 45; // very small clearance → large B/s (wall case)
    const KD = KD_SIGN;
    const Cf = cfSolidSign(Bs, sh);
    const F  = qh * KD * G * Cf * As;
    const Fm = PSF_MIN_CH29 * As;
    return { type, KD, G, ke, kh, qh, Cf, As, B, h, sc, sh, Bs,
             F, F_min: Fm, F_design: Math.max(F, Fm), minGoverns: Fm > F,
             eqRef: 'Eq. 29.3-1', cfRef: 'Fig. 29.3-1' };

  } else if (type === 'chimney') {
    // Eq. 29.4-1: F = qz·Kd·G·Cf·Af  (qz at top of structure — conservative)
    const xsec = s.ch29CrossSection;
    const KD   = (xsec === 'square_normal' || xsec === 'square_diagonal') ? 0.90 : KD_CHIMNEY;
    const h = s.ch29H, D = s.ch29D, Af = s.ch29Af;
    const hD = (D > 0) ? h / D : 1;
    const Cf = cfChimney(xsec, hD);
    const F  = qh * KD * G * Cf * Af;
    const Fm = PSF_MIN_CH29 * Af;
    return { type, KD, G, ke, kh, qh, Cf, Af, h, D, hD,
             F, F_min: Fm, F_design: Math.max(F, Fm), minGoverns: Fm > F,
             eqRef: 'Eq. 29.4-1', cfRef: 'Fig. 29.4-1',
             note: 'q<sub>z</sub> evaluated at top of structure (conservative). For tall slender structures, height-profile integration per Sec. 29.4 may be required.' };

  } else if (type === 'openSign') {
    // Eq. 29.4-1: F = qz·Kd·G·Cf·Af
    const KD = KD_OPEN_SIGN, eps = s.ch29Eps, mt = s.ch29MemberType, Af = s.ch29Af;
    const Cf = cfOpenSign(eps, mt);
    const F  = qh * KD * G * Cf * Af;
    const Fm = PSF_MIN_CH29 * Af;
    return { type, KD, G, ke, kh, qh, Cf, Af, eps, memberType: mt,
             F, F_min: Fm, F_design: Math.max(F, Fm), minGoverns: Fm > F,
             eqRef: 'Eq. 29.4-1', cfRef: 'Fig. 29.4-2' };

  } else if (type === 'trussedTower') {
    // Eq. 29.4-1: F = qz·Kd·G·Cf·Af
    const KD = KD_TOWER, eps = s.ch29Eps, shape = s.ch29TowerShape, Af = s.ch29Af;
    const Cf = cfTrussedTower(eps, shape);
    const F  = qh * KD * G * Cf * Af;
    const Fm = PSF_MIN_CH29 * Af;
    return { type, KD, G, ke, kh, qh, Cf, Af, eps, shape,
             F, F_min: Fm, F_design: Math.max(F, Fm), minGoverns: Fm > F,
             eqRef: 'Eq. 29.4-1', cfRef: 'Fig. 29.4-3' };

  } else if (type === 'rooftopEquip') {
    // Eqs. 29.4-2/3: Fh = qh·Kd·(GCr)·Af,  Fv = qh·Kd·(GCr)·Ar
    // (GCr) per Sec. 29.4.1: 1.9 if Af ≤ 0.1·B·h; 1.5 if Ar ≤ 0.1·B·L
    const KD = KD_ROOFTOP;
    const Af = s.ch29Af, Ar = s.ch29Ar, Bh = s.ch29Bh, BL = s.ch29BL;
    const GCrH = (Af <= 0.1 * Bh) ? 1.9 : Math.max(1.0, 1.9 * (0.1 * Bh / Af));
    const GCrV = (Ar <= 0.1 * BL) ? 1.5 : Math.max(1.0, 1.5 * (0.1 * BL / Ar));
    const Fh = qh * KD * GCrH * Af;
    const Fv = qh * KD * GCrV * Ar;
    // Sec. 30.8 Components & Cladding: C&C pressure on each wall of the
    // rooftop structure = Fh divided by that wall's tributary surface area
    // (acts inward or outward); C&C pressure on the roof = Fv (uplift)
    // divided by the roof's horizontal projected tributary area.
    const CCAwall = s.ch29CCAwall, CCAroof = s.ch29CCAroof;
    const pWall = Fh / CCAwall;       // ±, psf
    const pRoof = Fv / CCAroof;       // uplift, psf (acts upward → negative)
    return { type, KD, ke, kh, qh, Af, Ar, Bh, BL, GCrH, GCrV, Fh, Fv,
             CCAwall, CCAroof, pWall, pRoof,
             eqRef: 'Eqs. 29.4-2/3', cfRef: 'Sec. 29.4.1', ccRef: 'Sec. 30.8' };

  } else if (type === 'solarPanel') {
    // Sec. 29.4.3 Rooftop Solar Panels — flat/gable/hip roof θ ≤ 7°
    // Eq. 29.4-5: p = qh·Kd·(GCrn)  [acts ± on top surface]
    // Eq. 29.4-6: (GCrn) = γp·γc·γE·(GCrn)nom
    const KD   = 0.85; // Table 26.6-1, solar panels/rooftop equipment
    const h    = s.ch29H; // mean roof height (ft)
    const omega = s.ch29SolarOmega;
    const Lp   = s.ch29SolarLp;
    const A    = s.ch29SolarA;
    const h1   = s.ch29SolarH1, h2 = s.ch29SolarH2;
    const hpt  = s.ch29SolarHpt;
    const d1   = s.ch29SolarD1, d2 = s.ch29SolarD2;
    const zone = s.ch29SolarZone;
    const WL   = s.ch29SolarWL, Ws = s.ch29SolarWs;

    // Applicability checks
    var warnings = [];
    if (Lp > 6.7)   warnings.push('Lp > 6.7 ft: outside Fig. 29.4-7 range');
    if (omega > 35) warnings.push('ω > 35°: outside Fig. 29.4-7 range');
    if (h1 > 2.0)   warnings.push('h₁ > 2 ft: outside Fig. 29.4-7 range');
    if (h2 > 4.0)   warnings.push('h₂ > 4 ft: outside Fig. 29.4-7 range');

    // Normalized building length: Lb = min(0.4√(h·WL), h, Ws) per Fig. 29.4-7 Note 3
    const Lb = Math.min(0.4 * Math.sqrt(h * WL), h, Ws);
    // Normalized wind area: An = 1000·A / max(Lb, 15)² per Fig. 29.4-7 Note 3
    const An = 1000 * A / Math.pow(Math.max(Lb, 15), 2);

    // (GCrn)nom from Figure 29.4-7 (log-linear interpolation, see gcrnNom())
    const GCrnNom = gcrnNom(An, zone, omega);

    // Adjustment factors (Eq. 29.4-6)
    const gammaP = Math.min(1.2, 0.9 + (h > 0 ? hpt / h : 0));
    const gammaC = Math.max(0.8, 0.6 + 0.06 * Lp);
    // γE: exposed = d1 > 0.5h AND (d1_adj > max(4h2,4ft) OR d2 > max(4h2,4ft))
    const exposed = (d1 > 0.5 * h) && (d1 > Math.max(4 * h2, 4) || d2 > Math.max(4 * h2, 4));
    const gammaE  = (exposed && true) ? 1.5 : 1.0; // 1.5 for exposed panels within 1.5Lp of row end
    const GCrn   = gammaP * gammaC * gammaE * GCrnNom;
    const p      = qh * KD * GCrn;

    // Minimum setback check
    const minSetback = Math.max(2 * (h2 - hpt), 4);
    const setbackOK  = d1 >= minSetback;
    if (!setbackOK) warnings.push('d₁ < max(2(h₂−hpt), 4 ft): minimum edge setback not met');

    return { type, KD, ke, kh, qh,
             h, omega, Lp, A, h1, h2, hpt, d1, d2, zone, WL, Ws,
             Lb, An, GCrnNom, gammaP, gammaC, gammaE, GCrn, p,
             exposed, setbackOK, minSetback,
             warnings,
             eqRef: 'Eq. 29.4-5', cfRef: 'Fig. 29.4-7' };
  }

  return null;
}

// ------------------------------------------------------------------
// reportCh29HTML(r): render Ch.29 results
// ------------------------------------------------------------------
function reportCh29HTML(r) {
  const c = r && r.ch29;
  if (!c) return '<p class="muted">Ch.29 data unavailable.</p>';
  const u   = state.unitSystem === 'SI';
  const pU  = pUnit();
  const lenU = u ? 'm' : 'ft';
  const aU  = u ? 'm²' : 'ft²';
  // Force unit: 1 psf·ft² = 1 lbf; convert to kip (US) or kN (SI)
  const fU  = u ? 'kN' : 'kip';
  const fVal = v => u ? (v * 0.004448222) : (v / 1000); // lbf → kN or kip
  const f2  = v => fmt(fVal(v), 2);
  const p2  = v => fmt(pVal(v), 2);

  const TYPE_LABELS = {
    solidSign:    'Solid Freestanding Sign / Wall &mdash; Sec. 29.3',
    chimney:      'Chimney / Tank &mdash; Sec. 29.4',
    openSign:     'Open Sign / Single-Plane Open Frame &mdash; Sec. 29.4',
    trussedTower: 'Trussed Tower &mdash; Sec. 29.4',
    rooftopEquip: 'Rooftop Structure / Equipment &mdash; Sec. 29.4.1',
    solarPanel:   'Rooftop Solar Panels &mdash; Sec. 29.4.3'
  };

  let html = '<h3>Ch.29 Other Structures &mdash; Design Wind Force' +
    ' <span class="ref">' + c.eqRef + ', ASCE 7-22</span></h3>';
  html += '<p class="muted" style="margin:0 0 8px;">' + (TYPE_LABELS[c.type] || c.type) + '</p>';

  // Common velocity-pressure summary
  html += '<table class="report-input-table"><tbody>' +
    '<tr><td>K<sub>h</sub> (at structure top)</td><td>' + fmt(c.kh, 3) + '</td></tr>' +
    '<tr><td>q<sub>h</sub></td><td>' + p2(c.qh) + ' ' + pU + '</td></tr>' +
    '<tr><td>K<sub>d</sub></td><td>' + fmt(c.KD, 2) + ' &mdash; Table 26.6-1</td></tr>';
  if (c.type !== 'rooftopEquip') {
    html += '<tr><td>G</td><td>' + fmt(c.G, 2) + ' &mdash; Sec. 26.11.1 (rigid)</td></tr>' +
            '<tr><td>C<sub>f</sub></td><td>' + fmt(c.Cf, 2) + ' &mdash; ' + c.cfRef + '</td></tr>';
  }
  html += '</tbody></table>';

  // Type-specific detail and results
  if (c.type === 'solidSign') {
    html += '<h3>Solid Sign / Freestanding Wall <span class="ref">Eq. 29.3-1</span></h3>' +
      '<p class="muted" style="margin:0 0 8px;">F = q<sub>h</sub>&middot;K<sub>d</sub>&middot;G&middot;C<sub>f</sub>&middot;A<sub>s</sub></p>' +
      '<table class="report-input-table"><tbody>' +
      '<tr><td>B (width)</td><td>' + fmt(lengthOut(c.B), 1) + ' ' + lenU + '</td></tr>' +
      '<tr><td>h (sign height)</td><td>' + fmt(lengthOut(c.h), 1) + ' ' + lenU + '</td></tr>' +
      '<tr><td>s (clearance)</td><td>' + fmt(lengthOut(c.sc), 1) + ' ' + lenU + '</td></tr>' +
      '<tr><td>s/h</td><td>' + fmt(c.sh, 3) + '</td></tr>' +
      '<tr><td>B/s</td><td>' + (c.sc < 0.02 ? '— (wall on ground, B/s → ∞, capped at 45)' : fmt(c.Bs, 2)) + '</td></tr>' +
      '<tr><td>A<sub>s</sub> (gross area)</td><td>' + fmt(areaOut(c.As), 1) + ' ' + aU + '</td></tr>' +
      '</tbody></table>' +
      '<table class="report-table"><thead><tr><th>Check</th><th>Force</th><th>Clause</th></tr></thead><tbody>' +
      '<tr><td>F (Eq. 29.3-1)</td><td class="val-pos">' + f2(c.F) + ' ' + fU + '</td><td>Eq. 29.3-1</td></tr>' +
      '<tr><td>F<sub>min</sub> = 16&thinsp;psf &times; A<sub>s</sub></td><td>' + f2(c.F_min) + ' ' + fU + '</td><td>Sec. 29.7</td></tr>' +
      '<tr><td><strong>F<sub>design</sub></strong></td><td class="' + (c.minGoverns ? 'val-neg' : 'val-pos') + '"><strong>' +
        f2(c.F_design) + ' ' + fU + '</strong></td><td>' +
        (c.minGoverns ? 'Sec. 29.7 min. governs' : 'Eq. 29.3-1 governs') + '</td></tr>' +
      '</tbody></table>';
    if (c.minGoverns) html += '<div class="alert warn">Sec. 29.7 minimum design wind force (16 psf &times; A<sub>s</sub>) governs.</div>';

  } else if (c.type === 'chimney') {
    html += '<h3>Chimney / Tank <span class="ref">Eq. 29.4-1</span></h3>' +
      '<p class="muted" style="margin:0 0 8px;">F = q<sub>z</sub>&middot;K<sub>d</sub>&middot;G&middot;C<sub>f</sub>&middot;A<sub>f</sub> &nbsp;(q<sub>z</sub> evaluated at top of structure)</p>';
    if (c.note) html += '<div class="alert info">' + c.note + '</div>';
    html +=
      '<table class="report-input-table"><tbody>' +
      '<tr><td>h (structure height)</td><td>' + fmt(lengthOut(c.h), 1) + ' ' + lenU + '</td></tr>' +
      '<tr><td>D (diameter / min dim)</td><td>' + fmt(lengthOut(c.D), 1) + ' ' + lenU + '</td></tr>' +
      '<tr><td>h/D</td><td>' + fmt(c.hD, 2) + '</td></tr>' +
      '<tr><td>A<sub>f</sub> (proj. area)</td><td>' + fmt(areaOut(c.Af), 1) + ' ' + aU + '</td></tr>' +
      '</tbody></table>' +
      '<table class="report-table"><thead><tr><th>Check</th><th>Force</th><th>Clause</th></tr></thead><tbody>' +
      '<tr><td>F (Eq. 29.4-1)</td><td class="val-pos">' + f2(c.F) + ' ' + fU + '</td><td>Eq. 29.4-1</td></tr>' +
      '<tr><td>F<sub>min</sub> = 16&thinsp;psf &times; A<sub>f</sub></td><td>' + f2(c.F_min) + ' ' + fU + '</td><td>Sec. 29.7</td></tr>' +
      '<tr><td><strong>F<sub>design</sub></strong></td><td class="' + (c.minGoverns ? 'val-neg' : 'val-pos') + '"><strong>' +
        f2(c.F_design) + ' ' + fU + '</strong></td><td>' +
        (c.minGoverns ? 'Sec. 29.7 min. governs' : 'Eq. 29.4-1 governs') + '</td></tr>' +
      '</tbody></table>';
    if (c.minGoverns) html += '<div class="alert warn">Sec. 29.7 minimum design wind force (16 psf &times; A<sub>f</sub>) governs.</div>';

  } else if (c.type === 'openSign') {
    html += '<h3>Open Sign / Single-Plane Frame <span class="ref">Eq. 29.4-1</span></h3>' +
      '<p class="muted" style="margin:0 0 8px;">F = q<sub>z</sub>&middot;K<sub>d</sub>&middot;G&middot;C<sub>f</sub>&middot;A<sub>f</sub></p>' +
      '<table class="report-input-table"><tbody>' +
      '<tr><td>&epsilon; (solidity ratio)</td><td>' + fmt(c.eps, 3) + '</td></tr>' +
      '<tr><td>Member type</td><td>' + ({flat:'Flat-sided',round_smooth:'Rounded (low q<sub>z</sub>)',round_rough:'Rounded (high q<sub>z</sub>)'}[c.memberType]||c.memberType) + '</td></tr>' +
      '<tr><td>A<sub>f</sub> (all exposed members)</td><td>' + fmt(areaOut(c.Af), 1) + ' ' + aU + '</td></tr>' +
      '</tbody></table>' +
      '<table class="report-table"><thead><tr><th>Check</th><th>Force</th><th>Clause</th></tr></thead><tbody>' +
      '<tr><td>F (Eq. 29.4-1)</td><td class="val-pos">' + f2(c.F) + ' ' + fU + '</td><td>Eq. 29.4-1</td></tr>' +
      '<tr><td>F<sub>min</sub> = 16&thinsp;psf &times; A<sub>f</sub></td><td>' + f2(c.F_min) + ' ' + fU + '</td><td>Sec. 29.7</td></tr>' +
      '<tr><td><strong>F<sub>design</sub></strong></td><td class="' + (c.minGoverns ? 'val-neg' : 'val-pos') + '"><strong>' +
        f2(c.F_design) + ' ' + fU + '</strong></td><td>' +
        (c.minGoverns ? 'Sec. 29.7 min. governs' : 'Eq. 29.4-1 governs') + '</td></tr>' +
      '</tbody></table>';
    if (c.minGoverns) html += '<div class="alert warn">Sec. 29.7 minimum design wind force (16 psf &times; A<sub>f</sub>) governs.</div>';

  } else if (c.type === 'trussedTower') {
    const cfFormula = (c.shape === 'triangle')
      ? '3.4&epsilon;&sup2; &minus; 4.7&epsilon; + 3.4'
      : '4.0&epsilon;&sup2; &minus; 5.9&epsilon; + 4.0';
    html += '<h3>Trussed Tower <span class="ref">Eq. 29.4-1</span></h3>' +
      '<p class="muted" style="margin:0 0 8px;">F = q<sub>z</sub>&middot;K<sub>d</sub>&middot;G&middot;C<sub>f</sub>&middot;A<sub>f</sub></p>' +
      '<table class="report-input-table"><tbody>' +
      '<tr><td>Tower plan shape</td><td>' + (c.shape === 'triangle' ? 'Triangular' : 'Square') + '</td></tr>' +
      '<tr><td>&epsilon; (solidity ratio)</td><td>' + fmt(c.eps, 3) + '</td></tr>' +
      '<tr><td>C<sub>f</sub> formula (Fig. 29.4-3)</td><td>' + cfFormula + '</td></tr>' +
      '<tr><td>A<sub>f</sub> (solid proj. area)</td><td>' + fmt(areaOut(c.Af), 1) + ' ' + aU + '</td></tr>' +
      '</tbody></table>' +
      '<table class="report-table"><thead><tr><th>Check</th><th>Force</th><th>Clause</th></tr></thead><tbody>' +
      '<tr><td>F (Eq. 29.4-1)</td><td class="val-pos">' + f2(c.F) + ' ' + fU + '</td><td>Eq. 29.4-1</td></tr>' +
      '<tr><td>F<sub>min</sub> = 16&thinsp;psf &times; A<sub>f</sub></td><td>' + f2(c.F_min) + ' ' + fU + '</td><td>Sec. 29.7</td></tr>' +
      '<tr><td><strong>F<sub>design</sub></strong></td><td class="' + (c.minGoverns ? 'val-neg' : 'val-pos') + '"><strong>' +
        f2(c.F_design) + ' ' + fU + '</strong></td><td>' +
        (c.minGoverns ? 'Sec. 29.7 min. governs' : 'Eq. 29.4-1 governs') + '</td></tr>' +
      '</tbody></table>';
    if (c.minGoverns) html += '<div class="alert warn">Sec. 29.7 minimum design wind force (16 psf &times; A<sub>f</sub>) governs.</div>';

  } else if (c.type === 'rooftopEquip') {
    html += '<h3>Rooftop Structure / Equipment <span class="ref">Sec. 29.4.1, Eqs. 29.4-2/3</span></h3>' +
      '<table class="report-input-table"><tbody>' +
      '<tr><td>A<sub>f</sub> (horiz. proj. area)</td><td>' + fmt(areaOut(c.Af), 1) + ' ' + aU + '</td></tr>' +
      '<tr><td>A<sub>r</sub> (roof proj. area)</td><td>' + fmt(areaOut(c.Ar), 1) + ' ' + aU + '</td></tr>' +
      '<tr><td>B &times; h (building)</td><td>' + fmt(areaOut(c.Bh), 0) + ' ' + aU + '</td></tr>' +
      '<tr><td>B &times; L (building roof)</td><td>' + fmt(areaOut(c.BL), 0) + ' ' + aU + '</td></tr>' +
      '<tr><td>(GC<sub>r</sub>) horizontal</td><td>' + fmt(c.GCrH, 2) +
        ' (A<sub>f</sub> ' + (c.Af <= 0.1 * c.Bh ? '&le;' : '&gt;') + ' 0.1Bh)</td></tr>' +
      '<tr><td>(GC<sub>r</sub>) vertical</td><td>' + fmt(c.GCrV, 2) +
        ' (A<sub>r</sub> ' + (c.Ar <= 0.1 * c.BL ? '&le;' : '&gt;') + ' 0.1BL)</td></tr>' +
      '</tbody></table>' +
      '<table class="report-table"><thead><tr>' +
      '<th>Force component</th><th>Formula</th><th>Value</th></tr></thead><tbody>' +
      '<tr><td>F<sub>h</sub> (horizontal)</td>' +
        '<td>q<sub>h</sub>&middot;K<sub>d</sub>&middot;(GC<sub>r</sub>)&middot;A<sub>f</sub></td>' +
        '<td class="val-pos">' + f2(c.Fh) + ' ' + fU + '</td></tr>' +
      '<tr><td>F<sub>v</sub> (vertical uplift)</td>' +
        '<td>q<sub>h</sub>&middot;K<sub>d</sub>&middot;(GC<sub>r</sub>)&middot;A<sub>r</sub></td>' +
        '<td class="val-neg">' + f2(c.Fv) + ' ' + fU + '</td></tr>' +
      '</tbody></table>' +
      '<h4>Components &amp; Cladding <span class="ref">Sec. 30.8</span></h4>' +
      '<p class="muted">C&amp;C pressure on each wall of the rooftop structure = F<sub>h</sub> divided by the wall&rsquo;s tributary surface area (acts inward or outward); C&amp;C pressure on the roof = F<sub>v</sub> divided by the roof&rsquo;s horizontal projected tributary area (acts upward).</p>' +
      '<table class="report-input-table"><tbody>' +
      '<tr><td>Wall tributary area, A<sub>wall</sub></td><td>' + fmt(areaOut(c.CCAwall), 1) + ' ' + aU + '</td></tr>' +
      '<tr><td>Roof tributary area, A<sub>roof</sub></td><td>' + fmt(areaOut(c.CCAroof), 1) + ' ' + aU + '</td></tr>' +
      '</tbody></table>' +
      '<table class="report-table"><thead><tr>' +
      '<th>Pressure</th><th>Formula</th><th>Value</th></tr></thead><tbody>' +
      '<tr><td>p<sub>wall</sub> (&plusmn;, inward/outward)</td>' +
        '<td>F<sub>h</sub> / A<sub>wall</sub></td>' +
        '<td class="val-pos">&plusmn;' + p2(Math.abs(c.pWall)) + ' ' + pU + '</td></tr>' +
      '<tr><td>p<sub>roof</sub> (uplift)</td>' +
        '<td>F<sub>v</sub> / A<sub>roof</sub></td>' +
        '<td class="val-neg">&minus;' + p2(Math.abs(c.pRoof)) + ' ' + pU + '</td></tr>' +
      '</tbody></table>';

  } else if (c.type === 'solarPanel') {
    var pf2 = function(v) { return fmt(pVal(v),2)+' '+pU; };
    var ZONE_NAMES = ['', 'Zone 1 — Interior', 'Zone 2 — Edge', 'Zone 3 — Corner'];
    html += '<h3>Rooftop Solar Panels <span class="ref">Sec. 29.4.3, Eq. 29.4-5</span></h3>';
    if (c.warnings && c.warnings.length) {
      html += '<div class="alert warn"><strong>Applicability:</strong> ' +
        c.warnings.map(function(w){return '<br>&bull; '+w;}).join('') + '</div>';
    }
    html += '<div class="alert info" style="font-size:0.82em;margin-bottom:8px;">'
          + '<strong>Note:</strong> (GC<sub>rn</sub>)<sub>nom</sub> values are log-linearly '
          + 'interpolated from annotated box values in Fig. 29.4-7 (left chart An≈500: '
          + '0.35/0.45/0.50; right chart An=1000: 0.56/0.65/0.80, An=5000: 0.30/0.40/0.50 '
          + 'for Zones 1/2/3). Verify against Figure 29.4-7 directly.</div>';
    html += '<table class="report-input-table"><tbody>'
          + '<tr><td>Roof zone</td><td>' + (ZONE_NAMES[c.zone]||'Zone '+c.zone) + '</td></tr>'
          + '<tr><td>Panel tilt &omega;</td><td>' + fmt(c.omega,1) + '&deg;</td></tr>'
          + '<tr><td>Panel chord L<sub>p</sub></td><td>' + fmt(lengthOut(c.Lp),2) + ' ' + lU + '</td></tr>'
          + '<tr><td>Effective wind area A</td><td>' + fmt(areaOut(c.A),1) + ' ' + aU + '</td></tr>'
          + '<tr><td>h<sub>1</sub> (lower edge)</td><td>' + fmt(lengthOut(c.h1),2) + ' ' + lU + '</td></tr>'
          + '<tr><td>h<sub>2</sub> (upper edge)</td><td>' + fmt(lengthOut(c.h2),2) + ' ' + lU + '</td></tr>'
          + '<tr><td>Parapet h<sub>pt</sub></td><td>' + fmt(lengthOut(c.hpt),2) + ' ' + lU + '</td></tr>'
          + '<tr><td>L<sub>b</sub> = min(0.4&radic;(hW<sub>L</sub>), h, W<sub>s</sub>)</td>'
          + '<td>' + fmt(lengthOut(c.Lb),2) + ' ' + lU + '</td></tr>'
          + '<tr><td>A<sub>n</sub> = 1000&thinsp;A / max(L<sub>b</sub>,15)&sup2;</td>'
          + '<td>' + fmt(c.An,1) + ' (non-dim.)</td></tr>'
          + '</tbody></table>'
          + '<table class="report-input-table"><tbody>'
          + '<tr><td>(GC<sub>rn</sub>)<sub>nom</sub> &mdash; Fig. 29.4-7</td><td>' + fmt(c.GCrnNom,3) + '</td></tr>'
          + '<tr><td>&gamma;<sub>p</sub> = min(1.2, 0.9+h<sub>pt</sub>/h)</td><td>' + fmt(c.gammaP,3) + '</td></tr>'
          + '<tr><td>&gamma;<sub>c</sub> = max(0.8, 0.6+0.06L<sub>p</sub>)</td><td>' + fmt(c.gammaC,3) + '</td></tr>'
          + '<tr><td>&gamma;<sub>E</sub> (array edge)</td><td>' + fmt(c.gammaE,1)
          + (c.exposed ? ' (exposed panel)' : ' (sheltered)') + '</td></tr>'
          + '<tr><td>(GC<sub>rn</sub>) = &gamma;<sub>p</sub>&middot;&gamma;<sub>c</sub>&middot;&gamma;<sub>E</sub>&middot;(GC<sub>rn</sub>)<sub>nom</sub></td>'
          + '<td><strong>' + fmt(c.GCrn,3) + '</strong></td></tr>'
          + '</tbody></table>'
          + '<table class="report-table"><thead><tr>'
          + '<th>Load direction</th><th>p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;(GC<sub>rn</sub>)</th></tr></thead><tbody>'
          + '<tr><td>Uplift (away from top surface, &minus;)</td>'
          + '<td class="val-neg">&minus;' + pf2(c.p) + '</td></tr>'
          + '<tr><td>Downward (toward top surface, +)</td>'
          + '<td class="val-pos">+' + pf2(c.p) + '</td></tr>'
          + '</tbody></table>';
    if (!c.setbackOK) {
      html += '<div class="alert warn">Minimum edge setback d<sub>1</sub> ≥ max(2(h<sub>2</sub>−h<sub>pt</sub>), 4 ft) = '
            + fmt(lengthOut(c.minSetback),1) + ' ' + lU + ' not met.</div>';
    }
  }

  return html;
}

function reportCCHTML(r) {
  const s = state;
  let html = '<h3>Walls &mdash; Zones 4 &amp; 5 <span class="ref">Fig. 30.3-1</span></h3>' + zoneTableHTML(r.ccWall, true);

  const roofHeading = (s.theta <= 7)
    ? 'Roof &mdash; Zones 1&prime;, 1, 2, 3 <span class="ref">Fig. 30.3-2A, &theta; &le; 7&deg;</span>'
    : 'Roof &mdash; Zones 1, 2, 3 <span class="ref">' +
      (s.roofShape === 'hip' ? 'Figs. 30.3-2D&ndash;G equiv.' : 'Figs. 30.3-2B/2C') +
      ', &theta; &gt; 7&deg;</span>';
  html += '<h3>' + roofHeading + '</h3>';
  if (s.theta > 7 && r.roofCapped) {
    html += '<div class="alert warn">' + (s.roofShape === 'hip'
      ? 'Roof angle &theta; &gt; 45&deg;: Figures 30.3-2D&ndash;G (hip) do not extend past &theta; = 45&deg;. The &theta; = 45&deg; coefficients are used as a capped approximation &mdash; verify against the Standard for roofs steeper than 45&deg;.'
      : 'Roof angle &theta; &gt; 27&deg;: Figures 30.3-2B/2C (gable) do not extend past &theta; = 27&deg;. The &theta; = 20&deg;&ndash;27&deg; (Fig. 30.3-2C) coefficients are used as a capped approximation &mdash; verify against the Standard for roofs steeper than 27&deg;.') + '</div>';
  }
  html += zoneTableHTML(r.ccRoof, true);

  if (s.hasOverhang) {
    html += '<h3>Roof Overhangs &mdash; Net (Top + Bottom) <span class="ref">Sec. 30.7</span></h3>' +
      '<p class="muted" style="margin:0 0 10px;">Net (GC<sub>p</sub>) = roof-surface (GC<sub>p</sub>) (top of overhang) &minus; wall-zone (GC<sub>p</sub>) (bottom/soffit), evaluated at the Roof C&amp;C effective wind area above. No (GC<sub>pi</sub>) term applies.</p>' +
      zoneTableHTML(r.ccOverhang, true, OVERHANG_ZONE_LABELS);
  }
  return html;
}

// Parapet Wind Pressures section (Sec. 27.3.4/28.3.4 MWFRS + Sec. 30.6 C&C) —
// identical cards/tables/citations to the on-screen #parapetSection.
function reportParapetHTML(r) {
  const s = state;
  const p = r.parapet;
  const lenUnit = s.unitSystem === 'SI' ? 'm' : 'ft';
  let html = '<h3>MWFRS &mdash; Solid Parapet <span class="ref">Eq. 27.3-3, (GC<sub>pn</sub>) = +1.5 / &minus;1.0</span></h3>';
  html += '<table class="report-input-table"><tbody>' +
    '<tr><td>z (top of parapet)</td><td>' + fmt(lengthOut(p.zParapet), 1) + ' ' + lenUnit + '</td></tr>' +
    '<tr><td>K<sub>h</sub> at parapet</td><td>' + fmt(p.khp, 3) + '</td></tr>' +
    '<tr><td>q<sub>p</sub></td><td>' + fmt(pVal(p.qp), 2) + ' ' + pUnit() + '</td></tr>' +
    '<tr><td>p<sub>p</sub>, windward (GC<sub>pn</sub>=+1.5)</td><td>' + fmt(pVal(p.ppWindward), 2) + ' ' + pUnit() + '</td></tr>' +
    '<tr><td>p<sub>p</sub>, leeward (GC<sub>pn</sub>=&minus;1.0)</td><td>' + fmt(pVal(p.ppLeeward), 2) + ' ' + pUnit() + '</td></tr>' +
    '<tr><td>Total combined p<sub>p</sub></td><td>' + fmt(pVal(p.ppTotal), 2) + ' ' + pUnit() + '</td></tr>' +
    '</tbody></table>';
  html += '<p class="muted" style="margin:10px 0;">The Envelope Procedure (Ch. 28) parapet provision is applied here using the same (GC<sub>pn</sub>) values as Sec. 27.3.4, cited provisionally as Sec. 28.3.4 &mdash; this Ch.27&rarr;Ch.28 cross-reference is engineering judgment, unverified; see the on-screen "i" button for details.</p>';
  html += '<h3>C&amp;C &mdash; Walls Zones 4 &amp; 5, Load A / Load B <span class="ref">Eq. 30.6-1</span></h3>' +
    '<p class="muted" style="margin:0 0 10px;">Load A = front-face wall (GC<sub>p</sub>)<sub>pos</sub> + back-face roof (GC<sub>p</sub>)<sub>neg</sub> (paired zone). Load B = back-face wall (GC<sub>p</sub>)<sub>pos</sub> + front-face wall (GC<sub>p</sub>)<sub>neg</sub> (same zone). q<sub>p</sub> above is used for both.</p>' +
    ccParapetTableHTML(p.ccParapet, PARAPET_ZONE_LABELS);
  return html;
}

// Attached Canopy Wind Pressures section (Sec. 30.9, Eq. 30.9-1) — identical
// content for the on-screen #canopyResults and the print/export report.
function reportCanopyHTML(r) {
  const s = state;
  const c = r.canopy;
  if (!c) return '<p class="muted">Canopy data unavailable.</p>';
  const pU = pUnit();
  const aU = s.unitSystem === 'SI' ? 'm²' : 'ft²';
  const p2 = v => fmt(pVal(v), 2);

  let html = '<p class="muted" style="margin:0 0 10px;">p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;(GC<sub>p</sub>) <span class="ref">Eq. 30.9-1</span> &mdash; q<sub>h</sub> at mean roof height h (Sec. 26.7.3); no (GC<sub>pi</sub>) term (both canopy faces exterior). h ' +
    (c.hGt60 ? '&gt; 60 ft &rarr; ' + c.figRefSep + ' / ' + c.figRefNet : '&le; 60 ft &rarr; ' + c.figRefSep + ' / ' + c.figRefNet) + '.</p>';
  html += '<table class="report-input-table"><tbody>' +
    '<tr><td>Effective wind area, A</td><td>' + fmt(areaOut(c.A), 1) + ' ' + aU + '</td></tr>' +
    '<tr><td>h<sub>c</sub> / h<sub>e</sub> (canopy ht. / eave ht.)</td><td>' + fmt(c.hcRatio, 2) + '</td></tr>' +
    '<tr><td>q<sub>h</sub></td><td>' + p2(r.qh) + ' ' + pU + '</td></tr>' +
    '</tbody></table>';

  html += '<h3>Separate Surfaces (Fastener Design) <span class="ref">' + c.figRefSep + '</span></h3>' +
    '<p class="muted" style="margin:0 0 8px;">Upper and lower canopy surfaces, each (GC<sub>p</sub>) acting alone.</p>' +
    '<table class="report-table"><thead><tr><th>Surface</th><th>(GC<sub>p</sub>)</th><th>Pressure</th></tr></thead><tbody>' +
    '<tr><td>Upper surface, negative (uplift)</td><td>' + fmt(c.sepNegUpper, 3) + '</td><td class="val-neg">' + p2(c.pSepUpperNeg) + ' ' + pU + '</td></tr>' +
    '<tr><td>Lower surface, negative (uplift)</td><td>' + fmt(c.sepNegLower, 3) + '</td><td class="val-neg">' + p2(c.pSepLowerNeg) + ' ' + pU + '</td></tr>' +
    '<tr><td>Either surface, positive (downward)</td><td>' + fmt(c.sepPos, 3) + '</td><td class="val-pos">' + p2(c.pSepPos) + ' ' + pU + '</td></tr>' +
    '</tbody></table>';
  if (c.sepCapped) html += '<div class="alert warn">Effective wind area A is outside the tabulated range &mdash; the boundary (GC<sub>p</sub>) value is used as a capped approximation.</div>';

  html += '<h3>Net/Combined (Structural Design) <span class="ref">' + c.figRefNet + '</span></h3>' +
    '<p class="muted" style="margin:0 0 8px;">Single net (GC<sub>p</sub>) combining both surfaces simultaneously; band selected by h<sub>c</sub>/h<sub>e</sub> = ' + c.netBand + '.</p>' +
    '<table class="report-table"><thead><tr><th>Case</th><th>(GC<sub>p</sub>)</th><th>Pressure</th></tr></thead><tbody>' +
    '<tr><td>Negative (net uplift)</td><td>' + fmt(c.netNeg, 3) + '</td><td class="val-neg">' + p2(c.pNetNeg) + ' ' + pU + '</td></tr>' +
    '<tr><td>Positive (net downward)</td><td>' + fmt(c.netPos, 3) + '</td><td class="val-pos">' + p2(c.pNetPos) + ' ' + pU + '</td></tr>' +
    '</tbody></table>';
  if (c.netCapped) html += '<div class="alert warn">A or h<sub>c</sub>/h<sub>e</sub> is outside the tabulated range &mdash; the boundary (GC<sub>p</sub>) value is used as a capped approximation.</div>';
  return html;
}

// Circular Bins, Silos, and Tanks section (Sec. 30.10, Eq. 30.10-1) —
// identical content for the on-screen #circTankResults and the print/export
// report.
function reportCircTankHTML(r) {
  const s = state;
  const t = r.circTank;
  if (!t) return '<p class="muted">Circular tank data unavailable.</p>';
  const pU = pUnit();
  const lU = s.unitSystem === 'SI' ? 'm' : 'ft';
  const p2 = v => fmt(pVal(v), 2);

  let html = '<p class="muted" style="margin:0 0 10px;">p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)] <span class="ref">Eq. 30.10-1</span> &mdash; q<sub>h</sub> at mean roof height h (Sec. 26.7.3), the same q<sub>h</sub> used elsewhere on this page (Sec. 30.10 does not define an independent tank-height q<sub>h</sub>).</p>';
  html += '<table class="report-input-table"><tbody>' +
    '<tr><td>Diameter, D</td><td>' + fmt(lengthOut(t.D), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Cylinder height, H</td><td>' + fmt(lengthOut(t.H), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>H / D</td><td>' + fmt(t.HD, 3) + '</td></tr>' +
    '<tr><td>q<sub>h</sub></td><td>' + p2(r.qh) + ' ' + pU + '</td></tr>' +
    '<tr><td>Internal pressure basis</td><td>' + (t.isOpenTop ? 'Open-topped tank &mdash; Eq. 30.10-5, (GC<sub>pi</sub>) = ' + fmt(t.openGcpi, 3) : t.enclosureLabel + ' (Sec. 26.13)') + '</td></tr>' +
    '</tbody></table>';

  if (t.HDCapped) {
    html += '<div class="alert warn">H/D = ' + fmt(t.HD, 3) + ' is outside the 0.25 &le; H/D &le; 4.0 applicability range of Eqs. 30.10-2/30.10-3/30.10-4 &mdash; the nearest boundary value (H/D = ' + fmt(t.HDcap, 2) + ') is used as a capped approximation; verify against the Standard.</div>';
  }

  html += '<h3>External Walls <span class="ref">Sec. 30.10.2, Eqs. 30.10-2 to 30.10-4</span></h3>' +
    '<p class="muted" style="margin:0 0 8px;">&alpha; = angle from the windward stagnation point (0&deg;) around the circumference to 180&deg; (leeward). C(&alpha;) and the resulting (GC<sub>p</sub>) are continuous functions of &alpha; and H/D; tabulated here at the same 15&deg; increments as ASCE/SEI 7-22 Commentary Table C30.10-1.</p>';
  if (t.isOpenTop) {
    html += '<table class="report-table"><thead><tr><th>&alpha; (deg)</th><th>C(&alpha;)</th><th>(GC<sub>p</sub>)</th><th>p</th></tr></thead><tbody>' +
      t.wallRows.map(row => '<tr><td>' + fmt(row.alpha, 0) + '</td><td>' + fmt(row.C, 3) + '</td><td>' + fmt(row.gcp, 3) + '</td><td>' + p2(row.p) + ' ' + pU + '</td></tr>').join('') +
      '</tbody></table>';
  } else {
    html += '<table class="report-table"><thead><tr><th>&alpha; (deg)</th><th>C(&alpha;)</th><th>(GC<sub>p</sub>)</th><th>p<sub>min</sub></th><th>p<sub>max</sub></th></tr></thead><tbody>' +
      t.wallRows.map(row => '<tr><td>' + fmt(row.alpha, 0) + '</td><td>' + fmt(row.C, 3) + '</td><td>' + fmt(row.gcp, 3) + '</td><td class="val-neg">' + p2(row.pMin) + ' ' + pU + '</td><td class="val-pos">' + p2(row.pMax) + ' ' + pU + '</td></tr>').join('') +
      '</tbody></table>';
  }

  if (t.isElevated && t.underside) {
    html += '<h3>Underside of Elevated Bin <span class="ref">Sec. 30.10.5</span></h3>' +
      '<table class="report-table"><thead><tr><th>Zone</th><th>(GC<sub>p</sub>)<sub>pos</sub></th><th>(GC<sub>p</sub>)<sub>neg</sub></th><th>p<sub>pos</sub></th><th>p<sub>neg</sub></th></tr></thead><tbody>' +
      t.underside.map(z => '<tr><td>' + z.zone + '</td><td>' + fmt(z.gcpPos, 2) + '</td><td>' + fmt(z.gcpNeg, 2) + '</td><td class="val-pos">' + p2(z.pPos) + ' ' + pU + '</td><td class="val-neg">' + p2(z.pNeg) + ' ' + pU + '</td></tr>').join('') +
      '</tbody></table>';
  }

  html += '<div class="alert warn">NOT IMPLEMENTED &mdash; roof pressures for isolated circular bins (Sec. 30.10.4, Fig. 30.10-2, Zones 1&ndash;4) and roof/wall pressures for grouped circular bins (Sec. 30.10.6, Figs. 30.10-3/30.10-4, used when center-to-center spacing &lt; 1.25D) are NOT calculated by this module. Both exist only as graphical figures in ASCE/SEI 7-22 with no numeric (GC<sub>p</sub>) values given in the standard\'s text or Commentary &mdash; consult the Standard directly for these provisions.</div>';
  return html;
}

// Stepped roof elevation diagram — side-profile SVG showing the taller and
// lower roof levels, the step, and the widened step-adjacent zone band.
function steppedRoofSvg(t) {
  const W = 420, H = 230, pad = 40;
  const scale = (W - 2 * pad) / (t.Wlow * 2.4); // fit lower roof + some of the tall roof in view
  const baseY = H - 40;
  const hTallPx = t.hTall * scale, hLowPx = t.hLow * scale;
  const wLowPx = t.Wlow * scale;
  const stepX = pad + wLowPx;
  const tallTopY = baseY - hTallPx, lowTopY = baseY - hLowPx;
  const aMainPx = Math.min(t.aMain * scale, wLowPx * 0.4);
  const aStepPx = Math.min(t.aStep * scale, wLowPx);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`;
  // ground
  s += `<line x1="${pad - 10}" y1="${baseY}" x2="${W - pad + 60}" y2="${baseY}" stroke="#888" stroke-width="1"/>`;
  // lower roof block outline
  s += `<rect x="${pad}" y="${lowTopY}" width="${wLowPx}" height="${hLowPx}" fill="none" stroke="#1c2733" stroke-width="1.5"/>`;
  // tall roof block outline (extends right of the step)
  s += `<rect x="${stepX}" y="${tallTopY}" width="${wLowPx * 1.1}" height="${hTallPx}" fill="none" stroke="#1c2733" stroke-width="1.5"/>`;
  // zone-2 (outer edge) band on lower roof, at its far (left) edge
  s += `<rect x="${pad}" y="${lowTopY}" width="${aMainPx}" height="4" fill="#1f4e79"/>`;
  // step-adjacent widened zone band on lower roof, measured inward from the step
  s += `<rect x="${stepX - aStepPx}" y="${lowTopY}" width="${aStepPx}" height="4" fill="#c0571f"/>`;
  // dimension callouts
  s += `<text x="${pad + aMainPx / 2}" y="${lowTopY - 6}" font-size="9" fill="#1f4e79" text-anchor="middle">a</text>`;
  s += `<text x="${stepX - aStepPx / 2}" y="${lowTopY - 6}" font-size="9" fill="#c0571f" text-anchor="middle">1.5h&#8347;</text>`;
  s += `<text x="${pad + wLowPx / 2}" y="${baseY + 16}" font-size="9" fill="var(--muted)" text-anchor="middle">W&#8327; (lower roof)</text>`;
  // height labels
  s += `<text x="${pad - 14}" y="${(baseY + lowTopY) / 2}" font-size="9" fill="var(--muted)" text-anchor="end">h&#8327;</text>`;
  s += `<text x="${stepX + wLowPx * 1.1 + 14}" y="${(baseY + tallTopY) / 2}" font-size="9" fill="var(--muted)" text-anchor="start">h</text>`;
  s += `<text x="${(stepX + pad + wLowPx) / 2}" y="${tallTopY - 10}" font-size="9" fill="var(--accent)" text-anchor="middle">step, h&#8347; = ${fmt(t.hs, 1)} ${state.unitSystem === 'SI' ? 'm' : 'ft'}</text>`;
  s += `<g font-size="8" fill="#fff">` +
    `<rect x="${pad + aMainPx / 2 - 6}" y="${lowTopY + 8}" width="12" height="12" fill="#1f4e79"/><text x="${pad + aMainPx / 2}" y="${lowTopY + 17}" text-anchor="middle">2</text>` +
    `<rect x="${stepX - aStepPx / 2 - 6}" y="${lowTopY + 8}" width="12" height="12" fill="#c0571f"/><text x="${stepX - aStepPx / 2}" y="${lowTopY + 17}" text-anchor="middle">2</text>` +
    `<rect x="${(pad + stepX - aStepPx) / 2 - 6}" y="${lowTopY + 8}" width="12" height="12" fill="#5b6b7c"/><text x="${(pad + stepX - aStepPx) / 2}" y="${lowTopY + 17}" text-anchor="middle">1</text>` +
    `</g>`;
  s += `</svg>`;
  return s;
}

// Stepped Roofs section (Sec. 30.3.2.1, Fig. 30.3-3) — identical content for
// the on-screen #steppedRoofResults and the print/export report.
function reportSteppedRoofHTML(r) {
  const t = r.steppedRoof;
  if (!t) return '<p class="muted">Stepped roof data unavailable.</p>';
  const pU = pUnit();
  const lU = state.unitSystem === 'SI' ? 'm' : 'ft';
  const p2 = v => fmt(pVal(v), 2);

  let html = '<p class="muted" style="margin:0 0 10px;">p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)] <span class="ref">Eq. 30.3-1</span> &mdash; per Fig. 30.3-3\'s own note, the lower roof level reuses the same Zone 1/2/3 (GC<sub>p</sub>) values as Fig. 30.3-2A (flat roof, &theta; &le; 7&deg;); only the zone <em>geometry</em> changes near the step.</p>';
  html += '<div class="zone-row"><div class="zone-tbl">' +
    '<table class="report-input-table"><tbody>' +
    '<tr><td>Taller roof height, h</td><td>' + fmt(lengthOut(t.hTall), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Lower roof height</td><td>' + fmt(lengthOut(t.hLow), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Step height differential, h<sub>s</sub></td><td>' + fmt(lengthOut(t.hs), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Lower roof width, W<sub>L</sub></td><td>' + fmt(lengthOut(t.Wlow), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Outer edge-zone width, a</td><td>' + fmt(lengthOut(t.aMain), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Step-adjacent zone width, 1.5h<sub>s</sub></td><td>' + fmt(lengthOut(t.aStep), 2) + ' ' + lU + (t.aStepCapped ? ' (capped at W<sub>L</sub>)' : '') + '</td></tr>' +
    '</tbody></table></div><div class="zone-diag">' + steppedRoofSvg(t) + '</div></div>';

  html += '<table class="report-table"><thead><tr><th>Zone</th><th>(GC<sub>p</sub>)<sub>neg</sub></th><th>(GC<sub>p</sub>)<sub>pos</sub></th><th>p<sub>min</sub></th><th>p<sub>max</sub></th></tr></thead><tbody>' +
    ['1', '2', '3'].map(z => {
      const zz = t['zone' + z];
      return '<tr><td>Zone ' + z + '</td><td>' + fmt(zz.gc.neg, 3) + '</td><td>' + fmt(zz.gc.pos, 3) + '</td><td class="val-neg">' + p2(zz.pMin) + ' ' + pU + '</td><td class="val-pos">' + p2(zz.pMax) + ' ' + pU + '</td></tr>';
    }).join('') +
    '</tbody></table>';

  html += '<div class="alert info">Zone 1 = interior of the lower roof (away from both the step and the outer perimeter); Zone 2 = the standard outer-perimeter edge strip (width a, per Fig. 30.3-1/30.3-2A Notation) AND the widened step-adjacent band (width 1.5h<sub>s</sub>, read from Fig. 30.3-3\'s diagram); Zone 3 = corners. This calculator covers the common two-level (single-step) stepped roof; buildings with more than one step (cascading roofs) are <strong>not implemented</strong> &mdash; consult Fig. 30.3-3 directly, which gives multiplier dimensions (1.5h<sub>s1</sub>, 0.6h<sub>s2</sub>, ...) for each successive step. The Standard does not state these multipliers in words, only on the figure\'s diagram.</div>';
  return html;
}

// Multispan gable roof plan diagram — tiled zone pattern across 2 modules,
// showing the eave edges and the repeating ridge/valley lines.
function multispanRoofSvg(t) {
  const W = 420, H = 230, pad = 36;
  const modPx = (W - 2 * pad) / 2.4; // width of one module on screen (show ~2.4 modules)
  const Lpx = H - 2 * pad;
  const aPx = Math.min(t.a / t.Wp * modPx, modPx * 0.35);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`;
  s += `<rect x="${pad}" y="${pad}" width="${modPx * 2}" height="${Lpx}" fill="none" stroke="#1c2733" stroke-width="1.5"/>`;
  // ridge/valley line between the two modules (dashed)
  s += `<line x1="${pad + modPx}" y1="${pad}" x2="${pad + modPx}" y2="${pad + Lpx}" stroke="#888" stroke-width="1" stroke-dasharray="4,3"/>`;
  // eave edge bands (top and bottom, full width) — zone 2 field
  [pad, pad + Lpx - 4].forEach(y => {
    s += `<rect x="${pad}" y="${y}" width="${modPx * 2}" height="4" fill="#1f4e79"/>`;
  });
  // corner squares at the 4 module-boundary x-positions along both eaves
  const xs = [pad, pad + modPx, pad + modPx * 2];
  [pad + 2, pad + Lpx - 6].forEach(y => {
    xs.forEach(cx => {
      s += `<rect x="${cx - aPx / 2}" y="${y}" width="${aPx}" height="6" fill="#c0571f"/>`;
    });
  });
  // edge band along the ridge/valley line in the interior (zone 2), and zone 1 field
  s += `<rect x="${pad + modPx - aPx / 2}" y="${pad}" width="${aPx}" height="${Lpx}" fill="#3a6a94" opacity="0.5"/>`;
  s += `<text x="${pad + modPx / 2}" y="${pad + Lpx / 2}" font-size="11" fill="var(--muted)" text-anchor="middle">1</text>`;
  s += `<text x="${pad + modPx}" y="${pad + Lpx / 2 - 8}" font-size="10" fill="#1f4e79" text-anchor="middle">2 (ridge/valley)</text>`;
  s += `<text x="${pad + modPx / 2}" y="${pad - 8}" font-size="10" fill="var(--muted)" text-anchor="middle">eave &mdash; zone 2 / 3 at corners</text>`;
  s += `<text x="${pad + modPx}" y="${pad + Lpx + 16}" font-size="9" fill="var(--muted)" text-anchor="middle">W&prime; = ${fmt(lengthOut(t.Wp), 1)} ${state.unitSystem === 'SI' ? 'm' : 'ft'} per module</text>`;
  s += `</svg>`;
  return s;
}

// Multispan Gable Roofs section (Fig. 30.3-4) — identical content for the
// on-screen #multispanRoofResults and the print/export report.
function reportMultispanRoofHTML(r) {
  const t = r.multispanRoof;
  if (!t) return '<p class="muted">Multispan roof data unavailable.</p>';
  const pU = pUnit();
  const lU = state.unitSystem === 'SI' ? 'm' : 'ft';
  const p2 = v => fmt(pVal(v), 2);

  if (!t.thetaLE10) {
    return '<div class="alert warn">NOT IMPLEMENTED for &theta; = ' + fmt(t.theta, 1) + '&deg; &gt; 10&deg;. Fig. 30.3-4 gives its own (GC<sub>p</sub>) vs. effective-wind-area graphs for 10&deg; &lt; &theta; &le; 30&deg; and 30&deg; &lt; &theta; &le; 45&deg; (three overlapping curves for Zones 1/2/3 each, with their own breakpoints and no printed coordinate table) &mdash; digitizing these reliably from the rendered figure was not done here to avoid guessing at unlabeled breakpoints. Reduce the roof angle &theta; to &le; 10&deg; to use this calculator\'s implementation (which reuses Fig. 30.3-2A per Fig. 30.3-4 Note 5), or consult Fig. 30.3-4 directly for steeper multispan gable roofs.</div>';
  }

  let html = '<p class="muted" style="margin:0 0 10px;">p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)] <span class="ref">Eq. 30.3-1</span> &mdash; per Fig. 30.3-4 Note 5, for &theta; &le; 10&deg; the (GC<sub>p</sub>) values from Fig. 30.3-2A (flat roof) apply directly; only the edge-zone width <strong>a</strong> uses this figure\'s own formula (based on the single-span module width, not the whole building). Fig. 30.3-4\'s Notation calls for <em>eave</em> height in this h &le; 10&deg; case &mdash; approximated here by the page\'s mean roof height h.</p>';
  html += '<div class="zone-row"><div class="zone-tbl">' +
    '<table class="report-input-table"><tbody>' +
    '<tr><td>Roof angle, &theta;</td><td>' + fmt(t.theta, 1) + '&deg;</td></tr>' +
    '<tr><td>Single-span module width, W&prime;</td><td>' + fmt(lengthOut(t.Wp), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Least horiz. dim. of module</td><td>' + fmt(lengthOut(t.Lmod), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Edge-zone width, a</td><td>' + fmt(lengthOut(t.a), 2) + ' ' + lU + '</td></tr>' +
    '</tbody></table></div><div class="zone-diag">' + multispanRoofSvg(t) + '</div></div>';

  html += '<table class="report-table"><thead><tr><th>Zone</th><th>(GC<sub>p</sub>)<sub>neg</sub></th><th>(GC<sub>p</sub>)<sub>pos</sub></th><th>p<sub>min</sub></th><th>p<sub>max</sub></th></tr></thead><tbody>' +
    ['1', '2', '3'].map(z => {
      const zz = t['zone' + z];
      return '<tr><td>Zone ' + z + '</td><td>' + fmt(zz.gc.neg, 3) + '</td><td>' + fmt(zz.gc.pos, 3) + '</td><td class="val-neg">' + p2(zz.pMin) + ' ' + pU + '</td><td class="val-pos">' + p2(zz.pMax) + ' ' + pU + '</td></tr>';
    }).join('') +
    '</tbody></table>';

  html += '<div class="alert info">Zone 1 = roof interior, away from both the eaves and any ridge/valley line; Zone 2 = the edge strip (width a) along the two long eave edges AND along every ridge/valley line between adjacent spans; Zone 3 = corners, where an eave edge meets a ridge/valley line (i.e. at every module boundary along both eaves). This tiles the standard flat-roof corner/edge/interior pattern across all spans rather than just the building\'s outer perimeter.</div>';
  return html;
}

// Sawtooth roof plan diagram — one module's zone pattern, highlighting the
// doubled-width zone band at the low (upwind) eave of each span.
function sawtoothRoofSvg(t) {
  const W = 420, H = 230, pad = 40;
  const modPx = W - 2 * pad;
  const Lpx = H - 2 * pad;
  const aPx = Math.min(t.a / t.Wsp * modPx, modPx * 0.22);
  const aLowPx = Math.min(t.aLow / t.Wsp * modPx, modPx * 0.4);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`;
  s += `<rect x="${pad}" y="${pad}" width="${modPx}" height="${Lpx}" fill="none" stroke="#1c2733" stroke-width="1.5"/>`;
  // top & bottom eave bands (standard width a) — zone 2
  [pad, pad + Lpx - 4].forEach(y => {
    s += `<rect x="${pad}" y="${y}" width="${modPx}" height="4" fill="#1f4e79"/>`;
  });
  // right eave band (standard width a) — zone 2
  s += `<rect x="${pad + modPx - aPx}" y="${pad}" width="${aPx}" height="${Lpx}" fill="#1f4e79" opacity="0.45"/>`;
  // left (low) eave band — doubled width 2a — zone 2, highlighted
  s += `<rect x="${pad}" y="${pad}" width="${aLowPx}" height="${Lpx}" fill="#c0571f" opacity="0.55"/>`;
  // corner squares — zone 3
  const corners = [[pad, pad], [pad + modPx - 10, pad], [pad, pad + Lpx - 10], [pad + modPx - 10, pad + Lpx - 10]];
  corners.forEach(([cx, cy]) => {
    s += `<rect x="${cx}" y="${cy}" width="10" height="10" fill="#5b6b7c"/>`;
  });
  s += `<text x="${pad + modPx / 2}" y="${pad + Lpx / 2}" font-size="12" fill="var(--muted)" text-anchor="middle">1</text>`;
  s += `<text x="${pad + aLowPx / 2}" y="${pad + Lpx / 2 + 16}" font-size="9" fill="#c0571f" text-anchor="middle">2a (low eave)</text>`;
  s += `<text x="${pad + modPx / 2}" y="${pad - 8}" font-size="9" fill="var(--muted)" text-anchor="middle">a (eave)</text>`;
  s += `<text x="${pad + modPx / 2}" y="${pad + Lpx + 16}" font-size="9" fill="var(--muted)" text-anchor="middle">W = ${fmt(lengthOut(t.Wsp), 1)} ${state.unitSystem === 'SI' ? 'm' : 'ft'} per span</text>`;
  s += `</svg>`;
  return s;
}

// Sawtooth Roofs section (Fig. 30.3-6) — identical content for the
// on-screen #sawtoothRoofResults and the print/export report.
function reportSawtoothRoofHTML(r) {
  const t = r.sawtoothRoof;
  if (!t) return '<p class="muted">Sawtooth roof data unavailable.</p>';
  const pU = pUnit();
  const lU = state.unitSystem === 'SI' ? 'm' : 'ft';
  const p2 = v => fmt(pVal(v), 2);

  let html = '<p class="muted" style="margin:0 0 10px;">p = q<sub>h</sub>&middot;K<sub>d</sub>&middot;[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)] <span class="ref">Eq. 30.3-1</span> &mdash; ' +
    (t.thetaLE10
      ? 'per Fig. 30.3-6 Note 5, for &theta; &le; 10&deg; the (GC<sub>p</sub>) values from Fig. 30.3-2A (flat roof) apply directly; only the edge-zone widths use this figure\'s own formula. Fig. 30.3-6\'s Notation calls for <em>eave</em> height in this &theta; &le; 10&deg; case &mdash; approximated here by the page\'s mean roof height h.'
      : 'for &theta; &gt; 10&deg;, (GC<sub>p</sub>) is read from Fig. 30.3-6\'s own effective-wind-area graph, digitized at the breakpoints below and interpolated linearly in log<sub>10</sub>(effective wind area), the same convention used for the other GC<sub>p</sub>-vs-area graphs on this page.') +
    '</p>';
  html += '<div class="zone-row"><div class="zone-tbl">' +
    '<table class="report-input-table"><tbody>' +
    '<tr><td>Roof angle, &theta;</td><td>' + fmt(t.theta, 1) + '&deg;</td></tr>' +
    '<tr><td>Single-span module width, W</td><td>' + fmt(lengthOut(t.Wsp), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Least horiz. dim. of module</td><td>' + fmt(lengthOut(t.Lmod), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Standard edge-zone width, a</td><td>' + fmt(lengthOut(t.a), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Low-eave zone width, 2a</td><td>' + fmt(lengthOut(t.aLow), 2) + ' ' + lU + '</td></tr>' +
    (t.thetaLE10 ? '' : '<tr><td>Effective wind area, A</td><td>' + fmt(t.A, 1) + ' ft&sup2;</td></tr>') +
    '</tbody></table></div><div class="zone-diag">' + sawtoothRoofSvg(t) + '</div></div>';

  if (t.thetaLE10) {
    html += '<table class="report-table"><thead><tr><th>Zone</th><th>(GC<sub>p</sub>)<sub>neg</sub></th><th>(GC<sub>p</sub>)<sub>pos</sub></th><th>p<sub>min</sub></th><th>p<sub>max</sub></th></tr></thead><tbody>' +
      ['1', '2', '3'].map(z => {
        const zz = t['zone' + z];
        return '<tr><td>Zone ' + z + '</td><td>' + fmt(zz.gc.neg, 3) + '</td><td>' + fmt(zz.gc.pos, 3) + '</td><td class="val-neg">' + p2(zz.pMin) + ' ' + pU + '</td><td class="val-pos">' + p2(zz.pMax) + ' ' + pU + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    html += '<div class="alert info">Zone 1 = roof interior; Zone 2 = the edge strip along the top, bottom, and right (high) eaves at the standard width a, AND a <strong>doubled</strong> width 2a along the left (low) eave of each span, where the monoslope roof drops down to the next span (the sawtooth\'s defining step); Zone 3 = corners. The doubled low-eave width is read directly from Fig. 30.3-6\'s own diagram dimensions.</div>';
  } else {
    html += '<table class="report-table"><thead><tr><th>Zone</th><th>(GC<sub>p</sub>)<sub>neg</sub></th><th>(GC<sub>p</sub>)<sub>pos</sub></th><th>p<sub>min</sub></th><th>p<sub>max</sub></th></tr></thead><tbody>' +
      [['zone1', 'Zone 1'], ['zone2', 'Zone 2'], ['zone3SpanA', 'Zone 3 (Span A)'], ['zone3SpansBCD', 'Zone 3 (Spans B, C, &amp; D)']].map(([key, label]) => {
        const zz = t[key];
        return '<tr><td>' + label + '</td><td>' + fmt(zz.gc.neg, 3) + '</td><td>' + fmt(zz.gc.pos, 3) + '</td><td class="val-neg">' + p2(zz.pMin) + ' ' + pU + '</td><td class="val-pos">' + p2(zz.pMax) + ' ' + pU + '</td></tr>';
      }).join('') +
      '</tbody></table>';
    html += '<div class="alert info">For &theta; &gt; 10&deg;, Fig. 30.3-6\'s negative (uplift) curves split Zone 3 into <strong>Span A</strong> (the first, windward span) and <strong>Spans B, C, &amp; D</strong> (the repeating downstream spans) &mdash; Zones 1 and 2 do not split. The positive curves are shared by all spans (no Span A / B,C&amp;D distinction). Zone 1 = roof interior; Zone 2 = the edge strip at width a (doubled to 2a at each span\'s low eave); Zone 3 = corners. (GC<sub>p</sub>) values above were digitized directly from Fig. 30.3-6\'s graph at its own plotted breakpoints, not estimated &mdash; verify against the figure directly for critical designs.</div>';
  }
  return html;
}

// Domed roof elevation diagram — schematic dome profile on a cylindrical
// base, with D/f/h_D dimensions and the apex "cap" region (theta 61-90 deg)
// highlighted versus the rest of the dome (theta 0-60 deg). Not drawn to
// angular scale (theta is a curved-surface angle, not a height fraction) —
// illustrative only; the report table below carries the actual numbers.
function domeRoofSvg(t) {
  const W = 420, H = 230, pad = 30;
  const baseY = H - 30;
  const maxH = 130;
  const totalH = Math.max(t.hD + t.f, 0.01);
  const scaleV = maxH / totalH;
  const hDpx = Math.min(Math.max(t.hD * scaleV, 0), maxH * 0.85);
  const fPx = Math.max(maxH - hDpx, 18);
  const rx = 110, cx = W / 2;
  const baseTopY = baseY - hDpx;
  const apexY = baseTopY - fPx;

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`;
  s += `<line x1="${pad}" y1="${baseY}" x2="${W - pad}" y2="${baseY}" stroke="#1c2733" stroke-width="1.5"/>`;
  if (hDpx > 1) {
    s += `<rect x="${cx - rx}" y="${baseTopY}" width="${rx * 2}" height="${hDpx}" fill="none" stroke="#1c2733" stroke-width="1.5"/>`;
  }
  // dome cap (theta 61-90 deg, near apex) — drawn first so the outline draws over it
  s += `<path d="M ${cx - rx * 0.5} ${baseTopY - fPx * 0.62} A ${rx * 0.5} ${fPx * 0.62} 0 0 1 ${cx + rx * 0.5} ${baseTopY - fPx * 0.62}" fill="#c0571f" opacity="0.45" stroke="none"/>`;
  // full dome outline (theta 0-90 deg)
  s += `<path d="M ${cx - rx} ${baseTopY} A ${rx} ${fPx} 0 0 1 ${cx + rx} ${baseTopY}" fill="none" stroke="#1c2733" stroke-width="1.5"/>`;
  // wind arrow
  s += `<line x1="${pad}" y1="${baseTopY - fPx * 0.4}" x2="${cx - rx - 10}" y2="${baseTopY - fPx * 0.4}" stroke="#5b6b7c" stroke-width="1.5" marker-end="url(#domeArrow)"/>`;
  s += `<defs><marker id="domeArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5b6b7c"/></marker></defs>`;
  s += `<text x="${pad}" y="${baseTopY - fPx * 0.4 - 6}" font-size="10" fill="#5b6b7c">Wind</text>`;
  // D dimension (base width)
  s += `<line x1="${cx - rx}" y1="${baseY + 12}" x2="${cx + rx}" y2="${baseY + 12}" stroke="var(--muted)" stroke-width="1"/>`;
  s += `<text x="${cx}" y="${baseY + 24}" font-size="10" fill="var(--muted)" text-anchor="middle">D = ${fmt(lengthOut(t.D), 1)} ${state.unitSystem === 'SI' ? 'm' : 'ft'}</text>`;
  // h_D dimension (right side, base height)
  if (hDpx > 1) {
    s += `<text x="${cx + rx + 8}" y="${(baseY + baseTopY) / 2 + 4}" font-size="10" fill="var(--muted)">h<tspan baseline-shift="sub" font-size="7">D</tspan> = ${fmt(lengthOut(t.hD), 1)}</text>`;
  }
  // f dimension (right side, dome rise)
  s += `<text x="${cx + rx + 8}" y="${(baseTopY + apexY) / 2 + 4}" font-size="10" fill="var(--muted)">f = ${fmt(lengthOut(t.f), 1)}</text>`;
  s += `<text x="${cx}" y="${apexY - fPx * 0.62 - 10}" font-size="9" fill="#c0571f" text-anchor="middle">&theta; 61&ndash;90&deg;</text>`;
  s += `<text x="${cx}" y="${baseTopY - fPx * 0.2}" font-size="9" fill="var(--muted)" text-anchor="middle">&theta; 0&ndash;60&deg;</text>`;
  s += `</svg>`;
  return s;
}

// Domed Roofs section (Fig. 30.3-7) — identical content for the on-screen
// #domeRoofResults and the print/export report.
function reportDomeRoofHTML(r) {
  const t = r.domeRoof;
  if (!t) return '<p class="muted">Dome roof data unavailable.</p>';
  const pU = pUnit();
  const lU = state.unitSystem === 'SI' ? 'm' : 'ft';
  const p2 = v => fmt(pVal(v), 2);

  let html = '<p class="muted" style="margin:0 0 10px;">p = q<sub>(h<sub>D</sub>+f)</sub>&middot;K<sub>d</sub>&middot;[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)] <span class="ref">Fig. 30.3-7, Note 1, Eq. 30.3-1</span> &mdash; (GC<sub>p</sub>) below comes directly from Fig. 30.3-7\'s own lookup table ("Coefficients for Domes with a Circular Base"), not a graph; the velocity pressure is evaluated at the height of the dome\'s apex (h<sub>D</sub> + f), not the page\'s shared q<sub>h</sub>.</p>';

  html += '<div class="zone-row"><div class="zone-tbl">' +
    '<table class="report-input-table"><tbody>' +
    '<tr><td>Diameter, D</td><td>' + fmt(lengthOut(t.D), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Dome rise, f</td><td>' + fmt(lengthOut(t.f), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Height to base of dome, h<sub>D</sub></td><td>' + fmt(lengthOut(t.hD), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>h<sub>D</sub> / D</td><td>' + fmt(t.hDoverD, 3) + (t.outOfRange ? ' <span class="val-neg">(out of range)</span>' : '') + '</td></tr>' +
    '<tr><td>f / D</td><td>' + fmt(t.fOverD, 3) + (t.outOfRange ? ' <span class="val-neg">(out of range)</span>' : '') + '</td></tr>' +
    '<tr><td>Height at top of dome, h<sub>D</sub>+f</td><td>' + fmt(lengthOut(t.domeTopZ), 2) + ' ' + lU + '</td></tr>' +
    '<tr><td>Velocity pressure, q<sub>(hD+f)</sub></td><td>' + fmt(pVal(t.qDome), 2) + ' ' + pU + '</td></tr>' +
    '</tbody></table></div><div class="zone-diag">' + domeRoofSvg(t) + '</div></div>';

  html += '<table class="report-table"><thead><tr><th>External Pressure</th><th>&theta;, degrees</th><th>(GC<sub>p</sub>)</th><th>p<sub>min</sub></th><th>p<sub>max</sub></th></tr></thead><tbody>' +
    '<tr><td>Negative (uplift)</td><td>0&ndash;90</td><td>' + fmt(t.gcpNeg, 2) + '</td><td class="val-neg">' + p2(t.pNeg.min) + ' ' + pU + '</td><td class="val-pos">' + p2(t.pNeg.max) + ' ' + pU + '</td></tr>' +
    '<tr><td>Positive</td><td>0&ndash;60</td><td>+' + fmt(t.gcpPosLow, 2) + '</td><td class="val-neg">' + p2(t.pPosLow.min) + ' ' + pU + '</td><td class="val-pos">' + p2(t.pPosLow.max) + ' ' + pU + '</td></tr>' +
    '<tr><td>Positive</td><td>61&ndash;90</td><td>+' + fmt(t.gcpPosHigh, 2) + '</td><td class="val-neg">' + p2(t.pPosHigh.min) + ' ' + pU + '</td><td class="val-pos">' + p2(t.pPosHigh.max) + ' ' + pU + '</td></tr>' +
    '</tbody></table>';

  if (t.outOfRange) {
    html += '<div class="alert warn">h<sub>D</sub>/D and/or f/D fall outside the range Fig. 30.3-7\'s Note 4 covers (0 &le; h<sub>D</sub>/D &le; 0.5, 0.2 &le; f/D &le; 0.5). The table values above are shown anyway but are <strong>not validated</strong> for this geometry &mdash; consult ASCE/SEI 7-22 directly or use a wind-tunnel/specialist study for domes outside this range.</div>';
  }
  html += '<div class="alert info">Each component is designed for both the maximum positive and maximum negative pressure (Note 3). Per Note 2, plus signs act toward the surface and minus signs act away from it. &theta; = 0&deg; at the dome springline (base perimeter), &theta; = 90&deg; at the dome\'s center top point (Note 5).</div>';
  return html;
}

// Open Building — Free Roof Pressures section (Sec. 27.3.2, Eq. 27.3-2) —
// identical cards/notes/tables/citations to the on-screen #openRoofSection.
function reportOpenRoofHTML(r) {
  const o = r.openRoof;
  let html = '<table class="report-input-table"><tbody>' +
    '<tr><td>Gust factor, G</td><td>' + fmt(o.G, 2) + '</td></tr>' +
    '<tr><td>h / L</td><td>' + fmt(o.hL, 3) + '</td></tr>' +
    '</tbody></table>';

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
    html += '<div class="alert warn">' + msgs.map(m => '<p style="margin:2px 0;">' + m + '</p>').join('') + '</div>';
  }

  const figNum = o.shape === 'monoslope' ? '27.3-4' : (o.shape === 'pitched' ? '27.3-5' : '27.3-6');
  html += '<h3>Wind Normal to Ridge/Span &mdash; &gamma; = 0&deg;/180&deg; <span class="ref">' +
    (o.note4Applies ? 'Fig. 27.3-7 (per Fig. 27.3-4 Note 4)' : 'Fig. ' + figNum) + '</span></h3>';
  html += o.note4Applies
    ? '<p class="muted">Per Note 4, use the &gamma; = 90&deg;/270&deg; (Fig. 27.3-7) table below for this loading direction.</p>'
    : openRoofGammaTableHTML(o.gamma0180);

  html += '<h3>Wind Parallel to Ridge/Span &mdash; &gamma; = 90&deg;/270&deg; <span class="ref">Fig. 27.3-7</span></h3>' +
    '<p class="muted" style="margin:0 0 10px;">Applies to monoslope, pitched, and troughed free roofs for all h/L, &theta; &le; 45&deg;. Zones are measured horizontally from the windward roof edge. Load Cases A and B per Fig. 27.3-7.</p>' +
    openRoofZoneTableHTML(o.fig277);
  return html;
}

// Repeating print title block (Tekla Tedds / SkyCiv style) — placed in the
// <thead> of every "report-page" table so it repeats on every printed page
// via CSS `thead{display:table-header-group}` (index.html @media print).
// All fields are user-entered metadata (state.companyName, state.projectName,
// state.jobRef, state.chkdBy/appdBy, etc., from the Project Information
// panel); nothing here is computed.
//
// "Sheet no." is a STATIC per-section index (1 = cover page, 2..N+1 = the
// report sections in the order buildReportHTML() emits them), NOT a live
// "Sheet X of Y" page counter: CSS Paged Media page-based counters
// (counter(page)/counter(pages)) are not implemented by Chrome for ordinary
// DOM content (only inside @page margin boxes, which Chrome doesn't
// support), so an honest running page count cannot be produced here. Users
// should verify actual printed page numbers in the PDF/print preview.
function buildTitleBlockHTML() {
  const s = state;
  const d = (iso) => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '&ndash;';
  const v = (val) => val ? escHtml(val) : '&ndash;';
  const logoHTML = s.companyLogo
    ? '<img src="' + s.companyLogo + '" style="max-width:100%; max-height:80px; object-fit:contain;">'
    : '<div class="tb-logo-placeholder">LOGO</div>';
  // Tedds-style 3-row title block:
  // Row 1: Logo(rowspan=3) | Project label | project name | Job Ref. label | job ref value
  // Row 2: (logo)          | Section label | section name | Sheet label    | sheet no.
  // Row 3: (logo)          | Company name  | Calc.by+Date | Chk'd by+Date  | App'd by+Date
  return '<table class="title-block"><tbody>' +
    '<tr>' +
      '<td class="tb-logo" rowspan="3">' + logoHTML + '</td>' +
      '<td class="tb-fl">Project</td>' +
      '<td class="tb-fv tb-fv-wide">' + v(s.projectName) + '</td>' +
      '<td class="tb-fl">Job Ref.</td>' +
      '<td class="tb-fv">' + v(s.jobRef) + '</td>' +
    '</tr>' +
    '<tr>' +
      '<td class="tb-fl">Section</td>' +
      '<td class="tb-fv">' + v(s.sectionName) + '</td>' +
      '<td class="tb-fl">Sheet no.</td>' +
      '<td class="tb-fv">1</td>' +
    '</tr>' +
    '<tr>' +
      '<td class="tb-company">' + v(s.companyName) + '</td>' +
      '<td class="tb-signoff"><span class="tb-label">Calc. by</span> ' + v(s.engineer) + '<span class="tb-label">Date</span> ' + d(s.projectDate) + '</td>' +
      '<td class="tb-signoff"><span class="tb-label">Chk&rsquo;d by</span> ' + v(s.chkdBy) + '<span class="tb-label">Date</span> ' + d(s.chkdDate) + '</td>' +
      '<td class="tb-signoff"><span class="tb-label">App&rsquo;d by</span> ' + v(s.appdBy) + '<span class="tb-label">Date</span> ' + d(s.appdDate) + '</td>' +
    '</tr>' +
  '</tbody></table>';
}

// Assembles the full printable report from r/state. Sections are numbered
// sequentially and conditional sections (Parapet, Open Roof) are appended
// only when applicable — mirrors what is actually shown on screen. Each
// section is wrapped in a <table class="report-page"> whose <thead> holds
// the repeating title block (sheet no. = section index + 1; sheet 1 is the
// cover page built by renderPrintCover()).
function reportMinCheckHTML(r) {
  const pFmtR = psf => fmt(pVal(psf), 2) + ' ' + pUnit();
  const F = 'rgb(50,50,50)';
  const warn = '<span style="color:#b85c00; font-weight:700;">&#9888; GOVERNS</span>';
  const ok   = '<span style="color:#2a7a2a;">&#10003; OK</span>';

  // MWFRS table
  let mwfrsRows = r.mwfrsMinCheck.map(c => {
    const type = c.type === 'wall' ? 'Wall' : 'Roof';
    const status = c.governs
      ? '<td style="color:#b85c00; font-weight:700;">' + pFmtR(c.pMin) + ' ' + warn + '</td>'
      : '<td>' + pFmtR(c.pCalc) + ' ' + ok + '</td>';
    return '<tr><td>Zone ' + c.zone + '</td><td>' + type + '</td><td>' + pFmtR(c.pCalc) + '</td><td>' + pFmtR(c.pMin) + '</td>' + status + '</tr>';
  }).join('');

  const mwfrsNote = r.mwfrsMinGoverns
    ? '<p style="color:#b85c00; margin:6px 0 0; font-size:.8rem;">&#9888; One or more MWFRS zones are governed by the Sec. 27.1.5 minimum. Use the minimum pressure for those zones in structural design.</p>'
    : '<p style="color:#2a7a2a; margin:6px 0 0; font-size:.8rem;">&#10003; All MWFRS zones exceed the Sec. 27.1.5 minimum. Computed pressures govern.</p>';

  // C&C table
  let ccRows = r.ccMinCheck.map(c => {
    const status = c.governs
      ? '<td style="color:#b85c00; font-weight:700;">' + pFmtR(c.pMin) + ' ' + warn + '</td>'
      : '<td>' + pFmtR(c.pCalc) + ' ' + ok + '</td>';
    return '<tr><td>Zone ' + c.zone + '</td><td>' + pFmtR(c.pCalc) + '</td><td>' + pFmtR(c.pMin) + '</td>' + status + '</tr>';
  }).join('');

  const ccNote = r.ccMinGoverns
    ? '<p style="color:#b85c00; margin:6px 0 0; font-size:.8rem;">&#9888; One or more C&amp;C zones are governed by the Sec. 30.2.2 minimum. Use the minimum pressure for those zones in component design.</p>'
    : '<p style="color:#2a7a2a; margin:6px 0 0; font-size:.8rem;">&#10003; All C&amp;C zones exceed the Sec. 30.2.2 minimum. Computed pressures govern.</p>';

  const thStyle = 'style="text-align:left;"';
  return '<p style="font-size:.8rem; margin:0 0 8px;">Per Sec. 27.1.5, MWFRS net design pressures shall not be less than 16 psf (0.77 kN/m²) on wall zones and 8 psf (0.38 kN/m²) on roof zones. Per Sec. 30.2.2, C&amp;C net pressures shall not be less than 16 psf (0.77 kN/m²) acting in either direction normal to the surface.</p>' +
    '<p style="font-weight:700; margin:8px 0 4px;">MWFRS — Sec. 27.1.5</p>' +
    '<table class="report-input-table"><thead><tr><th ' + thStyle + '>Zone</th><th ' + thStyle + '>Type</th><th ' + thStyle + '>Calculated |p|</th><th ' + thStyle + '>Minimum |p|</th><th ' + thStyle + '>Design Pressure</th></tr></thead><tbody>' + mwfrsRows + '</tbody></table>' +
    mwfrsNote +
    '<p style="font-weight:700; margin:12px 0 4px;">C&amp;C — Sec. 30.2.2</p>' +
    '<table class="report-input-table"><thead><tr><th ' + thStyle + '>Zone</th><th ' + thStyle + '>Calculated |p|</th><th ' + thStyle + '>Minimum |p|</th><th ' + thStyle + '>Design Pressure</th></tr></thead><tbody>' + ccRows + '</tbody></table>' +
    ccNote;
}

function buildReportHTML(r) {
  const s = state;
  let secNum = 0;
  const section = (title, ref, body) => {
    secNum++;
    return '<div class="report-section"><h2>' + secNum + '. ' + title +
      (ref ? ' <span class="ref">' + ref + '</span>' : '') + '</h2>' + body + '</div>';
  };

  let html = '';

  html += section('Project &amp; Input Data', 'ASCE/SEI 7-22, Chapters 26&ndash;32', reportInputDataHTML(r));
  html += section('Design Summary', null, reportDesignSummaryHTML(r));
  html += section('Step-by-Step Calculation', 'ASCE/SEI 7-22 Ch. 26', stepsTableHTML(r.steps));

  // Diagrams — clone the live elevation/plan SVGs (already rendered with the
  // current inputs/zone overlay) under new ids so the live #elevSvg/#planSvg
  // bindings in renderDiagram() are unaffected.
  const elevEl = document.getElementById('elevSvg');
  const planEl = document.getElementById('planSvg');
  const noteEl = document.getElementById('enclosureNote');
  const zoneKeyEl = document.getElementById('ccZoneKey');
  const elevHTML = elevEl ? elevEl.outerHTML.replace('id="elevSvg"', 'id="reportElevSvg"') : '';
  const planHTML = planEl ? planEl.outerHTML.replace('id="planSvg"', 'id="reportPlanSvg"') : '';
  let diagBody = '<div style="display:flex; gap:16px; flex-wrap:wrap;">' +
    '<div style="flex:1; min-width:240px;"><div class="muted" style="font-size:.8rem; font-weight:600; margin-bottom:4px;">Elevation</div>' + elevHTML + '</div>' +
    '<div style="flex:1; min-width:240px;"><div class="muted" style="font-size:.8rem; font-weight:600; margin-bottom:4px;">Plan (roof / footprint)</div>' + planHTML + '</div></div>';
  if (noteEl && noteEl.innerHTML) diagBody += '<p class="muted" style="margin-top:10px;">' + noteEl.innerHTML + '</p>';
  if (zoneKeyEl && zoneKeyEl.innerHTML) diagBody += '<p class="muted" style="font-size:.8rem;">' + zoneKeyEl.innerHTML + '</p>';
  html += section('Building Geometry &amp; Pressure Zones', 'Figs. 28.3-1/30.3-1/30.3-2A&ndash;G, Notation', diagBody);

  if (s.mode === 'mwfrs') {
    if (s.mwfrsProcedure === 'directional') {
      html += section('MWFRS Design Pressures &mdash; Directional Procedure (Ch.27)',
        'Eq. 27.3-1, Fig. 27.3-1, Sec. 27.3.1', reportCh27HTML(r));
    } else {
      html += section('MWFRS Design Pressures &mdash; Envelope Procedure (Ch.28)',
        'Eq. 28.3-1, Figs. 28.3-1/28.3-2', reportMWFRSHTML(r));
    }
  } else {
    if (s.ccProcedure === 'part2') {
      html += section('C&amp;C Design Pressures &mdash; Ch.30 Part 2 (h &gt; 60 ft)',
        'Eq. 30.4-1, Fig. 30.4-1, Sec. 30.4', reportCC30P2HTML(r));
    } else {
      html += section('C&amp;C Design Pressures &mdash; Ch.30 Part 1 (Low-Rise, h &le; 60 ft)',
        'Eq. 30.3-1, Figs. 30.3-1/30.3-2A&ndash;2G', reportCCHTML(r));
    }
  }

  if (s.hasParapet && r.parapet) {
    html += section('Parapet Wind Pressures', 'Sec. 27.3.4/28.3.4 (MWFRS); Sec. 30.6 (C&amp;C)', reportParapetHTML(r));
  }

  if (s.hasCanopy && r.canopy) {
    html += section('Attached Canopy Wind Pressures', 'Sec. 30.9', reportCanopyHTML(r));
  }

  if (s.hasCircularTank && r.circTank) {
    html += section('Circular Bins, Silos, and Tanks &mdash; C&amp;C Pressures', 'Sec. 30.10, Eq. 30.10-1', reportCircTankHTML(r));
  }

  if (s.hasSteppedRoof && r.steppedRoof) {
    html += section('Stepped Roof &mdash; C&amp;C Pressures', 'Sec. 30.3.2.1, Fig. 30.3-3, Eq. 30.3-1', reportSteppedRoofHTML(r));
  }

  if (s.hasMultispanRoof && r.multispanRoof) {
    html += section('Multispan Gable Roof &mdash; C&amp;C Pressures', 'Fig. 30.3-4, Eq. 30.3-1', reportMultispanRoofHTML(r));
  }

  if (s.hasSawtoothRoof && r.sawtoothRoof) {
    html += section('Sawtooth Roof &mdash; C&amp;C Pressures', 'Fig. 30.3-6, Eq. 30.3-1', reportSawtoothRoofHTML(r));
  }

  if (s.hasDomeRoof && r.domeRoof) {
    html += section('Domed Roof &mdash; C&amp;C Pressures', 'Fig. 30.3-7, Eq. 30.3-1', reportDomeRoofHTML(r));
  }

  if (r.openRoof) {
    html += section('Minimum Design Wind Load Check', 'Sec. 27.1.5 (MWFRS) / Sec. 30.2.2 (C&amp;C)', reportMinCheckHTML(r));
  html += section('Open Building &mdash; Free Roof Pressures', 'Sec. 27.3.2, Eq. 27.3-2: p = q<sub>h</sub>K<sub>d</sub>GC<sub>N</sub>', reportOpenRoofHTML(r));
  }

  // No standalone "References" section: every section/row/step above already
  // carries its own inline ASCE 7-22 clause/equation/figure/table citation
  // (via the section-header <span class="ref">, the per-row "Reference"
  // column in reportInputDataHTML, and the per-step "Reference" column in
  // stepsTableHTML), so a separate end-of-report reference list would only
  // duplicate citations the reader has already seen in context.

  return '<table class="report-page"><thead><tr><th>' + buildTitleBlockHTML() +
    '</th></tr></thead><tbody><tr><td>' + html + '</td></tr></tbody></table>';
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
  // Zone dimension "a" (Notation, Figs. 28.3-1/30.3-1/30.3-2), as a fraction of the least
  // horizontal dimension, used to size the C&C corner/edge zone overlays below.
  const minDimFt = Math.max(state.minDim, 0.001);
  const aFt = r.a || 0;
  const aRatio = aFt / minDimFt;

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

  // C&C wall zones (Figure 30.3-1): Zone 5 = corner strips of width "a" at each end of the
  // wall, Zone 4 = the field/interior of the wall between them.
  if (state.mode === 'cc') {
    const wallW = wallR - wallL;
    const aElevPx = Math.min(40, Math.max(4, aRatio * wallW));
    if (2 * aElevPx < wallW) {
      elevSvg += `<rect x="${wallL}" y="${eaveY}" width="${aElevPx}" height="${groundY - eaveY}" fill="var(--accent)" fill-opacity="0.28"/>`;
      elevSvg += `<rect x="${wallR - aElevPx}" y="${eaveY}" width="${aElevPx}" height="${groundY - eaveY}" fill="var(--accent)" fill-opacity="0.28"/>`;
      elevSvg += `<text x="${wallL + aElevPx / 2}" y="${(eaveY + groundY) / 2}" font-size="9" fill="var(--ink)" text-anchor="middle" dominant-baseline="middle">5</text>`;
      elevSvg += `<text x="${wallR - aElevPx / 2}" y="${(eaveY + groundY) / 2}" font-size="9" fill="var(--ink)" text-anchor="middle" dominant-baseline="middle">5</text>`;
      elevSvg += `<text x="${midX}" y="${(eaveY + groundY) / 2}" font-size="9" fill="var(--ink)" text-anchor="middle" dominant-baseline="middle">4</text>`;
    }
  }

  elev.innerHTML = elevSvg;

  // ---- Plan -------------------------------------------------------------
  const px0 = 40, py0 = 40, pw = 200, ph = 120;
  const aPx = Math.min(60, Math.max(6, aRatio * pw));

  let planSvg = '';
  planSvg += `<rect x="${px0}" y="${py0}" width="${pw}" height="${ph}" fill="var(--brand-light)" stroke="var(--brand)" stroke-width="1.5"/>`;

  // C&C roof zones (Figs. 30.3-1/30.3-2A-G "picture frame" pattern): Zone 3 = corner
  // squares (a x a), Zone 2 = edge strips (width a, excluding corners), Zone 1 = interior.
  if (state.mode === 'cc' && pw - 2 * aPx > 0 && ph - 2 * aPx > 0) {
    const corners = [
      [px0, py0], [px0 + pw - aPx, py0], [px0, py0 + ph - aPx], [px0 + pw - aPx, py0 + ph - aPx]
    ];
    corners.forEach(([cx, cy]) => {
      planSvg += `<rect x="${cx}" y="${cy}" width="${aPx}" height="${aPx}" fill="var(--accent)" fill-opacity="0.32"/>`;
    });
    planSvg += `<rect x="${px0 + aPx}" y="${py0}" width="${pw - 2 * aPx}" height="${aPx}" fill="var(--accent)" fill-opacity="0.16"/>`;
    planSvg += `<rect x="${px0 + aPx}" y="${py0 + ph - aPx}" width="${pw - 2 * aPx}" height="${aPx}" fill="var(--accent)" fill-opacity="0.16"/>`;
    planSvg += `<rect x="${px0}" y="${py0 + aPx}" width="${aPx}" height="${ph - 2 * aPx}" fill="var(--accent)" fill-opacity="0.16"/>`;
    planSvg += `<rect x="${px0 + pw - aPx}" y="${py0 + aPx}" width="${aPx}" height="${ph - 2 * aPx}" fill="var(--accent)" fill-opacity="0.16"/>`;
    planSvg += `<rect x="${px0 + aPx}" y="${py0 + aPx}" width="${pw - 2 * aPx}" height="${ph - 2 * aPx}" fill="var(--brand)" fill-opacity="0.06"/>`;
    planSvg += `<text x="${px0 + aPx / 2}" y="${py0 + aPx / 2}" font-size="9" fill="var(--ink)" text-anchor="middle" dominant-baseline="middle">3</text>`;
    planSvg += `<text x="${px0 + pw / 2}" y="${py0 + aPx / 2}" font-size="9" fill="var(--ink)" text-anchor="middle" dominant-baseline="middle">2</text>`;
    planSvg += `<text x="${px0 + pw / 2}" y="${py0 + ph / 2}" font-size="11" fill="var(--ink)" text-anchor="middle" dominant-baseline="middle">1</text>`;
  }

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
      ' — (GC<sub>pi</sub>) = ±' + fmt(g ? g.pos : 0, 2) + ' (Table 26.13-1). Procedure shown: ' +
      (state.mode === 'mwfrs' ? 'MWFRS, Envelope Procedure (Ch. 28)' : 'Components & Cladding (Ch. 30)') + '.';
  }

  // ---- C&C zone key (shown only in C&C mode) -----------------------------
  const zoneKey = document.getElementById('ccZoneKey');
  if (zoneKey) {
    zoneKey.innerHTML = state.mode === 'cc'
      ? 'Shaded zones above follow the corner/edge/interior pattern of <span class="src-tag">Figs. 30.3-1 (walls) and 30.3-2A-G (roof)</span>: ' +
        '<strong>Zone 1</strong> = roof interior (field), <strong>Zone 2</strong> = roof edge strip (width a), <strong>Zone 3</strong> = roof corner (a&times;a), ' +
        '<strong>Zone 4</strong> = wall field, <strong>Zone 5</strong> = wall corner strip (width a). Pressures for each zone are in the C&amp;C table below. ' +
        'Zone 1&prime; (an additional interior subzone for flat roofs, &theta; &le; 7&deg;, per Fig. 30.3-2A) is not separately delineated here &mdash; ' +
        'see the C&amp;C table for its value and Fig. 30.3-2A for its extent.'
      : '';
  }
}


/* =====================================================================
   ZONE PRESSURE DIAGRAMS  (plan-view SVGs shown next to result tables)
   Source: ASCE 7-22 Fig. 28.3-1 (MWFRS), Figs. 30.3-1/30.3-2A (C&C).
   These are schematic plan views — consult the Standard figures for
   exact zone boundaries.
   ===================================================================== */

// Zone fill colours
/* =====================================================================
   ISO-3D ZONE DIAGRAMS — MWFRS + C&C
   Isometric 3D building view (schematic, like ASCE 7-22 Fig. 28.3-1)
   Building: L=110 (length along ridge), D=38 (depth), H=52 (wall height)
   Projection: px(x,d,z)=15+x+d*0.48  py(x,d,z)=140-z+d*0.26
   SVG viewport: 0 0 220 165
   ===================================================================== */
const ZONE_CLR = {
  '1':'#d6ecf8','1E':'#aad2ed','1T':'#d6ecf8',"1'":'#eaf5fc',
  '2':'#fde8a0','2E':'#f8cf5c','2T':'#fde8a0',
  '3':'#f9c8a4','3E':'#f0a06e','3T':'#f9c8a4',
  '4':'#c4ecb4','4E':'#96d880','4T':'#c4ecb4',
  '5':'#e2d0f2','5E':'#c4aae4','5T':'#e2d0f2',
  '6':'#e4e4cc','6E':'#cccc9e','6T':'#e4e4cc'
};

/* ── Iso helpers ─ oblique projection matching ASCE 7-22 Fig. 28.3-1 ──────────
   x = along ridge (left→right), d = depth (front→back), z = height
   px(x,d,z) = 12 + x + d*0.55      — depth goes RIGHT
   py(x,d,z) = 170 − z − d*0.35     — depth also goes UP (matching ASCE view)
   Building SVG units: L=128, D=50, H=60; R=dynamic (ridge height above eave)
   ViewBox: 0 0 260 190
   ─────────────────────────────────────────────────────────────────────────── */
function _iP(x,d,z){return (12+x+d*0.55).toFixed(1)+','+(170-z-d*0.35).toFixed(1);}
function _iPoly(pts,fill,stk,sw){
  return '<polygon points="'+pts.map(function(p){return _iP(p[0],p[1],p[2]);}).join(' ')+
    '" fill="'+fill+'" stroke="'+(stk||'#888')+'" stroke-width="'+(sw||0.9)+'"/>';
}
function _iCirc(x,d,z,txt,fill){
  var cx=(12+x+d*0.55).toFixed(1),cy=(170-z-d*0.35).toFixed(1);
  var big=txt.length>2;
  return '<circle cx="'+cx+'" cy="'+cy+'" r="'+(big?6.5:7.5)+'" fill="'+(fill||'#fff')+
    '" stroke="#444" stroke-width="1"/>'+
    '<text x="'+cx+'" y="'+cy+'" font-size="'+(big?'6.5':'8.5')+'" fill="#222"'+
    ' text-anchor="middle" dominant-baseline="middle" font-weight="700">'+txt+'</text>';
}
function _iArrow(id,x1,y1,x2,y2){
  return '<defs><marker id="'+id+'" markerWidth="6" markerHeight="6" refX="5" refY="3"'+
    ' orient="auto"><path d="M0,0L6,3L0,6Z" fill="#222"/></marker></defs>'+
    '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+
    '" stroke="#222" stroke-width="2" marker-end="url(#'+id+')"/>';
}
function _iOpen(h){
  h=h||190;
  return '<svg viewBox="0 0 260 '+h+'" xmlns="http://www.w3.org/2000/svg"'+
    ' style="width:100%;display:block" aria-hidden="true">';
}
// Compact pressure table appended inside SVG below the building (y starts at yOff)
// zones: array of {zone, p:{min,max}} or {zone, p:{min,max}} from mwfrsLC* or cc*
function _iPressTable(zones, yOff, cols){
  // cols: number of columns to split zones into (1 or 2)
  cols=cols||1;
  var u=' '+pUnit();
  var fp=function(v){if(v==null)return '–'; return (v>=0?'+':'')+fmt(pVal(v),1);};
  var s='';
  // separator line
  s+='<line x1="4" y1="'+yOff+'" x2="256" y2="'+yOff+'" stroke="#ccc" stroke-width="0.8"/>';
  yOff+=5;
  // column layout
  var n=zones.length;
  var perCol=Math.ceil(n/cols);
  var colW=Math.floor(248/cols);
  for(var c=0;c<cols;c++){
    var xBase=4+c*colW;
    // column header
    s+='<text x="'+(xBase+1)+'" y="'+(yOff+3)+'" font-size="5.2" fill="#555"'+
      ' font-weight="700">Zone</text>';
    s+='<text x="'+(xBase+28)+'" y="'+(yOff+3)+'" font-size="5.2" fill="#1a5c1a"'+
      ' font-weight="700">p⁺'+u+'</text>';
    s+='<text x="'+(xBase+65)+'" y="'+(yOff+3)+'" font-size="5.2" fill="#8b2020"'+
      ' font-weight="700">p⁻'+u+'</text>';
    // header underline
    s+='<line x1="'+xBase+'" y1="'+(yOff+5.5)+'" x2="'+(xBase+colW-4)+'" y2="'+(yOff+5.5)+
      '" stroke="#ddd" stroke-width="0.6"/>';
    // rows
    var start=c*perCol;
    var end=Math.min(start+perCol,n);
    for(var i=start;i<end;i++){
      var row=zones[i];
      var ry=yOff+12+(i-start)*8;
      var bg=i%2===0?'#f8f8f8':'#fff';
      s+='<rect x="'+xBase+'" y="'+(ry-5.5)+'" width="'+(colW-4)+'" height="8"'+
        ' fill="'+bg+'" rx="1"/>';
      s+='<text x="'+(xBase+1)+'" y="'+ry+'" font-size="5.5" fill="#222">'+
        row.zone+'</text>';
      var pmax=row.p?row.p.max:null;
      var pmin=row.p?row.p.min:null;
      s+='<text x="'+(xBase+28)+'" y="'+ry+'" font-size="5.5" fill="#1a5c1a">'+
        fp(pmax)+'</text>';
      s+='<text x="'+(xBase+65)+'" y="'+ry+'" font-size="5.5" fill="#8b2020">'+
        fp(pmin)+'</text>';
    }
  }
  return s;
}
/* flat-diagram backward-compat helpers */
function _zOpen(h){return '<svg viewBox="0 0 220 '+h+'" xmlns="http://www.w3.org/2000/svg"'+
  ' style="width:100%;max-width:220px;display:block" aria-hidden="true">';}
function _zR(x,y,w,h,clr,lbl){var fs=Math.min(10,Math.max(7,Math.min(w,h)*0.38));
  return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+clr+'" stroke="#bbb"'+
    ' stroke-width="0.5" rx="1"/><text x="'+(x+w/2)+'" y="'+(y+h/2)+'" font-size="'+fs+
    '" fill="#333" text-anchor="middle" dominant-baseline="middle" font-weight="700">'+lbl+'</text>';}
function _zArrow(id,x1,y1,x2,y2){return '<defs><marker id="'+id+'" markerWidth="6"'+
  ' markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6Z"'+
  ' fill="var(--accent)"/></marker></defs><line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'"'+
  ' y2="'+y2+'" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#'+id+')"/>';}

// ── MWFRS LC1: wind ⊥ ridge, from FRONT ─────────────────────────────────────
// Zone 1/1E = windward wall (front face, d=0)     WINDWARD
// Zone 2/2E = windward roof slope (d=0→D/2)
// Zone 3/3E = leeward roof slope  (d=D/2→D)      LEEWARD
// Zone 4/4E = leeward wall (back, not visible) + end walls (x=0, x=L)
function svgMWFRSLC1(r) {
  var C=ZONE_CLR, L=128, D=50, H=60;
  var aR=Math.min(0.28,Math.max(0.08,(r.a||0)/Math.max(state.minDim,1)));
  var az=Math.max(10,Math.min(28,Math.round(aR*L)));
  var R=Math.max(8,Math.min(30,Math.round(state.theta*0.8+8)));
  // B2: Build zone pressure lookup
  var zP1={}; if(r&&r.mwfrsLC1) r.mwfrsLC1.forEach(function(z){zP1[z.zone]=z.p;});
  var s=_iOpen(240);
  // ── painter's order: back faces first ──────────────────────────────────
  // Leeward slope (Zone 3/3E): d = D/2 → D
  s+=_iPoly([[0,D/2,H+R],[az,D/2,H+R],[az,D,H],[0,D,H]],C['3E'],'#999',0.8);
  s+=_iPoly([[az,D/2,H+R],[L-az,D/2,H+R],[L-az,D,H],[az,D,H]],C['3'],'#999',0.8);
  s+=_iPoly([[L-az,D/2,H+R],[L,D/2,H+R],[L,D,H],[L-az,D,H]],C['3E'],'#999',0.8);
  // Left gable end wall (Zone 4E): x=0, d=0→D, z=0→H (+ gable triangle)
  s+=_iPoly([[0,0,0],[0,D,0],[0,D,H],[0,D/2,H+R],[0,0,H]],C['4E'],'#777',1);
  // Right gable end wall (Zone 4E): x=L
  s+=_iPoly([[L,0,0],[L,D,0],[L,D,H],[L,D/2,H+R],[L,0,H]],C['4E'],'#888',0.8);
  // Windward slope (Zone 2/2E): d = 0 → D/2
  s+=_iPoly([[0,0,H],[az,0,H],[az,D/2,H+R],[0,D/2,H+R]],C['2E'],'#888',0.9);
  s+=_iPoly([[az,0,H],[L-az,0,H],[L-az,D/2,H+R],[az,D/2,H+R]],C['2'],'#888',0.9);
  s+=_iPoly([[L-az,0,H],[L,0,H],[L,D/2,H+R],[L-az,D/2,H+R]],C['2E'],'#888',0.9);
  // Front wall (Zone 1/1E): d=0 — WINDWARD face
  s+=_iPoly([[0,0,0],[az,0,0],[az,0,H],[0,0,H]],C['1E'],'#888',0.9);
  s+=_iPoly([[az,0,0],[L-az,0,0],[L-az,0,H],[az,0,H]],C['1'],'#888',0.9);
  s+=_iPoly([[L-az,0,0],[L,0,0],[L,0,H],[L-az,0,H]],C['1E'],'#888',0.9);
  // Ridge line
  s+='<line x1="'+_iP(0,D/2,H+R).split(',')[0]+'" y1="'+_iP(0,D/2,H+R).split(',')[1]+
    '" x2="'+_iP(L,D/2,H+R).split(',')[0]+'" y2="'+_iP(L,D/2,H+R).split(',')[1]+
    '" stroke="#555" stroke-width="1.5" stroke-dasharray="4,3"/>';
  // ── zone circle labels ──────────────────────────────────────────────────
  s+=_iCirc(7.5, 35, 35, '4E', C['4E']); // left gable interior
  s+=_iCirc(7.5, 0,  30, '1E', C['1E']); // front wall left strip
  s+=_iCirc(64,  0,  30, '1',  C['1']);  // front wall interior
  s+=_iCirc(7.5, 8,  65, '2E', C['2E']); // windward slope left
  s+=_iCirc(64,  12, 68, '2',  C['2']);  // windward slope interior
  s+=_iCirc(7.5, 35, 75, '3E', C['3E']); // leeward slope left
  s+=_iCirc(64,  38, 73, '3',  C['3']);  // leeward slope interior
  s+=_iCirc(110, 38, 73, '4',  C['4']);  // leeward slope right → leeward wall proxy
  s+=_iCirc(128, 28, 30, '4E', C['4E']); // right gable
  // ── face labels ─────────────────────────────────────────────────────────
  s+='<text x="'+_iP(64,0,8).split(',')[0]+'" y="'+_iP(64,0,8).split(',')[1]+
    '" font-size="7" fill="#444" text-anchor="middle" font-weight="600">WINDWARD</text>';
  s+='<text x="'+_iP(64,40,80).split(',')[0]+'" y="'+(_iP(64,40,80).split(',')[1]-8)+
    '" font-size="7" fill="#444" text-anchor="middle" font-weight="600">LEEWARD</text>';
  // ── wind arrows (two, pointing toward building from bottom) ─────────────
  s+=_iArrow('a1a', 76, 188, 76, 175);
  s+=_iArrow('a1b', 60, 188, 68, 177);
  s+='<text x="65" y="188" font-size="6.5" fill="#333" text-anchor="middle">ASSUMED WIND DIRECTIONS</text>';
  // ── 'a' dimension ────────────────────────────────────────────────────────
  var ax1=12, ax2=12+az, ay=183;
  s+='<line x1="'+ax1+'" y1="'+ay+'" x2="'+ax2+'" y2="'+ay+'" stroke="#555" stroke-width="1"/>';
  s+='<line x1="'+ax1+'" y1="'+(ay-3)+'" x2="'+ax1+'" y2="'+(ay+3)+'" stroke="#555" stroke-width="1"/>';
  s+='<line x1="'+ax2+'" y1="'+(ay-3)+'" x2="'+ax2+'" y2="'+(ay+3)+'" stroke="#555" stroke-width="1"/>';
  s+='<text x="'+(ax1+ax2)/2+'" y="'+(ay-3)+'" font-size="6" fill="#555" text-anchor="middle">a</text>';
  s+='<text x="200" y="188" font-size="5.5" fill="#bbb" text-anchor="middle">ASCE 7-22 Fig. 28.3-1, LC1 (schematic)</text>';
  // B2: pressure table
  var lc1rows=['1','1E','2','2E','3','3E','4','4E'].map(function(z){
    return {zone:z,p:zP1[z]||null};
  });
  s+=_iPressTable(lc1rows,192,2);
  s+='</svg>';
  return s;
}

// ── MWFRS LC2: wind ∥ ridge, from LEFT ──────────────────────────────────────
// Zone 5/5E = windward end wall (left gable, x=0)    WINDWARD
// Zone 6/6E = side walls (front d=0, back d=D)
// Zone 4/4E = leeward end wall (right gable, x=L)
// Roof zones 1, 2 by distance from eave/ridge
function svgMWFRSLC2(r) {
  var C=ZONE_CLR, L=128, D=50, H=60;
  var aR=Math.min(0.28,Math.max(0.08,(r.a||0)/Math.max(state.minDim,1)));
  var az=Math.max(10,Math.min(28,Math.round(aR*L)));   // along length
  var adD=Math.max(8,Math.min(18,Math.round(aR*D)));   // along depth
  var R=Math.max(8,Math.min(30,Math.round(state.theta*0.8+8)));
  var zP2={}; if(r&&r.mwfrsLC2) r.mwfrsLC2.forEach(function(z){zP2[z.zone]=z.p;});
  var s=_iOpen(250);
  // ── painter's order: back faces first ──────────────────────────────────
  // Leeward slope (Zone 2 interior — from windward end to far)
  s+=_iPoly([[0,D/2,H+R],[L,D/2,H+R],[L,D,H],[0,D,H]],C['2'],'#999',0.8);
  // Right gable end wall (Zone 4 — leeward end)
  s+=_iPoly([[L,0,0],[L,D,0],[L,D,H],[L,D/2,H+R],[L,0,H]],C['4'],'#888',0.8);
  // Windward slope: Zone 2 near windward end (x=0..az), Zone 1 interior
  s+=_iPoly([[0,0,H],[az,0,H],[az,D/2,H+R],[0,D/2,H+R]],C['2'],'#888',0.9);
  s+=_iPoly([[az,0,H],[L,0,H],[L,D/2,H+R],[az,D/2,H+R]],C['1'],'#888',0.9);
  // Front wall (side wall): Zone 6E near windward end (x=0..az), Zone 6 interior
  s+=_iPoly([[0,0,0],[az,0,0],[az,0,H],[0,0,H]],C['6E'],'#888',0.9);
  s+=_iPoly([[az,0,0],[L,0,0],[L,0,H],[az,0,H]],C['6'],'#888',0.9);
  // Left gable end wall (Zone 5/5E — windward end): full face Zone 5, front strip Zone 5E
  s+=_iPoly([[0,0,0],[0,D,0],[0,D,H],[0,D/2,H+R],[0,0,H]],C['5'],'#777',1);
  // Zone 5E: strip near front face (d=0..adD)
  var zR5E=H+R*2*adD/D; // z at d=adD on windward slope
  s+=_iPoly([[0,0,0],[0,adD,0],[0,adD,H],[0,adD/2,zR5E],[0,0,H]],C['5E'],'#777',1);
  // Ridge line
  s+='<line x1="'+_iP(0,D/2,H+R).split(',')[0]+'" y1="'+_iP(0,D/2,H+R).split(',')[1]+
    '" x2="'+_iP(L,D/2,H+R).split(',')[0]+'" y2="'+_iP(L,D/2,H+R).split(',')[1]+
    '" stroke="#555" stroke-width="1.5" stroke-dasharray="4,3"/>';
  // ── zone labels ─────────────────────────────────────────────────────────
  s+=_iCirc(0,   5,  50, '5E', C['5E']); // left end wall front strip (high)
  s+=_iCirc(0,   35, 35, '5',  C['5']);  // left end wall interior
  s+=_iCirc(7.5, 0,  30, '6E', C['6E']); // front wall near windward end
  s+=_iCirc(75,  0,  30, '6',  C['6']);  // front wall interior
  s+=_iCirc(75,  12, 68, '1',  C['1']);  // windward slope interior
  s+=_iCirc(75,  38, 73, '2',  C['2']);  // leeward slope interior
  s+=_iCirc(128, 28, 30, '4',  C['4']);  // right end wall (leeward)
  // ── face labels ─────────────────────────────────────────────────────────
  s+='<text x="'+_iP(64,0,8).split(',')[0]+'" y="'+_iP(64,0,8).split(',')[1]+
    '" font-size="7" fill="#444" text-anchor="middle" font-weight="600">WINDWARD SIDE</text>';
  s+='<text x="'+_iP(64,40,80).split(',')[0]+'" y="'+(_iP(64,40,80).split(',')[1]-8)+
    '" font-size="7" fill="#444" text-anchor="middle" font-weight="600">LEEWARD</text>';
  s+='<text x="14" y="157" font-size="6" fill="#555" text-anchor="start" font-weight="600">WINDWARD</text>';
  s+='<text x="14" y="164" font-size="6" fill="#555" text-anchor="start" font-weight="600">END WALL</text>';
  // ── wind arrows (from left, parallel to ridge) ───────────────────────────
  s+=_iArrow('a2a', 8, 188, 16, 175);
  s+=_iArrow('a2b', 20, 185, 20, 172);
  s+='<text x="22" y="188" font-size="6.5" fill="#333" text-anchor="start">ASSUMED WIND DIRECTIONS</text>';
  s+='<text x="200" y="188" font-size="5.5" fill="#bbb" text-anchor="middle">ASCE 7-22 Fig. 28.3-1, LC2 (schematic)</text>';
  var lc2rows=['1','1E','2','2E','3','3E','4','4E','5','5E','6','6E'].map(function(z){
    return {zone:z,p:zP2[z]||null};
  });
  s+=_iPressTable(lc2rows,192,3);
  s+='</svg>';
  return s;
}

// ── MWFRS LC3: torsional transverse ─────────────────────────────────────────
// Same as LC1 direction but with torsional offset. T-zones on half-building.
function svgMWFRSLC3(r) {
  var C=ZONE_CLR, L=128, D=50, H=60;
  var R=Math.max(8,Math.min(30,Math.round(state.theta*0.8+8)));
  var g='#ebebea', gs='#ddd';
  var zP3={}; if(r&&r.mwfrsLC3) r.mwfrsLC3.forEach(function(z){zP3[z.zone]=z.p;});
  var s=_iOpen(230);
  // full building neutral
  s+=_iPoly([[0,D/2,H+R],[L,D/2,H+R],[L,D,H],[0,D,H]],g,'#bbb',0.7);
  s+=_iPoly([[0,0,0],[0,D,0],[0,D,H],[0,D/2,H+R],[0,0,H]],gs,'#aaa',0.8);
  s+=_iPoly([[L,0,0],[L,D,0],[L,D,H],[L,D/2,H+R],[L,0,H]],gs,'#aaa',0.7);
  s+=_iPoly([[0,0,H],[L,0,H],[L,D/2,H+R],[0,D/2,H+R]],'#f0f0ec','#bbb',0.8);
  s+=_iPoly([[0,0,0],[L,0,0],[L,0,H],[0,0,H]],'#f4f4f0','#bbb',0.8);
  // T-zones on right half (offset load)
  s+=_iPoly([[L/2,0,H],[L,0,H],[L,D/2,H+R],[L/2,D/2,H+R]],C['1T'],'#888',0.9);
  s+=_iPoly([[0,D/2,H+R],[L/2,D/2,H+R],[L/2,D,H],[0,D,H]],C['2T'],'#999',0.8);
  s+=_iPoly([[L/2,0,0],[L,0,0],[L,0,H],[L/2,0,H]],C['3T'],'#888',0.9);
  // labels
  // Zone 4T — right end wall (torsional end zone)
  s+=_iPoly([[L,0,0],[L,D,0],[L,D,H],[L,D/2,H+R],[L,0,H]],C['4T'],'#888',0.9);
  s+=_iCirc(L*0.75, D*0.25, H+R*0.6, '1T', C['1T']);
  s+=_iCirc(L*0.25, D*0.75, H+R*0.4, '2T', C['2T']);
  s+=_iCirc(L*0.75, 0, H*0.5, '3T', C['3T']);
  s+=_iCirc(L, D*0.5, H*0.5, '4T', C['4T']);
  // wind arrows
  s+=_iArrow('a3a', 76, 188, 76, 175);
  s+=_iArrow('a3b', 60, 188, 68, 177);
  s+='<text x="65" y="188" font-size="6.5" fill="#333" text-anchor="middle">ASSUMED WIND DIRECTIONS</text>';
  s+='<text x="200" y="183" font-size="6" fill="#bbb" text-anchor="middle">ASCE 7-22 Fig. 28.3-1, LC3 — torsional (schematic)</text>';
  s+='<text x="200" y="189" font-size="5.5" fill="#ccc" text-anchor="middle">Reduced uniform load + T-zone offset</text>';
  // B2: pressure table for LC3 T-zones
  var lc3rows=['1T','2T','3T','4T'].map(function(z){
    return {zone:z,p:zP3[z]||null};
  });
  s+=_iPressTable(lc3rows,192,2);
  s+='</svg>';
  return s;
}

// ── MWFRS LC4: torsional longitudinal ───────────────────────────────────────
function svgMWFRSLC4(r) {
  var C=ZONE_CLR, L=128, D=50, H=60;
  var R=Math.max(8,Math.min(30,Math.round(state.theta*0.8+8)));
  var g='#ebebea', gs='#ddd';
  var zP4={}; if(r&&r.mwfrsLC4) r.mwfrsLC4.forEach(function(z){zP4[z.zone]=z.p;});
  var s=_iOpen(230);
  // full building neutral
  s+=_iPoly([[0,D/2,H+R],[L,D/2,H+R],[L,D,H],[0,D,H]],g,'#bbb',0.7);
  s+=_iPoly([[L,0,0],[L,D,0],[L,D,H],[L,D/2,H+R],[L,0,H]],gs,'#aaa',0.7);
  s+=_iPoly([[0,0,H],[L,0,H],[L,D/2,H+R],[0,D/2,H+R]],'#f0f0ec','#bbb',0.8);
  s+=_iPoly([[0,0,0],[L,0,0],[L,0,H],[0,0,H]],'#f4f4f0','#bbb',0.8);
  s+=_iPoly([[0,0,0],[0,D,0],[0,D,H],[0,D/2,H+R],[0,0,H]],gs,'#aaa',0.8);
  // T-zones on left end (windward end with torsional offset)
  // LC4 T-zones: 5T = windward half, 6T = leeward half (Fig. 28.3-2)
  s+=_iPoly([[0,0,H],[L/2,0,H],[L/2,D/2,H+R],[0,D/2,H+R]],C['5T'],'#888',0.9);
  s+=_iPoly([[L/2,D/2,H+R],[L,D/2,H+R],[L,D,H],[L/2,D,H]],C['6T'],'#999',0.8);
  s+=_iPoly([[0,0,0],[L/2,0,0],[L/2,0,H],[0,0,H]],C['5T'],'#888',0.9);
  s+=_iPoly([[L/2,0,0],[L,0,0],[L,0,H],[L/2,0,H]],C['6T'],'#999',0.8);
  // labels
  s+=_iCirc(L*0.25, D*0.25, H+R*0.6, '5T', C['5T']);
  s+=_iCirc(L*0.75, D*0.75, H+R*0.4, '6T', C['6T']);
  // wind arrows
  s+=_iArrow('a4a', 8, 188, 16, 175);
  s+=_iArrow('a4b', 20, 185, 20, 172);
  s+='<text x="22" y="188" font-size="6.5" fill="#333" text-anchor="start">ASSUMED WIND DIRECTIONS</text>';
  s+='<text x="200" y="183" font-size="6" fill="#bbb" text-anchor="middle">ASCE 7-22 Fig. 28.3-1, LC4 — torsional (schematic)</text>';
  s+='<text x="200" y="189" font-size="5.5" fill="#ccc" text-anchor="middle">Reduced uniform load + T-zone offset</text>';
  // B2: pressure table for LC4 T-zones
  var lc4rows=['5T','6T'].map(function(z){
    return {zone:z,p:zP4[z]||null};
  });
  s+=_iPressTable(lc4rows,192,1);
  s+='</svg>';
  return s;
}

// ── C&C Combined: wall zones 4/5 + roof zones ────────────────────────────────
function svgCCCombined(r) {
  var C=ZONE_CLR, L=128, D=50, H=60;
  var aR=Math.min(0.30,Math.max(0.08,(r.a||0)/Math.max(state.minDim,1)));
  var az=Math.max(10,Math.min(26,Math.round(aR*L)));
  var adD=Math.max(8,Math.min(16,Math.round(aR*D)));
  var isFlat=state.theta<=7;
  var R=isFlat?2:Math.max(8,Math.min(30,Math.round(state.theta*0.7+8)));
  var dMid=D/2*0.45; // boundary between Zone 2 and Zone 1 on windward slope
  var zPW={}; if(r&&r.ccWall) r.ccWall.forEach(function(z){zPW[z.zone]=z.p;});
  var zPR={}; if(r&&r.ccRoof) r.ccRoof.forEach(function(z){zPR[z.zone]=z.p;});
  var s=_iOpen(240);
  // ── painter's order: back faces first ──────────────────────────────────
  if (!isFlat) {
    // Leeward slope: Zone 2
    s+=_iPoly([[0,D/2,H+R],[L,D/2,H+R],[L,D,H],[0,D,H]],C['2'],'#999',0.8);
  } else {
    // Flat roof back strip: Zone 1'
    s+=_iPoly([[0,D-adD,H],[L,D-adD,H],[L,D,H],[0,D,H]],C["1'"],'#999',0.8);
  }
  // Left gable: front strip Zone 5, interior Zone 4
  s+=_iPoly([[0,0,0],[0,D,0],[0,D,H],[0,D/2,H+R],[0,0,H]],C['4'],'#777',0.9);
  var zR5=H+R*2*adD/D;
  s+=_iPoly([[0,0,0],[0,adD,0],[0,adD,H],[0,adD/2,zR5],[0,0,H]],C['5'],'#777',1);
  // Right gable: Zone 4
  s+=_iPoly([[L,0,0],[L,D,0],[L,D,H],[L,D/2,H+R],[L,0,H]],C['4'],'#888',0.7);
  // Windward slope / flat roof zones
  if (!isFlat) {
    // Zone 3 eave strips, Zone 2 lower middle, Zone 1 upper (near ridge)
    s+=_iPoly([[0,0,H],[az,0,H],[az,dMid,H+R*2*dMid/D],[0,dMid,H+R*2*dMid/D]],C['3'],'#888',0.8);
    s+=_iPoly([[L-az,0,H],[L,0,H],[L,dMid,H+R*2*dMid/D],[L-az,dMid,H+R*2*dMid/D]],C['3'],'#888',0.8);
    s+=_iPoly([[az,0,H],[L-az,0,H],[L-az,dMid,H+R*2*dMid/D],[az,dMid,H+R*2*dMid/D]],C['2'],'#888',0.8);
    s+=_iPoly([[0,dMid,H+R*2*dMid/D],[az,dMid,H+R*2*dMid/D],[az,D/2,H+R],[0,D/2,H+R]],C['3'],'#888',0.8);
    s+=_iPoly([[L-az,dMid,H+R*2*dMid/D],[L,dMid,H+R*2*dMid/D],[L,D/2,H+R],[L-az,D/2,H+R]],C['3'],'#888',0.8);
    s+=_iPoly([[az,dMid,H+R*2*dMid/D],[L-az,dMid,H+R*2*dMid/D],[L-az,D/2,H+R],[az,D/2,H+R]],C['1'],'#888',0.8);
  } else {
    s+=_iPoly([[0,0,H],[az,0,H],[az,adD,H],[0,adD,H]],C['3'],'#888',0.8);
    s+=_iPoly([[L-az,0,H],[L,0,H],[L,adD,H],[L-az,adD,H]],C['3'],'#888',0.8);
    s+=_iPoly([[az,0,H],[L-az,0,H],[L-az,adD,H],[az,adD,H]],C['2'],'#888',0.8);
    s+=_iPoly([[0,adD,H],[az,adD,H],[az,D-adD,H],[0,D-adD,H]],C['2'],'#888',0.8);
    s+=_iPoly([[L-az,adD,H],[L,adD,H],[L,D-adD,H],[L-az,D-adD,H]],C['2'],'#888',0.8);
    s+=_iPoly([[az,adD,H],[L-az,adD,H],[L-az,D-adD,H],[az,D-adD,H]],C['1'],'#888',0.8);
  }
  // Front wall: Zone 5 corners, Zone 4 interior
  s+=_iPoly([[0,0,0],[az,0,0],[az,0,H],[0,0,H]],C['5'],'#888',0.9);
  s+=_iPoly([[az,0,0],[L-az,0,0],[L-az,0,H],[az,0,H]],C['4'],'#888',0.9);
  s+=_iPoly([[L-az,0,0],[L,0,0],[L,0,H],[L-az,0,H]],C['5'],'#888',0.9);
  // Ridge line
  s+='<line x1="'+_iP(0,D/2,H+R).split(',')[0]+'" y1="'+_iP(0,D/2,H+R).split(',')[1]+
    '" x2="'+_iP(L,D/2,H+R).split(',')[0]+'" y2="'+_iP(L,D/2,H+R).split(',')[1]+
    '" stroke="#555" stroke-width="1.5" stroke-dasharray="4,3"/>';
  // ── zone labels ─────────────────────────────────────────────────────────
  s+=_iCirc(7.5,  0,  30, '5',  C['5']);  // front wall left corner
  s+=_iCirc(64,   0,  30, '4',  C['4']);  // front wall interior
  s+=_iCirc(0,    5,  50, '5',  C['5']);  // left end wall front strip
  s+=_iCirc(0,    35, 35, '4',  C['4']);  // left end wall interior
  if (!isFlat) {
    s+=_iCirc(7.5, 8,  65, '3', C['3']); // windward slope eave strip
    s+=_iCirc(64,  12, 68, '2', C['2']); // windward slope middle
    s+=_iCirc(64,  D*0.42, H+R*0.88, '1', C['1']); // windward slope near ridge
    s+=_iCirc(64,  38, 73, '2', C['2']); // leeward slope
  } else {
    s+=_iCirc(7.5, 6, H, '3', C['3']);
    s+=_iCirc(64,  6, H, '2', C['2']);
    s+=_iCirc(64, D*0.5, H, '1', C['1']);
    s+=_iCirc(64, D-6, H, "1'", C["1'"]);
  }
  // a-dim
  var ax1=12, ax2=12+az, ay=183;
  s+='<line x1="'+ax1+'" y1="'+ay+'" x2="'+ax2+'" y2="'+ay+'" stroke="#555" stroke-width="1"/>';
  s+='<line x1="'+ax1+'" y1="'+(ay-3)+'" x2="'+ax1+'" y2="'+(ay+3)+'" stroke="#555" stroke-width="1"/>';
  s+='<line x1="'+ax2+'" y1="'+(ay-3)+'" x2="'+ax2+'" y2="'+(ay+3)+'" stroke="#555" stroke-width="1"/>';
  s+='<text x="'+(ax1+ax2)/2+'" y="'+(ay-3)+'" font-size="6" fill="#555" text-anchor="middle">a</text>';
  var fig2=isFlat?'30.3-2A':'30.3-2B/2C';
  s+='<text x="200" y="188" font-size="5.5" fill="#bbb" text-anchor="middle">'+
    'ASCE 7-22 Figs. 30.3-1 &amp; '+fig2+' (schematic)</text>';
  // B2: CC pressure table — walls then roof
  var ccRows=[
    {zone:'4',p:zPW['4']||null},{zone:'5',p:zPW['5']||null},
    {zone:'1',p:zPR['1']||null},{zone:'2',p:zPR['2']||null},
    {zone:'3',p:zPR['3']||null}
  ];
  if(zPR["1'"]){ccRows.splice(2,0,{zone:"1'",p:zPR["1'"]});}
  s+=_iPressTable(ccRows,192,2);
  s+='</svg>';
  return s;
}


function renderCCCombined(r) {
  var el = document.getElementById('ccCombinedTable');
  if (!el) return;
  var pU = pUnit();
  var isFlat = state.theta <= 7;
  var roofRef = isFlat ? 'Fig. 30.3-2A, θ ≤ 7°' :
    (state.roofShape === 'hip' ? 'Figs. 30.3-2D–G, θ > 7°' : 'Figs. 30.3-2B/2C, θ > 7°');
  var html = '<table>';
  html += '<thead><tr><th>Zone</th><th>(GC<sub>p</sub>) range</th>';
  html += '<th>p<sub>min</sub> suction, ' + pU + '</th><th>p<sub>max</sub> positive, ' + pU + '</th></tr></thead>';
  html += '<tbody>';
  html += '<tr><td colspan="4" class="cc-section-header">Walls — Zones 4 &amp; 5  <span class="ref">Fig. 30.3-1</span></td></tr>';
  (r.ccWall||[]).forEach(function(row) {
    var gcStr = fmt(row.gcp.neg,2) + ' to ' + fmt(row.gcp.pos,2);
    html += '<tr><td>'+(ZONE_LABELS[row.zone]||row.zone)+'</td><td>'+gcStr+'</td>'+
      '<td>'+fmt(pVal(row.p.min),2)+'</td><td>'+fmt(pVal(row.p.max),2)+'</td></tr>';
  });
  html += '<tr><td colspan="4" class="cc-section-header">Roof — Zones ' +
    (isFlat ? '1&prime;, 1, 2, 3' : '1, 2, 3') +
    '  <span class="ref">' + roofRef + '</span></td></tr>';
  (r.ccRoof||[]).forEach(function(row) {
    var gcStr = fmt(row.gcp.neg,2) + ' to ' + fmt(row.gcp.pos,2);
    html += '<tr><td>'+(ZONE_LABELS[row.zone]||row.zone)+'</td><td>'+gcStr+'</td>'+
      '<td>'+fmt(pVal(row.p.min),2)+'</td><td>'+fmt(pVal(row.p.max),2)+'</td></tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
  var roofNote = document.getElementById('ccRoofNote');
  if (roofNote) {
    if (state.theta > 7 && r.roofCapped) {
      roofNote.style.display = '';
      roofNote.textContent = (state.roofShape === 'hip')
        ? 'Roof angle θ > 45°: Figures 30.3-2D–G (hip) do not extend past θ = 45°. The θ = 45° coefficients are used as a capping value per engineering judgment.'
        : 'Roof angle θ > 45°: Figure 30.3-2B/2C is capped at θ = 45° per engineering judgment.';
    } else { roofNote.style.display = 'none'; }
  }
}

function renderZoneDiagrams(r) {
  const set = (id, html) => { const el=document.getElementById(id); if(el) el.innerHTML=html; };
  if (state.mode === 'mwfrs' && state.mwfrsProcedure !== 'directional') {
    set('mwfrsLC1Diag', svgMWFRSLC1(r));
    set('mwfrsLC2Diag', svgMWFRSLC2(r));
    set('mwfrsLC3Diag', svgMWFRSLC3(r));
    set('mwfrsLC4Diag', svgMWFRSLC4(r));
  }
  if (state.mode === 'cc') {
    set('ccCombinedDiag', svgCCCombined(r));
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
  // K_zt mode selector (Sec. 26.8)
  document.getElementById('kztModeSeg').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('kztModeSeg').querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kztMode = btn.dataset.val;
      document.getElementById('kztAutoInputs').style.display = state.kztMode === 'auto' ? '' : 'none';
      document.getElementById('kztManualInput').style.display = state.kztMode === 'manual' ? '' : 'none';
      renderResults();
    });
  });
  const kztEl = document.getElementById('kzt');
  if (kztEl) kztEl.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.kzt = isNaN(v) ? 1.0 : v;
    renderResults();
  });
  const topoFeatureEl = document.getElementById('topoFeature');
  if (topoFeatureEl) topoFeatureEl.addEventListener('change', e => { state.topoFeature = e.target.value; renderResults(); });
  ['topoH', 'topoLh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state[id] = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  });
  const topoXEl = document.getElementById('topoX');
  if (topoXEl) topoXEl.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    // topoX is a signed distance — convert magnitude but preserve sign
    state.topoX = (isNaN(v) ? 0 : (v < 0 ? -1 : 1)) * toUSLength(Math.abs(isNaN(v) ? 0 : v), state.unitSystem);
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
  // Ch.27 building length parallel to wind (L/B for leeward Cp)
  const buildingLEl = document.getElementById('buildingL');
  if (buildingLEl) {
    buildingLEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.buildingL = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  // Ch.27 / Ch.28 procedure toggle
  const ccProcSeg2 = document.getElementById('ccProcedureSeg');
  if (ccProcSeg2) {
    ccProcSeg2.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        ccProcSeg2.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.ccProcedure = btn.dataset.val;
        renderResults();
      });
    });
  }
  const mwfrsProcSeg = document.getElementById('mwfrsProcedureSeg');
  if (mwfrsProcSeg) {
    mwfrsProcSeg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        mwfrsProcSeg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mwfrsProcedure = btn.dataset.val;
        renderResults();
      });
    });
  }
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
  // A2: 3-button procedure selector (replaces old 2-button MWFRS / C&C)
  const procEnvEl = document.getElementById('procEnvelope');
  const procDirEl = document.getElementById('procDirectional');
  const procCCEl  = document.getElementById('procCC');
  if (procEnvEl) procEnvEl.addEventListener('click', () => {
    state.mode = 'mwfrs'; state.mwfrsProcedure = 'envelope';
    applyModeVisibility(); renderResults();
  });
  if (procDirEl) procDirEl.addEventListener('click', () => {
    state.mode = 'mwfrs'; state.mwfrsProcedure = 'directional';
    applyModeVisibility(); renderResults();
  });
  if (procCCEl)  procCCEl.addEventListener('click', () => {
    state.mode = 'cc';
    applyModeVisibility(); renderResults();
  });

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

  // Parapets (Sec. 27.3.4/28.3.4 MWFRS + Sec. 30.6 C&C) toggle + height
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

  // Attached Canopies (Sec. 30.9) toggle + geometry
  const hasCanopyEl = document.getElementById('hasCanopy');
  if (hasCanopyEl) {
    hasCanopyEl.addEventListener('change', e => {
      state.hasCanopy = e.target.checked;
      renderResults();
    });
  }
  const canopyAreaEl = document.getElementById('canopyArea');
  if (canopyAreaEl) {
    canopyAreaEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.canopyArea = toUSArea(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const canopyHcEl = document.getElementById('canopyHc');
  if (canopyHcEl) {
    canopyHcEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.canopyHc = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const canopyHeEl = document.getElementById('canopyHe');
  if (canopyHeEl) {
    canopyHeEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.canopyHe = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }

  // Circular Bins, Silos, and Tanks (Sec. 30.10) toggle + geometry
  const hasCircularTankEl = document.getElementById('hasCircularTank');
  if (hasCircularTankEl) {
    hasCircularTankEl.addEventListener('change', e => {
      state.hasCircularTank = e.target.checked;
      renderResults();
    });
  }
  const tankDEl = document.getElementById('tankD');
  if (tankDEl) {
    tankDEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.tankD = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const tankHEl = document.getElementById('tankH');
  if (tankHEl) {
    tankHEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.tankH = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const tankOpenTopEl = document.getElementById('tankOpenTop');
  if (tankOpenTopEl) {
    tankOpenTopEl.addEventListener('change', e => {
      state.tankOpenTop = e.target.checked;
      renderResults();
    });
  }
  const tankElevatedEl = document.getElementById('tankElevated');
  if (tankElevatedEl) {
    tankElevatedEl.addEventListener('change', e => {
      state.tankElevated = e.target.checked;
      renderResults();
    });
  }

  // Stepped Roofs (Sec. 30.3.2.1, Fig. 30.3-3) toggle + lower-level geometry
  const hasSteppedRoofEl = document.getElementById('hasSteppedRoof');
  if (hasSteppedRoofEl) {
    hasSteppedRoofEl.addEventListener('change', e => {
      state.hasSteppedRoof = e.target.checked;
      renderResults();
    });
  }
  const steppedLowerHEl = document.getElementById('steppedLowerH');
  if (steppedLowerHEl) {
    steppedLowerHEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.steppedLowerH = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const steppedLowerWEl = document.getElementById('steppedLowerW');
  if (steppedLowerWEl) {
    steppedLowerWEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.steppedLowerW = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }

  // Multispan Gable Roofs (Fig. 30.3-4) toggle + module width
  const hasMultispanRoofEl = document.getElementById('hasMultispanRoof');
  if (hasMultispanRoofEl) {
    hasMultispanRoofEl.addEventListener('change', e => {
      state.hasMultispanRoof = e.target.checked;
      renderResults();
    });
  }
  const msModuleWEl = document.getElementById('msModuleW');
  if (msModuleWEl) {
    msModuleWEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.msModuleW = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }

  // Sawtooth Roofs (Fig. 30.3-6) toggle + module width
  const hasSawtoothRoofEl = document.getElementById('hasSawtoothRoof');
  if (hasSawtoothRoofEl) {
    hasSawtoothRoofEl.addEventListener('change', e => {
      state.hasSawtoothRoof = e.target.checked;
      renderResults();
    });
  }
  const swModuleWEl = document.getElementById('swModuleW');
  if (swModuleWEl) {
    swModuleWEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.swModuleW = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }

  // Domed Roofs (Fig. 30.3-7) toggle + geometry
  const hasDomeRoofEl = document.getElementById('hasDomeRoof');
  if (hasDomeRoofEl) {
    hasDomeRoofEl.addEventListener('change', e => {
      state.hasDomeRoof = e.target.checked;
      renderResults();
    });
  }
  const domeDEl = document.getElementById('domeD');
  if (domeDEl) {
    domeDEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.domeD = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const domeFEl = document.getElementById('domeF');
  if (domeFEl) {
    domeFEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.domeF = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  const domeHDEl = document.getElementById('domeHD');
  if (domeHDEl) {
    domeHDEl.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state.domeHD = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
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

  // Print title block fields (Phase 3 / report header) — informational only
  document.getElementById('companyName').addEventListener('input', e => {
    state.companyName = e.target.value;
    renderResults();
  });
  document.getElementById('sectionName').addEventListener('input', e => {
    state.sectionName = e.target.value;
    renderResults();
  });
  document.getElementById('jobRef').addEventListener('input', e => {
    state.jobRef = e.target.value;
    renderResults();
  });
  document.getElementById('chkdBy').addEventListener('input', e => {
    state.chkdBy = e.target.value;
    renderResults();
  });
  document.getElementById('chkdDate').addEventListener('input', e => {
    state.chkdDate = e.target.value;
    renderResults();
  });
  document.getElementById('appdBy').addEventListener('input', e => {
    state.appdBy = e.target.value;
    renderResults();
  });
  document.getElementById('appdDate').addEventListener('input', e => {
    state.appdDate = e.target.value;
    renderResults();
  });

  // --- Ch.29 Other Structures bindings ---
  const catBuildingBtn = document.getElementById('catBuilding');
  const catOtherBtn    = document.getElementById('catOther');
  if (catBuildingBtn) catBuildingBtn.addEventListener('click', () => {
    state.structureCategory = 'building';
    applyStructureCategoryVisibility();
    renderResults();
  });
  if (catOtherBtn) catOtherBtn.addEventListener('click', () => {
    state.structureCategory = 'otherStructure';
    applyStructureCategoryVisibility();
    renderResults();
  });

  const ch29TypeEl = document.getElementById('ch29Type');
  if (ch29TypeEl) ch29TypeEl.addEventListener('change', e => {
    state.ch29Type = e.target.value;
    // sync shared ch29H from whichever visible height field was last set
    applyStructureCategoryVisibility();
    renderResults();
  });

  // Helper to bind a numeric field → state property
  function bindCh29Len(id, stateProp) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state[stateProp] = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  function bindCh29Area(id, stateProp) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state[stateProp] = toUSArea(isNaN(v) ? 0 : v, state.unitSystem);
      renderResults();
    });
  }
  function bindCh29Num(id, stateProp) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      state[stateProp] = isNaN(v) ? 0 : v;
      renderResults();
    });
  }
  function bindCh29Sel(id, stateProp) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', e => { state[stateProp] = e.target.value; renderResults(); });
  }

  // Solid sign
  bindCh29Len('ch29B',      'ch29B');
  bindCh29Len('ch29H_sign', 'ch29H');
  bindCh29Len('ch29S',      'ch29S');
  bindCh29Area('ch29As',    'ch29As');
  // Chimney
  bindCh29Sel('ch29CrossSection', 'ch29CrossSection');
  bindCh29Len('ch29H_chim', 'ch29H');
  bindCh29Len('ch29D',      'ch29D');
  bindCh29Area('ch29Af_chim','ch29Af');
  // Open sign
  bindCh29Num('ch29Eps_open', 'ch29Eps');
  bindCh29Sel('ch29MemberType','ch29MemberType');
  bindCh29Len('ch29H_open', 'ch29H');
  bindCh29Area('ch29Af_open','ch29Af');
  // Trussed tower
  bindCh29Sel('ch29TowerShape','ch29TowerShape');
  bindCh29Num('ch29Eps_tower','ch29Eps');
  bindCh29Len('ch29H_tower','ch29H');
  bindCh29Area('ch29Af_tower','ch29Af');
  // Rooftop equip
  bindCh29Len('ch29H_roof', 'ch29H');
  bindCh29Area('ch29Af_roof','ch29Af');
  bindCh29Area('ch29Ar',    'ch29Ar');
  bindCh29Area('ch29Bh',    'ch29Bh');
  bindCh29Area('ch29BL',    'ch29BL');
  bindCh29Area('ch29CCAwall','ch29CCAwall');
  bindCh29Area('ch29CCAroof','ch29CCAroof');

  // Sec. 29.4.3 Solar Panel bindings
  var bindSolar = function(id, key, parser) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = state[key];
    el.addEventListener('change', function(e) {
      state[key] = (parser || parseFloat)(e.target.value);
      requestUpdate();
    });
  };
  bindSolar('ch29SolarOmega', 'ch29SolarOmega', parseFloat);
  bindSolar('ch29SolarLp',    'ch29SolarLp',    parseFloat);
  bindSolar('ch29SolarA',     'ch29SolarA',     parseFloat);
  bindSolar('ch29SolarH1',    'ch29SolarH1',    parseFloat);
  bindSolar('ch29SolarH2',    'ch29SolarH2',    parseFloat);
  bindSolar('ch29SolarHpt',   'ch29SolarHpt',   parseFloat);
  bindSolar('ch29SolarWL',    'ch29SolarWL',    parseFloat);
  bindSolar('ch29SolarWs',    'ch29SolarWs',    parseFloat);
  bindSolar('ch29SolarD1',    'ch29SolarD1',    parseFloat);
  bindSolar('ch29SolarD2',    'ch29SolarD2',    parseFloat);
  bindSolar('ch29SolarZone',  'ch29SolarZone',  parseInt);

  // Sec. 30.5 Open Building C&C bindings
  var bind305 = function(id, key, parser) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = state[key];
    el.addEventListener('change', function(e) {
      state[key] = (parser || parseFloat)(e.target.value);
      requestUpdate();
    });
  };
  bind305('ch305Lmin', 'ch305Lmin', parseFloat);
  bind305('ch305A',    'ch305A',    parseFloat);

  // Ch.32 Tornado Loads bindings
  var ch32EnabledEl = document.getElementById('ch32Enabled');
  if (ch32EnabledEl) {
    ch32EnabledEl.checked = state.ch32Enabled;
    ch32EnabledEl.addEventListener('change', function(e) {
      state.ch32Enabled = e.target.checked;
      document.body.classList.toggle('ch32-enabled', state.ch32Enabled);
      renderResults();
    });
  }
  var ch32VTEl = document.getElementById('ch32VT');
  if (ch32VTEl) {
    ch32VTEl.value = state.ch32VT;
    ch32VTEl.addEventListener('input', function(e) {
      var v = parseFloat(e.target.value);
      state.ch32VT = isNaN(v) ? 0 : v;
      renderResults();
    });
  }
  var ch32AeEl = document.getElementById('ch32Ae');
  if (ch32AeEl) {
    ch32AeEl.value = state.ch32Ae;
    ch32AeEl.addEventListener('input', function(e) {
      var v = parseFloat(e.target.value);
      state.ch32Ae = isNaN(v) ? 1 : v;
      renderResults();
    });
  }
  var ch32EssentialEl = document.getElementById('ch32Essential');
  if (ch32EssentialEl) {
    ch32EssentialEl.checked = state.ch32Essential;
    ch32EssentialEl.addEventListener('change', function(e) {
      state.ch32Essential = e.target.checked;
      renderResults();
    });
  }
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
  // Legacy 2-button refs (may be absent after A2 redesign — null-guarded)
  const m = document.getElementById('modeMWFRS');
  const c = document.getElementById('modeCC');
  if (m) m.classList.toggle('active', state.mode === 'mwfrs');
  if (c) c.classList.toggle('active', state.mode === 'cc');
  // A2: 3-button procedure selector
  const isEnv = state.mode === 'mwfrs' && state.mwfrsProcedure !== 'directional';
  const isDir = state.mode === 'mwfrs' && state.mwfrsProcedure === 'directional';
  const isCC  = state.mode === 'cc';
  const pE = document.getElementById('procEnvelope');
  const pD = document.getElementById('procDirectional');
  const pC = document.getElementById('procCC');
  if (pE) pE.classList.toggle('active', isEnv);
  if (pD) pD.classList.toggle('active', isDir);
  if (pC) pC.classList.toggle('active', isCC);
  // Update hint text below the 3 buttons
  const hint = document.getElementById('procHint');
  if (hint) {
    if (isEnv) hint.textContent = 'Ch.28 Envelope — low-rise buildings only: h ≤ 60 ft and h ≤ least horizontal dimension (Sec. 28.3.1).';
    else if (isDir) hint.textContent = 'Ch.27 Directional — all building heights and geometries; required when h > 60 ft or h > least horizontal dimension (Sec. 27.1.2).';
    else hint.textContent = 'Ch.30 C&C — pressures on individual cladding, fasteners, purlins. Part 1 (h ≤ 60 ft) or Part 2 (h > 60 ft) selected automatically.';
  }
  applyStructureCategoryVisibility();
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

function applyStructureCategoryVisibility() {
  const isOther = state.structureCategory === 'otherStructure';
  document.body.classList.toggle('cat-other', isOther);
  const bBtn = document.getElementById('catBuilding');
  const oBtn = document.getElementById('catOther');
  if (bBtn) bBtn.classList.toggle('active', !isOther);
  if (oBtn) oBtn.classList.toggle('active', isOther);
  // Show correct sub-type row within ch29Inputs
  const rows = document.querySelectorAll('#ch29TypeRows .ch29-row');
  rows.forEach(row => row.classList.remove('active'));
  const activeRow = document.getElementById('ch29-' + state.ch29Type);
  if (activeRow) activeRow.classList.add('active');
}

function updateUnitLabels() {
  const sys = state.unitSystem;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('lblV', sys === 'SI' ? 'm/s' : 'mph');
  set('lblGroundElev', sys === 'SI' ? 'm' : 'ft');
  set('lblH', sys === 'SI' ? 'm' : 'ft');
  set('lblMinDim', sys === 'SI' ? 'm' : 'ft');
  set('lblBuildingL', sys === 'SI' ? 'm' : 'ft');
  set('lblAreaWall', sys === 'SI' ? 'm²' : 'ft²');
  set('lblAreaRoof', sys === 'SI' ? 'm²' : 'ft²');
  set('lblParapetHeight', sys === 'SI' ? 'm' : 'ft');
  set('lblOpenL', sys === 'SI' ? 'm' : 'ft');
  set('lblCanopyArea', sys === 'SI' ? 'm²' : 'ft²');
  set('lblCanopyHc', sys === 'SI' ? 'm' : 'ft');
  set('lblCanopyHe', sys === 'SI' ? 'm' : 'ft');
  set('lblTankD', sys === 'SI' ? 'm' : 'ft');
  set('lblTankH', sys === 'SI' ? 'm' : 'ft');
  set('lblSteppedLowerH', sys === 'SI' ? 'm' : 'ft');
  set('lblSteppedLowerW', sys === 'SI' ? 'm' : 'ft');
  set('lblMsModuleW', sys === 'SI' ? 'm' : 'ft');
  set('lblSwModuleW', sys === 'SI' ? 'm' : 'ft');
  set('lblDomeD', sys === 'SI' ? 'm' : 'ft');
  set('lblDomeF', sys === 'SI' ? 'm' : 'ft');
  set('lblDomeHD', sys === 'SI' ? 'm' : 'ft');
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
  const blEl = document.getElementById('buildingL');
  if (blEl) blEl.value = fmt(lengthOut(state.buildingL), 2);
  document.getElementById('areaWall').value = fmt(areaOut(state.areaWall), 2);
  document.getElementById('areaRoof').value = fmt(areaOut(state.areaRoof), 2);
  const parapetHeightEl = document.getElementById('parapetHeight');
  if (parapetHeightEl) parapetHeightEl.value = fmt(lengthOut(state.parapetHeight), 2);
  const canopyAreaEl = document.getElementById('canopyArea');
  if (canopyAreaEl) canopyAreaEl.value = fmt(areaOut(state.canopyArea), 1);
  const canopyHcEl = document.getElementById('canopyHc');
  if (canopyHcEl) canopyHcEl.value = fmt(lengthOut(state.canopyHc), 2);
  const canopyHeEl = document.getElementById('canopyHe');
  if (canopyHeEl) canopyHeEl.value = fmt(lengthOut(state.canopyHe), 2);
  const tankDEl = document.getElementById('tankD');
  if (tankDEl) tankDEl.value = fmt(lengthOut(state.tankD), 2);
  const tankHEl = document.getElementById('tankH');
  if (tankHEl) tankHEl.value = fmt(lengthOut(state.tankH), 2);
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
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 26.7.2</span> defines the exposure categories used to determine K<sub>z</sub>/K<sub>h</sub> from Table 26.10-1:</p>
    <ul>
      <li><strong>B</strong> &mdash; Urban and suburban areas, wooded areas, or other terrain with numerous closely spaced obstructions having the size of single-family dwellings or larger.</li>
      <li><strong>C</strong> &mdash; Open terrain with scattered obstructions having heights generally less than 30 ft, including flat open country and grasslands.</li>
      <li><strong>D</strong> &mdash; Flat, unobstructed areas and water surfaces. Includes smooth mud flats, salt flats, and unbroken ice.</li>
    </ul>
    <p>The exposure category is determined for the direction(s) from which the wind blows, per <span class="src-tag">Sec. 26.7.3</span> (surface roughness in an upwind sector of 45&deg; and a distance of 1,500 ft or 10&times;h, whichever is greater).</p>
    <p><strong>How the exposure category feeds K<sub>h</sub></strong> (<span class="src-tag">Table 26.10-1, Note 1</span>), using mean roof height h and the exposure-specific &alpha; and z<sub>g</sub> below:</p>
    <table style="border-collapse:collapse; margin:6px 0;">
      <tr><th style="text-align:left; padding-right:16px; border-bottom:1px solid #ccc;">Exposure</th><th style="text-align:left; padding-right:16px; border-bottom:1px solid #ccc;">&alpha;</th><th style="text-align:left; border-bottom:1px solid #ccc;">z<sub>g</sub> (ft)</th></tr>
      <tr><td style="padding-right:16px;">B</td><td style="padding-right:16px;">7.5</td><td>3,280</td></tr>
      <tr><td style="padding-right:16px;">C</td><td style="padding-right:16px;">9.8</td><td>2,460</td></tr>
      <tr><td style="padding-right:16px;">D</td><td style="padding-right:16px;">11.5</td><td>1,935</td></tr>
    </table>
    <ul>
      <li>h &lt; 15 ft: <strong>K<sub>h</sub> = 2.41 (15/z<sub>g</sub>)<sup>2/&alpha;</sup></strong></li>
      <li>15 ft &le; h &le; z<sub>g</sub>: <strong>K<sub>h</sub> = 2.41 (h/z<sub>g</sub>)<sup>2/&alpha;</sup></strong></li>
      <li>h &gt; z<sub>g</sub>: <strong>K<sub>h</sub> = 2.41</strong></li>
    </ul>
    <p><span class="src-tag">Table 26.10-1, footnote *</span> &mdash; Exception: for Exposure B with h &lt; 30 ft, the formula above is overridden and <strong>K<sub>h</sub> = 0.70</strong> is used directly (this is the value used in <span class="src-tag">Chapter 28</span>, the Envelope Procedure used by this calculator).</p>`
  },
  kzt: {
    title: 'Topographic Factor, K<sub>zt</sub> — Sec. 26.8',
    html: `<p><span class="src-tag">Sec. 26.8.1</span> &mdash; wind speed-up over isolated hills, ridges, and escarpments shall be included in the design when the site conditions and structure location meet all of the conditions listed (e.g., the hill/ridge/escarpment is isolated, H/L<sub>h</sub> &ge; 0.2, and the structure is located within the distances specified in Fig. 26.8-1).</p>
    <p>If those conditions are <strong>not</strong> met, <span class="src-tag">K<sub>zt</sub> = 1.0</span>.</p>
    <p>If they are met, <span class="src-tag">Eq. 26.8-1</span>: K<sub>zt</sub> = (1 + K<sub>1</sub>K<sub>2</sub>K<sub>3</sub>)&sup2;, with K<sub>1</sub>, K<sub>2</sub>, K<sub>3</sub> read from <span class="src-tag">Fig. 26.8-1</span> based on hill shape, height H, horizontal distance from the crest x, and height above ground z. This calculator does not reproduce Fig. 26.8-1 &mdash; enter the resulting K<sub>zt</sub> directly.</p>`
  },
  groundElev: {
    title: 'Ground Elevation Factor, K<sub>e</sub> — Sec. 26.9, Table 26.9-1',
    html: `<p><span class="src-tag">Table 26.9-1, Note 2</span> &mdash; K<sub>e</sub> = exp(-0.0000362 z<sub>e</sub>), where z<sub>e</sub> is the ground elevation above sea level at the building site, in feet.</p>
    <p><span class="src-tag">Table 26.9-1, Note 1</span> permits K<sub>e</sub> = 1.0 to be used for any elevation (conservative). Enter z<sub>e</sub> = 0 to force K<sub>e</sub> = 1.0.</p>`
  },
  enclosure: {
    title: 'Enclosure Classification & (GC<sub>pi</sub>) — Sec. 26.2 & Table 26.13-1',
    html: `<p>Building enclosure classification is determined per the definitions of <span class="src-tag">Sec. 26.2</span> (Enclosed, Partially Enclosed, Partially Open, Open Buildings), based on the area of openings in the building envelope relative to wall/roof area.</p>
    <p><span class="src-tag">Table 26.13-1</span> &mdash; Internal Pressure Coefficient, (GC<sub>pi</sub>):</p>
    <ul>
      <li>Open Buildings: (GC<sub>pi</sub>) = 0.00</li>
      <li>Partially Open Buildings: (GC<sub>pi</sub>) = &plusmn;0.18</li>
      <li>Enclosed Buildings: (GC<sub>pi</sub>) = &plusmn;0.18</li>
      <li>Partially Enclosed Buildings: (GC<sub>pi</sub>) = &plusmn;0.55</li>
    </ul>
    <p>Both signs must be evaluated (<span class="src-tag">Table 26.13-1, Note 1</span>); this calculator pairs each (GC<sub>pf</sub>)/(GC<sub>p</sub>) value with whichever (GC<sub>pi</sub>) sign produces the larger-magnitude net pressure.</p>
    <p><strong>Open Building &mdash; Free Roof</strong> selects the <span class="src-tag">Sec. 27.3.2</span> procedure for open buildings with monoslope, pitched, or troughed free roofs (e.g., canopies, pavilions, open-sided sheds with no walls). This replaces the normal (GC<sub>pf</sub>)/(GC<sub>p</sub>)-(GC<sub>pi</sub>) MWFRS/C&amp;C flow above with <span class="src-tag">Eq. 27.3-2</span>: p = q<sub>h</sub> K<sub>d</sub> G C<sub>N</sub>, where C<sub>N</sub> is read from <span class="src-tag">Figs. 27.3-4 through 27.3-7</span>. (GC<sub>pi</sub>) is not applicable to this procedure (there is no enclosed internal volume).</p>`
  },
  openRoof: {
    title: 'Open Buildings with Free Roofs — Sec. 27.3.2',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 27.3.2</span> &mdash; "Open Buildings with Monoslope, Pitched, or Troughed Free Roofs." Net design wind pressure, <span class="src-tag">Eq. 27.3-2</span>: <strong>p = q<sub>h</sub> K<sub>d</sub> G C<sub>N</sub></strong>, applied normal to the roof surface (positive toward the roof bottom surface).</p>
    <p><strong>G</strong> &mdash; Gust-Effect Factor, <span class="src-tag">Sec. 26.11</span>. This calculator uses G = 0.85 for rigid structures (<span class="src-tag">Sec. 26.11.1</span>). The flexible-structure G_f procedure (<span class="src-tag">Secs. 26.11.3&ndash;26.11.5</span>, requires the fundamental natural frequency) is <strong>not implemented</strong> &mdash; verify separately if the structure's natural frequency is below 1 Hz.</p>
    <p><strong>C<sub>N</sub></strong> &mdash; Net pressure coefficient for two orthogonal load cases (A and B), tabulated by roof angle &theta;, h/L ratio, wind flow (Clear/Obstructed under the roof), and wind direction &gamma; relative to the ridge/span:</p>
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
    html: `<p>Selects which C<sub>N</sub> table governs the &gamma; = 0&deg;/180&deg; loading (<span class="src-tag">Sec. 27.3.2</span>):</p>
    <ul>
      <li><strong>Monoslope</strong> &mdash; single sloped plane, <span class="src-tag">Fig. 27.3-4</span>. For &theta; &lt; 7.5&deg;, a flat-roof row applies (identical C<sub>N</sub> for &gamma; = 0&deg; and 180&deg;, by symmetry).</li>
      <li><strong>Pitched (gable-shaped, ridge at center)</strong> &mdash; <span class="src-tag">Fig. 27.3-5</span>.</li>
      <li><strong>Troughed (valley at center)</strong> &mdash; <span class="src-tag">Fig. 27.3-6</span>, whose C<sub>N</sub> values are the sign-flip of Fig. 27.3-5 (physically consistent: a troughed roof is an inverted pitched roof).</li>
    </ul>
    <p>For all three shapes, <span class="src-tag">Fig. 27.3-7</span> (&gamma; = 90&deg;/270&deg;) is always shown as well, since wind parallel to the ridge/valley must also be checked.</p>
    <p><span class="src-tag">Fig. 27.3-4, Note 4</span>: for monoslope roofs with 0.05 &le; h/L &lt; 0.25 and &theta; &lt; 5&deg;, Fig. 27.3-7 is used in place of Fig. 27.3-4 for the &gamma; = 0&deg;/180&deg; case as well &mdash; this calculator applies that substitution and flags it. Whether the same substitution applies to pitched/troughed roofs (Figs. 27.3-5/27.3-6) was not confirmed in the source review and is flagged as engineering judgment if encountered.</p>`
  },
  openWindFlow: {
    title: 'Wind Flow (Clear / Obstructed) — Figs. 27.3-4/5/6/7, Note 2',
    html: `<p>Per the notes to <span class="src-tag">Figs. 27.3-4 through 27.3-7</span>, C<sub>N</sub> values are tabulated separately for two conditions of airflow beneath the free roof:</p>
    <ul>
      <li><strong>Clear wind flow</strong> &mdash; wind able to flow with minimal obstruction beneath the roof.</li>
      <li><strong>Obstructed wind flow</strong> &mdash; wind flow blocked by objects beneath the roof equal to more than 50% of the open area under the roof.</li>
    </ul>
    <p>Select the condition that applies to the structure's actual usage; obstructed flow generally increases the magnitude of the net pressure coefficients.</p>`
  },
  openL: {
    title: 'Roof Plan Dimension, L — Fig. 27.3-4 Notation',
    html: `<p>L is the horizontal dimension of the roof measured in the along-wind direction (i.e., the span over which the monoslope/pitched/troughed roof extends), per the Notation diagram of <span class="src-tag">Fig. 27.3-4</span>.</p>
    <p>Together with the mean roof height h (entered above, under "Building Geometry"), this gives the ratio <strong>h/L</strong>, which the C<sub>N</sub> tables of Figs. 27.3-4/5/6 are tabulated for over the range 0.25 &le; h/L &le; 1.0. h/L outside this range, or &theta; &gt; 45&deg;, is flagged in the results as outside the figures' stated applicability &mdash; verify against the Standard.</p>`
  },
  riskCategory: {
    title: 'Risk Category',
    html: `<p>Risk Category (I, II, III, or IV) is assigned per <span class="src-tag">Table 1.5-1</span> based on the building's occupancy/use. It is recorded here for the report header and does not feed into this module's calculations directly &mdash; its effect is already embedded in the basic wind speed V you enter.</p>
    <p>Per <span class="src-tag">Sec. 26.5.1</span>, the wind speed maps of <span class="src-tag">Figures 26.5-1A&ndash;D</span> are keyed to Risk Category (each map corresponds to a target annual probability of exceedance / mean recurrence interval appropriate to that category). Use the <a href="https://ascehazardtool.org" target="_blank" rel="noopener">ASCE 7 Hazard Tool</a> with your project's Risk Category to obtain the correct V for the "Basic Wind Speed" field above.</p>`
  },
  h: {
    title: 'Mean Roof Height, h',
    html: `<p>Mean roof height h is defined in <span class="src-tag">Sec. 26.2</span> as the average of the roof eave height and the roof ridge height, except that for roof angles &le; 10&deg; the eave height may be used as h.</p>
    <p>h is used to: determine K<sub>h</sub> (<span class="src-tag">Table 26.10-1</span> &mdash; see the "i" button on Exposure Category for the K<sub>h</sub> formula and &alpha;/z<sub>g</sub> table); determine applicability of the Envelope Procedure, h &le; 60 ft (<span class="src-tag">Sec. 28.3.1</span>); compute the zone dimension a (<span class="src-tag">Fig. 28.3-1</span> Notation &mdash; see the "i" button on Least Horizontal Dimension for the a formula); and determine whether torsional Load Cases 3/4 are required, h &gt; 30 ft (<span class="src-tag">Sec. 28.3.2</span>).</p>`
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
    html: `<p>Angle of the plane of the roof from horizontal, in degrees. Used to interpolate (GC<sub>pf</sub>) from <span class="src-tag">Figure 28.3-1</span> (Load Cases 1 &amp; 3, rows tabulated at &theta; = 0&ndash;5&deg;, 20&deg;, 30&ndash;45&deg;, 90&deg;, with linear interpolation permitted for intermediate angles) and to select the roof C&amp;C figure: <span class="src-tag">Figure 30.3-2A</span> for &theta; &le; 7&deg;, or <span class="src-tag">Figures 30.3-2B/2C</span> (gable) / <span class="src-tag">30.3-2D&ndash;G</span> (hip) for 7&deg; &lt; &theta; &le; 45&deg; depending on the Roof Shape selector.</p>
    <p>For &theta; &le; 10&deg;, h may be taken as the eave height (<span class="src-tag">Sec. 26.2</span> definition of mean roof height).</p>
    <p><strong>Interpolation formula</strong> &mdash; for &theta; between two tabulated rows &theta;<sub>1</sub> &lt; &theta; &lt; &theta;<sub>2</sub>:</p>
    <p>(GC<sub>pf</sub>)(&theta;) = (GC<sub>pf</sub>)(&theta;<sub>1</sub>) + [(&theta; &minus; &theta;<sub>1</sub>) / (&theta;<sub>2</sub> &minus; &theta;<sub>1</sub>)] &times; [(GC<sub>pf</sub>)(&theta;<sub>2</sub>) &minus; (GC<sub>pf</sub>)(&theta;<sub>1</sub>)]</p>
    <p>&theta; below the lowest tabulated row or above the highest is clamped to that row's value (no extrapolation).</p>
    <p>&theta; &gt; 27&deg; (gable) or &gt; 45&deg; (hip) is beyond the range of the digitized figures; the calculator caps the roof C&amp;C coefficients at the highest tabulated &theta; band and flags this in a note above the roof C&amp;C table. MWFRS results remain valid for all &theta; up to 90&deg;.</p>`
  },
  roofShape: {
    title: 'Roof Shape — Figs. 30.3-2B/2C (gable) vs 30.3-2D–G (hip)',
    html: `<p>Selects which roof C&amp;C figure set applies for &theta; &gt; 7&deg;:</p>
    <p><strong>Gable</strong> &mdash; <span class="src-tag">Figure 30.3-2B</span> (7&deg; &lt; &theta; &le; 20&deg;) or <span class="src-tag">Figure 30.3-2C</span> (20&deg; &lt; &theta; &le; 27&deg;), Zones 1, 2, 3.</p>
    <p><strong>Hip</strong> &mdash; <span class="src-tag">Figures 30.3-2D&ndash;G</span> equivalent (7&deg; &lt; &theta; &le; 45&deg;, in three sub-bands), Zones 1, 2, 3.</p>
    <p>Both sets of (GC<sub>p</sub>) values were digitized from the user's Calcs.com (ClearCalcs) ASCE 7-22 Wind Loads C&amp;C calculator formula listing and cross-validated 6/6 against explicit printed value labels on the Fig. 30.3-2B figure image &mdash; see "Where these formulas come from" in the Sources footer for details.</p>`
  },
  areaWall: {
    title: 'Effective Wind Area — Walls (C&C), Figure 30.3-1',
    html: `<p><span class="src-tag">Sec. 26.2 definition of "Effective Wind Area"</span> &mdash; the span length of the component multiplied by an effective width that need not be less than one-third the span length (this maximizes A and minimizes the magnitude of (GC<sub>p</sub>)).</p>
    <p><span class="src-tag">Figure 30.3-1</span> tabulates (GC<sub>p</sub>) for wall Zones 4 and 5 at A &le; 10 ft&sup2; and A &ge; 500 ft&sup2;, with log-linear interpolation between. This calculator applies that interpolation directly.</p>
    <p><strong>Interpolation formula</strong> (for A<sub>lo</sub> &le; A &le; A<sub>hi</sub>, here A<sub>lo</sub>=10 ft&sup2;, A<sub>hi</sub>=500 ft&sup2;):</p>
    <p>(GC<sub>p</sub>)(A) = (GC<sub>p</sub>)(A<sub>lo</sub>) + [log&#8321;&#8320;(A/A<sub>lo</sub>) / log&#8321;&#8320;(A<sub>hi</sub>/A<sub>lo</sub>)] &times; [(GC<sub>p</sub>)(A<sub>hi</sub>) &minus; (GC<sub>p</sub>)(A<sub>lo</sub>)]</p>
    <p>For A &lt; 10 ft&sup2; or A &gt; 500 ft&sup2;, A is clamped to 10 or 500 ft&sup2; before interpolating (i.e., the tabulated end values are used directly).</p>`
  },
  areaRoof: {
    title: 'Effective Wind Area — Roof (C&C), Figures 30.3-2A/2B-2G',
    html: `<p>Same definition as the wall effective wind area (<span class="src-tag">Sec. 26.2</span>), applied to the roof component/cladding under consideration.</p>
    <p><span class="src-tag">Figure 30.3-2A</span> (&theta; &le; 7&deg;) tabulates (GC<sub>p</sub>) for roof Zones 1&prime;, 1, 2, and 3 at A &le; 10 ft&sup2; and A &ge; 500 ft&sup2;, with log-linear interpolation between.</p>
    <p><span class="src-tag">Figures 30.3-2B/2C</span> (gable, 7&deg; &lt; &theta; &le; 27&deg;) and <span class="src-tag">30.3-2D&ndash;G</span> (hip, 7&deg; &lt; &theta; &le; 45&deg;) tabulate (GC<sub>p</sub>) for roof Zones 1, 2, 3 at A &le; 10 ft&sup2; and a zone/sign-specific upper area (100&ndash;300 ft&sup2;), with log-linear interpolation between.</p>
    <p><strong>Interpolation formula</strong> (same form as the wall C&amp;C interpolation, for A<sub>lo</sub> &le; A &le; A<sub>hi</sub>):</p>
    <p>(GC<sub>p</sub>)(A) = (GC<sub>p</sub>)(A<sub>lo</sub>) + [log&#8321;&#8320;(A/A<sub>lo</sub>) / log&#8321;&#8320;(A<sub>hi</sub>/A<sub>lo</sub>)] &times; [(GC<sub>p</sub>)(A<sub>hi</sub>) &minus; (GC<sub>p</sub>)(A<sub>lo</sub>)]</p>
    <p>A outside [A<sub>lo</sub>, A<sub>hi</sub>] is clamped to the nearer bound (the tabulated end value is used directly). A<sub>lo</sub> = 10 ft&sup2; in all cases; A<sub>hi</sub> = 500 ft&sup2; for &theta; &le; 7&deg; (Fig. 30.3-2A) or the zone/sign-specific value (100&ndash;300 ft&sup2;) for sloped roofs (Figs. 30.3-2B&ndash;G).</p>`
  },
  overhang: {
    title: 'Roof Overhangs — Sec. 30.7',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.7</span> &mdash; for buildings with roof overhangs, the net pressure coefficient on the overhang is obtained by combining the (GC<sub>p</sub>) for the applicable roof surface (top of overhang) with the (GC<sub>p</sub>) for the adjacent wall zone (bottom/soffit of overhang), both evaluated at the overhang's effective wind area. This replaces the separate overhang (GC<sub>p</sub>) graphs used in prior editions of ASCE 7.</p>
    <p>This calculator combines: <strong>net (GC<sub>p</sub>) = roof (GC<sub>p</sub>) &minus; wall (GC<sub>p</sub>)</strong>, using the roof C&amp;C zone 2 (eave) with wall zone 4, and roof zone 3 (corner) with wall zone 5 &mdash; both pairings span the same "a"-dimension perimeter strip per the Notation under Figs. 30.3-1/30.3-2. Interior Zone 1 is excluded (overhangs occur only at the perimeter).</p>
    <p>The sign convention and the zone-pairing/combination approach are based on the worked example and discussion in <em>"ASCE 7-22 Changes to Component and Cladding Wind Provisions"</em> (StructureMag, 2022) and the Eng-Tips thread <em>"ASCE 7-22 Roof overhang pressure"</em> (Nov 2025): roof zone 2, &theta;=20&deg;-27&deg; hip, A&le;10 ft&sup2; gives roof (GC<sub>p</sub>)=&minus;2.0 and wall (GC<sub>p</sub>)=+1.0, combining to a net coefficient of &minus;3.0, exactly matching this calculator's tables.</p>
    <p><span class="src-tag">No (GC<sub>pi</sub>) term</span> &mdash; both faces of an overhang are exterior surfaces, so Eq. 30.3-1's internal-pressure adjustment does not apply; the combined coefficient above is already a net (through-thickness) value.</p>
    <p>The exact roof-zone&harr;wall-zone pairing is not explicitly tabulated in the secondary sources reviewed for this calculator; the pairing used here is this calculator's engineering judgment based on the geometric correspondence of the "a"-dimension zones. Verify against ASCE/SEI 7-22 Sec. 30.7 and Fig. 30.7-1 directly for critical designs.</p>`
  },
  parapet: {
    title: 'Parapets — Sec. 27.3.4 (MWFRS) / Sec. 30.6 (C&amp;C)',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 27.3.4 ("Parapets")</span>, Eq. 27.3-3 &mdash; the design wind pressure on a solid parapet for the MWFRS is p<sub>p</sub> = q<sub>p</sub> K<sub>d</sub> (GC<sub>pn</sub>), where (GC<sub>pn</sub>) = <strong>+1.5</strong> for the windward parapet and <strong>&minus;1.0</strong> for the leeward parapet, and q<sub>p</sub> is the velocity pressure evaluated at the top of the parapet (using the same K<sub>z</sub> formula of Table 26.10-1, evaluated at z = h + parapet height). These (GC<sub>pn</sub>) values are corroborated by RISA's "Load Generation &mdash; Wind Loads" documentation and the ICC "Demystifying Loads for Building Officials" ASCE 7-22 guide.</p>
    <p>This calculator's MWFRS procedure is the Envelope Procedure (Ch. 28). Per Meca Enterprises' ASCE 7-16 comparison, the Ch. 27 Part 1 (then Sec. 27.3.4) and Ch. 28 Part 1 (then Sec. 28.3.2) parapet provisions were numerically identical (same (GC<sub>pn</sub>) = +1.5/&minus;1.0, same q<sub>p</sub>). This calculator assumes the same correspondence holds for ASCE 7-22 and applies these (GC<sub>pn</sub>) values to the Envelope Procedure as well, provisionally citing this as <strong>Sec. 28.3.4</strong> &mdash; <span class="src-tag">this exact section number has NOT been independently confirmed against the ASCE/SEI 7-22 text; verify directly.</span></p>
    <p>"Total parapet pressure" = windward p<sub>p</sub> &minus; leeward p<sub>p</sub> (sum of magnitudes), per the combined-pressure convention shown in worked examples (e.g., Meca's 47.1 psf + 31.4 psf = 78.5 psf for a representative case).</p>
    <p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.6 ("Parapets")</span>, Eq. 30.6-1 &mdash; C&amp;C pressure on a parapet is p = q<sub>p</sub>[(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)], with (GC<sub>pi</sub>) = 0 because both faces of the parapet are exterior surfaces (same reasoning as the roof-overhang calculation, Sec. 30.7). Following the two-load-case approach in Meca Enterprises' "Wind Load on Parapets" article (Load Case A/B terminology and pairing logic confirmed against ASCE 7-22 Sec. 30.6 text directly):</p>
    <p><strong>Load A</strong> &mdash; positive wall (GC<sub>p</sub>) (Fig. 30.3-1) on the front face combined with negative roof edge/corner (GC<sub>p</sub>) (Fig. 30.3-2A&ndash;G) on the back face: net (GC<sub>p</sub>)<sub>A</sub> = wall (GC<sub>p</sub>)<sub>pos</sub> &minus; roof (GC<sub>p</sub>)<sub>neg</sub>.<br>
    <strong>Load B</strong> &mdash; positive wall (GC<sub>p</sub>) on the back face combined with negative wall (GC<sub>p</sub>) (same zone) on the front face: net (GC<sub>p</sub>)<sub>B</sub> = wall (GC<sub>p</sub>)<sub>pos</sub> &minus; wall (GC<sub>p</sub>)<sub>neg</sub>.</p>
    <p>This calculator pairs wall Zone 4 (field) with roof Zone 2 (edge), and wall Zone 5 (corner) with roof Zone 3 (corner) for Load A &mdash; <span class="src-tag">this zone pairing is this calculator's engineering judgment</span> (the inverse of the roof-overhang pairing in Sec. 30.7, for the same geometric reason), not an explicit tabulated pairing found in the sources reviewed. It is numerically consistent with Meca's worked example, in which wall Zone 4 (GC<sub>p</sub>)<sub>pos</sub> = +1.0 and roof Zone 2 (GC<sub>p</sub>)<sub>neg</sub> = &minus;2.3 (A = 10 ft&sup2;) match this calculator's tables exactly.</p>
    <p><span class="src-tag">Not implemented &mdash; verify directly for these conditions:</span> (1) Fig. 30.3-1 Note 5, an additional reduction to the wall (GC<sub>p</sub>) used in Meca's parapet example for low-slope roofs; and (2) the Fig. 30.3-2A note permitting roof Zone 3 (GC<sub>p</sub>) to be taken equal to Zone 2 (GC<sub>p</sub>) when a parapet &ge; 3 ft tall is present. Either could change the governing pressure for some geometries and is not accounted for in the tables above.</p>`
  },
  canopy: {
    title: 'Attached Canopies on Buildings — Sec. 30.9',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.9 ("Attached Canopies on Buildings, h &le; 60 ft and h &gt; 60 ft")</span>, Eq. 30.9-1 &mdash; p = q<sub>h</sub> K<sub>d</sub> (GC<sub>p</sub>), where q<sub>h</sub> is the velocity pressure at mean roof height h (Sec. 26.7.3, the same q<sub>h</sub> used elsewhere in this calculator) and K<sub>d</sub> = 0.85. <span class="src-tag">No (GC<sub>pi</sub>) term</span> &mdash; both the upper and lower canopy surfaces are exterior surfaces, so there is no enclosed internal volume to apply internal pressure to (same reasoning as roof overhangs, Sec. 30.7, and parapets, Sec. 30.6).</p>
    <p>Canopies covered by this section are attached to the building wall, project horizontally outward, and are limited to a maximum roof slope of about 2&deg; (essentially flat) &mdash; distinct from a roof overhang (Sec. 30.7, an extension of the main roof surface itself) and from an open building's free roof (Sec. 27.3.2 / 30.5, a free-standing unenclosed roof with no attached wall).</p>
    <p>(GC<sub>p</sub>) is read from two pairs of figures depending on h: <strong>Figs. 30.9-1A/1B</strong> for h &le; 60 ft, or <strong>Figs. 30.9-2A/2B</strong> for h &gt; 60 ft. Within each pair:</p>
    <p><strong>Figs. -1A / -2A ("separate surfaces")</strong> &mdash; distinct upper- and lower-surface (GC<sub>p</sub>) values, intended for fastener design where each surface may see its own pressure acting alone (per ASCE/SEI 7-22 Commentary Tables C30.9-1 and C30.9-3).</p>
    <p><strong>Figs. -1B / -2B ("net/combined")</strong> &mdash; a single net (GC<sub>p</sub>) combining both surfaces acting simultaneously, intended for structural design of the canopy framing; the value depends on the ratio h<sub>c</sub>/h<sub>e</sub> (canopy height to building eave height) per ASCE/SEI 7-22 Commentary Tables C30.9-2 and C30.9-4.</p>
    <p>All four Commentary tables are piecewise functions of the effective wind area A: a constant below A = 10 ft&sup2;, a log-linear segment between A = 10 and 100 ft&sup2;, and either a constant or a further log-linear segment (to A = 1,000 ft&sup2;) above A = 100 ft&sup2; depending on the table. <span class="src-tag">Table C30.9-3's negative-upper-surface formula (h &gt; 60 ft, separate surfaces) has a genuine discontinuity at A = 100 ft&sup2;</span> in the published Commentary text itself (the two piecewise branches do not meet at the boundary) &mdash; this calculator reproduces that discontinuity exactly rather than smoothing it, since it reflects the standard's literal tabulated/plotted curve rather than a transcription error.</p>
    <p>A and h<sub>c</sub>/h<sub>e</sub> values outside the tabulated range are capped to the nearest tabulated boundary value (flagged in the report as a capped approximation) rather than extrapolated.</p>`
  },
  circTank: {
    title: 'Circular Bins, Silos, and Tanks — Sec. 30.10',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.10 ("Circular Bins, Silos, and Tanks with h &le; 120 ft")</span>, Eq. 30.10-1 &mdash; p = q<sub>h</sub> K<sub>d</sub> [(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)], using the same q<sub>h</sub> and K<sub>d</sub> = 0.85 used elsewhere on this page (Sec. 30.10 does not define an independent tank-height q<sub>h</sub>), applicable to circular bins, silos, and tanks with diameter D &lt; 120 ft.</p>
    <p><strong>External walls (implemented)</strong> &mdash; <span class="src-tag">Sec. 30.10.2, Eqs. 30.10-2 to 30.10-4</span>: the wall (GC<sub>p</sub>) varies continuously around the circumference as a function of the angle &alpha; from the windward stagnation point and the aspect ratio H/D (cylinder height / diameter): C(&alpha;) = &minus;0.5 + 0.4cos&alpha; + 0.8cos2&alpha; + 0.3cos3&alpha; &minus; 0.1cos4&alpha; &minus; 0.05cos5&alpha;; k<sub>b</sub> = 1.0 for C(&alpha;) &ge; &minus;0.15, otherwise k<sub>b</sub> = 1.0 &minus; 0.55(C(&alpha;)+0.15)log<sub>10</sub>(H/D); (GC<sub>p</sub>)(&alpha;) = k<sub>b</sub>&middot;C(&alpha;). Valid for 0.25 &le; H/D &le; 4.0; values outside this range are capped to the nearest boundary and flagged.</p>
    <p><strong>Internal pressure (implemented)</strong> &mdash; for closed-top tanks, the page's normal enclosure classification and (GC<sub>pi</sub>) (Table 26.13-1) apply via Eq. 30.10-1 directly. For <strong>open-topped</strong> tanks, <span class="src-tag">Sec. 30.10.3, Eq. 30.10-5</span> gives a single combined internal pressure coefficient (GC<sub>pi</sub>) = &minus;0.9 &minus; 0.35log<sub>10</sub>(H/D), used in place of the Table 26.13-1 values.</p>
    <p><strong>Underside of elevated bins (implemented)</strong> &mdash; <span class="src-tag">Sec. 30.10.5</span> gives explicit numeric (GC<sub>p</sub>) values for the underside of isolated circular bins elevated on columns: Zones 1 &amp; 2: +0.8/&minus;0.6; Zone 3: +1.2/&minus;0.9.</p>
    <p><span class="src-tag">NOT implemented &mdash; verify directly against the Standard:</span> roof pressures for isolated circular bins (<span class="src-tag">Sec. 30.10.4, Fig. 30.10-2</span>, Zones 1&ndash;4, dependent on roof slope Class 1/2a/2b) and roof/wall pressures for grouped circular bins spaced closer than 1.25D center-to-center (<span class="src-tag">Sec. 30.10.6, Figs. 30.10-3/30.10-4</span>). Both provisions exist <em>only</em> as graphical figures in ASCE/SEI 7-22 &mdash; confirmed by direct text search of the standard and its Commentary &mdash; with no numeric (GC<sub>p</sub>) values recoverable from the text. The Commentary narrative for these figures is qualitative only (citing wind-tunnel studies) and does not reproduce the plotted coefficients, so this calculator does not invent numbers for them.</p>`
  },
  steppedRoof: {
    title: 'Stepped Roofs — Sec. 30.3.2.1, Fig. 30.3-3',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 30.3.2.1, Fig. 30.3-3</span> &mdash; applies to buildings with a flat, stepped roof (each level &theta; &le; 7&deg;), i.e. a taller main roof (mean height h, entered above in Building Geometry) adjoining a lower roof level at a different height. Per the figure's own note: <em>"On the lower level of flat, stepped roofs shown here, the zone designations and pressure coefficients shown in Figure 30.3-2A shall apply."</em> So the (GC<sub>p</sub>) values for Zones 1/2/3 are identical to the ordinary flat-roof table already used elsewhere on this page &mdash; only the <strong>zone geometry</strong> on the lower roof changes near the step.</p>
    <p>The lower roof's outer perimeter keeps the standard edge-zone width <strong>a</strong> (per the Fig. 30.3-1/30.3-2A Notation, computed from h, least horizontal dimension, and &theta; = 0). Immediately adjacent to the step itself, the figure widens this zone to <strong>1.5h<sub>s</sub></strong>, where h<sub>s</sub> is the step's height differential (h<sub>s</sub> = h &minus; h<sub>lower</sub>) &mdash; entered above as the lower roof's own mean height.</p>
    <p><span class="src-tag">Scope limitation (disclosed, not invented):</span> Figure 30.3-3 illustrates a cascading multi-level building with successive steps (labeled h<sub>s1</sub>, h<sub>s2</sub>, ... on the figure, each with its own 1.5h<sub>s</sub>-type zone width) but the Standard's text does <em>not</em> define this multi-step geometry in words anywhere &mdash; only the diagram itself shows the pattern, and reading additional steps off the figure introduces real ambiguity. This calculator therefore implements only the common <strong>two-level (single-step)</strong> case. Buildings with two or more steps are <strong>not implemented</strong> &mdash; consult Fig. 30.3-3 directly.</p>
    <p>The lower roof's width perpendicular to the step, W<sub>L</sub>, caps the step-adjacent zone (it cannot exceed the lower roof's own width); this is flagged in the report when it occurs.</p>`
  },
  multispanRoof: {
    title: 'Multispan Gable Roofs — Fig. 30.3-4',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Fig. 30.3-4</span> &mdash; applies to buildings with two or more repeating gable spans sharing valley/ridge lines (the page's roof angle &theta; and mean roof height h are reused for this feature). Per the figure's own Note 5: <em>"For &theta; &le; 10&deg;, values of (GC<sub>p</sub>) from Fig. 30.3-2A shall be used."</em> So for the common low-slope case, this calculator reuses the exact same Zone 1/2/3 flat-roof (GC<sub>p</sub>) table already used elsewhere on this page; only the edge-zone width <strong>a</strong> uses Fig. 30.3-4's own formula: a = the smaller of 10% of the single-span module's least horizontal dimension or 0.4h, but not less than the larger of 4% of that dimension or 3 ft.</p>
    <p><strong>Zone pattern (tiled):</strong> unlike a single gable roof, every ridge AND every valley line between adjacent spans gets the same edge-zone (2) and corner-zone (3) treatment that a single building's perimeter eaves and ridge would get &mdash; Zone 3 sits at every point where an eave meets a ridge/valley line (i.e. at each module boundary along both long eaves), Zone 2 runs along the eaves and along every ridge/valley line, and Zone 1 is the remaining interior.</p>
    <p><span class="src-tag">Scope limitation (disclosed, not invented):</span> for &theta; &gt; 10&deg;, Fig. 30.3-4 gives its own (GC<sub>p</sub>) vs. effective-wind-area graphs for two ranges (10&deg; &lt; &theta; &le; 30&deg;, and 30&deg; &lt; &theta; &le; 45&deg;), each with three overlapping curves (Zones 1, 2, and 3) and no printed coordinate table &mdash; only a plotted graph. Digitizing the exact breakpoints from the rendered figure image was not done here, since misreading an unlabeled bend point would mean inventing a number rather than reading one. That range is flagged NOT IMPLEMENTED in the report; consult Fig. 30.3-4 directly for steeper multispan gable roofs.</p>
    <p>Fig. 30.3-4's Notation specifies <em>eave</em> height (not mean roof height) for the &theta; &le; 10&deg; case &mdash; this calculator approximates that with the page's mean roof height h, which is very close for a nearly flat roof.</p>`
  },
  sawtoothRoof: {
    title: 'Sawtooth Roofs — Fig. 30.3-6',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Fig. 30.3-6</span> &mdash; applies to buildings with two or more repeating monoslope spans arranged "sawtooth"-style (each span's low eave stepping down to the next span, the building's roof angle &theta; and mean roof height h are reused for this feature). Per the figure's own Note 5: <em>"For &theta; &le; 10&deg;, values of (GC<sub>p</sub>) from Figure 30.3-2A shall be used."</em> So for the common low-slope case, this calculator reuses the exact same Zone 1/2/3 flat-roof (GC<sub>p</sub>) table already used elsewhere on this page; only the edge-zone widths use Fig. 30.3-6's own formula: a = the smaller of 10% of the single-span module's least horizontal dimension or 0.4h, but not less than the larger of 4% of that dimension or 3 ft.</p>
    <p><strong>Doubled low-eave zone:</strong> unlike a plain single-slope roof, Fig. 30.3-6's own diagram shows the edge-zone width <em>doubled</em> to 2a along the low (upwind) eave of each span &mdash; the step where the monoslope roof drops down to the next span, the sawtooth's defining feature. The other three edges (top, bottom, and the high/right eave) keep the standard width a.</p>
    <p><span class="src-tag">&theta; &gt; 10&deg;:</span> Fig. 30.3-6 gives a single (GC<sub>p</sub>) vs. effective-wind-area graph for this range, with <em>four</em> overlapping curves on the negative (uplift) side (Zone 1, Zone 2, a Zone 3 curve for "Span A," and a separate Zone 3 curve for "Spans B, C, &amp; D") plus three curves on the positive side (Zone 1, Zone 2, Zone 3 &mdash; not split by span). This calculator uses exact coordinate breakpoints digitized directly from the figure (read off the source document, not estimated from a low-resolution scan) and interpolates linearly in log<sub>10</sub>(effective wind area) between them, the same method used for every other GC<sub>p</sub>-vs-area graph on this page. See the report table for the breakpoint-derived values at your entered effective wind area.</p>
    <p>Fig. 30.3-6's Notation specifies <em>eave</em> height (not mean roof height) for the &theta; &le; 10&deg; case &mdash; this calculator approximates that with the page's mean roof height h, which is very close for a nearly flat roof. For &theta; &gt; 10&deg;, the Notation's default (mean roof height) applies directly, no approximation needed.</p>`
  },
  domeRoof: {
    title: 'Domed Roofs — Fig. 30.3-7',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Fig. 30.3-7</span> &mdash; "Coefficients for Domes with a Circular Base." Unlike the other roof-shape extras on this page, this figure is a small, fully numeric (GC<sub>p</sub>) lookup table, not a graph, so it is implemented in full with no scope limitation:</p>
    <table class="report-input-table" style="margin:6px 0;"><thead><tr><th>External Pressure</th><th>&theta;, degrees</th><th>(GC<sub>p</sub>)</th></tr></thead><tbody>
      <tr><td>Negative</td><td>0&ndash;90</td><td>&minus;0.9</td></tr>
      <tr><td>Positive</td><td>0&ndash;60</td><td>+0.9</td></tr>
      <tr><td>Positive</td><td>61&ndash;90</td><td>+0.5</td></tr>
    </tbody></table>
    <p><span class="src-tag">Note 1</span>: these values are used with q<sub>(hD+f)</sub>, the velocity pressure evaluated at the height of the dome's apex (h<sub>D</sub> + f) &mdash; not the page's shared q<sub>h</sub> &mdash; so this calculator recomputes K<sub>z</sub> and K<sub>zt</sub> at that height using the same formulas (Table 26.10-1, Sec. 26.8) used elsewhere on this page.</p>
    <p><span class="src-tag">Note 4</span>: the table applies only to 0 &le; h<sub>D</sub>/D &le; 0.5 and 0.2 &le; f/D &le; 0.5; outside that range the report flags the result as not validated for the entered geometry. <span class="src-tag">Note 5</span>: &theta; = 0&deg; at the dome's springline (base perimeter), &theta; = 90&deg; at its center top point. <span class="src-tag">Note 3</span>: each component must be checked against both the maximum positive and maximum negative pressure.</p>`
  },
  stepsInfo: {
    title: 'Velocity Pressure — Step by Step',
    html: `<p>Every value below is computed from the inputs on the left, with the clause or equation it comes from &mdash; see "Where these formulas come from" at the bottom of this page for the full citation list. The formulas actually evaluated, in order, are:</p>
    <ol>
      <li><strong>K<sub>h</sub></strong> (<span class="src-tag">Table 26.10-1, Note 1</span>) &mdash; K<sub>h</sub> = 2.41(h/z<sub>g</sub>)<sup>2/&alpha;</sup> (or the h&lt;15 ft / h&gt;z<sub>g</sub> branches), with &alpha; and z<sub>g</sub> from the selected Exposure Category; overridden to K<sub>h</sub> = 0.70 for Exposure B with h &lt; 30 ft (<span class="src-tag">footnote *</span>). See the "i" button on Exposure Category for the full table.</li>
      <li><strong>K<sub>e</sub></strong> (<span class="src-tag">Table 26.9-1, Note 2</span>) &mdash; K<sub>e</sub> = exp(&minus;0.0000362 &times; z<sub>e</sub>), where z<sub>e</sub> is the ground elevation entered above (z<sub>e</sub> = 0 gives K<sub>e</sub> = 1.00).</li>
      <li><strong>K<sub>d</sub></strong> (<span class="src-tag">Table 26.6-1</span>) &mdash; K<sub>d</sub> = 0.85 for buildings, MWFRS and C&amp;C (fixed value, not user-adjustable).</li>
      <li><strong>K<sub>zt</sub></strong> (<span class="src-tag">Sec. 26.8, Eq. 26.8-1</span>) &mdash; user input; K<sub>zt</sub> = 1.0 unless the site meets the Fig. 26.8-1 escarpment/ridge/hill criteria.</li>
      <li><strong>q<sub>h</sub></strong> (<span class="src-tag">Eq. 26.10-1</span>) &mdash; q<sub>h</sub> = 0.00256 &times; K<sub>h</sub> &times; K<sub>zt</sub> &times; K<sub>e</sub> &times; V&sup2; (V in mph, q<sub>h</sub> in psf).</li>
      <li><strong>(GC<sub>pi</sub>)</strong> (<span class="src-tag">Table 26.13-1</span>) &mdash; &plusmn;0.18 (Enclosed or Partially Open) or &plusmn;0.55 (Partially Enclosed), per the Enclosure Classification selected above; both signs are evaluated and the worse one is reported for each zone (<span class="src-tag">Note 1</span>).</li>
      <li><strong>Zone dimension a</strong> (<span class="src-tag">Notation, Figs. 28.3-1 / 30.3-1</span>) &mdash; a = min[0.1 &times; B<sub>min</sub>, 0.4h], not less than max[0.04 &times; B<sub>min</sub>, 3 ft], where B<sub>min</sub> is the least horizontal dimension entered above; capped at 0.8h if &theta; &le; 7&deg; and B<sub>min</sub> &gt; 300 ft.</li>
    </ol>
    <p>These six values (K<sub>h</sub>, K<sub>e</sub>, K<sub>d</sub>, K<sub>zt</sub>, q<sub>h</sub>, (GC<sub>pi</sub>)) and a feed every MWFRS and C&amp;C pressure below via <span class="src-tag">Eq. 28.3-1</span>: p = q<sub>h</sub> K<sub>d</sub> [(GC<sub>pf</sub>) &minus; (GC<sub>pi</sub>)] and <span class="src-tag">Eq. 30.3-1</span>: p = q<sub>h</sub> K<sub>d</sub> [(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)] &mdash; see the "i" buttons on the MWFRS and C&amp;C section headers for those equations and how (GC<sub>pf</sub>)/(GC<sub>p</sub>) are obtained.</p>`
  },
  mwfrs: {
    title: 'MWFRS — Envelope Procedure, Figure 28.3-1 / 28.3-2',
    html: `<p><span class="src-tag">Sec. 28.3, Eq. 28.3-1</span>: p = q<sub>h</sub> K<sub>d</sub> [(GC<sub>pf</sub>) &minus; (GC<sub>pi</sub>)]. Applicable to enclosed and partially enclosed buildings with h &le; 60 ft, flat/gable/hip roofs, per the conditions of <span class="src-tag">Sec. 28.3.1</span>.</p>
    <p><strong>Load Case 1</strong> (Zones 1&ndash;4, 1E&ndash;4E) is &theta;-dependent. <strong>Load Case 2</strong> (Zones 1&ndash;6, 1E&ndash;6E) is the same for all &theta;. Each load case is evaluated for all four building corners taken as the windward corner (<span class="src-tag">Sec. 28.3.2.1</span>); Zones with the "E" suffix are end-zone (edge strip) values within distance a of the corner.</p>
    <p><strong>Load Cases 3 &amp; 4</strong> (<span class="src-tag">Fig. 28.3-2</span>) add torsional "T" zones to Load Cases 1 and 2, respectively, and are required when h &gt; 30 ft unless an exception of <span class="src-tag">Sec. 28.3.2</span> applies.</p>
    <p>p<sub>min</sub> and p<sub>max</sub> below pair each (GC<sub>pf</sub>) with whichever sign of (GC<sub>pi</sub>) (Table 26.13-1) produces the larger-magnitude net pressure &mdash; both must be checked per <span class="src-tag">Table 26.13-1, Note 1</span>.</p>`
  },
  cc: {
    title: 'Components &amp; Cladding — Figures 30.3-1 / 30.3-2A-2G',
    html: `<p><span class="src-tag">Sec. 30.3, Eq. 30.3-1</span>: p = q<sub>h</sub> K<sub>d</sub> [(GC<sub>p</sub>) &minus; (GC<sub>pi</sub>)]. Applicable to C&amp;C of enclosed and partially enclosed low-rise buildings (h &le; 60 ft) with flat, gable, hip, monoslope, or similar roofs, per <span class="src-tag">Sec. 30.3.1</span> and the conditions on Figures 30.3-1/30.3-2.</p>
    <p>(GC<sub>p</sub>) is read from <span class="src-tag">Figure 30.3-1</span> (walls, Zones 4 &amp; 5, all &theta;), <span class="src-tag">Figure 30.3-2A</span> (roof, Zones 1&prime;, 1, 2, 3, for &theta; &le; 7&deg;), and <span class="src-tag">Figures 30.3-2B/2C</span> (gable) or <span class="src-tag">30.3-2D&ndash;G</span> (hip) (roof, Zones 1, 2, 3, for 7&deg; &lt; &theta; &le; 45&deg;), as a function of the effective wind area, with log-linear interpolation between the tabulated breakpoints.</p>
    <p>p<sub>min</sub> and p<sub>max</sub> pair the negative/positive (GC<sub>p</sub>) with whichever sign of (GC<sub>pi</sub>) produces the larger-magnitude net pressure.</p>`
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
  const genEl = document.getElementById('printGenerated');
  if (genEl) { genEl.textContent = 'Report generated ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + ' — values reflect the inputs and computed results shown below at the time of printing.'; }

  function updatePageStyle() {
    const size   = (document.getElementById('paperSize')   || {}).value || 'letter';
    const orient = (document.getElementById('paperOrient') || {}).value || 'portrait';
    const styleEl = document.getElementById('printPageStyle');
    if (styleEl) styleEl.textContent = '@page{size:' + size + ' ' + orient + ';margin:.75in .5in;}';
  }
  const sizeSel   = document.getElementById('paperSize');
  const orientSel = document.getElementById('paperOrient');
  if (sizeSel)   sizeSel.addEventListener('change', updatePageStyle);
  if (orientSel) orientSel.addEventListener('change', updatePageStyle);
  updatePageStyle();

  const openBtn  = document.getElementById('printBtn');
  const modal    = document.getElementById('exportModal');
  const closeBtn = document.getElementById('exportModalClose');
  const doBtn    = document.getElementById('doExportBtn');
  const pdfOpts  = document.getElementById('exportPdfOpts');
  let currentFmt = 'pdf';

  function openModal()  { if (modal) modal.classList.add('open'); }
  function closeModal() { if (modal) modal.classList.remove('open'); }

  if (openBtn)  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal)    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.querySelectorAll('#exportModal .fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#exportModal .fmt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFmt = btn.dataset.fmt;
      if (pdfOpts) pdfOpts.style.display = currentFmt === 'pdf' ? '' : 'none';
    });
  });

  if (doBtn) doBtn.addEventListener('click', () => {
    closeModal();
    if      (currentFmt === 'pdf')  { window.print(); }
    else if (currentFmt === 'xlsx') { exportReportXLSX(lastResult); }
    else if (currentFmt === 'docx') { exportReportDOCX(lastResult); }
    else if (currentFmt === 'rtf')  { exportReportRTF(lastResult);  }
  });
}

/* =====================================================================
   LAZY CDN LOADER — loads xlsx / docx only when export is triggered,
   so a slow or unavailable CDN never blocks the main calculator.
   ===================================================================== */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + url + '"]')) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}
const CDN_XLSX = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const CDN_DOCX = 'https://unpkg.com/docx@8.5.0/build/index.js';

/* =====================================================================
   WORD (.docx) EXPORT  (docx library — loaded from unpkg CDN)
   Produces a .docx calculation package matching the print report:
   • Repeating title block in the Word Header (company, project, job ref,
     calc/chkd/app'd by + dates, true running page numbers via Word's
     PageNumber.CURRENT / PageNumber.TOTAL_PAGES field codes — unlike the
     PDF approach which cannot produce reliable CSS page-counters).
   • Input Data, Design Summary, Step-by-Step Calculation, and pressure
     zone tables (MWFRS/C&C/Parapet/Open Roof as applicable).
   • Coefficient subscripts rendered as Word subScript TextRuns (e.g.
     K<sub>h</sub> → TextRun("K") + TextRun("h", subScript:true))
     so every cell is editable in Word and subscripts are native Word
     formatting, not images.
   Source: docx npm library — https://github.com/dolanmiu/docx
   ===================================================================== */

// Parse an HTML fragment containing <sub>/<sup> tags and common HTML
// entities into an array of docx TextRun objects. Sub/superscript parts
// become TextRuns with subScript/superScript:true. All values come from
// the same r/state HTML already verified in buildReportHTML — no new
// content is generated here.
function htmlToRuns(html, runProps) {
  if (!html) return [new docx.TextRun(Object.assign({ text: '' }, runProps))];
  const decode = s => s
    .replace(/&mdash;/g,  '—').replace(/&ndash;/g,  '–').replace(/&minus;/g, '−')
    .replace(/&times;/g,  '×').replace(/&plusmn;/g, '±').replace(/&deg;/g,   '°')
    .replace(/&le;/g,     '≤').replace(/&ge;/g,     '≥').replace(/&ne;/g,    '≠')
    .replace(/&rarr;/g,   '→').replace(/&larr;/g,   '←').replace(/&infin;/g, '∞')
    .replace(/&amp;/g,    '&').replace(/&lt;/g,      '<').replace(/&gt;/g,    '>')
    .replace(/&nbsp;/g,   ' ').replace(/&rsquo;/g,  '’').replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&#\d+;/g, m => String.fromCharCode(parseInt(m.slice(2), 10)));

  const runs = [];
  // Split on <sub>...</sub> and <sup>...</sup> tokens (non-greedy)
  const parts = html.split(/(<sub>[\s\S]*?<\/sub>|<sup>[\s\S]*?<\/sup>)/i);
  parts.forEach(part => {
    const subMatch = part.match(/^<sub>([\s\S]*?)<\/sub>$/i);
    const supMatch = part.match(/^<sup>([\s\S]*?)<\/sup>$/i);
    if (subMatch) {
      const text = decode(subMatch[1].replace(/<[^>]+>/g, ''));
      if (text) runs.push(new docx.TextRun(Object.assign({ text, subScript: true  }, runProps)));
    } else if (supMatch) {
      const text = decode(supMatch[1].replace(/<[^>]+>/g, ''));
      if (text) runs.push(new docx.TextRun(Object.assign({ text, superScript: true }, runProps)));
    } else {
      const text = decode(part.replace(/<[^>]+>/g, ''));
      if (text) runs.push(new docx.TextRun(Object.assign({ text }, runProps)));
    }
  });
  return runs.length ? runs : [new docx.TextRun(Object.assign({ text: '' }, runProps))];
}

// Convert an AOA (array of arrays, same format as Excel helpers) to a
// docx Table. First row = header (shaded). colWidths: DXA array, must
// sum to the content width (9360 DXA for Letter, 1" margins).
// Cell text may contain HTML sub/sup, decoded via htmlToRuns().
function aoaToWordTable(aoa, colWidths) {
  const borderDef = { style: docx.BorderStyle.SINGLE, size: 1, color: '999999' };
  const borders   = { top: borderDef, bottom: borderDef, left: borderDef, right: borderDef };
  const CM = { top: 60, bottom: 60, left: 100, right: 100 }; // cell margins

  return new docx.Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: docx.WidthType.DXA },
    columnWidths: colWidths,
    rows: aoa.map((row, ri) => {
      const isHeader = ri === 0;
      return new docx.TableRow({
        tableHeader: isHeader,
        children: row.map((cell, ci) => {
          const cellStr = cell == null ? '' : String(cell);
          return new docx.TableCell({
            borders,
            margins: CM,
            width: { size: colWidths[ci] || colWidths[colWidths.length - 1], type: docx.WidthType.DXA },
            shading: isHeader
              ? { fill: 'D5E8F0', type: docx.ShadingType.CLEAR }
              : { fill: 'FFFFFF', type: docx.ShadingType.CLEAR },
            children: [new docx.Paragraph({
              children: htmlToRuns(cellStr, isHeader ? { bold: true, size: 18 } : { size: 18 }),
              spacing: { before: 0, after: 0 },
            })],
          });
        }),
      });
    }),
  });
}

// Section heading paragraph (Heading 2 style).
function docxHeading(text) {
  return new docx.Paragraph({
    heading: docx.HeadingLevel.HEADING_2,
    children: [new docx.TextRun({ text, bold: true, size: 22, font: 'Arial' })],
    spacing: { before: 200, after: 80 },
  });
}

// Build and download a Word (.docx) calculation report.
// r = lastResult (the most recent compute() output); all values come
// directly from r/state — no new calculations or citations are added.
async function exportReportDOCX(r) {
  if (typeof docx === 'undefined') {
    try { await loadScript(CDN_DOCX); } catch(e) {
      alert('Word export library failed to load (requires internet access to unpkg.com). Please check your connection and try again.');
      return;
    }
  }
  if (typeof docx === 'undefined') {
    alert('Word export library failed to load. Please check your connection and try again.');
    return;
  }
  if (!r) {
    alert('No results to export yet — please check the inputs above.');
    return;
  }
  const s = state;

  // ---- Title block: appears in the Word Header (repeats every page) ----
  // Uses true Word page-number fields (PageNumber.CURRENT/TOTAL_PAGES),
  // not a static per-section index — unlike the PDF/print approach where
  // CSS @page counters are unsupported by Chrome for DOM content.
  const fmtDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined,
        { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  const BDR = { style: docx.BorderStyle.SINGLE, size: 1, color: '999999' };
  const TBDR = { top: BDR, bottom: BDR, left: BDR, right: BDR };
  const TCM  = { top: 60, bottom: 60, left: 100, right: 100 };
  const TBLW = 9360; // content width DXA (Letter, 1" margins)

  function tbCell(children, width, opts) {
    return new docx.TableCell({
      borders: TBDR, margins: TCM,
      width: { size: width, type: docx.WidthType.DXA },
      shading: { fill: 'FFFFFF', type: docx.ShadingType.CLEAR },
      ...opts,
      children,
    });
  }
  function tbPara(runs, opts) {
    return new docx.Paragraph({ children: runs, spacing: { before: 0, after: 0 }, ...opts });
  }
  function tbLabel(text) {
    return new docx.TextRun({ text, size: 14, color: '666666', bold: false, font: 'Arial' });
  }
  function tbVal(text) {
    return new docx.TextRun({ text: text || '—', size: 18, bold: false, font: 'Arial' });
  }
  function tbValBold(text) {
    return new docx.TextRun({ text: text || '—', size: 22, bold: true, font: 'Arial' });
  }

  const titleBlockTable = new docx.Table({
    width: { size: TBLW, type: docx.WidthType.DXA },
    columnWidths: [3000, 3680, 2680],
    rows: [
      // Row 1: Company | Project + Section | Job Ref + Sheet no.
      new docx.TableRow({ children: [
        tbCell([tbPara([tbValBold(s.companyName || 'Company')])], 3000,
               { shading: { fill: 'EAF3FB', type: docx.ShadingType.CLEAR }, verticalAlign: docx.VerticalAlign.CENTER }),
        tbCell([
          tbPara([tbLabel('Project: '), tbVal(s.projectName)]),
          tbPara([tbLabel('Section: '), tbVal(s.sectionName)]),
        ], 3680),
        tbCell([
          tbPara([tbLabel('Job Ref.: '), tbVal(s.jobRef)]),
          tbPara([
            tbLabel('Sheet: '),
            new docx.TextRun({ children: [docx.PageNumber.CURRENT], size: 18, font: 'Arial' }),
            new docx.TextRun({ text: ' / ', size: 18, font: 'Arial' }),
            new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES], size: 18, font: 'Arial' }),
          ]),
        ], 2680),
      ]}),
      // Row 2: Calc. by | Chk'd by | App'd by
      new docx.TableRow({ children: [
        tbCell([
          tbPara([tbLabel('Calc. by: '), tbVal(s.engineer)]),
          tbPara([tbLabel('Date: '),     tbVal(fmtDate(s.projectDate))]),
        ], 3000),
        tbCell([
          tbPara([tbLabel('Chk’d by: '), tbVal(s.chkdBy)]),
          tbPara([tbLabel('Date: '),          tbVal(fmtDate(s.chkdDate))]),
        ], 3680),
        tbCell([
          tbPara([tbLabel('App’d by: '), tbVal(s.appdBy)]),
          tbPara([tbLabel('Date: '),          tbVal(fmtDate(s.appdDate))]),
        ], 2680),
      ]}),
    ],
  });

  // ---- Document body -------------------------------------------------------
  const children = [];

  // Report title
  children.push(new docx.Paragraph({
    heading: docx.HeadingLevel.HEADING_1,
    children: [new docx.TextRun({
      text: 'Wind Load Report — ASCE/SEI 7-22, Chapters 26–32',
      bold: true, size: 28, font: 'Arial',
    })],
    spacing: { before: 0, after: 120 },
  }));

  // Generated note
  const modeTxt = s.mode === 'mwfrs'
    ? 'Main Wind Force Resisting System (MWFRS) — Envelope Procedure (Ch. 28)'
    : 'Components & Cladding (C&C) (Ch. 30)';
  children.push(new docx.Paragraph({
    children: [new docx.TextRun({
      text: 'Calculation procedure: ' + modeTxt + '  |  '
          + 'Report generated ' + new Date().toLocaleDateString(undefined,
            { year: 'numeric', month: 'long', day: 'numeric' })
          + ' — values reflect the inputs and computed results at the time of export.',
      size: 16, italics: true, color: '666666', font: 'Arial',
    })],
    spacing: { before: 0, after: 240 },
  }));

  // 1. Input Data
  children.push(docxHeading('1. Project & Input Data — ASCE/SEI 7-22, Chapters 26–32'));
  children.push(aoaToWordTable(inputDataAOA(r), [3400, 2900, 3060]));
  children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  // 2. Design Summary
  children.push(docxHeading('2. Design Summary'));
  children.push(aoaToWordTable(designSummaryAOA(r), [6000, 3360]));
  children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  // 3. Step-by-Step Calculation
  children.push(docxHeading('3. Step-by-Step Calculation — ASCE/SEI 7-22 Ch. 26'));
  children.push(aoaToWordTable(stepsAOA(r.steps), [1300, 2300, 4000, 1760]));
  children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));

  // 4. Pressure zone tables
  if (s.mode === 'mwfrs') {
    children.push(docxHeading('4. MWFRS Design Pressures — Eq. 28.3-1, Figs. 28.3-1/28.3-2'));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Load Case 1 (Zones 1–4, 1E–4E) — Fig. 28.3-1', bold: true, size: 18, font: 'Arial' })], spacing: { before: 80, after: 40 } }));
    const lc1Aoa = zoneTableAOA(r.mwfrsLC1, false);
    const lc1Cols = lc1Aoa[0] ? distributeWidth(lc1Aoa[0].length, TBLW) : [TBLW];
    children.push(aoaToWordTable(lc1Aoa, lc1Cols));
    children.push(new docx.Paragraph({ children: [], spacing: { before: 120, after: 40 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Load Case 2 (Zones 1–6, 1E–6E) — Fig. 28.3-1', bold: true, size: 18, font: 'Arial' })], spacing: { before: 0, after: 40 } }));
    const lc2Aoa = zoneTableAOA(r.mwfrsLC2, false);
    const lc2Cols = lc2Aoa[0] ? distributeWidth(lc2Aoa[0].length, TBLW) : [TBLW];
    children.push(aoaToWordTable(lc2Aoa, lc2Cols));
  } else {
    children.push(docxHeading('4. C&C Design Pressures — Eq. 30.3-1, Figs. 30.3-1/30.3-2'));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Walls — Zones 4 & 5 — Fig. 30.3-1', bold: true, size: 18, font: 'Arial' })], spacing: { before: 80, after: 40 } }));
    const wallAoa = zoneTableAOA(r.ccWall, true);
    children.push(aoaToWordTable(wallAoa, distributeWidth(wallAoa[0] ? wallAoa[0].length : 3, TBLW)));
    children.push(new docx.Paragraph({ children: [], spacing: { before: 120, after: 40 } }));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Roof — Fig. 30.3-2', bold: true, size: 18, font: 'Arial' })], spacing: { before: 0, after: 40 } }));
    const roofAoa = zoneTableAOA(r.ccRoof, true);
    children.push(aoaToWordTable(roofAoa, distributeWidth(roofAoa[0] ? roofAoa[0].length : 3, TBLW)));
    if (s.hasOverhang && r.ccOverhang) {
      children.push(new docx.Paragraph({ children: [], spacing: { before: 120, after: 40 } }));
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Roof Overhangs — Sec. 30.7', bold: true, size: 18, font: 'Arial' })], spacing: { before: 0, after: 40 } }));
      const ohAoa = zoneTableAOA(r.ccOverhang, true, OVERHANG_ZONE_LABELS);
      children.push(aoaToWordTable(ohAoa, distributeWidth(ohAoa[0] ? ohAoa[0].length : 3, TBLW)));
    }
  }

  // 5. Parapet (conditional)
  if (s.hasParapet && r.parapet) {
    const p = r.parapet;
    const lenUnit = s.unitSystem === 'SI' ? 'm' : 'ft';
    children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));
    children.push(docxHeading('5. Parapet Wind Pressures — Sec. 27.3.4/28.3.4 (MWFRS); Sec. 30.6 (C&C)'));
    const parapetAoa = [
      ['Quantity', 'Value'],
      ['z (top of parapet), ' + lenUnit, fmt(lengthOut(p.zParapet), 1)],
      ['Kh at parapet', fmt(p.khp, 3)],
      ['qp, ' + pUnit(), fmt(pVal(p.qp), 2)],
      ['pp windward (GCpn=+1.5), ' + pUnit(), fmt(pVal(p.ppWindward), 2)],
      ['pp leeward (GCpn=−1.0), ' + pUnit(), fmt(pVal(p.ppLeeward), 2)],
      ['Total combined pp, ' + pUnit(), fmt(pVal(p.ppTotal), 2)],
    ];
    children.push(aoaToWordTable(parapetAoa, [6000, 3360]));
    children.push(new docx.Paragraph({ children: [], spacing: { before: 80, after: 40 } }));
    const ccpAoa = ccParapetAOA(p.ccParapet, PARAPET_ZONE_LABELS);
    children.push(aoaToWordTable(ccpAoa, distributeWidth(ccpAoa[0] ? ccpAoa[0].length : 3, TBLW)));
  }
  let extraSecNum = 5 + (s.hasParapet && r.parapet ? 1 : 0);

  // Attached Canopy (conditional) — Sec. 30.9
  if (s.hasCanopy && r.canopy) {
    extraSecNum++;
    const c = r.canopy;
    children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));
    children.push(docxHeading(extraSecNum + '. Attached Canopy Wind Pressures — Sec. 30.9, Eq. 30.9-1'));
    children.push(aoaToWordTable(canopySummaryAOA(c, r.qh), [6000, 3360]));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Separate Surfaces (Fastener Design) — ' + c.figRefSep, bold: true, size: 18, font: 'Arial' })], spacing: { before: 120, after: 40 } }));
    const sepAoa = canopySeparateAOA(c);
    children.push(aoaToWordTable(sepAoa, distributeWidth(sepAoa[0].length, TBLW)));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Net/Combined (Structural Design) — ' + c.figRefNet, bold: true, size: 18, font: 'Arial' })], spacing: { before: 120, after: 40 } }));
    const netAoa = canopyNetAOA(c);
    children.push(aoaToWordTable(netAoa, distributeWidth(netAoa[0].length, TBLW)));
  }

  // Circular Bins, Silos, and Tanks (conditional) — Sec. 30.10
  if (s.hasCircularTank && r.circTank) {
    extraSecNum++;
    const t = r.circTank;
    children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));
    children.push(docxHeading(extraSecNum + '. Circular Bins, Silos, and Tanks — Sec. 30.10, Eq. 30.10-1'));
    children.push(aoaToWordTable(circTankSummaryAOA(t, r.qh), [6000, 3360]));
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'External Walls — Sec. 30.10.2, Eqs. 30.10-2 to 30.10-4', bold: true, size: 18, font: 'Arial' })], spacing: { before: 120, after: 40 } }));
    const tWallAoa = circTankWallAOA(t);
    children.push(aoaToWordTable(tWallAoa, distributeWidth(tWallAoa[0].length, TBLW)));
    if (t.isElevated && t.underside) {
      children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: 'Underside of Elevated Bin — Sec. 30.10.5', bold: true, size: 18, font: 'Arial' })], spacing: { before: 120, after: 40 } }));
      const tUndAoa = circTankUndersideAOA(t);
      children.push(aoaToWordTable(tUndAoa, distributeWidth(tUndAoa[0].length, TBLW)));
    }
  }

  // 6+. Open Building — Free Roof (conditional)
  if (r.openRoof) {
    const o = r.openRoof;
    const secNum = extraSecNum + 1;
    children.push(new docx.Paragraph({ children: [], spacing: { before: 160, after: 0 } }));
    children.push(docxHeading(secNum + '. Open Building — Free Roof — Sec. 27.3.2, Eq. 27.3-2'));
    const openSummaryAoa = [
      ['Quantity', 'Value'],
      ['Gust factor, G', fmt(o.G, 2)],
      ['h / L', fmt(o.hL, 3)],
    ];
    children.push(aoaToWordTable(openSummaryAoa, [6000, 3360]));
    if (!o.note4Applies && o.gamma0180) {
      children.push(new docx.Paragraph({ children: [], spacing: { before: 80, after: 40 } }));
      const gAoa = openRoofGammaAOA(o.gamma0180);
      children.push(aoaToWordTable(gAoa, distributeWidth(gAoa[0] ? gAoa[0].length : 4, TBLW)));
    }
    if (o.fig277) {
      children.push(new docx.Paragraph({ children: [], spacing: { before: 80, after: 40 } }));
      const zAoa = openRoofZoneAOA(o.fig277);
      children.push(aoaToWordTable(zAoa, distributeWidth(zAoa[0] ? zAoa[0].length : 4, TBLW)));
    }
  }

  // ---- Assemble document --------------------------------------------------
  const wordDoc = new docx.Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run:       { size: 28, bold: true, font: 'Arial', color: '2E75B6' },
          paragraph: { spacing: { before: 0, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run:       { size: 22, bold: true, font: 'Arial', color: '2E75B6' },
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size:   { width: 12240, height: 15840 }, // US Letter (DXA: 1440 per inch)
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1" margins
        },
      },
      headers: {
        default: new docx.Header({
          children: [
            titleBlockTable,
            new docx.Paragraph({ children: [], spacing: { before: 60, after: 60 } }),
          ],
        }),
      },
      children,
    }],
  });

  // ---- Download -----------------------------------------------------------
  const blob = await docx.Packer.toBlob(wordDoc);
  const nameBase = (s.projectName || 'Wind_Load_Report')
    .replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Wind_Load_Report';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nameBase + '_ASCE7-22_Wind.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// Distribute totalDXA evenly across nCols, first col gets any remainder.
function distributeWidth(nCols, totalDXA) {
  if (!nCols) return [totalDXA];
  const base = Math.floor(totalDXA / nCols);
  const rem  = totalDXA - base * nCols;
  return Array.from({ length: nCols }, (_, i) => i === 0 ? base + rem : base);
}

/* =====================================================================
   RTF EXPORT — Pure JavaScript, no external library required.
   Data source: same AOA helper functions used by Excel and Word exports.
   RTF control-word references: Microsoft RTF Specification 1.9.1.
   ===================================================================== */

// Escape RTF special characters (\, {, }) and encode non-ASCII as \uN?
// unicode escapes.  Must be called on plain-text strings (after entity
// decoding), NOT on strings that already contain RTF control words.
function rtfEsc(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], code = s.charCodeAt(i);
    if      (c === '\\') o += '\\\\';
    else if (c === '{')  o += '\\{';
    else if (c === '}')  o += '\\}';
    else if (code > 127) o += '\\u' + code + '?';  // RTF 1.9.1 §2.1.1
    else                 o += c;
  }
  return o;
}

// Convert HTML fragment (plain text + <sub>/<sup>/<b>/<i> inline tags +
// HTML entities) into an RTF inline string.  Uses the DOM to decode
// entities (&mdash; &deg; etc.) — same approach as stripHtml().
// Produces RTF \sub / \super control words for subscript/superscript —
// these are native RTF inline formatting (RTF spec §2.6.3).
function htmlToRtf(html) {
  if (html == null) return '';
  const s = String(html);
  const toks = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let pos = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > pos) toks.push({ t: 'txt', v: s.slice(pos, m.index) });
    toks.push({ t: 'tag', close: m[1] === '/', tag: m[2].toLowerCase() });
    pos = re.lastIndex;
  }
  if (pos < s.length) toks.push({ t: 'txt', v: s.slice(pos) });

  const el = document.createElement('div');
  let out = '';
  for (const tok of toks) {
    if (tok.t === 'tag') {
      if (!tok.close) {
        if (tok.tag === 'sub')             out += '{\\sub ';
        else if (tok.tag === 'sup')        out += '{\\super ';
        else if (tok.tag === 'b')          out += '{\\b ';
        else if (tok.tag === 'i')          out += '{\\i ';
      } else {
        if (tok.tag === 'sub' || tok.tag === 'sup') out += '\\nosupersub}';
        else if (tok.tag === 'b' || tok.tag === 'i') out += '}';
      }
    } else {
      el.innerHTML = tok.v;   // decode &mdash; &deg; &times; etc. via DOM
      out += rtfEsc(el.textContent || el.innerText || '');
    }
  }
  return out;
}

// Convert AOA (array-of-arrays) to an RTF table string.
// colWidths: column widths in twips (1440 twips = 1 inch).
// Row 0 = header row: bold text + light-blue cell fill (\clcbpat3 → #D5E8F0).
// Cell borders: single 0.75pt rule on all four sides.
function aoaToRtfTable(aoa, colWidths) {
  if (!aoa || !aoa.length) return '';
  // RTF border spec — same on all sides, 0.75pt (10 half-points)
  const BDR = '\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10' +
              '\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10';
  let rtf = '';
  aoa.forEach((row, ri) => {
    const isHdr = ri === 0;
    const n = row.length;
    // Row header: \trowd = start row; \trgaph108 = default cell spacing
    rtf += '\\trowd\\trgaph108\\trleft0\n';
    // Cell definitions — cumulative right-edge positions (\cellxN)
    let cumX = 0;
    for (let ci = 0; ci < n; ci++) {
      const w = (colWidths && colWidths[ci]) || Math.floor(9360 / n);
      cumX += w;
      // \clcbpat3 → background colour 3 from \colortbl (#D5E8F0, light blue)
      rtf += BDR + (isHdr ? ' \\clcbpat3' : '') + ' \\cellx' + cumX + '\n';
    }
    // Cell content: \pard\intbl resets paragraph props inside a table cell
    for (let ci = 0; ci < n; ci++) {
      const v = row[ci] != null ? String(row[ci]) : '';
      const inner = htmlToRtf(v);
      rtf += '\\pard\\intbl\\sa0\\sb0' +
             (isHdr ? '{\\b ' + inner + '}' : inner) + '\\cell\n';
    }
    rtf += '\\row\n';
  });
  // \pard after \row resets paragraph context (required after RTF table)
  rtf += '\\pard\\sa0\\par\n';
  return rtf;
}

// RTF Heading-2 style paragraph: bold 12pt (#2 blue), space before/after.
function rtfH2(text) {
  return '\\pard\\sb200\\sa80{\\b\\fs24\\cf2 ' + rtfEsc(text) + '}\\cf1\\par\n';
}

// Build and download a Rich Text Format (.rtf) wind-load report.
// r = result object returned by compute().  No external library needed —
// RTF is plain text with control words, assembled and downloaded via Blob.
function exportReportRTF(r) {
  if (!r) { alert('No results to export yet — please check the inputs above.'); return; }
  const s = state;

  const fmtDate = iso => {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString(undefined,
      { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // --- RTF document header ---
  // \colortbl colour indices (1-based):
  //   1 = default black  (#000000)
  //   2 = brand blue     (#1565C0)
  //   3 = header fill    (#D5E8F0)  — matches table.title-block CSS
  //   4 = muted label    (#64748B)
  const colorTbl =
    '{\\colortbl;' +
    '\\red0\\green0\\blue0;' +            // 1 — default text
    '\\red21\\green101\\blue192;' +       // 2 — brand blue (#1565C0)
    '\\red213\\green232\\blue240;' +      // 3 — header fill (#D5E8F0)
    '\\red100\\green116\\blue139;}';      // 4 — muted (#64748B)

  const chunks = [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0',
    '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}',
    colorTbl,
    // Page size: US Letter 8.5"×11" = 12240×15840 twips (1440 twips = 1")
    // Margins: 1" all sides = 1440 twips
    '\\paperw12240\\paperh15840\\margl1440\\margr1440\\margt1440\\margb1440',
    '\\widowctrl\\hyphauto0',
  ];

  // --- Title-block info table (4 cols) ---
  // Mirrors the 2-row title block from buildTitleBlockHTML(), but condensed
  // to 2 rows × 4 cols so it fits the RTF table model without page headers.
  const tbAoa = [
    ['Company', 'Project', 'Section', 'Job Ref.'],
    [
      s.companyName || '—',
      (s.projectName || '—') + (s.projectNumber ? ' (' + s.projectNumber + ')' : ''),
      s.sectionName  || '—',
      s.jobRef       || '—',
    ],
    ['Calc. by / Date', "Chk’d by / Date", "App’d by / Date", 'Risk Category'],
    [
      (s.engineer || '—') + '   ' + fmtDate(s.projectDate),
      (s.chkdBy   || '—') + '   ' + fmtDate(s.chkdDate),
      (s.appdBy   || '—') + '   ' + fmtDate(s.appdDate),
      s.riskCategory || '—',
    ],
  ];
  chunks.push(aoaToRtfTable(tbAoa, distributeWidth(4, 9360)));

  // --- Report title ---
  chunks.push(
    '\\pard\\sb120\\sa60{\\b\\fs32\\cf2 ' +
    rtfEsc('Wind Load Report — ASCE/SEI 7-22, Chapters 26–32') +
    '}\\cf1\\par'
  );
  const modeTxt = s.mode === 'mwfrs'
    ? 'Main Wind Force Resisting System (MWFRS) — Envelope Procedure (Ch. 28)'
    : 'Components & Cladding (C&C) (Ch. 30)';
  chunks.push(
    '\\pard\\sa120{\\fs18\\cf4 Procedure: ' + rtfEsc(modeTxt) +
    '  |  Report generated ' + rtfEsc(new Date().toLocaleDateString(undefined,
      { year: 'numeric', month: 'long', day: 'numeric' })) +
    '}\\cf1\\par'
  );

  // --- 1. Input Data ---
  chunks.push(rtfH2('1. Project & Input Data — ASCE/SEI 7-22, Chapters 26–32'));
  chunks.push(aoaToRtfTable(inputDataAOA(r), [3400, 2900, 3060]));

  // --- 2. Design Summary ---
  chunks.push(rtfH2('2. Design Summary'));
  chunks.push(aoaToRtfTable(designSummaryAOA(r), [6000, 3360]));

  // --- 3. Step-by-Step Calculation ---
  chunks.push(rtfH2('3. Step-by-Step Calculation — ASCE/SEI 7-22 Ch. 26'));
  chunks.push(aoaToRtfTable(stepsAOA(r.steps), [1300, 2300, 4000, 1760]));

  // --- 4. Pressure zone tables (MWFRS or C&C) ---
  if (s.mode === 'mwfrs') {
    chunks.push(rtfH2('4. MWFRS Design Pressures — Eq. 28.3-1, Figs. 28.3-1/28.3-2'));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Load Case 1 (Zones 1–4, 1E–4E) — Fig. 28.3-1') + '}\\par\n');
    const lc1 = zoneTableAOA(r.mwfrsLC1, false);
    chunks.push(aoaToRtfTable(lc1, distributeWidth(lc1[0] ? lc1[0].length : 4, 9360)));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Load Case 2 (Zones 1–6, 1E–6E) — Fig. 28.3-1') + '}\\par\n');
    const lc2 = zoneTableAOA(r.mwfrsLC2, false);
    chunks.push(aoaToRtfTable(lc2, distributeWidth(lc2[0] ? lc2[0].length : 4, 9360)));
  } else {
    chunks.push(rtfH2('4. C&C Design Pressures — Eq. 30.3-1, Figs. 30.3-1/30.3-2'));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Walls — Zones 4 & 5 — Fig. 30.3-1') + '}\\par\n');
    const wallAoa = zoneTableAOA(r.ccWall, true);
    chunks.push(aoaToRtfTable(wallAoa, distributeWidth(wallAoa[0] ? wallAoa[0].length : 3, 9360)));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Roof — Fig. 30.3-2') + '}\\par\n');
    const roofAoa = zoneTableAOA(r.ccRoof, true);
    chunks.push(aoaToRtfTable(roofAoa, distributeWidth(roofAoa[0] ? roofAoa[0].length : 3, 9360)));
    if (s.hasOverhang && r.ccOverhang) {
      chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Roof Overhangs — Sec. 30.7') + '}\\par\n');
      const ohAoa = zoneTableAOA(r.ccOverhang, true, OVERHANG_ZONE_LABELS);
      chunks.push(aoaToRtfTable(ohAoa, distributeWidth(ohAoa[0] ? ohAoa[0].length : 3, 9360)));
    }
  }

  // --- 5. Parapet (conditional) ---
  if (s.hasParapet && r.parapet) {
    const p = r.parapet;
    const lenUnit = s.unitSystem === 'SI' ? 'm' : 'ft';
    chunks.push(rtfH2('5. Parapet Wind Pressures — Sec. 27.3.4/28.3.4 (MWFRS); Sec. 30.6 (C&C)'));
    // Plain-text labels (no sub/super needed here — matches Word export style)
    const parapetSumAoa = [
      ['Quantity', 'Value'],
      ['z (top of parapet), ' + lenUnit,           fmt(lengthOut(p.zParapet), 1)],
      ['Kh at parapet',                             fmt(p.khp, 3)],
      ['qp, ' + pUnit(),                            fmt(pVal(p.qp), 2)],
      ['pp windward (GCpn=+1.5), ' + pUnit(),       fmt(pVal(p.ppWindward), 2)],
      ['pp leeward (GCpn=-1.0), ' + pUnit(),        fmt(pVal(p.ppLeeward), 2)],
      ['Total combined pp, ' + pUnit(),              fmt(pVal(p.ppTotal), 2)],
    ];
    chunks.push(aoaToRtfTable(parapetSumAoa, [6000, 3360]));
    const ccpAoa = ccParapetAOA(p.ccParapet, PARAPET_ZONE_LABELS);
    chunks.push(aoaToRtfTable(ccpAoa, distributeWidth(ccpAoa[0] ? ccpAoa[0].length : 3, 9360)));
  }
  let extraSecNumR = 5 + (s.hasParapet && r.parapet ? 1 : 0);

  // --- Attached Canopy (conditional) — Sec. 30.9 ---
  if (s.hasCanopy && r.canopy) {
    extraSecNumR++;
    const c = r.canopy;
    chunks.push(rtfH2(extraSecNumR + '. Attached Canopy Wind Pressures — Sec. 30.9, Eq. 30.9-1'));
    chunks.push(aoaToRtfTable(canopySummaryAOA(c, r.qh), [6000, 3360]));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Separate Surfaces (Fastener Design) — ' + c.figRefSep) + '}\\par\n');
    const sepAoa = canopySeparateAOA(c);
    chunks.push(aoaToRtfTable(sepAoa, distributeWidth(sepAoa[0].length, 9360)));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Net/Combined (Structural Design) — ' + c.figRefNet) + '}\\par\n');
    const netAoa = canopyNetAOA(c);
    chunks.push(aoaToRtfTable(netAoa, distributeWidth(netAoa[0].length, 9360)));
  }

  // --- Circular Bins, Silos, and Tanks (conditional) — Sec. 30.10 ---
  if (s.hasCircularTank && r.circTank) {
    extraSecNumR++;
    const t = r.circTank;
    chunks.push(rtfH2(extraSecNumR + '. Circular Bins, Silos, and Tanks — Sec. 30.10, Eq. 30.10-1'));
    chunks.push(aoaToRtfTable(circTankSummaryAOA(t, r.qh), [6000, 3360]));
    chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('External Walls — Sec. 30.10.2, Eqs. 30.10-2 to 30.10-4') + '}\\par\n');
    const tWallAoa = circTankWallAOA(t);
    chunks.push(aoaToRtfTable(tWallAoa, distributeWidth(tWallAoa[0].length, 9360)));
    if (t.isElevated && t.underside) {
      chunks.push('\\pard\\sb80\\sa40{\\b ' + rtfEsc('Underside of Elevated Bin — Sec. 30.10.5') + '}\\par\n');
      const tUndAoa = circTankUndersideAOA(t);
      chunks.push(aoaToRtfTable(tUndAoa, distributeWidth(tUndAoa[0].length, 9360)));
    }
  }

  // --- N. Open Building — Free Roof (conditional) ---
  if (r.openRoof) {
    const o = r.openRoof;
    const secNum = extraSecNumR + 1;
    chunks.push(rtfH2(secNum + '. Open Building — Free Roof — Sec. 27.3.2, Eq. 27.3-2'));
    const openSumAoa = [
      ['Quantity', 'Value'],
      ['Gust factor, G', fmt(o.G, 2)],
      ['h / L',          fmt(o.hL, 3)],
    ];
    chunks.push(aoaToRtfTable(openSumAoa, [6000, 3360]));
    if (!o.note4Applies && o.gamma0180) {
      const gAoa = openRoofGammaAOA(o.gamma0180);
      chunks.push(aoaToRtfTable(gAoa, distributeWidth(gAoa[0] ? gAoa[0].length : 4, 9360)));
    }
    if (o.fig277) {
      const zAoa = openRoofZoneAOA(o.fig277);
      chunks.push(aoaToRtfTable(zAoa, distributeWidth(zAoa[0] ? zAoa[0].length : 4, 9360)));
    }
  }

  chunks.push('}');   // close \rtf1 root group

  // --- Download ---
  const blob = new Blob([chunks.join('\n')], { type: 'application/rtf' });
  const nameBase = (s.projectName || 'Wind_Load_Report')
    .replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Wind_Load_Report';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nameBase + '_ASCE7-22_Wind.rtf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* =====================================================================
   EXCEL EXPORT (SheetJS)
   Mirrors the printable report (buildReportHTML) section-for-section,
   as plain arrays-of-arrays (AOA) — same r/state data, same labels and
   ASCE/SEI 7-22 clause references, no new calculations or citations.
   ===================================================================== */

// Strips HTML tags/entities down to plain text (for Excel cell values).
// Uses a detached <div> so &mdash;/&deg;/<sub> etc. decode correctly.
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

// AOA mirror of zoneTableHTML(rows, dual, labels) — same columns/labels.
function zoneTableAOA(rows, dual, labels) {
  const lbl = labels || ZONE_LABELS;
  const header = dual
    ? ['Zone', '(GCp) range', 'pmin (outward / suction), ' + pUnit(), 'pmax (inward / positive), ' + pUnit()]
    : ['Zone', '(GCpf)', 'pmin (outward / suction), ' + pUnit(), 'pmax (inward / positive), ' + pUnit()];
  const aoa = [header];
  rows.forEach(r => {
    const gcStr = dual
      ? fmt(r.gcp.neg, 2) + ' to ' + fmt(r.gcp.pos, 2)
      : fmt(r.gcpf, 2);
    aoa.push([lbl[r.zone] || r.zone, gcStr, fmt(pVal(r.p.min), 2), fmt(pVal(r.p.max), 2)]);
  });
  return aoa;
}

// AOA mirror of ccParapetTableHTML(rows, labels).
function ccParapetAOA(rows, labels) {
  const lbl = labels || ZONE_LABELS;
  const aoa = [['Zone', '(GCp) Load A', 'pA, ' + pUnit(), '(GCp) Load B', 'pB, ' + pUnit()]];
  rows.forEach(r => {
    aoa.push([lbl[r.zone] || r.zone, fmt(r.gcA, 2), fmt(pVal(r.pA), 2), fmt(r.gcB, 2), fmt(pVal(r.pB), 2)]);
  });
  return aoa;
}

// AOA mirror of reportCanopyHTML's summary table (Sec. 30.9).
function canopySummaryAOA(c, qh) {
  const aU = state.unitSystem === 'SI' ? 'm²' : 'ft²';
  return [
    ['Quantity', 'Value'],
    ['Effective wind area A, ' + aU, fmt(areaOut(c.A), 1)],
    ['hc / he (canopy ht. / eave ht.)', fmt(c.hcRatio, 2)],
    ['qh, ' + pUnit(), fmt(pVal(qh), 2)],
  ];
}

// AOA mirror of reportCanopyHTML's separate-surfaces table (Figs. 30.9-1A/2A).
function canopySeparateAOA(c) {
  return [
    ['Surface', '(GCp)', 'Pressure, ' + pUnit()],
    ['Upper surface, negative (uplift)', fmt(c.sepNegUpper, 3), fmt(pVal(c.pSepUpperNeg), 2)],
    ['Lower surface, negative (uplift)', fmt(c.sepNegLower, 3), fmt(pVal(c.pSepLowerNeg), 2)],
    ['Either surface, positive (downward)', fmt(c.sepPos, 3), fmt(pVal(c.pSepPos), 2)],
  ];
}

// AOA mirror of reportCanopyHTML's net/combined table (Figs. 30.9-1B/2B).
function canopyNetAOA(c) {
  return [
    ['Case (band: ' + c.netBand + ')', '(GCp)', 'Pressure, ' + pUnit()],
    ['Negative (net uplift)', fmt(c.netNeg, 3), fmt(pVal(c.pNetNeg), 2)],
    ['Positive (net downward)', fmt(c.netPos, 3), fmt(pVal(c.pNetPos), 2)],
  ];
}

// AOA mirror of reportCircTankHTML's summary table (Sec. 30.10).
function circTankSummaryAOA(t, qh) {
  const lU = state.unitSystem === 'SI' ? 'm' : 'ft';
  return [
    ['Quantity', 'Value'],
    ['Diameter, D, ' + lU, fmt(lengthOut(t.D), 2)],
    ['Cylinder height, H, ' + lU, fmt(lengthOut(t.H), 2)],
    ['H / D', fmt(t.HD, 3)],
    ['qh, ' + pUnit(), fmt(pVal(qh), 2)],
    ['Internal pressure basis', t.isOpenTop
      ? 'Open-topped tank — Eq. 30.10-5, (GCpi) = ' + fmt(t.openGcpi, 3)
      : t.enclosureLabel + ' (Sec. 26.13)'],
  ];
}

// AOA mirror of reportCircTankHTML's external-wall table (Sec. 30.10.2,
// Eqs. 30.10-2 to 30.10-4).
function circTankWallAOA(t) {
  if (t.isOpenTop) {
    const aoa = [['alpha (deg)', 'C(alpha)', '(GCp)', 'p, ' + pUnit()]];
    t.wallRows.forEach(row => aoa.push([fmt(row.alpha, 0), fmt(row.C, 3), fmt(row.gcp, 3), fmt(pVal(row.p), 2)]));
    return aoa;
  }
  const aoa = [['alpha (deg)', 'C(alpha)', '(GCp)', 'pmin, ' + pUnit(), 'pmax, ' + pUnit()]];
  t.wallRows.forEach(row => aoa.push([fmt(row.alpha, 0), fmt(row.C, 3), fmt(row.gcp, 3), fmt(pVal(row.pMin), 2), fmt(pVal(row.pMax), 2)]));
  return aoa;
}

// AOA mirror of reportCircTankHTML's underside-of-elevated-bin table
// (Sec. 30.10.5).
function circTankUndersideAOA(t) {
  const aoa = [['Zone', '(GCp) pos', '(GCp) neg', 'p pos, ' + pUnit(), 'p neg, ' + pUnit()]];
  t.underside.forEach(z => aoa.push([z.zone, fmt(z.gcpPos, 2), fmt(z.gcpNeg, 2), fmt(pVal(z.pPos), 2), fmt(pVal(z.pNeg), 2)]));
  return aoa;
}

// AOA mirror of openRoofGammaTableHTML(gamma0180).
function openRoofGammaAOA(gamma0180) {
  const aoa = [['Wind Direction', 'Load Case', 'CNW', 'CNL', 'pW, ' + pUnit(), 'pL, ' + pUnit()]];
  if (!gamma0180) return aoa;
  const rows = [
    { lbl: 'γ = 0°', lc: 'A', d: gamma0180.gamma0.A },
    { lbl: 'γ = 0°', lc: 'B', d: gamma0180.gamma0.B },
    { lbl: 'γ = 180°', lc: 'A', d: gamma0180.gamma180.A },
    { lbl: 'γ = 180°', lc: 'B', d: gamma0180.gamma180.B }
  ];
  rows.forEach(row => {
    aoa.push([row.lbl, row.lc, fmt(row.d.CNW, 2), fmt(row.d.CNL, 2), fmt(pVal(row.d.pW), 2), fmt(pVal(row.d.pL), 2)]);
  });
  return aoa;
}

// AOA mirror of openRoofZoneTableHTML(fig277).
function openRoofZoneAOA(fig277) {
  const aoa = [['Zone (horiz. distance from windward edge)', 'CN, Load Case A', 'pA, ' + pUnit(), 'CN, Load Case B', 'pB, ' + pUnit()]];
  fig277.zoneKeys.forEach((zk, i) => {
    aoa.push([fig277.zoneLabels[zk], fmt(fig277.A[i].CN, 2), fmt(pVal(fig277.A[i].p), 2), fmt(fig277.B[i].CN, 2), fmt(pVal(fig277.B[i].p), 2)]);
  });
  return aoa;
}

// AOA for the "Input Data" sheet — strips HTML from the same row content
// produced by reportInputDataHTML(), so values/labels/refs stay in sync.
function inputDataAOA(r) {
  const html = reportInputDataHTML(r);
  const div = document.createElement('div');
  div.innerHTML = html;
  const aoa = [['Parameter', 'Value', 'Reference']];
  div.querySelectorAll('tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    aoa.push([stripHtml(cells[0].innerHTML), stripHtml(cells[1].innerHTML), stripHtml(cells[2].innerHTML)]);
  });
  return aoa;
}

// AOA for the "Design Summary" sheet — strips HTML from reportDesignSummaryHTML().
function designSummaryAOA(r) {
  const html = reportDesignSummaryHTML(r);
  const div = document.createElement('div');
  div.innerHTML = html;
  const aoa = [['Quantity', 'Value']];
  div.querySelectorAll('tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    aoa.push([stripHtml(cells[0].innerHTML), stripHtml(cells[1].innerHTML)]);
  });
  return aoa;
}

// AOA for the "Calc Steps" sheet — mirrors stepsTableHTML(r.steps).
function stepsAOA(steps) {
  const aoa = [['Reference', 'Calculation', 'Formula / Substitution', 'Result']];
  steps.forEach(st => {
    aoa.push([stripHtml(st.clause), stripHtml(st.label), stripHtml(st.formula), stripHtml(st.result)]);
  });
  return aoa;
}

// AOA for the "References" sheet — extracted from the live footer citation
// list (same source used by buildReportHTML's References section), one row
// per <li>. No new citation text is generated here.
function referencesAOA() {
  const aoa = [['Where these formulas come from']];
  const ul = document.querySelector('footer.sources .inner ul');
  if (ul) {
    ul.querySelectorAll('li').forEach(li => aoa.push([stripHtml(li.innerHTML)]));
  }
  return aoa;
}

// Appends an AOA as a new sheet, with a leading title row and a blank
// separator row before the header row (for readability in Excel).
function appendAoaSheet(wb, sheetName, title, aoa) {
  const full = [[title], [], ...aoa];
  const ws = XLSX.utils.aoa_to_sheet(full);
  ws['!cols'] = [{ wch: 42 }, { wch: 28 }, { wch: 40 }, { wch: 40 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
}

// Builds and downloads a workbook containing data tables only (Phase 4
// rescope): Project Info header, Input Data, Design Summary, and the
// applicable pressure-zone tables. The step-by-step Calc Steps and
// standalone References sheets are intentionally omitted — the PDF/print
// report carries those; Excel is for tabular data exchange only.
// r should be lastResult (the most recent compute() output).
async function exportReportXLSX(r) {
  if (typeof XLSX === 'undefined') {
    try { await loadScript(CDN_XLSX); } catch(e) {
      alert('Excel export library failed to load (requires internet access to cdnjs.cloudflare.com). Please check your connection and try again.');
      return;
    }
  }
  if (typeof XLSX === 'undefined') {
    alert('Excel export library failed to load. Please check your connection and try again.');
    return;
  }
  if (!r) {
    alert('No results to export yet — please check the inputs above.');
    return;
  }
  const s = state;
  const wb = XLSX.utils.book_new();

  // --- Project Information cover sheet (Phase 3 title-block fields) --------
  // All values are user-entered metadata — nothing here is computed.
  const fmtDate = (iso) => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const infoAOA = [
    ['Field', 'Value'],
    ['Company', s.companyName || ''],
    ['Project', s.projectName || ''],
    ['Project No. / Location', s.projectNumber || ''],
    ['Section', s.sectionName || ''],
    ['Job Ref.', s.jobRef || ''],
    ['Risk Category', s.riskCategory || ''],
    ['Calculation Procedure', s.mode === 'mwfrs'
      ? 'Main Wind Force Resisting System (MWFRS) — Envelope Procedure (Ch. 28)'
      : 'Components & Cladding (C&C) (Ch. 30)'],
    [],
    ['Calc. by', s.engineer || ''],
    ['Date', fmtDate(s.projectDate)],
    ['Chk\'d by', s.chkdBy || ''],
    ['Chk\'d date', fmtDate(s.chkdDate)],
    ['App\'d by', s.appdBy || ''],
    ['App\'d date', fmtDate(s.appdDate)],
  ];
  appendAoaSheet(wb, 'Project Info', 'ASCE/SEI 7-22 Wind Load Calculation — Project Information', infoAOA);

  // --- Data tables ----------------------------------------------------------
  appendAoaSheet(wb, 'Input Data', 'ASCE/SEI 7-22 Wind Load Calculation — Input Data', inputDataAOA(r));
  appendAoaSheet(wb, 'Design Summary', 'Design Summary', designSummaryAOA(r));
  // Calc Steps sheet intentionally omitted (step-by-step derivation belongs
  // in the PDF/print report, not in a data-table workbook).

  if (s.mode === 'mwfrs') {
    appendAoaSheet(wb, 'MWFRS LC1', 'MWFRS Load Case 1 (Zones 1-4, 1E-4E) — Fig. 28.3-1', zoneTableAOA(r.mwfrsLC1, false));
    appendAoaSheet(wb, 'MWFRS LC2', 'MWFRS Load Case 2 (Zones 1-6, 1E-6E) — Fig. 28.3-1', zoneTableAOA(r.mwfrsLC2, false));
    appendAoaSheet(wb, 'MWFRS LC3 (T-zones)', 'MWFRS Load Case 3 T-zones — Fig. 28.3-2' + (r.torsionApplies ? '' : ' (h <= 30 ft: not required, shown for reference)'), zoneTableAOA(r.mwfrsLC3, false));
    appendAoaSheet(wb, 'MWFRS LC4 (T-zones)', 'MWFRS Load Case 4 T-zones — Fig. 28.3-2' + (r.torsionApplies ? '' : ' (h <= 30 ft: not required, shown for reference)'), zoneTableAOA(r.mwfrsLC4, false));
  } else {
    appendAoaSheet(wb, 'C&C Walls', 'C&C Walls — Zones 4 & 5 — Fig. 30.3-1', zoneTableAOA(r.ccWall, true));
    appendAoaSheet(wb, 'C&C Roof', 'C&C Roof — Fig. 30.3-2' + (s.theta <= 7 ? 'A (theta <= 7 deg)' : (s.roofShape === 'hip' ? 'D-G equiv. (hip)' : 'B/C (gable), theta > 7 deg')), zoneTableAOA(r.ccRoof, true));
    if (s.hasOverhang) {
      appendAoaSheet(wb, 'C&C Overhangs', 'Roof Overhangs — Net (Top + Bottom) — Sec. 30.7', zoneTableAOA(r.ccOverhang, true, OVERHANG_ZONE_LABELS));
    }
  }

  if (s.hasParapet && r.parapet) {
    const p = r.parapet;
    const lenUnit = s.unitSystem === 'SI' ? 'm' : 'ft';
    const parapetSummary = [
      ['Quantity', 'Value'],
      ['z (top of parapet), ' + lenUnit, fmt(lengthOut(p.zParapet), 1)],
      ['Kh at parapet', fmt(p.khp, 3)],
      ['qp, ' + pUnit(), fmt(pVal(p.qp), 2)],
      ['p_p, windward (GCpn=+1.5), ' + pUnit(), fmt(pVal(p.ppWindward), 2)],
      ['p_p, leeward (GCpn=-1.0), ' + pUnit(), fmt(pVal(p.ppLeeward), 2)],
      ['Total combined p_p, ' + pUnit(), fmt(pVal(p.ppTotal), 2)],
      [],
      ['C&C Walls — Zones 4 & 5, Load A / Load B — Eq. 30.6-1']
    ];
    appendAoaSheet(wb, 'Parapet', 'Parapet Wind Pressures — Sec. 27.3.4/28.3.4 (MWFRS), Sec. 30.6 (C&C)',
      parapetSummary.concat(ccParapetAOA(p.ccParapet, PARAPET_ZONE_LABELS)));
  }

  if (s.hasCanopy && r.canopy) {
    const c = r.canopy;
    const canopySheet = canopySummaryAOA(c, r.qh)
      .concat([[], ['Separate Surfaces (Fastener Design) — ' + c.figRefSep]])
      .concat(canopySeparateAOA(c))
      .concat([[], ['Net/Combined (Structural Design) — ' + c.figRefNet]])
      .concat(canopyNetAOA(c));
    appendAoaSheet(wb, 'Canopy', 'Attached Canopy Wind Pressures — Sec. 30.9, Eq. 30.9-1', canopySheet);
  }

  if (s.hasCircularTank && r.circTank) {
    const t = r.circTank;
    let tankSheet = circTankSummaryAOA(t, r.qh)
      .concat([[], ['External Walls — Sec. 30.10.2, Eqs. 30.10-2 to 30.10-4']])
      .concat(circTankWallAOA(t));
    if (t.isElevated && t.underside) {
      tankSheet = tankSheet.concat([[], ['Underside of Elevated Bin — Sec. 30.10.5']]).concat(circTankUndersideAOA(t));
    }
    appendAoaSheet(wb, 'Circular Tank', 'Circular Bins, Silos, and Tanks — Sec. 30.10, Eq. 30.10-1', tankSheet);
  }

  if (r.openRoof) {
    const o = r.openRoof;
    const summary = [
      ['Quantity', 'Value'],
      ['Gust factor, G', fmt(o.G, 2)],
      ['h / L', fmt(o.hL, 3)],
      [],
      ['Wind Normal to Ridge/Span — gamma = 0/180 deg' + (o.note4Applies ? ' (per Fig. 27.3-4 Note 4, uses Fig. 27.3-7 table)' : ' — Fig. ' + (o.shape === 'monoslope' ? '27.3-4' : (o.shape === 'pitched' ? '27.3-5' : '27.3-6')))]
    ];
    let aoa = summary.concat(o.note4Applies ? [] : openRoofGammaAOA(o.gamma0180));
    aoa = aoa.concat([[], ['Wind Parallel to Ridge/Span — gamma = 90/270 deg — Fig. 27.3-7']]).concat(openRoofZoneAOA(o.fig277));
    appendAoaSheet(wb, 'Open Roof', 'Open Building — Free Roof Pressures — Sec. 27.3.2, Eq. 27.3-2', aoa);
  }

  // References sheet intentionally omitted (Phase 4): every table row
  // already carries an inline ASCE 7-22 clause/figure/equation citation
  // in its "Reference" column — a standalone sheet would only duplicate
  // what the reader already sees in context. Consistent with Phase 2
  // removal of the same section from the PDF/print report.

  const nameBase = (s.projectName || 'Wind_Load_Report').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Wind_Load_Report';
  XLSX.writeFile(wb, nameBase + '_ASCE7-22_Wind.xlsx');
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
    // Open Building — Free Roof (Sec. 27.3.2) has no (GC<sub>pi</sub>) — omit the suffix for it.
    o.value = k; o.textContent = GCPI[k].noGcpi ? GCPI[k].label : GCPI[k].label + ' (GCpi = ±' + fmt(GCPI[k].pos, 2) + ')';
    if (k === state.enclosure) o.selected = true;
    encSel.appendChild(o);
  });

  document.getElementById('V').value = state.V;
  // K_zt mode init
  const kztModeSeg = document.getElementById('kztModeSeg');
  if (kztModeSeg) {
    kztModeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.val === state.kztMode));
    document.getElementById('kztAutoInputs').style.display = state.kztMode === 'auto' ? '' : 'none';
    document.getElementById('kztManualInput').style.display = state.kztMode === 'manual' ? '' : 'none';
  }
  const kztValEl = document.getElementById('kzt');
  if (kztValEl) kztValEl.value = state.kzt;
  const topoFeatEl = document.getElementById('topoFeature');
  if (topoFeatEl) topoFeatEl.value = state.topoFeature;
  const topoHEl = document.getElementById('topoH');
  if (topoHEl) topoHEl.value = state.topoH;
  const topoLhEl = document.getElementById('topoLh');
  if (topoLhEl) topoLhEl.value = state.topoLh;
  const topoXEl2 = document.getElementById('topoX');
  document.getElementById('groundElev').value = state.groundElev;
  document.getElementById('h').value = state.h;
  document.getElementById('minDim').value = state.minDim;
  const buildingLInit = document.getElementById('buildingL');
  if (buildingLInit) buildingLInit.value = state.buildingL;
  const ccProcSegInit = document.getElementById('ccProcedureSeg');
  if (ccProcSegInit) {
    ccProcSegInit.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.val === state.ccProcedure));
  }
  const mwfrsProcSegInit = document.getElementById('mwfrsProcedureSeg');
  if (mwfrsProcSegInit) {
    mwfrsProcSegInit.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.val === state.mwfrsProcedure));
  }
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

  // Attached Canopy (Sec. 30.9) inputs
  const hasCanopyElInit = document.getElementById('hasCanopy');
  if (hasCanopyElInit) hasCanopyElInit.checked = !!state.hasCanopy;
  const canopyAreaElInit = document.getElementById('canopyArea');
  if (canopyAreaElInit) canopyAreaElInit.value = state.canopyArea;
  const canopyHcElInit = document.getElementById('canopyHc');
  if (canopyHcElInit) canopyHcElInit.value = state.canopyHc;
  const canopyHeElInit = document.getElementById('canopyHe');
  if (canopyHeElInit) canopyHeElInit.value = state.canopyHe;

  // Circular Bins, Silos, and Tanks (Sec. 30.10) inputs
  const hasCircularTankElInit = document.getElementById('hasCircularTank');
  if (hasCircularTankElInit) hasCircularTankElInit.checked = !!state.hasCircularTank;
  const tankDElInit = document.getElementById('tankD');
  if (tankDElInit) tankDElInit.value = state.tankD;
  const tankHElInit = document.getElementById('tankH');
  if (tankHElInit) tankHElInit.value = state.tankH;
  const tankOpenTopElInit = document.getElementById('tankOpenTop');
  if (tankOpenTopElInit) tankOpenTopElInit.checked = !!state.tankOpenTop;
  const tankElevatedElInit = document.getElementById('tankElevated');
  if (tankElevatedElInit) tankElevatedElInit.checked = !!state.tankElevated;

  // Stepped Roofs (Sec. 30.3.2.1, Fig. 30.3-3) inputs
  const hasSteppedRoofElInit = document.getElementById('hasSteppedRoof');
  if (hasSteppedRoofElInit) hasSteppedRoofElInit.checked = !!state.hasSteppedRoof;
  const steppedLowerHElInit = document.getElementById('steppedLowerH');
  if (steppedLowerHElInit) steppedLowerHElInit.value = state.steppedLowerH;
  const steppedLowerWElInit = document.getElementById('steppedLowerW');
  if (steppedLowerWElInit) steppedLowerWElInit.value = state.steppedLowerW;

  // Multispan Gable Roofs (Fig. 30.3-4) inputs
  const hasMultispanRoofElInit = document.getElementById('hasMultispanRoof');
  if (hasMultispanRoofElInit) hasMultispanRoofElInit.checked = !!state.hasMultispanRoof;
  const msModuleWElInit = document.getElementById('msModuleW');
  if (msModuleWElInit) msModuleWElInit.value = state.msModuleW;

  // Sawtooth Roofs (Fig. 30.3-6) inputs
  const hasSawtoothRoofElInit = document.getElementById('hasSawtoothRoof');
  if (hasSawtoothRoofElInit) hasSawtoothRoofElInit.checked = !!state.hasSawtoothRoof;
  const swModuleWElInit = document.getElementById('swModuleW');
  if (swModuleWElInit) swModuleWElInit.value = state.swModuleW;

  // Domed Roofs (Fig. 30.3-7) inputs
  const hasDomeRoofElInit = document.getElementById('hasDomeRoof');
  if (hasDomeRoofElInit) hasDomeRoofElInit.checked = !!state.hasDomeRoof;
  const domeDElInit = document.getElementById('domeD');
  if (domeDElInit) domeDElInit.value = state.domeD;
  const domeFElInit = document.getElementById('domeF');
  if (domeFElInit) domeFElInit.value = state.domeF;
  const domeHDElInit = document.getElementById('domeHD');
  if (domeHDElInit) domeHDElInit.value = state.domeHD;

  // Open Building — Free Roof (Sec. 27.3.2) inputs
  const openRoofShapeEl = document.getElementById('openRoofShape');
  if (openRoofShapeEl) openRoofShapeEl.value = state.openRoofShape;
  const openWindFlowEl = document.getElementById('openWindFlow');
  if (openWindFlowEl) openWindFlowEl.value = state.openWindFlow;
  const openLEl = document.getElementById('openL');
  if (openLEl) openLEl.value = state.openL;
  const ch32VTi = document.getElementById('ch32VT'); if (ch32VTi) ch32VTi.value = state.ch32VT || 100;
  const ch32Aei = document.getElementById('ch32Ae'); if (ch32Aei) ch32Aei.value = state.ch32Ae || 10000;
  const ch32Eni = document.getElementById('ch32Enabled'); if (ch32Eni) ch32Eni.checked = !!state.ch32Enabled;
  const ch32Esi = document.getElementById('ch32Essential'); if (ch32Esi) ch32Esi.checked = !!state.ch32Essential;
  document.body.classList.toggle('ch32-enabled', !!state.ch32Enabled);

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

  // Print title block fields (Phase 3 / report header)
  document.getElementById('companyName').value = state.companyName || '';
  document.getElementById('sectionName').value = state.sectionName || '';
  document.getElementById('jobRef').value = state.jobRef || '';
  document.getElementById('chkdBy').value = state.chkdBy || '';
  document.getElementById('chkdDate').value = state.chkdDate || '';
  document.getElementById('appdBy').value = state.appdBy || '';
  document.getElementById('appdDate').value = state.appdDate || '';

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
    if (document.getElementById('kzt')) document.getElementById('kzt').value = state.kzt;
    document.getElementById('groundElev').value = fmt(lengthOut(state.groundElev), 1);
    document.getElementById('enclosure').value = state.enclosure;
    document.getElementById('h').value = fmt(lengthOut(state.h), 2);
    document.getElementById('minDim').value = fmt(lengthOut(state.minDim), 2);
  const blEl = document.getElementById('buildingL');
  if (blEl) blEl.value = fmt(lengthOut(state.buildingL), 2);
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
    const hasParapetEl = document.getElementById('hasParapet');
    if (hasParapetEl) hasParapetEl.checked = !!state.hasParapet;
    const parapetHeightEl = document.getElementById('parapetHeight');
    if (parapetHeightEl) parapetHeightEl.value = fmt(lengthOut(state.parapetHeight), 2);

    // Attached Canopy (Sec. 30.9) inputs
    const hasCanopyEl2 = document.getElementById('hasCanopy');
    if (hasCanopyEl2) hasCanopyEl2.checked = !!state.hasCanopy;
    const canopyAreaEl2 = document.getElementById('canopyArea');
    if (canopyAreaEl2) canopyAreaEl2.value = fmt(areaOut(state.canopyArea), 1);
    const canopyHcEl2 = document.getElementById('canopyHc');
    if (canopyHcEl2) canopyHcEl2.value = fmt(lengthOut(state.canopyHc), 2);
    const canopyHeEl2 = document.getElementById('canopyHe');
    if (canopyHeEl2) canopyHeEl2.value = fmt(lengthOut(state.canopyHe), 2);

    // Circular Bins, Silos, and Tanks (Sec. 30.10) inputs
    const hasCircularTankEl2 = document.getElementById('hasCircularTank');
    if (hasCircularTankEl2) hasCircularTankEl2.checked = !!state.hasCircularTank;
    const tankDEl2 = document.getElementById('tankD');
    if (tankDEl2) tankDEl2.value = fmt(lengthOut(state.tankD), 2);
    const tankHEl2 = document.getElementById('tankH');
    if (tankHEl2) tankHEl2.value = fmt(lengthOut(state.tankH), 2);
    const tankOpenTopEl2 = document.getElementById('tankOpenTop');
    if (tankOpenTopEl2) tankOpenTopEl2.checked = !!state.tankOpenTop;
    const tankElevatedEl2 = document.getElementById('tankElevated');
    if (tankElevatedEl2) tankElevatedEl2.checked = !!state.tankElevated;

    // Stepped Roofs (Sec. 30.3.2.1, Fig. 30.3-3) inputs
    const hasSteppedRoofEl2 = document.getElementById('hasSteppedRoof');
    if (hasSteppedRoofEl2) hasSteppedRoofEl2.checked = !!state.hasSteppedRoof;
    const steppedLowerHEl2 = document.getElementById('steppedLowerH');
    if (steppedLowerHEl2) steppedLowerHEl2.value = fmt(lengthOut(state.steppedLowerH), 2);
    const steppedLowerWEl2 = document.getElementById('steppedLowerW');
    if (steppedLowerWEl2) steppedLowerWEl2.value = fmt(lengthOut(state.steppedLowerW), 2);

    // Multispan Gable Roofs (Fig. 30.3-4) inputs
    const hasMultispanRoofEl2 = document.getElementById('hasMultispanRoof');
    if (hasMultispanRoofEl2) hasMultispanRoofEl2.checked = !!state.hasMultispanRoof;
    const msModuleWEl2 = document.getElementById('msModuleW');
    if (msModuleWEl2) msModuleWEl2.value = fmt(lengthOut(state.msModuleW), 2);

    // Sawtooth Roofs (Fig. 30.3-6) inputs
    const hasSawtoothRoofEl2 = document.getElementById('hasSawtoothRoof');
    if (hasSawtoothRoofEl2) hasSawtoothRoofEl2.checked = !!state.hasSawtoothRoof;
    const swModuleWEl2 = document.getElementById('swModuleW');
    if (swModuleWEl2) swModuleWEl2.value = fmt(lengthOut(state.swModuleW), 2);

    // Domed Roofs (Fig. 30.3-7) inputs
    const hasDomeRoofEl2 = document.getElementById('hasDomeRoof');
    if (hasDomeRoofEl2) hasDomeRoofEl2.checked = !!state.hasDomeRoof;
    const domeDEl2 = document.getElementById('domeD');
    if (domeDEl2) domeDEl2.value = fmt(lengthOut(state.domeD), 2);
    const domeFEl2 = document.getElementById('domeF');
    if (domeFEl2) domeFEl2.value = fmt(lengthOut(state.domeF), 2);
    const domeHDEl2 = document.getElementById('domeHD');
    if (domeHDEl2) domeHDEl2.value = fmt(lengthOut(state.domeHD), 2);

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

    // Print title block fields (Phase 3 / report header)
    document.getElementById('companyName').value = state.companyName || '';
    document.getElementById('jobRef').value = state.jobRef || '';
    document.getElementById('chkdBy').value = state.chkdBy || '';
    document.getElementById('chkdDate').value = state.chkdDate || '';
    document.getElementById('appdBy').value = state.appdBy || '';
    document.getElementById('appdDate').value = state.appdDate || '';

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
