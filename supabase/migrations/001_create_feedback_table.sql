-- ====================================================================
-- 001_create_feedback_table.sql
-- 냉장고 구조대(FRIDGE RESCUE) 피드백 테이블 생성 및 최신순 인덱스 정의
-- ====================================================================

-- 1. UUID 생성을 위한 pgcrypto 확장 활성화 (필요 시)
create extension if not exists pgcrypto;

-- 2. feedback 테이블 생성
-- 컬럼 정의:
-- - id: 고유 식별자 (UUID 자동 생성)
-- - name: 작성자 이름 (선택 항목, 최대 30자)
-- - message: 피드백 본문 (필수 항목, 1자 이상 500자 이하)
-- - created_at: 작성 시각 (기본값: 현재 타임스탬프)
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

-- 3. 피드백 최신순 정렬 조회를 위한 인덱스 생성
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- 4. 테이블 코멘트 추가 (문서화 및 관리용)
comment on table public.feedback is '냉장고 구조대 사용자 의견 및 피드백 저장 테이블';
comment on column public.feedback.id is '피드백 고유 식별자 UUID';
comment on column public.feedback.name is '작성자 이름 또는 닉네임 (선택)';
comment on column public.feedback.message is '피드백 내용 (1~500자)';
comment on column public.feedback.created_at is '피드백 작성 일시 (최신순 정렬용)';

