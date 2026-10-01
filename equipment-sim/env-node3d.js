// 앵커·보조 Wi-Fi 노드 3D 모델 (실제 부품 치수 기준)
// 지역 좌표 (mm): X = 벽을 따라 오른쪽(방에서 벽을 볼 때), Y = 위, Z = 벽에서 방 쪽으로. 벽면 = Z 0
// 판 위 ESP32·DWM3000EVB 배치와 점퍼선 끝점은 배선 조립(bench-data.js · bench-geom.js)의 앵커 기본 배치를 그대로 쓴다.
(function (S) {
  const E = S.ENV, P = E.PARTS, BB = S.BENCH, Q = BB && BB.bench;
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888888';
  const C = n => new THREE.Color(tok(n));
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o || {}));
  const UP = new THREE.Vector3(0, 1, 0);

  const PLATE_Z0 = 41;                                   // 스페이서 두께 → 판 뒷면
  const PLATE_Z1 = PLATE_Z0 + P.plate.t;                 // 판 앞면 46
  const BOARD_Z = PLATE_Z1 + P.standOnPins;              // 기판 아랫면 67
  S.NODE_GEOM = { PLATE_Z0, PLATE_Z1, BOARD_Z };

  function boxAt(g, w, h, d, x, y, z, m, name) {          // (x, y, z) = 상자 가운데
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); if (name) o.userData.part = name; g.add(o); return o;
  }
  function tube(g, pts, r, m) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
    const o = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 14), r, 8, false), m);
    g.add(o); return o;
  }
  function cylAlong(g, a, b, r, m) {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), L = d.length();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 12), m);
    o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(o); return o;
  }
  function canvasTex(wpx, hpx, draw) {
    const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx;
    const x = cv.getContext('2d'); draw(x, wpx, hpx);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  // 윗면에 글자·패턴이 있는 판 (top = +Z 면)
  function plateWithTop(g, w, h, d, x, y, z, color, draw, name) {
    const side = mat(color);
    const top = new THREE.MeshStandardMaterial({ map: canvasTex(Math.round(w * 6), Math.round(h * 6), draw), roughness: 0.7 });
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, top, side]);
    o.position.set(x, y, z); if (name) o.userData.part = name; g.add(o); return o;
  }

  // ---- 보조배터리 (샤오미 PLM13ZM 근사: 147.8 × 73.9 × 15.4 mm, 포트는 왼쪽 짧은 변) ----
  function bank(g, cx, cy, z0) {
    const L = P.bank.L, W = P.bank.W, T = P.bank.T;
    plateWithTop(g, L, W, T, cx, cy, z0 + T / 2, '#2a3036', (c, w, h) => {
      c.fillStyle = '#2f363d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9aa5ad'; c.font = (h * 0.11) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('10000mAh', w * 0.55, h * 0.56);
      for (let i = 0; i < 4; i++) { c.fillStyle = '#6fd3ff'; c.beginPath(); c.arc(w * 0.1, h * (0.3 + i * 0.13), h * 0.022, 0, 7); c.fill(); }
    }, '보조배터리');
    const port = mat('#c9ced2', { metalness: 0.6, roughness: 0.35 }), dark = mat('#111417');
    [[-12, 'USB-A'], [6, 'USB-A'], [22, 'USB-C']].forEach(([dy, k]) => {
      const pw = k === 'USB-A' ? 4.6 : 3.2, ph = k === 'USB-A' ? 12.2 : 8.6;
      boxAt(g, 1.2, ph, pw, cx - L / 2 - 0.4, cy + dy, z0 + T / 2, port);
      boxAt(g, 1.4, ph - 2, pw - 1.6, cx - L / 2 - 0.5, cy + dy, z0 + T / 2, dark);
    });
    return { portA: [cx - L / 2 - 1, cy - 12, z0 + T / 2] };
  }

  // ---- ESP32-S3-DevKitC-1 호환 (70 × 28 mm 근사, 모듈 = +u 끝, USB-C 2개 = −u 끝) ----
  function esp(g, pose, opts) {
    const D = BB.esp, z = BOARD_Z, t = P.esp.T;
    const grp = new THREE.Group(); grp.position.set(pose.x, pose.y, 0); grp.rotation.z = pose.rot * Math.PI / 180; g.add(grp);
    plateWithTop(grp, D.L, D.W, t, 0, 0, z + t / 2, '#15191c', (c, w, h) => {
      c.fillStyle = '#1b2024'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d9dee1'; c.font = (h * 0.09) + 'px monospace';
      c.fillText('ESP32-S3-DevKitC-1  N16R8', w * 0.06, h * 0.5);
      c.fillStyle = '#c7a35a';
      for (let i = 0; i < 22; i++) { [0.05, 0.95].forEach(fy => { c.beginPath(); c.arc(w * (0.5 + (26.67 - i * 2.54) / D.L), h * fy, h * 0.025, 0, 7); c.fill(); }); }
    }, 'ESP32-S3 보드');
    // WROOM-1 모듈: 금속 차폐 + PCB 안테나
    const W = P.wroom, u0 = D.L / 2 - W.L;
    boxAt(grp, W.can, W.W - 1, 2.4, u0 + W.can / 2, 0, z + t + 1.2, mat('#c3c8cc', { metalness: 0.75, roughness: 0.3 }), 'ESP32-S3-WROOM-1 (금속 차폐)');
    plateWithTop(grp, W.L - W.can, W.W, 0.9, u0 + W.can + (W.L - W.can) / 2, 0, z + t + 0.45, '#1d2a3a', (c, w, h) => {
      c.fillStyle = '#1f3146'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d6b25e'; c.lineWidth = Math.max(2, w * 0.03);
      c.beginPath(); let x = w * 0.2; c.moveTo(x, h * 0.9);
      for (let k = 0; k < 6; k++) { const y = k % 2 ? h * 0.9 : h * 0.12; c.lineTo(x, y); x += w * 0.11; c.lineTo(x, y); }
      c.stroke();
    }, 'ESP32 PCB 안테나 (가리지 않는다)');
    // USB-C 2개 (COM / USB), 버튼, LED, 레귤레이터
    const metal = mat('#cfd4d8', { metalness: 0.7, roughness: 0.3 });
    [[6, 'COM'], [-6, 'USB']].forEach(([v, n]) => boxAt(grp, 7.4, 8.9, 3.2, -D.L / 2 + 3.2, v, z + t + 1.6, metal, 'USB-C (' + n + ')'));
    [[9.5, 'BOOT'], [-9.5, 'RST']].forEach(([v, n]) => {
      boxAt(grp, 3.5, 4.5, 1.2, -D.L / 2 + 13, v, z + t + 0.6, mat('#e8e8e2'), '버튼 ' + n);
      boxAt(grp, 1.6, 1.6, 0.8, -D.L / 2 + 13, v, z + t + 1.6, mat('#2a2a2a'));
    });
    boxAt(grp, 6.5, 3.5, 1.6, -D.L / 2 + 22, 0, z + t + 0.8, mat('#2a2d30'), '3.3 V 레귤레이터 (AMS1117)');
    boxAt(grp, 2, 2, 0.8, u0 - 3, -9, z + t + 0.4, mat('#f4f4f4', { emissive: new THREE.Color('#5a7cff'), emissiveIntensity: 0.4 }), 'RGB LED');
    headerRows(grp, Object.values(D.pins).map(p => [p.u, p.v]), z, opts);
    return grp;
  }

  // ---- DWM3000EVB (Arduino Uno R3 쉴드 외형 68.58 × 53.34 mm, 모듈·J1 위치는 근사) ----
  function dwm(g, pose, opts) {
    const D = BB.dwm, z = BOARD_Z, t = P.dwm.T;
    const grp = new THREE.Group(); grp.position.set(pose.x, pose.y, 0); grp.rotation.z = pose.rot * Math.PI / 180; g.add(grp);
    plateWithTop(grp, D.L, D.W, t, 0, 0, z + t / 2, '#1d2635', (c, w, h) => {
      c.fillStyle = '#22304a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d9dee1'; c.font = (h * 0.06) + 'px monospace'; c.fillText('DWM3000EVB', w * 0.08, h * 0.62);
      c.fillStyle = '#c7a35a';
      Object.values(D.pins).forEach(p => { c.beginPath(); c.arc(w * (0.5 + p.u / D.L), h * (0.5 - p.v / D.W), h * 0.018, 0, 7); c.fill(); });
    }, 'DWM3000EVB');
    // DWM3000 모듈 (금속 차폐 + 안테나 부분), 안테나 = +u 쪽
    const M = P.dwmModule, mu = 15, mv = -14;
    boxAt(grp, M.L - 6, M.W, M.T, mu - 3, mv, z + t + M.T / 2, mat('#c3c8cc', { metalness: 0.75, roughness: 0.3 }), 'DWM3000 모듈 (금속 차폐)');
    boxAt(grp, 6, M.W, 1.2, mu + M.L / 2 - 3, mv, z + t + 0.6, mat('#e9e4d6'), 'UWB 안테나');
    // J1 전원 선택 점퍼 (2–3 = 3V3_ARDUINO)
    for (let k = 0; k < 3; k++) boxAt(grp, 0.64, 0.64, 6, -6 + k * 2.54, -4, z + t + 3, mat('#d8b45c', { metalness: 0.7 }));
    boxAt(grp, 2.54 * 2 + 0.6, 2.6, 6, -6 + 2.54 * 1.5, -4, z + t + 3.5, mat('#1a1a1a'), 'J1 점퍼 (2–3, 3V3_ARDUINO)');
    [[-20, 8, '#ff5a4f'], [-16, 8, '#5ad16a'], [-12, 8, '#ffd24a'], [-8, 8, '#4fa3ff']].forEach(([u, v, col]) =>
      boxAt(grp, 1.6, 0.8, 0.6, u, v, z + t + 0.3, mat(col, { emissive: new THREE.Color(col), emissiveIntensity: 0.25 }), 'LED'));
    boxAt(grp, 6, 6, 3.4, 26, 18, z + t + 1.7, mat('#e8e8e2'), '리셋 버튼');
    // 쉴드 고정 지지대 (Uno 고정 구멍 4곳, M3 21 mm)
    [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]].forEach(([X, Y]) =>
      cylAlong(grp, [X - 34.29, Y - 26.67, PLATE_Z1], [X - 34.29, Y - 26.67, z], 2.2, mat('#e7e3d6')));
    headerRows(grp, Object.values(D.pins).map(p => [p.u, p.v]), z, opts);
    return { grp, antenna: [mu + M.L / 2 - 3, mv] };
  }

  // 아래로 나온 핀 헤더 (플라스틱 + 핀)
  function headerRows(grp, pins, z, opts) {
    const plastic = mat('#151515'), gold = mat('#d8b45c', { metalness: 0.7, roughness: 0.35 });
    pins.forEach(([u, v]) => {
      boxAt(grp, 2.54, 2.54, 2.5, u, v, z - 1.25, plastic);
      if (opts.detail) boxAt(grp, 0.64, 0.64, 6, u, v, z - 2.5 - 3, gold);
    });
  }

  // ---- 노드 하나 ----
  // kind: 'anchor' (ESP32 + DWM3000EVB + 배터리) · 'aux' (ESP32 + 배터리)
  S.buildNode = function (kind, opts) {
    opts = Object.assign({ detail: true, wires: true }, opts || {});
    const g = new THREE.Group(), parts = [];
    const foam = mat('#f1f1ec', { roughness: 0.95 }), plateM = mat('#fbfbf8', { roughness: 0.9 });
    // 스페이서·탈착식 테이프·판
    [110, -110].forEach(y => {
      boxAt(g, P.spacer.w, P.spacer.h, PLATE_Z0, 0, y, PLATE_Z0 / 2, foam, '스티로폼 스페이서 (벽 → 판 41 mm)');
      boxAt(g, P.spacer.w - 30, P.spacer.h - 12, 0.8, 0, y, 0.4, mat('#cfd6da'), '탈착식 양면테이프');
    });
    boxAt(g, P.plate.w, P.plate.h, P.plate.t, 0, 0, PLATE_Z0 + P.plate.t / 2, plateM, '폼보드 5 mm (A4 210 × 297)');
    // 배터리 + 벨크로
    const lay = E.NODE_LAYOUT, bk = lay.bank;
    [-30, 30].forEach(dx => boxAt(g, 50, 20, 2, bk.x + dx, bk.y, PLATE_Z1 + 1, mat('#3a3f44'), '벨크로 (배터리 탈착)'));
    const bp = bank(g, bk.x, bk.y, PLATE_Z1 + 2);

    let antenna, espPose, usbIn;
    const sh = lay.pairShift;
    if (kind === 'anchor') {
      const L0 = BB.DEFAULTS.anchor;
      espPose = { x: L0.esp.x + sh[0], y: L0.esp.y + sh[1], rot: L0.esp.rot };
      const dwmPose = { x: L0.dwm.x + sh[0], y: L0.dwm.y + sh[1], rot: L0.dwm.rot };
      esp(g, espPose, opts);
      const d = dwm(g, dwmPose, opts);
      const a = Q.xf(dwmPose, d.antenna[0], d.antenna[1]);
      antenna = [a[0], a[1], BOARD_Z + P.dwm.T + 1.45];
      if (opts.wires) wires(g, { esp: espPose, dwm: dwmPose });
    } else {
      espPose = { x: 0, y: 60, rot: 90 };                // 모듈(안테나)을 위로
      esp(g, espPose, opts);
      const a = Q.xf(espPose, BB.esp.L / 2 - (P.wroom.L - P.wroom.can) / 2, 0);
      antenna = [a[0], a[1], BOARD_Z + P.esp.T + 0.45];
    }
    usbIn = Q.xf(espPose, -BB.esp.L / 2 - 4, 6);
    // USB A→C 케이블: 배터리 USB-A → 판 왼쪽 가장자리 → ESP32 USB-C(COM)
    const cableM = mat('#24282c', { roughness: 0.6 }), plug = mat('#30353a');
    const zc = PLATE_Z1 + 8, a0 = bp.portA, fx = -98;
    const ux = usbIn[0], uy = usbIn[1], uz = BOARD_Z + P.esp.T + 1.6;
    const path = kind === 'anchor'
      ? [[a0[0] - 14, a0[1], a0[2]], [fx, a0[1] + 10, zc], [fx, uy - 30, zc], [fx + 20, uy, uz + 4], [ux - 10, uy, uz]]
      : [[a0[0] - 14, a0[1], a0[2]], [fx, a0[1] + 10, zc], [fx, -10, zc], [ux - 6, uy - 24, uz + 6], [ux, uy - 10, uz]];
    boxAt(g, 16, 13, 7, a0[0] - 8, a0[1], a0[2], plug, 'USB-A 플러그');
    tube(g, path, 1.9, cableM).userData.part = 'USB A→C 케이블 (약 25 cm)';
    if (kind === 'anchor') boxAt(g, 14, 8, 6.5, ux - 4, uy, uz, plug, 'USB-C 플러그 (COM 포트)');
    else boxAt(g, 8, 14, 6.5, ux, uy - 4, uz, plug, 'USB-C 플러그 (COM 포트)');
    // 안테나 중심 표시
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.9, 10, 40), mat(C('--accent'), { emissive: C('--accent'), emissiveIntensity: 0.5 }));
    ring.position.set(antenna[0], antenna[1], antenna[2] + 2.2); ring.userData.part = '안테나 중심 (좌표 기준점)'; g.add(ring);
    g.userData = { kind, antenna, plateCenter: [0, 0, PLATE_Z1] };
    return g;
  };

  // 점퍼선 9가닥 (배선 조립과 같은 계산으로 끝점·길이를 구한다)
  function wires(g, lay) {
    const ev = Q.evaluate(BB.setups.anchor, lay, 100);
    const housing = mat('#141414');
    ev.wires.forEach(w => {
      const col = mat(C(BB.groups[w.grp].color), { roughness: 0.55 });
      const pa = w.A.exit, pb = w.B.exit;
      [w.A, w.B].forEach(E2 => boxAt(g, 2.5, 2.5, 14, E2.xy[0], E2.xy[1], PLATE_Z1 + E2.exit[2] + 7, housing));
      const za = PLATE_Z1 + pa[2], zb = PLATE_Z1 + pb[2], low = PLATE_Z1 + 2.5;
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
      const t = tube(g, [[pa[0], pa[1], za], [pa[0], pa[1], za - 2], [mx, my, low], [pb[0], pb[1], zb - 2], [pb[0], pb[1], zb]], 0.65, col);
      t.userData.part = '점퍼 ' + w.sig + ' (필요 ' + (w.need / 10).toFixed(1) + ' cm / 10 cm)';
    });
    return ev;
  }

  // 노드를 방에 놓는 변환: 안테나 중심이 point(시뮬레이션 좌표)에 오고, 지역 Z가 벽 안쪽 법선을 향한다
  S.placeNode = function (node, pt, nx, ny, V) {
    const s = 0.001, a = node.userData.antenna;
    const ex = V(-ny, nx, 0).normalize(), ey = new THREE.Vector3(0, 1, 0), ez = V(nx, ny, 0).normalize();
    const m = new THREE.Matrix4().makeBasis(ex, ey, ez);
    node.matrixAutoUpdate = false;
    const p = V(pt.x, pt.y, pt.z).sub(new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(m).multiplyScalar(s));
    node.matrix.copy(m).scale(new THREE.Vector3(s, s, s)).setPosition(p);
    return node;
  };
})(window.SIM);
