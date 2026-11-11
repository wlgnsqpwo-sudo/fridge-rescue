# 01. 시스템 구조 및 프로젝트 생성 지침

## 권장 폴더
```text
fridge-rescue/
├─ api/
│  └─ index.js
├─ public/
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/app.js
├─ docs/
├─ AGENTS.md
├─ PRD.md
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

## 구성요소
- 브라우저: 입력 폼, 이미지 미리보기, 재료 확인/수정, 추천 결과, 피드백 UI
- Node 서버: 입력/파일 검증, OpenAI 요청, Supabase 저장/조회
- OpenAI: 이미지에서 식재료 후보 추출, 확인된 재료로 요리 추천
- Supabase: 피드백 데이터 저장
- Vercel: 정적 페이지와 서버 API 배포

## 주요 데이터 흐름
1. 여러 장의 이미지 또는 직접 입력한 재료를 브라우저에서 준비한다.
2. 이미지 분석 요청은 multipart/form-data로 서버에 전송한다.
3. 서버가 이미지 개수, MIME 형식, 크기를 검증한 뒤 OpenAI 이미지 입력 모델에 전달한다.
4. AI가 식재료 후보를 반환하고 브라우저는 사용자가 수정할 수 있게 표시한다.
5. 사용자가 확인한 재료 목록을 `/api/recipes`로 전송한다.
6. 서버가 OpenAI에 요리 추천을 요청하고 구조화된 결과를 반환한다.
7. 피드백은 `/api/feedback`으로 저장/조회한다.

## 필수 원칙
- 이미지 분석과 요리 추천은 별도 단계다. 분석 결과 확인 전 자동으로 추천하지 않는다.
- 이미지는 기본적으로 DB나 파일 스토리지에 보관하지 않는다.
- 로컬과 Vercel에서 같은 API 경로가 동작하도록 구성한다.
