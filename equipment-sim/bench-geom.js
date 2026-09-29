// 배선 조립 계산: 부품 좌표 변환, 선 끝점, 필요한 선 길이, 부품 겹침. three.js 없이 동작 (node에서도 실행 가능)
(function (S) {
  const B = S.BENCH;
  const DEG = Math.PI / 180;
  const Q = B.bench = {};

  // 부품 좌표 (u, v) → 책상 좌표 (x, y). pose = { x, y, rot(도) }
  Q.xf = (pose, u, v) => {
    const c = Math.cos(pose.rot * DEG), s = Math.sin(pose.rot * DEG);
    return [pose.x + u * c - v * s, pose.y + u * s + v * c];
  };
  Q.inv = (pose, x, y) => {
    const c = Math.cos(pose.rot * DEG), s = Math.sin(pose.rot * DEG), dx = x - pose.x, dy = y - pose.y;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
  const rotv = (pose, du, dv) => { const c = Math.cos(pose.rot * DEG), s = Math.sin(pose.rot * DEG); return [du * c - dv * s, du * s + dv * c]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // 높이 (mm)
  Q.Z = {
    boardBottom: 21,         // ESP32·DWM3000EVB 기판 아래면 (암 커넥터에 얹힌 높이)
    plastic: 2.5,            // 핀 헤더 플라스틱
    pinLen: 6,
    bbTop: B.bb.T,
    get femaleExit() { return this.boardBottom - this.plastic - B.HOUSING; },
    get maleExit() { return this.bbTop + B.HOUSING; }
  };

  // 브레드보드 위 브레이크아웃 한 개의 기판 중심 (브레드보드 좌표)
  Q.mountCenter = m => {
    const d = B[m.def], uc1 = B.bb.colU(m.c1);
    return { u: uc1 - (d.Lb / 2 - d.header.x0), v: B.bb.rowV.j - (d.Wb / 2 - d.header.y) };
  };

  // 부품 바닥 면적 (겹침 판정용). 브레드보드는 밖으로 나온 브레이크아웃 몸체까지 포함
  Q.footprint = kind => {
    if (kind === 'bb') {
      const minV = Math.min.apply(null, B.bb.mounts.map(m => { const c = Q.mountCenter(m); return c.v - B[m.def].Wb / 2; }));
      const maxV = B.bb.W / 2;
      return { L: B.bb.L, W: maxV - minV, cu: 0, cv: (maxV + minV) / 2 };
    }
    const d = B[kind];
    return { L: d.L, W: d.W, cu: 0, cv: 0 };
  };

  // 끝점 하나: 핀 위치, 커넥터 밖으로 선이 나오는 점(exit), 나오는 방향(axis), 끝 종류(F = 암, M = 수)
  function endpoint(ep, lay, asg) {
    const Z = Q.Z;
    if (ep.p === 'esp' || ep.p === 'dwm') {
      const id = Array.isArray(ep.pin) ? ep.pin[0] : ep.pin;
      const pin = B[ep.p].pins[id], pose = lay[ep.p], xy = Q.xf(pose, pin.u, pin.v);
      return {
        end: 'F', xy, pinTop: Z.boardBottom - Z.plastic, housingTop: Z.boardBottom - Z.plastic,
        exit: [xy[0], xy[1], Z.femaleExit], axis: [0, 0, -1],
        part: ep.p, pin: id, label: (ep.p === 'esp' ? 'ESP32 ' + id + ' (' + pin.name + ')' : 'DWM ' + pin.name)
      };
    }
    if (ep.p === 'bb') {
      const pose = lay.bb, hole = asg.get(ep);
      const xy = Q.xf(pose, hole.u, hole.v);
      return {
        end: 'M', xy, hole, exit: [xy[0], xy[1], Z.maleExit], axis: [0, 0, 1],
        label: hole.label
      };
    }
    if (ep.p === 'usb') {
      const d = B.usb, pose = lay.usb, mouthU = d.sockLen / 2, v = d.sockets[ep.pin];
      const m = Q.xf(pose, mouthU, v), ax = rotv(pose, 1, 0);
      return {
        end: 'M', xy: m, mouth: [m[0], m[1], d.sockH], axis: [ax[0], ax[1], 0],
        exit: [m[0] + ax[0] * B.HOUSING, m[1] + ax[1] * B.HOUSING, d.sockH],
        label: 'USB 소켓 ' + ep.pin
      };
    }
    throw new Error('알 수 없는 끝점 ' + JSON.stringify(ep));
  }

  // 브레드보드 구멍 배정: 브레이크아웃 열은 f→i 순서, 레일은 상대 끝에 가장 가까운 빈 구멍
  function assign(setup, lay) {
    const map = new Map(), used = {};
    const bb = B.bb;
    setup.wires.forEach(w => [w.a, w.b].forEach(ep => {
      if (ep.p !== 'bb' || !ep.m) return;
      const col = B.mountCol(ep.m, ep.pin);
      used[col] = used[col] || 0;
      const row = bb.freeRows[Math.min(used[col]++, bb.freeRows.length - 1)];
      const m = bb.mounts.find(x => x.id === ep.m);
      map.set(ep, { u: bb.colU(col), v: bb.rowV[row], col, row, label: m.label + ' ' + ep.pin + ' (' + col + row + ')' });
    }));
    const railUsed = { '3V3': {}, GND: {} }, pending = [];
    setup.wires.forEach(w => [[w.a, w.b], [w.b, w.a]].forEach(([ep, other]) => {
      if (ep.p !== 'bb' || !ep.rail) return;
      const oe = other.p === 'bb' ? map.get(other) : null;
      const oxy = oe ? Q.xf(lay.bb, oe.u, oe.v) : endpoint(other, lay, map).xy;
      pending.push({ ep, u: Q.inv(lay.bb, oxy[0], oxy[1])[0] });
    }));
    pending.sort((p, q) => p.u - q.u).forEach(p => {
      let best = -1, bd = 1e9;
      for (let t = 0; t < 25; t++) {
        if (railUsed[p.ep.rail][t]) continue;
        const d = Math.abs(bb.railU(t) - p.u);
        if (d < bd) { bd = d; best = t; }
      }
      railUsed[p.ep.rail][best] = true;
      map.set(p.ep, { u: bb.railU(best), v: bb.rails[p.ep.rail], rail: p.ep.rail, t: best, label: p.ep.rail + ' 레일 ' + (best + 1) + '번' });
    });
    return map;
  }

  // 선 길이 판정. L = 점퍼 전체 길이(커넥터 포함, mm)
  Q.evaluate = function (setup, lay, L) {
    const asg = assign(setup, lay), H = B.HOUSING;
    const measure = (A, Bn) => {
      const d = sub(Bn.exit, A.exit), straight = len(d) || 1e-6;
      const angA = Math.acos(Math.max(-1, Math.min(1, dot(A.axis, d) / straight)));
      const angB = Math.acos(Math.max(-1, Math.min(1, -dot(Bn.axis, d) / straight)));
      return { straight, need: straight + 3 * (angA + angB) + 2 * H };   // 양 끝 꺾임 여유 (굽힘 반지름 약 3 mm) + 커넥터 두 개
    };
    // 핀 하나에는 암 커넥터 하나만 꽂힌다. 고정 핀을 먼저 잡고, 목록 핀은 남은 것 중 가장 짧은 것을 고른다
    const used = new Set();
    setup.wires.forEach(w => [w.a, w.b].forEach(ep => { if (typeof ep.pin === 'string' && (ep.p === 'esp' || ep.p === 'dwm')) used.add(ep.p + ':' + ep.pin); }));
    const opts = ep => Array.isArray(ep.pin) ? ep.pin.filter(p => !used.has(ep.p + ':' + p)).map(p => ({ p: ep.p, pin: p })) : [ep];
    const wires = setup.wires.map(w => {
      let best = null;
      opts(w.a).forEach(a => opts(w.b).forEach(b => {
        const A = endpoint(a, lay, asg), Bn = endpoint(b, lay, asg), m = measure(A, Bn);
        if (!best || m.need < best.need) best = Object.assign(m, { A, B: Bn, ea: a, eb: b });
      }));
      [best.ea, best.eb].forEach(ep => { if (ep.p === 'esp' || ep.p === 'dwm') used.add(ep.p + ':' + ep.pin); });
      const status = best.need <= 0.85 * L ? 'ok' : best.need <= L ? 'tight' : 'over';
      const type = best.A.end === 'F' && best.B.end === 'F' ? 'FF' : best.A.end === 'M' && best.B.end === 'M' ? 'MM' : 'MF';
      return Object.assign({}, w, { A: best.A, B: best.B, straight: best.straight, need: best.need, status, type, avail: L - 2 * H, ruleBreak: !!w.spi && L > 150 });
    });
    return { wires, asg };
  };

  // 부품 겹침 (회전한 직사각형 SAT, 여유 2 mm)
  function corners(kind, pose) {
    const f = Q.footprint(kind), hu = f.L / 2 + 1, hv = f.W / 2 + 1;
    return [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]].map(([u, v]) => Q.xf(pose, u + f.cu, v + f.cv));
  }
  function sepAxis(a, b) {
    for (const poly of [a, b]) for (let i = 0; i < 4; i++) {
      const p = poly[i], q = poly[(i + 1) % 4], n = [q[1] - p[1], p[0] - q[0]];
      const pa = a.map(c => c[0] * n[0] + c[1] * n[1]), pb = b.map(c => c[0] * n[0] + c[1] * n[1]);
      if (Math.max.apply(null, pa) < Math.min.apply(null, pb) || Math.max.apply(null, pb) < Math.min.apply(null, pa)) return true;
    }
    return false;
  }
  Q.overlaps = function (setup, lay) {
    const out = [], ks = setup.parts;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      if (!sepAxis(corners(ks[i], lay[ks[i]]), corners(ks[j], lay[ks[j]]))) out.push([ks[i], ks[j]]);
    }
    return out;
  };
  Q.corners = corners;

  // USB 케이블(30 cm)이 보조배터리 포트에서 소켓 묶음까지 닿는지
  Q.usbCable = function (lay) {
    if (!lay.usb || !lay.bank) return null;
    const port = Q.xf(lay.bank, B.bank.port.u, B.bank.port.v), inlet = Q.xf(lay.usb, -B.usb.sockLen / 2, 0);
    const d = Math.hypot(port[0] - inlet[0], port[1] - inlet[1]);
    return { port, inlet, dist: d, ok: d <= B.usb.cable - 40 };
  };

  // 선 종류별 개수
  Q.counts = function (wires) {
    const c = { FF: 0, MF: 0, MM: 0 };
    wires.forEach(w => { c[w.type]++; });
    return c;
  };
})(typeof window !== 'undefined' ? window.SIM : module.exports);
