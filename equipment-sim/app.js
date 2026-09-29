// 화면 구성: 장비 목록, 1. 테스트 환경, 2. 테스트 시뮬레이션
(function (S) {
  const G = S.geom, T = S.tests;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const nf = n => Math.round(n).toLocaleString('ko-KR');
  const pct = x => Math.round(x * 100) + '%';
  const AIM_H = 1.2;   // 카메라가 겨누는 태그 높이 평면 (호모그래피 평면)

  const st = {
    room: Object.assign({}, S.ROOM_DEFAULT), charger: 'one', fov: true,
    test: 1, tagH: 1.2, t: 0, speed: 30, scrubbing: false,
    playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };
  const roomEnv = () => ({ room: st.room, anchors: G.anchors(st.room), camera: G.camera(st.room, AIM_H), desk: true });

  // ---- 장비 목록 ----
  function renderEquip() {
    $('equip-list').innerHTML = S.EQUIP.map(g =>
      '<div class="egroup"><div class="egroup-head"><h3>' + esc(g.title) + '</h3><span>' + esc(g.src || '') + '</span></div>' +
      g.items.map(it =>
        '<div class="eitem"><b>' + esc(it.name) +
        (it.tag ? '<span class="pill ' + (it.tag === 'have' ? 'have' : it.tag === 'sug' ? 'sug' : '') + '">' + esc(it.tagText) + '</span>' : '') +
        '</b><span class="qty">' + esc(it.qty) + '</span>' +
        (it.det ? '<span class="det">' + esc(it.det) + '</span>' : '') + '</div>'
      ).join('') + '</div>'
    ).join('');
  }

  // ---- 장치 구성 카드 (클릭) ----
  function showDev(host, info, env) {
    let card = host.querySelector('.devcard');
    if (!info) { if (card) card.remove(); return; }
    const d = S.DEVICES[info.kind];
    if (!d) return;
    let title = { tag: '태그', camera: 'GT 카메라', desk: '노트북 · 공유기', charger: 'USB 충전기', phantom: '물 팬텀' }[info.kind] || '';
    let extra = '';
    if (info.kind === 'anchor') {
      const a = env.anchors.find(x => x.id === info.id);
      title = '앵커 A' + info.id;
      if (a) extra = '<span class="mono small">x ' + a.x.toFixed(2) + ' · y ' + a.y.toFixed(2) + ' · z ' + a.z.toFixed(2) + ' m</span>';
    }
    if (!card) { card = document.createElement('div'); card.className = 'devcard'; host.appendChild(card); }
    card.innerHTML = '<h3>' + esc(title) + '</h3>' + extra + '<span class="role">' + esc(d.role) + '</span><ul>' +
      d.parts.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul><button type="button">닫기</button>';
    card.querySelector('button').addEventListener('click', () => card.remove());
  }
  function overlay(host, legendHtml, hint) {
    const lg = document.createElement('div'); lg.className = 'legend'; lg.innerHTML = legendHtml; host.appendChild(lg);
    const h = document.createElement('div'); h.className = 'hint'; h.textContent = hint; host.appendChild(h);
  }

  // ---- 1. 테스트 환경 ----
  let envNow = null;
  const envView = S.createView($('env-view'), { onPick: info => showDev($('env-view'), info, envNow) });
  overlay($('env-view'),
    '<span><i style="background:var(--cable)"></i>케이블 3 m 이내</span><span><i style="background:var(--block)"></i>3 m 초과</span><span><i style="background:var(--ok)"></i>카메라 화각 (1.2 m)</span>',
    '드래그 회전 · 휠 확대 · 클릭하면 구성');

  function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }

  function buildEnv(keep) {
    envNow = roomEnv();
    const cables = G.cables(st.room, envNow.anchors, st.charger);
    envView.setEnv(envNow, { cables, chargers: G.chargers(st.room, st.charger), showFov: st.fov, fovH: AIM_H, keepCamera: keep });
    const R = st.room, cam = envNow.camera;
    const pts = T.gridPoints(R), seen = pts.filter(p => G.camSees(cam, [p[0], p[1], AIM_H])).length;
    const cover = polyArea(G.camCoverage(cam, AIM_H, R)) / (R.w * R.l);
    const ok = cables.filter(c => !c.over).length, maxLen = Math.max.apply(null, cables.map(c => c.len));
    const modeText = { one: '충전기 1대 (서쪽 벽 가운데 바닥)', two: '충전기 2대 (서·동쪽 벽 가운데 바닥)', each: '앵커마다 어댑터 (바로 아래 콘센트 0.3 m)' }[st.charger];
    $('env-side').innerHTML =
      '<div class="blk"><h3>앵커 좌표 (m)</h3><table><thead><tr><th>앵커</th><th>x</th><th>y</th><th>z</th></tr></thead><tbody>' +
      envNow.anchors.map(a => '<tr><td>A' + a.id + '</td><td>' + a.x.toFixed(2) + '</td><td>' + a.y.toFixed(2) + '</td><td>' + a.z.toFixed(2) + '</td></tr>').join('') +
      '</tbody></table><span class="small">실제 좌표는 설치 후 안테나 중심을 실측해 <code>anchors.csv</code>에 적는다.</span></div>' +
      '<div class="blk"><h3>USB 케이블 길이</h3><span class="small">' + esc(modeText) + '. 벽을 따라 바닥까지 내린 뒤 벽 아래로 충전기까지, 여유 0.3 m.</span><table><thead><tr><th>앵커</th><th>필요 길이</th><th>3 m</th></tr></thead><tbody>' +
      cables.map(c => '<tr><td>A' + c.id + '</td><td>' + c.len.toFixed(1) + ' m</td><td class="' + (c.over ? 'bad' : 'good') + '">' + (c.over ? '부족' : '닿음') + '</td></tr>').join('') +
      '</tbody></table>' +
      (ok < cables.length
        ? '<span class="warnbox">3 m 케이블로 닿는 앵커 ' + ok + ' / ' + cables.length + '대. 가장 먼 앵커는 ' + maxLen.toFixed(1) + ' m가 필요하다. 충전기를 나눠 두거나 더 긴 케이블을 쓰고, 긴 케이블은 앵커 쪽 5 V를 멀티미터로 확인한다.</span>'
        : '<span class="small">6대 모두 3 m 케이블로 닿는다.' + (st.charger === 'each' ? ' 대신 콘센트(멀티탭)가 앵커 6곳 아래에 있어야 한다.' : '') + '</span>') + '</div>' +
      '<div class="blk"><h3>GT 카메라 화각</h3><dl class="kv"><dt>위치</dt><dd>남서 모서리 ' + cam.pos[2].toFixed(2) + ' m</dd><dt>1.2 m 평면 중 보이는 면적</dt><dd>' + pct(cover) + '</dd><dt>정지 15점 중 화각 안</dt><dd>' + seen + ' / 15</dd></dl>' +
      '<span class="small">Camera Module 3 Wide 102° × 67° 기준. 카메라 바로 아래 모서리는 화각 밖이 되기 쉽다.</span></div>';
  }

  ['room-w', 'room-l', 'room-h'].forEach(id => $(id).addEventListener('change', () => {
    const v = k => { const el = $(k), x = parseFloat(el.value), lo = +el.min, hi = +el.max; const y = isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; el.value = y; return y; };
    st.room = { w: v('room-w'), l: v('room-l'), h: v('room-h') };
    showDev($('env-view'), null);
    buildEnv(false);
    buildTest(T.list[st.test].env === 'corridor');
  }));
  $('charger').addEventListener('change', e => { st.charger = e.target.value; buildEnv(true); });
  $('show-fov').addEventListener('change', e => { st.fov = e.target.checked; buildEnv(true); });

  // ---- 2. 테스트 시뮬레이션 ----
  let run = null, tenv = null, lastUi = 0;
  const testHost = $('test-view');
  const testView = S.createView(testHost, { onPick: info => showDev(testHost, info, tenv), onFrame });
  const hud = document.createElement('div'); hud.className = 'hud';
  hud.innerHTML = '<span class="rec" id="hud-rec"><i></i><span>기록 안 함</span></span><span class="now" id="hud-now"></span>';
  testHost.appendChild(hud);
  overlay(testHost,
    '<span><i style="background:var(--ok)"></i>LOS</span><span><i style="background:var(--edge)"></i>경계</span><span><i style="background:var(--block)"></i>가림</span><span><i style="background:var(--radio)"></i>Wi-Fi 전송</span>',
    '드래그 회전 · 휠 확대 · 태그 클릭');

  function renderTabs() {
    $('test-tabs').innerHTML = T.list.map((t, i) =>
      '<button type="button" class="tab" role="tab" id="tab-' + t.id + '" aria-selected="' + (i === st.test) + '" data-i="' + i + '"><span class="no">' + t.no + '</span>' + esc(t.name) + '</button>').join('');
    $('test-tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => selectTest(+b.dataset.i)));
  }
  function selectTest(i) {
    const prevCorr = T.list[st.test].env === 'corridor';
    st.test = i; st.tagH = T.list[i].tagH.def; st.t = 0;
    $('test-tabs').querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.i === i)));
    showDev(testHost, null);
    buildTest(!!run && prevCorr === (T.list[i].env === 'corridor'));
    renderTestSide(); renderTestInfo();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) st.playing = true;
    playBtn();
  }
  function buildTest(keepCam) {
    const test = T.list[st.test];
    tenv = test.env === 'corridor' ? T.corridorEnv() : roomEnv();
    const P = { tagH: test.tagH.fixed ? test.tagH.def : st.tagH };
    run = T.run(test, tenv, P); run.tagH = P.tagH;
    testView.setEnv(tenv, { showFov: test.gt && tenv.camera, fovH: P.tagH, keepCamera: keepCam });
    testView.setTest(run);
    st.t = Math.min(st.t, run.total);
    $('scrub').max = run.total.toFixed(1);
    renderStats();
  }

  function renderTestSide() {
    const test = T.list[st.test], h = test.tagH;
    $('test-side').innerHTML =
      '<div class="blk"><h3>' + test.no + '. ' + esc(test.name) + '</h3><span class="small">' + esc(test.mount) + ' · <span id="tt-total"></span></span>' +
      (h.fixed ? '' : '<div class="param"><label for="tag-h">태그 높이</label><input type="range" id="tag-h" min="' + h.min + '" max="' + h.max + '" step="0.05" value="' + st.tagH + '"><span class="mono" id="tag-h-v">' + st.tagH.toFixed(2) + ' m</span></div>') + '</div>' +
      '<div class="blk"><h3>진행 순서</h3><ol class="steps" id="tt-steps">' + test.steps.map((s, i) => '<li data-i="' + i + '">' + esc(s) + '</li>').join('') + '</ol></div>' +
      '<div class="blk"><h3>지금</h3><dl class="kv"><dt>경과</dt><dd id="lv-t"></dd><dt>기록한 시간</dt><dd id="lv-rec"></dd><dt>UWB 사이클 (10 Hz)</dt><dd id="lv-uwb"></dd><dt>IMU 샘플 (208 Hz)</dt><dd id="lv-imu"></dd><dt>GT 카메라</dt><dd id="lv-gt"></dd></dl>' +
      '<div class="chips" id="lv-chips"></div></div>' +
      '<div class="blk"><h3>기록 구간 전체 · 앵커별 링크</h3><div class="bars" id="tt-bars"></div><span class="small" id="tt-gt"></span></div>';
    const r = $('tag-h');
    if (r) r.addEventListener('input', () => { st.tagH = +r.value; $('tag-h-v').textContent = st.tagH.toFixed(2) + ' m'; buildTest(true); });
    renderStats();
  }
  function renderStats() {
    if (!$('tt-bars') || !run) return;
    $('tt-total').textContent = '총 ' + fmt(run.total) + ', 기록 ' + fmt(run.recTotal);
    const s = run.stats;
    $('tt-bars').innerHTML = tenv.anchors.map((a, i) => {
      const c = s.cnt[i], n = Math.max(1, c.los + c.edge + c.block);
      return '<div class="bar"><span>A' + a.id + '</span><span class="track"><i style="width:' + (c.los / n * 100) + '%;background:var(--ok)"></i><i style="width:' + (c.edge / n * 100) + '%;background:var(--edge)"></i><i style="width:' + (c.block / n * 100) + '%;background:var(--block)"></i></span><span class="v">' + (c.block ? '가림 ' + pct(c.block / n) : c.edge ? '경계 ' + pct(c.edge / n) : 'LOS') + '</span></div>';
    }).join('');
    const g = s.gt;
    if (g) {
      const n = Math.max(1, g.ok + g.out + g.hidden);
      $('tt-gt').textContent = 'GT 카메라에서 태그가 보인 시간 ' + pct(g.ok / n) + ' · 화각 밖 ' + pct(g.out / n) + ' · 사람·팬텀에 가림 ' + pct(g.hidden / n);
    } else $('tt-gt').textContent = '이 테스트는 카메라 GT를 쓰지 않는다.';
  }
  function renderTestInfo() {
    const t = T.list[st.test];
    $('test-info').innerHTML =
      '<div class="card"><h3>목적</h3><p>' + esc(t.purpose) + '</p></div>' +
      '<div class="card"><h3>준비</h3><ul>' + t.prep.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' +
      '<div class="card"><h3>기록되는 것</h3><p>' + esc(t.records) + '</p></div>' +
      '<div class="card"><h3>주의·확인</h3><ul>' + t.notes.map(p => '<li>' + p + '</li>').join('') + '</ul></div>';
  }

  function onFrame(dt, now) {
    if (!run) return;
    if (st.playing && !st.scrubbing) {
      st.t += dt * st.speed;
      if (st.t >= run.total) { st.t = run.total; st.playing = false; playBtn(); }
    }
    const s = T.stateAt(run.tl, st.t), boxes = T.obstacles(s), p = [s.x, s.y, s.z];
    const status = tenv.anchors.map(a => G.link(p, [a.x, a.y, a.z], boxes));
    testView.applyState(s, status, now);
    if (now - lastUi > 0.1) { lastUi = now; live(s, status, boxes, p); }
  }
  function live(s, status, boxes, p) {
    const test = T.list[st.test];
    const rec = $('hud-rec');
    rec.classList.toggle('on', s.seg.rec);
    rec.lastChild.textContent = s.seg.rec ? '기록 중' + (s.seg.stream ? ' · Wi-Fi 전송' : ' · PSRAM 저장') : (s.seg.upload ? '업로드 중' : '기록 안 함');
    $('hud-now').textContent = s.label;
    if (!st.scrubbing) $('scrub').value = st.t.toFixed(1);
    $('time').textContent = fmt(st.t) + ' / ' + fmt(run.total);
    if (!$('lv-t')) return;
    $('lv-t').textContent = fmt(st.t);
    $('lv-rec').textContent = fmt(s.recT);
    $('lv-uwb').textContent = nf(s.recT * S.RATES.uwbHz);
    $('lv-imu').textContent = nf(s.recT * S.RATES.imuHz);
    let gt = '안 씀';
    if (test.gt && tenv.camera) gt = { ok: '보임', out: '화각 밖', hidden: '가림' }[G.gtStatus(tenv.camera, p, boxes)];
    $('lv-gt').textContent = gt;
    $('tt-steps').querySelectorAll('li').forEach(li => li.classList.toggle('cur', +li.dataset.i === s.seg.step));
    const word = { los: 'LOS', edge: '경계', block: '가림' };
    $('lv-chips').innerHTML = tenv.anchors.map((a, i) => '<span class="chip ' + status[i] + '">A' + a.id + ' ' + word[status[i]] + '</span>').join('');
  }

  // ---- 재생 ----
  function playBtn() { $('play').textContent = st.playing ? '일시정지' : '재생'; }
  $('play').addEventListener('click', () => {
    if (!st.playing && run && st.t >= run.total - 0.01) st.t = 0;
    st.playing = !st.playing; playBtn();
  });
  $('restart').addEventListener('click', () => { st.t = 0; });
  $('speed').addEventListener('change', e => { st.speed = +e.target.value; });
  const scrub = $('scrub');
  scrub.addEventListener('pointerdown', () => { st.scrubbing = true; });
  window.addEventListener('pointerup', () => { st.scrubbing = false; });
  scrub.addEventListener('input', () => { st.t = +scrub.value; });

  // ---- 테마가 바뀌면 색을 다시 읽어 다시 그림 ----
  function retheme() { buildEnv(true); buildTest(true); }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  renderEquip();
  buildEnv(false);
  renderTabs();
  selectTest(st.test);
})(window.SIM);
