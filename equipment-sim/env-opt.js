// 앵커 배치 최적화와 배치 품질 계산. three.js 없이 동작 (node에서도 실행 가능)
//
// 품질 지표: 태그 높이를 아는 2D 측위의 HDOP (거리 측정 오차가 위치 오차로 몇 배 커지는지).
//   H 행 = [(x - xi) / r, (y - yi) / r], r = 3D 거리. HDOP = sqrt(trace((HᵀH)⁻¹)).
//   직선이 장애물 상자를 지나는 링크(가림)는 빼고, 쓸 수 있는 앵커가 3대 미만이면 실패(CAP)로 둔다.
// 목적 함수 (작을수록 좋음):
//   J = 0.35·P95(6대) + 0.65·평균_k P95(앵커 k를 뺀 5대) + 12·(3대 미만 비율) + 4·(4대 미만 비율)
//   → 평소 정확도뿐 아니라 앵커 1대가 가려지거나 빠졌을 때(관측 부족)도 버티는 배치를 고른다.
(function (S) {
  const E = S.ENV, O = S.envOpt = {};
  const LAMBDA = 0.299792458 / 6.4896;   // UWB 채널 5 중심 6489.6 MHz
  const CAP = 20;
  O.CAP = CAP;

  // ---- 장애물 상자 ----
  const boxOf = o => ({ x: o.x, y: o.y, hx: o.hx, hy: o.hy, z0: o.z0, z1: o.z1, rot: o.rot || 0 });
  function toLocal(b, p) {
    const dx = p[0] - b.x, dy = p[1] - b.y, c = Math.cos(-b.rot), s = Math.sin(-b.rot);
    return [dx * c - dy * s, dx * s + dy * c, p[2] - (b.z0 + b.z1) / 2];
  }
  function segHits(b, p, q) {
    const a = toLocal(b, p), c = toLocal(b, q), h = [b.hx, b.hy, (b.z1 - b.z0) / 2];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 3; i++) {
      const d = c[i] - a[i];
      if (Math.abs(d) < 1e-12) { if (Math.abs(a[i]) > h[i]) return false; continue; }
      let ta = (-h[i] - a[i]) / d, tb = (h[i] - a[i]) / d;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    return true;
  }
  function pointDist(b, p) {
    const l = toLocal(b, p), h = [b.hx, b.hy, (b.z1 - b.z0) / 2];
    let s = 0;
    for (let i = 0; i < 3; i++) { const d = Math.max(Math.abs(l[i]) - h[i], 0); s += d * d; }
    return Math.sqrt(s);
  }
  O.segHits = segHits;
  // 링크 상태: block(직선이 상자를 지남) · edge(첫 번째 프레넬 영역 60 % 안에 상자) · los
  O.link = function (p, q, boxes) {
    if (!boxes.length) return 'los';
    for (const b of boxes) if (segHits(b, p, q)) return 'block';
    const D = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), N = 24;
    for (let i = 1; i < N; i++) {
      const t = i / N, pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      const r = Math.sqrt(LAMBDA * t * (1 - t) * D);
      for (const b of boxes) if (pointDist(b, pt) < 0.6 * r) return 'edge';
    }
    return 'los';
  };
  O.boxes = space => space.obstacles.map(boxOf);

  // ---- 벽 둘레: s = 남서 모서리에서 반시계 방향 거리 ----
  O.perimeter = space => 2 * (space.w + space.l);
  O.wallAt = function (space, s) {
    const W = space.w, L = space.l, P = 2 * (W + L);
    s = ((s % P) + P) % P;
    const eps = 1e-6;
    if (s <= W + eps) return { bx: s, by: 0, wall: 'S', nx: 0, ny: 1, corner: s < eps || s > W - eps };
    if (s <= W + L + eps) return { bx: W, by: s - W, wall: 'E', nx: -1, ny: 0, corner: s - W < eps || s - W > L - eps };
    if (s <= 2 * W + L + eps) return { bx: W - (s - W - L), by: L, wall: 'N', nx: 0, ny: -1, corner: s - W - L < eps || s - W - L > W - eps };
    return { bx: 0, by: L - (s - 2 * W - L), wall: 'W', nx: 1, ny: 0, corner: s - 2 * W - L < eps || s - 2 * W - L > L - eps };
  };
  // 벽 위치 → 안테나 중심. 모서리는 두 벽에서 각각 STANDOFF만큼 띄운다
  O.mountPoint = function (space, s, z) {
    const w = O.wallAt(space, s), d = E.STANDOFF;
    let x = w.bx + w.nx * d, y = w.by + w.ny * d;
    if (w.bx < 1e-6) x = Math.max(x, d);
    if (w.bx > space.w - 1e-6) x = Math.min(x, space.w - d);
    if (w.by < 1e-6) y = Math.max(y, d);
    if (w.by > space.l - 1e-6) y = Math.min(y, space.l - d);
    return { x, y, z, s, wall: w.wall, corner: w.corner, nx: w.nx, ny: w.ny, bx: w.bx, by: w.by };
  };

  // ---- 후보 위치와 평가 격자 ----
  O.candidates = function (space, step) {
    step = step || E.GRID_STEP;
    const P = O.perimeter(space), n = Math.round(P / step), out = [];
    for (let i = 0; i < n; i++) out.push(i * P / n);
    return out;
  };
  O.grid = function (space, tagZ, step) {
    step = step || E.GRID_STEP;
    const m = space.margin, pts = [];
    const nx = Math.max(1, Math.round((space.w - 2 * m) / step)), ny = Math.max(1, Math.round((space.l - 2 * m) / step));
    const boxes = O.boxes(space);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = m + i * (space.w - 2 * m) / nx, y = m + j * (space.l - 2 * m) / ny;
      const inside = boxes.some(b => { const l = toLocal(b, [x, y, 0]); return Math.abs(l[0]) < b.hx + 0.35 && Math.abs(l[1]) < b.hy + 0.35; });
      if (!inside) pts.push({ x, y, z: tagZ, i, j });
    }
    return { pts, nx, ny, step };
  };

  // 후보(위치 × 높이)마다 격자점에 대한 H 행과 링크 상태를 미리 계산
  O.precompute = function (space, tagZ, step, gridStep) {
    const cands = O.candidates(space, step), grid = O.grid(space, tagZ, gridStep || step), boxes = O.boxes(space);
    const H = space.heights, NP = grid.pts.length, C = [];
    cands.forEach((s, ci) => H.forEach((z, hi) => {
      const m = O.mountPoint(space, s, z), hx = new Float32Array(NP), hy = new Float32Array(NP), ok = new Uint8Array(NP), st = new Uint8Array(NP);
      grid.pts.forEach((p, k) => {
        const dx = p.x - m.x, dy = p.y - m.y, dz = p.z - m.z, r = Math.hypot(dx, dy, dz) || 1e-6;
        hx[k] = dx / r; hy[k] = dy / r;
        const L = O.link([m.x, m.y, m.z], [p.x, p.y, p.z], boxes);
        st[k] = L === 'los' ? 0 : L === 'edge' ? 1 : 2;
        ok[k] = st[k] < 2 ? 1 : 0;
      });
      C.push({ ci, hi, s, z, m, hx, hy, ok, st });
    }));
    return { space, tagZ, cands, grid, boxes, C, NH: H.length };
  };
  const cidx = (pre, sel) => sel.ci * pre.NH + sel.hi;

  function pct(arr, q) {
    const a = Float32Array.from(arr).sort();
    return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1) + 0.5))];
  }

  const hd = (a, b, c, n) => { if (n < 3) return CAP; const det = a * c - b * b; if (det < 1e-9) return CAP; return Math.min(CAP, Math.sqrt((a + c) / det)); };
  // 앵커 부분집합(비트마스크)별 격자 HDOP
  function hdopMask(cs, mask, NP, out) {
    out = out || new Float32Array(NP);
    for (let p = 0; p < NP; p++) {
      let a = 0, b = 0, c = 0, n = 0;
      for (let k = 0; k < cs.length; k++) if (mask & (1 << k)) {
        const q = cs[k]; if (!q.ok[p]) continue;
        const x = q.hx[p], y = q.hy[p]; a += x * x; b += x * y; c += y * y; n++;
      }
      out[p] = hd(a, b, c, n);
    }
    return out;
  }
  const combos = (K, m) => { const r = []; for (let s = 0; s < (1 << K); s++) { let c = 0; for (let k = 0; k < K; k++) if (s & (1 << k)) c++; if (c === m) r.push(s); } return r; };
  const C3 = {}, C5 = {};

  // 배치 sel = [{ci, hi}] 평가.
  //   all: 6대 전부 · rm: 1대씩 뺀 5대 (가림·고장) · s3: 3대만 남긴 20가지 (관측 부족 조건)
  //   J = 0.30·P95(6대) + 0.35·평균 P95(5대) + 0.35·평균 P95(3대) + 12·(3대 미만 비율) + 4·(4대 미만 비율)
  O.evaluate = function (pre, sel, detail) {
    const NP = pre.grid.pts.length, K = sel.length, cs = sel.map(a => pre.C[cidx(pre, a)]);
    const full = (1 << K) - 1, all = hdopMask(cs, full, NP);
    let c3 = 0, c4 = 0;
    const N = new Uint8Array(NP);
    for (let p = 0; p < NP; p++) { let n = 0; for (const q of cs) if (q.ok[p]) n++; N[p] = n; if (n >= 3) c3++; if (n >= 4) c4++; }
    const tmp = new Float32Array(NP), worst = detail ? new Float32Array(NP) : null;
    const rm = (C5[K] = C5[K] || combos(K, K - 1)).map(m => { hdopMask(cs, m, NP, tmp); if (worst) for (let p = 0; p < NP; p++) if (tmp[p] > worst[p]) worst[p] = tmp[p]; return pct(tmp, 0.95); });
    let s3 = [];
    if (K >= 4) s3 = (C3[K] = C3[K] || combos(K, 3)).map(m => { hdopMask(cs, m, NP, tmp); let ok = 0; for (let p = 0; p < NP; p++) if (tmp[p] < CAP) ok++; return { mask: m, p95: pct(tmp, 0.95), p50: pct(tmp, 0.5), cov: ok / NP }; });
    const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
    const p95 = pct(all, 0.95), p50 = pct(all, 0.5), rmMean = mean(rm), s3Mean = s3.length ? mean(s3.map(x => x.p95)) : 0;
    const cov3 = c3 / NP, cov4 = c4 / NP;
    const J = 0.30 * p95 + 0.35 * rmMean + 0.35 * s3Mean + 12 * (1 - cov3) + 4 * (1 - cov4);
    const out = { J, p50, p95, rm, rmMean, rmWorst: Math.max.apply(null, rm), s3, s3Mean, cov3, cov4,
      s3Good: s3.filter(x => x.p95 <= 3).length };
    if (detail) {
      out.hdop = all; out.worst = worst; out.count = N;
      let sum = 0; for (let p = 0; p < NP; p++) sum += all[p]; out.mean = sum / NP;
    }
    return out;
  };
  // 3대 조합 20가지를 표로 (앵커 번호 1부터)
  O.subsets3 = function (pre, sel) {
    const r = O.evaluate(pre, sel);
    return r.s3.map(x => ({ ids: [0, 1, 2, 3, 4, 5].filter(k => x.mask & (1 << k)).map(k => k + 1), p50: x.p50, p95: x.p95, cov: x.cov }))
      .sort((a, b) => a.p95 - b.p95);
  };
  O.hdopMask = (pre, sel, mask) => hdopMask(sel.map(a => pre.C[cidx(pre, a)]), mask, pre.grid.pts.length);

  // ---- 탐색 ----
  function sepOK(pre, sel, k, ci) {
    const m = pre.C[ci * pre.NH].m;
    for (let j = 0; j < sel.length; j++) {
      if (j === k) continue;
      const o = pre.C[sel[j].ci * pre.NH].m;
      if (sel[j].ci === ci || Math.hypot(o.x - m.x, o.y - m.y) < E.MIN_SEP) return false;
    }
    return true;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function spreadStart(pre, K, r) {
    const n = pre.cands.length, off = Math.floor(r() * n), sel = [];
    for (let k = 0; k < K; k++) {
      let ci = (off + Math.round(k * n / K + (r() - 0.5) * n / K * 0.6)) % n;
      let guard = 0;
      while (!sepOK(pre, sel, -1, ci) && guard++ < n) ci = (ci + 1) % n;
      sel.push({ ci, hi: 0 });
    }
    const order = sel.map((_, i) => i).sort(() => r() - 0.5);
    order.forEach((i, k) => { sel[i].hi = k % pre.NH; });
    return sel;
  }
  function localSearch(pre, sel, budget) {
    let best = O.evaluate(pre, sel), evals = 1, improved = true;
    const n = pre.cands.length, steps = [1, -1, 2, -2, 3, -3, 5, -5, 8, -8, 13, -13];
    while (improved && evals < budget) {
      improved = false;
      for (let k = 0; k < sel.length && evals < budget; k++) {
        for (const d of steps) {
          const ci = ((sel[k].ci + d) % n + n) % n;
          if (!sepOK(pre, sel, k, ci)) continue;
          const old = sel[k].ci; sel[k].ci = ci;
          const r = O.evaluate(pre, sel); evals++;
          if (r.J < best.J - 1e-6) { best = r; improved = true; } else sel[k].ci = old;
        }
        for (let j = 0; j < sel.length; j++) {
          if (sel[j].hi === sel[k].hi) continue;
          const t = sel[k].hi; sel[k].hi = sel[j].hi; sel[j].hi = t;
          const r = O.evaluate(pre, sel); evals++;
          if (r.J < best.J - 1e-6) { best = r; improved = true; } else { sel[j].hi = sel[k].hi; sel[k].hi = t; }
        }
      }
    }
    return { sel, res: best, evals };
  }
  // 반복 지역 탐색: 여러 출발점 + 앵커 2대를 흔들어 다시 탐색
  O.optimize = function (pre, opts) {
    opts = opts || {};
    const K = opts.K || 6, restarts = opts.restarts || 8, kicks = opts.kicks || 6, r = rng(opts.seed || 7);
    let best = null, total = 0;
    const starts = [];
    if (opts.start) starts.push(opts.start.map(a => Object.assign({}, a)));
    while (starts.length < restarts) starts.push(spreadStart(pre, K, r));
    for (const st of starts) {
      let cur = localSearch(pre, st, opts.budget || 1500); total += cur.evals;
      for (let t = 0; t < kicks; t++) {
        const trial = cur.sel.map(a => Object.assign({}, a)), n = pre.cands.length;
        for (let q = 0; q < 2; q++) {
          const k = Math.floor(r() * K);
          for (let g = 0; g < 20; g++) { const ci = Math.floor(r() * n); if (sepOK(pre, trial, k, ci)) { trial[k].ci = ci; break; } }
        }
        const nx = localSearch(pre, trial, opts.budget || 1500); total += nx.evals;
        if (nx.res.J < cur.res.J) cur = nx;
      }
      if (!best || cur.res.J < best.res.J) best = cur;
    }
    // 앵커 번호: 남서 모서리부터 반시계 방향
    best.sel.sort((a, b) => pre.cands[a.ci] - pre.cands[b.ci]);
    best.res = O.evaluate(pre, best.sel);
    best.evals = total;
    return best;
  };

  // 비교용 기본 배치: 모서리 4 + 긴 벽 가운데 2, 높이 번갈아
  O.baseline = function (pre) {
    const sp = pre.space, W = sp.w, L = sp.l, P = 2 * (W + L);
    const longX = L >= W;
    const want = longX ? [0, W, W + L / 2, W + L, 2 * W + L, 2 * W + L + L / 2]
                       : [0, W / 2, W, W + L, W + L + W / 2, 2 * W + L];
    return want.map((s, k) => {
      let bi = 0, bd = 1e9;
      pre.cands.forEach((c, i) => { const d = Math.min(Math.abs(c - s), P - Math.abs(c - s)); if (d < bd) { bd = d; bi = i; } });
      return { ci: bi, hi: k % pre.NH };
    });
  };

  // 선택 → 앵커 좌표 목록
  O.anchorsOf = (pre, sel) => sel.map((a, k) => Object.assign({ id: k + 1 }, pre.C[cidx(pre, a)].m));

  // ---- 보조 Wi-Fi 노드 후보 3곳, 공유기, GT 카메라 ----
  O.placeAux = function (pre, anchors, n) {
    n = n || 3;
    const sp = pre.space, z = sp.heights[0], pts = pre.grid.pts, boxes = pre.boxes, scored = [];
    pre.cands.forEach(s => {
      const m = O.mountPoint(sp, s, z);
      const dmin = Math.min.apply(null, anchors.map(a => Math.hypot(a.x - m.x, a.y - m.y)));
      if (dmin < 1.0) return;
      let los = 0;
      for (let k = 0; k < pts.length; k += 3) if (O.link([m.x, m.y, m.z], [pts[k].x, pts[k].y, pts[k].z], boxes) !== 'block') los++;
      scored.push({ m, score: dmin + 1.5 * los / Math.ceil(pts.length / 3), dmin });
    });
    scored.sort((a, b) => b.score - a.score);
    const out = [];
    for (const c of scored) {
      if (out.every(o => Math.hypot(o.x - c.m.x, o.y - c.m.y) >= 1.5)) out.push(Object.assign({ id: 'S' + (out.length + 1), dmin: c.dmin }, c.m));
      if (out.length >= n) break;
    }
    return out;
  };
  O.placeRouter = function (pre, anchors, aux) {
    const sp = pre.space, others = anchors.concat(aux);
    let best = null;
    pre.cands.forEach(s => {
      const m = O.mountPoint(sp, s, 1.0), w = O.wallAt(sp, s);
      if (w.corner) return;
      const dmin = Math.min.apply(null, others.map(a => Math.hypot(a.x - m.x, a.y - m.y)));
      if (!best || dmin > best.dmin) best = Object.assign({ dmin }, m);
    });
    if (best) { best.x = best.bx + best.nx * 0.2; best.y = best.by + best.ny * 0.2; }   // 벽 앞 받침대 위
    return best;
  };

  const DEG = Math.PI / 180;
  O.CAM = { hfov: 102 * DEG, vfov: 67 * DEG };     // Camera Module 3 Wide
  function camBasis(c) {
    const f = [c.tgt[0] - c.pos[0], c.tgt[1] - c.pos[1], c.tgt[2] - c.pos[2]], fl = Math.hypot(f[0], f[1], f[2]);
    f[0] /= fl; f[1] /= fl; f[2] /= fl;
    let r = [f[1], -f[0], 0]; const rl = Math.hypot(r[0], r[1]) || 1; r = [r[0] / rl, r[1] / rl, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { f, r, u };
  }
  O.camSees = function (c, p, boxes) {
    const B = camBasis(c), v = [p[0] - c.pos[0], p[1] - c.pos[1], p[2] - c.pos[2]];
    const z = v[0] * B.f[0] + v[1] * B.f[1] + v[2] * B.f[2];
    if (z <= 0) return false;
    const x = v[0] * B.r[0] + v[1] * B.r[1] + v[2] * B.r[2], y = v[0] * B.u[0] + v[1] * B.u[1] + v[2] * B.u[2];
    if (Math.abs(Math.atan2(x, z)) > O.CAM.hfov / 2 || Math.abs(Math.atan2(y, z)) > O.CAM.vfov / 2) return false;
    for (const b of boxes) if (segHits(b, c.pos, p)) return false;
    return true;
  };
  O.cameraAt = function (sp, corner, aimZ) {
    const zc = Math.min(sp.h - 0.15, 2.85), e = 0.08;
    const pos = [[e, e], [sp.w - e, e], [sp.w - e, sp.l - e], [e, sp.l - e]][corner];
    let tgt = [sp.w / 2, sp.l / 2, aimZ];
    if (sp.l / sp.w > 3) tgt = [sp.w / 2, corner < 2 ? Math.min(sp.l, 6) : sp.l - Math.min(sp.l, 6), aimZ];   // 긴 복도는 앞쪽 6 m를 본다
    return { corner, pos: [pos[0], pos[1], zc], tgt };
  };
  O.placeCameras = function (pre) {
    const sp = pre.space, pts = pre.grid.pts, boxes = pre.boxes;
    const cams = [0, 1, 2, 3].map(k => O.cameraAt(sp, k, pre.tagZ));
    const seen = cams.map(c => pts.map(p => O.camSees(c, [p.x, p.y, p.z], boxes)));
    const frac = v => v.filter(Boolean).length / pts.length;
    let best1 = 0;
    for (let k = 1; k < 4; k++) if (frac(seen[k]) > frac(seen[best1])) best1 = k;
    const one = { cams: [cams[best1]], cover: frac(seen[best1]) };
    let two = null;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const u = pts.map((_, i) => seen[a][i] || seen[b][i]), f = frac(u);
      if (!two || f > two.cover) two = { cams: [cams[a], cams[b]], cover: f };
    }
    return { one, two, seenBy: (cams2, i) => cams2.some(c => seen[c.corner][i]) };
  };

  // 공간 하나 전체 계산
  // 탐색은 0.5 m 격자로 빠르게 하고, 결과 보고는 0.25 m 격자로 다시 계산한다 (후보 위치는 같다)
  O.solve = function (space, opts) {
    opts = opts || {};
    const tagZ = opts.tagZ || E.TAG_Z.cart;
    const coarse = O.precompute(space, tagZ, E.GRID_STEP, opts.searchStep || 0.5);
    const pre = O.precompute(space, tagZ, E.GRID_STEP, E.GRID_STEP);
    const base = O.baseline(pre), baseRes = O.evaluate(pre, base);
    const opt = O.optimize(coarse, Object.assign({ start: base, restarts: 5, kicks: 4, budget: 900 }, opts));
    opt.res = O.evaluate(pre, opt.sel);
    const anchors = O.anchorsOf(pre, opt.sel), aux = O.placeAux(pre, anchors, 3), router = O.placeRouter(pre, anchors, aux);
    return { pre, base, baseRes, opt, anchors, baseAnchors: O.anchorsOf(pre, base), aux, router, cams: O.placeCameras(pre) };
  };
})(typeof window !== 'undefined' ? (window.SIM = window.SIM || {}) : module.exports);
