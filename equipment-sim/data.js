// 테스트 재생용 방·장치 데이터. 공간 크기와 앵커 배치는 env-data.js · env-presets.js(공간 A, C)를 쓴다. 출처: 장비구매계획서, firmware/uwb_fw
window.SIM = window.SIM || {};
(function (S) {
  // 좌표계: x = 가로(동쪽), y = 세로(북쪽), z = 높이. 단위 m. 원점 = 남서쪽 바닥 모서리
  S.ROOM_DEFAULT = { w: 3.11, l: 4.69, h: 3.04 };   // 테스트 방 1
  S.STANDOFF = 0.07;                                  // 벽에서 안테나 중심까지 (메모: 5–10 cm)

  // 앵커 배치: 벽 위치 비율(fx, fy)과 높이. tools/anchors_example.csv 와 같은 배치
  S.ANCHOR_LAYOUT = [
    { id: 1, fx: 0, fy: 0,   z: 2.0 },
    { id: 2, fx: 1, fy: 0,   z: 2.5 },
    { id: 3, fx: 1, fy: 0.5, z: 2.0 },
    { id: 4, fx: 1, fy: 1,   z: 2.5 },
    { id: 5, fx: 0, fy: 1,   z: 2.0 },
    { id: 6, fx: 0, fy: 0.5, z: 2.5 }
  ];

  S.RATES = { uwbHz: 10, imuHz: 208 };   // config.h: RANGING_PERIOD_MS 100, IMU 208 Hz
  S.PHANTOM = { hx: 0.16, hy: 0.105, h: 1.3, layers: 4 };   // 2L × 6 한 층 32×21 cm, 4단 약 1.3 m
  S.PERSON = { hx: 0.22, hy: 0.14, h: 1.72 };
  S.CAMERA = { hfov: 102, vfov: 67 };    // Camera Module 3 Wide (임시)

  // 클릭했을 때 보여 줄 장치 구성
  S.DEVICES = {
    anchor: {
      role: 'UWB DS-TWR 응답 · Wi-Fi AP · BLE 광고 (RSSI 기준점 겸용)',
      parts: [
        'ESP32-S3 N16R8 보드',
        'DWM3000EVB (J1 점퍼 2–3, D0–D6 비움)',
        '암-암 점퍼 9가닥: GPIO 12·13·11·10 (SPI), 4 (IRQ), 5 (RST), 6 (WAKE), 3V3, GND',
        '보조배터리(샤오미 10000mAh) + USB A→C 20–30 cm, 판 아래쪽에 벨크로',
        '판 위부터 UWB → ESP32 → 배터리, 벽에서 안테나 중심 7 cm, 6대 모두 같은 배치'
      ]
    },
    tag: {
      role: 'UWB 거리 + IMU + Wi-Fi·BLE RSSI 수신, Wi-Fi로 노트북에 전송',
      parts: [
        'ESP32-S3 N16R8 보드 + DWM3000EVB (앵커와 같은 9가닥)',
        'ISM330DHCX: SPI3 GPIO 15·16·17·18, INT1 → 7',
        'INA228 ×2: I2C SDA 8 · SCL 9 (주소 0x40 / A0 점퍼 0x41)',
        '하프 브레드보드: IMU·INA228 ①② + 3V3·GND 레일',
        'INA228 VBUS ↔ VIN+ 연결 (하이사이드 측정)',
        '보조배터리 → USB 5 V 브레이크아웃 → INA228 ① → 보드 5V',
        '보드 3V3 → INA228 ② → DWM3000 3V3',
        '동기화 LED (선택): GPIO14 → 220 Ω'
      ]
    },
    camera: {
      role: 'GT(실제 위치) 기록. 태그 높이 평면 호모그래피로 좌표 변환',
      parts: [
        '라즈베리파이 4 + Camera Module 3 Wide (임시)',
        '방 모서리 2.5 m 이상, 화각 약 102° × 67°',
        '시간은 노트북에 맞춤, 실험 중 Wi-Fi·BT 끔',
        '정지점 15개로 GT 오차 검증'
      ]
    },
    desk: {
      role: '데이터 저장·실시간 확인. 실험 중 사람은 여기서 모니터링',
      parts: [
        '노트북: 공유기 5 GHz 무선 또는 LAN, 2.4 GHz에는 붙이지 않음',
        '노트북이 태그 시계(µs)를 실제 시각으로 변환해 둘 다 저장',
        '배치는 예시 (방 밖 책상)'
      ]
    },
    aux: {
      role: '보조 Wi-Fi 노드: 앵커와 다른 벽의 Wi-Fi AP · BLE 광고 (UWB 없음)',
      parts: [
        'ESP32-S3 보드 + 보조배터리, 모듈 안테나를 위로',
        '세션마다 S1 → S2 → S3로 옮긴다 (위치는 테스트 공간 시뮬레이터 계산값, 그림은 S1)',
        '팀원 Wi-Fi sensing 실험과 공용'
      ]
    },
    obstacle: {
      role: '공간 B의 장애물 (가정 배치)',
      parts: ['금속 선반·캐비닛·장비 랙은 UWB를 가린다', '선반 뒤 구간이 자연 NLOS 구간이 된다']
    },
    router: {
      role: '데이터 전송 + 2.4 GHz RSSI 기준점 (앵커와 다른 위치)',
      parts: [
        '방 안 받침대 위 약 1.0 m, 위치는 테스트 공간 시뮬레이터 계산값',
        '태그 연결은 2.4 GHz (채널 1·6·11 중 고정, 20 MHz), Wi-Fi 6E 없는 모델',
        '태그가 접속한 공유기의 RSSI도 기록한다'
      ]
    },
    phantom: {
      role: '몸 가림(NLOS) 재현',
      parts: ['2L 생수 6개입 × 4단, 한 층 32 × 21 cm · 12 kg, 약 1.3 m', '태그를 옆에 두면 가슴, 위에 두면 헬멧 상황', '90°씩 돌려 가려지는 앵커를 바꿈']
    }
  };
})(window.SIM);
