# 04. Supabase 데이터베이스 지침

## 테이블: feedback

| 컬럼 | 타입 | 설정 |
|---|---|---|
| id | uuid | primary key, default gen_random_uuid() |
| name | text | nullable |
| message | text | not null, 1~500자 |
| created_at | timestamptz | not null, default now() |

## SQL Editor 실행
```sql
create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
```

## 보안/운영
- Node 서버에서 Supabase 서버 전용 Secret Key로 접근한다.
- 브라우저에는 Supabase Secret Key를 절대 전달하지 않는다.
- 사진 파일은 기본적으로 Supabase Storage나 DB에 저장하지 않는다.
- 피드백은 공개 목록으로 표시되므로 개인정보 입력 금지 안내를 UI에 둔다.
- 서버에서 피드백 길이와 자료형을 재검증한다.
