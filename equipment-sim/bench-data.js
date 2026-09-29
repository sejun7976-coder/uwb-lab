// 배선 조립용 부품·배선 데이터. 단위 mm, 부품 기준 좌표 (u = 긴 축, v = 짧은 축, 원점 = 부품 가운데)
// 출처: firmware/uwb_fw/include/pins.h, README 2절 · Espressif DevKitC-1 v1.1 핀 표 ·
//       Adafruit EAGLE 기판 파일 (INA228, LSM6DSOX — ISM330DHCX 보드와 같은 기판) · Arduino Uno R3 쉴드 규격
(function (S) {
  const P = 2.54;
  const B = S.BENCH = {};

  // ---------------- ESP32-S3-DevKitC-1 호환 N16R8 ----------------
  // 모듈(안테나) 쪽 = +u, USB-C 쪽 = -u. 위에서 볼 때 모듈을 위로 두면 J1이 왼쪽(+v), J3가 오른쪽(-v)
  const J1 = ['3V3', '3V3', 'RST', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5V', 'G'];
  const J3 = ['G', 'TX', 'RX', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'G', 'G'];
  const espPins = {};
  J1.forEach((n, i) => { espPins['J1-' + (i + 1)] = { u: 26.67 - i * P, v: 12.7, name: n }; });
  J3.forEach((n, i) => { espPins['J3-' + (i + 1)] = { u: 26.67 - i * P, v: -12.7, name: n }; });
  B.esp = {
    kind: 'esp', title: 'ESP32-S3 보드', L: 70, W: 28, H: 21, pins: espPins,
    noUse: ['J3-11', 'J3-12', 'J3-13'],           // GPIO37·36·35 : Octal PSRAM
    note: '외형은 DevKitC-1 기준 근사 (70 × 28 mm). 핀 순서·간격(2.54 mm)은 실제와 같다. 핀은 아래로 납땜.'
  };

  // ---------------- DWM3000EVB (Arduino Uno R3 쉴드 규격) ----------------
  // Uno 좌표(mm, 왼쪽 아래 원점) → 부품 좌표. 디지털 헤더 = +v 쪽, 전원·아날로그 헤더 = -v 쪽
  const uno = {
    SCL: [18.796, 50.8], SDA: [21.336, 50.8], AREF: [23.876, 50.8], GND: [26.416, 50.8],
    D13: [28.956, 50.8], D12: [31.496, 50.8], D11: [34.036, 50.8], D10: [36.576, 50.8], D9: [39.116, 50.8], D8: [41.656, 50.8],
    D7: [48.26, 50.8], D6: [50.8, 50.8], D5: [53.34, 50.8], D4: [55.88, 50.8], D3: [58.42, 50.8], D2: [60.96, 50.8], D1: [63.5, 50.8], D0: [66.04, 50.8],
    NC: [26.416, 2.54], IOREF: [28.956, 2.54], RESET: [31.496, 2.54], '3V3': [34.036, 2.54], '5V': [36.576, 2.54],
    PGND1: [39.116, 2.54, 'GND'], PGND2: [41.656, 2.54, 'GND'], VIN: [44.196, 2.54],
    A0: [48.26, 2.54], A1: [50.8, 2.54], A2: [53.34, 2.54], A3: [55.88, 2.54], A4: [58.42, 2.54], A5: [60.96, 2.54]
  };
  const dwmPins = {};
  Object.keys(uno).forEach(k => { dwmPins[k] = { u: uno[k][0] - 34.29, v: uno[k][1] - 26.67, name: uno[k][2] || k }; });
  B.dwm = {
    kind: 'dwm', title: 'DWM3000EVB', L: 68.58, W: 53.34, H: 21, pins: dwmPins,
    noUse: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
    note: '아두이노 Uno 쉴드 규격 기준. 모듈·J1 위치는 근사. D0–D6은 SPI 모드 스트랩이라 연결하지 않는다.'
  };

  // ---------------- 브레이크아웃 (Adafruit EAGLE 기판 좌표, 헤더가 아래쪽 y = 2.54) ----------------
  B.imu = {
    kind: 'imu', title: 'ISM330DHCX (IMU)', Lb: 25.4, Wb: 17.78, header: { x0: 2.54, y: 2.54 },
    pins: ['VIN', '3Vo', 'GND', 'SCL', 'SDA', 'DO', 'CS', 'I1', 'I2'],
    note: 'Adafruit 4502. 같은 기판을 쓰는 LSM6DSOX(4438) 보드 파일 기준. 헤더 9핀, SPI로 연결 (STEMMA QT는 안 씀).'
  };
  B.ina = {
    kind: 'ina', title: 'INA228', Lb: 25.4, Wb: 20.32, header: { x0: 3.81, y: 2.54 },
    pins: ['VIN', 'GND', 'SCL', 'SDA', 'VBUS', 'VIN-', 'VIN+', 'ALRT'],
    note: 'Adafruit 5832 EAGLE 기판 파일 기준. 헤더 8핀 한 줄, 위쪽에 3.5 mm 단자대 (VIN− · VBUS · VIN+).'
  };

  // ---------------- 하프 브레드보드 400핀 ----------------
  // 열 1–30, 행 a–e (+v 블록) · f–j (-v 블록), 전원 레일 +v 쪽 2줄 (3V3, GND) · -v 쪽 2줄
  const ROWV = { a: 13.97, b: 11.43, c: 8.89, d: 6.35, e: 3.81, f: -3.81, g: -6.35, h: -8.89, i: -11.43, j: -13.97 };
  B.bb = {
    kind: 'bb', title: '브레드보드 400핀', L: 82, W: 55, T: 8.5, rowV: ROWV,
    colU: c => (c - 15.5) * P,
    railU: t => ((Math.floor(t / 5)) * 6 + (t % 5) - 14) * P,
    rails: { '3V3': 19.05, GND: 21.59, farP: -19.05, farN: -21.59 },
    freeRows: ['f', 'g', 'h', 'i'],                 // 브레이크아웃 헤더는 j행, 선은 f–i행
    // 브레이크아웃은 브레드보드와 180° 반대로 꽂는다 (몸체가 -v 쪽 밖으로 나감). 1번 핀 열 = c1, 핀 k → 열 c1-(k-1)
    mounts: [
      { id: 'imu', def: 'imu', c1: 9, label: 'IMU' },
      { id: 'ina1', def: 'ina', c1: 19, label: 'INA228 ①', addr: '0x40', role: '태그 5 V 입력 전체' },
      { id: 'ina2', def: 'ina', c1: 29, label: 'INA228 ②', addr: '0x41 (A0 점퍼)', role: 'DWM3000 3V3 전원선' }
    ],
    breakoutH: 11
  };
  B.mountCol = (mountId, pinName) => {
    const m = B.bb.mounts.find(x => x.id === mountId), d = B[m.def];
    return m.c1 - d.pins.indexOf(pinName);
  };

  // ---------------- USB 브레이크아웃 케이블 (Adafruit 4448) · 보조배터리 ----------------
  B.usb = {
    kind: 'usb', title: 'USB-A 브레이크아웃 (4448)', L: 16, W: 13, sockets: { '5V': 3.81, GND: 1.27, 'D-': -1.27, 'D+': -3.81 },
    sockH: 5, sockLen: 14, cable: 300,
    note: '끝이 암 소켓 4개(빨강 5V · 검정 GND · 흰 D− · 초록 D+). 5V·GND만 쓰고 D±는 비운다.'
  };
  B.bank = { kind: 'bank', title: '보조배터리', L: 100, W: 62, T: 15, port: { u: 50, v: 12 } };

  // ---------------- 신호 그룹 (색) ----------------
  B.groups = {
    uwb: { name: 'UWB SPI', color: '--w-spi' },
    ctl: { name: 'UWB 제어', color: '--w-ctl' },
    imu: { name: 'IMU SPI', color: '--w-imu' },
    i2c: { name: 'I2C', color: '--w-i2c' },
    v33: { name: '3V3', color: '--w-3v3' },
    v5: { name: '5V', color: '--w-5v' },
    gnd: { name: 'GND', color: '--w-gnd' },
    link: { name: '측정 연결', color: '--w-link' }
  };

  // 끝점: { p: 부품, pin } · 브레드보드는 { p: 'bb', m: 브레이크아웃, pin } 또는 { p: 'bb', rail }
  const E = (p, pin) => ({ p, pin });
  const BBm = (m, pin) => ({ p: 'bb', m, pin });
  const RAIL = r => ({ p: 'bb', rail: r });
  // 같은 이름 핀이 여러 개면 목록으로 두고, 계산할 때 가장 가까운 빈 핀을 고른다
  const ESP_G = ['J1-22', 'J3-1', 'J3-21', 'J3-22'], ESP_3V3 = ['J1-1', 'J1-2'];

  const UWB_WIRES = [
    { id: 'sck', sig: 'SCK', grp: 'uwb', a: E('esp', 'J1-18'), b: E('dwm', 'D13'), spi: true, note: 'GPIO12 → D13 (SPICLK)' },
    { id: 'miso', sig: 'MISO', grp: 'uwb', a: E('esp', 'J1-19'), b: E('dwm', 'D12'), spi: true, note: 'GPIO13 → D12 (SPIMISO)' },
    { id: 'mosi', sig: 'MOSI', grp: 'uwb', a: E('esp', 'J1-17'), b: E('dwm', 'D11'), spi: true, note: 'GPIO11 → D11 (SPIMOSI)' },
    { id: 'cs', sig: 'CS', grp: 'uwb', a: E('esp', 'J1-16'), b: E('dwm', 'D10'), spi: true, note: 'GPIO10 → D10 (SPICSn)' },
    { id: 'irq', sig: 'IRQ', grp: 'ctl', a: E('esp', 'J1-4'), b: E('dwm', 'D8'), note: 'GPIO4 → D8 (IRQ)' },
    { id: 'rst', sig: 'RST', grp: 'ctl', a: E('esp', 'J1-5'), b: E('dwm', 'D7'), note: 'GPIO5 → D7 (RSTn)' },
    { id: 'wake', sig: 'WAKE', grp: 'ctl', a: E('esp', 'J1-6'), b: E('dwm', 'D9'), note: 'GPIO6 → D9 (WAKEUP)' },
    { id: 'ugnd', sig: 'GND', grp: 'gnd', a: E('esp', ESP_G), b: E('dwm', ['GND', 'PGND1', 'PGND2']), note: 'G → GND (가까운 GND 핀)' }
  ];

  B.setups = {
    anchor: {
      title: '앵커 (6대 모두 같음)',
      parts: ['esp', 'dwm'],
      wires: UWB_WIRES.concat([
        { id: 'u33', sig: '3V3', grp: 'v33', a: E('esp', ESP_3V3), b: E('dwm', '3V3'), note: '3V3 → 전원 헤더 3V3 (J1 점퍼 2–3)' }
      ]),
      layout: null   // 아래 DEFAULTS에서 채움
    },
    tag: {
      title: '태그',
      parts: ['esp', 'dwm', 'bb', 'usb', 'bank'],
      wires: UWB_WIRES.concat([
        // IMU (SPI3)
        { id: 'isck', sig: 'SCK', grp: 'imu', a: E('esp', 'J1-8'), b: BBm('imu', 'SCL'), spi: true, note: 'GPIO15 → IMU SCL (SCK)' },
        { id: 'imosi', sig: 'MOSI', grp: 'imu', a: E('esp', 'J1-10'), b: BBm('imu', 'SDA'), spi: true, note: 'GPIO17 → IMU SDA (SDI)' },
        { id: 'imiso', sig: 'MISO', grp: 'imu', a: E('esp', 'J1-9'), b: BBm('imu', 'DO'), spi: true, note: 'GPIO16 → IMU DO (SDO)' },
        { id: 'ics', sig: 'CS', grp: 'imu', a: E('esp', 'J1-11'), b: BBm('imu', 'CS'), spi: true, note: 'GPIO18 → IMU CS' },
        { id: 'iint', sig: 'INT1', grp: 'imu', a: E('esp', 'J1-7'), b: BBm('imu', 'I1'), note: 'GPIO7 → IMU I1 (data-ready)' },
        { id: 'ivin', sig: '3V3', grp: 'v33', a: RAIL('3V3'), b: BBm('imu', 'VIN'), note: '3V3 레일 → IMU VIN' },
        { id: 'ignd', sig: 'GND', grp: 'gnd', a: RAIL('GND'), b: BBm('imu', 'GND'), note: 'GND 레일 → IMU GND' },
        // I2C (INA228 두 개가 같은 선을 나눠 씀)
        { id: 'sda', sig: 'SDA', grp: 'i2c', a: E('esp', 'J1-12'), b: BBm('ina1', 'SDA'), note: 'GPIO8 → INA228 ① SDA' },
        { id: 'scl', sig: 'SCL', grp: 'i2c', a: E('esp', 'J1-15'), b: BBm('ina1', 'SCL'), note: 'GPIO9 → INA228 ① SCL' },
        { id: 'sda2', sig: 'SDA', grp: 'i2c', a: BBm('ina1', 'SDA'), b: BBm('ina2', 'SDA'), note: 'INA228 ① SDA ↔ ② SDA' },
        { id: 'scl2', sig: 'SCL', grp: 'i2c', a: BBm('ina1', 'SCL'), b: BBm('ina2', 'SCL'), note: 'INA228 ① SCL ↔ ② SCL' },
        { id: 'n1vcc', sig: '3V3', grp: 'v33', a: RAIL('3V3'), b: BBm('ina1', 'VIN'), note: '3V3 레일 → INA228 ① VIN (칩 전원)' },
        { id: 'n1gnd', sig: 'GND', grp: 'gnd', a: RAIL('GND'), b: BBm('ina1', 'GND'), note: 'GND 레일 → INA228 ① GND' },
        { id: 'n2vcc', sig: '3V3', grp: 'v33', a: RAIL('3V3'), b: BBm('ina2', 'VIN'), note: '3V3 레일 → INA228 ② VIN (칩 전원)' },
        { id: 'n2gnd', sig: 'GND', grp: 'gnd', a: RAIL('GND'), b: BBm('ina2', 'GND'), note: 'GND 레일 → INA228 ② GND' },
        // 전원 경로 ① : 보조배터리 5 V → INA228 ① → ESP32 5V
        { id: 'p5in', sig: '5V', grp: 'v5', a: E('usb', '5V'), b: BBm('ina1', 'VIN+'), note: '보조배터리 5V → INA228 ① VIN+', power: true },
        { id: 'vb1', sig: 'VBUS', grp: 'link', a: BBm('ina1', 'VBUS'), b: BBm('ina1', 'VIN+'), note: 'INA228 ① VBUS ↔ VIN+ (하이사이드 전압 측정)' },
        { id: 'p5out', sig: '5V', grp: 'v5', a: E('esp', 'J1-21'), b: BBm('ina1', 'VIN-'), note: 'INA228 ① VIN− → ESP32 5V 핀', power: true },
        { id: 'pgnd', sig: 'GND', grp: 'gnd', a: E('usb', 'GND'), b: RAIL('GND'), note: '보조배터리 GND → GND 레일', power: true },
        // 전원 경로 ② : ESP32 3V3 → 레일 → INA228 ② → DWM3000 3V3
        { id: 'e33', sig: '3V3', grp: 'v33', a: E('esp', ESP_3V3), b: RAIL('3V3'), note: 'ESP32 3V3 → 3V3 레일', power: true },
        { id: 'egnd', sig: 'GND', grp: 'gnd', a: E('esp', ESP_G), b: RAIL('GND'), note: 'ESP32 G → GND 레일', power: true },
        { id: 'p3in', sig: '3V3', grp: 'v33', a: RAIL('3V3'), b: BBm('ina2', 'VIN+'), note: '3V3 레일 → INA228 ② VIN+', power: true },
        { id: 'vb2', sig: 'VBUS', grp: 'link', a: BBm('ina2', 'VBUS'), b: BBm('ina2', 'VIN+'), note: 'INA228 ② VBUS ↔ VIN+ (하이사이드 전압 측정)' },
        { id: 'p3out', sig: '3V3', grp: 'v33', a: E('dwm', '3V3'), b: BBm('ina2', 'VIN-'), note: 'INA228 ② VIN− → DWM3000EVB 3V3', power: true }
      ]),
      layout: null
    }
  };

  // 기본 배치: 2 mm 격자·90° 회전을 모두 시도해 10 cm 점퍼 기준으로 가장 짧게 나온 배치 (2026-09-29 계산).
  // x 오른쪽, y 위쪽 (mm), rot 도(반시계)
  B.DEFAULTS = {
    anchor: { esp: { x: -9, y: -22, rot: 0 }, dwm: { x: 9, y: 22, rot: 180 } },
    tag: {
      esp: { x: -45, y: 0, rot: 0 }, dwm: { x: -63, y: -46, rot: 0 }, bb: { x: -57, y: 44, rot: 180 },
      usb: { x: -3, y: 36, rot: 180 }, bank: { x: 48, y: 30, rot: 90 }
    }
  };

  // 구매한 선 (장비 구매 계획서 C1)
  B.BOUGHT = { FF: 120, MF: 40, MM: 40 };
  B.HOUSING = 14;     // 듀폰 커넥터 하우징 길이 (mm)
})(typeof window !== 'undefined' ? (window.SIM = window.SIM || {}) : module.exports);
