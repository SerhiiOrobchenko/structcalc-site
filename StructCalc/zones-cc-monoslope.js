/* zones-cc-monoslope.js  v4
 * C&C Monoslope Roof — ASCE 7-22 Fig. 30.3-5A (3° < θ ≤ 10°)
 *
 * UV space (ptMono):  u=0 = HIGH eave (left),  u=1 = LOW eave (right)
 *                     v=0 = back gable,         v=1 = front gable
 *
 * Zone layout (plan view, 5 distinct colors):
 *   Zone 3'  [dark red]   HIGH eave × gable corners:  2a deep × 4a wide
 *   Zone 2'  [orange-500] HIGH eave middle (2a) + gable side strips (2a)
 *   Zone 3   [red-600]    LOW eave × gable corners:   2a × 2a square
 *   Zone 2   [orange-400] LOW eave middle strip:        a deep
 *   Zone 1   [yellow]     Interior field
 *
 * Labels: on FRONT gable face (v=1, visible in default camera view).
 * Dims:   mirrored to BACK gable face (v=0) — opposite side to labels.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-monoslope'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, mkSlopeDimExt, THEME, THREE,
              u_zone, v_zone, zone_a, hB, hL, hEave, hRidge,
              ptFn, norm, doLabel } = ctx;

      /* ── UV boundaries ────────────────────────────────────────────────
         u_zone = 2a/B  (zone_a / hB_vis ≈ 2·zone_a/B)
         v_zone = a/L   (zone_a / L)
         HIGH eave strip = 2a → u_zone
         LOW  eave Zone3 = 2a → 1 - u_zone
         LOW  eave Zone2 =  a → 1 - u_zone/2
         Gable 2a  = 2·v_zone    Gable 4a  = 4·v_zone           */
      const u_hi2 = Math.min(u_zone,       0.45);
      const u_lo2 = Math.max(1 - u_zone,   u_hi2 + 0.04);
      const u_lo1 = Math.max(1 - u_zone/2, u_lo2 + 0.02);
      const v_2a  = Math.min(2 * v_zone,   0.40);
      const v_4a  = Math.min(4 * v_zone,   0.45);
      const v_lo2 = 1 - v_2a;
      const v_lo4 = 1 - v_4a;

      /* Zone 1 — interior (yellow) */
      addZone(u_hi2, u_lo1, v_2a, v_lo2,
              THEME.zone1,  0.20, 'zone-1',  0.02, ptFn, norm, doLabel);

      /* Zone 2 — LOW eave middle, depth a (orange-400) */
      addZone(u_lo1, 1,     v_2a, v_lo2,
              THEME.zone2,  0.35, 'zone-2',  0.07, ptFn, norm, false);

      /* Zone 2' — HIGH eave middle strip, depth 2a (orange-500) */
      addZone(0, u_hi2,     v_4a, v_lo4,
              THEME.zone2p, 0.50, 'zone-2p', 0.08, ptFn, norm, false);

      /* Zone 2' — gable side strips, width 2a (BACK + front with label) */
      addZone(u_hi2, u_lo2, 0,     v_2a,
              THEME.zone2p, 0.50, 'zone-2p', 0.08, ptFn, norm, false);
      addZone(u_hi2, u_lo2, v_lo2, 1,
              THEME.zone2p, 0.50, 'zone-2p', 0.08, ptFn, norm, doLabel);   // FRONT — label here

      /* Zone 3 — LOW eave corners, 2a × 2a (red-600) */
      addZone(u_lo2, 1,     0,     v_2a,
              THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, false);
      addZone(u_lo2, 1,     v_lo2, 1,
              THEME.zone3,  0.65, 'zone-3',  0.12, ptFn, norm, doLabel);   // FRONT — label here

      /* Zone 3' — HIGH eave corners, 2a × 4a (red-800, worst suction) */
      addZone(0, u_hi2,     0,     v_4a,
              THEME.zone3p, 0.85, 'zone-3p', 0.18, ptFn, norm, false);
      addZone(0, u_hi2,     v_lo4, 1,
              THEME.zone3p, 0.85, 'zone-3p', 0.18, ptFn, norm, doLabel);   // FRONT — label here

      /* ── Dimension lines on FRONT face (v=1) — same side as labels ─── */
      if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
        const a_s  = zone_a.toFixed(1);
        const a2_s = (2 * zone_a).toFixed(1);
        const a4_s = (4 * zone_a).toFixed(1);

        // Offset to place dim line just outside zone boundary (ext-line pattern)
        const vIn = Math.min(0.10, v_4a * 0.45);   // v-step outside zone (into roof field)
        const uIn = Math.min(0.10, u_hi2 * 0.45);  // u-step outside zone (into zone 2')

        /* ── Zone 3' (HIGH eave corners, 2a × 4a) ─────────────────────── */

        /* 2a eave-strip width (u direction) — dim OUTSIDE zone at v = v_lo4 - vIn */
        const vDim3p = Math.max(0.02, v_lo4 - vIn);
        mkSlopeDimExt('2a=' + a2_s + 'ft',
          ptFn(0,     vDim3p, hB, hEave, hRidge, hL),
          ptFn(u_hi2, vDim3p, hB, hEave, hRidge, hL),
          [
            [ptFn(0,     v_lo4, hB, hEave, hRidge, hL), ptFn(0,     vDim3p, hB, hEave, hRidge, hL)],
            [ptFn(u_hi2, v_lo4, hB, hEave, hRidge, hL), ptFn(u_hi2, vDim3p, hB, hEave, hRidge, hL)],
          ],
          norm);

        /* 4a gable depth (v direction) — dim OUTSIDE zone at u = u_hi2 + uIn */
        const uDim3p = Math.min(0.98, u_hi2 + uIn);
        mkSlopeDimExt('4a=' + a4_s + 'ft',
          ptFn(uDim3p, v_lo4, hB, hEave, hRidge, hL),
          ptFn(uDim3p, 1,     hB, hEave, hRidge, hL),
          [
            [ptFn(u_hi2, v_lo4, hB, hEave, hRidge, hL), ptFn(uDim3p, v_lo4, hB, hEave, hRidge, hL)],
            [ptFn(u_hi2, 1,     hB, hEave, hRidge, hL), ptFn(uDim3p, 1,     hB, hEave, hRidge, hL)],
          ],
          norm);

        /* ── Zone 3 (LOW eave corners, 2a × 2a) ────────────────────────── */

        /* 2a eave-strip width (u direction) — dim OUTSIDE zone at v = v_lo2 - vIn */
        const vDim3 = Math.max(0.02, v_lo2 - vIn);
        mkSlopeDimExt('2a=' + a2_s + 'ft',
          ptFn(u_lo2, vDim3, hB, hEave, hRidge, hL),
          ptFn(1,     vDim3, hB, hEave, hRidge, hL),
          [
            [ptFn(u_lo2, v_lo2, hB, hEave, hRidge, hL), ptFn(u_lo2, vDim3, hB, hEave, hRidge, hL)],
            [ptFn(1,     v_lo2, hB, hEave, hRidge, hL), ptFn(1,     vDim3, hB, hEave, hRidge, hL)],
          ],
          norm);

        /* 2a gable depth (v direction) — dim OUTSIDE zone at u = u_lo2 - uIn */
        const uDim3 = Math.max(0.02, u_lo2 - uIn);
        mkSlopeDimExt('2a=' + a2_s + 'ft',
          ptFn(uDim3, v_lo2, hB, hEave, hRidge, hL),
          ptFn(uDim3, 1,     hB, hEave, hRidge, hL),
          [
            [ptFn(u_lo2, v_lo2, hB, hEave, hRidge, hL), ptFn(uDim3, v_lo2, hB, hEave, hRidge, hL)],
            [ptFn(u_lo2, 1,     hB, hEave, hRidge, hL), ptFn(uDim3, 1,     hB, hEave, hRidge, hL)],
          ],
          norm);

        /* ── Zone 2 (LOW eave middle strip, depth a) ────────────────────── */
        const vMid = (v_2a + v_lo2) / 2;
        mkSlopeDim('a=' + a_s + 'ft',
          ptFn(u_lo1, vMid, hB, hEave, hRidge, hL),
          ptFn(1,     vMid, hB, hEave, hRidge, hL),
          norm);
      }
    },
  };
})();
