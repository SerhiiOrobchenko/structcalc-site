/* zones-cc-pitched-free.js  v2
 * C&C Open Building — Pitched Free Roof
 * ASCE 7-22 Fig. 30.5-2  (0.25 ≤ h/L ≤ 1.0, θ ≤ 45°)
 *
 * θ <  10°: concentric ring layout over the FULL roof (same as monoslope-free)
 *           UV: u=0 = left eave, u=0.5 = ridge, u=1 = right eave
 *
 * θ ≥ 10°: each slope independently gets its own concentric rings
 *   Left slope:  u=0 → x=-hB (left eave, low), u=1 → x=0 (ridge, high)
 *   Right slope: u=0 → x=0   (ridge, high),     u=1 → x=+hB (right eave, low)
 *   Per-slope u_a = u_zone (each slope spans hB in x, same as full-roof hB_vis)
 *
 * addZone passes (u, v, hB_vis, hEave_vis, hRidge, hL_vis) to ptFn
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-pitched-free'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, THEME, THREE,
              u_zone, v_zone, zone_a, hB, hL, hEave, hRidge, ptFn, norm, doLabel } = ctx;

      /* Slope angle from geometry */
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
        /* Left slope: x from -hB → 0, y from hEave → hRidge */
        const ptL = (u, v, _b, _e, _r, _l) =>
          new THREE.Vector3(-_b + u * _b, _e + u * (_r - _e), v * 2 * _l - _l);
        /* Right slope: x from 0 → +hB, y from hRidge → hEave */
        const ptR = (u, v, _b, _e, _r, _l) =>
          new THREE.Vector3(u * _b, _r + u * (_e - _r), v * 2 * _l - _l);

        /* Left normal: e1=(hB, hR-hE, 0) × e2=(0,0,2hL) */
        const e1L = new THREE.Vector3(hB, hRidge - hEave, 0);
        const e2  = new THREE.Vector3(0, 0, 2 * hL);
        const nL  = new THREE.Vector3().crossVectors(e1L, e2).normalize();
        if (nL.y < 0) nL.negate();
        /* Right normal: mirror of left in x */
        const nR  = new THREE.Vector3(-nL.x, nL.y, nL.z);

        /* Per-slope: each slope spans hB, so u_a = u_zone (not /2) */
        const u_a  = Math.min(u_zone,     0.30);
        const u_2a = Math.min(2 * u_zone, 0.45);
        const v_a  = Math.min(v_zone,     0.30);
        const v_2a = Math.min(2 * v_zone, 0.45);

        /* Left slope — no labels to avoid duplication */
        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptL, nL, false);
        /* Right slope — labels here */
        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptR, nR, doLabel);
      }
    },
  };

  function _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
                  hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptFn, norm, doLabel) {
    /* Zone 1 — interior */
    addZone(u_2a,   1-u_2a, v_2a,   1-v_2a, THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
    /* Zone 2 */
    addZone(u_a,   1-u_a,  v_a,   v_2a,    THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(u_a,   1-u_a,  1-v_2a,1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
    addZone(u_a,   u_2a,   v_2a,  1-v_2a,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(1-u_2a,1-u_a,  v_2a,  1-v_2a,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    /* Zone 3 */
    addZone(0,     u_a,    0, 1,            THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(1-u_a, 1,      0, 1,            THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(u_a,   1-u_a,  0,   v_a,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(u_a,   1-u_a,  1-v_a, 1,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
    /* Dims */
    if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
      const a_s = zone_a.toFixed(1);
      /* Along B at center of L (v=0.5) */
      mkSlopeDim('a='+a_s+'ft', ptFn(0,    0.5, hB,hEave,hRidge,hL),
                                 ptFn(u_a,  0.5, hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(u_a,  0.5, hB,hEave,hRidge,hL),
                                 ptFn(u_2a, 0.5, hB,hEave,hRidge,hL), norm);
      /* Along L at center of B (u=0.5) */
      mkSlopeDim('a='+a_s+'ft', ptFn(0.5, 1-v_a,  hB,hEave,hRidge,hL),
                                 ptFn(0.5, 1,       hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(0.5, 1-v_2a,  hB,hEave,hRidge,hL),
                                 ptFn(0.5, 1-v_a,   hB,hEave,hRidge,hL), norm);
    }
  }
})();
