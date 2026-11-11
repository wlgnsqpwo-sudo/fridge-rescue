# 06. 환경변수, Git 및 Vercel 배포 지침

## 환경변수
`.env.example`을 복사해 `.env`를 만들고 실제 값을 입력한다.

```env
OPENAI_API_KEY=여기에_OpenAI_API_Key
OPENAI_MODEL=이미지_입력을_지원하는_모델명
SUPABASE_URL=여기에_Supabase_Project_URL
SUPABASE_SECRET_KEY=여기에_Supabase_Secret_Key
```
- 모델명은 계정에서 사용 가능한 이미지 입력 지원 모델로 설정한다.
- 실제 키를 문서, 코드, Git에 기록하지 않는다.
- 모든 비밀 값은 서버에서만 읽는다.

## .gitignore
```gitignore
node_modules/
.env
.env.*
!.env.example
.vercel/
.DS_Store
```

## 로컬 실행
```bash
npm install
npm run dev
```
`http://localhost:3000`에서 확인한다.

## GitHub 업로드
```bash
git init
git add .
git status
```
`git status`에서 `.env`가 없는지 확인한다.
```bash
git commit -m "Initial Fridge Rescue project"
git branch -M main
git remote add origin https://github.com/본인계정/저장소이름.git
git push -u origin main
```
이미 remote가 있으면 `git remote add`는 다시 실행하지 않는다.

## Vercel 배포
1. Vercel에서 GitHub 저장소 Import
2. 프로젝트 Settings의 Environment Variables에 다음 값 등록
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
3. 배포
4. 환경변수를 변경한 경우 Redeploy
5. 배포 URL에서 이미지 분석, 직접 입력 추천, 피드백 저장/조회 테스트

## 제출 문구
- 팀/이름: [00팀-이름]
- 서비스명: 냉장고 구조대
- 서비스 1줄 소개: 냉장고 사진이나 직접 입력한 식재료를 AI가 분석해 만들 수 있는 요리와 레시피를 추천하는 서비스
- URL: [Vercel 배포 후 입력]
