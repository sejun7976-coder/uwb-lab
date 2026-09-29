# UWB Lab

UWB 품질이 나빠지는 조건에서 IMU · Wi-Fi RSS · BLE RSS의 측위 기여도를 비교하는 연구의 실험 자료.

- 사이트: https://sejun7976-coder.github.io/uwb-lab/
- [`equipment-sim/`](equipment-sim/) — 장비 시뮬레이터 (장비 목록, 테스트 환경, 테스트 시뮬레이션, 배선 조립). Three.js r128을 CDN에서 불러오는 정적 페이지다.
  - 한 부분만 보기 (노션 임베드용): `equipment-sim/?only=bench` (배선 조립), `?only=env` (테스트 환경), `?only=tests` (테스트 시뮬레이션)
  - `&view=only`: 옵션·패널 없이 3D 화면만 (임베드 칸을 꽉 채움). `&setup=anchor` 또는 `&setup=tag`: 배선 조립에서 앵커 또는 태그만. 예: `equipment-sim/?only=bench&setup=tag&view=only`

배선 조립의 보드 외형·핀 위치 근거: Espressif ESP32-S3-DevKitC-1 v1.1 핀 표, Adafruit INA228·LSM6DSOX EAGLE 기판 파일, Arduino Uno R3 쉴드 헤더 위치.
