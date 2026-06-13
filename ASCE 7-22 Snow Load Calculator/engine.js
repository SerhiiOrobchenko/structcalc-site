/* =====================================================================
   ASCE/SEI 7-22 — Roof Snow Load Calculator (Chapter 7)
   Every formula/table value used below is cited by exact Section /
   Equation / Table / Figure number from ASCE/SEI 7-22, "Minimum Design
   Loads and Associated Criteria for Buildings and Other Structures."
   See the "Sources" footer in index.html for the full citation list.

   Internal canonical units: US customary (psf, ft, degrees,
   h.ft2.F/Btu). SI values are shown using either the exact SI table
   entries printed in the Standard (pm,max, rain-on-snow surcharge) or
   straightforward unit conversion (1 kPa = 20.8854 psf, 1 m = 3.28084 ft).
   ===================================================================== */

const PSF_PER_KPA = 20.8854;
const FT_PER_M = 3.28084;

/* ---------------------------------------------------------------------
   Table 7.3-1 — Exposure Factor, Ce
   --------------------------------------------------------------------- */
const CE_TABLE = {
  B:        { label: 'B — Surface Roughness Category B (urban/suburban, Sec. 26.7)', fully: 0.9, partial: 1.0, sheltered: 1.2 },
  C:        { label: 'C — Surface Roughness Category C (open terrain, Sec. 26.7)',   fully: 0.9, partial: 1.0, sheltered: 1.1 },
  D:        { label: 'D — Surface Roughness Category D (flat, unobstructed, Sec. 26.7)', fully: 0.8, partial: 0.9, sheltered: 1.0 },
  treeline: { label: 'Above the tree line, in windswept mountainous areas',              fully: 0.7, partial: 0.8, sheltered: null },
  alaska:   { label: 'Alaska — no trees within a 2 mi (3 km) radius of the site',    fully: 0.7, partial: 0.8, sheltered: null }
};

/* ---------------------------------------------------------------------
   Table 7.3-4 — Ground Snow Load Upper Limit, pm,max, by Risk Category
   --------------------------------------------------------------------- */
const PM_MAX = {
  I:   { psf: 25, kPa: 1.20 },
  II:  { psf: 30, kPa: 1.44 },
  III: { psf: 35, kPa: 1.68 },
  IV:  { psf: 40, kPa: 1.92 }
};

/* ---------------------------------------------------------------------
   Table 7.3-2 — Thermal Factor, Ct (structures not covered by Table 7.3-3)
   --------------------------------------------------------------------- */
const CT_OPTIONS = [
  { key: 'table733', value: null,
    label: 'Heated structure (typical buildings) — Table 7.3-3, interpolated from Rᵣₒₒᶠ and pᵍ' },
  { key: '1.2', value: 1.2,
    label: 'Unheated structure, open-air structure, or cold ventilated roof meeting min. energy-code requirements (Table 7.3-2, Cₜ = 1.2)' },
  { key: '1.3', value: 1.3,
    label: 'Freezer building (Table 7.3-2, Cₜ = 1.3)' },
  { key: '0.85', value: 0.85,
    label: 'Continuously heated greenhouse, Rᵣₒₒᶠ < 2.0 h·ft²·°F/Btu (Table 7.3-2, Cₜ = 0.85)' },
  { key: 'custom', value: null,
    label: 'Custom Cₜ value' }
];

/* ---------------------------------------------------------------------
   Table 7.3-3 — Thermal Factor, Ct, for Heated Structures with
   Unventilated Roofs. Rows = Rroof (h.ft2.F/Btu), Cols = pg (psf).
   Footnote b: for Rroof > 50 (Uroof < 0.020), Ct = 1.2.
   Linear interpolation permitted between tabulated values (Note a).
   --------------------------------------------------------------------- */
const CT33_RROOF = [20, 30, 40, 50];
const CT33_PG_PSF = [10, 20, 30, 40, 50, 60, 70];
const CT33_VALUES = [
  [1.20, 1.11, 1.05, 1.01, 1.00, 1.00, 1.00],
  [1.20, 1.17, 1.14, 1.13, 1.12, 1.11, 1.10],
  [1.20, 1.19, 1.17, 1.16, 1.16, 1.15, 1.15],
  [1.20, 1.20, 1.19, 1.19, 1.19, 1.18, 1.18]
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function bilerp(x, y, xs, ys, table) {
  const xc = clamp(x, xs[0], xs[xs.length - 1]);
  const yc = clamp(y, ys[0], ys[ys.length - 1]);
  let i0 = 0; while (i0 < xs.length - 2 && xs[i0 + 1] < xc) i0++;
  let j0 = 0; while (j0 < ys.length - 2 && ys[j0 + 1] < yc) j0++;
  const i1 = i0 + 1, j1 = j0 + 1;
  const tx = (xs[i1] === xs[i0]) ? 0 : (xc - xs[i0]) / (xs[i1] - xs[i0]);
  const ty = (ys[j1] === ys[j0]) ? 0 : (yc - ys[j0]) / (ys[j1] - ys[j0]);
  const v00 = table[i0][j0], v01 = table[i0][j1], v10 = table[i1][j0], v11 = table[i1][j1];
  const v0 = v00 + ty * (v01 - v00);
  const v1 = v10 + ty * (v11 - v10);
  return v0 + tx * (v1 - v0);
}

// Table 7.3-3, with Footnote b (Rroof > 50 -> Ct = 1.2)
function ct733(rroof, pgPsf) {
  if (rroof > 50) return { ct: 1.2, note: 'Rᵣₒₒᶠ > 50 h·ft²·°F/Btu → Cₜ = 1.2 (Table 7.3-3, Footnote b).' };
  const ct = bilerp(rroof, pgPsf, CT33_RROOF, CT33_PG_PSF, CT33_VALUES);
  return { ct: Math.round(ct * 1000) / 1000, note: 'Bilinear interpolation of Table 7.3-3 at Rᵣₒₒᶠ = ' + rroof.toFixed(1) + ' and pᵍ = ' + pgPsf.toFixed(1) + ' psf (Note a permits linear interpolation).' };
}

/* ---------------------------------------------------------------------
   Slope Factor, Cs — Figure 7.4-1(a)/(b)/(c), reproduced mathematically
   in Commentary C7.4 (ASCE 7-22, p.592):
     1. Ct < 1.1                : "all other surfaces" only, 30deg-70deg, /40
     2. 1.1 <= Ct < 1.2 : slippery 10-70 /60 ; other 37.5-70 /32.5
     3. Ct >= 1.2       : slippery 15-70 /55 ; other 45-70 /25
   --------------------------------------------------------------------- */
function csOf(slopeDeg, ct, slippery) {
  let s1, s2, denom, figure, curve, slipperyNote = null;
  if (ct < 1.1) {
    s1 = 30; s2 = 70; denom = 40;
    figure = 'Figure 7.4-1(a) (Cₜ < 1.1)';
    curve = 'all-surfaces';
    if (slippery) {
      slipperyNote = 'Per Commentary C7.4, Figure 7.4-1(a) has no separate curve for unobstructed slippery surfaces when Cₜ ≤ 1.1 (an ice dam is assumed to form at the eave). The single curve shown is used regardless of surface type.';
    }
  } else if (ct < 1.2) {
    figure = 'Figure 7.4-1(b) (1.1 ≤ Cₜ < 1.2)';
    if (slippery) { s1 = 10; s2 = 70; denom = 60; curve = 'slippery'; }
    else { s1 = 37.5; s2 = 70; denom = 32.5; curve = 'other'; }
  } else {
    figure = 'Figure 7.4-1(c) (Cₜ ≥ 1.2)';
    if (slippery) { s1 = 15; s2 = 70; denom = 55; curve = 'slippery'; }
    else { s1 = 45; s2 = 70; denom = 25; curve = 'other'; }
  }
  let cs;
  if (slopeDeg <= s1) cs = 1.0;
  else if (slopeDeg <= s2) cs = 1.0 - (slopeDeg - s1) / denom;
  else cs = 0;
  return { cs: Math.round(cs * 1000) / 1000, s1, s2, denom, figure, curve, slipperyNote };
}

/* ---------------------------------------------------------------------
   Unit conversion helpers (canonical = US: psf, ft)
   --------------------------------------------------------------------- */
function toUSPressure(v, unit) { return unit === 'SI' ? v * PSF_PER_KPA : v; }
function fromUSPressure(v, unit) { return unit === 'SI' ? v / PSF_PER_KPA : v; }
function toUSLength(v, unit) { return unit === 'SI' ? v * FT_PER_M : v; }
function fromUSLength(v, unit) { return unit === 'SI' ? v / FT_PER_M : v; }

function fmt(v, d) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return v.toFixed(d === undefined ? 2 : d);
}

