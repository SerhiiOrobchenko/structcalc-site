/* zones-cc-monoslope.js  v3
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
 * Labels: on FRONT gable face (v near 1, visible in default camera view).
 * Dims:   Zone 3'/2a,4a · Zone 3/2a,2a · Zone 2/a — shown on front corners.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-monoslope'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, THEME, THREE,
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

      /* Zone 2' — gable side strips, width 2a (back + FRONT with label) */
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

      /* ── Dimension lines on FRONT-facing corners ──────────────────── */
      if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
        const a_s  = zone_a.toFixed(1);
        const a2_s = (2 * zone_a).toFixed(1);
        const a4_s = (4 * zone_a).toFixed(1);

        /* Zone 3' at HIGH eave, front corner (v=v_lo4 boundary):
           — 2a depth from HIGH eave (u direction)                    */
        mkSlopeDim('2a=' + a2_s + 'ft',
          ptFn(0,      v_lo4, hB, hEave, hRidge, hL),
          ptFn(u_hi2,  v_lo4, hB, hEave, hRidge, hL),
          norm);
        /* — 4a width along gable (v direction, at mid of 2a strip)   */
        mkSlopeDim('4a=' + a4_s + 'ft',
          ptFn(u_hi2/2, v_lo4, hB, hEave, hRidge, hL),
          ptFn(u_hi2/2, 1,     hB, hEave, hRidge, hL),
          norm);

        /* Zone 3 at LOW eave, front corner (v=v_lo2 boundary):
           — 2a depth from LOW eave (u direction)                      */
        mkSlopeDim('2a=' + a2_s + 'ft',
          ptFn(u_lo2, v_lo2, hB, hEave, hRidge, hL),
          ptFn(1,     v_lo2, hB, hEave, hRidge, hL),
          norm);
        /* — 2a width along gable (v direction, at LOW eave)           */
        mkSlopeDim('2a=' + a2_s + 'ft',
          ptFn(1, v_lo2, hB, hEave, hRidge, hL),
          ptFn(1, 1,     hB, hEave, hRidge, hL),
          norm);

        /* Zone 2 middle at LOW eave: a depth (mid v range)            */
        const vMid = (v_2a + v_lo2) / 2;
        mkSlopeDim('a=' + a_s + 'ft',
          ptFn(u_lo1, vMid, hB, hEave, hRidge, hL),
          ptFn(1,     vMid, hB, hEave, hRidge, hL),
          norm);
      }
    },
  };
})();
