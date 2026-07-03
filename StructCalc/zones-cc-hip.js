/* zones-cc-hip.js
 * C&C Hip Roof — ASCE 7-22 Figs. 30.3-2D–2G
 * Zone 3: eave perimeter strip width a (all 4 eave edges, continuous)
 * Zone 2: U-shaped strip width a along hip ridges + main ridge on trapezoidal slopes;
 *         constant-width a strips along hip ridges on triangular end slopes
 * Zone 1: interior
 * ctx keys used: addZone, addQuadMesh, addTriPart, makeZoneLabelFlat, leftNormal,
 *                THEME, THREE, B, L, hEave, hRidge, hEave_ft, zone_a
 */
(function () {
  'use strict';
  window.ZONE_DESCRIPTORS = window.ZONE_DESCRIPTORS || {};
  window.ZONE_DESCRIPTORS['cc-hip'] = {
    drawZones(ctx) {
      const { addZone, addQuadMesh, addTriPart, makeZoneLabelFlat,
              leftNormal, THEME, THREE,
              B, L, hEave, hRidge, zone_a } = ctx;

      const _hipB  = Math.min(B, L), _hipL = Math.max(B, L);
      const _hipHB = _hipB / 2, _hipHL = _hipL / 2;
      const _triH  = _hipHB;
      const _r2    = _hipHL - _triH;
      const L_hip  = Math.sqrt(_hipHB * _hipHB + _triH * _triH);

      const xzSwap = B > L;
      const xzW = p => xzSwap ? new THREE.Vector3(p.z, p.y, p.x) : p;

      /* Surface functions for trapezoidal main slopes */
      const ptHipL = (u, v) => {
        const zH = (1-u)*_hipHL + u*_r2;
        return new THREE.Vector3(-_hipHB*(1-u), (1-u)*hEave + u*hRidge, (2*v-1)*zH);
      };
      const ptHipR = (u, v) => {
        const zH = (1-u)*_hipHL + u*_r2;
        return new THREE.Vector3( _hipHB*(1-u), (1-u)*hEave + u*hRidge, (2*v-1)*zH);
      };
      const wrapL = (u, v) => xzW(ptHipL(u, v));
      const wrapR = (u, v) => xzW(ptHipR(u, v));

      /* Normals */
      const _leftNorm0  = leftNormal(_hipHB, hEave, hRidge, _hipHL);
      const _rightNorm0 = new THREE.Vector3(-_leftNorm0.x, _leftNorm0.y, _leftNorm0.z);
      const _leftNorm  = xzSwap ? new THREE.Vector3(_leftNorm0.z, _leftNorm0.y, _leftNorm0.x) : _leftNorm0;
      const _rightNorm = xzSwap ? new THREE.Vector3(_rightNorm0.z,_rightNorm0.y,_rightNorm0.x) : _rightNorm0;

      /* Zone width fractions */
      const _ua    = Math.min(zone_a / _hipHB, 0.45);
      const _ua2   = Math.min(zone_a / _hipHB, 0.45);
      const _zH_ua  = (1-_ua)  * _hipHL + _ua  * _r2;
      const _zH_ua2 =    _ua2  * _hipHL + (1-_ua2) * _r2;
      const _ve_h   = Math.min(zone_a*L_hip / (2*_hipHB*_zH_ua),  0.45);
      const _vr_h   = Math.min(zone_a*L_hip / (2*_hipHB*_zH_ua2), 0.45);

      /* ── Trapezoidal main slopes ── */
      const drawHipMainSlope = (wrapFn, norm) => {
        const pf = (u, v) => wrapFn(u, v);

        /* Zone 1: interior quad, v-boundaries calibrated to hip-strip inner edges */
        addQuadMesh(
          pf(_ua,      _ve_h), pf(_ua,    1-_ve_h),
          pf(1-_ua2, 1-_vr_h), pf(1-_ua2,   _vr_h),
          norm, 'zone-1', 0.20, 0.02
        );
        /* Zone 2 back hip strip: u=[_ua, 1-_ua2], v=[0 → _ve_h.._vr_h] */
        addQuadMesh(
          pf(_ua,     0),      pf(_ua,      _ve_h),
          pf(1-_ua2, _vr_h),  pf(1-_ua2,   0),
          norm, 'zone-2', 0.35, 0.07
        );
        /* Zone 2 front hip strip: u=[_ua, 1-_ua2], v=[1-_ve_h..1-_vr_h → 1] */
        addQuadMesh(
          pf(_ua,    1-_ve_h), pf(_ua,      1),
          pf(1-_ua2, 1),       pf(1-_ua2, 1-_vr_h),
          norm, 'zone-2', 0.35, 0.07
        );
        /* Zone 2 ridge block: u=[1-_ua2, 1], full v */
        addZone(1-_ua2, 1, 0, 1, THEME.zone2, 0.35, 'zone-2', 0.07,
          (u,v,_a,_b,_c,_d) => wrapFn(u,v), norm, false);
        /* Zone 3 eave strip: u=[0, _ua], full v */
        addZone(0, _ua, 0, 1, THEME.zone3, 0.65, 'zone-3', 0.12,
          (u,v,_a,_b,_c,_d) => wrapFn(u,v), norm, false);

        /* Flat on-surface zone labels */
        const _tD = xzSwap
          ? (norm.z < 0 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(-1,0,0))
          : (norm.x < 0 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,0,-1));
        const _uM = (_ua + 1 - _ua2) / 2;
        makeZoneLabelFlat('zone-1', pf(_uM,       0.5), norm, _tD);
        makeZoneLabelFlat('zone-2', pf(1-_ua2/2, 0.5), norm, _tD);
        makeZoneLabelFlat('zone-3', pf(_ua/2,    0.5), norm, _tD);
      };

      drawHipMainSlope(wrapL, _leftNorm);
      drawHipMainSlope(wrapR, _rightNorm);

      /* ── Triangular end slopes ── */
      const lerp3 = (p,q,t) => new THREE.Vector3(
        p.x+t*(q.x-p.x), p.y+t*(q.y-p.y), p.z+t*(q.z-p.z)
      );

      for (const zs of [-1, 1]) {
        const zA = zs*_hipHL, zC = zs*_r2;
        const A  = xzSwap ? new THREE.Vector3(zA,hEave,-_hipHB) : new THREE.Vector3(-_hipHB,hEave,zA);
        const Bv = xzSwap ? new THREE.Vector3(zA,hEave, _hipHB) : new THREE.Vector3( _hipHB,hEave,zA);
        const C  = xzSwap ? new THREE.Vector3(zC,hRidge,0)      : new THREE.Vector3(0,hRidge,zC);

        const _e1t = new THREE.Vector3().subVectors(Bv,A);
        const _e2t = new THREE.Vector3().subVectors(C, A);
        const tN   = new THREE.Vector3().crossVectors(_e1t,_e2t).normalize();
        if (tN.y < 0) tN.negate();

        const t_b      = Math.min(zone_a/_triH, 0.70);
        const D        = lerp3(A,  C, t_b);
        const E        = lerp3(Bv, C, t_b);
        const dOff     = zone_a*L_hip/_triH;
        const _bndN    = Math.min(-_hipHB+dOff, 0);
        const _bndP    = Math.max( _hipHB-dOff, 0);
        const P_L_base = xzSwap ? new THREE.Vector3(zA,hEave,_bndN) : new THREE.Vector3(_bndN,hEave,zA);
        const P_R_base = xzSwap ? new THREE.Vector3(zA,hEave,_bndP) : new THREE.Vector3(_bndP,hEave,zA);
        const s_top    = Math.max(0.01, 1-zone_a/L_hip);
        const P_L_top  = lerp3(Bv,C,s_top);
        const P_R_top  = lerp3(A, C,s_top);

        const _plBC  = xzSwap ? P_L_base.z : P_L_base.x;
        const _plTC  = xzSwap ? P_L_top.z  : P_L_top.x;
        const t_x0   = Math.min(Math.max((-_plBC)/(_plTC-_plBC+1e-6),0),1);
        const Mx     = lerp3(P_L_base,P_L_top,t_x0);
        const t_inn  = Math.min(t_b/Math.max(s_top,0.01),0.99);
        const M_L    = lerp3(P_L_base,P_L_top,t_inn);
        const M_R    = lerp3(P_R_base,P_R_top,t_inn);

        const hasZ1 = xzSwap ? M_L.z < M_R.z-0.1 : M_L.x < M_R.x-0.1;
        if (hasZ1)  addTriPart([M_L,M_R,Mx],    'zone-1', 0.20, 0.02, tN);
        addTriPart([D,M_L,Mx,C],                 'zone-2', 0.35, 0.07, tN);
        addTriPart([M_R,E,C,Mx],                 'zone-2', 0.35, 0.07, tN);
        addTriPart([A,Bv,E,D],                   'zone-3', 0.65, 0.12, tN);

        const _triTD = xzSwap
          ? new THREE.Vector3(0,0,zs>0?1:-1)
          : new THREE.Vector3(zs>0?1:-1,0,0);
        const _ctr1 = new THREE.Vector3(
          (M_L.x+M_R.x+Mx.x)/3,(M_L.y+M_R.y+Mx.y)/3,(M_L.z+M_R.z+Mx.z)/3);
        if (hasZ1) makeZoneLabelFlat('zone-1',_ctr1,tN,_triTD);
        const _ctr2 = xzSwap
          ? new THREE.Vector3(Mx.x+0.4*(C.x-Mx.x), Mx.y+0.4*(C.y-Mx.y), 0)
          : new THREE.Vector3(0, Mx.y+0.4*(C.y-Mx.y), Mx.z+0.4*(C.z-Mx.z));
        makeZoneLabelFlat('zone-2',_ctr2,tN,_triTD);
        const _ctr3 = new THREE.Vector3(
          (A.x+Bv.x+E.x+D.x)/4,(A.y+Bv.y+E.y+D.y)/4,(A.z+Bv.z+E.z+D.z)/4);
        makeZoneLabelFlat('zone-3',_ctr3,tN,_triTD);
      }
    },
  };
})();