/* ---------------------------------------------------------------------
   Site Class options — ASCE/SEI 7-22 Chapter 20 (Table 20.2-1 added the
   intermediate classes BC, CD, DE alongside A-F). Site Class F requires
   a site response analysis (Sec. 11.4.8) and is not provided by the
   USGS Design Maps service, so it is not offered here. "Default" applies
   the Sec. 11.4.3 default site class when soil properties are unknown.
   --------------------------------------------------------------------- */
const SITE_CLASSES = [
  { key: 'Default', label: 'Default (Sec. 11.4.3 default — site soil properties not known in sufficient detail)' },
  { key: 'A',  label: 'A — Hard rock' },
  { key: 'B',  label: 'B — Rock' },
  { key: 'BC', label: 'BC — Rock / very dense soil (B/C boundary, Table 20.2-1)' },
  { key: 'C',  label: 'C — Very dense soil and soft rock' },
  { key: 'CD', label: 'CD — Dense soil (C/D boundary, Table 20.2-1)' },
  { key: 'D',  label: 'D — Stiff soil' },
  { key: 'DE', label: 'DE — Stiff to soft soil (D/E boundary, Table 20.2-1)' },
  { key: 'E',  label: 'E — Soft clay soil' }
];

/* ---------------------------------------------------------------------
   Site Location: address geocoding (Open-Meteo Geocoding API) and
   Seismic Design Parameters (USGS Design Maps web service for ASCE 7-22)
   --------------------------------------------------------------------- */
// Open-Meteo Geocoding is a place-name gazetteer (cities/towns), not a
// street-address geocoder: it matches only a bare place name, with no
// trailing ", State"/", Country" qualifier and no street/number (e.g.
// "Denver" matches, but "Denver, Colorado" and full street addresses
// return no results). To keep this usable for addresses typed as
// "Street, City, State/Country" or "City, State", we try the full string
// first, then try each comma-separated segment individually, left to
// right, and use the first one that returns a match (this naturally
// skips a leading street/number segment and lands on the city name).
async function geocodeAddressOnce(query) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=1&language=en&format=json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data.results && data.results.length) ? data.results[0] : null;
}

async function geocodeAddress(address) {
  const full = address.trim();
  const segments = full.split(',').map(s => s.trim()).filter(Boolean);
  const attempts = [full];
  segments.forEach(seg => { if (seg !== full) attempts.push(seg); });
  for (const attempt of attempts) {
    const r = await geocodeAddressOnce(attempt);
    if (r) return r;
  }
  throw new Error('no matching location found (try a nearby city or town name)');
}

async function fetchSeismicData(lat, lon, riskCategory, siteClass) {
  const url = 'https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=' + lat + '&longitude=' + lon +
    '&riskCategory=' + encodeURIComponent(riskCategory) + '&siteClass=' + encodeURIComponent(siteClass) + '&title=StructCalc';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (json.request && json.request.status !== 'success') throw new Error('USGS service status: ' + json.request.status);
  return json.response.data;
}

let leafletMap = null, leafletMarker = null;
function showOnMap(lat, lon) {
  if (typeof L === 'undefined' || !document.getElementById('map')) return;
  if (!leafletMap) {
    leafletMap = L.map('map').setView([lat, lon], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMap);
    leafletMarker = L.marker([lat, lon]).addTo(leafletMap);
  } else {
    leafletMap.setView([lat, lon], 9);
    leafletMarker.setLatLng([lat, lon]);
  }
}

function renderSeismicResults(d) {
  document.getElementById('outSs').textContent = fmt(d.ss, 3);
  document.getElementById('outS1').textContent = fmt(d.s1, 3);
  document.getElementById('outSms').textContent = fmt(d.sms, 3);
  document.getElementById('outSm1').textContent = fmt(d.sm1, 3);
  document.getElementById('outSds').textContent = fmt(d.sds, 3);
  document.getElementById('outSd1').textContent = fmt(d.sd1, 3);
  document.getElementById('outPgam').textContent = fmt(d.pgam, 3);
  document.getElementById('outTl').textContent = fmt(d.tl, 1);
  document.getElementById('outTs').textContent = 'Tₛ = ' + fmt(d.ts, 3) + ' s,  T₀ = ' + fmt(d.t0, 3) + ' s';
  document.getElementById('outSdc').textContent = d.sdc || '–';
  document.getElementById('seismicTable').style.display = '';
}

function syncMapFromInputs() {
  const lat = parseFloat(document.getElementById('lat').value);
  const lon = parseFloat(document.getElementById('lon').value);
  if (!isNaN(lat) && !isNaN(lon)) {
    state.lat = lat; state.lon = lon;
    showOnMap(lat, lon);
  }
}

