# 반쎄오 부스 고객 주문 화면

Figma 고객 주문 흐름의 14개 프레임을 3개 route와 checkout 내부 상태로 구현했습니다.
React + TypeScript + Vite + Tailwind CSS를 사용합니다.

최신 운영 정책: 모든 주문에 휴대전화번호 입력과 수집·이용 동의가 필수입니다. 문자 알림은 선택입니다. 원본 Figma/V4의 전화번호 선택 입력·건너뛰기 경로는 사용자 지시에 따라 변경했습니다.

## 실행

현재 프로젝트 루트 `C:\Users\82107\Documents\festival`에서 실행합니다.

```powershell
npm install
npm run dev
```

브라우저: http://127.0.0.1:5173 (포트가 사용 중이면 Vite가 다음 포트를 안내합니다.)

```powershell
npm run typecheck
npm run build
npm run preview
```

`dist/`에 배포용 파일이 생성됩니다. 일반 터미널에서 위 명령을 실행할 수 있습니다.
Codex의 Windows 샌드박스에서는 Vite/esbuild가 상위 디렉터리를 조회하므로 실행 권한 승인이 필요할 수 있습니다.

## 디자인 및 동작

- 원본 프레임: 1280×800. 원본의 72px 헤더, 32px 본문 여백, 40px 열 간격, 656×596px 이미지를 적용했습니다.
- 좁은 태블릿에서는 원본 두 열 구성의 비율을 유지해 축소합니다. 모바일 전용 재배치는 구현하지 않았습니다.
- `public/assets/`의 음식 사진과 SVG 아이콘은 Figma 원본 에셋입니다.
- Noto Sans KR의 400/700 폰트는 프로젝트에 번들됩니다.
- 수량은 최소 1이며 총 주문금액과 주문 버튼 금액이 즉시 갱신됩니다.
- `/checkout?step=notification|phone|consent|review`의 단계 전환은 history에 기록됩니다. 각 단계는 별도 Page가 아닙니다.
- `HomeHeader`와 `CheckoutHeader`는 분리하고 실제로 같은 부스 이름만 공유합니다.
- 최종 제출 시 immutable payload를 만들며, 제출 중 수정·중복 제출·단계 이동을 막습니다.
- `/orders/:orderId`는 로컬 API의 서버 생성 Order를 조회합니다. 초안을 결과로 사용하지 않습니다.
- API 실패 시 원래 확인 화면에서 다시 제출할 수 있습니다. 별도 오류 UI는 Figma에 없어 추가하지 않았습니다.
- 응답 결과가 불명확한 제출은 sessionStorage에 같은 키·payload를 보관합니다. 새로고침 후 재시도도 기존 주문 조회를 먼저 수행하며, 조회 실패 시 새 주문을 보내지 않습니다.
- 제출 성공 시 원문 전화번호와 동의 초안을 지우고, 결과에는 마지막 서버 응답의 마스킹된 정보만 남깁니다. 홈 접근 시에도 고객 입력을 초기화합니다.
- 클라이언트가 확인한 expectedUnitPrice를 서버에서 검증하며 불일치 시 PRICE_CHANGED로 거부합니다.

## 파일

```text
package.json / package-lock.json  의존성 및 실행 스크립트
index.html                       한국어 HTML 진입점
tsconfig.json                    TypeScript 설정
vite.config.ts                   React 및 Tailwind 플러그인
src/main.tsx                     React 진입점 및 로컬 폰트 로드
src/index.css                    Tailwind 및 Figma 색상 토큰
src/App.tsx                      초안 Provider 및 Router 구성
src/components/ActionButton.tsx  수량 및 주문 공통 버튼
src/components/QuantityStepper.tsx 수량 조절
src/components/layout/           HomeHeader, CheckoutHeader, BoothIdentity, FrameLayout
src/app/                         route와 query/history 처리
src/pages/                       Home, Checkout, OrderResult의 3개 Page
src/features/checkout/           입력 단계 컴포넌트와 초안·제출 관리
src/features/checkout/submissionJournal.ts 새로고침을 견디는 제출 기록
src/features/checkout/recoverSubmission.ts 기존 주문 조회 후 같은 키 재시도
src/features/orders/             Order API 클라이언트
src/domain.ts                    도메인 타입·검증·불변 snapshot
src/design/figmaFrameMap.ts       Figma 14개 프레임과 화면 상태 대응
server/orderApi.ts               로컬 개발·미리보기용 주문 API
tests/                           snapshot·검증·API 중복 생성 방지 테스트
public/assets/banh-xeo.png        Figma 음식 사진
public/assets/utensils.svg        Figma 아이콘
verification/figma-reference.png Figma 1280×800 비교 이미지
verification/implementation-1024.jpg 구현 1024×640 검증 이미지
.gitignore                       생성물 제외 설정
```

