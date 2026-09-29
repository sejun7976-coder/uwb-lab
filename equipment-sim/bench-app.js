// 3. 배선 조립: 탭, 옵션, 연결표, 선 개수, 조립 체크리스트
(function (S) {
  const B = S.BENCH, Q = B.bench;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cm = mm => (mm / 10).toFixed(1);
  const KEY = 'uwb-bench-layout-v1';
  const WORD = { ok: '여유', tight: '빠듯', over: '부족' };
  const TYPE = { FF: '암-암', MF: '수-암', MM: '수-수' };

  const clone = o => JSON.parse(JSON.stringify(o));
  function loadLayouts() {
    const base = clone(B.DEFAULTS);
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s) Object.keys(base).forEach(k => { if (s[k]) Object.keys(base[k]).forEach(p => { if (s[k][p]) base[k][p] = s[k][p]; }); });
    } catch (e) { /* 저장소를 못 쓰면 기본 배치 */ }
    return base;
  }
  function saveLayouts() { try { localStorage.setItem(KEY, JSON.stringify(st.layouts)); } catch (e) { /* 무시 */ } }

  const H = document.documentElement, EMBED = H.hasAttribute('data-vonly');
  const st = { key: /^(anchor|tag)$/.test(H.dataset.setup || '') ? H.dataset.setup : 'anchor', layouts: loadLayouts(), L: 100, colorMode: 'group', xray: true, filter: null, hi: null };
  const setupOf = k => B.setups[k];
  let res = null;

  const host = $('bench-view');
  const view = S.createBench(host, {
    onLayout: (lay, final) => { res = Q.evaluate(setupOf(st.key), lay, st.L); view.update(lay, res, final); renderSide(); if (final) saveLayouts(); },
    onPick: id => { st.hi = id && st.hi !== id ? id : null; view.style({ hi: st.hi }); markRow(); },
    onHover: () => {}
  });

  // 화면 위 범례 = 신호 그룹 필터
  const leg = document.createElement('div'); leg.className = 'bench-legend'; host.appendChild(leg);
  const hint = document.createElement('div'); hint.className = 'hint';
  hint.textContent = '부품 끌기 = 옮기기 · 두 번 누르기 = 90° 회전 · 선 누르기 = 강조'; host.appendChild(hint);
  let status = null;
  if (EMBED) {
    status = document.createElement('div'); status.className = 'bench-status'; host.appendChild(status);
    const cam = document.createElement('div'); cam.className = 'seg bench-cam'; cam.setAttribute('role', 'group'); cam.setAttribute('aria-label', '보는 방향');
    cam.innerHTML = '<button type="button" data-cam="angle">비스듬히</button><button type="button" data-cam="top">위에서</button><button type="button" data-cam="below">아래에서</button>';
    cam.querySelectorAll('button').forEach(b => b.addEventListener('click', () => view.frame(b.dataset.cam)));
    host.appendChild(cam);
  }
  function renderLegend() {
    const used = new Set(setupOf(st.key).wires.map(w => w.grp));
    leg.innerHTML = Object.keys(B.groups).filter(g => used.has(g)).map(g =>
      '<button type="button" data-g="' + g + '" aria-pressed="' + (st.filter === g) + '"><i style="background:var(' + B.groups[g].color + ')"></i>' + esc(B.groups[g].name) + '</button>').join('') +
      '<button type="button" data-g="over" aria-pressed="' + (st.filter === 'over') + '"><i style="background:var(--edge)"></i>빠듯·부족만</button>';
    leg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      st.filter = st.filter === b.dataset.g ? null : b.dataset.g; st.hi = null;
      view.style({ filter: st.filter, hi: null }); renderLegend(); markRow();
    }));
  }

  // ---- 탭 ----
  function renderTabs() {
    $('bench-tabs').innerHTML = Object.keys(B.setups).map((k, i) =>
      '<button type="button" class="tab" role="tab" data-k="' + k + '" aria-selected="' + (k === st.key) + '"><span class="no">' + (i === 0 ? 'A' : 'T') + '</span>' + esc(B.setups[k].title) + '</button>').join('');
    $('bench-tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => select(b.dataset.k)));
  }
  function select(k) {
    st.key = k; st.hi = null; st.filter = null;
    $('bench-tabs').querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === k)));
    res = Q.evaluate(setupOf(k), st.layouts[k], st.L);
    view.set(setupOf(k), st.layouts[k], res);
    view.style({ filter: null, hi: null, colorMode: st.colorMode, xray: st.xray });
    renderLegend(); renderSide(); renderInfo();
    $('bench-xray').checked = st.xray;
  }
  function recompute() {
    res = Q.evaluate(setupOf(st.key), st.layouts[st.key], st.L);
    view.update(st.layouts[st.key], res, true); view.style({});
    renderSide();
  }

  // ---- 사이드 패널 ----
  function advice(r) {
    const bad = r.wires.filter(w => w.status === 'over'), tight = r.wires.filter(w => w.status === 'tight');
    const out = [];
    if (bad.length) {
      const spi = bad.filter(w => w.spi), other = bad.filter(w => !w.spi);
      other.forEach(w => out.push('<span class="warnbox">' + esc(w.note) + ' 선은 약 ' + cm(w.need) + ' cm가 필요해 ' + (st.L / 10) + ' cm로 닿지 않는다. ' + (w.power ? '전원선' : '제어선') + '이라 20 cm ' + TYPE[w.type] + ' 점퍼로 바꿔도 된다.</span>'));
      spi.forEach(w => out.push('<span class="warnbox">SPI 신호선 ' + esc(w.note) + '(약 ' + cm(w.need) + ' cm)이 닿지 않는다. README 기준(신호선 15 cm 이하) 때문에 긴 선 대신 부품을 옮겨 줄인다.</span>'));
    }
    const rb = r.wires.filter(w => w.ruleBreak);
    if (rb.length) out.push('<span class="warnbox">20 cm 점퍼로 SPI 선 ' + rb.length + '가닥을 쓰면 README의 15 cm 이하 규칙을 넘는다. SPI 선은 10 cm로 둔다.</span>');
    if (!bad.length && tight.length) out.push('<span class="small">빠듯한 선은 팽팽하게 당겨지는 정도다. 선이 커넥터에서 빠지지 않게 부품을 조금 가깝게 두거나 테이프로 고정한다.</span>');
    if (!bad.length && !tight.length) out.push('<span class="small">모든 선이 ' + (st.L / 10) + ' cm 점퍼로 여유 있게 닿는다.</span>');
    return out.join('');
  }
  function totals() {
    const a = Q.evaluate(setupOf('anchor'), st.layouts.anchor, st.L), t = Q.evaluate(setupOf('tag'), st.layouts.tag, st.L);
    const ca = Q.counts(a.wires), ct = Q.counts(t.wires);
    const long = { FF: 0, MF: 0, MM: 0 };
    a.wires.forEach(w => { if (w.status === 'over') long[w.type] += 6; });
    t.wires.forEach(w => { if (w.status === 'over') long[w.type] += 1; });
    return ['FF', 'MF', 'MM'].map(k => ({ k, anchor: ca[k] * 6, tag: ct[k], all: ca[k] * 6 + ct[k], bought: B.BOUGHT[k], long: long[k] }));
  }
  function renderSide() {
    const r = res, s = setupOf(st.key);
    const n = { ok: 0, tight: 0, over: 0 }; r.wires.forEach(w => n[w.status]++);
    const ov = Q.overlaps(s, st.layouts[st.key]), cb = Q.usbCable(st.layouts[st.key]);
    const title = { esp: 'ESP32', dwm: 'DWM3000EVB', bb: '브레드보드', usb: 'USB 소켓', bank: '보조배터리' };
    const rank = { over: 0, tight: 1, ok: 2 };
    const rows = r.wires.slice().sort((a, b) => rank[a.status] - rank[b.status]).map(w =>
      '<tr data-id="' + w.id + '" tabindex="0"><td><i class="sw" style="background:var(' + B.groups[w.grp].color + ')"></i>' + esc(w.sig) + '</td>' +
      '<td class="con">' + esc(w.A.label) + '<br>→ ' + esc(w.B.label) + '</td><td>' + TYPE[w.type] + '</td>' +
      '<td>' + cm(w.need) + '</td><td class="' + (w.status === 'ok' ? 'good' : 'bad') + '">' + WORD[w.status] + (w.ruleBreak ? ' · 규칙' : '') + '</td></tr>').join('');
    const tt = totals();
    if (status) {
      const bad = r.wires.filter(w => w.status === 'over');
      status.innerHTML = '<b>' + esc(s.title) + ' · 선 ' + r.wires.length + '가닥</b><span>10 cm 점퍼: 여유 ' + n.ok + ' · <span class="tight">빠듯 ' + n.tight + '</span> · <span class="' + (n.over ? 'bad' : '') + '">부족 ' + n.over + '</span></span>' +
        bad.map(w => '<span class="bad">' + esc(w.note) + ' ≈ ' + cm(w.need) + ' cm</span>').join('');
    }
    $('bench-side').innerHTML =
      '<div class="blk"><h3>' + esc(s.title) + ' · 선 ' + r.wires.length + '가닥</h3>' +
      '<div class="chips"><span class="chip los">여유 ' + n.ok + '</span><span class="chip edge">빠듯 ' + n.tight + '</span><span class="chip ' + (n.over ? 'block' : '') + '">부족 ' + n.over + '</span></div>' +
      advice(r) +
      (ov.length ? '<span class="warnbox">겹친 부품: ' + ov.map(p => title[p[0]] + '–' + title[p[1]]).join(', ') + '</span>' : '') +
      (cb ? '<span class="' + (cb.ok ? 'small' : 'warnbox') + '">USB 케이블(30 cm): 보조배터리까지 ' + cm(cb.dist) + ' cm' + (cb.ok ? '' : ' — 너무 멀다') + '</span>' : '') +
      '</div>' +
      '<div class="blk"><h3>연결표 <span class="small">(길이 = 커넥터 포함 필요 길이, cm)</span></h3><div class="tscroll"><table class="wtab"><thead><tr><th>신호</th><th>연결</th><th>선</th><th>길이</th><th>판정</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="blk"><h3>필요한 선과 구매량</h3><table><thead><tr><th>선</th><th>앵커 ×6</th><th>태그</th><th>합</th><th>구매</th></tr></thead><tbody>' +
      tt.map(x => '<tr><td>' + TYPE[x.k] + '</td><td>' + x.anchor + '</td><td>' + x.tag + '</td><td>' + x.all + '</td><td class="' + (x.all <= x.bought ? 'good' : 'bad') + '">' + x.bought + '</td></tr>').join('') +
      '</tbody></table>' +
      (tt.some(x => x.long) ? '<span class="small">현재 배치에서 ' + (st.L / 10) + ' cm로 닿지 않는 선: ' + tt.filter(x => x.long).map(x => TYPE[x.k] + ' ' + x.long + '가닥').join(', ') + ' → 20 cm 점퍼가 필요하다.</span>' : '<span class="small">현재 배치로는 ' + (st.L / 10) + ' cm 점퍼만으로 된다.</span>') +
      '</div>';
    $('bench-side').querySelectorAll('tr[data-id]').forEach(tr => {
      const go = () => { st.hi = st.hi === tr.dataset.id ? null : tr.dataset.id; view.style({ hi: st.hi }); markRow(); };
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    markRow();
  }
  function markRow() {
    $('bench-side').querySelectorAll('tr[data-id]').forEach(tr => tr.classList.toggle('cur', tr.dataset.id === st.hi));
    const cur = st.hi && $('bench-side').querySelector('tr[data-id="' + st.hi + '"]');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  // ---- 아래 카드 ----
  function renderInfo() {
    const tag = st.key === 'tag';
    const check = [
      'DWM3000EVB <b>J1 점퍼를 2–3(3V3_ARDUINO)</b>에 꽂는다. 헤더 3V3로 전원을 받는다.',
      'DWM3000EVB <b>D0–D6은 비운다</b> (SPI 모드 스트랩). 그림에서 빨간 ×.',
      'ESP32는 핀 위치 대신 <b>실크의 GPIO 번호</b>를 보고 꽂는다. GPIO 35·36·37은 쓰지 않는다.',
      'GND와 3V3은 같은 이름 핀 중 가장 가까운 것을 골랐다. 어느 G 핀을 써도 된다.'
    ];
    if (tag) check.push(
      'IMU와 INA228 두 개는 <b>핀 헤더를 납땜</b>해 브레드보드 j행에 꽂는다 (몸체가 보드 밖으로 나가게).',
      'INA228 ②는 뒷면 <b>A0 점퍼를 납땜</b>해 주소를 0x41로 바꾼다 (①은 0x40 그대로).',
      '<b>VBUS–VIN+ 연결</b>: 하이사이드 측정이라 INA228의 VBUS를 VIN+에 이어야 전압·전력이 맞게 나온다. 여기서는 브레드보드 위 짧은 선(갈색)으로 잇는다. 뒷면 VBUS 점퍼를 납땜해도 같다.',
      'USB 소켓의 <b>D+·D−는 비운다</b>. 5V·GND만 쓴다.',
      '전력을 잴 때는 <b>노트북 USB 케이블을 태그에 꽂지 않는다</b>. 전원이 두 군데서 들어와 측정이 틀어진다.'
    ); else check.push('앵커 6대는 배선이 모두 같다. 전원은 ESP32 USB-C에 충전기 케이블을 꽂는다.');
    const path = tag
      ? '<ol class="steps benchpath"><li><b>5 V 경로 (INA228 ①)</b>: 보조배터리 → USB 소켓 5V → ① VIN+ → (션트) → ① VIN− → ESP32 5V 핀 → 보드 레귤레이터</li>' +
        '<li><b>UWB 3V3 경로 (INA228 ②)</b>: ESP32 3V3 → 3V3 레일 → ② VIN+ → (션트) → ② VIN− → DWM3000EVB 3V3</li>' +
        '<li><b>돌아오는 길</b>: 모든 GND → GND 레일 → USB 소켓 GND → 보조배터리</li>' +
        '<li>IMU와 INA228 칩 전원(VIN)은 3V3 레일에서 받는다. ② 쪽 칩 전원이 ② 측정값에 섞이지 않도록 ② VIN은 VIN+ 앞(레일)에서 뽑았다.</li></ol>'
      : '<ol class="steps benchpath"><li>충전기 → USB-C → ESP32 → 보드 3V3 → DWM3000EVB 3V3 (J1 2–3)</li><li>앵커는 전력 측정 대상이 아니라 INA228이 없다.</li></ol>';
    $('bench-info').innerHTML =
      '<div class="card"><h3>조립 전 확인</h3><ul>' + check.map(c => '<li>' + c + '</li>').join('') + '</ul></div>' +
      '<div class="card"><h3>전류가 흐르는 길</h3>' + path + '</div>' +
      '<div class="card"><h3>길이 판정 방법</h3><ul>' +
      '<li>점퍼 길이는 <b>커넥터 포함 전체 길이</b>로 본다 (보수적). 커넥터는 한쪽 14 mm.</li>' +
      '<li>ESP32·DWM3000EVB는 핀이 아래를 향하고, 암 커넥터에 얹힌 높이(기판 아래 21 mm)에 둔다. 브레드보드 쪽은 수 커넥터가 위로 서 있다.</li>' +
      '<li>필요 길이 = 두 커넥터 끝 사이 직선거리 + 양 끝 꺾임 여유 + 커넥터 두 개. 85 % 이하 여유, 100 % 이하 빠듯, 넘으면 부족.</li>' +
      '<li>선이 다른 부품을 피해 돌아가는 길은 계산하지 않는다.</li></ul></div>' +
      '<div class="card"><h3>모양의 근거</h3><ul>' +
      '<li><b>INA228</b>: Adafruit EAGLE 기판 파일 (25.4 × 20.3 mm, 헤더 VIN, GND, SCL, SDA, VBUS, VIN−, VIN+, ALRT).</li>' +
      '<li><b>IMU</b>: 같은 기판을 쓰는 Adafruit LSM6DSOX 보드 파일 (25.4 × 17.8 mm, 헤더 9핀).</li>' +
      '<li><b>ESP32</b>: Espressif DevKitC-1 v1.1 핀 표. 외형 70 × 28 mm, 핀 줄 간격 25.4 mm는 근사.</li>' +
      '<li><b>DWM3000EVB</b>: Arduino Uno R3 쉴드 헤더 위치. 모듈·J1 위치는 근사.</li></ul></div>';
  }

  // ---- 옵션 ----
  $('bench-len').addEventListener('change', e => { st.L = +e.target.value; recompute(); });
  $('bench-color').addEventListener('change', e => { st.colorMode = e.target.value; view.style({ colorMode: st.colorMode }); });
  $('bench-xray').addEventListener('change', e => { st.xray = e.target.checked; view.style({ xray: st.xray }); });
  $('bench-rot').addEventListener('click', () => view.rotate());
  $('bench-reset').addEventListener('click', () => {
    st.layouts[st.key] = clone(B.DEFAULTS[st.key]); saveLayouts();
    res = Q.evaluate(setupOf(st.key), st.layouts[st.key], st.L);
    view.set(setupOf(st.key), st.layouts[st.key], res, true); view.style({}); renderSide();
  });
  document.querySelectorAll('#bench-cam button').forEach(b => b.addEventListener('click', () => view.frame(b.dataset.cam)));
  window.addEventListener('keydown', e => {
    if ((e.key === 'r' || e.key === 'R') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && host.matches(':hover')) view.rotate();
  });

  function retheme() { view.retheme(); view.style({}); }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  S.benchView = view;
  renderTabs();
  select(st.key);
})(window.SIM);
