# PR #40( `feat: add telegram wallet/help commands`) 검토 노트

요약: 코드/테스트는 통과했지만, 다음 배포/릴리스 전 체크리스트에서 미완료 항목을 별도 추적합니다.  
일단 기기 QA는 현재 브랜치/테스트 범위를 벗어나므로 **별도 릴리스 체크로 분리**합니다.

## 남은 DEPLOY 체크리스트 항목 (완결 우선순위)

### 1) 운영/보안 선결 조건
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 29: Expo Doctor 15/17 통과 상태 정리. 현재 로컬 EAS CLI/Transitive Expo config drift가 남아 있음.
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 46: Draft PR #17 리뷰/승인(과거 스테이징 릴리스 마감 조건) 아직 미완료.
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 148: 게시된 Privacy/Terms 버전이 `EASYGO_CONSENT_VERSION`과 일치하는지 최종 검증 필요.
  - 후보 `2026-08-10-staging-v1`은 내부 검토 상태로, 법무 승인/운영 승인이 남아 있음.
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 159: 남은 Squid, Privy/Solana, Expo audit 항목 대응 필요
  - 백엔드: `node-telegram-bot-api`는 이미 마이그레이션으로 고침이 완료되었으나, Squid 의존성 갱신과 `@privy-io/server-auth` → `@privy-io/node` 전환이 남음.
  - 모바일: Expo 51 체인에서 크리티컬 이슈 존재(개별 프레임워크 릴리스 요구).
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 211: Sentry/Better Stack 활성/모니터링은 현재 미설정 상태. 운영 승인 전까지 보류.

### 2) 배포 실행 직전/후
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 179: Path C 플래그 미활성 상태에서 `/feed`, `/profile`, `/follow`, `/notifications`, `/orange`, `/squid quote` 실경로 검증 미완료.
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 189: 활성(worker) 상태에서 `SIGTERM` 실행 점검 미완료 (현재는 `SEGMENTS_ENABLED=false` 상태만 확인).
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 211: 베이스라인 안정화 후 Path C 기능 1개를 별도 릴리스로 단계적 활성 필요.
- [ ] `backend/docs/DEPLOY_CHECKLIST.md` 211: 모니터링 윈도우 완료 전 릴리스 종료 불가.

## 다음 PR/이슈 분할 권장
1. **릴리스-전 제로-디펜던시 보완 PR**
   - PR 템플릿에서 상기 항목 중 보안/감사 대응 항목만 처리.
2. **기기 QA 후보 PR**
   - `docs/DEVICE_QA_CHECKLIST.md`의 미완료 물리기기 항목을 별도 PR으로 관리(운영 기기/로그 증적 포함).
3. **기능 스펙 PR**
   - PR #40 Merge 후 `agent/easygo-next-feature-spec-2`에서 다음 과제(사용자 요청 기능) 개발 착수.

## 코드/테스트 상태
- 완료: `node --test backend/test/telegram-lib.test.js backend/test/telegram.test.js`
- 커밋: `a9be2e4` (wallet/help 및 /wallet 링크, 테스트 보강)
- PR: #40 (Draft, mergeable)

