/* zones-cc-gable-flat.js  v=9
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
      const { addZone, mkSlopeDim, mkSlopeDimExt, mkSlopeDimZ3, makeZone3Label, THEME, THREE,
              hEave_ft, hB, hL, hEave, hRidge, ptFn, norm, doLabel } = ctx;

      const h_m  = hEave_ft;                                         // eave ht, ft
      const u2   = Math.min(0.6  * h_m / hB,       0.45);          // 0.6h from eave (u)
      const u3   = Math.min(0.2  * h_m / hB,       u2);            // 0.2h from eave (Zone 3 arm depth)
      // u1e: Zone-1 band is always 0.6h beyond u2 in world coords (not independently capped)
      const u1e  = Math.min(u2 + 0.6 * h_m / hB,     1.0);         // 0.6h band beyond Zone 2
      const v2   = Math.min(0.6  * h_m / (2*hL),   0.45);          // 0.6h from rake (v)
      const v_z3 = Math.min(0.2  * h_m / (2*hL),   v2);            // 0.2h from rake (Zone 3 arm)
      const vv1  = 1 - v2;
      // vz1: Zone-1 band is always 0.6h beyond v2 in world coords
      const vz1  = Math.min(v2 + 0.6 * h_m / (2*hL), 1.0);         // 0.6h band beyond Zone 2 (v)
      const vz1r = 1 - vz1;

      /* ── Zone meshes — paint order: 1' → 1 → 2 → 3 (higher eps wins) ── */

      /* Zone 1' — green central field */
      addZone(u1e, 1,   vz1,  vz1r, THEME.zone1p, 0.20, 'zone-1p', 0.04, ptFn, norm, doLabel);

      /* Zone 1 — yellow band 0.6h→1.2h (MIDDLE v range only — no overlap with Zone 2 rake) */
      addZone(u2,  u1e, v2,   vv1,  THEME.zone1,  0.22, 'zone-1',  0.03, ptFn, norm, doLabel);
      addZone(u1e, 1,   v2,   vz1,  THEME.zone1,  0.22, 'zone-1',  0.03, ptFn, norm, false);
      addZone(u1e, 1,   vz1r, vv1,  THEME.zone1,  0.22, 'zone-1',  0.03, ptFn, norm, false);

      /* Zone 2 — orange perimeter band (Zone 3 L-shapes SUBTRACTED from rake strips)
       * Near rake:  (u2,1)×(0,v2)  +  (u3,u2)×(v_z3,v2)   [corner box & arm removed]
       * Far rake:   (u2,1)×(vv1,1) +  (u3,u2)×(vv1,1-v_z3) [symmetric]             */
      addZone(0,   u2,  v2,      vv1,     THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
      // Near-rake: Zone3 corner box (0,u3)×(0,v2) and arm (u3,u2)×(0,v_z3) removed
      addZone(u2,  1,   0,       v2,      THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u3,  u2,  v_z3,    v2,      THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      // Far-rake: Zone3 corner box (0,u3)×(vv1,1) and arm (u3,u2)×(1-v_z3,1) removed
      addZone(u2,  1,   vv1,     1,       THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u3,  u2,  vv1,     1-v_z3,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);

      /* Zone 3 — L-shaped corners at eave × rake (auto-label suppressed; explicit below) */
      addZone(0,   u3,  0,       v2,   THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(u3,  u2,  0,       v_z3, THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(0,   u3,  vv1,     1,    THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(u3,  u2,  1-v_z3,  1,    THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);

      /* ── Zone 3 arrow labels — ALL corners on BOTH slopes ─────────────── */
      if (makeZone3Label && THREE.CSS2DObject) {
        // Area-weighted centroid of the L-shape: eave strip + rake arm
        // L-shape centroid can fall outside (in the notch), so clamp uC to eave strip
        const _A1 = u3 * v2;                         // eave strip area (dominant)
        const _A2 = Math.max(0, u2 - u3) * v_z3;    // rake arm area
        const _A  = (_A1 + _A2) || 1e-9;
        const uC  = Math.min(u3 * 0.95, (_A1*(u3/2) + _A2*((u3+u2)/2)) / _A);
        const vR  = (_A1*(v2/2) + _A2*(v_z3/2)) / _A;  // v-offset from each gable edge
        const c1  = ptFn(uC, vR,   hB, hEave, hRidge, hL);   // back corner
        const c2  = ptFn(uC, 1-vR, hB, hEave, hRidge, hL);   // front corner
        makeZone3Label(c1, norm);
        makeZone3Label(c2, norm);
      }

      /* ── On-slope dimension lines (OPPOSITE slope only — !doLabel) ──────── */
      if (!doLabel && mkSlopeDim && THREE.CSS2DObject) {
        const d06 = (0.6 * hEave_ft).toFixed(1);
        const d02 = (0.2 * hEave_ft).toFixed(1);
        const vv1_ = 1 - v2;              // front zone-2/1 boundary in v
        // Offset outside the slope for ext-line dims (normalised v units)
        const vOut  = Math.min(0.12, v2 * 0.5);  // extend outside gable edge
        const vIn   = Math.min(0.10, vz1 * 0.4); // step outside Zone-3 into slope field

        /* ── Cross-slope (u: eave → ridge) ───────────────────── */

        /* Zone 2 width: 0→0.6h from eave, at v=0.55 */
        mkSlopeDim(
          `0.6h=${d06}ft`,
          ptFn(0,   0.55, hB, hEave, hRidge, hL),
          ptFn(u2,  0.55, hB, hEave, hRidge, hL),
          norm
        );
        /* Zone 1 width: 0.6h→1.2h from eave, at v=0.55 */
        mkSlopeDim(
          `0.6h=${d06}ft`,
          ptFn(u2,  0.55, hB, hEave, hRidge, hL),
          ptFn(u1e, 0.55, hB, hEave, hRidge, hL),
          norm
        );

        /* ── Along-ridge (v direction) — both dims on same line near ridge ── */
        // u=0.82 places both dims close to the ridge for visual clarity

        /* Zone 2 along-ridge: 0.6h from front gable, at u=0.82 */
        mkSlopeDim(
          `0.6h=${d06}ft`,
          ptFn(0.82, vv1_, hB, hEave, hRidge, hL),
          ptFn(0.82, 1.0,  hB, hEave, hRidge, hL),
          norm
        );
        /* Zone 1 along-ridge: 0.6h band inboard of Zone-2, at u=0.82 (same line) */
        mkSlopeDim(
          `0.6h=${d06}ft`,
          ptFn(0.82, 1 - vz1, hB, hEave, hRidge, hL),
          ptFn(0.82, vv1_,    hB, hEave, hRidge, hL),
          norm
        );

        /* ── Zone 3: red dims directly on zone surface ─────────────── */

        /* Zone 3 — 0.2h from eave (u dir.) — dim line OUTSIDE Zone 3, ext lines from boundary */
        const vDimLine = Math.max(0.01, vv1_ - vIn);   // just outside Zone 3 (toward slope centre)
        mkSlopeDimExt(
          `0.2h=${d02}ft`,
          ptFn(0,  vDimLine, hB, hEave, hRidge, hL),
          ptFn(u3, vDimLine, hB, hEave, hRidge, hL),
          [
            [ptFn(0,  vv1_, hB, hEave, hRidge, hL), ptFn(0,  vDimLine, hB, hEave, hRidge, hL)],
            [ptFn(u3, vv1_, hB, hEave, hRidge, hL), ptFn(u3, vDimLine, hB, hEave, hRidge, hL)],
          ],
          norm
        );
      }
    },
  };
})();
