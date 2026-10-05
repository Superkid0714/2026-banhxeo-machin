# 고객 주문 흐름 구현

최신 정책 변경: 전화번호는 모든 주문에서 필수이고 문자 알림만 선택한다. notification → phone → consent → review 순서가 공통이다. 원본 Figma와 달리 phone/consent의 건너뛰기 버튼을 제거했고, SMS 미사용 주문도 전화번호·동의를 보관한다. 아래 원본 프레임은 레이아웃 reference이며 선택 입력에 관한 기존 설명은 이 정책으로 대체한다.

## Route / step / state

- `/`: 상품 주문 홈. available / soldOut / paused는 도메인 상태이며 마지막 두 상태는 Figma의 동일 SOLD OUT presentation을 사용한다.
- `/checkout?step=notification`: 알림 방법 선택.
- `/checkout?step=phone`: 전화번호 입력과 오류.
- `/checkout?step=consent`: 개인정보 동의 여부.
- `/checkout?step=review`: 문자 사용 여부·수량·제출 진행 상태.
- `/orders/:orderId`: 서버 생성 Order 조회 결과. 생성 완료는 결제 완료나 수령 완료가 아닌 paymentPending이다.

4개 checkout step은 하나의 CheckoutPage 내부 컴포넌트다. 이동 시 pushState하고 popstate로 복원한다. 없는 step이나 선행 조건이 누락된 직접 링크는 replaceState로 유효한 단계에 정규화한다. 입력은 sessionStorage로 같은 탭의 새로고침을 지원한다.

HomeHeader와 CheckoutHeader는 각각 구현한다. 공유하는 작은 요소는 BoothIdentity다. 프레임에서 확인되지 않은 Modal, Drawer, Dialog, 오류 화면은 만들지 않는다.

## 제출 경계

1. 최종 버튼 클릭 직후 ref 잠금으로 같은 이벤트 루프의 중복 제출을 막는다.
2. draft를 복사한 flat payload를 Object.freeze한다. readonly 타입도 적용한다.
3. 제출 중 모든 draft mutator, 단계 이동, 수량·번호 변경·뒤로가기 버튼이 잠긴다. 브라우저 back/forward는 기존 history 위치로 복원한다.
4. 서버는 수량·번호·동의를 재검증하고 금액·주문 ID·번호·상태를 생성한다. 같은 요청 키로 주문을 중복 생성하지 않는다.
5. 성공하면 서버 ID의 주문 결과 route로 이동하고 GET으로 Order를 조회한다. 결과는 draft를 읽지 않는다.
6. 실패하면 입력을 보존하고 기존 Figma 확인 화면으로 돌아온다. 입력 수정 전 재시도는 같은 snapshot/key를 사용한다.
7. 처음 화면으로 이동할 때 초안을 초기화한다. 번호 수정 시 동의도 초기화한다.

## Figma 대응

| 프레임 | route / step / state |
| --- | --- |
| 4:42962 | / · available |
| 4:42997 | / · soldOut 또는 paused |
| 4:43036 | checkout · notification · null |
| 4:43068 | checkout · notification · sms |
| 4:43100 | checkout · notification · orderNumber |
| 4:43132 | checkout · phone · 정상 |
| 4:43187 | checkout · phone · 오류 |
| 4:43243 | checkout · consent · false |
| 4:43279 | checkout · consent · true |
| 4:43316 | checkout · review · sms |
| 4:43362 | checkout · review · orderNumber |
| 4:43405 | checkout · review · submitting |
| 4:43452 | orders/:orderId · sms |
| 4:43480 | orders/:orderId · orderNumber |

이 대응 관계는 src/design/figmaFrameMap.ts에 기록했다.

## 검증

- TypeScript 검사, Vite 빌드.
- snapshot 불변성, 필수 전화번호·동의 검증, 제출 저널 및 응답 유실 복구: 7개 단위 테스트.
- 동시 요청의 동일 주문 반환, 요청 키 충돌 거부, 서버 주문 재조회, 가격·전화번호·동의 검증: 4개 API 테스트.
- 배포 서버의 상태 확인, SPA 직접 접근, 정적 파일, API 테스트 실행: `npm run test:deploy`.
- 브라우저에서 문자 / 주문번호 경로의 생성 결과, 번호 오류, 동의 버튼 활성 조건 확인.
- query history back/forward 및 review 새로고침 후 초안 유지 확인.
- 문자 알림 건너뛰기 후 뒤로가기, 번호 변경 후 동의 초기화 확인.
- submitting 프레임에서 모든 버튼 disabled, 브라우저 back 차단 확인.
- 주문 결과 URL 새로고침으로 서버 Order 재조회 확인.
- 원본 1280×800 및 태블릿 1024×640의 이미지·아이콘·배치 비교. 늘어난 info 아이콘을 24×24로 수정.
- 10개 Figma 에셋의 로컬 파일 크기와 SVG root 치수 확인.

스크린샷은 verification/에 저장한다. 로컬 API는 데모이며 production persistence, 결제, SMS, 자동취소가 구현된 서버로 간주하지 않는다.
