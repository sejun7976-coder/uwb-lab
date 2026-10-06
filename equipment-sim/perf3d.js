// 만능기판 조립 3D 화면 (three.js r128). 단위 mm. 월드 좌표: X = 기판 x − 75, Z = 기판 y − 45, Y = 위
(function (S) {
  const F = S.PERF, B = S.BENCH, R = F.route, BD = F.BOARD, P = 2.54;
  const W = BD.W, H = BD.H, T = 1.6;              // 기판 두께
  const SOCK_H = 8.5, PLASTIC = 2.5;              // 암 헤더 높이, 모듈 핀헤더 플라스틱
  const MOD_Y = T / 2 + SOCK_H + PLASTIC;         // 모듈 기판 아래면 높이
  const wx = x => x - W / 2, wz = y => y - H / 2;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  let host, renderer, scene, camera, controls, dyn, boardTop, boardBot, labelsEl, labels = [], visible = false, lastFace = null;

  // ---------------- 기판 텍스처 ----------------
  function boardCanvas(bottom) {
    const k = 8, c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    const g = c.getContext('2d');
    g.scale(k, k);
    g.fillStyle = '#2E6A43'; g.fillRect(0, 0, W, H);
    const X = x => bottom ? W - x : x;
    for (let cc = 0; cc < BD.NC; cc++) for (let r = 0; r < BD.NR; r++) {
      if (R.inCorner(cc, r)) continue;
      const x = X(F.hx(cc)), y = F.hy(r);
      g.fillStyle = '#C59A52'; g.beginPath(); g.arc(x, y, 0.95, 0, 7); g.fill();
      g.fillStyle = '#0D1A12'; g.beginPath(); g.arc(x, y, 0.45, 0, 7); g.fill();
    }
    F.CORNERS.forEach(([cc, r]) => {
      const x = X(F.hx(cc) + P / 2), y = F.hy(r) + P / 2;
      g.fillStyle = '#C59A52'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill();
      g.fillStyle = '#10151A'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
    });
    const kk = F.KEEPOUT, x0 = Math.min(X(kk.x0), X(kk.x1));
    g.fillStyle = 'rgba(194,54,43,.28)'; g.fillRect(x0, kk.y0, kk.x1 - kk.x0, kk.y1 - kk.y0);
    g.strokeStyle = 'rgba(194,54,43,.9)'; g.lineWidth = 0.4; g.setLineDash([1.2, 0.8]); g.strokeRect(x0, kk.y0, kk.x1 - kk.x0, kk.y1 - kk.y0);
    if (!bottom) {
      const u = F.USBZONE; g.strokeStyle = 'rgba(255,255,255,.6)'; g.setLineDash([1.5, 1]); g.strokeRect(u.x0, u.y0, u.x1 - u.x0, u.y1 - u.y0);
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    return t;
  }

  // ---------------- 초기화 ----------------
  function init(el) {
    host = el;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    labelsEl = document.createElement('div'); labelsEl.className = 'labels3'; host.appendChild(labelsEl);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minDistance = 60; controls.maxDistance = 520;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.75));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(-80, 200, 120); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.45); d2.position.set(60, -200, -80); scene.add(d2);

    // 기판: 옆면 상자 + 위·아래 텍스처 판
    const edge = new THREE.Mesh(new THREE.BoxGeometry(W, T, H), new THREE.MeshStandardMaterial({ color: 0x1E4A2E, roughness: 0.8, transparent: true }));
    scene.add(edge);
    const pg = new THREE.PlaneGeometry(W, H);
    boardTop = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: boardCanvas(false), roughness: 0.7, transparent: true }));
    boardTop.rotation.x = -Math.PI / 2; boardTop.position.y = T / 2 + 0.01; scene.add(boardTop);
    // 뒷면 텍스처는 아래에서 본 모습(좌우 반전)으로 그리고, 판을 뒤집어 붙이면 기판 좌표와 맞는다
    boardBot = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: boardCanvas(true), roughness: 0.7 }));
    boardBot.rotation.x = Math.PI / 2; boardBot.rotation.z = Math.PI; boardBot.position.y = -T / 2 - 0.01; scene.add(boardBot);
    boardTop.userData.edge = edge;

    dyn = new THREE.Group(); scene.add(dyn);
    new ResizeObserver(resize).observe(host); resize();
    loop();
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
    const r = host.getBoundingClientRect(), v = new THREE.Vector3();
    labels.forEach(L => {
      v.copy(L.pos).project(camera);
      const hide = v.z > 1 || (L.side && Math.sign(camera.position.y) !== L.side);
      L.el.style.display = hide ? 'none' : '';
      L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`;
    });
  }

  // ---------------- 만들기 도우미 ----------------
  const mats = {};
  function mat(color, opt) {
    const key = color + JSON.stringify(opt || {});
    if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, opt || {}));
    return mats[key];
  }
  function box(w, h, d, color, x, y, z, opt) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opt));
    m.position.set(x, y, z); dyn.add(m); return m;
  }
  function label(text, x, y, z, cls, side) {
    const el = document.createElement('div'); el.className = 'lbl3 ' + (cls || ''); el.textContent = text;
    labelsEl.appendChild(el); labels.push({ el, pos: V3(x, y, z), side: side || 0 });
  }
  const glow = { emissive: 0x6BBFDD, emissiveIntensity: 0.55 };

  function socket(sid, isNew) {
    const d = F.SOCKETS[sid], ps = Object.values(F.PINS).filter(p => p.sock === sid);
    const top = T / 2;
    if (d.kind === 'r') {
      const a = F.PINS['r1:1'], b = F.PINS['r1:2'], x = wx(F.hx(a.c)), z0 = wz(F.hy(b.r)), z1 = wz(F.hy(a.r));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6.4, 16), mat(0xD8C29A, isNew ? glow : null));
      m.rotation.x = Math.PI / 2; m.position.set(x, top + 2.2, (z0 + z1) / 2); dyn.add(m);
      box(0.5, 2.2, 0.5, 0xB8BEC2, x, top + 1.1, z0); box(0.5, 2.2, 0.5, 0xB8BEC2, x, top + 1.1, z1);
      return;
    }
    if (d.kind === 'led') {
      const a = F.PINS['led:A'], k = F.PINS['led:K'], x = (wx(F.hx(a.c)) + wx(F.hx(k.c))) / 2, z = wz(F.hy(a.r));
      const lm = mat(0xF0463C, Object.assign({ transparent: true, opacity: 0.9 }, isNew ? glow : { emissive: 0x5A0A05, emissiveIntensity: 0.6 }));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 20), lm); c.position.set(x, top + 4.5, z); dyn.add(c);
      const s = new THREE.Mesh(new THREE.SphereGeometry(2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lm); s.position.set(x, top + 7, z); dyn.add(s);
      box(0.5, 2, 0.5, 0xB8BEC2, wx(F.hx(a.c)), top + 1, z); box(0.5, 2, 0.5, 0xB8BEC2, wx(F.hx(k.c)), top + 1, z);
      return;
    }
    const xs = ps.map(p => wx(F.hx(p.c) + p.dx)), zs = ps.map(p => wz(F.hy(p.r)));
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
    const L = x1 - x0 + P, D = z1 - z0 + P, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (d.kind === 'mh') {
      box(L, 2.5, D, 0x141414, cx, top + 1.25, cz, isNew ? glow : null);
      ps.forEach(p => box(0.64, 6, 0.64, 0xE3C05C, wx(F.hx(p.c)), top + 3.5, wz(F.hy(p.r)), { metalness: 0.6, roughness: 0.3 }));
      return;
    }
    box(L, SOCK_H, D, d.bent ? 0x1C1A14 : 0x141414, cx, top + SOCK_H / 2, cz, isNew ? glow : null);
    ps.forEach(p => box(1, 0.05, 1, PIN_USED(p) ? 0x5A5F63 : 0x2A2C2E, wx(F.hx(p.c) + p.dx), top + SOCK_H + 0.03, wz(F.hy(p.r))));
    if (d.bent) ps.forEach(p => box(Math.abs(p.dx) + 0.5, 0.5, 0.5, 0xE2B04A, wx(F.hx(p.c) + p.dx / 2), top + 0.4, wz(F.hy(p.r))));
  }
  let PIN_USED = () => false;

  function joints(st) {
    const pins = Object.values(F.PINS).filter(p => st.sock.includes(p.sock));
    if (!pins.length) return;
    const g = new THREE.ConeGeometry(1.0, 1.2, 12);
    const m = new THREE.InstancedMesh(g, mat(0xD9DDE0, { metalness: 0.7, roughness: 0.25 }), pins.length);
    const o = new THREE.Object3D();
    pins.forEach((p, i) => { o.position.set(wx(F.hx(p.c)), -T / 2 - 0.6, wz(F.hy(p.r))); o.rotation.x = Math.PI; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    dyn.add(m);
  }

  function wires(st, ctx) {
    F.NETS.forEach((n, ni) => {
      if (n.stage > st.stage) return;
      const color = new THREE.Color(ctx.WC[n.grp]);
      const dim = ctx.sel && ctx.sel !== n.id, isNew = n.stage === st.newStage;
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, transparent: dim, opacity: dim ? 0.15 : 1, emissive: isNew || ctx.sel === n.id ? color : 0x000000, emissiveIntensity: ctx.sel === n.id ? 0.5 : isNew ? 0.18 : 0 });
      const rad = n.wire === 'pwr' ? 0.5 : 0.38, off = ((ni % 5) - 2) * 0.3;
      const y = -T / 2 - 1.1 - (ni % 3) * 0.25;
      ctx.ROUTE.nets[n.id].segs.forEach(sg => {
        const cs = R.corners(sg[2]);
        const pts = [];
        cs.forEach(([c, r], i) => {
          const e = i === 0 || i === cs.length - 1 ? 0 : off, p = V3(wx(F.hx(c)) + e, y, wz(F.hy(r)) + e);
          if (i === 0) pts.push(V3(p.x, -T / 2 - 0.2, p.z));
          pts.push(p);
          if (i === cs.length - 1) pts.push(V3(p.x, -T / 2 - 0.2, p.z));
        });
        const path = new THREE.CurvePath();
        for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
        const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, pts.length * 6), rad, 6, false), m);
        dyn.add(tube);
      });
    });
  }

  function modules(ctx) {
    const y0 = MOD_Y;
    // 모듈 아래 핀헤더 플라스틱
    const hdr = (sid) => {
      const ps = Object.values(F.PINS).filter(p => p.sock === sid);
      const xs = ps.map(p => wx(F.hx(p.c) + p.dx)), z = wz(F.hy(ps[0].r));
      box(Math.max.apply(null, xs) - Math.min.apply(null, xs) + P, PLASTIC, P, 0x111111, (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2, T / 2 + SOCK_H + PLASTIC / 2, z);
    };
    ['esp-j1', 'esp-j3', 'dwm-dig10', 'dwm-dig8', 'dwm-pwr8', 'ina1', 'ina2', 'imu'].forEach(hdr);
    // ESP32
    const e = F.POSE.esp, ex = wx(e.x), ez = wz(e.y);
    box(70, 1.6, 28, 0x16191A, ex, y0 + 0.8, ez);
    box(19.5, 3.2, 18, 0xB9C0C4, ex + 19.25, y0 + 3.2, ez, { metalness: 0.5, roughness: 0.35 });
    box(6, 0.4, 18, 0x2B6F4E, ex + 32, y0 + 1.8, ez);
    [-6.5, 6.5].forEach(v => box(7, 3.2, 9, 0x9AA3A8, ex - 31.5, y0 + 3.2, ez - v, { metalness: 0.6, roughness: 0.3 }));
    label('ESP32-S3', ex - 5, y0 + 4, ez, 'mod', 1);
    label('ESP32 안테나', ex + 32, y0 + 3, ez, 'ant', 1);
    // DWM3000EVB: 흰 기판. 모듈·안테나·J1은 F.DWM_GEOM (사진 추정), 안테나는 기판 밖으로 나옴
    const G = F.DWM_GEOM, at = (u, v) => { const q = F.dwmXY(u, v); return [wx(q[0]), wz(q[1])]; };
    const rbox = (r, h, color, y, opt) => { const a = at((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2); return box(r.u1 - r.u0, h, r.v1 - r.v0, color, a[0], y, a[1], opt); };
    const c0 = at(0, 0);
    box(68.58, 1.6, 53.34, 0xF1F1EC, c0[0], y0 + 0.8, c0[1]);
    rbox(G.module, 1, 0xFAFAF7, y0 + 2.1);
    rbox(G.can, 2.2, 0xB9C0C4, y0 + 3.7, { metalness: 0.5, roughness: 0.35 });
    rbox(G.ant, 1.4, 0xE4E4DE, y0 + 3.3);
    const j = at(G.j1.u, G.j1.v);
    box(7.5, 2.5, 2.5, 0x111111, j[0], y0 + 2.85, j[1], { emissive: 0xFFD166, emissiveIntensity: 0.2 });
    label('DWM3000EVB', c0[0] + 12, y0 + 4, c0[1], 'mod', 1);
    const an = at((G.ant.u0 + G.ant.u1) / 2, 0);
    label('UWB 안테나 (기판 밖)', an[0], y0 + 7, an[1], 'ant', 1);
    label('J1 2–3', j[0], y0 + 5, j[1], 'warn', 1);
    // 브레이크아웃
    Object.keys(F.BREAKOUTS).forEach(id => {
      const m = F.BREAKOUTS[id], bd = B[m.def];
      const left = F.hx(m.a) - bd.header.x0, top = F.hy(m.r) - (bd.Wb - bd.header.y);
      const cx = wx(left + bd.Lb / 2), cz = wz(top + bd.Wb / 2);
      box(bd.Lb, 1.6, bd.Wb, { imu: 0x143238, ina1: 0x1C1F3A, ina2: 0x2B1C36 }[id], cx, y0 + 0.8, cz);
      if (m.def === 'ina') box(10.5, 7, 6.5, 0x2F8F4E, cx, y0 + 5, wz(top + 3.6));
      else box(3, 1, 2.5, 0x222222, cx, y0 + 2.1, cz - 2);
      label(m.name, cx, y0 + 9, cz, 'mod', 1);
    });
    if (ctx.mount) F.CORNERS.forEach(([c, r]) => {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 10, 6), mat(0xEDEDE6));
      sp.position.set(wx(F.hx(c) + P / 2), -T / 2 - 5, wz(F.hy(r) + P / 2)); dyn.add(sp);
    });
  }

  // ---------------- 갱신 ----------------
  function clear() {
    while (dyn.children.length) {
      const o = dyn.children.pop();
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Object.values(mats).includes(o.material)) o.material.dispose();
    }
    labels = []; labelsEl.innerHTML = '';
  }
  function setCamera(face) {
    const below = face === 'bottom';
    camera.position.set(-20, below ? -175 : 175, 125);
    controls.target.set(0, 0, 5);
    controls.update();
  }

  S.perf3d = {
    show(el, on) {
      if (on && !renderer) init(el);
      visible = on;
      if (on) resize();
    },
    update(ctx) {
      if (!renderer) return;
      PIN_USED = p => !!ctx.PIN_NET[p.id];
      clear();
      const st = ctx.st, xray = ctx.view === 'both';
      boardTop.material.opacity = xray ? 0.35 : 1;
      boardTop.userData.edge.material.opacity = xray ? 0.35 : 1;
      boardTop.material.depthWrite = !xray;
      st.sock.forEach(sid => socket(sid, st.newSock.includes(sid)));
      joints(st);
      wires(st, ctx);
      if (ctx.mods) modules(ctx);
      // 이름표
      label('← UWB 안테나 쪽', wx(4), 3, wz(-6), 'edge');
      label('ESP32 안테나 쪽 →', wx(W - 4), 3, wz(-6), 'edge');
      if (!ctx.mods) {
        const nm = { 'esp-j1': 'ESP32 J1', 'esp-j3': 'ESP32 J3', 'dwm-dig10': 'DWM 디지털', 'dwm-dig8': 'D7–D0 (굽힘)', 'dwm-pwr8': 'DWM 전원', ina1: 'INA228 ①', ina2: 'INA228 ②', imu: 'IMU', usb: '전원 입력', tp: '측정 핀', led: 'LED' };
        st.sock.forEach(sid => {
          if (!nm[sid]) return;
          const ps = Object.values(F.PINS).filter(p => p.sock === sid);
          const x = ps.reduce((s, p) => s + F.hx(p.c), 0) / ps.length, y = ps.reduce((s, p) => s + F.hy(p.r), 0) / ps.length;
          label(nm[sid], wx(x), T / 2 + SOCK_H + 3, wz(y), st.newSock.includes(sid) ? 'new' : '', 1);
          if (ctx.view === 'bottom') label(nm[sid], wx(x), -T / 2 - 4, wz(y), '', -1);
        });
      }
      if (ctx.view !== lastFace) { setCamera(ctx.view); lastFace = ctx.view; }
    },
    resetCamera() { if (camera) setCamera(lastFace || 'top'); }
  };
})(window.SIM);
