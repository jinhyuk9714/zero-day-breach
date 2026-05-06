# Zero-Day Breach

`Zero-Day Breach`는 고정된 브랜칭 맵을 따라 침입 경로를 선택하고, 카드 시너지로 방어망을 돌파하는 전술 덱빌딩 웹 게임입니다. 현재 구현은 `Start → Map → Battle / Repair → Reward → Boss → Result` 흐름을 갖춘 결정론적 프로토타입입니다.

## 게임 개요

플레이어는 `Ping`, `Buffer`, `Worm`, `Probe`, `Burst`, `Payload`로 구성된 시작 덱을 들고 침투를 시작합니다. 전투 노드와 수리 노드가 섞인 `5-node + boss` 맵을 통과한 뒤 `Sentinel Firewall` 보스를 상대합니다.

랜덤성보다 테스트 가능한 고정 흐름에 초점을 맞췄습니다. 덱 순서, 맵 연결, 보상 후보, 적 의도는 모두 코드에서 결정론적으로 정의되어 있어 브라우저 검증과 Node 테스트가 같은 전투 흐름을 재현할 수 있습니다.

## 주요 특징

- 고정 브랜칭 맵과 boss 노드
- `Relay Drone`, `Proxy Warden`, `Sentinel Firewall` 전투
- 수리 노드의 `HP 회복 + Lag 제거`
- 전투 후 고정 후보 3장 중 1장을 고르는 보상
- `Exposed`를 쌓고 `Burst`, `Ping`, `Payload`로 연결하는 카드 시너지
- 데스크톱 드래그 핸드와 모바일 탭 플레이
- 전체화면 진입과 반응형 전투 레이아웃

## 플레이 흐름

1. `Start Breach`로 런을 시작합니다.
2. 맵 오버레이에서 다음 노드를 선택합니다.
3. 전투에서는 적의 의도를 읽고 카드를 사용해 피해, 방어, 상태 이상을 처리합니다.
4. 전투 후 보상 카드를 설치하거나, 수리 노드에서 회복한 뒤 다음 분기로 이동합니다.
5. 다섯 번째 노드를 지나면 `Sentinel Firewall` 보스에 진입합니다.
6. 보스를 격파하거나 HP가 0이 되면 결과 화면으로 이동합니다.

## 조작

- 카드 사용: 클릭 또는 데스크톱 드래그
- 노드 선택: 맵 오버레이에서 클릭
- 보상 선택: 보상 카드 클릭
- 턴 종료: `End Turn`
- 전체화면: `F`
- 전체화면 해제: `Esc`

## 기술 스택

- Vite
- JavaScript ES Modules
- CSS
- Node test runner
- Playwright 기반 브라우저 검증 흐름

## 프로젝트 구조

```text
.
├─ index.html
├─ src/
│  ├─ game.js        # 전투, 맵, 보상, 런 상태 엔진
│  ├─ ui-model.js    # 화면 상태와 반응형 표시 모델
│  ├─ drag-hand.js   # 데스크톱 카드 드래그 helper
│  ├─ main.js        # DOM, canvas, 입력 처리
│  └─ style.css
├─ test/
│  ├─ game.test.js
│  ├─ ui-model.test.js
│  └─ drag-hand.test.js
└─ progress.md       # 구현과 검증 기록
```

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

## 참고 사항

- 현재 버전은 결정론적 프로토타입이라 카드 풀과 적 패턴이 고정되어 있습니다.
- `progress.md`에는 기능 추가와 브라우저 검증 과정을 시간순으로 기록했습니다.
