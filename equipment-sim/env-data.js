// 테스트 공간 3종(가정)과 노드 부품 치수. 단위 m(공간) · mm(부품)
// 좌표: x = 가로(동쪽), y = 세로(북쪽), z = 높이. 원점 = 남서쪽 바닥 모서리
(function (S) {
  const E = S.ENV = {};

  E.STANDOFF = 0.07;          // 벽 → 안테나 중심 (연구개요: 벽에서 5–10 cm)
  E.TAG_Z = { cart: 1.2, helmet: 1.75 };
  E.GRID_STEP = 0.25;         // 평가 격자 간격
  E.MIN_SEP = 1.2;            // 앵커끼리 최소 간격 (수평)

  // 공간 크기는 아직 정해지지 않았다. 아래는 계산용 가정값이며 화면에서 바꿀 수 있다.
  E.SPACES = {
    A: {
      id: 'A', name: 'A. 기본 방', w: 6.0, l: 8.0, h: 3.0, heights: [2.0, 2.5], margin: 0.5,
      role: '본 실험 (0 보정 · 1 정지 · 2 카트 · 3 물 팬텀 · 4 간섭 · 5 전력 · 6 안전모)',
      note: '비교적 빈 실험실·세미나실을 가정. 크기는 권장 하한(5 × 6 m)보다 조금 크게 잡았다.',
      obstacles: []
    },
    B: {
      id: 'B', name: 'B. 장애물 공간', w: 7.0, l: 9.0, h: 3.0, heights: [2.5, 2.8], margin: 0.5,
      role: '일반화 평가 (1 정지 · 2 카트 · 6 안전모 반복), 자연스러운 NLOS',
      note: '금속 선반·장비가 있는 실험실·창고를 가정. 장애물 배치는 예시다. 선반(2.0 m) 위로 보이도록 앵커를 2.5·2.8 m에 둔다.',
      obstacles: [
        { kind: 'shelf', name: '금속 선반 1', x: 2.2, y: 4.6, hx: 0.3, hy: 1.5, z0: 0, z1: 2.0 },
        { kind: 'shelf', name: '금속 선반 2', x: 4.8, y: 4.6, hx: 0.3, hy: 1.5, z0: 0, z1: 2.0 },
        { kind: 'bench', name: '작업대', x: 5.4, y: 1.3, hx: 0.9, hy: 0.4, z0: 0, z1: 0.9 },
        { kind: 'cabinet', name: '캐비닛', x: 0.3, y: 7.7, hx: 0.25, hy: 0.6, z0: 0, z1: 1.9 },
        { kind: 'rack', name: '장비 랙', x: 6.6, y: 7.6, hx: 0.35, hy: 0.45, z0: 0, z1: 1.8 }
      ],
      // 카트·안전모 경로: 선반 두 개를 둘러싸는 통로 고리 (장애물에서 0.4 m 이상, 기본 장애물 배치용)
      loop: [[1.0, 2.3], [1.0, 6.9], [5.9, 6.9], [5.9, 2.3], [1.0, 2.3]]
    },
    C: {
      id: 'C', name: 'C. 복도', w: 2.4, l: 20.0, h: 2.7, heights: [2.0, 2.4], margin: 0.4,
      role: '7 유효거리 (거리별 BLE·Wi-Fi RSSI·수신율) + 길쭉한 공간에서의 측위',
      note: '직선 복도를 가정. 유효거리 측정은 남쪽 끝 삼각대 위 기준 노드(앵커와 같은 구성, 1.2 m)와 중심선 위 측정점을 쓴다.',
      obstacles: [],
      rangeMarks: [1, 2, 3, 5, 7.5, 10, 12.5, 15, 17.5]
    }
  };

  // 노드 부품 치수 (mm). approx = 실제 제품 치수를 확인하지 못해 근사한 값
  E.PARTS = {
    plate: { w: 210, h: 297, t: 5, name: '폼보드 5 mm (A4)' },
    spacer: { w: 180, h: 35, name: '스티로폼 스페이서', note: '벽 → 안테나 중심 70 mm가 되도록 두께를 맞춘다' },
    bank: { L: 96, W: 64, T: 16, name: 'NEXTU 1006QPB MINI 10000mAh', approx: true, mass: 160 },   // 외형·무게는 다나와 제품 정보, 포트 위치는 근사
    esp: { L: 70, W: 28, T: 1.6, name: 'ESP32-S3-DevKitC-1 호환 N16R8', approx: true },
    wroom: { L: 25.5, W: 18, T: 3.1, can: 18, name: 'ESP32-S3-WROOM-1 모듈' },
    dwm: { L: 68.58, W: 53.34, T: 1.6, name: 'Qorvo DWM3000EVB (Arduino Uno 쉴드 외형)' },
    dwmModule: { L: 23, W: 13, T: 2.9, name: 'DWM3000 모듈', approx: true },
    standOnPins: 21,            // 보드가 핀 + 암 커넥터 위에 얹힌 높이 (배선 조립과 같음)
    cable: { len: 200, name: 'USB A→C 케이블 약 20 cm (Adafruit 5045)' }
  };

  // 노드 판 위 배치 (mm, 판 가운데 원점, x 오른쪽, y 위). ESP·DWM 상대 위치는 배선 조립의 기본 배치와 같다
  E.NODE_LAYOUT = {
    pairShift: [0, 75],         // 배선 조립 앵커 배치 { esp (-9,-22), dwm (9,22) rot 180 }를 위로 75 mm
    bank: { x: 0, y: -85 }      // 포트(짧은 변)는 왼쪽
  };

  // 히트맵 색 (순차 파랑 100→650, dataviz 기본 팔레트)
  E.SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#104281'];
  E.SEQ_DARK = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef'];
})(typeof window !== 'undefined' ? (window.SIM = window.SIM || {}) : module.exports);
