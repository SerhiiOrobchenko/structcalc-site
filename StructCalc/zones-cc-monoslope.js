/* zones-cc-monoslope.js  v2
 * C&C Monoslope Roof — ASCE 7-22 Fig. 30.3-5A (3° < θ ≤ 10°)
 *
 * UV space (ptMono):  u=0 = HIGH eave (left),  u=1 = LOW eave (right)
 *                     v=0 = back gable,         v=1 = front gable
 *
 * Zone layout (plan view):
 *   Zone 3'  — HIGH eave × gable corners:  2a deep (u) × 4a wide (v)
 *   Zone 2'  — HIGH eave middle strip:     2a deep (u), between 3' corners
 *   Zone 2'  — Short-side (gable) strips:  2a wide (v), full span HIGH→LOW
 *   Zone 3   — LOW eave × gable corners:   2a deep (u) × 2a wide (v)
 *   Zone 2   — LOW eave middle:             a deep (u), between Zone 3 corners
 *   Zone 1   — Interior field
 *
 * GCp arrays: placeholder opacity only — coefficient data to follow.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-monoslope'] = {
    drawZones(ctx) {
      const { addZone, THEME, u_zone, v_zone, ptFn, norm, doLabel } = ctx;

      /* ── UV boundaries ──────────────────────────────────────────────────────
         u_zone = 2a/B  →  u_zone   = 2a strip from HIGH eave
                           u_zone/2 =  a strip from LOW eave
         v_zone = a/L   →  2*v_zone = 2a strip from each gable end
                            4*v_zone = 4a strip from each gable end             */
      const u_hi2 = Math.min(u_zone,       0.45);              // 2a from HIGH eave
      const u_lo2 = Math.max(1 - u_zone,   u_hi2 + 0.04);     // 2a from LOW eave (Zone 3)
      const u_lo1 = Math.max(1 - u_zone/2, u_lo2 + 0.02);     // a  from LOW eave (Zone 2)
      const v_2a  = Math.min(2 * v_zone,   0.40);              // 2a from each gable end
      const v_4a  = Math.min(4 * v_zone,   0.45);              // 4a from each gable end
      const v_lo2 = 1 - v_2a;
      const v_lo4 = 1 - v_4a;

      /* Zone 1 — interior field */
      addZone(u_hi2, u_lo1, v_2a, v_lo2, THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);

      /* Zone 2 — LOW eave middle strip (a deep) */
      addZone(u_lo1, 1, v_2a, v_lo2, THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);

      /* Zone 2' — HIGH eave middle strip (2a deep) */
      addZone(0, u_hi2, v_4a, v_lo4, THEME.zone2, 0.50, 'zone-2p', 0.08, ptFn, norm, false);

      /* Zone 2' — gable (short-side) strips (2a wide, spanning HIGH→LOW zone) */
      /* back gable */
      addZone(u_hi2, u_lo2, 0,     v_2a, THEME.zone2, 0.50, 'zone-2p', 0.08, ptFn, norm, false);
      /* front gable — label here (opposite/visible side) */
      addZone(u_hi2, u_lo2, v_lo2, 1,    THEME.zone2, 0.50, 'zone-2p', 0.08, ptFn, norm, doLabel);

      /* Zone 3 — LOW eave × gable corners (2a × 2a) */
      addZone(u_lo2, 1, 0,     v_2a, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(u_lo2, 1, v_lo2, 1,    THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);

      /* Zone 3' — HIGH eave × gable corners (2a × 4a, worst suction) */
      addZone(0, u_hi2, 0,     v_4a, THEME.zone3, 0.85, 'zone-3p', 0.18, ptFn, norm, false);
      addZone(0, u_hi2, v_lo4, 1,    THEME.zone3, 0.85, 'zone-3p', 0.18, ptFn, norm, doLabel);
    },
  };
})();
