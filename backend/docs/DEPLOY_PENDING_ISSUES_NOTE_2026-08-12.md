# Deploy checklist pending items — unresolved checklist-only note for PR

요약: `backend/docs/DEPLOY_CHECKLIST.md`의 미완료 항목만 추려서, 현재 환경에서 검증 가능한 범위 + 미진행 사유를 정리한 PR 노트용 자료입니다.

문서 기준 라인 번호: `backend/docs/DEPLOY_CHECKLIST.md`

| 항목(체크리스트 라인) | 점검 상태(2026-08-12) | 근거/증거 | 다음 조치 |
|---|---|---|---|
| 29 (`Expo Doctor currently passes 15/17...`) | `부분 보완 필요` | `npx expo-doctor` 실행 결과 13/17(오프라인 제약으로 Expo API 요청 실패), `eas-cli` 의존성 및 `expo-image-picker` 버전 drift 경고 확인 | 네트워크 가능한 환경에서 정식 `expo-doctor` 재실행 후 실패 항목 2건 정합성 확인 |
| 46 (`Draft PR #17 reviewed and approved`) | `미완료` | PR 리뷰/승인 상태 미확인(본 작업에서는 코드 리뷰 승인 단계 불가) | PR #17 리뷰어 승인 획득 후 체크 |
| 148 (`Verify published privacy/terms version...`) | `미완료` | 현재 배포 문맥에서 `EASYGO_CONSENT_VERSION`과 문서 버전 정합성 확인 불가. 모바일 preflight에서 legal warning 발생 | 배포 문서(privacy/terms) 공개 URL의 버전 메타와 `EASYGO_CONSENT_VERSION`/`EXPO_PUBLIC_EASYGO_*` 값을 동기화 |
| 153 (`Approve or remediate audit findings`) | `미완료` | backend README/체크리스트 상 기존 크리티컬 항목 다수 언급, npm audit는 네트워크 제한으로 실행 불가 | 오프라인 제약 없는 환경에서 audit 결과 갱신 후 위험 저감 방안(Expo/React Native/Privy 업그레이드 계획 또는 예외 승인) 수립 |
| 170 (`Verify feed/profile/follow/notification...`) | `미완료` | 물리기기/실서비스 트래픽에서의 read-path 다건 통합 검증 미실시 | staging 기기 1차 QA(재로그인, 재시도 루프, 401/404/5xx 무반복) 수행 |
| 180 (`Exercise SIGTERM for an enabled worker...`) | `미완료` | 웹/오프라인 체크는 완료, worker enabled 시나리오는 미실시 | `SEGMENTS_ENABLED=true` 승인 환경에서 우선 staging에서 SIGTERM 연습 |
| 184 (`Activate and monitor Sentry and Better Stack...`) | `미완료` | 백엔드 preflight가 두 항목 모두 경고(미설정)로 표시 | 운영/개인정보 승인 완료 후 Sentry/Better Stack 설정하고 스로틀·샘플레이트 운영 정책 기록 |
| 186 (`Only after baseline stable... enable one Path C feature`) | `미완료` | 베이스라인(운영 트래픽·알람 임계치) 미정착 상태 | 배포 모니터링/알람 임계치 확정 후 1개 feature만 별도 PR로 점진 활성화 |
| 202 (`Close the release only after monitoring window`) | `미완료` | 모니터링 윈도우 종료 및 회수 규칙 완료 미달성 | 15+분 정식 모니터링/로그 보강 후 릴리스 종료 절차 수행 |

## 이번 실행에서 덧붙인 점
- `npm run preflight:staging` (root): 0 failure / 4 warn.  
- `cd backend && npm run preflight:staging`: 로컬 비공개 환경이라 필수 시크릿/URL 누락으로 9 실패(자체 환경 구성값 미설정).
- `npx expo-doctor`: 외부 접근 제한으로 기존 expected drift 항목의 일부가 강화되어 표시됨.
- `backend` 테스트/프리플라이트 테스트 모두 통과하여 현재 코드 베이스의 회귀 리스크는 낮음.

## PR 본문 템플릿으로 바로 사용 가능한 결론
- "미완료 항목(privacy/legal, audits, path-c enablement)은 배포 전 게이트로 유지."
- "물리 기기 기반 기능 QA 및 worker enabled 경로는 다음 실행 블록에서 분리 실행."
- "문서/버전/규정 정합성 항목(148/153)은 외부 문서/감사 환경 승인 후 즉시 반영."

## Device QA residual (checklist-only, operator execution block)

The checklist `docs/DEVICE_QA_CHECKLIST.md` still has 기기 검증 중심 항목 that are currently blocked by missing physical devices in this environment.

- 상태 요약 (2026-08-12): iOS/Android 실기기 실행 미완료
- 영향: `/auth/sync`, 피드/프로필/팔로우/알림/Orange/quote/JSON export/딥링크/재로그인 재확인 항목은 실제 배포 전까지 미완료로 둡니다.
- 선행 증거(현재 환경):
  - `docs/DEVICE_QA_RESIDUAL_EXECUTION_2026-08-12.md`에 실행된 항목과 미실행 항목 라인 번호 기록
  - 물리 기기 미보유로 `기기 기반 항목 전체`가 보류됨

미완료 핵심 라인(현 시점):
- iOS: 175, 177, 196, 198, 207, 218, 219, 220, 222, 224, 227, 229, 230, 249, 252, 255, 257, 265, 267, 269, 271, 275
- Android: 187

다음 실행 블록에서 PR용으로 넣을 최소 체크 항목:
1. 1회 Google sign-in + 딥링크 복귀 + 앱 재시작 후 세션 재개
2. 1회 iOS/Android 물리 설치 검증 (앱 시작, 재시작, `/auth/sync` 실패/재시도 포함)
3. feed/profile/follow/notification/quote 경로 401/404/5xx 무반복, 한 번 재시도 통과
4. full/external JSON export 1회 생성·공유·삭제/취소 회귀
5. `Build 101` 기기 로그(`/ready`, `/lifecycle`) 보존