function bindLocationInputs() {
  document.getElementById('locateBtn').addEventListener('click', async () => {
    const address = document.getElementById('address').value.trim();
    const statusEl = document.getElementById('locateStatus');
    if (!address) { statusEl.textContent = 'Enter an address first.'; return; }
    statusEl.textContent = 'Looking up address via Open-Meteo Geocoding API…';
    try {
      const r = await geocodeAddress(address);
      state.lat = r.latitude; state.lon = r.longitude;
      document.getElementById('lat').value = r.latitude;
      document.getElementById('lon').value = r.longitude;
      const parts = [r.name, r.admin1, r.country].filter(Boolean);
      statusEl.innerHTML = 'Found: ' + parts.join(', ') +
        (r.elevation !== undefined ? ', elevation ' + fmt(r.elevation, 0) + ' m' : '') +
        ' — lat ' + fmt(r.latitude, 4) + ', lon ' + fmt(r.longitude, 4) +
        '. <span class="note-inline">Source: Open-Meteo Geocoding API (open-meteo.com).</span>';
      showOnMap(r.latitude, r.longitude);
    } catch (err) {
      statusEl.textContent = 'Geocoding error (' + err.message + '). Enter latitude/longitude manually below if needed.';
    }
  });

  document.getElementById('lat').addEventListener('change', syncMapFromInputs);
  document.getElementById('lon').addEventListener('change', syncMapFromInputs);

  document.getElementById('siteClass').addEventListener('change', e => {
    state.siteClass = e.target.value;
  });

  document.getElementById('fetchSeismicBtn').addEventListener('click', async () => {
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    const statusEl = document.getElementById('seismicStatus');
    if (isNaN(lat) || isNaN(lon)) { statusEl.textContent = 'Locate the site (or enter latitude/longitude) first.'; return; }
    const riskCategory = state.riskCategory;
    const siteClass = document.getElementById('siteClass').value;
    statusEl.textContent = 'Fetching seismic design parameters from USGS Design Maps…';
    try {
      const d = await fetchSeismicData(lat, lon, riskCategory, siteClass);
      renderSeismicResults(d);
      statusEl.innerHTML = 'Source: USGS Design Maps (earthquake.usgs.gov/ws/designmaps/asce7-22.json), Risk Category ' + riskCategory + ', Site Class ' + siteClass + '. Per ASCE/SEI 7-22 Sec. 11.4 &amp; Tables 11.6-1/11.6-2.';
    } catch (err) {
      statusEl.textContent = 'Could not fetch seismic data (' + err.message + '). Look these values up manually at earthquake.usgs.gov/ws/designmaps or ascehazardtool.org.';
    }
  });
}

/* =====================================================================
   STATE
   ===================================================================== */
const state = {
  unitSystem: 'US',
  riskCategory: 'II',
  pg: 30,                 // canonical: psf
  surfaceCat: 'C',
  exposure: 'partial',
  ctMethod: 'table733',
  rroof: 30,              // h.ft2.F/Btu (Table 7.3-3 always tabulated in US units)
  ctCustom: 1.0,
  slopeDeg: 0,
  surfaceType: 'other',   // 'slippery' | 'other'
  roofType: 'lowslope',   // 'lowslope' | 'curved' | 'other'
  curvedAngle: 0,
  W: 40,                  // canonical: ft (eave-to-ridge horizontal distance)
  lowerRoofWidth: 15,     // canonical: ft
  lat: null,
  lon: null,
  siteClass: 'D'
};

/* =====================================================================
   MAIN COMPUTATION
   ===================================================================== */
