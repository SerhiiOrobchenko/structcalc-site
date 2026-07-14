/* zones-cc-troughed-free.js  v2
 * C&C Open Building — Troughed Free Roof
 * ASCE 7-22 Fig. 30.5-3  (0.25 ≤ h/L ≤ 1.0, θ ≤ 45°)
 *
 * Same zone layout as Fig. 30.5-2 (pitched-free), applied:
 *   θ <  10°: concentric rings over the FULL roof
 *             UV: u=0 = left outer edge (HIGH), u=0.5 = valley (LOW), u=1 = right outer (HIGH)
 *   θ ≥ 10°: each slope independently
 *             Left slope:  u=0 → outer edge (HIGH=hRidge), u=1 → valley (LOW=hEave)
 *             Right slope: u=0 → valley (LOW=hEave),       u=1 → outer edge (HIGH=hRidge)
 *
 * In addZone ctx:  hEave_vis = hValley (LOW center), hRidge = hSide (HIGH outer edges)
 * addZone passes (u, v, hB_vis, hEave_vis, hRidge, hL_vis) to ptFn
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-troughed-free'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, THEME, THREE,
              u_zone, v_zone, zone_a, hB, hL, hEave, hRidge, ptFn, norm, doLabel } = ctx;

      /* hEave = hValley (low), hRidge = hSide (high outer) */
      const theta_deg = hB > 0
        ? Math.atan2(Math.abs(hRidge - hEave), hB) * 180 / Math.PI
        : 0;

      if (theta_deg < 10) {
        /* ── Full-roof treatment — same layout as monoslope-free ────────── */
        /* ptFn and norm come from the dispatcher (renderer.js)             */
        const u_a  = Math.min(u_zone / 2, 0.30);
        const u_2a = Math.min(u_zone,     0.45);
        const v_a  = Math.min(v_zone,     0.30);
        const v_2a = Math.min(2 * v_zone, 0.45);
        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptFn, norm, doLabel);

      } else {
        /* ── Per-slope treatment ─────────────────────────────────────────── */
        /* Left slope: x from -hB → 0, y from hSide(hR) → hValley(hE)  (going DOWN) */
        const ptTL = (u, v, _b, _e, _r, _l) =>
          new THREE.Vector3(-_b + u * _b, _r + u * (_e - _r), v * 2 * _l - _l);
        /* Right slope: x from 0 → +hB, y from hValley(hE) → hSide(hR) (going UP) */
        const ptTR = (u, v, _b, _e, _r, _l) =>
          new THREE.Vector3(u * _b, _e + u * (_r - _e), v * 2 * _l - _l);

        /* Left slope normal: e1=(hB, hE-hR, 0) × e2=(0,0,2hL)
           hE < hR → e1 has negative y → cross product has negative y → negate */
        const e1TL = new THREE.Vector3(hB, hEave - hRidge, 0);
        const e2   = new THREE.Vector3(0, 0, 2 * hL);
        const nTL  = new THREE.Vector3().crossVectors(e1TL, e2).normalize();
        if (nTL.y < 0) nTL.negate();
        /* Right slope normal: mirror in x */
        const nTR  = new THREE.Vector3(-nTL.x, nTL.y, nTL.z);

        const u_a  = Math.min(u_zone,     0.30);
        const u_2a = Math.min(2 * u_zone, 0.45);
        const v_a  = Math.min(v_zone,     0.30);
        const v_2a = Math.min(2 * v_zone, 0.45);

        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptTL, nTL, false);
        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptTR, nTR, doLabel);
      }
    },
  };

  function _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
                  hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptFn, norm, doLabel) {
    addZone(u_2a,   1-u_2a, v_2a,   1-v_2a, THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
    addZone(u_a,   1-u_a,  v_a,   v_2a,    THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(u_a,   1-u_a,  1-v_2a,1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
    addZone(u_a,   u_2a,   v_2a,  1-v_2a,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(1-u_2a,1-u_a,  v_2a,  1-v_2a,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(0,     u_a,    0, 1,            THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(1-u_a, 1,      0, 1,            THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(u_a,   1-u_a,  0,   v_a,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(u_a,   1-u_a,  1-v_a, 1,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
    if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
      const a_s = zone_a.toFixed(1);
      mkSlopeDim('a='+a_s+'ft', ptFn(0,    0.5, hB,hEave,hRidge,hL),
                                 ptFn(u_a,  0.5, hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(u_a,  0.5, hB,hEave,hRidge,hL),
                                 ptFn(u_2a, 0.5, hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(0.5, 1-v_a,  hB,hEave,hRidge,hL),
                                 ptFn(0.5, 1,       hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(0.5, 1-v_2a,  hB,hEave,hRidge,hL),
                                 ptFn(0.5, 1-v_a,   hB,hEave,hRidge,hL), norm);
    }
  }
})();
