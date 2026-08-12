# Device QA residual execution notes (2026-08-12)

목표: `docs/DEVICE_QA_CHECKLIST.md`의 미완료 항목 중, 이번 단계에서 실행 가능한 항목을 우선 처리하고  
물리 기기 검증 필요 항목은 별도 상태로 정리.

## 실행 환경
- 로컬 워크트리: `agent/easygo-path-c-staging-release`
- 날짜(UTC 기준): 2026-08-12
- 네트워크: 일부 외부 엔드포인트 접근 제한 (npm registry / Expo API / staging backend 접근 실패)
- 물리 iOS/Android 기기: 사용 불가 (이 환경에서 테스트 불가)

## 이번 단계에서 실행한 항목
- [x] `npm run preflight:staging` (root)
  - 결과: PASS 0 failure / WARN 4
  - 요약:
    - `EXPO_PUBLIC_*` 기반 모바일 체크 통과
    - 동의문 버전/정책 URL 경고(실제 서비스 배포값 미확인 또는 미설정 상태)
    - Privy allowlist는 경고(원격 검증 미확인)
- [x] `cd backend && npm run preflight:staging`
  - 결과: FAIL 9 (로컬 `.env` 미설치로 필수 서버 값 누락)
  - 내용:
    - `NODE_ENV`, `DATABASE_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `SQUID_INTEGRATOR_ID`, `ADMIN_SECRET`, `SERVICE_NAME`, `RELEASE_SHA`, `EASYGO_CONSENT_VERSION` 등 미설정
    - Sentry/Better Stack 미설정은 WARN로 구분되어 의도적 미활성으로 표시
- [x] `npm run test` (backend)
  - 결과: pass 126 / fail 0 / skip 1
  - 장점: 경로/동의/스키마/운영 보호 로직에 대한 회귀 포인트 검증됨
- [x] `npm run test:preflight` (mobile preflight unit)
  - 결과: pass 50 / fail 0
  - 주석: 모바일 사전점검 로직은 정상 동작
- [x] `npx expo-doctor`
  - 결과: 13/17 pass, 4 fail
  - 오프라인 환경 및 정책 제약으로 Expo API 검증 2건 실패(`exp.host`, `api.expo.dev`), legacy `eas-cli` 경고, `expo-image-picker@15.1.0` 권장 버전 미스매치, Expo SDK 호환성 검사 fallback 경고.
  - 실패 항목:
    - 앱 스키마 검사 API 연결 실패 (네트워크 제한)
    - 로컬 `eas-cli` 제거 권고
    - `expo-image-picker` 버전 기대치 `~15.0.7` 미충족
    - `packages match required versions` 검사 불안정(오프라인 fallback)
- [x] `npx prisma validate` (DB URL 더미 지정)
  - 결과: OK (스키마는 유효)
- [ ] 기기 기반 항목 전체 (iOS/Android 실제 설치/재시작/로그인/탐색/노티피케이션/엑스포트/딥링크)
  - 상태: **보류** (물리 기기 없음)

## 미실행 항목(물리 기기 검증 필요)
- `docs/DEVICE_QA_CHECKLIST.md` 줄 175, 177, 187, 196, 198, 207, 218, 219, 220, 222, 224, 227, 229, 230, 249, 252, 255, 257, 265, 267, 269, 271, 275
- 권장 다음 조치:
  1. iPhone 16 Pro Max와 Android 실제 기기에서 각 경로별 체크리스트 반복 수행
  2. 실패 시 빌드 번호/화면/스크린샷/UTC 시간 포함하여 이슈 템플릿 형식으로 즉시 기록
  3. `/auth/sync`, feed/profile/follow/notification/Orange/quote 경로가 401/404/5xx 없이 1회 통과 후 1회 재실행 테스트까지 완료되면 해당 항목만 체크

## 다음 단계 연결
- 본 노트의 수동 항목은 PR 텍스트용 참고사항으로 `backend/docs/DEPLOY_CHECKLIST.md`의 미완료 항목 정리와 함께 묶어 공유