function compute(s) {
  const steps = [];
  const pg = s.pg; // psf, canonical

  // ---- 1. Exposure factor Ce (Table 7.3-1) ----
  const ceRow = CE_TABLE[s.surfaceCat];
  const ce = ceRow[s.exposure];
  steps.push({
    label: 'Exposure Factor, Cₑ',
    clause: 'Table 7.3-1',
    formula: ceRow.label + ', ' + s.exposure + ' roof → Cₑ',
    result: 'Cₑ = ' + fmt(ce, 2)
  });

  // ---- 2. Thermal factor Ct ----
  let ct, ctNote;
  if (s.ctMethod === 'table733') {
    const r = ct733(s.rroof, toUSPressure(pg, 'US')); // pg already US
    ct = r.ct; ctNote = r.note;
    steps.push({
      label: 'Thermal Factor, Cₜ',
      clause: 'Table 7.3-3 (referenced by Table 7.3-2, "All structures except as indicated")',
      formula: ctNote,
      result: 'Cₜ = ' + fmt(ct, 3)
    });
  } else if (s.ctMethod === 'custom') {
    ct = s.ctCustom;
    steps.push({
      label: 'Thermal Factor, Cₜ',
      clause: 'User-specified',
      formula: 'Custom value entered by user.',
      result: 'Cₜ = ' + fmt(ct, 3)
    });
  } else {
    ct = parseFloat(s.ctMethod);
    const opt = CT_OPTIONS.find(o => o.key === s.ctMethod);
    steps.push({
      label: 'Thermal Factor, Cₜ',
      clause: 'Table 7.3-2',
      formula: opt.label,
      result: 'Cₜ = ' + fmt(ct, 2)
    });
  }

  // ---- 3. Flat roof snow load pf (Eq 7.3-1) ----
  const pf = 0.7 * ce * ct * pg;
  steps.push({
    label: 'Flat Roof Snow Load, pᶠ',
    clause: 'Eq. 7.3-1',
    formula: 'pᶠ = 0.7·Cₑ·Cₜ·pᵍ = 0.7 × ' + fmt(ce, 2) + ' × ' + fmt(ct, 3) + ' × ' + fmt(pg, 2) + ' psf',
    result: 'pᶠ = ' + fmt(pf, 2) + ' psf'
  });

  // ---- 4. Slope factor Cs (Fig. 7.4-1, Commentary C7.4) ----
  const csR = csOf(s.slopeDeg, ct, s.surfaceType === 'slippery');
  let csFormula = csR.figure + ': ';
  if (s.slopeDeg <= csR.s1) csFormula += 'slope ≤ ' + csR.s1 + '° → Cₛ = 1.0';
  else if (s.slopeDeg <= csR.s2) csFormula += 'Cₛ = 1.0 − (slope − ' + csR.s1 + '°) / ' + csR.denom + '° = 1.0 − (' + fmt(s.slopeDeg, 1) + ' − ' + csR.s1 + ') / ' + csR.denom;
  else csFormula += 'slope > ' + csR.s2 + '° → Cₛ = 0';
  steps.push({
    label: 'Slope Factor, Cₛ',
    clause: 'Commentary C7.4 (mathematical form of Figure 7.4-1)',
    formula: csFormula + (csR.slipperyNote ? '<br><span class="note-inline">' + csR.slipperyNote + '</span>' : ''),
    result: 'Cₛ = ' + fmt(csR.cs, 3)
  });

  // ---- 5. Sloped roof snow load ps (Eq 7.4-1) ----
  const ps = csR.cs * pf;
  steps.push({
    label: 'Sloped (Balanced) Roof Snow Load, pₛ',
    clause: 'Eq. 7.4-1',
    formula: 'pₛ = Cₛ·pᶠ = ' + fmt(csR.cs, 3) + ' × ' + fmt(pf, 2) + ' psf',
    result: 'pₛ = ' + fmt(ps, 2) + ' psf'
  });

  // ---- 6. Minimum snow load pm (Sec 7.3.3, Table 7.3-4) ----
  const pmMaxPsf = PM_MAX[s.riskCategory].psf;
  let pmApplies = false, pmReason = '';
  if (s.roofType === 'lowslope') {
    pmApplies = s.slopeDeg < 15;
    pmReason = pmApplies
      ? 'Monoslope, hip, or gable roof with slope ' + fmt(s.slopeDeg, 1) + '° < 15° → pₘ applies.'
      : 'Monoslope, hip, or gable roof with slope ' + fmt(s.slopeDeg, 1) + '° ≥ 15° → pₘ does not apply.';
  } else if (s.roofType === 'curved') {
    pmApplies = s.curvedAngle < 10;
    pmReason = pmApplies
      ? 'Curved roof, eave-to-crown vertical angle ' + fmt(s.curvedAngle, 1) + '° < 10° → pₘ applies.'
      : 'Curved roof, eave-to-crown vertical angle ' + fmt(s.curvedAngle, 1) + '° ≥ 10° → pₘ does not apply.';
  } else {
    pmApplies = false;
    pmReason = 'Roof type is not monoslope/hip/gable (slope<15°) or curved (eave-to-crown<10°) → pₘ is not applicable (Sec. 7.3.3).';
  }
  const pm = Math.min(pg, pmMaxPsf);
  steps.push({
    label: 'Minimum Snow Load for Low-Slope Roofs, pₘ',
    clause: 'Sec. 7.3.3, Table 7.3-4',
    formula: pmReason + (pmApplies
      ? ' pₘ,max (Risk Cat. ' + s.riskCategory + ') = ' + fmt(pmMaxPsf, 0) + ' psf. pₘ = min(pᵍ, pₘ,max) = min(' + fmt(pg, 2) + ', ' + fmt(pmMaxPsf, 0) + ')'
      : ''),
    result: pmApplies ? ('pₘ = ' + fmt(pm, 2) + ' psf (separate load case)') : 'N/A'
  });

  // ---- 7. Governing balanced snow load ----
  const governing = pmApplies ? Math.max(ps, pm) : ps;
  steps.push({
    label: 'Governing Balanced Snow Load',
    clause: 'Sec. 7.3.3 — pₘ is a separate uniform load case, not combined with drift/sliding/unbalanced/partial loads',
    formula: pmApplies
      ? 'max(pₛ, pₘ) = max(' + fmt(ps, 2) + ', ' + fmt(pm, 2) + ')'
      : 'pₛ (pₘ not applicable)',
    result: fmt(governing, 2) + ' psf'
  });

  // ---- 8. Rain-on-snow surcharge (Sec 7.10) ----
  const rainSlopeThreshold = s.W / 50; // degrees, with W in ft (Sec 7.10)
  const rainApplies = pg > 0 && pg <= pmMaxPsf && s.slopeDeg < rainSlopeThreshold;
  const rainSurchargePsf = 8;
  steps.push({
    label: 'Rain-on-Snow Surcharge Load',
    clause: 'Sec. 7.10',
    formula: 'Applies if 0 < pᵍ ≤ pₘ,max (' + fmt(pmMaxPsf, 0) + ' psf) and roof slope (deg) < W/50 (W in ft) = ' + fmt(s.W, 1) + '/50 = ' + fmt(rainSlopeThreshold, 2) + '°. Slope = ' + fmt(s.slopeDeg, 1) + '°. ' +
      (rainApplies ? 'Condition met → add 8 psf (0.38 kPa) to the sloped-roof balanced load pₛ only (not combined with drift, sliding, unbalanced, minimum, or partial loads).' : 'Condition not met → no surcharge.'),
    result: rainApplies ? ('+' + fmt(rainSurchargePsf, 0) + ' psf → pₛ + surcharge = ' + fmt(ps + rainSurchargePsf, 2) + ' psf') : 'N/A'
  });

  // ---- 9. Sliding snow load (Sec 7.9) ----
  const slipperyThreshDeg = Math.atan(0.25 / 12) * 180 / Math.PI; // 1/4:12
  const otherThreshDeg = Math.atan(2 / 12) * 180 / Math.PI;       // 2:12
  let slideApplies, slideThreshUsed, slideThreshLabel;
  if (s.surfaceType === 'slippery') { slideThreshUsed = slipperyThreshDeg; slideThreshLabel = '1/4 on 12 (' + fmt(slipperyThreshDeg, 2) + '°)'; }
  else { slideThreshUsed = otherThreshDeg; slideThreshLabel = '2 on 12 (' + fmt(otherThreshDeg, 2) + '°)'; }
  slideApplies = s.slopeDeg > slideThreshUsed;

  let slideTotalUS = 0, slideDistFtUS = 0, slidePressureUS = 0;
  if (slideApplies) {
    slideTotalUS = 0.4 * pf * s.W; // lb/ft of eave
    slideDistFtUS = Math.min(15, s.lowerRoofWidth > 0 ? s.lowerRoofWidth : 15);
    slidePressureUS = slideTotalUS / slideDistFtUS;
  }
  steps.push({
    label: 'Sliding Snow Load (onto lower roof)',
    clause: 'Sec. 7.9',
    formula: 'Applies for ' + (s.surfaceType === 'slippery' ? 'slippery' : 'non-slippery') + ' upper roof when slope > ' + slideThreshLabel + '. Slope = ' + fmt(s.slopeDeg, 1) + '°. ' +
      (slideApplies
        ? 'Total sliding load per unit length of eave = 0.4·pᶠ·W = 0.4 × ' + fmt(pf, 2) + ' × ' + fmt(s.W, 1) + ' = ' + fmt(slideTotalUS, 1) + ' lb/ft, distributed over ' + fmt(slideDistFtUS, 1) + ' ft (15 ft max, reduced proportionally if the lower roof is narrower) → pressure = ' + fmt(slideTotalUS, 1) + ' / ' + fmt(slideDistFtUS, 1)
        : 'Condition not met → no sliding load.'),
    result: slideApplies ? (fmt(slidePressureUS, 2) + ' psf (added to lower roof’s own balanced load)') : 'N/A'
  });

  return {
    ce, ct, pf, csR, ps, pmApplies, pmMaxPsf, pm, governing,
    rainApplies, rainSlopeThreshold, rainSurchargePsf,
    slideApplies, slideThreshUsed, slideTotalUS, slideDistFtUS, slidePressureUS,
    steps
  };
}

/* =====================================================================
   RENDERING
   ===================================================================== */
function unitPressureLabel() { return state.unitSystem === 'SI' ? 'kPa' : 'psf'; }
function unitLengthLabel() { return state.unitSystem === 'SI' ? 'm' : 'ft'; }

