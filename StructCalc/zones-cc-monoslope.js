/* zones-cc-monoslope.js
 * C&C Monoslope Roof — ASCE 7-22 Fig. 30.3-5A (3° < θ ≤ 10°)
 * Zone layout per plan view of Fig. 30.3-5A:
 *   u=0 = HIGH eave (left), u=1 = LOW eave (right)
 *   v=0 = front gable end, v=1 = back gable end
 *
 *  Zone 3' — high eave × gable corners  (4a deep from high eave, 2a from rake)
 *  Zone 2' — high eave middle strip (4a) + interior rake strips (2a)
 *  Zone 3  — low eave × gable corners   (2a deep from low eave,  2a from rake)
 *  Zone 2  — low eave middle strip (2a)
 *  Zone 1  — interior field
 *
 * GCp values: placeholder colors only — coefficient arrays to be provided.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-monoslope'] = {
    drawZones(ctx) {
      const { addZone, THEME, THREE, u_zone, v_zone, zone_a, hB, hL,
              ptFn, norm, doLabel } = ctx;

      /* Zone dimension multiples of 'a':
         High-eave strip:  4a in u-direction (from u=0)
         Low-eave strip:   2a in u-direction (from u=1)
         Rake strips:      2a in v-direction (from each gable end)          */
      const u_4a = Math.min(u_zone * 4, 0.60);            // 4a from high eave
      const u_lo = Math.max(1 - Math.min(u_zone * 2, 0.30), u_4a + 0.02); // low-eave boundary
      const v_2a = Math.min(v_zone * 2, 0.40);            // 2a from each gable end
      const v_lo = 1 - v_2a;

      /* Zone 1 — interior field */
      addZone(u_4a, u_lo, v_2a, v_lo, THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);

      /* Zone 2 — low eave middle strip */
      addZone(u_lo, 1, v_2a, v_lo, THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);

      /* Zone 2' (use zone2 color for now) — high eave middle strip */
      addZone(0, u_4a, v_2a, v_lo, THEME.zone2, 0.50, 'zone-2', 0.07, ptFn, norm, false);

      /* Zone 2' — interior rake strips (between high- and low-eave corner zones) */
      addZone(u_4a, u_lo, 0,    v_2a, THEME.zone2, 0.50, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u_4a, u_lo, v_lo, 1,    THEME.zone2, 0.50, 'zone-2', 0.07, ptFn, norm, false);

      /* Zone 3 — low eave × gable corners */
      addZone(u_lo, 1, 0,    v_2a, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
      addZone(u_lo, 1, v_lo, 1,    THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);

      /* Zone 3' — high eave × gable corners (worst suction) */
      addZone(0, u_4a, 0,    v_2a, THEME.zone3, 0.85, 'zone-3', 0.18, ptFn, norm, doLabel);
      addZone(0, u_4a, v_lo, 1,    THEME.zone3, 0.85, 'zone-3', 0.18, ptFn, norm, false);
    },
  };
})();
