// Three.js 3D 뷰. 시뮬레이션 좌표 (x 동, y 북, z 위) → three.js (x, z, -y)
(function (S) {
  const G = S.geom;
  const V = (x, y, z) => new THREE.Vector3(x, z, -y);
  const UP = new THREE.Vector3(0, 1, 0);
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888888';
  const C = n => new THREE.Color(tok(n));
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.05 }, o || {}));
  const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  function cylBetween(a, b, r, m) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), m);
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    return mesh;
  }
  const tmpV = new THREE.Vector3();
  function setBeam(m, a, b, r) {
    const d = tmpV.subVectors(b, a), L = d.length() || 1e-6;
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.divideScalar(L));
    m.scale.set(r, L, r);
  }
  function clearGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
    while (g.children.length) g.remove(g.children[0]);
  }
  function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

  // ---- 부품 모델 ----
  function makeTripod(h) {
    const g = new THREE.Group(), m = mat(C('--metal'), { metalness: 0.4, roughness: 0.5 });
    const hub = new THREE.Vector3(0, h * 0.55, 0);
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3 + 0.3;
      g.add(cylBetween(hub, new THREE.Vector3(0.3 * Math.cos(a), 0, 0.3 * Math.sin(a)), 0.01, m));
    }
    g.add(cylBetween(hub, new THREE.Vector3(0, h - 0.05, 0), 0.013, m));
    return g;
  }
  function makeCart() {
    const g = new THREE.Group(), m = mat(C('--metal'), { metalness: 0.3, roughness: 0.6 }), dark = mat(C('--board'));
    [0.8, 0.25].forEach(y => { const t = box(0.7, 0.03, 0.45, mat(C('--cable'))); t.position.y = y; g.add(t); });
    [[0.33, 0.2], [0.33, -0.2], [-0.33, 0.2], [-0.33, -0.2]].forEach(([x, z]) => {
      g.add(cylBetween(new THREE.Vector3(x, 0.08, z), new THREE.Vector3(x, 0.8, z), 0.012, m));
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), dark);
      w.rotation.x = Math.PI / 2; w.position.set(x, 0.05, z); g.add(w);
    });
    g.add(cylBetween(new THREE.Vector3(-0.35, 0.8, 0.2), new THREE.Vector3(-0.42, 1.0, 0.2), 0.012, m));
    g.add(cylBetween(new THREE.Vector3(-0.35, 0.8, -0.2), new THREE.Vector3(-0.42, 1.0, -0.2), 0.012, m));
    g.add(cylBetween(new THREE.Vector3(-0.42, 1.0, 0.22), new THREE.Vector3(-0.42, 1.0, -0.22), 0.014, m));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1, 8), m);
    g.add(mast); g.userData.mast = mast;
    return g;
  }
  function makePerson() {
    const g = new THREE.Group(), m = mat(C('--person'), { roughness: 0.9 });
    [-0.1, 0.1].forEach(z => { const l = box(0.13, 0.8, 0.13, m); l.position.set(0, 0.4, z); g.add(l); });
    const torso = box(0.24, 0.62, 0.42, m); torso.position.y = 1.12; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), m); head.position.y = 1.6; g.add(head);
    const arms = [];
    [-0.27, 0.27].forEach(z => {
      const pivot = new THREE.Group(); pivot.position.set(0, 1.38, z);
      const arm = box(0.09, 0.56, 0.09, m); arm.position.y = -0.28; pivot.add(arm);
      g.add(pivot); arms.push(pivot);
    });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C('--tape'), { roughness: 0.4 }));
    helmet.position.y = 1.6; g.add(helmet);
    g.userData = { arms, helmet };
    return g;
  }
  function makePhantom() {
    const g = new THREE.Group(), P = S.PHANTOM;
    const m = mat(C('--phantom'), { transparent: true, opacity: 0.72, roughness: 0.25 });
    const lh = P.h / P.layers;
    for (let k = 0; k < P.layers; k++) {
      [-0.105, 0, 0.105].forEach(x => [-0.052, 0.052].forEach(z => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, lh - 0.02, 14), m);
        b.position.set(x, k * lh + lh / 2, z); g.add(b);
      }));
    }
    const shell = box(P.hx * 2, P.h, P.hy * 2, basic(C('--phantom'), { transparent: true, opacity: 0.08, depthWrite: false }));
    shell.position.y = P.h / 2; g.add(shell);
    shell.userData.pick = { kind: 'phantom' };
    g.userData.shell = shell;
    return g;
  }

  S.createView = function (host, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    const layer = document.createElement('div'); layer.className = 'labels'; host.appendChild(layer);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 200);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 0.3; controls.maxDistance = 60;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556660, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(4, 9, 6); scene.add(sun);
    const envG = new THREE.Group(), dynG = new THREE.Group(); scene.add(envG); scene.add(dynG);
    const view = { host, env: null };
    let labels = [], picks = [], anchorPos = [], rings = [], routerPos = null, dyn = null;

    // ---- 화면 위 이름표 ----
    function label(text, pos, cls, group) {
      const el = document.createElement('div');
      el.className = 'lbl ' + (cls || ''); el.textContent = text; layer.appendChild(el);
      const L = { el, pos, group, mid: /plain|pt/.test(cls || '') };
      labels.push(L); return L;
    }
    function clearLabels(group) {
      labels = labels.filter(L => { if (L.group === group) { L.el.remove(); return false; } return true; });
    }
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
    function pickable(o, info, group) { o.userData.pick = info; o.userData.group = group; picks.push(o); }

    // ---- 환경 (방, 앵커, 카메라, 공유기) ----
    view.setEnv = function (env, o) {
      o = o || {};
      clearGroup(envG); clearLabels('env');
      picks = picks.filter(p => p.userData.group !== 'env');
      view.env = env; anchorPos = []; rings = []; routerPos = null;
      const R = env.room;
      scene.background = C('--scene');

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.l), mat(C('--floor'), { roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.copy(V(R.w / 2, R.l / 2, 0)); envG.add(floor);
      const gp = [];
      for (let x = 0; x <= R.w + 1e-6; x += 0.5) gp.push(V(x, 0, 0.002), V(x, R.l, 0.002));
      for (let y = 0; y <= R.l + 1e-6; y += 0.5) gp.push(V(0, y, 0.002), V(R.w, y, 0.002));
      envG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp), new THREE.LineBasicMaterial({ color: C('--grid') })));
      const wallM = basic(C('--wall'), { transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
      [[R.w / 2, 0, R.w, 0], [R.w / 2, R.l, R.w, 0], [0, R.l / 2, R.l, Math.PI / 2], [R.w, R.l / 2, R.l, Math.PI / 2]].forEach(q => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(q[2], R.h), wallM);
        m.position.copy(V(q[0], q[1], R.h / 2)); m.rotation.y = q[3]; envG.add(m);
      });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(R.w, R.h, R.l)), new THREE.LineBasicMaterial({ color: C('--wall') }));
      edges.position.copy(V(R.w / 2, R.l / 2, R.h / 2)); envG.add(edges);
      label(R.w.toFixed(2) + ' m', V(R.w / 2, -0.12, 0), 'plain', 'env');
      label(R.l.toFixed(2) + ' m', V(R.w + 0.18, R.l / 2, 0), 'plain', 'env');
      label('천장 ' + R.h.toFixed(2) + ' m', V(R.w, 0, R.h), 'plain', 'env');

      if (!env.corridor) {
        const x0 = R.w / 2 - 0.45, x1 = R.w / 2 + 0.45;
        const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), basic(C('--wall'), { transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
        door.position.copy(V(R.w / 2, -0.002, 1.0)); envG.add(door);
        envG.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(x0, 0, 0), V(x0, 0, 2), V(x1, 0, 2), V(x1, 0, 0)]), new THREE.LineBasicMaterial({ color: C('--wall') })));
        label('문', V(R.w / 2, 0, 2.08), 'plain', 'env');
      }

      if (env.desk) {
        // 노트북은 방 밖 책상, 공유기는 방 안 받침대(앵커와 다른 위치, RSSI 기준점 겸용)
        const dx = R.w / 2 + 1.0, dy = -0.85, dm = mat(C('--cable'));
        const top = box(1.0, 0.04, 0.55, dm); top.position.copy(V(dx, dy, 0.72)); envG.add(top);
        [[-0.46, -0.24], [0.46, -0.24], [-0.46, 0.24], [0.46, 0.24]].forEach(q => envG.add(cylBetween(V(dx + q[0], dy + q[1], 0), V(dx + q[0], dy + q[1], 0.7), 0.015, mat(C('--metal')))));
        const lap = box(0.32, 0.02, 0.22, mat(C('--board'))); lap.position.copy(V(dx, dy, 0.75)); envG.add(lap);
        const scr = box(0.32, 0.21, 0.01, mat(C('--board'))); scr.position.copy(V(dx, dy - 0.11, 0.86)); scr.rotation.x = -0.25; envG.add(scr);
        pickable(top, { kind: 'desk' }, 'env');
        label('노트북 (방 밖)', V(dx, dy, 1.0), '', 'env');
        const r = env.router || { x: dx + 0.25, y: dy };
        const stand = box(0.35, 0.9, 0.3, mat(C('--spacer'))); stand.position.copy(V(r.x, r.y, 0.45)); envG.add(stand);
        const rt = box(0.2, 0.035, 0.13, mat(C('--board'))); rt.position.copy(V(r.x, r.y, 0.92)); envG.add(rt);
        [-0.06, 0, 0.06].forEach(k => envG.add(cylBetween(V(r.x + k, r.y + 0.05, 0.94), V(r.x + k, r.y + 0.06, 1.1), 0.006, mat(C('--board')))));
        routerPos = V(r.x, r.y, 0.95);
        pickable(rt, { kind: 'router' }, 'env');
        label('공유기', V(r.x, r.y, 1.18), '', 'env');
      }

      // 고정 장애물 (공간 B)
      (env.obstacles || []).forEach(o => {
        const steel = mat(C('--metal'), { metalness: 0.5, roughness: 0.5 }), H = o.z1, g = new THREE.Group();
        const x0 = o.x - o.hx, x1 = o.x + o.hx, y0 = o.y - o.hy, y1 = o.y + o.hy;
        if (o.kind === 'shelf') {
          [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(q => g.add(cylBetween(V(q[0], q[1], 0), V(q[0], q[1], H), 0.02, steel)));
          for (let k = 0; k < 5; k++) { const b = box(o.hx * 2, 0.025, o.hy * 2, steel); b.position.copy(V(o.x, o.y, 0.08 + k * (H - 0.12) / 4)); g.add(b); }
          for (let k = 0; k < 4; k++) [[0.5, 0.18], [-0.5, 0.25], [0.1, 0.3]].forEach(q => { const b = box(o.hx * 1.6, q[1], 0.35, mat('#8a6f4d')); b.position.copy(V(o.x, o.y + q[0] * o.hy * 1.5, 0.105 + k * (H - 0.12) / 4 + q[1] / 2)); g.add(b); });
        } else if (o.kind === 'bench') {
          const t = box(o.hx * 2, 0.04, o.hy * 2, mat('#b08d62')); t.position.copy(V(o.x, o.y, H - 0.02)); g.add(t);
          [[x0 + 0.05, y0 + 0.05], [x1 - 0.05, y0 + 0.05], [x1 - 0.05, y1 - 0.05], [x0 + 0.05, y1 - 0.05]].forEach(q => g.add(cylBetween(V(q[0], q[1], 0), V(q[0], q[1], H - 0.04), 0.025, steel)));
        } else {
          const b = box(o.hx * 2, H, o.hy * 2, o.kind === 'rack' ? mat('#3b4246', { metalness: 0.4 }) : steel); b.position.copy(V(o.x, o.y, H / 2)); g.add(b);
        }
        const hit = box(o.hx * 2, H, o.hy * 2, basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false })); hit.position.copy(V(o.x, o.y, H / 2)); g.add(hit);
        pickable(hit, { kind: 'obstacle' }, 'env');
        envG.add(g);
        label(o.name, V(o.x, o.y, H + 0.06), 'plain', 'env');
      });

      // 앵커
      const ringM = basic(C('--radio'), { transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
      env.anchors.forEach(a => {
        const g = new THREE.Group();
        g.position.copy(V(a.x, a.y, a.z)); g.rotation.y = Math.atan2(a.nx, -a.ny);
        if (!a.stand) {
          const sp = box(0.05, 0.08, S.STANDOFF - 0.012, mat(C('--spacer')));
          sp.position.z = -(S.STANDOFF + 0.012) / 2; g.add(sp);
        }
        const esp = box(0.026, 0.063, 0.004, mat(C('--board'))); esp.position.set(-0.03, -0.01, -0.008); g.add(esp);
        const sh = box(0.054, 0.069, 0.004, mat(C('--board'))); sh.position.set(0.015, 0, 0); g.add(sh);
        const mod = box(0.023, 0.013, 0.004, mat(C('--metal'), { metalness: 0.6 })); mod.position.set(0.015, 0.025, 0.004); g.add(mod);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), basic(C('--accent'))); dot.position.set(0.015, 0.025, 0.012); g.add(dot);
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), basic(C('--accent'), { transparent: true, opacity: 0.22, depthWrite: false }));
        halo.position.copy(dot.position); g.add(halo);
        pickable(halo, { kind: 'anchor', id: a.id }, 'env');
        envG.add(g);
        const ap = V(a.x, a.y, a.z); anchorPos.push(ap);
        if (a.stand) envG.add((() => { const t = makeTripod(a.z); t.position.copy(V(a.x, a.y, 0)); return t; })());
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 36), ringM.clone());
        ring.rotation.x = -Math.PI / 2; ring.position.copy(ap); ring.visible = false; envG.add(ring); rings.push(ring);
        label('A' + a.id + ' · ' + a.z.toFixed(1) + ' m', V(a.x, a.y, a.z + 0.1), 'anchor', 'env');
      });

      // 보조 Wi-Fi 노드 (S1, UWB 없음)
      if (env.aux) {
        const a = env.aux, g = new THREE.Group();
        g.position.copy(V(a.x, a.y, a.z)); g.rotation.y = Math.atan2(a.nx, -a.ny);
        const sp = box(0.05, 0.08, S.STANDOFF - 0.012, mat(C('--spacer'))); sp.position.z = -(S.STANDOFF + 0.012) / 2; g.add(sp);
        const esp = box(0.026, 0.07, 0.004, mat(C('--board'))); g.add(esp);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), basic(C('--radio'))); dot.position.set(0, 0.03, 0.008); g.add(dot);
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), basic(C('--radio'), { transparent: true, opacity: 0.2, depthWrite: false })); halo.position.copy(dot.position); g.add(halo);
        pickable(halo, { kind: 'aux' }, 'env');
        envG.add(g);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 36), ringM.clone());
        ring.rotation.x = -Math.PI / 2; ring.position.copy(V(a.x, a.y, a.z)); ring.visible = false; envG.add(ring); rings.push(ring);
        label('S1 보조 노드', V(a.x, a.y, a.z + 0.1), '', 'env');
      }

      // GT 카메라와 화각 (공간 B는 2대)
      (env.cameras || (env.camera ? [env.camera] : [])).forEach((c, ci, all) => {
        const g = new THREE.Group();
        g.position.copy(V(c.pos[0], c.pos[1], c.pos[2]));
        g.lookAt(V(c.tgt[0], c.tgt[1], c.tgt[2]));
        const pi = box(0.085, 0.056, 0.02, mat(C('--ok'))); pi.position.z = -0.02; g.add(pi);
        const cm = box(0.03, 0.03, 0.012, mat(C('--board'))); g.add(cm);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 12), mat(C('--metal'))); lens.rotation.x = Math.PI / 2; lens.position.z = 0.01; g.add(lens);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), basic(C('--ok'), { transparent: true, opacity: 0.12, depthWrite: false })); g.add(hit);
        pickable(hit, { kind: 'camera' }, 'env');
        envG.add(g);
        label('GT 카메라' + (all.length > 1 ? ' ' + (ci + 1) : '') + ' (Pi)', V(c.pos[0], c.pos[1], c.pos[2] + 0.1), '', 'env');
        if (o.showFov) {
          const h = o.fovH, poly = G.camCoverage(c, h, R);
          if (poly.length > 2) {
            const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
            const fm = new THREE.Mesh(new THREE.ShapeGeometry(shape), basic(C('--ok'), { transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
            fm.rotation.x = -Math.PI / 2; fm.position.y = h; envG.add(fm);
            envG.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(poly.map(p => V(p[0], p[1], h))), new THREE.LineBasicMaterial({ color: C('--ok') })));
          }
          const cp = V(c.pos[0], c.pos[1], c.pos[2]), fl = [];
          G.camCorners(c, h).forEach(q => fl.push(cp, V(q[0], q[1], q[2])));
          envG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fl), new THREE.LineBasicMaterial({ color: C('--ok'), transparent: true, opacity: 0.35 })));
        }
      });

      if (!o.keepCamera) view.frame();
    };

    view.frame = function () {
      const zoom = parseFloat(document.documentElement.dataset.zoom) || 1;       // 주소의 &zoom=
      const R = view.env.room, t = V(R.w / 2, R.l / 2, Math.min(1.0, R.h * 0.35)), d = (Math.max(R.w, R.l) * 1.2 + 2.4) / zoom;
      controls.target.copy(t);
      camera.position.set(t.x + d * 0.55, t.y + d * 0.72, t.z + d * 0.62);
      controls.update();
    };

    // ---- 테스트 물체 (태그, 거치대, 사람, 팬텀, 경로, 링크 선) ----
    view.setTest = function (run) {
      clearGroup(dynG); clearLabels('dyn');
      picks = picks.filter(p => p.userData.group !== 'dyn');
      const env = view.env, d = { tripods: {} };
      const tag = new THREE.Group();
      tag.add(box(0.07, 0.1, 0.045, mat(C('--tag'), { emissive: C('--tag'), emissiveIntensity: 0.35 })));
      const th = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), basic(C('--tag'), { transparent: true, opacity: 0.2, depthWrite: false }));
      tag.add(th); pickable(th, { kind: 'tag' }, 'dyn');
      dynG.add(tag); d.tag = tag;
      label('태그', () => tmpL.copy(tag.position).setY(tag.position.y + 0.12), 'tag', 'dyn');
      d.cart = makeCart(); dynG.add(d.cart);
      d.person = makePerson(); dynG.add(d.person);
      d.phantom = makePhantom(); dynG.add(d.phantom); pickable(d.phantom.userData.shell, { kind: 'phantom' }, 'dyn');
      d.tripodFor = h => {
        const k = h.toFixed(2);
        if (!d.tripods[k]) { d.tripods[k] = makeTripod(h); dynG.add(d.tripods[k]); }
        return d.tripods[k];
      };
      const tapeM = mat(C('--tape'), { roughness: 0.6 });
      if (run.loop) {
        for (let i = 1; i < run.loop.length; i++) {
          const a = run.loop[i - 1], b = run.loop[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const t = box(L + 0.05, 0.002, 0.05, tapeM);
          t.position.copy(V((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.003)); t.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
          dynG.add(t);
        }
        label('출발', V(run.loop[0][0], run.loop[0][1], 0.02), 'pt', 'dyn');
      }
      if (run.points && run.points.length > 1) {
        run.points.forEach((p, i) => {
          [Math.PI / 4, -Math.PI / 4].forEach(r => { const t = box(0.16, 0.002, 0.025, tapeM); t.position.copy(V(p[0], p[1], 0.003)); t.rotation.y = r; dynG.add(t); });
          const L = label(String(i + 1), V(p[0] + 0.12, p[1] - 0.12, 0.02), 'pt', 'dyn');
          const cams = env.cameras || (env.camera ? [env.camera] : []);
          if (cams.length && !cams.some(c => G.gtStatus(c, [p[0], p[1], run.tagH], env.obstacles || []) === 'ok')) L.el.style.color = tok('--block');
        });
      }
      const beam = new THREE.CylinderGeometry(1, 1, 1, 6);
      d.colors = { los: C('--ok'), edge: C('--edge'), block: C('--block') };
      d.links = env.anchors.map(() => { const m = new THREE.Mesh(beam, basic(C('--ok'), { transparent: true, opacity: 0.8, depthWrite: false })); dynG.add(m); return m; });
      d.wifi = new THREE.Mesh(beam, basic(C('--radio'), { transparent: true, opacity: 0.75, depthWrite: false })); dynG.add(d.wifi);
      if (run.distTo != null) d.dist = label('', () => tmpL.copy(tag.position).lerp(anchorPos[run.distTo], 0.5), 'plain', 'dyn');
      dyn = d;
    };
    const tmpL = new THREE.Vector3();

    view.applyState = function (st, status, now) {
      if (!dyn) return;
      const d = dyn, p = V(st.x, st.y, st.z), mount = st.seg.mount;
      d.tag.position.copy(p); d.tag.rotation.y = st.hd;
      Object.keys(d.tripods).forEach(k => { d.tripods[k].visible = false; });
      if (mount === 'tripod') { const t = d.tripodFor(st.z); t.visible = true; t.position.copy(V(st.x, st.y, 0)); }
      d.cart.visible = mount === 'cart';
      if (d.cart.visible) {
        d.cart.position.copy(V(st.x, st.y, 0)); d.cart.rotation.y = st.hd;
        const m = d.cart.userData.mast, h0 = 0.815, h1 = Math.max(st.z - 0.05, h0 + 0.01);
        m.position.set(0, (h0 + h1) / 2, 0); m.scale.set(1, h1 - h0, 1);
      }
      d.person.visible = !!st.person;
      if (st.person) {
        const q = st.person, u = d.person.userData;
        d.person.position.copy(V(q.x, q.y, 0)); d.person.rotation.y = q.hd;
        const swing = q.pose === 'walk' ? Math.sin(now * 6) * 0.35 : 0;
        u.arms[0].rotation.z = q.pose === 'push' ? 1.15 : 0.06 + swing;
        u.arms[1].rotation.z = q.pose === 'push' ? 1.15 : 0.06 - swing;
        u.helmet.visible = q.pose === 'walk';
      }
      d.phantom.visible = !!st.phantom;
      if (st.phantom) { d.phantom.position.copy(V(st.phantom.x, st.phantom.y, 0)); d.phantom.rotation.y = st.phantom.rot; }
      d.links.forEach((m, i) => {
        const s = status[i];
        setBeam(m, p, anchorPos[i], s === 'block' ? 0.007 : 0.0045);
        m.material.color.copy(d.colors[s]); m.material.opacity = s === 'los' ? 0.55 : 0.95;
      });
      d.wifi.visible = !!(st.seg.stream && routerPos);
      if (d.wifi.visible) setBeam(d.wifi, p, routerPos, st.seg.upload ? 0.012 : 0.004);
      rings.forEach((r, i) => {
        r.visible = !!st.seg.adv;
        if (r.visible) { const f = (now * 0.7 + i * 0.16) % 1; r.scale.setScalar(1 + f * 3.5); r.material.opacity = 0.45 * (1 - f); }
      });
      if (d.dist) d.dist.el.textContent = p.distanceTo(anchorPos[0]).toFixed(3) + ' m';
    };

    // ---- 클릭 ----
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let down = null;
    renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null;
      if (moved > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(picks.filter(shown), false);
      if (opts.onPick) opts.onPick(hits.length ? hits[0].object.userData.pick : null);
    });

    // ---- 크기·렌더 루프 ----
    function resize() {
      const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(host); resize();
    let visible = true, last = performance.now();
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!visible) return;
      if (opts.onFrame) opts.onFrame(dt, now / 1000);
      controls.update(); renderer.render(scene, camera); updateLabels();
    }
    requestAnimationFrame(tick);
    return view;
  };
})(window.SIM);
