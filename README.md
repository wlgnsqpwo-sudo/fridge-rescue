# 냉장고 구조대 (FRIDGE RESCUE)

냉장고 속 재료를 직접 입력하거나 여러 장의 사진으로 분석해 요리를 추천하는 AI 서비스의 구현 지침 패키지입니다.

## 문서
- `PRD.md`: 제품 요구사항 및 완료 기준
- `AGENTS.md`: Antigravity 에이전트 작업 규칙
- `docs/`: 구조, UI, API/AI, Supabase, 테스트, 배포 지침

## 시작
1. Antigravity에서 이 폴더를 엽니다.
2. `AGENTS.md`, `PRD.md`, `docs/`를 모두 읽고 구현하도록 요청합니다.
3. `.env.example`을 복사해 `.env`를 만들고 본인의 API 키를 입력합니다.
4. `docs/04_DATABASE_SUPABASE.md`의 SQL을 Supabase SQL Editor에서 실행합니다.
5. `npm install`, `npm run dev` 후 `http://localhost:3000`에서 테스트합니다.

주의: 이 압축파일은 설계/구현 지침 패키지이며 실제 웹앱 소스코드는 Antigravity 에이전트가 생성해야 합니다.