function pressureOut(valUS) { return fromUSPressure(valUS, state.unitSystem); }
function lengthOut(valUS) { return fromUSLength(valUS, state.unitSystem); }

function pmMaxDisplay() {
  const t = PM_MAX[state.riskCategory];
  return state.unitSystem === 'SI' ? t.kPa : t.psf;
}
function rainSurchargeDisplay() {
  return state.unitSystem === 'SI' ? 0.38 : 8;
}

function updateUnitLabels() {
  document.querySelectorAll('.unit-pressure').forEach(el => el.textContent = '(' + unitPressureLabel() + ')');
  document.querySelectorAll('.unit-length').forEach(el => el.textContent = '(' + unitLengthLabel() + ')');
}

function renderResults() {
  const r = compute(state);

  document.getElementById('outCe').textContent = fmt(r.ce, 2);
  document.getElementById('outCt').textContent = fmt(r.ct, 3);
  document.getElementById('outPf').textContent = fmt(pressureOut(r.pf), 2);
  document.getElementById('outCs').textContent = fmt(r.csR.cs, 3);
  document.getElementById('outPs').textContent = fmt(pressureOut(r.ps), 2);
  document.getElementById('outPm').textContent = r.pmApplies ? fmt(pressureOut(r.pm), 2) : 'N/A';
  document.getElementById('outGoverning').textContent = fmt(pressureOut(r.governing), 2);

  const pmMaxRow = document.getElementById('outPmMax');
  if (pmMaxRow) pmMaxRow.textContent = fmt(pmMaxDisplay(), 2);

  // Rain-on-snow
  const rainRow = document.getElementById('rainResultRow');
  if (r.rainApplies) {
    document.getElementById('outRain').textContent = '+' + fmt(rainSurchargeDisplay(), 2) + ' ' + unitPressureLabel() +
      '  →  ' + fmt(pressureOut(r.ps) + rainSurchargeDisplay(), 2) + ' ' + unitPressureLabel();
    rainRow.classList.remove('na');
  } else {
    document.getElementById('outRain').textContent = 'N/A';
    rainRow.classList.add('na');
  }

  // Sliding
  const slideRow = document.getElementById('slideResultRow');
  if (r.slideApplies) {
    document.getElementById('outSlide').textContent = fmt(pressureOut(r.slidePressureUS), 2) + ' ' + unitPressureLabel();
    slideRow.classList.remove('na');
  } else {
    document.getElementById('outSlide').textContent = 'N/A';
    slideRow.classList.add('na');
  }

  renderSteps(r.steps);
}

function renderSteps(steps) {
  const c = document.getElementById('stepsContainer');
  c.innerHTML = '';
  steps.forEach(st => {
    const div = document.createElement('div');
    div.className = 'step';
    div.innerHTML =
      '<span class="lbl">' + st.label + '</span>' +
      '<span class="clause">' + st.clause + '</span>' +
      '<div class="formula">' + st.formula + '</div>' +
      '<div class="result">' + st.result + '</div>';
    c.appendChild(div);
  });
}

/* =====================================================================
   INPUT BINDING
   ===================================================================== */
function showHide(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function syncCtVisibility() {
  showHide('rroofField', state.ctMethod === 'table733');
  showHide('ctCustomField', state.ctMethod === 'custom');
}
function syncRoofTypeVisibility() {
  showHide('curvedAngleField', state.roofType === 'curved');
}

function bindInputs() {
  // Risk category
  document.getElementById('riskCategory').addEventListener('change', e => {
    state.riskCategory = e.target.value;
    const disp = document.getElementById('seismicRiskCategoryDisplay');
    if (disp) disp.value = 'Risk Category ' + state.riskCategory;
    renderResults();
  });

  // pg
  const pgInput = document.getElementById('pg');
  pgInput.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.pg = toUSPressure(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });

  // Surface category & exposure
  document.getElementById('surfaceCat').addEventListener('change', e => {
    state.surfaceCat = e.target.value;
    updateExposureOptions();
    renderResults();
  });
  document.getElementById('exposure').addEventListener('change', e => {
    state.exposure = e.target.value;
    renderResults();
  });

  // Ct method
  document.getElementById('ctMethod').addEventListener('change', e => {
    state.ctMethod = e.target.value;
    syncCtVisibility();
    renderResults();
  });
  document.getElementById('rroof').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.rroof = isNaN(v) ? 0 : v;
    renderResults();
  });
  document.getElementById('ctCustom').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.ctCustom = isNaN(v) ? 1.0 : v;
    renderResults();
  });

  // Slope & surface type
  document.getElementById('slopeDeg').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.slopeDeg = isNaN(v) ? 0 : v;
    renderResults();
  });
  document.getElementById('surfaceType').addEventListener('change', e => {
    state.surfaceType = e.target.value;
    renderResults();
  });

  // Roof type for pm
  document.getElementById('roofType').addEventListener('change', e => {
    state.roofType = e.target.value;
    syncRoofTypeVisibility();
    renderResults();
  });
  document.getElementById('curvedAngle').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.curvedAngle = isNaN(v) ? 0 : v;
    renderResults();
  });

  // W and lower roof width
  document.getElementById('W').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.W = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });
  document.getElementById('lowerRoofWidth').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    state.lowerRoofWidth = toUSLength(isNaN(v) ? 0 : v, state.unitSystem);
    renderResults();
  });

  // Unit toggle
  document.getElementById('unitSI').addEventListener('click', () => setUnitSystem('SI'));
  document.getElementById('unitUS').addEventListener('click', () => setUnitSystem('US'));
}

function updateExposureOptions() {
  const sel = document.getElementById('exposure');
  const row = CE_TABLE[state.surfaceCat];
  const shelteredOpt = sel.querySelector('option[value="sheltered"]');
  if (row.sheltered === null) {
    shelteredOpt.disabled = true;
    if (state.exposure === 'sheltered') {
      state.exposure = 'partial';
      sel.value = 'partial';
    }
  } else {
    shelteredOpt.disabled = false;
  }
}

function setUnitSystem(sys) {
  if (state.unitSystem === sys) return;
  state.unitSystem = sys;

  document.getElementById('unitSI').classList.toggle('active', sys === 'SI');
  document.getElementById('unitUS').classList.toggle('active', sys === 'US');

  document.getElementById('pg').value = fmt(pressureOut(state.pg), 2);
  document.getElementById('W').value = fmt(lengthOut(state.W), 2);
  document.getElementById('lowerRoofWidth').value = fmt(lengthOut(state.lowerRoofWidth), 2);

  updateUnitLabels();
  renderResults();
}

/* =====================================================================
   "LEARN MORE" INFO MODAL
   Every entry below quotes/paraphrases the exact clause, table, or
   equation already cited in the Sources footer of index.html — no new
   citations are introduced here.
   ===================================================================== */
