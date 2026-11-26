# 기술 선택·실패 대응·검증 근거

2026-11-26 소스와 운영 기록을 기준으로 작성했다. 구조·ERD·시퀀스는 [기술 종합](technical-reference.md), 운영 경험은 [회고](field-operation-changes.md), 적용 버전은 [배포 기록](deployment-runbook.md), 성과는 [운영 수치](operations-record.md#이틀-운영의-수치-비교)를 따른다.

## 설계 선택을 설명하는 기준

다음 표는 **현재 구현을 검토한 사후 기술 평가**다. 당시 모든 대안을 실험·벤치마크한 의사결정 기록은 없으므로 “다른 기술보다 빨라서 채택했다”와 같은 역사적 이유를 만들어 쓰지 않는다. 실제 선택, 얻는 특성, 부담, 재검토 조건을 구분한다.

| 현재 선택 | 구현에서 얻는 특성 | 대안과 비용 | 재검토 조건 |
| --- | --- | --- | --- |
| 같은 출처의 React 화면·Node API | 고객·관리자·API를 한 배포 단위로 관리하고 같은 출처 쿠키 사용 | 별도 프런트/API는 독립 배포가 가능하나 인증·출처·버전 관리를 추가로 다뤄야 함 | 독립 배포·트래픽·조직 경계 필요 |
| SQLite·단일 서버 | 파일 영속 저장과 로컬 트랜잭션, 현재 운영 규모에서 배포 구조가 단순함 | PostgreSQL 등 별도 DB는 공유 접근·인덱스·확장 설계가 가능하나 운영과 이관 작업 필요 | 여러 서버·큰 이력·동기 DB 작업 지연 발생 |
| 단일 JSON 상태 행 | 주문·번호·요청 키·재고를 한 번의 읽기/갱신 트랜잭션에 포함 | 행 정규화는 조회·제약에 유리하나 현재 JSON 이관과 호환·tombstone 보존 필요 | 전체 상태 읽기·쓰기 비용과 감사 이력 요구 증가 |
| 관리자 5초 폴링 | 일반 HTTP 재조회·재연결 로직으로 최신 상태 반영 | WebSocket/SSE는 표시 지연을 줄일 수 있으나 연결·복구·인증·재동기화 설계가 필요 | 상태 표시 지연이 업무상 허용 범위를 넘음 |
| 서버 버전 검사 | 오래된 화면의 변경이 성공한 처리를 덮어쓰지 않음 | 화면별 선점/담당 잠금은 중복 조작을 미리 줄일 수 있으나 잠금 만료·이탈 처리가 필요 | 실제 충돌 빈도와 직원 혼선이 높아짐 |
| 같은 탭 저널·동일 요청 키 복구 | 응답 유실 뒤 기존 접수 여부를 조회하고 같은 제출값으로 재시도 | 기기 간 복구에는 서버 측 고객/키오스크 세션과 추가 접근 통제 필요 | 다른 기기에서 이어받기·탭 종료 복구 요구 |
| 주문 내부 문자 작업 상태·주기 작업 | 주문 상태와 발송 예정 상태를 같은 저장에 기록, 외부 호출은 트랜잭션 밖에서 처리 | 독립 outbox·큐는 작업 확장·관찰에 유리하나 별도 스키마·작업자·전달 보장 설계 필요 | 문자량·작업 지연·재처리 요구 증가 |
| 최근성 가중 회귀 | 소량 기록에서 입력·계수·오차를 설명하고 서버에서 재구성 가능 | 단순 평균은 대기 수량을 반영하지 못함. 복잡한 모델은 더 많은 자료·평가 필요 | 충분한 표본에서 더 나은 검증 결과를 확인 |
| 메모리 관리자 세션 | 서버에서 세션 생성·폐기를 관리하고 브라우저는 HttpOnly 쿠키 사용 | 공유 세션 저장은 재시작·여러 서버에 유리하나 별도 저장·만료 관리 필요 | 재시작 로그인 유지·수평 확장 필요 |

위 표는 실제로 부하 실험이나 비용 비교를 수행했다는 뜻이 아니다. 특히 폴링 표시 지연과 서버 쓰기 정합성은 다른 문제이며 실시간 전송을 추가해도 서버 버전 검사는 필요하다.

## 반드시 유지하려는 조건과 테스트 연결

불변 조건은 모든 오류를 없애겠다는 약속이 아니라 코드가 유지하려는 업무 규칙이다. 아래는 테스트의 실제 이름·상황과 연결한 근거이며 특정 실패 주입·기기 시험을 수행하지 않은 항목은 따로 표시한다.

| 조건 | 구현 경계 | 실제 테스트 근거 | 보장하지 않는 범위 |
| --- | --- | --- | --- |
| 같은 요청 키·본문으로는 기존 주문 반환 | `OrderStore.create`, transaction, requests 맵 | [API 테스트](../tests/api.test.mjs): `50 concurrent submissions return the same order; semantic price changes reject creation` | 다른 새 키의 동일 고객 주문 자동 병합 |
| 응답 유실 후 조회 없이 새 생성하지 않음 | `recoverSubmission`, `submissionJournal` | [복구 테스트](../tests/recovery.test.ts): `response loss recovery returns the original server order without another POST`, `lookup outage never creates another order; confirmed absence retries the identical payload` | 탭 종료·저장소 삭제·다른 기기 복구 |
| 주문·재고는 오류 시 함께 유지/복구 | `BEGIN IMMEDIATE`, `COMMIT/ROLLBACK` | [운영 테스트](../tests/operations.test.ts): `expiry, restoration, cancellations and stale actions keep stock consistent` | 정전·디스크 오류의 실제 장애 주입 시험 |
| 오래된 주문 버전의 변경 거부 | `action`, `deleteHistory`의 버전 비교 | [운영 테스트](../tests/operations.test.ts): `expiry, restoration, cancellations and stale actions keep stock consistent`, 보관 테스트의 오래된 버전 재요청 | 두 실기기의 실제 무선망에서 발생한 모든 충돌 |
| 같은 예약의 동시 접수는 주문 1개 | 예약 ID 키·transaction | [예약 접수 테스트](../tests/reservationCheckIn.test.ts): `check-in API verifies server data and concurrent retries return one order` | 외부 예약 서버로 수령 상태 양방향 동기화 |
| 삭제 뒤 동일 요청·예약 재생성 차단 | 요청 키에 deleted 표식 유지 | [운영 테스트](../tests/operations.test.ts): `history deletion persists, removes customer data and never reuses a number or request`; [예약 테스트](../tests/reservationCheckIn.test.ts): `reservation deduplication persists through restarts, new sessions and history deletion` | 별도 새 키로 생성하는 현장 주문과 삭제 전 전체 감사 이력 |
| 고객 응답에 전체 번호를 포함하지 않음 | publicOrder/adminOrder 분리 | [관리자 테스트](../tests/admin.test.mjs): `admin authentication protects orders and revokes sessions`; [운영 테스트](../tests/operations.test.ts): `admin snapshots decrypt full phone numbers for persisted orders while customer responses stay masked` | 화면 캡처·권한 있는 직원의 외부 복사 방지 |
| 불명확한 문자 전송을 자동 재발송하지 않음 | submitted/unknown 구분, lease·메시지 ID 검사 | [운영 테스트](../tests/operations.test.ts): `an uncertain SMS response does not trigger an automatic second send`, `payment confirmation SMS submits once on entering cooking, distinguishes delivery and fences late responses` | 통신사 전달의 정확히 한 번 보장 |
| 잘못된 수령코드는 외부 조회 전 차단 | 도메인·예약 프록시 형식 검증 | [예약 조회 테스트](../tests/reservationLookup.test.ts): `invalid pickup code lengths never consume an upstream lookup attempt` | 실제 예약 서버의 모든 입력·장애 특성 |
| 모델은 미래 완료 정보를 학습하지 않음 | 표본 시각 필터·순차 검증 | [모델 테스트](../tests/waitTimeModel.test.ts): `instant clicks, reversed clocks and future completions do not train the model` | 준비·실제 전달 버튼 기록 의미의 정확성 |

현장 키의 hash는 정규화한 JSON 의미가 아닌 **수신 원문 본문의 SHA-256**이다. 같은 키라도 본문 직렬화가 달라지면 충돌할 수 있다. 현재 클라이언트는 저장한 payload를 동일 경로로 재사용한다. 의미가 같은 모든 JSON을 멱등 처리한다고 확대 설명하지 않는다.

설정 버전 검사, 조회 응답 순번과 연결 실패 시 UI 제한도 구현돼 있지만, 이를 각각 실기기 E2E로 검증한 기록은 없다. 관련 코드와 검증 공백을 구분한다. 48건 통과는 전체 런타임 테스트의 당시 결과이고, 아래 분석 스크립트의 테스트는 별도다.

## 실패 상황별 처리와 운영 대응

| 실패 지점·상황 | 현재 코드의 결과 | 운영자·클라이언트 대응 | 남는 위험·검증 공백 |
| --- | --- | --- | --- |
| 저널 저장 실패 | API 제출을 진행하지 않음 | 브라우저 저장 상태 확인 후 같은 흐름 재시도 | 다른 기기 이관 절차 없음 |
| 제출 전 기존 결과 조회가 실패 | 실패를 주문 부재로 해석하지 않고 생성 중단 | 같은 제출값 유지, 연결 복구 뒤 조회 | 무한 자동 재시도 큐 없음 |
| DB 저장 후 POST 응답 유실 | 서버 주문은 남을 수 있음 | 같은 requestId로 기존 결과 조회 | 저널을 지우고 새 키를 만들면 별도 주문 가능 |
| 두 태블릿의 오래된 상태 변경 | 409 `ALREADY_PROCESSED`; 설정은 `SETTINGS_CHANGED` | 안내 뒤 최신 상태·이력 확인 | 어느 기기의 충돌인지 남기는 전용 장부 없음 |
| 트랜잭션 내부 검증·갱신 실패 | 예외 시 ROLLBACK; StoreError는 해당 코드, 기타 오류는 API 500 `STORAGE_UNAVAILABLE` | 기존 결과·주문 상태 재조회, 저장소 상태 점검 | I/O 오류 자체의 복구 보장은 아님 |
| SQLite 잠금 지속 | `busy_timeout=5000`, 제한 내 해소되지 않으면 DB 오류 가능 | 자동 생성 재시도 대신 기존 요청 결과 확인 | 단일 서버를 넘어선 공유 DB 부하 시험 없음 |
| 예약 서버 timeout·비정상 응답 | 조회 오류 반환, 확인되지 않은 예약을 신규 접수하지 않음 | 같은 코드 재시도·직원 확인 | 양쪽 상태 자동 화해·대체 원장 생성 없음 |
| 문자 발송 요청 중 timeout·서버 오류 | 실패를 확정할 수 없으면 unknown, 무조건 재전송하지 않음 | 실제 결과 확인 후 허용된 관리자 재발송 | 외부에서는 이미 전송됐을 수 있음 |
| 문자 sending 상태의 작업 중단 | 60초 경과 후 unknown, 오래된 lease 결과는 무시 | 결과 확인과 수동 재안내 판단 | payment 후 pickup 대기 전환 등 업무별 상태를 함께 확인 |
| 문자 submitted의 전달 조회 실패 | 접수 상태 유지하며 조회. 10분 경과 시 unknown 전환 경로 존재 | 접수와 실제 전달을 구분 | 단말 수신·고객 방문을 보장하지 않음 |
| 서버 재시작 | DB 주문·요청 키 유지, 메모리 세션 소실, 모델은 이력으로 재구성 | 관리자 재로그인·볼륨·키 확인 | 자동 백업·복원 리허설 완료 증거 없음 |
| 암호화 키 불일치 | 기존 번호 복호화·관리자 조회가 실패할 수 있음 | 기존 키·볼륨 일치 여부 점검 | DB만으로 전화번호 복구 불가 |

외부 문자·예약 호출은 DB 쓰기 트랜잭션을 유지한 채 기다리지 않는다. DB와 외부 서비스에 원자적 동시 commit을 하는 구조도 아니다. 실패 시점에 따라 결과가 불명확해질 수 있다는 점이 재조회·lease·수동 확인의 이유다.

## 71% 관측 성과의 재현

### 공유 가능한 분석 코드와 입력 경계

[분석 스크립트](../scripts/analyze-operation-days.mjs)는 **네트워크·관리자 로그인·주문 변경 없이** 로컬 최소 입력에서 날짜별 합계와 시간 지표를 계산한다. 원본 API 응답이나 DB를 직접 입력하지 않는다. 실제 날짜별 데이터 파일은 비공개 `verification/`에만 보관한다. 공개 저장소에는 코드와 아래 합성 예시만 둔다.

원본에서 허용된 담당자가 추출할 필드는 다음과 같다.

| 필드 | 추출 규칙 |
| --- | --- |
| `createdAt` | 접수 시각. 시간대가 명시된 ISO 문자열 |
| `completedAt` | history 배열에서 첫 `조리 완료…` 또는 정확한 `수령 완료` 시각. 없으면 null |
| `quantity`, `total` | 주문 수량·기록 금액 |
| `resendRequests` | `label === 문자 재안내 요청` 이벤트 수 |

주문 ID·번호·전화번호·actor·원본 history·쿠키·암호문·예약코드는 입력에 필요 없다. 스크립트는 허용하지 않은 record 필드를 거부하지만, 시각·수량 자체도 상세 운영 자료이므로 **최소 입력을 완전한 익명 자료라고 간주해 공개하지 않는다.** 출력만 날짜별 집계다. 이 스크립트는 주어진 기록을 분석하며 원본의 누락·중복을 독립적으로 입증하지 않는다.

합성 입력 예시:

```json
{
  "schemaVersion": 1,
  "records": [
    {"createdAt":"2026-10-06T09:00:00Z","completedAt":"2026-10-06T09:20:00Z","quantity":1,"total":6000,"resendRequests":0},
    {"createdAt":"2026-10-07T09:00:00Z","completedAt":"2026-10-07T09:10:00Z","quantity":1,"total":6000,"resendRequests":1}
  ]
}
```

이 예시는 실제 기록이나 71%를 복제한 데이터가 아니다. 실제 입력은 같은 스키마로 비공개 파일에 저장한다.

```sh
node scripts/analyze-operation-days.mjs verification/two-day-minimal.local 2026-10-06 2026-10-07
node --test tests/operationAnalysis.test.mjs
```

스키마·시간대·수량 검증 후 한국 접수 날짜별로 분리하고, 전체 비음수 완료 기록과 15초~120분 보조 표본을 별도 집계한다. 완료 누락·역전·비교 날짜 외 기록 수를 출력한다. 백분위수는 nearest-rank다. 비율은 반올림 전 평균으로 계산하고 최종 출력만 소수 넷째 자리로 반올림한다. 표본이 없거나 기준값이 0이면 감소율은 null이다.

실제 이틀 기록은 누락·역전 없이 58건·49건이었고, 평균 감소율 약 70.5853%를 반올림해 약 71%로 표시한다. 이 수치는 스크립트의 집계와 [상세 산식](operations-record.md#이틀-운영의-수치-비교)을 대조한다. 인력·숙련도 유사, 둘째 날 재료 지연은 운영자 확인이며 입력 데이터로 통제한 변수가 아니다.

통계적 유의성은 기술통계 재현과 별도다. [통계 해석](statistical-review.md)은 실제 표본의 독립성이 보장되지 않음을 명시하고, 가정을 둔 탐색 검정·표본 조건별 비교와 다음 운영의 설계를 설명한다. 추가 Python 스크립트는 기존 최소 스키마 검증을 재사용하며 공개 원본 데이터·인과 효과를 제공하지 않는다.

분석 전용 테스트 4건은 한국 날짜 경계·자정 이후 완료·nearest-rank·짧은 기록 보존·보조 표본·누락/역전·기간 밖 기록·개인정보 필드 차단·날짜 오류·15분/30분 초과의 경계값과 분모·음식 1개 표본을 검증한다. 원본 운영 데이터는 테스트 fixture로 커밋하지 않는다.

## 릴리스·도식 검증의 현재 상태

기능 코드 기준 `da381a3`, 실제 배포 ID·asset, 이후 문서 커밋을 구분하는 근거는 [운영 절차](deployment-runbook.md)에 있다. 현재 서버에 SHA·빌드 시각을 반환하는 release endpoint는 없다. 따라서 저장소 최신 커밋을 운영 코드라고 추정하지 않는다.

기술 문서의 Mermaid 6개 블록은 현재 구현을 기준으로 작성한 소스다. DDL은 로컬 SQLite에서 테이블·제약을 확인했고 문서 링크·앵커를 검사했다. **GitHub의 실제 도식 렌더링·모바일 가독성은 아직 시각 검증하지 않았다.** 앞으로 릴리스 메타데이터와 함께 확인할 항목이며, 검증하지 않은 결과를 완료로 표시하지 않는다.
