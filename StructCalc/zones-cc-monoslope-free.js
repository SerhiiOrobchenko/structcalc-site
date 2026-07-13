/* zones-cc-monoslope-free.js  v1
 * C&C Open Building — Monoslope Free Roof
 * ASCE 7-22 Fig. 30.5-1  (0.25 ≤ h/L ≤ 1.0, θ ≤ 45°)
 *
 * UV space (ptMono):  u=0 = HIGH eave (left),  u=1 = LOW eave (right)
 *                     v=0 = back gable,         v=1 = front gable
 *
 * Zone layout — concentric border rings:
 *   Zone 3  [red]     outer perimeter strip of width "a" (all 4 edges)
 *   Zone 2  [orange]  next inward strip of width "a"     (all 4 edges)
 *   Zone 1  [yellow]  interior field beyond 2a from every edge
 *
 * UV boundary math:
 *   u spans full B  → "a" in u = u_zone/2  (u_zone = 2a/B)
 *   v spans full L  → "a" in v = v_zone    (v_zone = a/L)
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-monoslope-free'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, mkSlopeDimExt, THEME, THREE,
              u_zone, v_zone, zone_a, hB, hL, hEave, hRidge,
              ptFn, norm, doLabel } = ctx;

      /* ── UV boundaries ─────────────────────────────────────────────────
         u_a  = one "a" strip in u  (= u_zone / 2)
         u_2a = two "a" strips in u (= u_zone)
         v_a  = one "a" strip in v  (= v_zone)
         v_2a = two "a" strips in v (= 2 * v_zone)                       */
      const u_a  = Math.min(u_zone / 2, 0.30);
      const u_2a = Math.min(u_zone,     0.45);
      const v_a  = Math.min(v_zone,     0.30);
      const v_2a = Math.min(2 * v_zone, 0.45);

      /* ── Zone 1 — interior field ─────────────────────────────────────── */
      addZone(u_2a, 1 - u_2a, v_2a, 1 - v_2a,
              THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);

      /* ── Zone 2 — second ring (from a to 2a on every side) ──────────── */
      /* Bottom strip (includes the two bottom corners of zone 2) */
      addZone(u_a, 1 - u_a, v_a, v_2a,
              THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      /* Top strip — label here (front face, most visible) */
      addZone(u_a, 1 - u_a, 1 - v_2a, 1 - v_a,
              THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
      /* Left mid (HIGH eave side, between bottom and top zone-2 corner strips) */
      addZone(u_a, u_2a, v_2a, 1 - v_2a,
              THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      /* Right mid (LOW eave side) */
      addZone(1 - u_2a, 1 - u_a, v_2a, 1 - v_2a,
              THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);

      /* ── Zone 3 — outermost perimeter strip of width "a" ────────────── */
      /* Left column — HIGH eave side (includes gable corners) */
      addZone(0, u_a, 0, 1,
              THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      /* Right column — LOW eave side (includes gable corners) */
      addZone(1 - u_a, 1, 0, 1,
              THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      /* Bottom strip — back gable (between the two columns) */
      addZone(u_a, 1 - u_a, 0, v_a,
              THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      /* Top strip — front gable, label here */
      addZone(u_a, 1 - u_a, 1 - v_a, 1,
              THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);

      /* ── Dimension lines (front face, v=1) ──────────────────────────── */
      if (doLabel && mkSlopeDim && mkSlopeDimExt && THREE && THREE.CSS2DObject) {
        const a_s  = zone_a.toFixed(1);
        const a2_s = (2 * zone_a).toFixed(1);

        /* Small inward offsets so dim line sits just outside the zone boundary */
        const vIn  = Math.min(0.06, v_a  * 0.4);
        const uIn  = Math.min(0.06, u_a  * 0.4);

        /* ── "a" zone-3 gable depth (v direction), on HIGH-eave side ──── */
        /* Dim outside zone-3 top strip (above v = 1 - v_a) */
        const vDim3 = Math.max(0.02, 1 - v_a - vIn);
        mkSlopeDimExt('a=' + a_s + 'ft',
          ptFn(uIn,     vDim3, hB, hEave, hRidge, hL),
          ptFn(uIn,     1,     hB, hEave, hRidge, hL),
          [
            [ptFn(0,    1 - v_a, hB, hEave, hRidge, hL), ptFn(uIn, 1 - v_a, hB, hEave, hRidge, hL)],
            [ptFn(0,    1,       hB, hEave, hRidge, hL), ptFn(uIn, 1,       hB, hEave, hRidge, hL)],
          ],
          norm);

        /* ── "a" zone-3 eave strip width (u direction), on front gable ── */
        const vFront = Math.max(0.96, 1 - v_a * 0.20);
        mkSlopeDimExt('a=' + a_s + 'ft',
          ptFn(0,    vFront, hB, hEave, hRidge, hL),
          ptFn(u_a,  vFront, hB, hEave, hRidge, hL),
          [
            [ptFn(0,   1 - v_a, hB, hEave, hRidge, hL), ptFn(0,   vFront, hB, hEave, hRidge, hL)],
            [ptFn(u_a, 1 - v_a, hB, hEave, hRidge, hL), ptFn(u_a, vFront, hB, hEave, hRidge, hL)],
          ],
          norm);

        /* ── "2a" total (zone-3 + zone-2) gable depth on HIGH-eave side ─ */
        const vDim2 = Math.max(0.02, 1 - v_2a - vIn);
        mkSlopeDimExt('2a=' + a2_s + 'ft',
          ptFn(u_2a + uIn, vDim2, hB, hEave, hRidge, hL),
          ptFn(u_2a + uIn, 1,     hB, hEave, hRidge, hL),
          [
            [ptFn(u_2a, 1 - v_2a, hB, hEave, hRidge, hL), ptFn(u_2a + uIn, 1 - v_2a, hB, hEave, hRidge, hL)],
            [ptFn(u_2a, 1,        hB, hEave, hRidge, hL), ptFn(u_2a + uIn, 1,        hB, hEave, hRidge, hL)],
          ],
          norm);
      }
    },
  };
})();
