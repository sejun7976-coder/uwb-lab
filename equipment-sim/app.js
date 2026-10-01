// 화면 구성: 1. 테스트 시뮬레이션 (공간 A의 최적 앵커 배치, 복도는 공간 C). 공간 설계는 env.html
(function (S) {
  const G = S.geom, T = S.tests;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const nf = n => Math.round(n).toLocaleString('ko-KR');
  const pct = x => Math.round(x * 100) + '%';
  const AIM_H = 1.2;   // 카메라가 겨누는 태그 높이 평면 (호모그래피 평면)

  const q0 = new URLSearchParams(location.search);
  const st = {
    test: /^[0-7]$/.test(q0.get('test') || '') ? +q0.get('test') : 1, tagH: 1.2, t: 0, speed: 30, scrubbing: false, space: q0.get('space') === 'B' ? 'B' : 'A',
    playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };
  // 공간 A·B (가정 크기)와 테스트 공간 시뮬레이터(env.html)의 최적 배치 · 보조 노드 · 공유기 · GT 카메라를 그대로 쓴다
  const envCache = {};
  function roomEnv(id) {
    id = id || 'A';
    if (envCache[id]) return envCache[id];
    const E = S.ENV, O = S.envOpt, sp = E.SPACES[id], room = { w: sp.w, l: sp.l, h: sp.h };
    const pre = O.precompute(sp, AIM_H, E.GRID_STEP, 0.5);
    const sel = (S.ENV_PRESETS && S.ENV_PRESETS[id]) ? S.ENV_PRESETS[id].sel : O.baseline(pre);
    const anchors = O.anchorsOf(pre, sel), aux = O.placeAux(pre, anchors, 3), router = O.placeRouter(pre, anchors, aux);
    const cs = O.placeCameras(pre), set = cs.one.cover >= 0.95 ? cs.one : cs.two;
    const cameras = set.cams.map(c => ({ pos: c.pos, tgt: c.tgt, hfov: O.CAM.hfov, vfov: O.CAM.vfov, corner: c.corner }));
    const obstacles = sp.obstacles.map(o => ({ kind: o.kind, name: o.name, x: o.x, y: o.y, z0: o.z0, z1: o.z1, hx: o.hx, hy: o.hy, rot: 0 }));
    envCache[id] = { id, room, anchors, cameras, camera: cameras[0], desk: true, router, aux: aux[0], obstacles, space: sp };
    return envCache[id];
  }

  // ---- 장치 구성 카드 (클릭) ----
  function showDev(host, info, env) {
    let card = host.querySelector('.devcard');
    if (!info) { if (card) card.remove(); return; }
    const d = S.DEVICES[info.kind];
    if (!d) return;
    let title = { tag: '태그', camera: 'GT 카메라', desk: '노트북 (방 밖)', router: '공유기', phantom: '물 팬텀', aux: '보조 Wi-Fi 노드 (S1)', obstacle: '장애물' }[info.kind] || '';
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

  // ---- 1. 테스트 시뮬레이션 ----
  let run = null, tenv = null, lastUi = 0;
  const testHost = $('test-view');
  const testView = S.createView(testHost, { onPick: info => showDev(testHost, info, tenv), onFrame });
  const hud = document.createElement('div'); hud.className = 'hud';
  hud.innerHTML = '<span class="rec" id="hud-rec"><i></i><span>기록 안 함</span></span><span class="now" id="hud-now"></span>';
  testHost.appendChild(hud);
  // 3D 화면 안 공간 전환 (임베드에서도 보이게). 1·2·6번에서만 나온다
  const spaceBox = document.createElement('div'); spaceBox.className = 'seg space-in-view'; spaceBox.setAttribute('role', 'group'); spaceBox.setAttribute('aria-label', '공간');
  testHost.appendChild(spaceBox);
  spaceBox.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled && b.dataset.sp) setSpace(b.dataset.sp); });
  function setSpace(k) { if (k === st.space) return; st.space = k; st.t = 0; showDev(testHost, null); buildTest(false); renderTestSide(); }
  // 항상 보이게: B를 쓰지 않는 테스트는 B를 비활성화하고 이유를 적는다. 7번은 공간 C
  function renderSpaceBox() {
    const test = T.list[st.test];
    if (test.env === 'corridor') { spaceBox.innerHTML = '<button type="button" aria-pressed="true" disabled>공간 C · 복도</button>'; return; }
    const ok = test.spaces || ['A'], cur = ok.includes(st.space) ? st.space : 'A';
    spaceBox.innerHTML = ['A', 'B'].map(k => {
      const can = ok.includes(k);
      return '<button type="button" data-sp="' + k + '" aria-pressed="' + (cur === k) + '"' + (can ? '' : ' disabled title="공간 B는 1 · 2 · 6번에서 반복한다"') + '>공간 ' + k + (k === 'B' ? ' · 장애물' : '') + '</button>';
    }).join('') + (ok.includes('B') ? '' : '<span class="seg-note">B는 1·2·6번</span>');
  }
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
  let lastEnvKey = '';
  function buildTest(keepCam) {
    const test = T.list[st.test];
    const spId = test.spaces && test.spaces.includes(st.space) ? st.space : 'A';   // 공간 선택은 1·2·6번에만, 나머지는 A
    tenv = test.env === 'corridor' ? T.corridorEnv() : roomEnv(spId);
    if (lastEnvKey !== (tenv.id || 'C')) { keepCam = false; lastEnvKey = tenv.id || 'C'; }
    const P = { tagH: test.tagH.fixed ? test.tagH.def : st.tagH };
    run = T.run(test, tenv, P); run.tagH = P.tagH;
    testView.setEnv(tenv, { showFov: test.gt && T.cams(tenv).length, fovH: P.tagH, keepCamera: keepCam });
    testView.setTest(run);
    st.t = Math.min(st.t, run.total);
    $('scrub').max = run.total.toFixed(1);
    renderStats();
  }

  function renderTestSide() {
    const test = T.list[st.test], h = test.tagH;
    $('test-side').innerHTML =
      '<div class="blk"><h3>' + test.no + '. ' + esc(test.name) + '</h3><span class="small">' + esc(test.mount) + ' · <span id="tt-total"></span></span>' +
      (test.spaces ? '<div class="param"><span>공간</span><div class="seg" id="tt-space">' + test.spaces.map(k => '<button type="button" data-sp="' + k + '" aria-pressed="' + (st.space === k) + '">' + esc(S.ENV.SPACES[k].name) + '</button>').join('') + '</div></div>' +
        '<span class="small">' + esc(S.ENV.SPACES[st.space].w + ' × ' + S.ENV.SPACES[st.space].l + ' m (가정) · ' + S.ENV.SPACES[st.space].role) + '</span>' : '<span class="small">' + (test.env === 'corridor' ? '공간 C 복도 (가정 ' + S.ENV.SPACES.C.w + ' × ' + S.ENV.SPACES.C.l + ' m)' : '공간 A 기본 방 (가정 ' + S.ENV.SPACES.A.w + ' × ' + S.ENV.SPACES.A.l + ' m)') + '</span>') +
      (h.fixed ? '' : '<div class="param"><label for="tag-h">태그 높이</label><input type="range" id="tag-h" min="' + h.min + '" max="' + h.max + '" step="0.05" value="' + st.tagH + '"><span class="mono" id="tag-h-v">' + st.tagH.toFixed(2) + ' m</span></div>') + '</div>' +
      '<div class="blk"><h3>진행 순서</h3><ol class="steps" id="tt-steps">' + test.steps.map((s, i) => '<li data-i="' + i + '">' + esc(s) + '</li>').join('') + '</ol></div>' +
      '<div class="blk"><h3>지금</h3><dl class="kv"><dt>경과</dt><dd id="lv-t"></dd><dt>기록한 시간</dt><dd id="lv-rec"></dd><dt>UWB 사이클 (10 Hz)</dt><dd id="lv-uwb"></dd><dt>IMU 샘플 (208 Hz)</dt><dd id="lv-imu"></dd><dt>GT 카메라</dt><dd id="lv-gt"></dd></dl>' +
      '<div class="chips" id="lv-chips"></div></div>' +
      '<div class="blk"><h3>기록 구간 전체 · 앵커별 링크</h3><div class="bars" id="tt-bars"></div><span class="small" id="tt-gt"></span></div>';
    const sb = $('tt-space');
    if (sb) sb.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSpace(b.dataset.sp); });
    renderSpaceBox();
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
      $('tt-gt').textContent = 'GT 카메라' + (T.cams(tenv).length > 1 ? ' ' + T.cams(tenv).length + '대 중 하나라도' : '') + '에서 태그가 보인 시간 ' + pct(g.ok / n) + ' · 화각 밖 ' + pct(g.out / n) + ' · 사람·팬텀·장애물에 가림 ' + pct(g.hidden / n);
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
    const s = T.stateAt(run.tl, st.t), boxes = T.obstacles(s, tenv), p = [s.x, s.y, s.z];
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
    if (test.gt && T.cams(tenv).length) gt = { ok: '보임', out: '화각 밖', hidden: '가림' }[T.gt(tenv, p, boxes)] + (T.cams(tenv).length > 1 ? ' (카메라 ' + T.cams(tenv).length + '대)' : '');
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
  function retheme() { buildTest(true); }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  renderTabs();
  selectTest(st.test);
})(window.SIM);
