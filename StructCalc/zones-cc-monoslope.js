/* zones-cc-monoslope.js
 * C&C Monoslope Roof — ASCE 7-22 Fig. 30.3-5A/5B
 * Zone layout on one trapezoidal surface (u=0 windward/high, u=1 leeward/low).
 * ctx.ptFn, ctx.norm, ctx.doLabel provided by renderer.js per call.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-monoslope'] = {
    drawZones(ctx) {
      const { addZone, THEME, u_zone, u1, v_zone, v1, ptFn, norm, doLabel } = ctx;
      /* Zone 1: interior field */
      addZone(u_zone, u1,    v_zone, v1,    THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
      /* Zone 2: four perimeter strips */
      addZone(0,      u_zone, v_zone, v1,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
      addZone(u1,     1,      v_zone, v1,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u_zone, u1,     0,      v_zone, THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u_zone, u1,     v1,     1,    THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      /* Zone 3: four corner blocks */
      addZone(0,      u_zone, 0,      v_zone, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
      addZone(0,      u_zone, v1,     1,    THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(u1,     1,      0,      v_zone, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(u1,     1,      v1,     1,    THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    },
  };
})();
