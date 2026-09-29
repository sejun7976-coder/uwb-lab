// 배선 조립 3D 뷰. 책상 좌표 (x 오른쪽, y 안쪽, z 위, mm) → three.js (x, z, -y)
(function (S) {
  const B = S.BENCH, Q = B.bench, Z = Q.Z;
  const DEG = Math.PI / 180;
  const V = (x, y, z) => new THREE.Vector3(x, z, -y);
  const LV = (u, v, h) => new THREE.Vector3(u, h, -v);          // 부품 그룹 안 좌표
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888888';
  const C = n => new THREE.Color(tok(n));
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.05 }, o || {}));
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const X1 = new THREE.Vector3(1, 0, 0);

  function disposeTree(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    while (g.children.length) g.remove(g.children[0]);
  }

  // ---------------- 기판 윗면 그림 (canvas) ----------------
  const PX = 12;   // mm당 픽셀
  function canvasFor(L, W) {
    const c = document.createElement('canvas');
    c.width = Math.round(L * PX); c.height = Math.round(W * PX);
    const g = c.getContext('2d');
    g.scale(PX, PX); g.translate(L / 2, W / 2);     // 원점 = 부품 가운데, 캔버스 y = -v
    return { c, g };
  }
  const font = (g, px, w) => { g.font = (w || 500) + ' ' + px + 'px "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif'; };
  function pad(g, u, v, ring) {
    g.fillStyle = '#C9A74A'; g.beginPath(); g.arc(u, -v, 0.85, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3A3020'; g.beginPath(); g.arc(u, -v, 0.42, 0, Math.PI * 2); g.fill();
    if (ring) { g.strokeStyle = ring; g.lineWidth = 0.3; g.beginPath(); g.arc(u, -v, 1.25, 0, Math.PI * 2); g.stroke(); }
  }
  function xmark(g, u, v, col) {
    g.strokeStyle = col; g.lineWidth = 0.35; g.beginPath();
    g.moveTo(u - 1, -v - 1); g.lineTo(u + 1, -v + 1); g.moveTo(u + 1, -v - 1); g.lineTo(u - 1, -v + 1); g.stroke();
  }
  function text(g, s, u, v, px, col, align, rot) {
    g.save(); g.translate(u, -v); if (rot) g.rotate(rot);
    font(g, px); g.fillStyle = col; g.textAlign = align || 'center'; g.textBaseline = 'middle';
    g.fillText(s, 0, 0); g.restore();
  }

  function espCanvas(used) {
    const d = B.esp, { c, g } = canvasFor(d.L, d.W);
    g.fillStyle = '#16191A'; g.fillRect(-d.L / 2, -d.W / 2, d.L, d.W);
    // 모듈 (안테나 쪽 +u)
    g.fillStyle = '#B9C0C4'; g.fillRect(9.5, -9, 19.5, 18);
    g.fillStyle = '#2B6F4E'; g.fillRect(29, -9, 6, 18);
    text(g, 'ESP32-S3-WROOM-1', 19.2, 2.2, 1.9, '#3B4247');
    text(g, 'N16R8', 19.2, -1.2, 1.9, '#3B4247');
    text(g, '안테나', 32, 0, 1.4, '#CFE7DA', 'center', -Math.PI / 2);
    // USB-C 두 개 (-u 쪽)
    [[-6.5, 'COM'], [6.5, 'USB']].forEach(([v, n]) => {
      g.fillStyle = '#9AA3A8'; g.fillRect(-35, -v - 4.5, 7, 9);
      text(g, n, -25.5, v, 1.5, '#E6E6E6');
    });
    text(g, 'BOOT', -20, -5.5, 1.3, '#9AA0A3'); text(g, 'RST', -20, 5.5, 1.3, '#9AA0A3');
    Object.keys(d.pins).forEach(k => {
      const p = d.pins[k], bad = d.noUse.includes(k), on = used.has(k);
      pad(g, p.u, p.v, on ? '#F2C14E' : null);
      const lv = p.v > 0 ? p.v - 2.3 : p.v + 2.3;
      text(g, p.name, p.u, lv, 1.35, bad ? '#E07A5F' : on ? '#FFE08A' : '#E8ECEE', 'center', -Math.PI / 2);
      if (bad) xmark(g, p.u, p.v, '#E07A5F');
    });
    text(g, 'J1', 31, 12.7, 1.5, '#E8ECEE'); text(g, 'J3', 31, -12.7, 1.5, '#E8ECEE');
    return c;
  }
  function dwmCanvas(used) {
    const d = B.dwm, { c, g } = canvasFor(d.L, d.W);
    g.fillStyle = '#10151F'; g.fillRect(-d.L / 2, -d.W / 2, d.L, d.W);
    g.fillStyle = '#B9C0C4'; g.fillRect(10.5, -6.5, 23, 13);
    text(g, 'DWM3000', 22, 1.6, 2.2, '#343A40'); text(g, 'UWB 모듈 + 안테나', 22, -2.2, 1.5, '#343A40');
    g.fillStyle = '#20252E'; g.fillRect(3.5, -15.5, 7.5, 3);
    [4.8, 7.3, 9.8].forEach(u => pad(g, u, -14, null));
    g.fillStyle = '#111'; g.fillRect(6, -15.3, 5, 2.6);
    text(g, 'J1: 2–3 (3V3_ARDUINO)', 7.2, -18, 1.4, '#FFD166');
    text(g, 'DWM3000EVB', -18, 0, 2.6, '#E8ECEE');
    text(g, 'Arduino 쉴드 배치', -18, -3.8, 1.5, '#9AA0A3');
    Object.keys(d.pins).forEach(k => {
      const p = d.pins[k], bad = d.noUse.includes(k), on = used.has(k);
      pad(g, p.u, p.v, on ? '#F2C14E' : null);
      const lv = p.v > 0 ? p.v - 2.6 : p.v + 2.6;
      text(g, p.name, p.u, lv, 1.3, bad ? '#E07A5F' : on ? '#FFE08A' : '#E8ECEE', 'center', -Math.PI / 2);
      if (bad) xmark(g, p.u, p.v, '#E07A5F');
    });
    text(g, 'D0–D6 연결 금지', 32.5, 18.2, 1.4, '#E07A5F', 'right');
    return c;
  }
  function breakoutCanvas(def, m) {
    const d = B[def], { c, g } = canvasFor(d.Lb, d.Wb);
    const ox = -d.Lb / 2, oy = -d.Wb / 2;          // EAGLE 좌표 → 가운데 원점
    g.fillStyle = '#1C1F3A'; g.fillRect(-d.Lb / 2, -d.Wb / 2, d.Lb, d.Wb);
    d.pins.forEach((n, i) => {
      const u = ox + d.header.x0 + i * 2.54, v = oy + d.header.y;
      pad(g, u, v, null);
      text(g, n, u, v + 2.1, 1.25, n === 'VBUS' || n === 'VIN+' ? '#FFD166' : '#E8ECEE');
    });
    if (def === 'ina') {
      g.fillStyle = '#2F8F57'; g.fillRect(ox + 6.9, -(oy + 16.38) - 3.2, 11.6, 6.4);
      [['VIN−', 9.2], ['VBUS', 12.7], ['VIN+', 16.2]].forEach(([n, x]) => text(g, n, ox + x, oy + 12.2, 1.1, '#E8ECEE'));
      text(g, 'INA228', 0, 1.2, 2.0, '#E8ECEE');
      text(g, m.addr, 0, -1.6, 1.4, '#9AA0A3');
    } else {
      g.fillStyle = '#C8C3B5'; g.fillRect(ox + 0.2, -(oy + 8.89) - 2.2, 3, 4.4); g.fillRect(ox + d.Lb - 3.2, -(oy + 8.89) - 2.2, 3, 4.4);
      g.fillStyle = '#0D0D0D'; g.fillRect(-1.6, -(oy + 11) - 1.4, 3, 3);
      text(g, 'ISM330DHCX', 0, -1.5, 1.8, '#E8ECEE');
    }
    return c;
  }
  function bbCanvas(asgHoles) {
    const d = B.bb, { c, g } = canvasFor(d.L, d.W);
    g.fillStyle = '#F2F0E8'; g.fillRect(-d.L / 2, -d.W / 2, d.L, d.W);
    g.fillStyle = '#E3E0D5'; g.fillRect(-d.L / 2, -1.6, d.L, 3.2);          // 가운데 홈
    const hole = (u, v, on) => { g.fillStyle = on ? '#C58B00' : '#4A4A48'; g.fillRect(u - 0.5, -v - 0.5, 1, 1); };
    for (let col = 1; col <= 30; col++) Object.keys(d.rowV).forEach(r => hole(d.colU(col), d.rowV[r], asgHoles.has(col + r)));
    Object.keys(d.rails).forEach(k => { for (let t = 0; t < 25; t++) hole(d.railU(t), d.rails[k], asgHoles.has(k + t)); });
    // 레일 선: 3V3 빨강, GND 파랑
    [['3V3', '#D7263D'], ['GND', '#1F5FAF']].forEach(([k, col]) => {
      g.strokeStyle = col; g.lineWidth = 0.35;
      const v = d.rails[k] + (k === 'GND' ? 1.4 : -1.4);
      g.beginPath(); g.moveTo(-37, -v); g.lineTo(37, -v); g.stroke();
      text(g, k, -39.2, d.rails[k], 1.4, col);
    });
    [['farP', '#D7263D'], ['farN', '#1F5FAF']].forEach(([k, col]) => {
      g.strokeStyle = col; g.lineWidth = 0.35; const v = d.rails[k] + (k === 'farN' ? -1.4 : 1.4);
      g.beginPath(); g.moveTo(-37, -v); g.lineTo(37, -v); g.stroke();
    });
    for (let col = 1; col <= 30; col += (col === 1 ? 4 : 5)) text(g, String(col), d.colU(col), 16.5, 1.2, '#7A776C');
    Object.keys(d.rowV).forEach(r => text(g, r, -39.3, d.rowV[r], 1.2, '#7A776C'));
    return c;
  }
  function texMesh(canvas, L, W, h) {
    const t = new THREE.CanvasTexture(canvas); t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, transparent: true }));
    m.rotation.x = -Math.PI / 2; m.position.copy(LV(0, 0, h)); return m;
  }

  // 아래로 향한 핀 헤더 (플라스틱 + 금색 핀)
  function header(g, pins, bottom) {
    const pm = mat(new THREE.Color('#111315')), gm = mat(new THREE.Color('#C9A74A'), { metalness: 0.7, roughness: 0.35 });
    pins.forEach(p => {
      const pl = box(2.5, Z.plastic, 2.5, pm); pl.position.copy(LV(p.u, p.v, bottom - Z.plastic / 2)); g.add(pl);
      const pn = box(0.64, Z.pinLen, 0.64, gm); pn.position.copy(LV(p.u, p.v, bottom - Z.plastic - Z.pinLen / 2)); g.add(pn);
    });
  }

  S.createBench = function (host, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    const layer = document.createElement('div'); layer.className = 'labels'; host.appendChild(layer);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 2, 6000);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minDistance = 60; controls.maxDistance = 1400;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556660, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(120, 400, 200); scene.add(sun);
    const plateG = new THREE.Group(), partG = new THREE.Group(), wireG = new THREE.Group();
    scene.add(plateG); scene.add(partG); scene.add(wireG);

    const view = { host };
    let setup = null, layout = null, res = null, parts = {}, labels = [], wireMeshes = {}, xray = false;
    let colorMode = 'group', filterGrp = null, hi = null, hover = null, below = false;

    // ---- 이름표 ----
    function label(text, pos, cls) {
      const el = document.createElement('div'); el.className = 'lbl ' + (cls || ''); el.textContent = text; layer.appendChild(el);
      const L = { el, pos, mid: /plain|pt/.test(cls || '') }; labels.push(L); return L;
    }
    function clearLabels() { labels.forEach(L => L.el.remove()); labels = []; }
    const pv = new THREE.Vector3();
    function updateLabels() {
      const w = host.clientWidth, h = host.clientHeight;
      labels.forEach(L => {
        if (L.hidden) { L.el.style.display = 'none'; return; }
        pv.copy(typeof L.pos === 'function' ? L.pos() : L.pos).project(camera);
        if (pv.z > 1 || pv.z < -1) { L.el.style.display = 'none'; return; }
        L.el.style.display = '';
        L.el.style.transform = 'translate(' + ((pv.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-pv.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,' + (L.mid ? '-50%' : '-130%') + ')';
      });
    }

    // ---- 책상 ----
    function buildPlate() {
      disposeTree(plateG);
      scene.background = C('--scene');
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(520, 360), mat(C('--floor'), { roughness: 1 }));
      pl.rotation.x = -Math.PI / 2; pl.position.y = -0.2; plateG.add(pl);
      const gp = [];
      for (let x = -260; x <= 260; x += 20) gp.push(V(x, -180, 0), V(x, 180, 0));
      for (let y = -180; y <= 180; y += 20) gp.push(V(-260, y, 0), V(260, y, 0));
      const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), new THREE.LineBasicMaterial({ color: C('--grid'), transparent: true, opacity: 0.6 }));
      grid.visible = !below; plateG.add(grid); plateG.userData.grid = grid;
    }

    // ---- 부품 ----
    function usedPins(kind) {
      const s = new Set();
      if (!res) return s;
      res.wires.forEach(w => [w.A, w.B].forEach(E => { if (E.part === kind) s.add(E.pin); }));
      return s;
    }
    function makePart(kind) {
      const g = new THREE.Group(); g.userData.kind = kind;
      let hit;
      if (kind === 'esp' || kind === 'dwm') {
        const d = B[kind], H = Z.boardBottom;
        const pcb = box(d.L, 1.6, d.W, mat(new THREE.Color(kind === 'esp' ? '#16191A' : '#10151F'), { transparent: true }));
        pcb.position.copy(LV(0, 0, H + 0.8)); g.add(pcb); hit = pcb;
        const top = texMesh(kind === 'esp' ? espCanvas(usedPins('esp')) : dwmCanvas(usedPins('dwm')), d.L, d.W, H + 1.62); g.add(top);
        header(g, Object.keys(d.pins).map(k => d.pins[k]), H);
        if (kind === 'esp') {
          const mod = box(19.5, 3.1, 18, mat(new THREE.Color('#B9C0C4'), { metalness: 0.6, roughness: 0.35, transparent: true }));
          mod.position.copy(LV(19.25, 0, H + 1.6 + 1.55)); g.add(mod);
          [-6.5, 6.5].forEach(v => { const u = box(7.5, 3.2, 9, mat(new THREE.Color('#9AA3A8'), { metalness: 0.7, transparent: true })); u.position.copy(LV(-31.5, v, H + 1.6 + 1.6)); g.add(u); });
        } else {
          const mod = box(23, 2.4, 13, mat(new THREE.Color('#B9C0C4'), { metalness: 0.6, roughness: 0.35, transparent: true }));
          mod.position.copy(LV(22, 0, H + 1.6 + 1.2)); g.add(mod);
        }
        g.userData.fade = [pcb, top].concat(g.children.filter(o => o.material && o.material.transparent && o !== pcb && o !== top));
      } else if (kind === 'bb') {
        const d = B.bb;
        const body = box(d.L, d.T, d.W, mat(new THREE.Color('#F2F0E8'), { roughness: 0.9 }));
        body.position.copy(LV(0, 0, d.T / 2)); g.add(body); hit = body;
        const holes = new Set();
        if (res) res.asg.forEach(h => holes.add(h.rail ? h.rail + h.t : h.col + h.row));
        g.add(texMesh(bbCanvas(holes), d.L, d.W, d.T + 0.02));
        d.mounts.forEach(m => {
          const def = B[m.def], c = Q.mountCenter(m), bg = new THREE.Group();
          bg.position.copy(LV(c.u, c.v, 0)); bg.rotation.y = Math.PI;       // 브레드보드와 180° 반대
          const pcb = box(def.Lb, 1.6, def.Wb, mat(new THREE.Color('#1C1F3A'))); pcb.position.copy(LV(0, 0, d.breakoutH + 0.8)); bg.add(pcb);
          bg.add(texMesh(breakoutCanvas(m.def, m), def.Lb, def.Wb, d.breakoutH + 1.62));
          const pm = mat(new THREE.Color('#111315'));
          const hl = box(def.pins.length * 2.54, d.breakoutH - d.T, 2.5, pm);
          hl.position.copy(LV(-def.Lb / 2 + def.header.x0 + (def.pins.length - 1) * 1.27, -def.Wb / 2 + def.header.y, (d.T + d.breakoutH) / 2)); bg.add(hl);
          if (m.def === 'ina') { const tb = box(11.6, 8, 6.4, mat(new THREE.Color('#2F8F57'))); tb.position.copy(LV(-def.Lb / 2 + 12.7, -def.Wb / 2 + 16.38, d.breakoutH + 1.6 + 4)); bg.add(tb); }
          g.add(bg);
        });
      } else if (kind === 'usb') {
        const d = B.usb, sm = mat(new THREE.Color('#141414'));
        const cols = { '5V': '#D7263D', GND: '#202020', 'D-': '#EDEDED', 'D+': '#2E9E4F' };
        Object.keys(d.sockets).forEach(k => {
          const s = box(d.sockLen, 2.5, 2.5, sm); s.position.copy(LV(0, d.sockets[k], d.sockH)); g.add(s);
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 8, 8), mat(new THREE.Color(cols[k])));
          w.rotation.z = Math.PI / 2; w.position.copy(LV(-d.sockLen / 2 - 4, d.sockets[k], d.sockH)); g.add(w);
        });
        hit = box(d.L + 8, 7, d.W, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hit.position.copy(LV(-4, 0, d.sockH)); g.add(hit);
      } else if (kind === 'bank') {
        const d = B.bank;
        const b = box(d.L, d.T, d.W, mat(C('--metal'), { roughness: 0.5 })); b.position.copy(LV(0, 0, d.T / 2)); g.add(b); hit = b;
        const port = box(3, 5.5, 13, mat(new THREE.Color('#1B1B1B'))); port.position.copy(LV(d.port.u, d.port.v, d.T / 2)); g.add(port);
        const top = box(40, 0.4, 14, mat(new THREE.Color('#2E3436'))); top.position.copy(LV(-10, 0, d.T + 0.2)); g.add(top);
      }
      hit.userData.part = kind;
      g.userData.hit = hit;
      return g;
    }
    function placePart(kind) {
      const g = parts[kind], p = layout[kind];
      g.position.copy(V(p.x, p.y, 0)); g.rotation.y = p.rot * DEG;
    }
    const partTitle = { esp: 'ESP32-S3', dwm: 'DWM3000EVB', bb: '브레드보드', usb: 'USB 소켓', bank: '보조배터리' };
    function buildParts() {
      disposeTree(partG); clearLabels(); parts = {};
      setup.parts.forEach(k => { parts[k] = makePart(k); partG.add(parts[k]); placePart(k); });
      setup.parts.forEach(k => {
        const h = k === 'esp' || k === 'dwm' ? Z.boardBottom + 8 : k === 'bb' ? 26 : 18;
        label(partTitle[k], () => { const p = layout[k]; return V(p.x, p.y, h); }, k === 'esp' || k === 'dwm' ? 'anchor' : '');
      });
      setXray(xray);
    }

    // ---- 선 ----
    const statusCol = { ok: '--ok', tight: '--edge', over: '--block' };
    function wireColor(w) { return C(colorMode === 'status' ? statusCol[w.status] : B.groups[w.grp].color); }
    function vec(a) { return V(a[0], a[1], a[2]); }
    function curveFor(w) {
      const A = w.A, Bn = w.B, s = w.straight, k = Math.max(4, Math.min(12, s * 0.25));
      const pa = [A.exit[0] + A.axis[0] * k, A.exit[1] + A.axis[1] * k, A.exit[2] + A.axis[2] * k];
      const pb = [Bn.exit[0] + Bn.axis[0] * k, Bn.exit[1] + Bn.axis[1] * k, Bn.exit[2] + Bn.axis[2] * k];
      const slack = Math.max(0, w.avail - (w.need - 2 * B.HOUSING));
      const sag = Math.min(28, 0.5 * Math.sqrt(slack * Math.max(s, 1)));
      const up = A.axis[2] > 0.5 && Bn.axis[2] > 0.5;
      const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2 + (up ? sag : -sag)];
      mid[2] = Math.max(1.5, mid[2]);
      pa[2] = Math.max(1.2, pa[2]); pb[2] = Math.max(1.2, pb[2]);
      return new THREE.CatmullRomCurve3([vec(A.exit), vec(pa), vec(mid), vec(pb), vec(Bn.exit)], false, 'centripetal');
    }
    function housing(E, m) {
      if (E.end === 'F') {           // 아래로 향한 핀에 꽂은 암 커넥터
        const h = box(2.5, B.HOUSING, 2.5, m); h.position.copy(V(E.xy[0], E.xy[1], (E.housingTop + E.exit[2]) / 2)); return h;
      }
      if (E.mouth) {                 // USB 소켓에 꽂은 수 커넥터 (눕힘)
        const h = box(B.HOUSING, 2.5, 2.5, m), a = vec(E.mouth), b = vec(E.exit);
        h.position.copy(a).add(b).multiplyScalar(0.5);
        h.quaternion.setFromUnitVectors(X1, b.clone().sub(a).normalize()); return h;
      }
      const h = box(2.5, B.HOUSING, 2.5, m); h.position.copy(V(E.xy[0], E.xy[1], Z.bbTop + B.HOUSING / 2)); return h;   // 브레드보드 위 수 커넥터
    }
    let hiLabel = null;
    function buildWires() {
      disposeTree(wireG); wireMeshes = {};
      const hm = mat(new THREE.Color('#1A1A1A'));
      res.wires.forEach(w => {
        const g = new THREE.Group();
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curveFor(w), 40, 0.8, 7, false), mat(wireColor(w), { roughness: 0.5, transparent: true }));
        tube.userData.wire = w.id; g.add(tube);
        g.add(housing(w.A, hm)); g.add(housing(w.B, hm));
        // 굵은 투명 튜브: 마우스로 고르기 쉽게
        const pick = new THREE.Mesh(new THREE.TubeGeometry(tube.geometry.parameters.path, 20, 2.4, 5, false), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        pick.userData.wire = w.id; g.add(pick);
        wireG.add(g); wireMeshes[w.id] = { g, tube, pick, w };
      });
      // USB 케이블 (보조배터리 → 소켓 묶음)
      const cb = Q.usbCable(layout);
      if (cb) {
        const a = V(cb.port[0], cb.port[1], B.bank.T / 2), b = V(cb.inlet[0] - 0, cb.inlet[1], B.usb.sockH);
        const ax = Q.xf({ x: 0, y: 0, rot: layout.usb.rot }, -1, 0), bx = Q.xf({ x: 0, y: 0, rot: layout.bank.rot }, 1, 0);
        const m1 = a.clone().add(V(bx[0] * 20, bx[1] * 20, 0)), m3 = b.clone().add(V(ax[0] * 20, ax[1] * 20, 0));
        const mid = m1.clone().add(m3).multiplyScalar(0.5); mid.y = 2;
        const curve = new THREE.CatmullRomCurve3([a, m1, mid, m3, b], false, 'centripetal');
        const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 1.8, 8, false), mat(cb.ok ? new THREE.Color('#2B2B2B') : C('--block')));
        wireG.add(t);
      }
      applyStyle();
    }
    function applyStyle() {
      Object.keys(wireMeshes).forEach(id => {
        const o = wireMeshes[id], w = o.w, on = (!filterGrp || w.grp === filterGrp || (filterGrp === 'over' && w.status !== 'ok')) && (!hi || hi === id);
        o.tube.material.color.copy(wireColor(w));
        o.tube.material.opacity = on ? 1 : 0.12;
        o.tube.material.depthTest = !xray;           // 반투명 모드: 보드에 가린 선도 위에 겹쳐 그림
        o.tube.renderOrder = xray ? 10 : 0;
        o.g.children.forEach(c => { if (c !== o.tube && c !== o.pick && c.material) { c.material.transparent = true; c.material.opacity = on ? 1 : 0.25; } });
        o.tube.scale.setScalar(1);
      });
      if (hiLabel) { hiLabel.el.remove(); labels = labels.filter(L => L !== hiLabel); hiLabel = null; }
      const id = hi || hover;
      if (id && wireMeshes[id]) {
        const w = wireMeshes[id].w, p = wireMeshes[id].tube.geometry.parameters.path.getPoint(0.5);
        hiLabel = label(w.sig + ' · ' + (w.need / 10).toFixed(1) + ' cm', p.clone().add(new THREE.Vector3(0, 6, 0)), w.status === 'over' ? 'over' : 'tag');
      }
    }
    function setXray(on) {
      xray = on;
      ['esp', 'dwm'].forEach(k => {
        if (!parts[k]) return;
        (parts[k].userData.fade || []).forEach(m => { m.material.transparent = true; m.material.opacity = on ? 0.42 : 1; m.material.depthWrite = !on; });
      });
      if (wireMeshes) applyStyle();
    }

    // ---- 공개 함수 ----
    view.set = function (s, lay, r, keepCam) {
      const changed = s !== setup;
      setup = s; layout = lay; res = r;
      buildPlate(); buildParts(); buildWires();
      if (changed && !keepCam) view.frame('angle');
    };
    view.update = function (lay, r, rebuildParts) {
      layout = lay; res = r;
      if (rebuildParts) buildParts(); else setup.parts.forEach(placePart);
      buildWires();
    };
    view.style = function (o) {
      if ('colorMode' in o) colorMode = o.colorMode;
      if ('filter' in o) filterGrp = o.filter;
      if ('hi' in o) hi = o.hi;
      if ('xray' in o) setXray(o.xray);
      applyStyle();
    };
    view.frame = function (mode) {
      const pts = [].concat.apply([], setup.parts.map(k => Q.corners(k, layout[k])));
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      const zoom = parseFloat(document.documentElement.dataset.zoom) || 1;       // 주소의 &zoom=
      // 확대하면 가운데를 배선이 모인 곳에 맞춰 선이 잘리지 않게 한다
      let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (zoom > 1 && res && res.wires.length) {
        const wx = [], wy = [];
        res.wires.forEach(w => { wx.push(w.A.xy[0], w.B.xy[0]); wy.push(w.A.xy[1], w.B.xy[1]); });
        cx = (Math.min.apply(null, wx) + Math.max.apply(null, wx)) / 2; cy = (Math.min.apply(null, wy) + Math.max.apply(null, wy)) / 2;
      }
      const t = V(cx, cy, 8); controls.target.copy(t);
      const tanH = Math.tan(camera.fov * DEG / 2);
      const fit = (Math.max((x1 - x0) / (2 * tanH * camera.aspect), (y1 - y0) / (2 * tanH)) * 1.06 + 14) / zoom;
      if (mode === 'top') camera.position.set(t.x, t.y + fit, t.z + 0.01);
      else if (mode === 'below') camera.position.set(t.x + fit * 0.08, t.y - fit * 0.92, t.z + fit * 0.3);
      else camera.position.set(t.x + fit * 0.12, t.y + fit * 0.88, t.z + fit * 0.5);
      controls.maxPolarAngle = mode === 'below' ? Math.PI : Math.PI * 0.49;
      below = mode === 'below';
      if (plateG.userData.grid) plateG.userData.grid.visible = !below;
      controls.update();
    };
    view.retheme = function () { if (setup) { buildPlate(); buildParts(); buildWires(); } };

    // ---- 끌기 · 회전 · 고르기 ----
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
    let drag = null, down = null, lastPart = null, lastClick = 0;
    function setNdc(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); }
    function partAt() {
      const hits = ray.intersectObjects(setup.parts.map(k => parts[k].userData.hit), false);
      return hits.length ? hits[0].object.userData.part : null;
    }
    function wireAt() {
      const hits = ray.intersectObjects(Object.keys(wireMeshes).map(k => wireMeshes[k].pick), false);
      return hits.length ? hits[0].object.userData.wire : null;
    }
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', e => {
      if (!setup) return;
      setNdc(e); down = [e.clientX, e.clientY];
      const k = partAt();
      if (k && e.button === 0) {
        ray.ray.intersectPlane(plane, hitP);
        drag = { k, dx: layout[k].x - hitP.x, dy: layout[k].y + hitP.z, id: e.pointerId, moved: false };
        controls.enabled = false; dom.setPointerCapture(e.pointerId);
        lastPart = k;
      }
    });
    dom.addEventListener('pointermove', e => {
      if (!setup) return;
      setNdc(e);
      if (drag) {
        if (!ray.ray.intersectPlane(plane, hitP)) return;
        const nx = Math.max(-250, Math.min(250, hitP.x + drag.dx)), ny = Math.max(-170, Math.min(170, -hitP.z + drag.dy));
        if (Math.abs(nx - layout[drag.k].x) + Math.abs(ny - layout[drag.k].y) < 0.5) return;
        layout[drag.k].x = Math.round(nx); layout[drag.k].y = Math.round(ny); drag.moved = true;
        if (opts.onLayout) opts.onLayout(layout, false);
        return;
      }
      const w = wireAt(), k = w ? null : partAt();
      dom.style.cursor = k ? 'grab' : w ? 'pointer' : '';
      if (w !== hover) { hover = w; applyStyle(); if (opts.onHover) opts.onHover(w); }
    });
    function endDrag(e) {
      if (!drag) return;
      controls.enabled = true;
      try { dom.releasePointerCapture(drag.id); } catch (err) { /* 이미 풀림 */ }
      const d = drag; drag = null;
      if (d.moved && opts.onLayout) opts.onLayout(layout, true);
    }
    dom.addEventListener('pointerup', e => {
      const wasDrag = drag && drag.moved;
      endDrag(e);
      if (!down || wasDrag) { down = null; return; }
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null;
      if (moved > 5) return;
      setNdc(e);
      const now = performance.now(), k = partAt();
      if (k && now - lastClick < 350 && lastPart === k) { view.rotate(k); lastClick = 0; return; }
      lastClick = now;
      const w = wireAt();
      if (opts.onPick) opts.onPick(w);
    });
    dom.addEventListener('pointercancel', endDrag);
    view.rotate = function (k) {
      k = k || lastPart; if (!k || !layout[k]) return;
      layout[k].rot = ((layout[k].rot + 90 + 180) % 360) - 180;
      if (opts.onLayout) opts.onLayout(layout, true);
    };
    view.lastPart = () => lastPart;
    // 책상 좌표 → 화면 픽셀 (테스트·디버그용)
    view.screenOf = (x, y, z) => { const p = V(x, y, z).project(camera), r = dom.getBoundingClientRect(); return [r.left + (p.x * 0.5 + 0.5) * r.width, r.top + (-p.y * 0.5 + 0.5) * r.height]; };

    // ---- 크기·렌더 ----
    function resize() {
      const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(host); resize();
    let visible = true;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
    function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      controls.update(); renderer.render(scene, camera); updateLabels();
    }
    requestAnimationFrame(tick);
    return view;
  };
})(window.SIM);
