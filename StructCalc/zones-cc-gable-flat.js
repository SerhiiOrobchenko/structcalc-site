/* zones-cc-gable-flat.js
 * C&C Gable / Flat Roof θ ≤ 7° — ASCE 7-22 Fig. 30.3-2A
 * h_m = eave height (ASCE uses eave height for θ ≤ 10° flat-roof method).
 * Zone 1': centre field (beyond 1.2h from every edge)
 * Zone 1 : 0.6h → 1.2h perimeter band from eave + rakes
 * Zone 2 : 0 → 0.6h perimeter band from eave + rakes
 * Zone 3 : L-shaped corners at eave × rake (0.6h along edge, 0.2h deep)
 * Ridge (u=1) = interior joint — no zone bands on ridge side.
 * ctx.ptFn, ctx.norm, ctx.doLabel provided by renderer.js per slope.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-gable-flat'] = {
    drawZones(ctx) {
      const { addZone, mkDimChip, THEME, THREE,
              hEave_ft, hB, hL, hEave, hRidge,
              ptFn, norm, doLabel } = ctx;
      const h_m  = hEave_ft;                                    // eave height, ft
      const u2   = Math.min(0.6  * h_m / hB,       0.45);     // 0.6h from eave (u)
      const u3   = Math.min(0.2  * h_m / hB,       u2);       // 0.2h from eave (Zone 3 arm depth)
      const u1e  = Math.min(1.2  * h_m / hB,       0.48);     // 1.2h from eave (Zone 1 inner)
      const v2   = Math.min(0.6  * h_m / (2*hL),   0.45);     // 0.6h from rake (v)
      const v_z3 = Math.min(0.2  * h_m / (2*hL),   v2);       // 0.2h from rake (Zone 3 arm depth)
      const vv1  = 1 - v2;
      const vz1  = Math.min(1.2  * h_m / (2*hL),   0.48);     // 1.2h from rake (Zone 1 inner)
      const vz1r = 1 - vz1;

      /* Paint order: 1' → 1 → 2 → 3 (higher eps wins visually) */
      /* Zone 1' — centre field */
      addZone(u1e, 1,   vz1,  vz1r, THEME.zone1, 0.20, 'zone-1p', 0.04, ptFn, norm, doLabel);
      /* Zone 1 — 0.6h→1.2h perimeter band */
      addZone(u2,  u1e, 0,    1,    THEME.zone1, 0.22, 'zone-1',  0.03, ptFn, norm, doLabel);
      addZone(u1e, 1,   v2,   vz1,  THEME.zone1, 0.22, 'zone-1',  0.03, ptFn, norm, false);
      addZone(u1e, 1,   vz1r, vv1,  THEME.zone1, 0.22, 'zone-1',  0.03, ptFn, norm, false);
      /* Zone 2 — outer 0.6h perimeter band */
      addZone(0,   u2,  v2,   vv1,  THEME.zone2, 0.35, 'zone-2',  0.07, ptFn, norm, doLabel);
      addZone(0,   1,   0,    v2,   THEME.zone2, 0.35, 'zone-2',  0.07, ptFn, norm, false);
      addZone(0,   1,   vv1,  1,    THEME.zone2, 0.35, 'zone-2',  0.07, ptFn, norm, false);
      /* Zone 3 — L-shaped corners at eave × rake */
      addZone(0,   u3,  0,       v2,   THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
      addZone(u3,  u2,  0,       v_z3, THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(0,   u3,  vv1,     1,    THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(u3,  u2,  1-v_z3,  1,   THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);

      /* Dimension annotations (first slope only) */
      if (doLabel && THREE.CSS2DObject) {
        const d06  = (0.6 * hEave_ft).toFixed(1);
        const d02  = (0.2 * hEave_ft).toFixed(1);
        const nDir = norm.clone().normalize();
        /* "0.6h = X.Xft" at outer band mid-point */
        const pt06 = ptFn(u2 * 0.5, 0.70, hB, hEave, hRidge, hL).addScaledVector(nDir, 0.5);
        mkDimChip(`0.6h = ${d06}ft`, pt06, null, nDir);
        /* "0.2h = X.Xft" with leader line at Zone 3 corner */
        const cornerAnchor = ptFn(u3 * 0.5, v2 * 0.4, hB, hEave, hRidge, hL).addScaledVector(nDir, 0.2);
        const outDir = new THREE.Vector3(norm.x, 0, norm.z).normalize();
        const lbl02  = cornerAnchor.clone()
          .addScaledVector(outDir, hB * 0.30)
          .addScaledVector(nDir,   0.45);
        lbl02.y = Math.max(lbl02.y, hEave * 0.35);
        mkDimChip(`0.2h = ${d02}ft`, lbl02, cornerAnchor, nDir);
      }
    },
  };
})();
