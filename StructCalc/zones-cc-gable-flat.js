/* zones-cc-gable-flat.js  v=3
 * ASCE/SEI 7-22, Ch. 30, Part 1 (C&C), Figure 30.3-2A
 * Flat Roofs, Gable and Hip Roofs θ ≤ 7°
 *
 * Zone 1': centre field  (beyond 1.2h from every edge)          — GREEN
 * Zone 1 : 0.6h → 1.2h perimeter band (middle v range only)    — YELLOW
 * Zone 2 : 0 → 0.6h perimeter band from eave + full rake bands — ORANGE
 * Zone 3 : L-shaped corners at eave × rake (0.2h deep, 0.6h wide)
 *
 * Labels: Zone 3 shown on ALL 4 corners with solid arrow leaders.
 * Dims  : on-slope dimension lines for 0.2h / 0.6h / 1.2h.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-gable-flat'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, makeZone3Label, THEME, THREE,
              hEave_ft, hB, hL, hEave, hRidge, ptFn, norm, doLabel } = ctx;

      const h_m  = hEave_ft;                                         // eave ht, ft
      const u2   = Math.min(0.6  * h_m / hB,       0.45);          // 0.6h from eave (u)
      const u3   = Math.min(0.2  * h_m / hB,       u2);            // 0.2h from eave (Zone 3 arm depth)
      const u1e  = Math.min(1.2  * h_m / hB,       0.48);          // 1.2h from eave
      const v2   = Math.min(0.6  * h_m / (2*hL),   0.45);          // 0.6h from rake (v)
      const v_z3 = Math.min(0.2  * h_m / (2*hL),   v2);            // 0.2h from rake (Zone 3 arm)
      const vv1  = 1 - v2;
      const vz1  = Math.min(1.2  * h_m / (2*hL),   0.48);          // 1.2h from rake
      const vz1r = 1 - vz1;

      /* ── Zone meshes — paint order: 1' → 1 → 2 → 3 (higher eps wins) ── */

      /* Zone 1' — green central field */
      addZone(u1e, 1,   vz1,  vz1r, THEME.zone1p, 0.20, 'zone-1p', 0.04, ptFn, norm, doLabel);

      /* Zone 1 — yellow band 0.6h→1.2h (MIDDLE v range only — no overlap with Zone 2 rake) */
      addZone(u2,  u1e, v2,   vv1,  THEME.zone1,  0.22, 'zone-1',  0.03, ptFn, norm, doLabel);
      addZone(u1e, 1,   v2,   vz1,  THEME.zone1,  0.22, 'zone-1',  0.03, ptFn, norm, false);
      addZone(u1e, 1,   vz1r, vv1,  THEME.zone1,  0.22, 'zone-1',  0.03, ptFn, norm, false);

      /* Zone 2 — orange perimeter band 0→0.6h (non-overlapping: eave middle + full rake) */
      addZone(0,   u2,  v2,   vv1,  THEME.zone2,  0.35, 'zone-2',  0.07, ptFn, norm, doLabel);
      addZone(0,   1,   0,    v2,   THEME.zone2,  0.35, 'zone-2',  0.07, ptFn, norm, false);
      addZone(0,   1,   vv1,  1,    THEME.zone2,  0.35, 'zone-2',  0.07, ptFn, norm, false);

      /* Zone 3 — L-shaped corners at eave × rake (auto-label suppressed; explicit below) */
      addZone(0,   u3,  0,       v2,   THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(u3,  u2,  0,       v_z3, THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(0,   u3,  vv1,     1,    THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(u3,  u2,  1-v_z3,  1,    THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);

      /* ── Zone 3 arrow labels — ALL corners on BOTH slopes ─────────────── */
      if (makeZone3Label && THREE.CSS2DObject) {
        const c1 = ptFn(u3 * 0.45, v2 * 0.50,     hB, hEave, hRidge, hL);
        const c2 = ptFn(u3 * 0.45, vv1 + v2*0.50, hB, hEave, hRidge, hL);
        makeZone3Label(c1, norm);
        makeZone3Label(c2, norm);
      }

      /* ── On-slope dimension lines (OPPOSITE slope only — !doLabel) ──────── */
      if (!doLabel && mkSlopeDim && THREE.CSS2DObject) {
        const d06 = (0.6 * hEave_ft).toFixed(1);
        const d02 = (0.2 * hEave_ft).toFixed(1);

        /* Zone 2 width: 0→0.6h from eave, at v = 0.55 (inside zone 2 field) */
        mkSlopeDim(
          `0.6h = ${d06} ft`,
          ptFn(0,   0.55, hB, hEave, hRidge, hL),
          ptFn(u2,  0.55, hB, hEave, hRidge, hL),
          norm
        );
        /* Zone 1 width: 0.6h→1.2h from eave, at v = 0.55 (immediately inside zone 2) */
        mkSlopeDim(
          `0.6h = ${d06} ft`,
          ptFn(u2,  0.55, hB, hEave, hRidge, hL),
          ptFn(u1e, 0.55, hB, hEave, hRidge, hL),
          norm
        );
        /* Zone 3 depth from eave: 0→0.2h, at v = v_z3 * 0.40 (inside Zone 3 L-arm) */
        mkSlopeDim(
          `0.2h = ${d02} ft`,
          ptFn(0,   v_z3 * 0.40, hB, hEave, hRidge, hL),
          ptFn(u3,  v_z3 * 0.40, hB, hEave, hRidge, hL),
          norm
        );
      }
    },
  };
})();
