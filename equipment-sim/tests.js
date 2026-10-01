// 테스트 정의와 타임라인. 각 테스트는 구간(segment) 목록으로 태그·사람·팬텀의 위치를 시간에 따라 정한다.
(function (S) {
  const G = S.geom;
  const T = S.tests = {};
  const HALF_PI = Math.PI / 2;

  // ---- 타임라인 ----
  function TL() { this.segs = []; this.t = 0; this.hd = HALF_PI; this.recT = 0; }
  TL.prototype.add = function (dur, o) {
    const s = Object.assign({ rec: false, stream: true, adv: true, upload: false, person: 'none', mount: 'tripod',
      phantom: null, attach: null, label: '', step: 0, path: [[0, 0]], z: 1.2 }, o);
    s.t0 = this.t; s.t1 = this.t + dur; s.dur = dur; s.rec0 = this.recT;
    if (s.path.length > 1) {
      s.cum = [0];
      for (let i = 1; i < s.path.length; i++) {
        s.cum.push(s.cum[i - 1] + Math.hypot(s.path[i][0] - s.path[i - 1][0], s.path[i][1] - s.path[i - 1][1]));
      }
      s.plen = s.cum[s.cum.length - 1];
      const a = s.path[s.path.length - 2], b = s.path[s.path.length - 1];
      this.hd = Math.atan2(b[1] - a[1], b[0] - a[0]);
    } else {
      s.hd = this.hd;
      if (s.hdTo != null) this.hd = s.hdTo;
    }
    if (s.rec) this.recT += dur;
    this.t += dur; this.segs.push(s);
    return s;
  };
  TL.prototype.move = function (path, speed, o) {
    let d = 0;
    for (let i = 1; i < path.length; i++) d += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return this.add(Math.max(d / speed, 0.5), Object.assign({ path }, o));
  };

  T.stateAt = function (tl, t) {
    t = Math.max(0, Math.min(tl.t - 1e-6, t));
    let s = tl.segs[tl.segs.length - 1];
    for (const g of tl.segs) if (t < g.t1) { s = g; break; }
    const a = s.dur > 0 ? (t - s.t0) / s.dur : 1;
    let x, y, hd, d = 0;
    if (s.path.length > 1) {
      d = a * s.plen;
      let i = 1;
      while (i < s.cum.length - 1 && s.cum[i] < d) i++;
      const p0 = s.path[i - 1], p1 = s.path[i], sl = s.cum[i] - s.cum[i - 1];
      const u = sl > 0 ? (d - s.cum[i - 1]) / sl : 0;
      x = p0[0] + (p1[0] - p0[0]) * u; y = p0[1] + (p1[1] - p0[1]) * u;
      hd = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    } else {
      x = s.path[0][0]; y = s.path[0][1];
      hd = s.hdTo != null ? lerpAngle(s.hd, s.hdTo, a) : s.hd;
    }
    let ph = null;
    if (s.phantom) {
      const r = s.phantom.rot0 + (s.phantom.rot1 - s.phantom.rot0) * a;
      ph = { x: s.phantom.x, y: s.phantom.y, rot: r };
      if (s.attach) {
        const c = Math.cos(r), sn = Math.sin(r);
        x = ph.x + s.attach[0] * c - s.attach[1] * sn;
        y = ph.y + s.attach[0] * sn + s.attach[1] * c;
        hd = r + HALF_PI;   // 태그 → 팬텀 방향
      }
    }
    let person = null;
    if (s.person === 'push') person = { x: x - Math.cos(hd) * 0.6, y: y - Math.sin(hd) * 0.6, hd, pose: 'push' };
    else if (s.person === 'walk') person = { x, y, hd, pose: 'walk' };
    else if (s.person === 'carry') person = { x: x - Math.cos(hd) * 0.45, y: y - Math.sin(hd) * 0.45, hd, pose: 'stand' };
    else if (s.person === 'at') person = { x: s.personAt[0], y: s.personAt[1], hd: Math.atan2(y - s.personAt[1], x - s.personAt[0]), pose: 'stand' };
    let label = s.label;
    if (s.lapLen) label += ' · ' + Math.min(s.laps, Math.floor(d / s.lapLen + 1e-9) + 1) + '/' + s.laps + '바퀴';
    return { t, seg: s, x, y, z: s.z, hd, phantom: ph, person, recT: s.rec0 + (s.rec ? t - s.t0 : 0), label };
  };
  function lerpAngle(a, b, u) {
    let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return a + d * u;
  }

  T.obstacles = function (st) {
    const out = [];
    if (st.phantom) out.push({ kind: 'phantom', x: st.phantom.x, y: st.phantom.y, z0: 0, z1: S.PHANTOM.h, hx: S.PHANTOM.hx, hy: S.PHANTOM.hy, rot: st.phantom.rot });
    if (st.person) out.push({ kind: 'person', x: st.person.x, y: st.person.y, z0: 0, z1: S.PERSON.h, hx: S.PERSON.hx, hy: S.PERSON.hy, rot: st.person.hd - HALF_PI });
    return out;
  };

  // 기록 구간 전체에서 앵커별 LOS·경계·가림 비율과 카메라 GT 상태 비율
  T.stats = function (run, env, test) {
    const tl = run.tl, dt = Math.max(0.5, tl.t / 2500);
    const cnt = env.anchors.map(() => ({ los: 0, edge: 0, block: 0 }));
    const gt = { ok: 0, out: 0, hidden: 0 };
    let n = 0;
    for (let t = 0; t < tl.t; t += dt) {
      const st = T.stateAt(tl, t);
      if (!st.seg.rec) continue;
      n++;
      const boxes = T.obstacles(st), p = [st.x, st.y, st.z];
      env.anchors.forEach((a, i) => { cnt[i][G.link(p, [a.x, a.y, a.z], boxes)]++; });
      if (test.gt && env.camera) gt[G.gtStatus(env.camera, p, boxes)]++;
    }
    return { cnt, gt: test.gt && env.camera ? gt : null, n };
  };

  // ---- 경로 도우미 ----
  T.gridPoints = function (room) {
    const mx = Math.min(0.6, room.w * 0.2), my = Math.min(0.6, room.l * 0.2);
    const xs = [mx, room.w / 2, room.w - mx], pts = [];
    for (let j = 0; j < 5; j++) {
      const y = my + (room.l - 2 * my) * j / 4;
      const row = xs.map(x => [x, y]);
      if (j % 2) row.reverse();
      row.forEach(p => pts.push(p));
    }
    return pts;
  };
  function loopPath(room) {
    const m = Math.min(0.6, room.w * 0.2, room.l * 0.2);
    return [[m, m], [m, room.l - m], [room.w - m, room.l - m], [room.w - m, m], [m, m]];
  }
  function laps(loop, n) {
    const out = [loop[0]];
    for (let k = 0; k < n; k++) loop.slice(1).forEach(p => out.push(p));
    return out;
  }
  function loopLen(loop) {
    let d = 0;
    for (let i = 1; i < loop.length; i++) d += Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]);
    return d;
  }

  // ---- 테스트 목록 ----
  // tagH: 삼각대 태그 높이 기본값과 조절 범위 (fixed면 고정)
  T.list = [
    {
      id: 'calib', no: '0', name: '안테나 지연 보정', mount: '삼각대 · 태그 2.0 m', gt: false,
      tagH: { fixed: true, def: 2.0 },
      purpose: 'DWM3000의 안테나 지연 값을 맞춰 거리의 고정 오프셋을 없앤다. 다른 테스트 전에 한 번 한다.',
      prep: ['태그를 삼각대에 올려 앵커 1과 같은 높이(2.0 m)로 맞춘다', '줄자로 두 안테나 중심 사이를 3.000 m로 맞춘다 (두 사람이 팽팽하게, 끝 고리 대신 10 cm 눈금 기준)'],
      steps: ['3.000 m 지점에 태그를 세우고 거리를 잰다', '사람은 방 밖으로 나가고 60초 기록', '보정값 계산 후 태그와 모든 앵커에 입력'],
      records: '앵커 1과의 거리 약 600개. 나머지 앵커도 켜져 있으면 함께 기록된다.',
      notes: ['<code>python tools/uwb_monitor.py calib 로그.csv --anchor 1 --true-dist 3.000</code> → 시리얼에서 <code>ant 값</code>', '삼각대가 2.0 m까지 안 올라가면 앵커 1을 벽에서 떼어 태그와 같은 높이에서 보정한 뒤 다시 붙인다'],
      build(env) {
        const tl = new TL(), a1 = env.anchors[0], room = env.room;
        let dx = room.w / 2 - a1.x, dy = room.l / 2 - a1.y;
        const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
        let d = 3.0;
        const inside = k => { const x = a1.x + dx * k, y = a1.y + dy * k; return x < room.w - 0.3 && y < room.l - 0.3; };
        while (d > 1 && !inside(d)) d -= 0.1;
        const p = [a1.x + dx * d, a1.y + dy * d], z = a1.z;
        const side = [(a1.x + p[0]) / 2 + dy * 0.6, (a1.y + p[1]) / 2 - dx * 0.6];
        tl.hd = Math.atan2(-dy, -dx);
        tl.add(40, { path: [p], z, person: 'at', personAt: side, step: 0, label: '안테나 중심 사이 ' + d.toFixed(3) + ' m 맞추기' });
        tl.add(60, { path: [p], z, rec: true, step: 1, label: '60초 기록 · 사람은 방 밖' });
        tl.add(20, { path: [p], z, step: 2, label: '보정값 계산 → ant 입력' });
        return { tl, points: [p], distTo: 0 };
      }
    },
    {
      id: 'static', no: '1', name: '정지 15점', mount: '삼각대', gt: true,
      tagH: { def: 1.2, min: 0.8, max: 1.6 },
      purpose: '정지 상태의 기본 정확도(UWB·Wi-Fi RSS·BLE RSS 각각)를 재고, 카메라 GT 오차를 검증한다.',
      prep: ['바닥에 15점(3 × 5 격자)을 테이프로 표시하고 좌표를 줄자로 실측한다', '태그 높이는 모든 점에서 같게 (호모그래피 평면)'],
      steps: ['1번 점에 삼각대를 세운다', '방 밖으로 나가 60초 기록 (LED 동기화 점멸 포함)', '다음 점으로 옮긴다 (20초, 기록 안 함)'],
      records: '점마다 UWB 600사이클(앵커 6개 거리 + 수신 진단값), IMU 약 12,500샘플, Wi-Fi·BLE RSSI.',
      notes: ['측정 중 사람이 방 안에 있으면 몸이 가림이 된다. 기록할 때는 방 밖에서 노트북으로 확인', '카메라 화각 밖인 점은 GT 검증에서 빠진다. 3D에서 주황 점 번호와 오른쪽 GT 비율을 확인', '관측 부족 조건(앵커 6 → 4 → 3 → 2)은 따로 실험하지 않고 이 기록에서 앵커를 빼서 만든다', '공간 B(장애물 공간)에서 같은 순서로 한 번 더 한다 (테스트 공간 시뮬레이터의 B 배치)'],
      build(env, P) {
        const tl = new TL(), pts = T.gridPoints(env.room), z = P.tagH;
        tl.add(30, { path: [pts[0]], z, person: 'carry', step: 0, label: '1번 점에 삼각대 설치' });
        pts.forEach((p, i) => {
          if (i > 0) tl.move([pts[i - 1], p], 0.4, { z, person: 'carry', step: 2, label: (i + 1) + '번 점으로 옮김' });
          tl.add(60, { path: [p], z, rec: true, step: 1, label: (i + 1) + ' / 15번 점 기록' });
        });
        return { tl, points: pts };
      }
    },
    {
      id: 'cart', no: '2', name: '카트 이동', mount: '카트 위 삼각대', gt: true,
      tagH: { def: 1.2, min: 0.9, max: 1.6 },
      purpose: '고정 높이 등속 이동에서 UWB·IMU·RSS를 비교한다. 같은 경로를 반복해 조건 간 비교가 공정하게 한다.',
      prep: ['벽에서 0.6 m 안쪽 사각 경로를 바닥 테이프로 표시', '카트 위 삼각대에 태그, 사람은 뒤에서 민다'],
      steps: ['출발점에서 20초 정지 (IMU 정지 구간, LED 동기화)', '시계 방향 5바퀴, 약 0.5 m/s', '제자리에서 돌아 반시계 방향 5바퀴', '도착 후 10초 정지'],
      records: '전체 약 4분 연속 기록. 바퀴마다 같은 경로라 바퀴 사이 편차도 볼 수 있다.',
      notes: ['미는 사람 몸이 뒤쪽 앵커를 가린다. 오른쪽 앵커별 가림 비율 참고', '방향을 반대로도 돌면 몸 가림이 특정 앵커에 몰리지 않는다', '가림을 줄이려면 손잡이를 길게 하거나, 몸 가림을 조건으로 명시', '공간 B에서도 같은 경로로 반복한다'],
      build(env, P) {
        const tl = new TL(), loop = loopPath(env.room), ll = loopLen(loop), z = P.tagH, o = { z, mount: 'cart', person: 'push', rec: true };
        const rev = loop.slice().reverse();
        tl.add(20, Object.assign({ path: [loop[0]], step: 0, label: '출발점 정지' }, o));
        tl.move(laps(loop, 5), 0.5, Object.assign({ step: 1, label: '시계 방향', lapLen: ll, laps: 5 }, o));
        tl.add(8, Object.assign({ path: [loop[0]], hdTo: Math.atan2(rev[1][1] - rev[0][1], rev[1][0] - rev[0][0]), step: 2, label: '방향 바꾸기' }, o));
        tl.move(laps(rev, 5), 0.5, Object.assign({ step: 2, label: '반시계 방향', lapLen: ll, laps: 5 }, o));
        tl.add(10, Object.assign({ path: [loop[0]], step: 3, label: '도착 정지' }, o));
        return { tl, loop };
      }
    },
    {
      id: 'phantom', no: '3', name: '물 팬텀 가림', mount: '물 팬텀 + 삼각대', gt: true,
      tagH: { def: 1.0, min: 0.5, max: 1.3 },
      purpose: '몸 가림(NLOS)에서 UWB가 얼마나 나빠지는지 본다. 팬텀을 90°씩 돌려 가려지는 앵커를 바꾼다.',
      prep: ['2L 생수 6개입을 4단(약 1.3 m)으로 방 가운데 쌓는다', '옆 배치: 태그를 팬텀 긴 면 3 cm 앞, 윗면보다 충분히 낮게', '위 배치: 태그를 팬텀 윗면 가운데 (헬멧 상황)'],
      steps: ['팬텀을 쌓고 태그를 옆에 둔다', '60초 기록', '팬텀과 태그를 함께 90° 돌린다 (0° → 90° → 180° → 270°)', '태그를 팬텀 위로 옮긴다', '위 배치 60초 기록'],
      records: '옆 배치 4방향 × 60초 + 위 배치 60초. 조건마다 가려진 앵커가 다르다.',
      notes: ['태그 높이를 팬텀 윗면(1.3 m) 가까이 올려 보면 위쪽 앵커로 가는 선이 팬텀 위로 지나가 가림이 줄어든다', '위 배치는 앵커가 태그보다 높아서 거의 가려지지 않는다 (헬멧 상황의 비교 기준)'],
      build(env, P) {
        const tl = new TL(), c = [env.room.w / 2, env.room.l / 2], z = P.tagH;
        const side = [0, -(S.PHANTOM.hy + 0.03)], top = [0, 0], zTop = S.PHANTOM.h + 0.04;
        const ph = (r0, r1) => ({ x: c[0], y: c[1], rot0: r0 * Math.PI / 180, rot1: r1 * Math.PI / 180 });
        tl.add(60, { phantom: ph(0, 0), attach: side, z, person: 'carry', step: 0, label: '팬텀 쌓기, 태그 옆 배치' });
        [0, 90, 180, 270].forEach((deg, i) => {
          if (i > 0) tl.add(15, { phantom: ph(deg - 90, deg), attach: side, z, person: 'carry', step: 2, label: deg + '°로 돌림' });
          tl.add(60, { phantom: ph(deg, deg), attach: side, z, rec: true, step: 1, label: '옆 배치 ' + deg + '° 기록' });
        });
        tl.add(30, { phantom: ph(270, 360), attach: top, z: zTop, mount: 'top', person: 'carry', step: 3, label: '태그를 팬텀 위로' });
        tl.add(60, { phantom: ph(360, 360), attach: top, z: zTop, mount: 'top', rec: true, step: 4, label: '위 배치 기록' });
        return { tl };
      }
    },
    {
      id: 'interf', no: '4', name: '간섭 검증', mount: '카트 위 삼각대', gt: true,
      tagH: { def: 1.2, min: 0.9, max: 1.6 },
      purpose: 'Wi-Fi 실시간 전송과 앵커의 AP·BLE 광고가 UWB에 영향을 주는지, 같은 경로를 4가지 조건으로 돌아 비교한다.',
      prep: ['2번과 같은 바닥 경로', '공유기와 앵커 AP를 채널 1·6·11 중 하나로 고정, 20 MHz', '실험 중 휴대폰 무선 끄기'],
      steps: ['주변 AP를 스캔해 가장 조용한 채널을 고른다', '조건 A: 전송 켬 · 광고 켬 → 3바퀴', '조건 B: 전송 끔(PSRAM 기록) · 광고 켬 → 3바퀴 → 업로드', '조건 C: 전송 켬 · 광고 끔 → 3바퀴', '조건 D: 전송 끔 · 광고 끔 → 3바퀴 → 업로드'],
      records: '조건마다 UWB 성공률·거리 오차, Wi-Fi·BLE RSSI 샘플 수와 분산. 차이가 없으면 "간섭 영향 없음"을 수치로 제시.',
      notes: ['보라색 선 = 태그 → 공유기 실시간 전송, 앵커 둘레의 파동 = AP·BLE 광고', '앵커 광고를 켜고 끄는 방법(명령 경로)은 펌웨어에서 아직 정하지 않았다'],
      build(env, P) {
        const tl = new TL(), loop = loopPath(env.room), ll = loopLen(loop), z = P.tagH;
        const conds = [['A', true, true], ['B', false, true], ['C', true, false], ['D', false, false]];
        tl.add(30, { path: [loop[0]], z, mount: 'cart', person: 'carry', adv: false, step: 0, label: '주변 AP 스캔·채널 고정' });
        conds.forEach((c, i) => {
          const o = { z, mount: 'cart', person: 'push', stream: c[1], adv: c[2], step: i + 1 };
          tl.add(12, Object.assign({ path: [loop[0]], hdTo: HALF_PI, label: '조건 ' + c[0] + ' 설정' }, o));
          tl.move(laps(loop, 3), 0.5, Object.assign({ rec: true, label: '조건 ' + c[0], lapLen: ll, laps: 3 }, o));
          if (!c[1]) tl.add(20, Object.assign({}, o, { path: [loop[0]], stream: true, upload: true, label: 'PSRAM 기록 업로드' }));
        });
        return { tl, loop };
      }
    },
    {
      id: 'power', no: '5', name: '전력 분해', mount: '삼각대 · INA228 ①②', gt: false,
      tagH: { def: 1.2, min: 0.8, max: 1.6 },
      purpose: '기능을 하나씩 켜고 끈 조건(P0–P8)의 전력 차이로 UWB·IMU·Wi-Fi·BLE·전송 몫을 나눈다. 태그만 잰다. 정확도–에너지 비교의 전력표가 된다.',
      prep: ['사전 검증: 영점 1분, 알고 있는 저항 부하(②는 3.3 V / 33 Ω, ①은 5 V / 47 Ω)와 멀티미터로 1–2 % 안인지 확인', 'INA228 ① 보조배터리 → 태그 5 V 입력, ② ESP32 3V3 → DWM3000 3V3', '보조배터리 완충·저전류 모드, 모델명 기록. 태그 USB는 뺀다', '앵커 6대와 AP·BLE 광고를 본 실험과 같게 켠다. 사람은 방 밖, 휴대폰 무선 끔'],
      steps: ['BOOT 버튼으로 자동 시퀀스 시작, 2분 예열 (기록 안 함)', '조건마다 설정 → 10초 안정화 → 누적 초기화 → 60초 기록', 'P0–P8 9조건 × 3회, 미리 섞은 순서 (순서는 로그에 남김)', '끝나면 Wi-Fi를 켜고 PSRAM 기록을 노트북에 올린다'],
      records: '9조건 × 3회 × 60초, INA228 ①② 20 Hz 전력과 조건별 총 에너지(누적 레지스터), 이벤트 수(UWB 사이클·IMU 샘플·Wi-Fi 스캔·BLE 수신). 약 32분.',
      notes: ['P0 기준 · P1 UWB · P2 +IMU · P3 +Wi-Fi · P4 +BLE · P5 Wi-Fi+BLE · P6 +실시간 전송 · P7 Wi-Fi만 · P8 BLE만', 'Wi-Fi·BLE·IMU 몫은 전원선으로 나눌 수 없어서 켠 조건과 끈 조건의 차이로 구한다', 'P6만 실시간 전송을 켠다. 나머지는 PSRAM에 저장해 전송 비용이 섞이지 않게 한다', '측정 주기를 바꾼 조건(UWB 5·10·20 Hz 등)은 같은 방식으로 따로 한다', '상세: <code>실험/전력측정/전력측정_계획.md</code>'],
      build(env, P) {
        const tl = new TL(), p = [env.room.w / 2, env.room.l / 2], z = P.tagH;
        const C = ['P0 기준', 'P1 UWB', 'P2 +IMU', 'P3 +Wi-Fi', 'P4 +BLE', 'P5 Wi-Fi+BLE', 'P6 +전송', 'P7 Wi-Fi만', 'P8 BLE만'];
        const order = [];
        for (let r = 0; r < 3; r++) C.forEach((c, i) => order.push(i));
        for (let i = order.length - 1, s = 11; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const j = s % (i + 1); const t = order[i]; order[i] = order[j]; order[j] = t; }
        tl.add(30, { path: [p], z, person: 'carry', step: 0, label: '태그 설치, INA228 확인' });
        tl.add(120, { path: [p], z, stream: false, step: 0, label: '예열 2분 (기록 안 함)' });
        order.forEach((ci, k) => {
          tl.add(10, { path: [p], z, stream: false, step: 1, label: (k + 1) + '/27 ' + C[ci] + ' · 안정화' });
          tl.add(60, { path: [p], z, rec: true, stream: ci === 6, step: 1, label: (k + 1) + '/27 ' + C[ci] + ' · 60초 기록' });
        });
        tl.add(60, { path: [p], z, stream: true, upload: true, step: 3, label: 'PSRAM 기록 업로드' });
        return { tl, points: [p] };
      }
    },
    {
      id: 'helmet', no: '6', name: '안전모 보행', mount: '안전모 · 태그 약 1.75 m', gt: true,
      tagH: { fixed: true, def: 1.75 },
      purpose: '실제 휴대 상황(사람 몸, 걸음 흔들림)에서 전체 시스템을 최종 확인한다.',
      prep: ['안전모 위에 태그, 보조배터리는 주머니나 등', '2번과 같은 바닥 경로'],
      steps: ['출발점에 10초 서 있기 (LED 동기화)', '경로를 따라 약 0.8 m/s로 5바퀴 걷기', '도착 후 10초 정지'],
      records: '약 1분 30초 연속 기록. 2번 카트 결과와 같은 경로에서 비교.',
      notes: ['앵커가 태그보다 높아서 몸 가림은 거의 없고, 대신 걸음에 따른 흔들림이 IMU에 들어간다', '안전모 위 태그는 카메라에서 잘 보이지만 높이가 달라 호모그래피 평면(1.2 m)과 높이 차가 생긴다. 1.75 m 평면으로 따로 변환한다', '공간 B에서도 같은 경로로 반복한다'],
      build(env) {
        const tl = new TL(), loop = loopPath(env.room), ll = loopLen(loop), o = { z: 1.75, mount: 'helmet', person: 'walk', rec: true };
        tl.add(10, Object.assign({ path: [loop[0]], step: 0, label: '출발점 정지' }, o));
        tl.move(laps(loop, 5), 0.8, Object.assign({ step: 1, label: '걷기', lapLen: ll, laps: 5 }, o));
        tl.add(10, Object.assign({ path: [loop[0]], step: 2, label: '도착 정지' }, o));
        return { tl, loop };
      }
    },
    {
      id: 'corridor', no: '7', name: '복도 유효거리', mount: '삼각대 · 복도 (별도 공간)', gt: false,
      tagH: { fixed: true, def: 1.2 },
      env: 'corridor',
      purpose: 'BLE·Wi-Fi가 몇 m까지 쓸모 있는지, 거리별 RSSI와 수신율을 잰다. 테스트 방이 작아서 복도에서 따로 한다.',
      prep: ['직선 복도 15 m 이상 (그림은 공간 C 가정 2.4 × 20 m)', '기준 노드 1대(앵커와 같은 구성)를 남쪽 끝 삼각대 1.2 m에', '태그도 같은 높이, 거리 표시는 줄자로 바닥에'],
      steps: ['거리 d 표시에서 30초 기록', '다음 표시로 옮긴다 (1 · 2 · 3 · 5 · 7.5 · 10 · 12.5 · 15 · 17.5 m)'],
      records: '거리 9곳 × 30초. 거리별 RSSI 평균·분산, 수신율. 거리를 로그 간격에 가깝게 잡아 경로손실 모델을 맞추기 좋다. UWB 거리도 같이 남아 기준으로 쓴다.',
      notes: ['사람은 태그 뒤쪽 옆에 서서 기준점과 태그 사이를 막지 않는다', '복도 폭·벽 재질에 따라 결과가 달라서 장소를 함께 기록'],
      build(env) {
        const tl = new TL(), a = env.anchors[0];
        let prev = null;
        const marks = (S.ENV ? S.ENV.SPACES.C.rangeMarks : [1, 2, 3, 5, 7.5, 10, 12.5, 15]).filter(d => a.y + d < env.room.l - 0.5);
        for (const d of marks) {
          const p = [a.x, a.y + d];
          if (prev) tl.move([prev, p], 0.3, { z: 1.2, person: 'carry', step: 1, label: d + ' m로 이동' });
          tl.add(30, { path: [p], z: 1.2, rec: true, person: 'at', personAt: [a.x + 0.7, p[1] + 1.2], step: 0, label: d + ' m 기록' });
          prev = p;
        }
        return { tl, distTo: 0 };
      }
    }
  ];

  T.corridorEnv = function () {
    const C = S.ENV ? S.ENV.SPACES.C : { w: 2.4, l: 20, h: 2.7 }, room = { w: C.w, l: C.l, h: C.h };
    return { room, corridor: true, anchors: [{ id: 1, x: room.w / 2, y: 0.5, z: 1.2, bx: room.w / 2, by: 0, nx: 0, ny: 1, stand: true }], camera: null, desk: false };
  };

  T.run = function (test, env, P) {
    const r = test.build(env, P);
    r.total = r.tl.t;
    r.recTotal = r.tl.recT;
    r.stats = T.stats(r, env, test);
    return r;
  };
})(window.SIM);
