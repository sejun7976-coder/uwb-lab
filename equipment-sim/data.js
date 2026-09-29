// 장비·방·장치 데이터. 출처: 랩미팅/장비_결정_메모.md, firmware/uwb_fw
window.SIM = window.SIM || {};
(function (S) {
  // 좌표계: x = 가로(동쪽), y = 세로(북쪽), z = 높이. 단위 m. 원점 = 남서쪽 바닥 모서리
  S.ROOM_DEFAULT = { w: 3.11, l: 4.69, h: 3.04 };   // 테스트 방 1
  S.STANDOFF = 0.07;                                  // 벽에서 안테나 중심까지 (메모: 5–10 cm)
  S.CABLE_LEN = 3.0;                                  // 메모 6절: USB 케이블 약 3 m

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

  // 필요한 장비. tag: have(보유) · sug(메모에 없음, 제안) · opt(선택)
  S.EQUIP = [
    { title: '핵심 장비', src: '메모 1절', items: [
      { name: 'ESP32-S3-DevKitC-1 호환 N16R8', qty: '7', det: '앵커 6 + 태그 1. 알리 YourCee, 헤더 납땜 옵션. GPIO 35·36·37 사용 불가. 보유 YD-ESP32-S3 2장은 초기 점검용' },
      { name: 'Qorvo DWM3000EVB', qty: '7', det: 'UWB 채널 5, SPI. DigiKey KR ₩42,492 (VAT 별도). J1 점퍼 2–3, D0–D6 연결 금지' },
      { name: 'Adafruit ISM330DHCX (4502)', qty: '1', det: '태그 IMU 6축, SPI3. $19.95' },
      { name: 'Adafruit INA228 (5832)', qty: '2', det: '태그 전력. ① 보조배터리 → 태그 5 V 전체 ② DWM3000 3V3 전원선. $14.95' }
    ] },
    { title: '앵커 6대 재료', src: '메모 6절', items: [
      { name: '암-암 점퍼선 10 cm', qty: '54+', det: '대당 9가닥 + 예비. 3V3선이 빠듯하다 (3절 배선 조립)' },
      { name: 'USB 케이블', qty: '6', det: '앵커 → 충전기. 3 m로 닿는지는 1번 환경의 케이블 계산 참고' },
      { name: '멀티포트 USB 충전기', qty: '1', det: '6포트 이상, 포트당 1 A 이상' },
      { name: '벽 부착 재료', qty: '—', det: '탈착식 양면테이프, 스페이서(5–10 cm), 케이블 타이' }
    ] },
    { title: '태그 1대 재료', src: '메모 6절', items: [
      { name: '점퍼선 암-암·수-암·수-수 10 cm', qty: '32', det: '암-암 8 · 수-암 11 · 수-수 13 (3절 연결표)' },
      { name: '하프 브레드보드 400핀', qty: '1', det: 'IMU · INA228 ①② 를 꽂고 3V3·GND 레일로 전원을 나눔' },
      { name: '보조배터리', qty: '1', det: '저전류 자동 꺼짐이 없는 모델' },
      { name: 'USB-A 브레이크아웃 케이블', qty: '1', det: 'Adafruit 4448 (끝이 암 소켓 4개). INA228 ①을 5 V 선에 끼움' },
      { name: '납땜', qty: '—', det: 'IMU·INA228 핀 헤더. INA228 1개는 A0 점퍼로 I2C 주소 변경' }
    ] },
    { title: '실험 환경', src: '메모 3절', items: [
      { name: '라즈베리파이 4 + Camera Module 3 Wide', qty: '1', tag: 'have', tagText: 'Pi 보유', det: 'GT 카메라. 방 모서리 2.5 m 이상, 실험 중 Pi의 Wi-Fi·BT 끔. 카메라 모델은 임시' },
      { name: '개인 공유기', qty: '1', tag: 'have', tagText: '보유', det: '데이터 통로 전용. 태그는 2.4 GHz 채널 1·6·11 중 고정, 20 MHz' },
      { name: '노트북', qty: '1', tag: 'have', tagText: '보유', det: '공유기 5 GHz 무선. LAN으로 붙이면 LAN 선(+USB-C LAN 어댑터)' },
      { name: '삼각대', qty: '1', det: '정지·팬텀·전력 실험. 보정 때 2.0 m까지 올라가면 편하다' },
      { name: '카트', qty: '1', det: '이동 실험. 위에 삼각대, 사람이 뒤에서 민다' },
      { name: '2L 생수 6개입', qty: '4', det: '물 팬텀 4단 (한 층 32×21 cm·12 kg, 약 1.3 m)' },
      { name: '헬멧', qty: '1', det: '최종 검증' }
    ] },
    { title: '추가 제안', src: '메모에 없음', items: [
      { name: '줄자 또는 레이저 거리계', qty: '1', tag: 'sug', tagText: '제안', det: '앵커 안테나 중심 좌표, 정지점 좌표, 보정용 3.000 m 실측' },
      { name: '바닥 표시 테이프', qty: '1', tag: 'sug', tagText: '제안', det: '정지 15점과 카트 경로 표시. 같은 경로 반복에 필요' },
      { name: '5 m USB 케이블 또는 충전기 추가', qty: '—', tag: 'sug', tagText: '제안', det: '3 m 케이블은 충전기 1대까지 대부분 닿지 않는다 (1번 환경 참고)' }
    ] },
    { title: '선택', src: '메모 6절', items: [
      { name: '동기화 LED + 220 Ω', qty: '1', tag: 'opt', tagText: '선택', det: 'GPIO14. 카메라 영상과 태그 시계 확인용' },
      { name: 'STEMMA QT → 수 핀 케이블', qty: '2', tag: 'opt', tagText: '선택', det: 'INA228 무납땜 연결' }
    ] }
  ];

  // 클릭했을 때 보여 줄 장치 구성
  S.DEVICES = {
    anchor: {
      role: 'UWB DS-TWR 응답 · Wi-Fi AP · BLE 광고 (RSSI 기준점 겸용)',
      parts: [
        'ESP32-S3 N16R8 보드',
        'DWM3000EVB (J1 점퍼 2–3, D0–D6 비움)',
        '암-암 점퍼 9가닥: GPIO 12·13·11·10 (SPI), 4 (IRQ), 5 (RST), 6 (WAKE), 3V3, GND',
        'USB 케이블 → 충전기 (전원만)',
        '벽 스페이서 5–10 cm, 안테나 방향은 6대 모두 같게'
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
      role: '데이터 통로와 저장. 실험 중 사람은 여기서 모니터링',
      parts: [
        '공유기: 태그 연결은 2.4 GHz (채널 1·6·11 중 고정, 20 MHz)',
        '노트북: 공유기 5 GHz 무선 또는 LAN, 2.4 GHz에는 붙이지 않음',
        '노트북이 태그 시계(µs)를 실제 시각으로 변환해 둘 다 저장',
        '배치는 예시 (방 밖 책상)'
      ]
    },
    charger: {
      role: '앵커 전원 (앵커는 전력 측정 대상 아님)',
      parts: ['멀티포트 USB 충전기, 6포트 이상, 포트당 1 A 이상', '케이블이 길면 앵커 쪽 5 V를 멀티미터로 확인']
    },
    phantom: {
      role: '몸 가림(NLOS) 재현',
      parts: ['2L 생수 6개입 × 4단, 한 층 32 × 21 cm · 12 kg, 약 1.3 m', '태그를 옆에 두면 가슴, 위에 두면 헬멧 상황', '90°씩 돌려 가려지는 앵커를 바꿈']
    }
  };
})(window.SIM);
