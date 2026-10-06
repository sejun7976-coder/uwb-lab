// 만능기판(9 × 15 cm, 2.54 mm) + 소켓 방식 태그 조립 데이터. 단위 mm, 기판 좌표 (x 오른쪽, y 아래, 원점 = 기판 왼쪽 위)
// 부품 핀 좌표는 bench-data.js(S.BENCH)를 그대로 쓴다. 넷(연결)은 bench-data.js의 태그 배선과 같다.
(function (S) {
  const B = S.BENCH, P = 2.54;
  const F = S.PERF = {};

  // ---------------- 기판·구멍 격자 ----------------
  // 9 × 15 cm 양면 만능기판 (디바이스마트 PCB-0915S: 54 × 33홀, 2.54 mm, 1.6 mm). 구멍 격자는 기판 가운데에 둔다
  F.BOARD = { W: 150, H: 90, X0: (150 - 53 * 2.54) / 2, Y0: (90 - 32 * 2.54) / 2, NC: 54, NR: 33 };
  F.hx = c => F.BOARD.X0 + c * P;
  F.hy = r => F.BOARD.Y0 + r * P;
  // 모서리 고정 구멍 자리 (M3 스페이서). 2 × 2 구멍을 쓰지 않는다
  F.CORNERS = [[0, 0], [52, 0], [0, 31], [52, 31]];

  // ---------------- 부품 배치 ----------------
  // ESP32-S3: 안테나를 오른쪽 기판 가장자리로, J1(신호 핀 전부)을 위쪽으로. J1-1(3V3) = 열 51
  const ESP = { j1Row: 22, j3Row: 32, c1: 51 };
  ESP.x = F.hx(ESP.c1) - 26.67; ESP.y = F.hy(ESP.j1Row) + 12.7;
  // DWM3000EVB: 우노 규격 그대로(돌리지 않음). 모듈·안테나가 있는 우노 x = 0 쪽(USB 잭 쪽)을 기판 왼쪽 가장자리로.
  // 디지털 헤더 = 위(행 0), 전원 헤더 = 아래(행 19). x = xD + u, y = yD − v
  const DWM = { x: F.hx(5) + 15.494, y: F.hy(0) + 24.13 };
  F.POSE = { esp: ESP, dwm: DWM };
  F.dwmXY = (u, v) => [DWM.x + u, DWM.y - v];
  // 실물 배치 (Qorvo DWS3000 v1.2 사진에서 읽은 추정값, mm, 부품 좌표 u·v):
  //   모듈은 우노 x = 0 쪽 가운데에 있고 세라믹 안테나 부분이 보드 가장자리 밖으로 약 9 mm 나온다. J1은 전원 헤더 쪽
  F.DWM_GEOM = {
    module: { u0: -43.1, u1: -21.7, v0: -7, v1: 7 },     // 모듈 기판 전체 (안테나 탭 포함)
    can: { u0: -33.9, u1: -24.8, v0: -6, v1: 6 },        // 금속 캔
    ant: { u0: -43.1, u1: -34.3, v0: -6.5, v1: 6.5 },    // 안테나 탭 (보드 밖)
    j1: { u: -8.3, v: -17.9 }
  };

  // 브레이크아웃: 헤더 1번 핀의 구멍 (열 a, 행 r). 헤더가 아래쪽(ESP 쪽)을 보게 꽂는다
  F.BREAKOUTS = {
    ina2: { def: 'ina', a: 29, r: 7, name: 'INA228 ②', sub: 'UWB 3V3 · 0x41', color: '--w-3v3' },
    ina1: { def: 'ina', a: 40, r: 7, name: 'INA228 ①', sub: '태그 5 V 전체 · 0x40', color: '--w-5v' },
    imu: { def: 'imu', a: 38, r: 17, name: 'ISM330DHCX', sub: 'IMU (SPI)', color: '--w-imu' }
  };

  // ---------------- 핀 → 구멍 ----------------
  // 반환: { id, part, name, c, r, dx (구멍에서 실제 핀까지 x 어긋남, mm), label }
  const pins = {};
  function add(id, part, name, c, r, label, extra) {
    pins[id] = Object.assign({ id, part, name, c, r, dx: 0, label }, extra || {});
  }
  // ESP32 J1·J3
  for (let k = 1; k <= 22; k++) {
    const n1 = B.esp.pins['J1-' + k].name, n3 = B.esp.pins['J3-' + k].name;
    const lab = n => /^\d+$/.test(n) ? 'GPIO' + n : n;
    add('esp:J1-' + k, 'esp', n1, ESP.c1 - (k - 1), ESP.j1Row, 'ESP32 J1-' + k + ' (' + lab(n1) + ')', { sock: 'esp-j1', noUse: false });
    add('esp:J3-' + k, 'esp', n3, ESP.c1 - (k - 1), ESP.j3Row, 'ESP32 J3-' + k + ' (' + lab(n3) + ')', { sock: 'esp-j3', noUse: B.esp.noUse.includes('J3-' + k) });
  }
  // DWM3000EVB (아두이노 우노 쉴드 헤더). D7–D0, A0–A5는 우노 규격상 2.54 mm 격자에서 1.016 mm 어긋난다
  const DWM_SOCK = {
    'dwm-dig10': ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'],
    'dwm-dig8': ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'],
    'dwm-pwr8': ['NC', 'IOREF', 'RESET', '3V3', '5V', 'PGND1', 'PGND2', 'VIN']
  };
  Object.keys(DWM_SOCK).forEach(s => DWM_SOCK[s].forEach(k => {
    const p = B.dwm.pins[k], x = DWM.x + p.u, y = DWM.y - p.v;
    const c = Math.round((x - F.BOARD.X0) / P), r = Math.round((y - F.BOARD.Y0) / P);
    add('dwm:' + k, 'dwm', p.name, c, r, 'DWM ' + (k.startsWith('PGND') ? 'GND (전원 헤더)' : k), { sock: s, dx: +(x - F.hx(c)).toFixed(3), noUse: B.dwm.noUse.includes(k) });
  }));
  F.DWM_SOCK = DWM_SOCK;
  // 브레이크아웃
  Object.keys(F.BREAKOUTS).forEach(id => {
    const m = F.BREAKOUTS[id], d = B[m.def];
    d.pins.forEach((n, i) => add(id + ':' + n, id, n, m.a + i, m.r, m.name + ' ' + n, { sock: id }));
  });
  // 전원 입력 헤더(수 4핀, USB-A 브레이크아웃 케이블의 암 소켓을 꽂음), 측정용 핀(수 3핀), 동기화 LED·저항
  [['5V', 3], ['GND', 4], ['D-', 5], ['D+', 6]].forEach(([n, r]) => add('usb:' + n, 'usb', n, 51, r, '전원 입력 ' + n + (n[0] === 'D' ? ' (비움)' : ''), { sock: 'usb', male: true }));
  [['5V', 10], ['3V3', 11], ['GND', 12]].forEach(([n, r]) => add('tp:' + n, 'tp', n, 51, r, '측정 핀 ' + n, { sock: 'tp', male: true }));
  add('r1:1', 'r1', '1', 32, 21, '저항 220 Ω (GPIO14 쪽)', { sock: 'r1' });
  add('r1:2', 'r1', '2', 32, 17, '저항 220 Ω (LED 쪽)', { sock: 'r1' });
  add('led:A', 'led', 'A', 32, 15, 'LED + (긴 다리)', { sock: 'led' });
  add('led:K', 'led', 'K', 33, 15, 'LED − (짧은 다리)', { sock: 'led' });
  F.PINS = pins;

  // ---------------- 소켓·부품 목록 (윗면) ----------------
  // kind: fh = 암 핀헤더(소켓), mh = 수 핀헤더, r = 저항, led
  F.SOCKETS = {
    'esp-j1': { kind: 'fh', n: 22, title: 'ESP32 J1 소켓 (암 22핀)' },
    'esp-j3': { kind: 'fh', n: 22, title: 'ESP32 J3 소켓 (암 22핀)' },
    'dwm-dig10': { kind: 'fh', n: 10, title: 'DWM 디지털 헤더 소켓 (암 10핀)' },
    'dwm-dig8': { kind: 'fh', n: 8, title: 'DWM D7–D0 소켓 (암 8핀, 다리 1 mm 굽힘)', bent: true },
    'dwm-pwr8': { kind: 'fh', n: 8, title: 'DWM 전원 헤더 소켓 (암 8핀)' },
    ina2: { kind: 'fh', n: 8, title: 'INA228 ② 소켓 (암 8핀)' },
    ina1: { kind: 'fh', n: 8, title: 'INA228 ① 소켓 (암 8핀)' },
    imu: { kind: 'fh', n: 9, title: 'IMU 소켓 (암 9핀)' },
    usb: { kind: 'mh', n: 4, title: '전원 입력 (수 4핀)' },
    tp: { kind: 'mh', n: 3, title: '측정 핀 (수 3핀)' },
    r1: { kind: 'r', title: '저항 220 Ω' },
    led: { kind: 'led', title: '동기화 LED' }
  };

  // ---------------- 넷 (뒷면 배선) ----------------
  // grp 색은 배선 조립 시뮬레이터와 같다. stage: 배선 단계 (1 전원, 2 UWB, 3 IMU·I2C·LED)
  F.NETS = [
    { id: 'GND', grp: 'gnd', stage: 1, wire: 'pwr', pins: ['esp:J1-22', 'esp:J3-22', 'dwm:GND', 'dwm:PGND1', 'ina2:GND', 'ina1:GND', 'imu:GND', 'usb:GND', 'tp:GND', 'led:K'], note: '모든 GND를 한 줄로' },
    { id: '5V 입력', grp: 'v5', stage: 1, wire: 'pwr', pins: ['usb:5V', 'ina1:VIN+', 'ina1:VBUS'], note: '보조배터리 5 V → INA228 ① VIN+, VBUS ↔ VIN+ (하이사이드)' },
    { id: '5V ESP', grp: 'v5', stage: 1, wire: 'pwr', pins: ['ina1:VIN-', 'esp:J1-21', 'tp:5V'], note: 'INA228 ① VIN− → ESP32 5V' },
    { id: '3V3', grp: 'v33', stage: 1, wire: 'pwr', pins: ['esp:J1-1', 'esp:J1-2', 'ina2:VIN+', 'ina2:VBUS', 'ina2:VIN', 'ina1:VIN', 'imu:VIN', 'tp:3V3'], note: 'ESP32 3V3 → INA228 ② VIN+ · 세 브레이크아웃 칩 전원' },
    { id: '3V3 UWB', grp: 'link', stage: 1, wire: 'pwr', pins: ['ina2:VIN-', 'dwm:3V3'], note: 'INA228 ② VIN− → DWM 3V3 (이 선만 DWM 전원)' },
    { id: 'SCK', grp: 'uwb', stage: 2, wire: 'sig', pins: ['esp:J1-18', 'dwm:D13'], note: 'GPIO12 → D13' },
    { id: 'MISO', grp: 'uwb', stage: 2, wire: 'sig', pins: ['esp:J1-19', 'dwm:D12'], note: 'GPIO13 → D12' },
    { id: 'MOSI', grp: 'uwb', stage: 2, wire: 'sig', pins: ['esp:J1-17', 'dwm:D11'], note: 'GPIO11 → D11' },
    { id: 'CS', grp: 'uwb', stage: 2, wire: 'sig', pins: ['esp:J1-16', 'dwm:D10'], note: 'GPIO10 → D10' },
    { id: 'IRQ', grp: 'ctl', stage: 2, wire: 'sig', pins: ['esp:J1-4', 'dwm:D8'], note: 'GPIO4 → D8' },
    { id: 'RST', grp: 'ctl', stage: 2, wire: 'sig', pins: ['esp:J1-5', 'dwm:D7'], note: 'GPIO5 → D7 (굽힌 소켓)' },
    { id: 'WAKE', grp: 'ctl', stage: 2, wire: 'sig', pins: ['esp:J1-6', 'dwm:D9'], note: 'GPIO6 → D9' },
    { id: 'IMU SCK', grp: 'imu', stage: 3, wire: 'sig', pins: ['esp:J1-8', 'imu:SCL'], note: 'GPIO15 → IMU SCL' },
    { id: 'IMU MOSI', grp: 'imu', stage: 3, wire: 'sig', pins: ['esp:J1-10', 'imu:SDA'], note: 'GPIO17 → IMU SDA' },
    { id: 'IMU MISO', grp: 'imu', stage: 3, wire: 'sig', pins: ['esp:J1-9', 'imu:DO'], note: 'GPIO16 → IMU DO' },
    { id: 'IMU CS', grp: 'imu', stage: 3, wire: 'sig', pins: ['esp:J1-11', 'imu:CS'], note: 'GPIO18 → IMU CS' },
    { id: 'INT1', grp: 'imu', stage: 3, wire: 'sig', pins: ['esp:J1-7', 'imu:I1'], note: 'GPIO7 → IMU I1' },
    { id: 'SDA', grp: 'i2c', stage: 3, wire: 'sig', pins: ['esp:J1-12', 'ina1:SDA', 'ina2:SDA'], note: 'GPIO8 → INA228 ①② SDA' },
    { id: 'SCL', grp: 'i2c', stage: 3, wire: 'sig', pins: ['esp:J1-15', 'ina1:SCL', 'ina2:SCL'], note: 'GPIO9 → INA228 ①② SCL' },
    { id: 'LED', grp: 'ctl', stage: 3, wire: 'sig', pins: ['esp:J1-20', 'r1:1'], note: 'GPIO14 → 220 Ω' },
    { id: 'LED+', grp: 'ctl', stage: 3, wire: 'sig', pins: ['r1:2', 'led:A'], note: '220 Ω → LED +' }
  ];

  // 바닥면 비움 구역: DWM 모듈·안테나 아래 (위치 근사), ESP32 USB-C 케이블이 들어오는 자리(윗면)
  const mod = F.DWM_GEOM.module;
  F.KEEPOUT = { x0: 0, x1: DWM.x + mod.u1 + 3, y0: DWM.y - mod.v1 - 4, y1: DWM.y - mod.v0 + 4 };
  F.USBZONE = { x0: 42, x1: ESP.x - 35, y0: ESP.y - 11, y1: ESP.y + 11 };

  // ---------------- 조립 단계 ----------------
  // show: 이 단계에서 새로 보이는 것. view: 처음 보여 줄 면
  F.STEPS = [
    {
      title: '기판 준비', view: 'top', show: {},
      body: [
        '9 × 15 cm 양면 만능기판을 놓고 방향을 정한다. 왼쪽 = UWB 안테나, 오른쪽 = ESP32 안테나, 오른쪽 위 = 전원 입력.',
        '네 모서리는 M3 스페이서 자리로 비워 둔다.',
        '빨간 빗금(DWM 모듈 아래)은 뒷면에도 선을 지나가게 하지 않는다. DWM 모듈의 안테나 부분은 기판 왼쪽 가장자리 밖으로 약 9 mm 나온다(사진 기준 추정).',
        '회색 점선(ESP32 왼쪽)은 USB-C 케이블을 꽂는 자리다. 높은 부품을 두지 않는다.'
      ],
      check: ['유성펜으로 소켓 자리 끝 구멍에 점을 찍어 두면 실수가 줄어든다.']
    },
    {
      title: '브레이크아웃에 핀헤더 납땜', view: 'top', show: { preview: ['ina2', 'ina1', 'imu'] },
      body: [
        'IMU·INA228은 핀헤더가 납땜되지 않은 채로 온다. 동봉된 수 핀헤더를 핀이 아래로 가게 납땜한다.',
        '헤더를 잘라 둔 암 핀헤더 소켓에 꽂고 그 위에 보드를 얹어 납땜하면 수직이 잘 맞는다 (소켓이 지그 역할을 한다).',
        'INA228 ② 뒷면의 A0 점퍼를 납땜으로 이어 주소를 0x41로 바꾼다. ①은 그대로 0x40.',
        'INA228 위쪽 3.5 mm 단자대는 쓰지 않는다. 전류는 헤더의 VIN+ · VIN− 핀으로 흐른다.'
      ],
      check: ['② 보드에 "0x41" 스티커를 붙여 ①과 헷갈리지 않게 한다.']
    },
    {
      title: 'ESP32 소켓 (암 22핀 × 2)', view: 'top', show: { sock: ['esp-j1', 'esp-j3'] },
      body: [
        '암 핀헤더 22핀 두 줄을 구멍 10칸 간격(25.4 mm)으로 꽂는다.',
        'ESP32 보드를 소켓에 끼운 상태로 기판에 넣고 뒷면을 납땜하면 두 줄 간격이 정확히 맞는다.',
        '양 끝 핀 4개를 먼저 납땜해 고정하고, 소켓이 기판에 붙어 있는지 확인한 뒤 나머지를 납땜한다.',
        '납땜이 끝나면 ESP32 보드는 빼 둔다 (배선할 때 열을 받지 않게).'
      ],
      check: ['J1(신호 핀)이 위쪽, 안테나가 오른쪽 가장자리를 향하는지 확인.']
    },
    {
      title: 'DWM3000EVB 소켓 (10 + 8 + 8핀)', view: 'top', show: { sock: ['dwm-dig10', 'dwm-pwr8', 'dwm-dig8'] },
      body: [
        'DWM 보드는 돌리지 않고 놓는다: 디지털 헤더가 위(기판 위쪽 가장자리), 전원 헤더가 아래, 모듈·안테나가 왼쪽.',
        '디지털 10핀(SCL–D8)과 전원 8핀(NC–VIN)은 2.54 mm 격자에 그대로 맞는다.',
        'D7–D0 8핀은 아두이노 우노 규격상 격자에서 1.016 mm 어긋난다. 소켓 다리를 1 mm 정도 같은 방향으로 굽혀 구멍에 넣는다.',
        'DWM 보드를 세 소켓에 끼운 상태로 기판에 넣고 납땜하면 굽힌 소켓 위치도 맞는다.',
        'A0–A5 헤더는 쓰지 않으므로 소켓을 달지 않는다.'
      ],
      check: ['DWM 모듈의 안테나 부분이 기판 왼쪽 가장자리 밖으로 나오는지 확인. 안테나 아래에 기판·선이 없어야 한다.', '굽힌 소켓에 보드를 넣고 뺄 때 힘이 과하게 들지 않는지 확인.']
    },
    {
      title: '브레이크아웃 소켓·전원 입력·LED', view: 'top', show: { sock: ['ina2', 'ina1', 'imu', 'usb', 'tp', 'r1', 'led'] },
      body: [
        'INA228 ② · ① (암 8핀), IMU (암 9핀) 소켓을 단다. 헤더가 아래(ESP32 쪽)로 오게 꽂는다.',
        '오른쪽 위에 수 4핀을 단다: 5V · GND · D− · D+. USB-A 브레이크아웃 케이블의 빨강·검정 소켓을 꽂고, 흰·초록은 꽂기만 하고 연결하지 않는다.',
        '그 아래 수 3핀은 멀티미터용 측정 핀(5V · 3V3 · GND)이다.',
        '동기화 LED와 220 Ω 저항을 윗면에 단다. LED 긴 다리(+)가 저항 쪽이다.'
      ],
      check: ['IMU는 기판에 바짝 붙고 흔들리지 않아야 한다. IMU 축 방향(x·y 화살표)을 기판에 펜으로 옮겨 적는다.']
    },
    {
      title: '뒷면 배선 ① 전원·GND', view: 'bottom', show: { stage: 1 },
      body: [
        '기판을 뒤집는다. 뒷면은 좌우가 바뀌어 보인다 (화면도 뒤집힌 모습).',
        'GND → 5V 입력 → 5V ESP → 3V3 → 3V3 UWB 순으로 AWG 22–24 단심선을 깐다.',
        'INA228 ①은 VBUS 핀과 VIN+ 핀을, ②도 VBUS와 VIN+를 짧게 잇는다 (하이사이드 전압 측정).',
        '3V3 UWB(갈색)는 INA228 ② VIN−에서 DWM 3V3까지 한 줄뿐이다. 다른 3V3와 닿으면 ② 측정이 무의미해진다.'
      ],
      check: ['선 끝은 3–4 mm 벗겨 구멍 옆 패드에 눕혀 납땜한다.', '선을 하나 끝낼 때마다 화면의 넷 목록에서 지운다.']
    },
    {
      title: '뒷면 배선 ② UWB SPI·제어', view: 'bottom', show: { stage: 2 },
      body: [
        'ESP32 J1과 DWM 디지털 헤더를 7가닥으로 잇는다 (SCK · MISO · MOSI · CS · IRQ · RST · WAKE).',
        '신호선은 AWG 26–30 피복선을 쓴다. 겹쳐 지나가도 되지만 납땜 패드 위로는 지나가지 않는다.',
        'RST는 굽힌 D7 소켓 다리에 납땜한다.',
        'D0–D6 다리는 납땜만 하고(고정용) 아무 데도 잇지 않는다. SPI 모드 스트랩이라 떠 있어야 한다.'
      ],
      check: ['SPI 4가닥은 가능한 한 짧고 서로 나란히.']
    },
    {
      title: '뒷면 배선 ③ IMU·I2C·LED', view: 'bottom', show: { stage: 3 },
      body: [
        'IMU SPI 5가닥(SCK · MOSI · MISO · CS · INT1)을 J1에서 IMU 소켓으로 잇는다. 세 가닥은 같은 열이라 거의 직선이다.',
        'I2C는 ESP32 → INA228 ① → INA228 ② 순서로 한 줄씩 이어 간다 (SDA · SCL).',
        'GPIO14 → 220 Ω → LED+. LED−는 1단계에서 GND에 이미 연결했다.'
      ],
      check: ['모든 선을 다 깔았으면 뒷면 전체를 사진으로 남긴다 (Notion 02).']
    },
    {
      title: '모듈 없이 멀티미터 점검', view: 'both', show: {},
      body: [
        '모듈을 꽂기 전에, 기판만 있는 상태에서 아래 표를 차례로 잰다.',
        '도통(삐 소리) 모드: 각 넷의 양 끝 소켓 구멍끼리 붙어 있어야 한다.',
        '쇼트 확인: 5V 입력 · 5V ESP · 3V3 · 3V3 UWB 가 GND와 붙어 있으면 안 된다.',
        '3V3와 3V3 UWB는 서로 붙어 있으면 안 된다 (INA228 ②를 꽂아야 션트를 거쳐 이어진다).'
      ],
      check: ['하나라도 틀리면 모듈을 꽂지 않는다.'],
      tests: true
    },
    {
      title: '모듈 꽂고 첫 전원', view: 'top', show: { modules: true },
      body: [
        'DWM3000EVB J1 점퍼가 2–3 (3V3_ARDUINO)인지 확인하고 꽂는다.',
        'ESP32 · IMU · INA228 ② · ① 순서로 꽂는다. 핀 하나 밀림이 없는지 옆에서 본다.',
        '처음에는 보조배터리 없이 ESP32 COM 포트(USB-C)만 연결해 hwtest를 올린다. DEV_ID 0xDECA0302, IMU, INA228 0x40 · 0x41이 보여야 한다.',
        'USB-C와 보조배터리를 동시에 연결하지 않는다. 5 V가 두 곳에서 들어와 ① 측정이 틀어진다.'
      ],
      check: ['측정 핀 3V3가 약 3.3 V, 5V가 보조배터리 전압과 같은지 멀티미터로 확인.']
    },
    {
      title: '안전모 장착', view: 'top', show: { modules: true, mount: true },
      body: [
        '네 모서리에 M3 나일론 스페이서를 달아 바닥을 띄운다 (뒷면 납땜이 눌리지 않게).',
        '전원 케이블은 기판 구멍에 케이블 타이로 묶고, 소켓 근처는 핫글루로 고정한다.',
        '안테나 두 개(왼쪽 UWB, 오른쪽 ESP32) 위에는 아무것도 덮지 않는다. 동기화 LED가 천장 카메라에서 보이게 둔다.',
        '모듈이 소켓에서 빠지지 않도록 위에서 케이블 타이나 고무줄로 가볍게 잡아 준다.'
      ],
      check: ['안전모에 붙이는 방향(IMU x·y축)을 사진으로 남긴다. 실험마다 같게 붙인다.']
    }
  ];

  // ---------------- 추가 구매 목록 ----------------
  // 가격: 디바이스마트 상품 페이지 판매가 (VAT 포함, 2026-10-04 확인). 배송비 2,700원, 66,000원 이상 무료
  // need: 필수 · 권장 · 선택. 납땜 도구(인두·실납·플럭스·멀티미터)는 보유
  const DM = no => 'https://www.devicemart.co.kr/goods/view?no=' + no;
  F.SHOP = { name: '디바이스마트', date: '2026-10-04', ship: 2700, freeOver: 66000 };
  F.BOM = [
    { cat: '기판·커넥터', item: '만능 PCB 기판 90 × 150 양면', model: 'PCB-0915S', url: DM(1341720), spec: '에폭시, 54 × 33홀, 2.54 mm, 1.6 mm', price: 1870, qty: 2, unit: '장', why: '태그 1 + 실수 대비 1', need: '필수', note: '페이지 분류는 "단면"으로 나와 있어 양면인지 문의 후 구매' },
    { cat: '기판·커넥터', item: '핀헤더소켓 (암) 1 × 40 일자', model: '', url: DM(3585), spec: '2.54 mm, 1열', price: 583, qty: 5, unit: '개', why: '소켓 95핀 (22·22·10·8·8·8·8·9). 자를 때 1핀씩 버려서 3개로 겨우 맞음 → 여유 2개', need: '필수', note: '높이 8.5 mm는 페이지에 없음. 다른 높이여도 쓸 수 있음' },
    { cat: '기판·커넥터', item: '핀헤더 (수) 1 × 40 일자', model: '', url: DM(2825), spec: '2.54 mm, 1열', price: 220, qty: 1, unit: '개', why: '전원 입력 4핀 · 측정 핀 3핀 (브레이크아웃 헤더는 보드에 들어 있음)', need: '필수' },
    { cat: '전선', item: '3색 점퍼용 단선 0.6 파이', model: '1 m 단위', url: DM(1153807), spec: '빨강·검정·흰 3가닥 1 m, 약 AWG 22 (환산값)', price: 550, qty: 2, unit: 'm', why: '전원·GND (계산 약 0.9 m). 빨강 = 3V3, 흰 = 5V, 검정 = GND로 정해 쓴다', need: '필수' },
    { cat: '전선', item: '래핑 와이어 UL1423 AWG30 200 m', model: '색상 선택', url: DM(1274107), spec: '10색 중 선택, "8색 믹스" 옵션 있음', price: 5390, qty: 1, unit: '롤', why: '신호선 (UWB SPI · IMU SPI · I2C · LED, 계산 약 1.1 m)', need: '필수', note: '8색 믹스는 약 300원 추가 (VAT 별도, 추정)' },
    { cat: '부품', item: '저항 1/4 W 220 Ω', model: '221J', url: DM(890), spec: '탄소피막 5 %', price: 25.3, qty: 30, unit: '개', why: '동기화 LED (1개 사용, 주문 기본 30개)', need: '필수' },
    { cat: '부품', item: '5파이 고휘도 LED 반투명 빨강', model: '5R3HT-10', url: DM(2851), spec: '5 mm, 2 V 20 mA', price: 77, qty: 10, unit: '개', why: 'GT 카메라 시간 맞춤 (GPIO14, 주문 기본 10개)', need: '필수', note: '녹색·노랑도 같은 가격' },
    { cat: '고정', item: 'PCB 플라스틱 서포트 키트 M3', model: 'NT-KIT-E018', url: DM(1323561), spec: '볼트·너트·서포트 6·10·15·20 mm', price: 8800, qty: 1, unit: '키트', why: '기판 네 모서리를 띄워 뒷면 납땜 보호, 안전모 장착 판 고정', need: '권장', note: '할인가. 더 싼 FIT0066 (10 mm 10세트, 2,640원)은 볼트·너트 포함 여부 미확인' },
    { cat: '고정', item: '케이블타이 소 100 mm 100개', model: 'T-C2510B', url: DM(12511035), spec: '2.5 × 100 mm, 검정', price: 440, qty: 1, unit: '팩', why: '전원 케이블 고정, 모듈 빠짐 방지', need: '권장' },
    { cat: '고정', item: '미니 글루건', model: 'JG-2002', url: DM(13187061), spec: '', price: 3850, qty: 1, unit: '개', why: '소켓 옆 케이블 고정', need: '권장' },
    { cat: '고정', item: '핫멜트스틱 (소) 10개', model: '', url: DM(13187168), spec: '직경은 페이지에 없음 (약 7 mm 계열 추정)', price: 1320, qty: 1, unit: '팩', why: '글루건용', need: '권장' },
    { cat: '대안', item: 'Arduino Uno Proto Shield R3', model: 'ARD080911', url: DM(10918651), spec: '빈 기판 68 × 56 mm', price: 3850, qty: 1, unit: '개', why: 'D7–D0 소켓 다리 굽히기가 어려우면 DWM 소켓 어댑터로', need: '선택', note: 'EB0002 (3,080원)도 있음' }
  ];
  F.DROP = [
    '태그용 하프 브레드보드 (핀헤더 납땜 지그는 암 소켓으로 대신함)',
    '태그용 점퍼선 (앵커 6대는 지금처럼 점퍼선 사용)',
    '납땜 도구 (인두 · 실납 · 플럭스 등은 보유)'
  ];
})(typeof window !== 'undefined' ? (window.SIM = window.SIM || {}) : module.exports);
