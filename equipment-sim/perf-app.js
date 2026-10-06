// 만능기판 조립 화면: 단계별 앞면(부품면)·뒷면(납땜면) SVG, 넷 목록, 점검표, 구매 목록
(function (S) {
  const F = S.PERF, B = S.BENCH, R = F.route, BD = F.BOARD, P = 2.54;
  const W = BD.W, H = BD.H, PAD = 7;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const ROUTE = R.solve();
  if (ROUTE.fail.length) console.warn('배선 실패', ROUTE.fail);
  const NET = {}; F.NETS.forEach(n => { NET[n.id] = n; });
  const PIN_NET = {}; F.NETS.forEach(n => n.pins.forEach(p => { PIN_NET[p] = n.id; }));
  const wireLen = id => ROUTE.nets[id].len + ROUTE.nets[id].segs.length * R.STRIP;

  // 단계별 누적 상태
  const ST = [];
  F.STEPS.forEach((s, i) => {
    const prev = i ? ST[i - 1] : { sock: [], stage: 0, modules: false, mount: false, preview: [] };
    ST.push({
      sock: prev.sock.concat(s.show.sock || []),
      newSock: s.show.sock || [],
      stage: s.show.stage || prev.stage,
      newStage: s.show.stage || 0,
      modules: !!s.show.modules,
      mount: !!s.show.mount,
      preview: s.show.preview || []
    });
  });

  const state = { step: 0, dim: '2d', view: F.STEPS[0].view, mods: null, sel: null, hover: null, done: load() };
  function load() { try { return JSON.parse(localStorage.getItem('perf-done') || '{}'); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem('perf-done', JSON.stringify(state.done)); } catch (e) { /* 무시 */ } }

  // ---------------- 그리기 ----------------
  const svgView = $('#perf-view');
  const tip = $('#perf-tip');

  function render(animate) {
    const st = ST[state.step], v = state.view;
    const is3 = state.dim === '3d';
    svgView.hidden = is3; $('#perf-3d').hidden = !is3; $('#perf-3dhint').hidden = !is3;
    if (is3) {
      S.perf3d.show($('#perf-3d'), true);
      S.perf3d.update({ st, view: v, mods: v !== 'bottom' && (state.mods === null ? st.modules : state.mods), mount: st.mount, sel: state.sel, ROUTE, WC, PIN_NET });
      legend(st);
      return;
    }
    if (S.perf3d) S.perf3d.show(null, false);
    const bottom = v === 'bottom', xray = v === 'both';
    const X = x => bottom ? W - x : x;
    const showMods = state.mods === null ? st.modules : state.mods;
    const o = [];
    o.push(`<svg viewBox="${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${bottom ? '뒷면(납땜면)' : '앞면(부품면)'}">`);
    const gx0 = bottom ? W - F.hx(BD.NC - 1) : F.hx(0);
    o.push(`<defs>
      <pattern id="holes" patternUnits="userSpaceOnUse" width="${P}" height="${P}" x="${gx0 - P / 2}" y="${F.hy(0) - P / 2}">
        <circle cx="${P / 2}" cy="${P / 2}" r="0.95" fill="#C59A52"/><circle cx="${P / 2}" cy="${P / 2}" r="0.45" fill="#0D1A12"/>
      </pattern>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
        <rect width="3" height="3" fill="rgb(194 54 43 / .16)"/><line x1="0" y1="0" x2="0" y2="3" stroke="rgb(194 54 43 / .7)" stroke-width="0.8"/>
      </pattern>
    </defs>`);
    // 기판
    o.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="2" fill="#2E6A43" stroke="#1E4A2E" stroke-width="0.6"/>`);
    o.push(`<rect x="${gx0 - P / 2}" y="${F.hy(0) - P / 2}" width="${(BD.NC) * P}" height="${BD.NR * P}" fill="url(#holes)"/>`);
    F.CORNERS.forEach(([c, r]) => {
      const cx = X(F.hx(c) + P / 2), cy = F.hy(r) + P / 2;
      o.push(`<rect x="${cx - 2.6}" y="${cy - 2.6}" width="5.2" height="5.2" fill="#2E6A43"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="#C59A52"/><circle cx="${cx}" cy="${cy}" r="1.6" fill="var(--scene)"/>`);
    });
    // 비움 구역
    const k = F.KEEPOUT, kx = Math.min(X(k.x0), X(k.x1));
    o.push(`<rect x="${kx}" y="${k.y0}" width="${k.x1 - k.x0}" height="${k.y1 - k.y0}" fill="url(#hatch)" stroke="rgb(194 54 43 / .8)" stroke-width="0.4" stroke-dasharray="1.2 0.8"/>`);
    o.push(lbl(kx + (k.x1 - k.x0) / 2, k.y1 + 2.6, '안테나 아래 비움 (근사)', 'keep'));
    if (!bottom) {
      const u = F.USBZONE;
      o.push(`<rect x="${u.x0}" y="${u.y0}" width="${u.x1 - u.x0}" height="${u.y1 - u.y0}" fill="rgb(255 255 255 / .06)" stroke="rgb(255 255 255 / .55)" stroke-width="0.4" stroke-dasharray="1.5 1"/>`);
      o.push(lbl((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, 'USB-C 케이블 자리', 'zone'));
    }
    // 가장자리 방향 표시
    o.push(lbl(bottom ? W - 1 : 1, -2.6, bottom ? 'UWB 안테나 쪽 →' : '← UWB 안테나 쪽', 'edge', bottom ? 'end' : 'start'));
    o.push(lbl(bottom ? 1 : W - 1, -2.6, bottom ? '← ESP32 안테나 쪽' : 'ESP32 안테나 쪽 →', 'edge', bottom ? 'start' : 'end'));
    o.push(lbl(1, H + 4.6, bottom ? '뒷면 (납땜면) · 좌우가 바뀌어 보인다' : (xray ? '앞면 + 뒷면 배선 투시' : '앞면 (부품면)'), 'face', 'start'));

    // 소켓 (앞면) 또는 납땜 자국 (뒷면)
    const sockPins = sid => Object.values(F.PINS).filter(p => p.sock === sid);
    if (!bottom) {
      st.preview.forEach(id => o.push(breakout(id, X, 'preview')));
      st.sock.forEach(sid => o.push(socket(sid, X, st.newSock.includes(sid))));
    } else {
      st.sock.forEach(sid => sockPins(sid).forEach(p => {
        const isNew = st.newSock.includes(sid);
        o.push(`<circle cx="${X(F.hx(p.c))}" cy="${F.hy(p.r)}" r="0.95" fill="#D9DDE0" stroke="#8D9499" stroke-width="0.2"${isNew ? ' class="newj"' : ''}/>`);
      }));
    }
    // 배선
    if (bottom || xray) o.push(wires(st, X, xray, animate));
    // 소켓 이름
    if (st.sock.length) o.push(sockLabels(st, X, bottom));
    // 모듈
    if (!bottom && !xray && showMods) {
      o.push(module('dwm', X)); o.push(module('esp', X));
      Object.keys(F.BREAKOUTS).forEach(id => o.push(breakout(id, X, 'mod')));
      if (st.mount) o.push(mounts(X));
    }
    // 마우스 위치 표시
    if (state.hover) o.push(`<circle cx="${X(F.hx(state.hover.c))}" cy="${F.hy(state.hover.r)}" r="1.5" fill="none" stroke="var(--accent)" stroke-width="0.5"/>`);
    o.push('</svg>');
    svgView.innerHTML = o.join('');
    legend(st);
  }

  function lbl(x, y, s, cls, anchor) {
    return `<text x="${x}" y="${y}" class="t-${cls}" text-anchor="${anchor || 'middle'}">${esc(s)}</text>`;
  }

  function socket(sid, X, isNew) {
    const d = F.SOCKETS[sid], ps = Object.values(F.PINS).filter(p => p.sock === sid);
    const cls = isNew ? ' class="new"' : '';
    if (d.kind === 'r') {
      const a = F.PINS['r1:1'], b = F.PINS['r1:2'], x = X(F.hx(a.c)), y0 = F.hy(b.r), y1 = F.hy(a.r);
      return `<g${cls}><line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#B8BEC2" stroke-width="0.5"/>
        <rect x="${x - 1.1}" y="${(y0 + y1) / 2 - 3.2}" width="2.2" height="6.4" rx="1" fill="#D8C29A" stroke="#9C8A68" stroke-width="0.2"/>
        ${['#C0392B', '#C0392B', '#6B3E26'].map((c, i) => `<rect x="${x - 1.1}" y="${(y0 + y1) / 2 - 2.2 + i * 1.3}" width="2.2" height="0.5" fill="${c}"/>`).join('')}</g>`;
    }
    if (d.kind === 'led') {
      const a = F.PINS['led:A'], kk = F.PINS['led:K'], cx = (X(F.hx(a.c)) + X(F.hx(kk.c))) / 2, cy = F.hy(a.r);
      return `<g${cls}><circle cx="${cx}" cy="${cy}" r="2.6" fill="rgb(240 70 60 / .85)" stroke="#8E1E17" stroke-width="0.3"/>
        <circle cx="${cx - 0.7}" cy="${cy - 0.8}" r="0.7" fill="rgb(255 255 255 / .6)"/>
        <text x="${X(F.hx(a.c))}" y="${cy + 4.4}" class="t-pin" text-anchor="middle">+</text><text x="${X(F.hx(kk.c))}" y="${cy + 4.4}" class="t-pin" text-anchor="middle">−</text></g>`;
    }
    const xs = ps.map(p => X(F.hx(p.c) + p.dx)), ys = ps.map(p => F.hy(p.r));
    const x0 = Math.min.apply(null, xs) - P / 2, x1 = Math.max.apply(null, xs) + P / 2;
    const y0 = Math.min.apply(null, ys) - P / 2, y1 = Math.max.apply(null, ys) + P / 2;
    const o = [`<g${cls}>`];
    if (d.bent) ps.forEach(p => o.push(`<line x1="${X(F.hx(p.c))}" y1="${F.hy(p.r)}" x2="${X(F.hx(p.c) + p.dx)}" y2="${F.hy(p.r)}" stroke="#E2B04A" stroke-width="0.55"/>`));
    o.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="0.3" fill="#141414" stroke="${d.bent ? '#E2B04A' : '#000'}" stroke-width="0.25"/>`);
    ps.forEach(p => {
      const x = X(F.hx(p.c) + p.dx), y = F.hy(p.r), used = !!PIN_NET[p.id];
      if (d.kind === 'mh') o.push(`<rect x="${x - 0.35}" y="${y - 0.35}" width="0.7" height="0.7" fill="#E3C05C"/>`);
      else o.push(`<rect x="${x - 0.5}" y="${y - 0.5}" width="1" height="1" fill="${used ? '#5A5F63' : '#2A2C2E'}"/>`);
    });
    o.push('</g>');
    return o.join('');
  }

  // 소켓 이름과 핀 이름 (작게)
  function sockLabels(st, X, bottom) {
    const o = [];
    const at = (sid, text, dy) => {
      const ps = Object.values(F.PINS).filter(p => p.sock === sid);
      if (!ps.length) return;
      const xs = ps.map(p => X(F.hx(p.c))), y = F.hy(ps[0].r);
      o.push(lbl((Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y + dy, text, 'sock'));
    };
    const has = s => st.sock.includes(s);
    if (has('esp-j1')) at('esp-j1', 'ESP32 J1 (신호 핀)', 6.4);
    if (has('esp-j3')) at('esp-j3', 'ESP32 J3', -2.4);
    if (has('dwm-dig10')) at('dwm-dig10', 'DWM 디지털 SCL–D8', -2.4);
    if (has('dwm-dig8')) at('dwm-dig8', 'D7–D0 (굽힘)', -2.4);
    if (has('dwm-pwr8')) at('dwm-pwr8', 'DWM 전원 NC–VIN', 3.9);
    ['ina2', 'ina1', 'imu'].forEach(id => { if (has(id)) at(id, F.BREAKOUTS[id].name, -2.4); });
    if (has('usb')) o.push(lbl(X(F.hx(F.PINS['usb:5V'].c)) + (bottom ? 2.2 : -2.2), F.hy(2) - 1.2, '전원 입력', 'sock', bottom ? 'start' : 'end'));
    if (has('tp')) o.push(lbl(X(F.hx(F.PINS['tp:5V'].c)) + (bottom ? 2.2 : -2.2), F.hy(F.PINS['tp:GND'].r + 1) + 1.8, '측정 핀', 'sock', bottom ? 'start' : 'end'));
    // 핀 이름: 사용하는 핀만
    st.sock.forEach(sid => Object.values(F.PINS).filter(p => p.sock === sid && PIN_NET[p.id]).forEach(p => {
      if (p.part === 'r1' || p.part === 'led') return;
      let n = p.name;
      if (p.part === 'dwm') n = p.id.split(':')[1].replace('PGND1', 'G').replace('GND', 'G');
      if (p.part === 'usb' || p.part === 'tp') { o.push(`<text x="${X(F.hx(p.c)) + (bottom ? -1.6 : 1.6)}" y="${F.hy(p.r) + 0.5}" class="t-pin" text-anchor="${bottom ? 'end' : 'start'}">${esc(n)}</text>`); return; }
      // 세로 글자: J3·DWM 전원 헤더는 줄 위쪽, 나머지는 줄 아래쪽
      const up = p.sock === 'esp-j3' || p.sock === 'dwm-pwr8', x = X(F.hx(p.c) + p.dx), y = F.hy(p.r) + (up ? -1.5 : 1.5);
      o.push(`<text x="${x}" y="${y}" dy="0.48" class="t-pin" text-anchor="${up ? 'start' : 'end'}" transform="rotate(-90 ${x} ${y})">${esc(n)}</text>`);
    }));
    return o.join('');
  }

  function wires(st, X, xray, animate) {
    const o = [`<g class="wires${xray ? ' xray' : ''}">`];
    const draw = [];
    F.NETS.forEach(n => { if (n.stage <= st.stage) ROUTE.nets[n.id].segs.forEach(sg => draw.push([n, sg])); });
    // 나란히 지나는 선이 겹쳐 보이지 않게 넷마다 조금씩 비켜 그린다 (양 끝 납땜점은 그대로)
    const ptsOf = (n, sg) => {
      const off = ((F.NETS.indexOf(n) % 5) - 2) * 0.3, cs = R.corners(sg[2]);
      return cs.map(([c, r], i) => {
        const e = i === 0 || i === cs.length - 1 ? 0 : off;
        return (X(F.hx(c)) + e).toFixed(2) + ',' + (F.hy(r) + e).toFixed(2);
      }).join(' ');
    };
    // 아래에 테두리, 위에 색
    draw.forEach(([n, sg]) => {
      const pts = ptsOf(n, sg);
      o.push(`<polyline points="${pts}" fill="none" stroke="${n.grp === 'gnd' ? '#C9D6CD' : '#14301E'}" stroke-width="${n.wire === 'pwr' ? 1.6 : 1.25}" stroke-linejoin="round" stroke-linecap="round"/>`);
    });
    draw.forEach(([n, sg]) => {
      const pts = ptsOf(n, sg);
      const isNew = n.stage === st.newStage, dim = state.sel && state.sel !== n.id, hi = state.sel === n.id;
      const len = R.pathLen(sg[2]);
      const anim = isNew && animate ? ` style="stroke-dasharray:${len.toFixed(1)};stroke-dashoffset:${len.toFixed(1)};animation:draw 1.1s ease-out ${(draw.indexOf(draw.find(d => d[1] === sg)) * 0.06).toFixed(2)}s forwards"` : '';
      o.push(`<polyline points="${pts}" fill="none" stroke="${WC[n.grp]}" stroke-width="${n.wire === 'pwr' ? 1.0 : 0.7}" stroke-linejoin="round" stroke-linecap="round" opacity="${dim ? 0.18 : 1}"${hi ? ' class="hi"' : ''}${anim}/>`);
    });
    // 납땜 끝점
    draw.forEach(([n, sg]) => [sg[2][0], sg[2][sg[2].length - 1]].forEach(([c, r]) => {
      o.push(`<circle cx="${X(F.hx(c))}" cy="${F.hy(r)}" r="0.55" fill="${WC[n.grp]}" opacity="${state.sel && state.sel !== n.id ? 0.2 : 1}"/>`);
    }));
    o.push('</g>');
    return o.join('');
  }
  // 녹색 기판 위에서 잘 보이는 선 색 (화면 테마와 무관). 신호 그룹은 배선 조립 시뮬레이터와 같은 계열
  const WC = { uwb: '#4FA3FF', ctl: '#C38BF0', imu: '#3FD6C2', i2c: '#F2CB45', v33: '#FF5A6E', v5: '#FF9A3D', gnd: '#151515', link: '#D9A27A' };

  function module(kind, X) {
    if (kind === 'esp') {
      const p = F.POSE.esp, x0 = X(p.x - 35), x1 = X(p.x + 35), L = Math.min(x0, x1), ant = X(p.x + 29), mod = X(p.x + 9.5);
      return `<g class="mod"><rect x="${L}" y="${p.y - 14}" width="70" height="28" rx="1.2" fill="#16191A" stroke="#000" stroke-width="0.3"/>
        <rect x="${Math.min(mod, X(p.x + 29))}" y="${p.y - 9}" width="19.5" height="18" fill="#B9C0C4"/>
        <rect x="${Math.min(ant, X(p.x + 35))}" y="${p.y - 9}" width="6" height="18" fill="#2B6F4E"/>
        <rect x="${Math.min(X(p.x - 35), X(p.x - 28))}" y="${p.y - 11}" width="7" height="9" fill="#9AA3A8"/><rect x="${Math.min(X(p.x - 35), X(p.x - 28))}" y="${p.y + 2}" width="7" height="9" fill="#9AA3A8"/>
        <text x="${X(p.x + 19)}" y="${p.y + 0.8}" class="t-chip" text-anchor="middle">ESP32-S3</text>
        <text x="${X(p.x - 6)}" y="${p.y + 0.8}" class="t-mod" text-anchor="middle">ESP32-S3 N16R8</text>
        <text x="${X(p.x - 24.5)}" y="${p.y - 5.6}" class="t-tiny" text-anchor="middle">COM</text><text x="${X(p.x - 24.5)}" y="${p.y + 7.4}" class="t-tiny" text-anchor="middle">USB</text></g>`;
    }
    // DWM3000EVB: 흰 기판·빨간 실크 (실물). 모듈·안테나·J1 위치는 F.DWM_GEOM (사진 추정)
    const G = F.DWM_GEOM, rect = (r, attr) => {
      const a = F.dwmXY(r.u0, r.v1), b = F.dwmXY(r.u1, r.v0), x0 = Math.min(X(a[0]), X(b[0]));
      return `<rect x="${x0}" y="${a[1]}" width="${Math.abs(b[0] - a[0])}" height="${b[1] - a[1]}" ${attr}/>`;
    };
    const c = F.dwmXY(0, 0), m = F.dwmXY((G.can.u0 + G.can.u1) / 2, 0), an = F.dwmXY((G.ant.u0 + G.ant.u1) / 2, 0), j = F.dwmXY(G.j1.u, G.j1.v);
    return `<g class="mod">${rect({ u0: -34.29, u1: 34.29, v0: -26.67, v1: 26.67 }, 'rx="1.5" fill="#F1F1EC" stroke="#9A9A92" stroke-width="0.3"')}
      ${rect(G.module, 'fill="#FAFAF7" stroke="#B5B5AE" stroke-width="0.25"')}
      ${rect(G.can, 'fill="#B9C0C4"')}${rect(G.ant, 'fill="#E4E4DE" stroke="#C9C9C2" stroke-width="0.2"')}
      <text x="${X(m[0])}" y="${m[1] + 0.8}" class="t-chip" text-anchor="middle">DWM3000</text>
      <text x="${X(an[0])}" y="${an[1] + 0.6}" class="t-tiny dark" text-anchor="middle">안테나</text>
      <rect x="${X(j[0]) - 3.75}" y="${j[1] - 1.25}" width="7.5" height="2.5" fill="#111" stroke="#FFD166" stroke-width="0.3"/>
      <text x="${X(j[0])}" y="${j[1] - 2.2}" class="t-tiny red" text-anchor="middle">J1 2–3 (3V3_Arduino)</text>
      <text x="${X(c[0] + 12)}" y="${c[1] + 0.8}" class="t-mod red" text-anchor="middle">qorvo DWM3000EVB</text></g>`;
  }

  function breakout(id, X, mode) {
    const m = F.BREAKOUTS[id], d = B[m.def];
    const left = F.hx(m.a) - d.header.x0, top = F.hy(m.r) - (d.Wb - d.header.y);
    const L = Math.min(X(left), X(left + d.Lb)), cx = X(left + d.Lb / 2);
    const o = [];
    if (mode === 'preview') {
      o.push(`<g class="preview"><rect x="${L}" y="${top}" width="${d.Lb}" height="${d.Wb}" rx="1" fill="rgb(255 255 255 / .05)" stroke="#E8ECEE" stroke-width="0.35" stroke-dasharray="1.2 0.8"/>
        <text x="${cx}" y="${top + d.Wb / 2 - 1}" class="t-sock" text-anchor="middle">${esc(m.name)}</text>
        <text x="${cx}" y="${top + d.Wb / 2 + 2.6}" class="t-tiny" text-anchor="middle">${id === 'ina2' ? '핀헤더 + A0 점퍼' : '핀헤더 납땜'}</text></g>`);
      return o.join('');
    }
    const pcb = { imu: '#143238', ina1: '#1C1F3A', ina2: '#2B1C36' }[id];
    o.push(`<g class="mod"><rect x="${L}" y="${top}" width="${d.Lb}" height="${d.Wb}" rx="1" fill="${pcb}" stroke="${css(m.color)}" stroke-width="0.5"/>`);
    if (m.def === 'ina') o.push(`<rect x="${cx - 5.25}" y="${top + 0.4}" width="10.5" height="6.5" fill="#2F8F4E" stroke="#1A5A30" stroke-width="0.2"/>`);
    else o.push(`<rect x="${cx - 1.6}" y="${top + 5}" width="3.2" height="2.6" fill="#222"/><path d="M${cx + 4} ${top + 4} h4 m-1.2 -1 l1.2 1 l-1.2 1 M${cx + 4} ${top + 4} v-3 m-1 1.2 l1 -1.2 l1 1.2" stroke="#E8ECEE" stroke-width="0.3" fill="none"/>`);
    o.push(`<text x="${cx}" y="${top + d.Wb / 2 + 2.6}" class="t-mod" text-anchor="middle">${esc(m.name)}</text>`);
    o.push(`<text x="${cx}" y="${top + d.Wb / 2 + 5.8}" class="t-tiny" text-anchor="middle">${esc(m.sub)}</text></g>`);
    return o.join('');
  }

  function mounts(X) {
    return F.CORNERS.map(([c, r]) => {
      const cx = X(F.hx(c) + P / 2), cy = F.hy(r) + P / 2;
      return `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#EDEDE6" stroke="#9A9A92" stroke-width="0.3"/><circle cx="${cx}" cy="${cy}" r="1.2" fill="#7A7A74"/>`;
    }).join('') + `<path d="M${X(F.hx(BD.NC - 1) + 2)} ${F.hy(3)} C ${X(W + 4)} ${F.hy(3)}, ${X(W + 5)} ${F.hy(8)}, ${X(W + 6.5)} ${F.hy(12)}" stroke="#222" stroke-width="2" fill="none"/>
      <text x="${X(W + 1)}" y="${F.hy(15)}" class="t-tiny" text-anchor="end">케이블 타이</text>`;
  }

  // ---------------- 범례 ----------------
  function legend(st) {
    const el = $('#perf-legend');
    if (state.view === 'top') { el.innerHTML = ''; return; }
    const g = {};
    F.NETS.forEach(n => { if (n.stage <= st.stage) g[n.grp] = true; });
    const names = { gnd: 'GND', v5: '5V', v33: '3V3', link: '3V3 UWB', uwb: 'UWB SPI', ctl: '제어·LED', imu: 'IMU SPI', i2c: 'I2C' };
    el.innerHTML = Object.keys(g).map(k => `<span><i style="background:${WC[k]}"></i>${names[k]}</span>`).join('');
  }

  // ---------------- 사이드 패널 ----------------
  function side() {
    const s = F.STEPS[state.step], st = ST[state.step], o = [];
    o.push(`<div class="blk"><span class="stepno">단계 ${state.step + 1} / ${F.STEPS.length}</span><h3 class="steph">${esc(s.title)}</h3>
      <ol class="steps">${s.body.map(b => `<li>${esc(b)}</li>`).join('')}</ol></div>`);
    if (st.newSock.length) {
      o.push(`<div class="blk"><h3>이번 단계에 다는 것</h3><table><tr><th>부품</th><th>납땜</th></tr>${st.newSock.map(sid => {
        const n = Object.values(F.PINS).filter(p => p.sock === sid).length;
        return `<tr><td class="sans">${esc(F.SOCKETS[sid].title)}</td><td>${n}곳</td></tr>`;
      }).join('')}</table></div>`);
    }
    if (st.newStage) {
      const nets = F.NETS.filter(n => n.stage === st.newStage);
      o.push(`<div class="blk"><h3>이번 단계 배선 <span class="small">(눌러서 강조, 체크로 완료 표시)</span></h3><div class="netlist">${nets.map(n => {
        const segs = ROUTE.nets[n.id].segs.map(sg => `${short(sg[0])} → ${short(sg[1])}`).join('<br>');
        const k = n.id, done = !!state.done[k];
        return `<div class="netrow${state.sel === k ? ' on' : ''}${done ? ' done' : ''}" data-net="${esc(k)}">
          <input type="checkbox" aria-label="${esc(k)} 완료" ${done ? 'checked' : ''} data-done="${esc(k)}">
          <i style="background:${WC[n.grp]}"></i>
          <div><b>${esc(k)}</b> <span class="len">${(wireLen(k) / 10).toFixed(1)} cm</span><div class="small">${segs}</div></div></div>`;
      }).join('')}</div>
      <p class="small">선 길이 = 구멍 사이 경로 + 가닥마다 ${R.STRIP} mm (벗김·여유). 경로는 자동 계산이라 실제로는 더 단순하게 깔아도 된다. 같은 두 점만 이으면 된다.</p></div>`);
    }
    if (s.tests) o.push(tests());
    if (s.check && s.check.length) o.push(`<div class="blk"><h3>확인</h3><ul class="chk">${s.check.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`);
    $('#perf-side').innerHTML = o.join('');
  }
  function short(id) {
    const p = F.PINS[id];
    return esc(p.label.replace('ESP32 ', 'ESP ').replace(' (긴 다리)', '').replace(' (짧은 다리)', ''));
  }
  function tests() {
    const open = [['5V 입력', 'GND'], ['5V ESP', 'GND'], ['3V3', 'GND'], ['3V3 UWB', 'GND'], ['3V3', '3V3 UWB'], ['5V 입력', '5V ESP']];
    const rows = F.NETS.filter(n => n.pins.length > 1).map(n => `<tr><td class="sans"><i class="sw" style="background:${WC[n.grp]}"></i>${esc(n.id)}</td><td>삐</td><td class="sans small">${n.pins.length}곳 모두</td></tr>`).join('');
    return `<div class="blk"><h3>멀티미터 점검표 (모듈 없이)</h3>
      <table><tr><th>넷</th><th>기대</th><th>범위</th></tr>${rows}</table>
      <table><tr><th>쇼트 확인</th><th>기대</th></tr>${open.map(([a, b]) => `<tr><td class="sans">${esc(a)} ↔ ${esc(b)}</td><td class="good">안 붙음</td></tr>`).join('')}</table>
      <p class="small">INA228을 꽂기 전에는 5V 입력과 5V ESP, 3V3와 3V3 UWB가 끊겨 있는 것이 정상이다 (션트 저항이 INA228 보드 위에 있음). 이웃한 소켓 구멍끼리(특히 SPI 4가닥)도 붙어 있지 않은지 본다.</p></div>`;
  }

  // ---------------- 단계 탭·조작 ----------------
  function tabs() {
    $('#perf-tabs').innerHTML = F.STEPS.map((s, i) => `<button type="button" class="tab" role="tab" aria-selected="${i === state.step}" data-step="${i}"><span class="no">${i + 1}</span>${esc(s.title)}</button>`).join('');
  }
  function go(i, keepView) {
    state.step = Math.max(0, Math.min(F.STEPS.length - 1, i));
    if (!keepView) state.view = F.STEPS[state.step].view === 'both' ? 'both' : F.STEPS[state.step].view;
    state.mods = null; state.sel = null;
    tabs(); seg(); side(); render(true);
    $('#perf-prev').disabled = state.step === 0;
    $('#perf-next').disabled = state.step === F.STEPS.length - 1;
  }
  function seg() {
    document.querySelectorAll('#perf-face button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === state.view)));
    const st = ST[state.step], m = state.mods === null ? st.modules : state.mods;
    $('#perf-mods').checked = m;
    $('#perf-mods').disabled = state.dim === '3d' ? state.view === 'bottom' : state.view !== 'top';
    document.querySelectorAll('#perf-dim button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.d === state.dim)));
    $('#perf-replay').textContent = state.dim === '3d' ? '시점 처음으로' : '배선 다시 그리기';
  }

  $('#perf-tabs').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) go(+b.dataset.step); });
  $('#perf-prev').addEventListener('click', () => go(state.step - 1));
  $('#perf-next').addEventListener('click', () => go(state.step + 1));
  $('#perf-face').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; state.view = b.dataset.v; seg(); render(true); });
  $('#perf-mods').addEventListener('change', e => { state.mods = e.target.checked; render(false); });
  $('#perf-replay').addEventListener('click', () => { if (state.dim === '3d') S.perf3d.resetCamera(); else render(true); });
  $('#perf-dim').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; state.dim = b.dataset.d; hideTip(); seg(); render(true); });
  $('#perf-side').addEventListener('click', e => {
    const cb = e.target.closest('[data-done]');
    if (cb) { state.done[cb.dataset.done] = cb.checked; save(); cb.closest('.netrow').classList.toggle('done', cb.checked); return; }
    const row = e.target.closest('[data-net]');
    if (row) { state.sel = state.sel === row.dataset.net ? null : row.dataset.net; side(); render(false); }
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') go(state.step + 1);
    if (e.key === 'ArrowLeft') go(state.step - 1);
  });

  // 마우스: 구멍 정보
  svgView.addEventListener('pointermove', e => {
    const svg = svgView.querySelector('svg'); if (!svg) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = state.view === 'bottom' ? W - q.x : q.x;
    const c = Math.round((x - BD.X0) / P), r = Math.round((q.y - BD.Y0) / P);
    if (c < 0 || r < 0 || c >= BD.NC || r >= BD.NR || Math.hypot(x - F.hx(c), q.y - F.hy(r)) > 1.3) { hideTip(); return; }
    const st = ST[state.step];
    const pin = Object.values(F.PINS).find(p => p.c === c && p.r === r && st.sock.includes(p.sock));
    const thru = [];
    if (state.view !== 'top') F.NETS.forEach(n => { if (n.stage <= st.stage && ROUTE.nets[n.id].segs.some(sg => sg[2].some(h => h[0] === c && h[1] === r))) thru.push(n.id); });
    const lines = [`<b>열 ${c + 1} · 행 ${r + 1}</b>`];
    if (pin) lines.push(esc(pin.label) + (PIN_NET[pin.id] ? ` · <span class="mono">${esc(PIN_NET[pin.id])}</span>` : ' · 연결 없음'));
    if (pin && pin.dx) lines.push('<span class="warnc">핀이 구멍에서 1.0 mm 어긋남 → 다리 굽힘</span>');
    if (thru.length) lines.push('선: ' + thru.map(esc).join(', '));
    if (R.inKeepout(c, r)) lines.push('<span class="warnc">안테나 아래 비움 구역</span>');
    tip.innerHTML = lines.join('<br>');
    const box = svgView.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX - box.left + 14, box.width - 230) + 'px';
    tip.style.top = (e.clientY - box.top + 14) + 'px';
    tip.hidden = false;
    if (!state.hover || state.hover.c !== c || state.hover.r !== r) { state.hover = { c, r }; render(false); }
  });
  svgView.addEventListener('pointerleave', hideTip);
  function hideTip() { tip.hidden = true; if (state.hover) { state.hover = null; render(false); } }

  // ---------------- 구매 목록 ----------------
  function bom() {
    const won = v => Math.round(v).toLocaleString('ko-KR');
    const pill = n => `<span class="pill ${{ 필수: 'must', 권장: 'sug', 선택: '' }[n]}">${n}</span>`;
    const sum = need => F.BOM.filter(b => b.need === need).reduce((s, b) => s + b.price * b.qty, 0);
    $('#bom-table').innerHTML = `<table class="bom"><tr><th>구분</th><th>품목</th><th>규격</th><th class="r">단가</th><th class="r">수량</th><th class="r">금액</th><th>용도</th></tr>${F.BOM.map(b =>
      `<tr><td>${pill(b.need)}</td><td class="sans"><a href="${b.url}" target="_blank" rel="noopener"><b>${esc(b.item)}</b></a>${b.model ? `<div class="small">${esc(b.model)}</div>` : ''}</td>
        <td class="sans small">${esc(b.spec)}</td><td class="r">${won(b.price)}</td><td class="r">${b.qty} ${esc(b.unit)}</td><td class="r"><b>${won(b.price * b.qty)}</b></td>
        <td class="sans small">${esc(b.why)}${b.note ? `<div class="warnc">${esc(b.note)}</div>` : ''}</td></tr>`).join('')}
      <tr class="tot"><td colspan="5" class="sans">필수 합계</td><td class="r"><b>${won(sum('필수'))}</b></td><td></td></tr>
      <tr class="tot"><td colspan="5" class="sans">필수 + 권장</td><td class="r"><b>${won(sum('필수') + sum('권장'))}</b></td><td class="sans small">선택(우노 프로토 쉴드)까지 ${won(sum('필수') + sum('권장') + sum('선택'))}원</td></tr></table>`;
    const pw = F.NETS.filter(n => n.wire === 'pwr').reduce((s, n) => s + wireLen(n.id), 0);
    const sg = F.NETS.filter(n => n.wire === 'sig').reduce((s, n) => s + wireLen(n.id), 0);
    const nSock = Object.values(F.PINS).filter(p => F.SOCKETS[p.sock].kind === 'fh').length;
    $('#bom-sum').innerHTML = `
      <div class="stat"><span>필수 합계 (VAT 포함)</span><b class="num">${won(sum('필수'))}원</b></div>
      <div class="stat"><span>필수 + 권장</span><b class="num">${won(sum('필수') + sum('권장'))}원</b></div>
      <div class="stat"><span>소켓 핀 (암 헤더)</span><b class="num">${nSock}</b></div>
      <div class="stat"><span>전원 · 신호선 (계산)</span><b class="num">${(pw / 1000).toFixed(2)} · ${(sg / 1000).toFixed(2)} m</b></div>`;
    $('#bom-src').textContent = `가격: ${F.SHOP.name} 상품 페이지 판매가 (VAT 포함, ${F.SHOP.date} 확인). 배송비 ${won(F.SHOP.ship)}원, ${won(F.SHOP.freeOver)}원 이상 무료. 품목명을 누르면 상품 페이지가 열린다.`;
    $('#bom-drop').innerHTML = F.DROP.map(d => `<li>${esc(d)}</li>`).join('');
  }

  bom();
  // 주소 옵션: ?step=1–11 (처음 보여 줄 단계), &face=top | bottom | both, &dim=3d
  let q0 = 0, f0 = null;
  try { const q = new URLSearchParams(location.search); q0 = (parseInt(q.get('step'), 10) || 1) - 1; f0 = q.get('face'); if (q.get('dim') === '3d') state.dim = '3d'; } catch (e) { /* 무시 */ }
  go(q0);
  if (/^(top|bottom|both)$/.test(f0 || '')) { state.view = f0; seg(); render(false); }
})(window.SIM);
