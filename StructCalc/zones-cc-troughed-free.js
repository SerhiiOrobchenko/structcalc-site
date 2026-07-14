/* zones-cc-troughed-free.js  v3
 * C&C Open Building — Troughed Free Roof
 * ASCE 7-22 Fig. 30.5-3  (0.25 <= h/L <= 1.0, theta <= 45 deg)
 *
 * In ctx:  hEave = hValley (LOW, center), hRidge = hSide (HIGH, outer edges)
 *
 * theta <  10 deg: per-slope U-shape — zones 3/2 along outer eave + rakes,
 *                  NOT along the valley.
 *   Left slope:  u=0 = outer edge (HIGH=hRidge), u=1 = valley (LOW=hEave)
 *   Right slope: u=0 = valley (LOW=hEave),       u=1 = outer edge (HIGH=hRidge)
 *
 * theta >= 10 deg: each slope gets its own 4-sided concentric rings (unchanged).
 *
 * addZone passes (u, v, hB_vis, hEave_vis, hRidge, hL_vis) to ptFn.
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-troughed-free'] = {
    drawZones(ctx) {
      const { addZone, mkSlopeDim, THEME, THREE,
              u_zone, v_zone, zone_a, hB, hL, hEave, hRidge, doLabel } = ctx;

      /* hEave = hValley (low), hRidge = hSide (high outer) */
      const theta_deg = hB > 0
        ? Math.atan2(Math.abs(hRidge - hEave), hB) * 180 / Math.PI
        : 0;

      /* ── Per-slope ptFn — same for both theta branches ────────────────── */
      /* Left slope: u=0 = outer edge (HIGH=hRidge), u=1 = valley (LOW=hEave) */
      const ptTL = (u, v, _b, _e, _r, _l) =>
        new THREE.Vector3(-_b + u * _b, _r + u * (_e - _r), v * 2 * _l - _l);
      /* Right slope: u=0 = valley (LOW=hEave), u=1 = outer edge (HIGH=hRidge) */
      const ptTR = (u, v, _b, _e, _r, _l) =>
        new THREE.Vector3(u * _b, _e + u * (_r - _e), v * 2 * _l - _l);

      /* Left slope normal: e1=(hB, hE-hR, 0) x e2=(0,0,2hL) */
      const e1TL = new THREE.Vector3(hB, hEave - hRidge, 0);
      const e2   = new THREE.Vector3(0, 0, 2 * hL);
      const nTL  = new THREE.Vector3().crossVectors(e1TL, e2).normalize();
      if (nTL.y < 0) nTL.negate();
      /* Right slope normal: mirror in x */
      const nTR  = new THREE.Vector3(-nTL.x, nTL.y, nTL.z);

      /* Per-slope zone fractions (each slope spans hB_vis) */
      const u_a  = Math.min(u_zone,     0.30);
      const u_2a = Math.min(2 * u_zone, 0.45);
      const v_a  = Math.min(v_zone,     0.30);
      const v_2a = Math.min(2 * v_zone, 0.45);

      if (theta_deg < 10) {
        /* ── U-shape: zones at outer eave + rakes, open at valley ──────── */
        /* Left slope: outer eave at u=0 */
        _ringsU(addZone, mkSlopeDim, THEME, THREE, zone_a,
                hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptTL, nTL, false, true);
        /* Right slope: outer eave at u=1 */
        _ringsU(addZone, mkSlopeDim, THEME, THREE, zone_a,
                hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptTR, nTR, doLabel, false);
      } else {
        /* ── 4-sided rings (theta >= 10 deg) — unchanged ────────────────── */
        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptTL, nTL, false);
        _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
               hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptTR, nTR, doLabel);
      }
    },
  };

  /* ── Full 4-sided concentric rings (theta >= 10 deg) ──────────────────── */
  function _rings(addZone, mkSlopeDim, THEME, THREE, zone_a,
                  hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptFn, norm, doLabel) {
    /* Zone 1 */
    addZone(u_2a,    1-u_2a, v_2a,    1-v_2a, THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
    /* Zone 2 */
    addZone(u_a,    1-u_a,  v_a,    v_2a,    THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(u_a,    1-u_a,  1-v_2a, 1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
    addZone(u_a,    u_2a,   v_2a,   1-v_2a,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    addZone(1-u_2a, 1-u_a,  v_2a,   1-v_2a,  THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
    /* Zone 3 */
    addZone(0,      u_a,    0,      1,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(1-u_a,  1,      0,      1,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(u_a,    1-u_a,  0,      v_a,      THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
    addZone(u_a,    1-u_a,  1-v_a,  1,        THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
    /* Dims */
    if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
      const a_s = zone_a.toFixed(1);
      mkSlopeDim('a='+a_s+'ft', ptFn(0,    0.5, hB,hEave,hRidge,hL),
                                 ptFn(u_a,  0.5, hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(u_a,  0.5, hB,hEave,hRidge,hL),
                                 ptFn(u_2a, 0.5, hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(0.5,  1-v_a,  hB,hEave,hRidge,hL),
                                 ptFn(0.5,  1,       hB,hEave,hRidge,hL), norm);
      mkSlopeDim('a='+a_s+'ft', ptFn(0.5,  1-v_2a, hB,hEave,hRidge,hL),
                                 ptFn(0.5,  1-v_a,  hB,hEave,hRidge,hL), norm);
    }
  }

  /* ── U-shape: 3-sided rings (outer eave + rakes, NOT valley) ──────────── */
  /* eaveAtU0=true:  outer eave at u=0, valley at u=1 (left slope)           */
  /* eaveAtU0=false: outer eave at u=1, valley at u=0 (right slope)          */
  function _ringsU(addZone, mkSlopeDim, THEME, THREE, zone_a,
                   hB, hL, hEave, hRidge, u_a, u_2a, v_a, v_2a, ptFn, norm, doLabel, eaveAtU0) {
    if (eaveAtU0) {
      /* Outer eave at u=0 — U opens toward u=1 (valley) */
      /* Zone 3 */
      addZone(0,     u_a,   0,       1,       THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(u_a,   1,     0,       v_a,     THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(u_a,   1,     1-v_a,   1,       THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
      /* Zone 2 */
      addZone(u_a,   u_2a,  v_a,     1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u_2a,  1,     v_a,     v_2a,    THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(u_2a,  1,     1-v_2a,  1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
      /* Zone 1 */
      addZone(u_2a,  1,     v_2a,    1-v_2a,  THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
      /* Dims */
      if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
        const a_s = zone_a.toFixed(1);
        mkSlopeDim('a='+a_s+'ft', ptFn(0,    0.5, hB,hEave,hRidge,hL),
                                   ptFn(u_a,  0.5, hB,hEave,hRidge,hL), norm);
        mkSlopeDim('a='+a_s+'ft', ptFn(u_a,  0.5, hB,hEave,hRidge,hL),
                                   ptFn(u_2a, 0.5, hB,hEave,hRidge,hL), norm);
        mkSlopeDim('a='+a_s+'ft', ptFn(0.5,  1-v_a,  hB,hEave,hRidge,hL),
                                   ptFn(0.5,  1,       hB,hEave,hRidge,hL), norm);
        mkSlopeDim('a='+a_s+'ft', ptFn(0.5,  1-v_2a, hB,hEave,hRidge,hL),
                                   ptFn(0.5,  1-v_a,  hB,hEave,hRidge,hL), norm);
      }
    } else {
      /* Outer eave at u=1 — U opens toward u=0 (valley) */
      /* Zone 3 */
      addZone(1-u_a,  1,     0,       1,       THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(0,      1-u_a, 0,       v_a,     THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, false);
      addZone(0,      1-u_a, 1-v_a,   1,       THEME.zone3, 0.65, 'zone-3', 0.12, ptFn, norm, doLabel);
      /* Zone 2 */
      addZone(1-u_2a, 1-u_a, v_a,     1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(0,      1-u_2a,v_a,     v_2a,    THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, false);
      addZone(0,      1-u_2a,1-v_2a,  1-v_a,   THEME.zone2, 0.35, 'zone-2', 0.07, ptFn, norm, doLabel);
      /* Zone 1 */
      addZone(0,      1-u_2a,v_2a,    1-v_2a,  THEME.zone1, 0.20, 'zone-1', 0.02, ptFn, norm, doLabel);
      /* Dims */
      if (doLabel && mkSlopeDim && THREE && THREE.CSS2DObject) {
        const a_s = zone_a.toFixed(1);
        mkSlopeDim('a='+a_s+'ft', ptFn(1,      0.5, hB,hEave,hRidge,hL),
                                   ptFn(1-u_a,  0.5, hB,hEave,hRidge,hL), norm);
        mkSlopeDim('a='+a_s+'ft', ptFn(1-u_a,  0.5, hB,hEave,hRidge,hL),
                                   ptFn(1-u_2a, 0.5, hB,hEave,hRidge,hL), norm);
        mkSlopeDim('a='+a_s+'ft', ptFn(0.5,  1-v_a,  hB,hEave,hRidge,hL),
                                   ptFn(0.5,  1,       hB,hEave,hRidge,hL), norm);
        mkSlopeDim('a='+a_s+'ft', ptFn(0.5,  1-v_2a, hB,hEave,hRidge,hL),
                                   ptFn(0.5,  1-v_a,  hB,hEave,hRidge,hL), norm);
      }
    }
  }
})();