const INFO_CONTENT = {
  siteLocation: {
    title: 'Site Location & Seismic Design Parameters',
    html: `<p>This panel is optional. It geocodes the project address, shows it on a map, and pulls <strong>Seismic Design Parameters (ASCE/SEI 7-22 Ch. 11)</strong> from the USGS Design Maps service.</p>
    <ul>
      <li><span class="src-tag">Open-Meteo Geocoding API</span> &mdash; converts the address to latitude/longitude. Free, no key, OpenStreetMap-derived; matches city/town names rather than exact street addresses.</li>
      <li><span class="src-tag">Leaflet.js + OpenStreetMap tiles</span> &mdash; renders the point on the map.</li>
      <li><span class="src-tag">USGS Design Maps web service (earthquake.usgs.gov/ws/designmaps/asce7-22.json)</span> &mdash; returns S<sub>S</sub>, S<sub>1</sub>, S<sub>MS</sub>, S<sub>M1</sub>, S<sub>DS</sub>, S<sub>D1</sub>, PGA<sub>M</sub>, T<sub>L</sub>, T<sub>S</sub>, T<sub>0</sub> and Seismic Design Category per <span class="src-tag">ASCE/SEI 7-22 Sec. 11.4</span> and <span class="src-tag">Tables 11.6-1/11.6-2</span>.</li>
    </ul>
    <p><strong>This panel does NOT provide p<sub>g</sub> or wind speed V.</strong> Those require the official <a href="https://ascehazardtool.org" target="_blank" rel="noopener">ASCE 7 Hazard Tool</a> (registered account/API key) &mdash; enter p<sub>g</sub> manually in Section 1.</p>
    <p>The geocoder matches city/town names rather than exact street addresses &mdash; if you enter a full street address, the lookup falls back to the city/town part automatically. Check the pin and adjust latitude/longitude manually for the exact building location if needed. Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, rendered with <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet.js</a>.</p>`
  },
  siteClass: {
    title: 'Site Class — ASCE/SEI 7-22 Ch. 20, Table 20.2-1',
    html: `<p><span class="src-tag">Site Class, Ch. 20</span> &mdash; ASCE/SEI 7-22 added intermediate Site Classes BC, CD, DE to Table 20.2-1 alongside A&ndash;F. Site Class should be determined by a geotechnical investigation per Ch. 20.</p>
    <p>"Default" applies the <span class="src-tag">Sec. 11.4.3</span> default site class used when site soil properties are not known in sufficient detail.</p>
    <p>Site Class F requires a site-specific procedure (<span class="src-tag">Sec. 11.4.8</span>) and is not provided by the USGS service used here.</p>`
  },
  riskCategory: {
    title: 'Risk Category — Sec. 1.5 / Table 1.5-1; Table 7.3-4',
    html: `<p>Risk Category is assigned per <span class="src-tag">Sec. 1.5 / Table 1.5-1</span>, based on the consequences of structural failure (occupancy, hazard to life, essential-facility status, etc.) &mdash; it is not calculated by this tool.</p>
    <p>Here it is used to look up the minimum-snow-load ceiling <strong>p<sub>m,max</sub></strong> from <span class="src-tag">Table 7.3-4</span>: Risk Category I = 25 psf (1.20 kPa), II = 30 psf (1.44 kPa), III = 35 psf (1.68 kPa), IV = 40 psf (1.92 kPa).</p>
    <p>It is also displayed in the Site Location panel as the Risk Category used for the Seismic Design Category lookup (<span class="src-tag">Tables 11.6-1/11.6-2</span>).</p>`
  },
  pg: {
    title: 'Ground Snow Load, pg — Sec. 7.2',
    html: `<p><span class="src-tag">ASCE/SEI 7-22, Sec. 7.2</span> &mdash; Ground snow load, p<sub>g</sub>, is Risk-Category-specific (ASCE 7-22 has no separate snow importance factor). It is read from <strong>Figures 7.2-1A&ndash;D</strong>, or <strong>Table 7.2-1</strong> for Alaska, for the project location and the Risk Category selected above.</p>
    <p>Use the official <a href="https://ascehazardtool.org" target="_blank" rel="noopener">ASCE 7 Hazard Tool</a> (ascehazardtool.org) for your site coordinates and enter the resulting p<sub>g</sub> here. This calculator does not look p<sub>g</sub> up automatically &mdash; the Hazard Tool API requires a registered ASCE account/API key.</p>`
  },
  surfaceCat: {
    title: 'Surface Roughness / Terrain Category — Table 7.3-1',
    html: `<p><span class="src-tag">Table 7.3-1</span> defines the exposure factor C<sub>e</sub> by Surface Roughness Category (from <span class="src-tag">Sec. 26.7</span>) combined with the roof's exposure condition:</p>
    <ul>
      <li><strong>B</strong> &mdash; urban/suburban terrain (Sec. 26.7)</li>
      <li><strong>C</strong> &mdash; open terrain with scattered obstructions (Sec. 26.7)</li>
      <li><strong>D</strong> &mdash; flat, unobstructed terrain (Sec. 26.7)</li>
      <li><strong>Above the tree line, windswept mountainous areas</strong></li>
      <li><strong>Alaska</strong> &mdash; no trees within a 2 mi (3 km) radius of the site</li>
    </ul>
    <p>C<sub>e</sub> values by row &times; exposure (Fully/Partially Exposed/Sheltered): B &mdash; 0.9/1.0/1.2; C &mdash; 0.9/1.0/1.1; D &mdash; 0.8/0.9/1.0; Above tree line &amp; Alaska &mdash; 0.7/0.8/N&#47;A (Sheltered is not applicable for these two rows).</p>`
  },
  exposure: {
    title: 'Exposure of Roof — Table 7.3-1',
    html: `<p><span class="src-tag">Table 7.3-1</span> &mdash; the exposure factor C<sub>e</sub> depends on whether the roof is Fully Exposed, Partially Exposed, or Sheltered, combined with the Surface Roughness Category selected above.</p>
    <p>"Sheltered" is N/A for the "Above tree line" and "Alaska" rows of Table 7.3-1 &mdash; the dropdown is restricted accordingly when one of those terrain categories is selected.</p>`
  },
  ctMethod: {
    title: 'Thermal Condition — Tables 7.3-2 / 7.3-3',
    html: `<p><span class="src-tag">Table 7.3-2</span> &mdash; for "all structures except as indicated", C<sub>t</sub> is determined from <span class="src-tag">Table 7.3-3</span> as a function of R<sub>roof</sub> and p<sub>g</sub> (this is the change from ASCE 7-16, which used a flat C<sub>t</sub>=1.0 for heated structures).</p>
    <p>The other Table 7.3-2 categories are fixed values:</p>
    <ul>
      <li>Unheated structure, open-air structure, or cold ventilated roof meeting minimum energy-code requirements &mdash; C<sub>t</sub> = 1.2</li>
      <li>Freezer building &mdash; C<sub>t</sub> = 1.3</li>
      <li>Continuously heated greenhouse, R<sub>roof</sub> &lt; 2.0 h&middot;ft&sup2;&middot;&deg;F/Btu &mdash; C<sub>t</sub> = 0.85</li>
      <li>Custom C<sub>t</sub> &mdash; enter your own value directly</li>
    </ul>`
  },
  rroof: {
    title: 'Roof Thermal Resistance, Rroof — Table 7.3-3',
    html: `<p><span class="src-tag">Table 7.3-3</span> &mdash; for heated structures with unventilated roofs, C<sub>t</sub> is read from a grid of R<sub>roof</sub> (rows: 20, 30, 40, &ge;50 h&middot;ft&sup2;&middot;&deg;F/Btu) versus p<sub>g</sub> (columns: &le;10&hellip;&ge;70 psf), with values ranging 1.00&ndash;1.20.</p>
    <p>This calculator performs <strong>bilinear interpolation</strong> across the full table per Note (a) (linear interpolation between tabulated values is permitted).</p>
    <p><span class="src-tag">Footnote (b)</span>: for R<sub>roof</sub> &gt; 50 h&middot;ft&sup2;&middot;&deg;F/Btu (U<sub>roof</sub> &lt; 0.020), C<sub>t</sub> = 1.2 regardless of p<sub>g</sub>.</p>
    <p>Table 7.3-3 is tabulated in US units; 1 h&middot;ft&sup2;&middot;&deg;F/Btu = 0.176 m&sup2;&middot;K/W.</p>`
  },
  ctCustom: {
    title: 'Custom Ct — Table 7.3-2',
    html: `<p>Used only when "Custom C<sub>t</sub> value" is selected as the thermal condition (<span class="src-tag">Table 7.3-2</span> allows the engineer to assign C<sub>t</sub> directly for conditions not covered by the listed categories or Table 7.3-3).</p>
    <p>The value entered here is used directly as C<sub>t</sub> in <span class="src-tag">Eq. 7.3-1</span>: p<sub>f</sub> = 0.7&middot;C<sub>e</sub>&middot;C<sub>t</sub>&middot;p<sub>g</sub>.</p>`
  },
  slopeDeg: {
    title: 'Roof Slope — Fig. 7.4-1 / Commentary C7.4',
    html: `<p>Roof slope is entered in degrees. To convert rise:run to degrees: slope&deg; = atan(rise/run) &times; 180/&pi;.</p>
    <p>The slope, together with C<sub>t</sub> and the roof surface type, determines the slope factor C<sub>s</sub> per <span class="src-tag">Sec. 7.4.1, Fig. 7.4-1, Commentary C7.4</span> (reproduced mathematically in Commentary C7.4, ASCE/SEI 7-22 p.592):</p>
    <ul>
      <li>C<sub>t</sub> &lt; 1.1: single "all other surfaces" curve (C<sub>s</sub>=1.0 for slope&le;30&deg;, linear to 0 at 70&deg;, denominator 40&deg;). No slippery-surface curve (ice damming assumed).</li>
      <li>1.1 &le; C<sub>t</sub> &lt; 1.2: slippery curve (1.0 to 10&deg;, denom 60&deg;) and "all other" curve (1.0 to 37.5&deg;, denom 32.5&deg;).</li>
      <li>C<sub>t</sub> &ge; 1.2: slippery curve (1.0 to 15&deg;, denom 55&deg;) and "all other" curve (1.0 to 45&deg;, denom 25&deg;).</li>
    </ul>
    <p>Sloped roof snow load: <span class="src-tag">Eq. 7.4-1</span> p<sub>s</sub> = C<sub>s</sub>&middot;p<sub>f</sub>.</p>`
  },
  surfaceType: {
    title: 'Roof Surface — Fig. 7.4-1, Commentary C7.4',
    html: `<p>"Unobstructed and slippery" (metal, slate, glass, smooth membrane roofs that allow snow to slide unobstructed) follows the slippery-surface curve of <span class="src-tag">Fig. 7.4-1</span>; "Other (non-slippery)" follows the "all other surfaces" curve.</p>
    <p>Per Commentary C7.4, when C<sub>t</sub> &lt; 1.1 there is <strong>no slippery-surface curve</strong> &mdash; ice damming at the eave is assumed to prevent sliding, so both surface types use the single "all other surfaces" curve in that case.</p>
    <p>This selection also affects <span class="src-tag">Sec. 7.9</span> sliding-snow applicability: slippery upper roofs slide at slope &gt; 1/4 on 12 (1.19&deg;); other roofs slide at slope &gt; 2 on 12 (9.46&deg;).</p>`
  },
  roofType: {
    title: 'Roof Type / Applicability — Sec. 7.3.3, Table 7.3-4',
    html: `<p><span class="src-tag">Sec. 7.3.3, Table 7.3-4</span> &mdash; the minimum snow load p<sub>m</sub> applies only to:</p>
    <ul>
      <li>Monoslope, hip, or gable roofs with slope &lt; 15&deg;, or</li>
      <li>Curved roofs with eave-to-crown vertical angle &lt; 10&deg;.</li>
    </ul>
    <p>For "Other" roof types (multiple folded plate, sawtooth, barrel vault, steep roofs, etc.), p<sub>m</sub> does not apply and is not included in the governing balanced load.</p>
    <p>Where applicable, p<sub>m</sub> = min(p<sub>g</sub>, p<sub>m,max</sub>), and is a <strong>separate uniform load case</strong> &mdash; not combined with drift, sliding, unbalanced, or partial loads.</p>`
  },
  curvedAngle: {
    title: 'Eave-to-Crown Vertical Angle — Sec. 7.3.3',
    html: `<p>Used only when "Curved roof" is selected above. Per <span class="src-tag">Sec. 7.3.3</span>, the minimum snow load p<sub>m</sub> applies to curved roofs only when the eave-to-crown vertical angle is <strong>less than 10&deg;</strong>.</p>
    <p>If the entered angle is &ge; 10&deg;, p<sub>m</sub> does not apply to this roof and is excluded from the governing balanced load, per <span class="src-tag">Table 7.3-4</span>.</p>`
  },
  W: {
    title: 'Eave-to-Ridge Horizontal Distance, W — Sec. 7.9 & Sec. 7.10',
    html: `<p>W is used in two checks:</p>
    <ul>
      <li><span class="src-tag">Sec. 7.9</span> &mdash; Sliding snow: the total sliding load per unit length of eave = <strong>0.4&middot;p<sub>f</sub>&middot;W</strong>, where W is the horizontal eave-to-ridge distance of the upper (sliding) roof.</li>
      <li><span class="src-tag">Sec. 7.10</span> &mdash; Rain-on-snow surcharge applies only where roof slope (degrees) &lt; W/50 (W in ft; W/15.2 with W in m), in addition to 0 &lt; p<sub>g</sub> &le; p<sub>m,max</sub>.</li>
    </ul>`
  },
  lowerRoofWidth: {
    title: 'Lower Roof Width — Sec. 7.9',
    html: `<p><span class="src-tag">Sec. 7.9</span> &mdash; the sliding snow load (0.4&middot;p<sub>f</sub>&middot;W from the upper roof) is distributed over <strong>15 ft (4.6 m)</strong> of the lower roof width, measured from the upper/lower roof intersection.</p>
    <p>If the lower roof is <strong>narrower than 15 ft (4.6 m)</strong>, the total sliding load is reduced proportionally to the available width before being applied as a uniform load over that width.</p>
    <p>Set this value to 15 ft / 4.6 m or more if the reduction does not apply.</p>`
  },
  stepsInfo: {
    title: 'Step-by-Step Calculation',
    html: `<p>Every value below is computed from the inputs on the left, with the clause, equation, table, or figure it comes from &mdash; see the "Where these formulas come from" section at the bottom of this page for the full citation list.</p>`
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
  const dateEl = document.getElementById('printDate');
  if (dateEl) {
    dateEl.textContent = 'Generated ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + ' — values reflect the inputs and computed results shown below at the time of printing.';
  }
  if (btn) {
    btn.addEventListener('click', () => window.print());
  }
}

/* =====================================================================
   INIT
   ===================================================================== */
function init() {
  // Populate select options
  const riskSel = document.getElementById('riskCategory');
  ['I', 'II', 'III', 'IV'].forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.textContent = 'Risk Category ' + k + '  (pₘ,max = ' + PM_MAX[k].psf + ' psf / ' + PM_MAX[k].kPa + ' kPa)';
    if (k === state.riskCategory) o.selected = true;
    riskSel.appendChild(o);
  });

  const surfSel = document.getElementById('surfaceCat');
  Object.keys(CE_TABLE).forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.textContent = CE_TABLE[k].label;
    if (k === state.surfaceCat) o.selected = true;
    surfSel.appendChild(o);
  });

  const ctSel = document.getElementById('ctMethod');
  CT_OPTIONS.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.key; o.textContent = opt.label;
    if (opt.key === state.ctMethod) o.selected = true;
    ctSel.appendChild(o);
  });

  // Initial field values
  document.getElementById('pg').value = state.pg;
  document.getElementById('exposure').value = state.exposure;
  document.getElementById('rroof').value = state.rroof;
  document.getElementById('ctCustom').value = state.ctCustom;
  document.getElementById('slopeDeg').value = state.slopeDeg;
  document.getElementById('surfaceType').value = state.surfaceType;
  document.getElementById('roofType').value = state.roofType;
  document.getElementById('curvedAngle').value = state.curvedAngle;
  document.getElementById('W').value = state.W;
  document.getElementById('lowerRoofWidth').value = state.lowerRoofWidth;

  // Site Class select (Site Location panel)
  const siteClassSel = document.getElementById('siteClass');
  SITE_CLASSES.forEach(sc => {
    const o = document.createElement('option');
    o.value = sc.key; o.textContent = sc.label;
    if (sc.key === state.siteClass) o.selected = true;
    siteClassSel.appendChild(o);
  });
  document.getElementById('seismicRiskCategoryDisplay').value = 'Risk Category ' + state.riskCategory;

  updateExposureOptions();
  syncCtVisibility();
  syncRoofTypeVisibility();
  updateUnitLabels();
  bindInputs();
  bindLocationInputs();
  bindInfoModal();
  bindPrintButton();
  renderResults();
}

