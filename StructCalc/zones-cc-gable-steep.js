/* zones-cc-gable-steep.js
 * C&C Gable Roof θ > 27° — ASCE 7-22 Fig. 30.3-2C/2D
 * Zone 3 at eave × rake corners only. Ridge × rake = Zone 2.
 * ctx.ptFn, ctx.norm, ctx.doLabel provided by renderer.js per slope.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-gable-steep'] = {
    drawZones(ctx) {
      const { addZone, THEME, u_zone, u1, v_zone, v1, ptFn, norm, doLabel } = ctx;
      /* Zone 1 */
      addZone(u_zone, u1,    v_zone, v1,   THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
      /* Zone 2: eave middle strip */
      addZone(0,      u_zone, v_zone, v1,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      /* Zone 2: full ridge strip — no Zone 3 at ridge × rake corners */
      addZone(u1,     1,      0,      1,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      /* Zone 2: rake middle strips */
      addZone(u_zone, u1,     0,      v_zone, THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u_zone, u1,     v1,     1,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      /* Zone 3: eave × rake corners only */
      addZone(0,      u_zone, 0,      v_zone, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
      addZone(0,      u_zone, v1,     1,   THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    },
  };
})();
