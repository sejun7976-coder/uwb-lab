// 순수 계산: 가림(LOS) 판정, 카메라 화각
(function (S) {
  const G = S.geom = {};
  const DEG = Math.PI / 180;
  const LAMBDA = 0.299792458 / 6.4896;   // UWB 채널 5 중심 6489.6 MHz → 약 4.6 cm

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => mul(a, 1 / (len(a) || 1));
  G.dist3 = (a, b) => len(sub(a, b));

  // ---- 앵커 ----
  G.anchors = function (room) {
    const s = S.STANDOFF;
    return S.ANCHOR_LAYOUT.map(a => {
      const bx = a.fx * room.w, by = a.fy * room.l;
      const ox = a.fx === 0 ? 1 : a.fx === 1 ? -1 : 0;
      const oy = a.fy === 0 ? 1 : a.fy === 1 ? -1 : 0;
      const n = Math.hypot(ox, oy);
      return { id: a.id, x: bx + ox * s, y: by + oy * s, z: a.z, bx, by, nx: ox / n, ny: oy / n };
    });
  };

  // ---- 회전한 상자 (z축 회전) : {x, y, z0, z1, hx, hy, rot} ----
  function toLocal(b, p) {
    const dx = p[0] - b.x, dy = p[1] - b.y, c = Math.cos(-b.rot), s = Math.sin(-b.rot);
    return [dx * c - dy * s, dx * s + dy * c, p[2] - (b.z0 + b.z1) / 2];
  }
  function half(b) { return [b.hx, b.hy, (b.z1 - b.z0) / 2]; }
  G.segHits = function (b, p, q) {
    const a = toLocal(b, p), c = toLocal(b, q), h = half(b);
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
  };
  G.pointDist = function (b, p) {
    const l = toLocal(b, p), h = half(b);
    let s = 0;
    for (let i = 0; i < 3; i++) { const d = Math.max(Math.abs(l[i]) - h[i], 0); s += d * d; }
    return Math.sqrt(s);
  };

  // 링크 판정: 직선이 상자를 지나면 block, 첫 번째 프레넬 영역 60 % 안에 상자가 있으면 edge
  G.link = function (p, q, boxes) {
    if (!boxes.length) return 'los';
    for (const b of boxes) if (G.segHits(b, p, q)) return 'block';
    const D = G.dist3(p, q), N = 40;
    for (let i = 1; i < N; i++) {
      const t = i / N, pt = add(p, mul(sub(q, p), t));
      const r = Math.sqrt(LAMBDA * t * (1 - t) * D);
      for (const b of boxes) if (G.pointDist(b, pt) < 0.6 * r) return 'edge';
    }
    return 'los';
  };

  // ---- GT 카메라: 방 남서 모서리, 천장 아래 (A1 위) ----
  G.camera = function (room, aimH) {
    return {
      pos: [0.08, 0.08, Math.max(2.5, Math.min(room.h - 0.15, 2.85))],
      tgt: [room.w / 2, room.l / 2, aimH],
      hfov: S.CAMERA.hfov * DEG, vfov: S.CAMERA.vfov * DEG
    };
  };
  function basis(c) {
    const f = norm(sub(c.tgt, c.pos));
    const r = norm(cross(f, [0, 0, 1]));
    return { f, r, u: cross(r, f) };
  }
  G.camSees = function (c, p) {
    const B = basis(c), v = sub(p, c.pos), z = dot(v, B.f);
    if (z <= 0) return false;
    return Math.abs(Math.atan2(dot(v, B.r), z)) <= c.hfov / 2 && Math.abs(Math.atan2(dot(v, B.u), z)) <= c.vfov / 2;
  };
  // 카메라에서 태그가 보이는지: ok · out(화각 밖) · hidden(사람·팬텀에 가림)
  G.gtStatus = function (c, p, boxes) {
    if (!G.camSees(c, p)) return 'out';
    for (const b of boxes) if (G.segHits(b, c.pos, p)) return 'hidden';
    return 'ok';
  };
  function rayDir(c, B, tx, ty) {
    return add(B.f, add(mul(B.r, tx * Math.tan(c.hfov / 2)), mul(B.u, ty * Math.tan(c.vfov / 2))));
  }
  function hitPlane(c, d, h) {
    if (d[2] < -1e-6) { const t = (h - c.pos[2]) / d[2]; if (t > 0) return [c.pos[0] + d[0] * t, c.pos[1] + d[1] * t]; }
    const k = Math.hypot(d[0], d[1]) || 1;
    return [c.pos[0] + d[0] / k * 60, c.pos[1] + d[1] / k * 60];
  }
  // 화각 네 모서리 광선 (그리기용, 높이 h 평면까지)
  G.camCorners = function (c, h) {
    const B = basis(c);
    return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(q => {
      const d = rayDir(c, B, q[0], q[1]);
      if (d[2] < -1e-6) { const t = (h - c.pos[2]) / d[2]; return add(c.pos, mul(d, t)); }
      return add(c.pos, mul(norm(d), 3));
    });
  };
  // 높이 h 평면에서 카메라가 보는 영역 (방 안으로 자름)
  G.camCoverage = function (c, h, room) {
    const B = basis(c), N = 16, poly = [];
    for (let i = 0; i < N; i++) poly.push(hitPlane(c, rayDir(c, B, -1 + 2 * i / N, 1), h));
    for (let i = 0; i < N; i++) poly.push(hitPlane(c, rayDir(c, B, 1, 1 - 2 * i / N), h));
    for (let i = 0; i < N; i++) poly.push(hitPlane(c, rayDir(c, B, 1 - 2 * i / N, -1), h));
    for (let i = 0; i < N; i++) poly.push(hitPlane(c, rayDir(c, B, -1, -1 + 2 * i / N), h));
    return clipRect(poly, 0, 0, room.w, room.l);
  };
  function clipRect(poly, x0, y0, x1, y1) {
    const edges = [
      p => p[0] >= x0, p => p[0] <= x1, p => p[1] >= y0, p => p[1] <= y1
    ];
    const cut = [
      (a, b) => lerpAt(a, b, (x0 - a[0]) / (b[0] - a[0])), (a, b) => lerpAt(a, b, (x1 - a[0]) / (b[0] - a[0])),
      (a, b) => lerpAt(a, b, (y0 - a[1]) / (b[1] - a[1])), (a, b) => lerpAt(a, b, (y1 - a[1]) / (b[1] - a[1]))
    ];
    let out = poly;
    for (let e = 0; e < 4; e++) {
      const inp = out; out = [];
      for (let i = 0; i < inp.length; i++) {
        const a = inp[i], b = inp[(i + 1) % inp.length], ia = edges[e](a), ib = edges[e](b);
        if (ia && ib) out.push(b);
        else if (ia && !ib) out.push(cut[e](a, b));
        else if (!ia && ib) { out.push(cut[e](a, b)); out.push(b); }
      }
      if (!out.length) break;
    }
    return out;
  }
  function lerpAt(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
})(window.SIM);
