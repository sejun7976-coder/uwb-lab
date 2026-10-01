// 테스트 공간 시뮬레이터: 공간(A·B·C) 3D 장면, 배치 계산, 히트맵, 노드 상세
(function (S) {
  const E = S.ENV, O = S.envOpt, PR = S.ENV_PRESETS || {};
  const $ = id => document.getElementById(id);
  const V = (x, y, z) => new THREE.Vector3(x, z, -y);
  const UP = new THREE.Vector3(0, 1, 0);
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888888';
  const C = n => new THREE.Color(tok(n));
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.05 }, o || {}));
  const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = x => (Math.round(x * 100) / 100).toFixed(2);
  const dark = () => matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'light';
  const q = new URLSearchParams(location.search);

  function clearGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    while (g.children.length) g.remove(g.children[0]);
  }
  function cylBetween(a, b, r, m) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 10), m);
    o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o;
  }
  function boxAt(g, w, d, h, x, y, z0, m) {          // 시뮬레이션 좌표: 가로 w(x) · 세로 d(y) · 높이 h, 바닥 z0
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.copy(V(x, y, z0 + h / 2)); g.add(o); return o;
  }

  // ---------------- 3D 화면 공통 ----------------
  function createView(host, cfg) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    const layer = document.createElement('div'); layer.className = 'labels'; host.appendChild(layer);
    const tip = document.createElement('div'); tip.className = 'tip'; host.appendChild(tip);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(cfg.fov || 42, 1, cfg.near || 0.03, cfg.far || 200);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    if (cfg.maxPolar) controls.maxPolarAngle = cfg.maxPolar;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556660, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(4, 9, 6); scene.add(sun);
    const v = { renderer, scene, camera, controls, layer, tip, host, labels: [] };
    v.label = function (text, pos, cls) {
      const el = document.createElement('div'); el.className = 'lbl ' + (cls || ''); el.textContent = text; layer.appendChild(el);
      const L = { el, pos, mid: /plain|mark/.test(cls || '') }; v.labels.push(L); return L;
    };
    v.clearLabels = () => { v.labels.forEach(L => L.el.remove()); v.labels = []; };
    const pv = new THREE.Vector3();
    function updateLabels() {
      const w = host.clientWidth, h = host.clientHeight;
      v.labels.forEach(L => {
        if (L.hidden) { L.el.style.display = 'none'; return; }
        pv.copy(L.pos).project(camera);
        if (pv.z > 1 || pv.z < -1) { L.el.style.display = 'none'; return; }
        L.el.style.display = '';
        L.el.style.transform = 'translate(' + ((pv.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-pv.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,' + (L.mid ? '-50%' : '-130%') + ')';
      });
    }
    function resize() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(host); resize();
    (function tick() {
      requestAnimationFrame(tick);
      controls.update(); renderer.render(scene, camera); updateLabels();
    })();
    v.background = () => { scene.background = C('--scene'); };
    v.background();
    v.ray = new THREE.Raycaster(); v.ndc = new THREE.Vector2();
    v.setNdc = e => { const r = renderer.domElement.getBoundingClientRect(); v.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); v.ray.setFromCamera(v.ndc, camera); return r; };
    v.showTip = (e, html) => {
      const r = host.getBoundingClientRect();
      tip.innerHTML = html; tip.style.display = 'block';
      const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 6), y = Math.max(6, e.clientY - r.top - tip.offsetHeight - 10);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    v.hideTip = () => { tip.style.display = 'none'; };
    return v;
  }

  // ---------------- 상태 ----------------
  const st = {
    space: /^[ABC]$/.test(q.get('space') || '') ? q.get('space') : 'A',
    dims: {}, results: {}, layout: 'opt', overlay: 'hdop', tagz: 'cart', session: 0, show24: true, measure: false,
    tag: null, node: q.get('node') === 'aux' ? 'aux' : 'anchor'
  };
  // 주소 옵션: &overlay=hdop|worst|count|cam|none · &tagz=cart|helmet · &layout=opt|base · &measure=1
  if (/^(hdop|worst|count|cam|none)$/.test(q.get('overlay') || '')) st.overlay = q.get('overlay');
  if (/^(cart|helmet)$/.test(q.get('tagz') || '')) st.tagz = q.get('tagz');
  if (/^(opt|base)$/.test(q.get('layout') || '')) st.layout = q.get('layout');
  if (q.get('measure') === '1') st.measure = true;
  ['overlay', 'tagz', 'layout'].forEach(k => { const el = $(k); if (el) el.value = st[k]; });
  $('show-measure').checked = st.measure;
  Object.keys(E.SPACES).forEach(k => { const s = E.SPACES[k]; st.dims[k] = { w: s.w, l: s.l, h: s.h }; });
  const spaceOf = id => Object.assign({}, E.SPACES[id], st.dims[id]);
  const sameDims = (a, b) => a && b && Math.abs(a.w - b.w) < 1e-6 && Math.abs(a.l - b.l) < 1e-6 && Math.abs(a.h - b.h) < 1e-6;

  // 공간 계산 (미리 계산한 배치가 있으면 그것을 쓰고, 크기를 바꾸면 다시 최적화)
  function solve(id, force) {
    const sp = spaceOf(id), tagZ = E.TAG_Z.cart, preset = PR[id];
    let r;
    if (!force && preset && sameDims(preset.dims, sp)) {
      const pre = O.precompute(sp, tagZ, E.GRID_STEP, E.GRID_STEP);
      const opt = { sel: preset.sel.map(a => Object.assign({}, a)) }; opt.res = O.evaluate(pre, opt.sel);
      const base = O.baseline(pre), anchors = O.anchorsOf(pre, opt.sel), aux = O.placeAux(pre, anchors, 3);
      r = { pre, base, baseRes: O.evaluate(pre, base), opt, anchors, baseAnchors: O.anchorsOf(pre, base), aux, router: O.placeRouter(pre, anchors, aux), cams: O.placeCameras(pre), preset: true };
    } else {
      r = O.solve(sp, {});
    }
    r.space = sp; r.byZ = { cart: r.pre };
    st.results[id] = r;
    return r;
  }
  function preFor(r, key) {
    if (!r.byZ[key]) r.byZ[key] = O.precompute(r.space, E.TAG_Z[key], E.GRID_STEP, E.GRID_STEP);
    return r.byZ[key];
  }
  function current() {
    const r = st.results[st.space], pre = preFor(r, st.tagz);
    const sel = st.layout === 'opt' ? r.opt.sel : r.base;
    const anchors = O.anchorsOf(pre, sel);
    const res = O.evaluate(pre, sel, true);
    return { r, pre, sel, anchors, res };
  }

  // ---------------- 공간 3D ----------------
  const sv = createView($('space-view'), { maxPolar: Math.PI * 0.495 });
  const world = new THREE.Group(), dyn = new THREE.Group(); sv.scene.add(world); sv.scene.add(dyn);
  let floorMesh = null, heat = null, cur = null, picks = [];

  function legendHTML(kind) {
    const SEQ = dark() ? E.SEQ_DARK : E.SEQ;
    const sw = (c, t) => '<div class="row"><i style="background:' + c + '"></i>' + t + '</div>';
    const ln = (c, t, dash) => '<div class="row line"><i style="background:' + (dash ? 'repeating-linear-gradient(90deg,' + c + ' 0 4px,transparent 4px 7px)' : c) + '"></i>' + t + '</div>';
    let h = '';
    if (kind === 'hdop' || kind === 'worst') {
      h += '<b>' + (kind === 'hdop' ? 'HDOP · 앵커 6대' : 'HDOP · 가장 나쁜 1대 빠짐') + '</b>';
      HD_BINS.forEach((b, i) => { h += sw(SEQ[i], b.t); });
      h += sw(tok('--block'), 'LOS 3대 미만 (측위 불가)');
    } else if (kind === 'count') {
      h += '<b>LOS 앵커 수</b>';
      for (let n = 6; n >= 0; n--) h += sw(n < 3 ? tok('--block') : SEQ[Math.max(0, n - 1)], n + '대' + (n < 3 ? ' (측위 불가)' : ''));
    } else if (kind === 'cam') {
      h += '<b>GT 카메라 화각 (태그 높이)</b>' + sw(SEQ[2], '보임') + sw(tok('--block'), '안 보임 (화각 밖·가림)');
    }
    h += (h ? '<div style="height:4px"></div>' : '') + ln(tok('--ok'), 'UWB LOS') + ln(tok('--edge'), 'UWB 경계 (프레넬)') + ln(tok('--block'), 'UWB 가림');
    if (st.show24) h += ln(tok('--radio'), '2.4 GHz (보조 노드·공유기)', true);
    return h;
  }
  const HD_BINS = [{ max: 1.0, t: '≤ 1.0' }, { max: 1.25, t: '1.0–1.25' }, { max: 1.5, t: '1.25–1.5' }, { max: 2.0, t: '1.5–2.0' }, { max: 3.0, t: '2.0–3.0' }, { max: 5.0, t: '3.0–5.0' }, { max: 1e9, t: '> 5.0' }];

  function heatCanvas(c) {
    const g = c.pre.grid, nx = g.nx, ny = g.ny, px = 10, cv = document.createElement('canvas');
    cv.width = (nx + 1) * px; cv.height = (ny + 1) * px;
    const x = cv.getContext('2d'), SEQ = dark() ? E.SEQ_DARK : E.SEQ, red = tok('--block');
    const val = new Map();
    let cams = null;
    if (st.overlay === 'cam') cams = (c.r.cams.one.cover >= 0.95 ? c.r.cams.one : c.r.cams.two).cams;
    g.pts.forEach((p, k) => {
      let col = null, v = null;
      if (st.overlay === 'hdop' || st.overlay === 'worst') {
        v = (st.overlay === 'hdop' ? c.res.hdop : c.res.worst)[k];
        col = v >= O.CAP ? red : SEQ[HD_BINS.findIndex(b => v <= b.max)];
      } else if (st.overlay === 'count') {
        v = c.res.count[k]; col = v < 3 ? red : SEQ[Math.max(0, v - 1)];
      } else if (st.overlay === 'cam') {
        v = cams.some(cm => O.camSees(cm, [p.x, p.y, p.z], c.pre.boxes)); col = v ? SEQ[2] : red;
      }
      if (col) { x.fillStyle = col; x.fillRect(p.i * px, (ny - p.j) * px, px, px); }
      val.set(p.i + ',' + p.j, { p, k, v });
    });
    return { cv, val };
  }

  function buildSpace() {
    clearGroup(world); clearGroup(dyn); sv.clearLabels(); picks = [];
    cur = current();
    const sp = cur.r.space, W = sp.w, L = sp.l, H = sp.h;
    sv.background();
    // 바닥·벽
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat(C('--floor'), { roughness: 1 }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.copy(V(W / 2, L / 2, 0)); world.add(floorMesh);
    const gridM = new THREE.LineBasicMaterial({ color: C('--grid') }), gp = [];
    for (let x = 0; x <= W + 1e-6; x += 1) gp.push(V(x, 0, 0.002), V(x, L, 0.002));
    for (let y = 0; y <= L + 1e-6; y += 1) gp.push(V(0, y, 0.002), V(W, y, 0.002));
    world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), gridM));
    const wallM = basic(C('--wall'), { transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    [[W / 2, 0, W, 0], [W, L / 2, L, Math.PI / 2], [W / 2, L, W, 0], [0, L / 2, L, Math.PI / 2]].forEach(([x, y, len, r]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wallM); m.position.copy(V(x, y, H / 2)); m.rotation.y = r; world.add(m);
    });
    const edge = []; [[0, 0], [W, 0], [W, L], [0, L]].forEach(([x, y]) => edge.push(V(x, y, 0), V(x, y, H)));
    [[0, 0, W, 0], [W, 0, W, L], [W, L, 0, L], [0, L, 0, 0]].forEach(([a, b, c2, d]) => edge.push(V(a, b, H), V(c2, d, H), V(a, b, 0), V(c2, d, 0)));
    world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edge), new THREE.LineBasicMaterial({ color: C('--wall') })));
    // 히트맵
    if (st.overlay !== 'none') {
      heat = heatCanvas(cur);
      const g = cur.pre.grid, m = sp.margin, s = g.step;
      const tex = new THREE.CanvasTexture(heat.cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const pw = (W - 2 * m) + (W - 2 * m) / g.nx, pl = (L - 2 * m) + (L - 2 * m) / g.ny;
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(pw, pl), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }));
      pm.rotation.x = -Math.PI / 2; pm.position.copy(V(W / 2, L / 2, 0.006)); world.add(pm);
    } else heat = null;
    // 장애물
    cur.r.space.obstacles.forEach(o => world.add(obstacleMesh(o)));
    // 앵커 노드
    cur.anchors.forEach(a => {
      const n = S.buildNode('anchor', { detail: false, wires: true });
      S.placeNode(n, a, a.nx, a.ny, V); world.add(n);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false }));
      hit.position.copy(V(a.x, a.y, a.z - 0.06)); hit.userData.pick = { kind: 'anchor', a }; world.add(hit); picks.push(hit);
      sv.label('A' + a.id + ' · ' + a.z.toFixed(1) + ' m', V(a.x, a.y, a.z + 0.08), 'anchor');
    });
    // 보조 노드 (현재 세션은 실물, 나머지 후보는 점선 표시)
    cur.r.aux.forEach((s, i) => {
      if (i === st.session) {
        const n = S.buildNode('aux', { detail: false }); S.placeNode(n, s, s.nx, s.ny, V); world.add(n);
        sv.label(s.id + ' 보조 노드', V(s.x, s.y, s.z + 0.08), 'aux');
      } else {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 28), basic(C('--radio'), { transparent: true, opacity: 0.7 }));
        r.position.copy(V(s.x, s.y, s.z)); r.lookAt(V(s.x + s.nx, s.y + s.ny, s.z)); world.add(r);
        sv.label(s.id + ' 후보', V(s.x, s.y, s.z + 0.12), 'aux ghost');
      }
    });
    // 공유기
    if (cur.r.router) { world.add(routerMesh(cur.r.router)); sv.label('공유기', V(cur.r.router.x, cur.r.router.y, 1.25), 'plain'); }
    // GT 카메라
    const camSet = (cur.r.cams.one.cover >= 0.95 ? cur.r.cams.one : cur.r.cams.two).cams;
    camSet.forEach((cm, i) => { world.add(cameraMesh(cm)); sv.label('GT 카메라' + (camSet.length > 1 ? ' ' + (i + 1) : ''), V(cm.pos[0], cm.pos[1], cm.pos[2] + 0.12), 'plain'); });
    // 복도: 유효거리 측정점
    if (sp.rangeMarks) sp.rangeMarks.forEach(d => {
      if (d > L - 0.3) return;
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), basic(C('--tape'))); t.rotation.x = -Math.PI / 2; t.position.copy(V(W / 2, d + 0.07, 0.008)); world.add(t);
      sv.label(d + ' m', V(W / 2 + 0.32, d + 0.07, 0.02), 'mark');
    });
    if (st.measure) measureOverlay(sp, cur.anchors);
    // 태그
    if (!st.tag || st.tag.space !== st.space) st.tag = { space: st.space, x: W / 2 + 0.31, y: L / 2 - 0.27 };
    buildTag();
    $('legend') && $('legend').remove();
    const lg = document.createElement('div'); lg.className = 'legend'; lg.id = 'legend'; lg.innerHTML = legendHTML(st.overlay); $('space-view').appendChild(lg);
    if (!sv.hint) { sv.hint = document.createElement('div'); sv.hint.className = 'hint'; sv.hint.textContent = '바닥을 누르면 태그가 옮겨진다 · 드래그 회전 · 휠 확대'; $('space-view').appendChild(sv.hint); }
    frameSpace();
    renderSide();
  }
  let framedFor = '';
  function frameSpace() {
    const sp = cur.r.space, key = st.space + sp.w + 'x' + sp.l;
    if (framedFor === key) return; framedFor = key;
    const D = Math.max(sp.w, sp.l), long = sp.l / sp.w > 3;
    sv.controls.target.copy(V(sp.w / 2, sp.l / 2, 0.6));
    sv.camera.position.copy(long ? V(sp.w / 2 + D * 0.55, -D * 0.12, D * 0.45) : V(sp.w * 1.35 + 1.5, -sp.l * 0.55 - 1.5, D * 0.95 + 1));
    sv.controls.update();
  }

  function obstacleMesh(o) {
    const g = new THREE.Group(), steel = mat(C('--metal'), { metalness: 0.55, roughness: 0.45 });
    const x0 = o.x - o.hx, x1 = o.x + o.hx, y0 = o.y - o.hy, y1 = o.y + o.hy, H = o.z1;
    if (o.kind === 'shelf') {
      [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => g.add(cylBetween(V(x, y, 0), V(x, y, H), 0.02, steel)));
      for (let k = 0; k < 5; k++) boxAt(g, o.hx * 2, o.hy * 2, 0.025, o.x, o.y, 0.08 + k * (H - 0.12) / 4, steel);
      for (let k = 0; k < 4; k++) [[0.5, 0.18], [-0.5, 0.25], [0.1, 0.3]].forEach(([dy, hh]) => boxAt(g, o.hx * 1.6, 0.35, hh, o.x, o.y + dy * o.hy * 1.5, 0.105 + k * (H - 0.12) / 4, mat('#8a6f4d', { roughness: 0.9 })));
    } else if (o.kind === 'bench') {
      boxAt(g, o.hx * 2, o.hy * 2, 0.04, o.x, o.y, H - 0.04, mat('#b08d62'));
      [[x0 + 0.05, y0 + 0.05], [x1 - 0.05, y0 + 0.05], [x1 - 0.05, y1 - 0.05], [x0 + 0.05, y1 - 0.05]].forEach(([x, y]) => g.add(cylBetween(V(x, y, 0), V(x, y, H - 0.04), 0.025, steel)));
    } else {
      boxAt(g, o.hx * 2, o.hy * 2, H, o.x, o.y, 0, o.kind === 'rack' ? mat('#3b4246', { metalness: 0.4 }) : steel);
    }
    g.traverse(m => { m.userData.pick = { kind: 'obstacle', o }; if (m.isMesh) picks.push(m); });
    sv.label(o.name, V(o.x, o.y, H + 0.05), 'plain');
    return g;
  }
  function routerMesh(r) {
    const g = new THREE.Group();
    boxAt(g, 0.35, 0.3, 0.9, r.x, r.y, 0, mat('#c9c3b5'));                       // 받침대
    const b = boxAt(g, 0.2, 0.13, 0.035, r.x, r.y, 0.9, mat('#25292d'));
    for (let k = 0; k < 4; k++) g.add(cylBetween(V(r.x - 0.08 + k * 0.053, r.y + 0.06, 0.93), V(r.x - 0.08 + k * 0.053, r.y + 0.07, 1.09), 0.006, mat('#25292d')));
    b.userData.pick = { kind: 'router', r }; picks.push(b);
    return g;
  }
  function cameraMesh(cm) {
    const g = new THREE.Group(), p = V(cm.pos[0], cm.pos[1], cm.pos[2]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.03, 0.065), mat('#d64a5a'));     // 라즈베리파이 4 케이스
    body.position.copy(p).add(new THREE.Vector3(0, 0.05, 0)); g.add(body);
    const head = new THREE.Group(); head.position.copy(p);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.024, 0.012), mat('#1f6b3a')));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 12), mat('#111'));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.009; head.add(lens);
    head.lookAt(V(cm.tgt[0], cm.tgt[1], cm.tgt[2])); g.add(head);
    head.userData.pick = { kind: 'camera', cm }; picks.push(head);
    return g;
  }

  // 줄자 좌표 측정: 원점, 추 투영점, 두 벽까지 거리선, 대각선 검산
  function measureOverlay(sp, anchors) {
    const tape = new THREE.LineBasicMaterial({ color: C('--tape') }), dashM = new THREE.LineDashedMaterial({ color: C('--tape'), dashSize: 0.06, gapSize: 0.05 });
    const add = (pts, m) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m); if (m === dashM) l.computeLineDistances(); world.add(l); };
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), basic(C('--tape'))); o.position.copy(V(0, 0, 0.02)); world.add(o);
    sv.label('원점 (0, 0)', V(0.05, 0.05, 0.05), 'mark');
    anchors.forEach(a => {
      add([V(a.x, a.y, a.z), V(a.x, a.y, 0.01)], dashM);                                // 추를 단 실
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), basic(C('--tape'))); d.rotation.x = -Math.PI / 2; d.position.copy(V(a.x, a.y, 0.01)); world.add(d);
      add([V(a.x, a.y, 0.012), V(0, a.y, 0.012)], tape); add([V(a.x, a.y, 0.012), V(a.x, 0, 0.012)], tape);
    });
    for (let k = 0; k < anchors.length; k++) {                                          // 대각선 검산 (마주 보는 앵커)
      const a = anchors[k], b = anchors[(k + 3) % anchors.length];
      if (k < 3) { add([V(a.x, a.y, 0.015), V(b.x, b.y, 0.015)], dashM); const t = 0.28 + 0.1 * k; sv.label('A' + a.id + '–A' + b.id + ' ' + f2(Math.hypot(a.x - b.x, a.y - b.y)) + ' m', V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0.03), 'mark'); }
    }
  }

  // 태그와 링크
  function buildTag() {
    clearGroup(dyn);
    sv.labels = sv.labels.filter(L => { if (L.dyn) { L.el.remove(); return false; } return true; });
    const sp = cur.r.space, z = E.TAG_Z[st.tagz], t = st.tag, boxes = cur.pre.boxes;
    const m = mat(C('--metal'), { metalness: 0.4 });
    if (st.tagz === 'cart') {
      for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.4; dyn.add(cylBetween(V(t.x, t.y, z * 0.55), V(t.x + 0.3 * Math.cos(a), t.y + 0.3 * Math.sin(a), 0), 0.01, m)); }
      dyn.add(cylBetween(V(t.x, t.y, z * 0.55), V(t.x, t.y, z - 0.05), 0.012, m));
    } else {
      const p = mat('#8C979B'); dyn.add(cylBetween(V(t.x, t.y, 0), V(t.x, t.y, 1.45), 0.14, p));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), p); head.position.copy(V(t.x, t.y, 1.6)); dyn.add(head);
      const hm = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C('--tape'))); hm.position.copy(V(t.x, t.y, 1.62)); dyn.add(hm);
    }
    const tagBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.07), mat(C('--tag'))); tagBox.position.copy(V(t.x, t.y, z)); dyn.add(tagBox);
    const L = sv.label('태그 · ' + z.toFixed(2) + ' m', V(t.x, t.y, z + 0.08), 'tag'); L.dyn = true;
    const p = [t.x, t.y, z], col = { los: tok('--ok'), edge: tok('--edge'), block: tok('--block') };
    t.links = cur.anchors.map(a => {
      const s = O.link([a.x, a.y, a.z], p, boxes);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(a.x, a.y, a.z), V(t.x, t.y, z)]), new THREE.LineBasicMaterial({ color: col[s], transparent: s === 'block', opacity: s === 'block' ? 0.75 : 1 }));
      dyn.add(line); return { id: a.id, s, d: Math.hypot(a.x - t.x, a.y - t.y, a.z - z) };
    });
    if (st.show24) {
      const dashM = new THREE.LineDashedMaterial({ color: C('--radio'), dashSize: 0.08, gapSize: 0.06 });
      const tx = [cur.r.aux[st.session], cur.r.router && { x: cur.r.router.x, y: cur.r.router.y, z: 1.0 }].filter(Boolean);
      tx.forEach(s => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(s.x, s.y, s.z), V(t.x, t.y, z)]), dashM); l.computeLineDistances(); dyn.add(l); });
    }
    // 이 지점의 HDOP
    let a = 0, b = 0, c = 0, n = 0;
    cur.anchors.forEach((an, i) => { if (t.links[i].s === 'block') return; const r = t.links[i].d, hx = (t.x - an.x) / r, hy = (t.y - an.y) / r; a += hx * hx; b += hx * hy; c += hy * hy; n++; });
    t.hdop = n < 3 || a * c - b * b < 1e-9 ? null : Math.sqrt((a + c) / (a * c - b * b));
    t.n = n;
    renderTagInfo();
  }

  // ---------------- 오른쪽 패널 ----------------
  function metricRows(o, b) {
    const pct = x => Math.round(x * 100) + ' %';
    const rows = [
      ['HDOP 중앙값 (6대)', f2(o.p50), f2(b.p50), true],
      ['HDOP 95 % (6대)', o.p95 >= O.CAP ? '실패' : f2(o.p95), b.p95 >= O.CAP ? '실패' : f2(b.p95), true],
      ['1대 뺀 5대: 95 % 평균', o.rmMean >= O.CAP ? '실패' : f2(o.rmMean), b.rmMean >= O.CAP ? '실패' : f2(b.rmMean), true],
      ['3대 조합 20개: 95 % 평균', o.s3Mean >= O.CAP ? '실패' : f2(o.s3Mean), b.s3Mean >= O.CAP ? '실패' : f2(b.s3Mean), true],
      ['3대 조합 중 95 % ≤ 3', o.s3Good + ' / 20', b.s3Good + ' / 20', false],
      ['LOS 3대 이상 면적', pct(o.cov3), pct(b.cov3), false],
      ['LOS 4대 이상 면적', pct(o.cov4), pct(b.cov4), false]
    ];
    return rows.map(r => '<tr><td class="t">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');
  }
  function renderSide() {
    const r = cur.r, sp = r.space, pre = cur.pre;
    const o = O.evaluate(pre, r.opt.sel), b = O.evaluate(pre, r.base);
    const camSet = r.cams.one.cover >= 0.95 ? r.cams.one : r.cams.two;
    const cornerName = ['남서', '남동', '북동', '북서'];
    const sub = O.subsets3(pre, st.layout === 'opt' ? r.opt.sel : r.base);
    let h = '<div class="blk"><h3>' + esc(sp.name) + ' — ' + sp.w + ' × ' + sp.l + ' m, 천장 ' + sp.h + ' m (가정)</h3>' +
      '<span class="small">' + esc(sp.role) + '<br>' + esc(sp.note) + '</span></div>';
    h += '<div class="blk"><h3>배치 품질 (태그 ' + E.TAG_Z[st.tagz] + ' m)</h3><table><thead><tr><th></th><th>최적</th><th>기본</th></tr></thead><tbody>' + metricRows(o, b) + '</tbody></table>' +
      '<span class="small">기본 = 모서리 4 + 긴 벽 가운데 2. "실패"는 95 % 지점 안에 LOS 앵커가 3대 미만인 곳이 있다는 뜻이다.' + (r.preset ? '' : ' 이 크기로 방금 다시 계산했다.') + '</span></div>';
    h += '<div class="blk"><h3>앵커 좌표 (' + (st.layout === 'opt' ? '최적' : '기본') + ', 안테나 중심)</h3><table><thead><tr><th>앵커</th><th>x</th><th>y</th><th>z</th><th>벽</th></tr></thead><tbody>' +
      cur.anchors.map(a => '<tr><td>A' + a.id + '</td><td>' + f2(a.x) + '</td><td>' + f2(a.y) + '</td><td>' + a.z.toFixed(2) + '</td><td class="t">' + ({ S: '남', E: '동', N: '북', W: '서' }[a.wall]) + (a.corner ? ' 모서리' : '') + '</td></tr>').join('') +
      '</tbody></table><div class="btnrow"><button type="button" id="csv-copy">anchors.csv 복사</button><button type="button" id="csv-save">CSV 저장</button></div>' +
      '<span class="small">펌웨어 도구(<code>tools/uwb_monitor.py --anchors</code>)와 같은 형식이다. 실제 설치 후에는 줄자로 잰 값으로 바꾼다.</span></div>';
    h += '<div class="blk"><h3>2.4 GHz 기준점</h3><table><thead><tr><th></th><th>x</th><th>y</th><th>z</th><th>앵커와 최소 거리</th></tr></thead><tbody>' +
      r.aux.map(s => '<tr><td>' + s.id + '</td><td>' + f2(s.x) + '</td><td>' + f2(s.y) + '</td><td>' + s.z.toFixed(1) + '</td><td>' + f2(s.dmin) + ' m</td></tr>').join('') +
      (r.router ? '<tr><td class="t">공유기</td><td>' + f2(r.router.x) + '</td><td>' + f2(r.router.y) + '</td><td>1.0</td><td>' + f2(r.router.dmin) + ' m</td></tr>' : '') +
      '</tbody></table><span class="small">보조 노드는 세션마다 S1 → S2 → S3로 옮긴다. 앵커와 떨어진 벽, LOS가 넓은 곳을 골랐다.</span></div>';
    h += '<div class="blk"><h3>GT 카메라</h3><span class="small">' +
      (r.cams.one.cover >= 0.95
        ? cornerName[camSet.cams[0].corner] + ' 모서리 1대로 측정 영역의 ' + Math.round(r.cams.one.cover * 100) + ' %가 보인다.'
        : '1대로는 ' + Math.round(r.cams.one.cover * 100) + ' %만 보인다 (' + cornerName[r.cams.one.cams[0].corner] + '). ' + camSet.cams.map(c => cornerName[c.corner]).join('·') + ' 모서리 2대면 ' + Math.round(r.cams.two.cover * 100) + ' %. 라즈베리파이 4는 카메라 포트가 1개라 Pi가 2대 필요하다.') +
      ' 화각 102° × 67° (Camera Module 3 Wide), 높이 ' + camSet.cams[0].pos[2].toFixed(2) + ' m.</span></div>';
    h += '<div class="blk"><h3>앵커 3대만 쓸 때 (관측 부족 조건)</h3><table><thead><tr><th>조합</th><th>HDOP 95 %</th><th>측위 가능 면적</th></tr></thead><tbody>' +
      sub.slice(0, 3).concat(sub.length > 6 ? [null] : [], sub.slice(-3)).map(x => x ? '<tr><td>A' + x.ids.join('·A') + '</td><td class="' + (x.p95 <= 3 ? 'good' : x.p95 >= O.CAP ? 'bad' : '') + '">' + (x.p95 >= O.CAP ? '실패' : f2(x.p95)) + '</td><td>' + Math.round(x.cov * 100) + ' %</td></tr>' : '<tr><td colspan="3" class="t small">…</td></tr>').join('') +
      '</tbody></table><span class="small">6대로 기록한 뒤 후처리로 3대를 고르는 실험(20가지)에서 위는 가장 좋은 조합, 아래는 가장 나쁜 조합이다.</span></div>';
    if (sp.rangeMarks) h += '<div class="blk"><h3>유효거리 측정 (7단계)</h3><span class="small">남쪽 끝 앵커 하나를 기준으로 태그를 중심선의 ' + sp.rangeMarks.filter(d => d < sp.l - 0.3).join(' · ') + ' m 표시에 차례로 두고 BLE·Wi-Fi RSSI와 수신율을 기록한다. 바닥의 주황 표시가 측정점이다.</span></div>';
    h += '<div class="blk" id="tag-info"></div>';
    $('space-side').innerHTML = h;
    $('csv-copy').onclick = () => { const t = csvText(); navigator.clipboard && navigator.clipboard.writeText(t).then(() => { $('csv-copy').textContent = '복사됨'; setTimeout(() => { $('csv-copy').textContent = 'anchors.csv 복사'; }, 1400); }); };
    $('csv-save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csvText()], { type: 'text/csv' })); a.download = 'anchors_' + st.space + '.csv'; a.click(); };
    renderTagInfo();
  }
  const csvText = () => 'id,x,y,z\n' + cur.anchors.map(a => [a.id, f2(a.x), f2(a.y), a.z.toFixed(2)].join(',')).join('\n') + '\n';
  function renderTagInfo() {
    const el = $('tag-info'); if (!el || !st.tag || !st.tag.links) return;
    const t = st.tag, name = { los: 'LOS', edge: '경계', block: '가림' };
    el.innerHTML = '<h3>태그 위치 (' + f2(t.x) + ', ' + f2(t.y) + ')</h3><div class="chips">' +
      t.links.map(l => '<span class="chip ' + l.s + '">A' + l.id + ' ' + name[l.s] + ' · ' + f2(l.d) + ' m</span>').join('') + '</div>' +
      '<span class="small">이 지점 HDOP: <b>' + (t.hdop ? f2(t.hdop) : '측위 불가 (LOS ' + t.n + '대)') + '</b>. 바닥을 누르면 태그가 옮겨진다.</span>';
  }

  // ---------------- 조작 ----------------
  function setSpace(id) {
    st.space = id;
    document.querySelectorAll('#space-tabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.id === id ? 'true' : 'false'));
    const d = st.dims[id]; $('dim-w').value = d.w; $('dim-l').value = d.l; $('dim-h').value = d.h;
    if (!st.results[id]) { busy(true); setTimeout(() => { solve(id); busy(false); buildSpace(); }, 30); }
    else buildSpace();
  }
  const busy = on => $('busy').classList.toggle('on', on);
  $('space-tabs').innerHTML = Object.keys(E.SPACES).map(k => '<button type="button" class="tab" role="tab" data-id="' + k + '">' + esc(E.SPACES[k].name) + '</button>').join('');
  $('space-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setSpace(b.dataset.id); });
  $('resolve').addEventListener('click', () => {
    const d = { w: +$('dim-w').value, l: +$('dim-l').value, h: +$('dim-h').value };
    if (!(d.w >= 2 && d.l >= 2 && d.h >= 2.4)) return;
    const sp = E.SPACES[st.space];
    if (d.h < Math.max.apply(null, sp.heights) + 0.15) d.h = Math.max.apply(null, sp.heights) + 0.15;
    st.dims[st.space] = d; busy(true); framedFor = '';
    setTimeout(() => { solve(st.space, true); busy(false); buildSpace(); }, 30);
  });
  [['layout', 'layout'], ['overlay', 'overlay'], ['tagz', 'tagz']].forEach(([id, key]) => $(id).addEventListener('change', e => { st[key] = e.target.value; buildSpace(); }));
  $('session').addEventListener('change', e => { st.session = +e.target.value; buildSpace(); });
  $('show-24').addEventListener('change', e => { st.show24 = e.target.checked; buildSpace(); });
  $('show-measure').addEventListener('change', e => { st.measure = e.target.checked; buildSpace(); });

  // 바닥 누르기 → 태그 이동, 마우스 올리기 → 값 표시
  const cv = sv.renderer.domElement;
  let down = null;
  cv.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    sv.setNdc(e);
    const hp = sv.ray.intersectObjects(picks, true)[0];
    if (hp && hp.object.userData.pick) return;                                   // 장치·장애물 위는 태그를 두지 않는다
    const hit = floorMesh && sv.ray.intersectObject(floorMesh)[0];
    if (!hit) return;
    const sp = cur.r.space, x = hit.point.x, y = -hit.point.z;
    if (x < 0.1 || y < 0.1 || x > sp.w - 0.1 || y > sp.l - 0.1) return;
    st.tag = { space: st.space, x, y }; buildTag();
  });
  cv.addEventListener('pointermove', e => {
    if (e.buttons) { sv.hideTip(); return; }
    sv.setNdc(e);
    const hp = sv.ray.intersectObjects(picks, true)[0];
    if (hp) {
      const k = hp.object.userData.pick;
      if (k.kind === 'anchor') { const a = k.a; sv.showTip(e, '<b>A' + a.id + '</b> 앵커 노드<br>안테나 중심 (' + f2(a.x) + ', ' + f2(a.y) + ', ' + a.z.toFixed(2) + ')<br>' + ({ S: '남', E: '동', N: '북', W: '서' }[a.wall]) + '쪽 벽' + (a.corner ? ' 모서리' : '') + ', 벽에서 7 cm'); return; }
      if (k.kind === 'obstacle') { sv.showTip(e, '<b>' + esc(k.o.name) + '</b><br>' + (k.o.hx * 2).toFixed(1) + ' × ' + (k.o.hy * 2).toFixed(1) + ' m, 높이 ' + k.o.z1.toFixed(1) + ' m'); return; }
      if (k.kind === 'router') { sv.showTip(e, '<b>공유기</b> · 데이터 전송 + RSSI 기준점<br>2.4 GHz 채널 고정, 받침대 1.0 m'); return; }
      if (k.kind === 'camera') { sv.showTip(e, '<b>GT 카메라</b> · 라즈베리파이 4 + Camera Module 3 Wide<br>높이 ' + k.cm.pos[2].toFixed(2) + ' m'); return; }
    }
    const hit = floorMesh && sv.ray.intersectObject(floorMesh)[0];
    if (!hit || !heat) { sv.hideTip(); return; }
    const g = cur.pre.grid, sp = cur.r.space, m = sp.margin;
    const i = Math.round((hit.point.x - m) / ((sp.w - 2 * m) / g.nx)), j = Math.round((-hit.point.z - m) / ((sp.l - 2 * m) / g.ny));
    const c = heat.val.get(i + ',' + j);
    if (!c) { sv.hideTip(); return; }
    const hdop = cur.res.hdop[c.k], wst = cur.res.worst[c.k], n = cur.res.count[c.k];
    sv.showTip(e, '(' + f2(c.p.x) + ', ' + f2(c.p.y) + ') m<br>HDOP 6대 <b>' + (hdop >= O.CAP ? '측위 불가' : f2(hdop)) + '</b><br>1대 빠질 때 최악 ' + (wst >= O.CAP ? '측위 불가' : f2(wst)) + '<br>LOS 앵커 ' + n + '대');
  });
  cv.addEventListener('pointerleave', () => sv.hideTip());

  // ---------------- 노드 상세 3D ----------------
  const nv = createView($('node-view'), { fov: 32, near: 0.005, far: 20 });
  const nodeG = new THREE.Group(); nv.scene.add(nodeG);
  let nodeObj = null, wallObj = null;
  const PARTS_INFO = {
    anchor: [
      ['DWM3000EVB', '68.6 × 53.3 mm (Uno 쉴드)', 'UWB 거리 측정. J1 점퍼 2–3, D0–D6 비움'],
      ['ESP32-S3-DevKitC-1 N16R8', '70 × 28 mm (근사)', 'UWB 제어, Wi-Fi AP·BLE 광고'],
      ['점퍼선 암-암 9가닥', '10 cm (3V3는 빠듯하면 20 cm)', 'SPI 4 · IRQ · RST · WAKE · 3V3 · GND'],
      ['보조배터리', '147.8 × 73.9 × 15.4 mm, 약 225 g (근사)', '샤오미 PLM13ZM, 저전류 모드'],
      ['USB A→C 케이블', '20–30 cm', '배터리 USB-A → ESP32 COM 포트'],
      ['폼보드', '210 × 297 × 5 mm (A4)', '노드 한 대에 1장'],
      ['스티로폼 스페이서 2개', '180 × 35 × 41 mm', '벽 → 안테나 중심 70 mm'],
      ['벨크로 · 탈착식 양면테이프', '—', '배터리는 벨크로, 스페이서는 벽에 테이프']
    ],
    aux: [
      ['ESP32-S3-DevKitC-1 N16R8', '70 × 28 mm (근사)', 'Wi-Fi AP·BLE 광고만 (UWB 없음). 모듈 안테나를 위로'],
      ['보조배터리', '147.8 × 73.9 × 15.4 mm (근사)', '앵커와 같은 모델'],
      ['USB A→C 케이블', '20–30 cm', ''],
      ['폼보드 · 스페이서 · 테이프', '앵커와 같음', '세션마다 S1 → S2 → S3로 옮긴다']
    ]
  };
  function buildNodeView() {
    clearGroup(nodeG); nv.clearLabels(); nv.background();
    nodeObj = S.buildNode(st.node, { detail: true, wires: true });
    nodeObj.scale.setScalar(0.001); nodeG.add(nodeObj);
    if ($('node-wall').checked) {
      wallObj = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), mat(C('--wall'), { transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
      wallObj.position.set(0, 0, -0.0005); nodeG.add(wallObj);
    }
    const a = nodeObj.userData.antenna, s = 0.001;
    const L = (t, p, cls) => nv.label(t, new THREE.Vector3(p[0] * s, p[1] * s, p[2] * s), cls || 'part');
    if ($('node-labels').checked) {
      L('안테나 중심 · 벽에서 ' + Math.round(a[2]) + ' mm', [a[0] - 60, a[1] + 34, a[2] + 4], 'part anchor');
      if (st.node === 'anchor') { L('DWM3000EVB', [62, 104, 70]); L('ESP32-S3', [-50, 30, 72]); L('점퍼 9가닥 (보드 아래)', [30, 76, 50]); }
      else L('ESP32-S3 (안테나 위)', [24, 70, 70]);
      L('보조배터리', [40, -85, 64]); L('USB A→C', [-104, -20, 54]); L('폼보드', [80, -140, 47]); L('스페이서 41 mm', [95, 110, 20]);
    }
    renderNodeSide();
    nodeCam(nodeCamMode);
  }
  let nodeCamMode = 'angle';
  function nodeCam(mode) {
    nodeCamMode = mode;
    nv.controls.target.set(0, 0.0, 0.035);
    const p = { front: [0, 0, 0.92], side: [0.82, 0.04, 0.12], angle: [0.48, 0.2, 0.7] }[mode];
    nv.camera.position.set(p[0], p[1], p[2]); nv.controls.update();
    document.querySelectorAll('#node-cams button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cam === mode ? 'true' : 'false'));
  }
  function renderNodeSide() {
    const rows = PARTS_INFO[st.node];
    let h = '<div class="blk"><h3>' + (st.node === 'anchor' ? '앵커 노드 (6대 모두 같음)' : '보조 Wi-Fi 노드') + '</h3><table><thead><tr><th>부품</th><th>치수</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td class="t"><b>' + esc(r[0]) + '</b>' + (r[2] ? '<br><span class="small">' + esc(r[2]) + '</span>' : '') + '</td><td class="t">' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table></div>';
    if (st.node === 'anchor') {
      const ev = S.BENCH.bench.evaluate(S.BENCH.setups.anchor, { esp: { x: -9, y: 53, rot: 0 }, dwm: { x: 9, y: 97, rot: 180 } }, 100);
      h += '<div class="blk"><h3>점퍼 길이 (10 cm 점퍼 기준)</h3><table><thead><tr><th>선</th><th>필요</th><th>판정</th></tr></thead><tbody>' +
        ev.wires.map(w => '<tr><td>' + esc(w.sig) + '</td><td>' + (w.need / 10).toFixed(1) + ' cm</td><td class="' + (w.status === 'ok' ? 'good' : w.status === 'over' ? 'bad' : '') + '">' + ({ ok: '여유', tight: '빠듯', over: '부족' }[w.status]) + '</td></tr>').join('') +
        '</tbody></table><span class="small">커넥터와 꺾임 여유를 포함한 길이다. 배선 조립(3절)의 앵커 기본 배치와 같다. 3V3 선이 빠듯하면 예비 20 cm 점퍼를 쓴다.</span></div>';
    }
    h += '<div class="blk"><h3>무게 (추정)</h3><span class="small">배터리 약 225 g + 보드·선 약 30 g + 폼보드·스페이서 약 25 g ≈ <b>0.28 kg</b>. 탈착식 테이프는 하중 표기 합이 1 kg 이상이 되게 여러 장 쓴다.</span></div>';
    $('node-side').innerHTML = h;
  }
  function renderNodeCards() {
    $('node-cards').innerHTML =
      '<div class="card"><h3>조립 순서</h3><ol class="steps">' +
      '<li>ESP32·DWM3000EVB 아래 핀에 점퍼 9가닥을 먼저 꽂는다 (J1 점퍼 2–3 확인, D0–D6 비움).</li>' +
      '<li>폼보드 위쪽에 DWM3000EVB, 그 아래에 ESP32를 배선 조립의 기본 배치대로 놓는다. DWM은 고정 구멍 4곳을 21 mm 지지대로, ESP32는 양면 폼테이프로 붙인다.</li>' +
      '<li>아래쪽에 벨크로로 보조배터리를 붙이고, USB A→C 케이블을 판 왼쪽 가장자리를 따라 ESP32 COM 포트에 꽂는다.</li>' +
      '<li>판 뒤에 스페이서 2개를 붙인다. 벽에서 안테나 중심까지 70 mm인지 줄자로 확인한다.</li>' +
      '<li>안테나 중심에 작은 스티커를 붙여 좌표 측정 기준점으로 쓴다.</li></ol></div>' +
      '<div class="card"><h3>설치 순서 (벽)</h3><ol class="steps">' +
      '<li>1절의 앵커 좌표대로 벽에 연필로 안테나 중심 위치를 표시한다.</li>' +
      '<li>스페이서 뒤 탈착식 테이프로 노드를 붙인다. 6대 모두 같은 방향(DWM 위, 배터리 아래).</li>' +
      '<li>안테나 중심에서 추를 단 실을 내려 바닥에 점을 찍고, 원점 모서리에서 두 벽까지 거리(x, y)와 높이(z)를 줄자로 잰다.</li>' +
      '<li>마주 보는 앵커 사이 대각선을 따로 재어 계산값과 1–2 cm 안으로 맞는지 확인한다.</li>' +
      '<li>잰 좌표를 anchors.csv로 저장한다.</li></ol></div>' +
      '<div class="card"><h3>안테나를 가리지 않는 이유</h3><ul>' +
      '<li>UWB 안테나 위·앞에 금속(배터리, 보드 접지면)이 있으면 안테나 특성과 지연이 바뀌어 앵커마다 거리 오차가 달라진다.</li>' +
      '<li>ESP32 PCB 안테나가 가려지면 측정하려는 Wi-Fi·BLE RSSI 자체가 바뀐다.</li>' +
      '<li>그래서 위에서부터 UWB → ESP32 → 배터리 순서로, 판 위쪽 3 cm는 비워 둔다.</li></ul></div>';
  }
  $('node-tabs').innerHTML = '<button type="button" class="tab" role="tab" data-id="anchor">앵커 노드</button><button type="button" class="tab" role="tab" data-id="aux">보조 Wi-Fi 노드</button>';
  const setNode = id => { st.node = id; document.querySelectorAll('#node-tabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.id === id ? 'true' : 'false')); buildNodeView(); };
  $('node-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) setNode(b.dataset.id); });
  $('node-cams').addEventListener('click', e => { const b = e.target.closest('button'); if (b) nodeCam(b.dataset.cam); });
  $('node-labels').addEventListener('change', buildNodeView);
  $('node-wall').addEventListener('change', buildNodeView);
  const ncv = nv.renderer.domElement;
  ncv.addEventListener('pointermove', e => {
    if (e.buttons || !nodeObj) { nv.hideTip(); return; }
    nv.setNdc(e);
    const hit = nv.ray.intersectObject(nodeObj, true).find(h => h.object.userData.part);
    if (hit) nv.showTip(e, esc(hit.object.userData.part)); else nv.hideTip();
  });
  ncv.addEventListener('pointerleave', () => nv.hideTip());

  // 테마 바뀜
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { buildSpace(); buildNodeView(); });

  // 시작
  setSpace(st.space);
  setNode(st.node);
  renderNodeCards();
  S.envApp = { st, solve, current };
})(window.SIM);
