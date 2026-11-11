# 03. API 및 AI 이미지/텍스트 구현 지침

## POST /api/analyze
- Content-Type: `multipart/form-data`
- 필드: `images` (최대 5개)
- 허용 MIME: image/jpeg, image/png, image/webp
- 파일당 최대 8MB
- 서버에서 실제 파일 형식과 크기를 검증한다.
- OpenAI 이미지 입력이 가능한 모델을 사용한다. 모델명은 서버 설정으로 관리한다.

### 응답 예시
```json
{
  "success": true,
  "ingredients": [
    {"name": "달걀", "confidence": "high", "note": "문 안쪽 선반에서 식별"},
    {"name": "두부", "confidence": "medium", "note": "포장 일부가 가려져 확인 필요"}
  ]
}
```
- confidence는 high/medium/low 중 하나
- low 또는 불확실한 항목은 UI에서 '확인 필요' 표시
- 식재료 후보 외에 신선도, 소비기한, 상함 여부를 반환하지 않는다.

## POST /api/recipes
### 요청 예시
```json
{
  "ingredients": ["달걀", "두부", "대파"],
  "servings": 2,
  "preference": "한식",
  "useFirst": ["대파"]
}
```
- ingredients는 사용자가 확인한 재료만 포함한다.
- servings는 허용 범위 내 정수로 검증한다.
- 추천 결과는 요리 3개를 기본으로 한다.

### 응답 예시
```json
{
  "success": true,
  "recipes": [
    {
      "name": "두부 달걀국",
      "reason": "확인된 재료를 활용할 수 있습니다.",
      "ownedIngredients": ["두부", "달걀", "대파"],
      "extraIngredients": ["국간장"],
      "timeMinutes": 15,
      "difficulty": "쉬움",
      "steps": ["재료를 준비합니다.", "냄비에 물을 끓입니다."]
    }
  ]
}
```

## AI 프롬프트 원칙
- 사진에 실제로 보이는 식재료 후보만 추출한다.
- 포장 안의 내용물, 가려진 물체, 정확한 브랜드/제품명을 추측하지 않는다.
- 이미지에서 소비기한 글자가 명확히 읽히더라도 안전성 판정으로 확대 해석하지 않는다.
- 식품이 상했는지, 먹어도 되는지 판단하지 않는다.
- 요리 추천은 사용자가 확인한 재료만 근거로 한다.
- 보유 재료와 추가 구매 재료를 명확히 구분한다.
- 결과 JSON을 서버에서 검증하고 파싱 실패 시 안전한 오류를 반환한다.

## POST /api/feedback 및 GET /api/feedback
- POST body: `{ "name": "선택 이름", "message": "피드백 내용" }`
- message 필수 1~500자, name 선택 최대 30자
- GET은 최신순 목록 반환
- 오류 응답은 `{ "success": false, "message": "..." }` 형식
