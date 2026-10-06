// 만능기판 뒷면 배선 계산: 구멍 격자 위 최단 경로 (꺾임·교차에 벌점). DOM 없이 동작 (node에서도 실행 가능)
(function (S) {
  const F = S.PERF, BD = F.BOARD, NC = BD.NC, NR = BD.NR;
  const R = F.route = {};
  const idx = (c, r) => r * NC + c;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const COST = R.COST = { step: 1, turn: 2.5, cross: 4, nearPad: 0.3, share: 2 };   // cross: 남의 선을 넘어감, share: 남의 선과 같은 칸을 나란히 지남 (피복선이라 둘 다 가능)

  R.inKeepout = (c, r) => {
    const x = F.hx(c), y = F.hy(r), k = F.KEEPOUT;
    return x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1;
  };
  R.inCorner = (c, r) => F.CORNERS.some(([c0, r0]) => c >= c0 && c <= c0 + 1 && r >= r0 && r <= r0 + 1);

  // 모든 넷을 차례로 깐다. 반환: { nets: { id: { segs: [[pinA, pinB, [[c, r] ...]]], len } }, fail: [] }
  R.solve = function () {
    const padNet = new Array(NC * NR).fill(null);   // 구멍에 납땜되는 핀의 넷 ('-' = 연결 없는 소켓 핀)
    const pinNet = {};
    F.NETS.forEach(n => n.pins.forEach(p => { pinNet[p] = n.id; }));
    Object.values(F.PINS).forEach(p => { padNet[idx(p.c, p.r)] = pinNet[p.id] || '-'; });

    const wireAt = Array.from({ length: NC * NR }, () => []);   // 구멍을 지나는 선 (넷 id)
    const usedEdge = new Set();
    const ek = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    const out = { nets: {}, fail: [] };

    // 전원부터, 같은 단계 안에서는 핀이 많은 넷부터
    const order = F.NETS.slice().sort((a, b) => a.stage - b.stage || b.pins.length - a.pins.length);
    order.forEach(net => {
      const pins = net.pins.map(id => F.PINS[id]);
      const done = [pins[0]], left = pins.slice(1), segs = [];
      while (left.length) {
        // 이미 이은 핀에서 가장 가까운 핀부터
        let bi = 0, bd = Infinity;
        left.forEach((p, i) => done.forEach(q => { const d = Math.abs(p.c - q.c) + Math.abs(p.r - q.r); if (d < bd) { bd = d; bi = i; } }));
        const p = left.splice(bi, 1)[0];
        const path = search(net.id, p, done);
        if (!path) { out.fail.push(net.id + ' ' + p.id); done.push(p); continue; }
        const end = done.find(q => q.c === path[path.length - 1][0] && q.r === path[path.length - 1][1]);
        for (let i = 0; i < path.length; i++) {
          const k = idx(path[i][0], path[i][1]);
          if (!wireAt[k].includes(net.id)) wireAt[k].push(net.id);
          if (i) usedEdge.add(ek(idx(path[i - 1][0], path[i - 1][1]), k));
        }
        segs.push([p.id, end.id, path]);
        done.push(p);
      }
      out.nets[net.id] = { segs, len: segs.reduce((s, g) => s + R.pathLen(g[2]), 0) };
    });
    return out;

    // 핀 p에서 이미 이은 핀(targets) 중 하나까지 Dijkstra. 상태 = (구멍, 들어온 방향)
    function search(netId, p, targets) {
      const tset = new Set(targets.map(q => idx(q.c, q.r)));
      const N = NC * NR * 5, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
      const heap = [];
      const push = (s, d) => { heap.push([d, s]); let i = heap.length - 1; while (i) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
      const s0 = idx(p.c, p.r) * 5 + 4;
      dist[s0] = 0; push(s0, 0);
      while (heap.length) {
        const [d, s] = pop();
        if (d > dist[s]) continue;
        const h = Math.floor(s / 5), dir = s % 5, c = h % NC, r = Math.floor(h / NC);
        if (tset.has(h) && h !== idx(p.c, p.r)) return trace(s);
        // 남의 선 위(교차 중)에서는 꺾지 않는다
        const crossing = wireAt[h].some(n => n !== netId) && padNet[h] !== netId;
        for (let nd = 0; nd < 4; nd++) {
          if (crossing && dir !== 4 && nd !== dir) continue;
          const c2 = c + DIRS[nd][0], r2 = r + DIRS[nd][1];
          if (c2 < 0 || r2 < 0 || c2 >= NC || r2 >= NR) continue;
          const h2 = idx(c2, r2);
          if (R.inKeepout(c2, r2) || R.inCorner(c2, r2)) continue;
          const shared = usedEdge.has(ek(h, h2));
          if (shared && !isFinite(COST.share)) continue;
          const pn = padNet[h2];
          if (pn !== null && pn !== netId) continue;            // 남의 패드는 지나가지 않음
          if (pn === netId && !tset.has(h2)) continue;          // 자기 넷이라도 아직 안 이은 핀은 지나가지 않음
          let w = COST.step + (dir !== 4 && nd !== dir ? COST.turn : 0);
          const other = wireAt[h2].some(n => n !== netId);
          if (other) {
            if (pn === netId) continue;
            w += shared ? COST.share : COST.cross;
          }
          // 남의 패드 바로 옆은 조금 피함 (납땜 브리지 방지)
          for (const [dc, dr] of DIRS) {
            const c3 = c2 + dc, r3 = r2 + dr;
            if (c3 >= 0 && r3 >= 0 && c3 < NC && r3 < NR) { const q = padNet[idx(c3, r3)]; if (q !== null && q !== netId) { w += COST.nearPad; break; } }
          }
          const s2 = h2 * 5 + nd;
          if (d + w < dist[s2]) { dist[s2] = d + w; prev[s2] = s; push(s2, d + w); }
        }
      }
      return null;
      function trace(s) {
        const path = [];
        for (let t = s; t !== -1; t = prev[t]) { const h = Math.floor(t / 5); path.push([h % NC, Math.floor(h / NC)]); }
        return path.reverse();
      }
    }
  };

  R.pathLen = path => {
    let L = 0;
    for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) * 2.54;
    return L;
  };
  // 꺾이는 점만 남김 (그리기·설명용)
  R.corners = path => path.filter((p, i) => {
    if (i === 0 || i === path.length - 1) return true;
    const a = path[i - 1], b = path[i + 1];
    return (p[0] - a[0]) !== (b[0] - p[0]) || (p[1] - a[1]) !== (b[1] - p[1]);
  });
  R.STRIP = 8;   // 선 한 가닥 양 끝 벗김·여유 합 (mm)
})(typeof window !== 'undefined' ? window.SIM : module.exports);
