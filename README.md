# Zero-Day Breach

`Zero-Day Breach`는 고정된 브랜칭 맵을 따라 침입 경로를 선택하고, 카드 시너지로 방어망을 돌파하는 전술 덱빌딩 웹 게임입니다.  
현재 버전은 `Start -> Map -> Battle / Repair -> Reward -> Boss -> Result` 흐름의 결정론적 프로토타입입니다.

## 게임 개요

- `5-node + boss` 구조의 고정 맵 보드를 사용합니다.
- 전투 노드는 `Relay Drone`, `Proxy Warden`, 최종 보스 `Sentinel Firewall`로 구성됩니다.
- 수리 노드는 전투 없이 `HP 회복 + Lag 제거`를 제공합니다.
- 보상은 전투를 이긴 뒤 고정된 후보 3장 중 1장을 고르는 방식입니다.
- 모든 덱 순서, 맵 연결, 보상 후보, 적 의도는 결정론적으로 고정되어 있습니다.

## 플레이 흐름

1. `Start Breach`로 런을 시작합니다.
2. 맵 오버레이에서 다음 노드를 선택합니다.
3. 전투에서는 카드 콤보로 적의 의도를 읽고 `Exposed`를 활용해 압박합니다.
4. 전투 후 보상 카드를 설치하거나, 수리 노드에서 회복한 뒤 다음 분기로 이동합니다.
5. 다섯 번째 노드를 지나면 `Sentinel Firewall` 보스에 진입합니다.

## 조작

- 마우스 클릭으로 카드 사용, 노드 선택, 보상 선택을 진행합니다.
- 데스크톱 전투에서는 카드를 위로 드래그해서 발동할 수도 있습니다.
- `End Turn`으로 턴을 종료합니다.
- `F`로 전체화면, `Esc`로 전체화면 해제를 지원합니다.

## 카드와 보상 방향

- 시작 덱: `Ping`, `Buffer`, `Worm`, `Probe`, `Burst`, `Payload`
- `core` 보상 풀: `Ping`, `Buffer`, `Worm`
- `combo` 보상 풀: `Probe`, `Burst`, `Payload`
- `Exposed`를 깔고 `Burst / Ping / Payload`로 이어가는 흐름이 핵심입니다.

## 실행 방법

```bash
npm install
npm run dev
```

개발 서버가 뜨면 브라우저에서 Vite 주소를 열어 바로 플레이할 수 있습니다.

프로덕션 빌드 확인:

```bash
npm run build
npm run preview
```

## 테스트

```bash
npm test
```

테스트는 전투 엔진, 맵 진행, 보상 선택, 드래그 UX, UI 모델을 함께 검증합니다.

## 현재 상태

- 데스크톱: 원스크린 전술 콘솔 + 우측 텔레메트리 + 하단 드래그 핸드
- 모바일: stacked 레이아웃 + full map overlay
- 브라우저 자동 검증: Playwright 기반 루프로 맵 시작, 전투, 보상, 수리, 보스, 결과 흐름을 확인합니다.