기존 `festival-order/` 하위 폴더와 별개로 현재 폴더 루트가 이 프로젝트입니다.

## 검증

- `npm install`: 완료, 취약점 0개.
- `npm run typecheck`: 오류 없음.
- `npm run build`: 성공.
- `npm run dev`: 서버 실행 및 브라우저 접속 확인.
- 1280×800 / 1024×640에서 Figma 스크린샷과 시각 비교 및 에셋 렌더링 치수 확인.
- 수량 1→2→1 및 총액 6,000→12,000→6,000원 갱신 확인.
- 단위 테스트 7개 / API 테스트 4개 통과. 동일 키 50개 동시 요청, 가격 거부, 응답 유실 복구 및 개인정보 제거 확인.

## Railway 배포

2026-10-05 진행 상황: 배포 서버와 Railway 설정 구현, 빌드·타입 검사·단위 테스트 7개·배포 서버 통합 검증(API 테스트 4개 포함) 완료. Railway 공개 주소에서의 검증과 DB 연결은 아직 진행하지 않았습니다.

현재 폴더 루트의 `railway.json`이 빌드와 실행을 설정합니다. `festival-order/`를 Root Directory로 지정하지 마세요.

1. 이 루트 프로젝트의 소스와 `package-lock.json`, `railway.json`을 GitHub 저장소에 올립니다.
2. Railway에서 New Project → Deploy from GitHub repo로 해당 저장소를 선택합니다. 기존 서비스가 있다면 그 서비스의 Source에 연결합니다.
3. Root Directory는 `/`, Build Command는 `npm run build`, Start Command는 `npm start`입니다. 설정 파일에서 자동 적용됩니다.
4. 배포 후 서비스 Settings → Networking → Public Networking에서 Generate Domain을 선택합니다.
5. 생성된 주소의 `/health` 응답과 홈 화면, 주문 접수, 결과 화면 새로고침을 확인합니다.

Node.js 22를 사용하며, 서버는 `0.0.0.0`과 Railway가 제공하는 `PORT`로 실행됩니다. `/health`는 배포 상태 확인 경로입니다. 프런트엔드와 `/api`가 같은 서버에서 제공되므로 별도 API URL 설정은 필요 없습니다.

로컬에서 배포 버전을 확인하려면:

```powershell
npm run build
npm run test:deploy
npm start
# http://localhost:3000
```

Railway CLI를 사용한다면 로그인 후 `railway link`로 프로젝트/서비스를 선택하고, 이 루트 폴더에서 `railway up`을 실행합니다.

현재 API는 데모용입니다. 주문·재고·중복 요청 기록은 재시작/재배포하면 초기화되므로 서비스 복제본은 1개로 유지합니다. 실제 부스 운영 전에 DB 영구 저장이 필요합니다. 결제와 문자 발송도 아직 연결되지 않았습니다.

## 로컬 주문 API 동작

`npm run dev`와 `npm run preview`에 데모 API가 함께 실행됩니다.
주문 번호는 37부터 시작하고 금액은 서버 상품 단가로 계산합니다. 같은 requestId의 재요청은 같은 주문을 반환합니다.
800ms 응답 지연으로 Figma의 접수 중 상태를 확인할 수 있습니다.
주문·재고는 서버 메모리에만 보관하므로 서버 재시작 시 초기화됩니다. 실제 결제·SMS·자동취소 처리는 연결되지 않았습니다.
정적 `dist/` 배포 시에는 실제 API 서버와 SPA fallback 설정이 필요합니다.

```powershell
npm test
# 개발 서버가 실행 중인 별도 터미널에서:
npm run test:api
```

품절·일시 중지 비교는 UI에 디버그 버튼을 추가하지 않고 환경 변수로 확인합니다.

```powershell
$env:DEMO_AVAILABILITY='paused' # 또는 'soldOut'
npm run dev
# 정상 판매로 복귀하려면 서버 종료 후:
Remove-Item Env:DEMO_AVAILABILITY
npm run dev
```

추가 설계·프레임 대응·검증 기록: [docs/implementation.md](docs/implementation.md)
