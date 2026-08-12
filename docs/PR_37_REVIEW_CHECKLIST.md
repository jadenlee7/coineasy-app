# PR #37 Review Checklist (Draft)

## 제목
`feat: add telegram /wallet command`

## 요약
이번 PR은 Telegram 봇에 EasyGo 계정 연동 정보를 반영한 `/wallet` 명령을 추가합니다.

- `backend/src/lib/telegram.js`
  - Telegram 사용자 ID로 연동 사용자 조회 헬퍼 `getTelegramWalletById` 추가
  - `/wallet` 핸들러 추가
    - 연동되지 않은 사용자 안내
    - 지갑 미생성 사용자 안내
    - 지갑 주소 출력
  - 명령 목록 주석에 `/wallet` 항목 추가
- `backend/test/telegram-lib.test.js`
  - `getTelegramWalletById` 단위 테스트 2건 추가
  - `/wallet` 처리 흐름 테스트 3건 추가

## 변경량 요약
- `backend/src/lib/telegram.js`: +43, -0
- `backend/test/telegram-lib.test.js`: +90, -1
- 총 132 insertions, 1 deletion

## 병합 승인용 근거 체크리스트

### 기능 동작
- [x] `/wallet` 입력 시 Telegram 사용자 정보가 없으면 명시적 안내 텍스트를 반환
- [x] 연결되지 않은 Telegram 사용자면 연동 가이드를 안내
- [x] 지갑 주소가 없는 사용자면 지갑 생성/연결 안내
- [x] 연동 사용자/지갑 있을 경우 `연동된 지갑 주소: ...` 출력

### 안전성
- [x] 기존 `/start`, `/balance`, `/invite` 흐름은 영향도 없이 유지
- [x] 처리 실패가 `throw`로 새 에러로 노출되지 않고 사용자 메시지로 완결
- [x] 지갑 주소 조회는 내부 DB 조회만 수행(외부 서비스 호출 없음)

### 테스트 증적
- [x] `node --test backend/test/telegram-lib.test.js` → **PASS 12/12**
- [x] `cd backend && npm test` → **PASS 138, SKIP 1, FAIL 0**

### 배포/릴리스 영향
- [x] 런타임 변경 없음 (백엔드 봇 모듈 내 명령 처리/조회만 추가)
- [x] DB 스키마/마이그레이션 변경 없음
- [x] 기능 플래그 변경 없음

### 리뷰 포인트
- 사용자 식별은 Telegram `from.id` 문자열 변환 후 조회
- `getTelegramWalletById`는 사용자 미존재 시 `null`, 존재 시 `userId + walletAddress|null` 반환
- 테스트는 핸들러 단위로 분기별 응답 문구를 검증

## 병합 권장

- [ ] 코드 2개 파일 diff 확인(핸들러 흐름, 테스트 추가)
- [ ] 테스트 증적 및 PR 산출물 링크/요약 확인
- [ ] QA 문서/남은 체크리스트 반영 여부 확인(권한/기기 QA는 별도 진행)