document.addEventListener('DOMContentLoaded', init);

/* =====================================================================
   STRUCTCALC SHELL BRIDGE
   Lets this module run standalone (as before) AND inside the StructCalc
   app shell (StructCalc/index.html), which embeds it in an <iframe> and
   exchanges `state` via postMessage so calculations can be saved/restored
   per project.
   Protocol:
     shell -> module: {type:'loadState', state:{...}}        restore a saved state
     shell -> module: {type:'requestState'}                  ask for current state
     module -> shell: {type:'stateChanged', module:'snowASCE', state:{...}}
   ===================================================================== */
(function () {
  function snapshotState() {
    try { return JSON.parse(JSON.stringify(state)); } catch (e) { return null; }
  }

  function postState() {
    if (window.parent === window) return; // not embedded
    window.parent.postMessage({ type: 'stateChanged', module: 'snowASCE', state: snapshotState() }, '*');
  }

  function applyState(newState) {
    if (!newState) return;
    Object.assign(state, newState);

    document.getElementById('riskCategory').value = state.riskCategory;
    const disp = document.getElementById('seismicRiskCategoryDisplay');
    if (disp) disp.value = 'Risk Category ' + state.riskCategory;
    document.getElementById('pg').value = fmt(pressureOut(state.pg), 2);
    document.getElementById('surfaceCat').value = state.surfaceCat;
    updateExposureOptions();
    document.getElementById('exposure').value = state.exposure;
    document.getElementById('ctMethod').value = state.ctMethod;
    document.getElementById('rroof').value = state.rroof;
    document.getElementById('ctCustom').value = state.ctCustom;
    document.getElementById('slopeDeg').value = state.slopeDeg;
    document.getElementById('surfaceType').value = state.surfaceType;
    document.getElementById('roofType').value = state.roofType;
    document.getElementById('curvedAngle').value = state.curvedAngle;
    document.getElementById('W').value = fmt(lengthOut(state.W), 2);
    document.getElementById('lowerRoofWidth').value = fmt(lengthOut(state.lowerRoofWidth), 2);
    document.getElementById('unitSI').classList.toggle('active', state.unitSystem === 'SI');
    document.getElementById('unitUS').classList.toggle('active', state.unitSystem === 'US');
    if (state.lat != null) document.getElementById('lat').value = state.lat;
    if (state.lon != null) document.getElementById('lon').value = state.lon;
    const siteClassSel = document.getElementById('siteClass');
    if (siteClassSel) siteClassSel.value = state.siteClass;

    syncCtVisibility();
    syncRoofTypeVisibility();
    updateUnitLabels();
    if (state.lat != null && state.lon != null && typeof showOnMap === 'function') {
      try { showOnMap(state.lat, state.lon); } catch (e) { /* map not ready */ }
    }
    renderResults();
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (!msg) return;
    if (msg.type === 'loadState') {
      try { applyState(msg.state); } catch (err) { console.error('StructCalc applyState error', err); }
    } else if (msg.type === 'requestState') {
      postState();
    }
  });

  // Wrap renderResults so every recompute (incl. from user edits) reports
  // the new state back to the shell.
  const _renderResults = renderResults;
  renderResults = function () {
    _renderResults.apply(this, arguments);
    postState();
  };

  window.addEventListener('DOMContentLoaded', () => setTimeout(postState, 0));
})();
